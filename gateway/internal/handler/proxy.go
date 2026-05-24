package handler

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"

	"github.com/llmgateway/gateway/internal/billing"
	"github.com/llmgateway/gateway/internal/pool"
	"github.com/llmgateway/gateway/internal/ratelimit"
	"github.com/llmgateway/gateway/internal/tokenizer"
)

// Tier defaults
const (
	defaultRPM        = 60
	defaultTPM        = 100_000
	defaultConcurrent = 5
	maxRetries        = 3
	baseBackoff       = 200 * time.Millisecond
	maxBackoff        = 10 * time.Second
)

// HandlerDeps holds all dependencies for HTTP handlers.
type HandlerDeps struct {
	Pool     *pool.ChannelPool
	Limiter  *ratelimit.Limiter
	PG       *pgxpool.Pool
	RDB      *redis.Client
	Billing  *billing.WorkerPool
	Pricing  *billing.PricingEngine
	Quota    *billing.QuotaEnforcer
	Tok      *tokenizer.Tokenizer
}

// ChatCompletions proxies /v1/chat/completions through the channel pool.
func ChatCompletions(deps *HandlerDeps) fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID := c.Locals("user_id").(string)
		apiKeyID := c.Locals("api_key_id").(string)
		tier := c.Locals("tier").(string)

		GlobalMetrics.IncRequests()

		// --- Tier 1: IP-based rate limiting ---
		ip := c.IP()
		if err := deps.Limiter.AllowIP(c.Context(), ip, 300); err != nil {
			return rateLimitResponse(c, err)
		}

		// --- Tier 2: User RPM ---
		rpmLimit := getIntLocal(c, "rpm_limit", tierRPM(tier))
		if err := deps.Limiter.AllowRPM(c.Context(), userID, rpmLimit); err != nil {
			GlobalMetrics.IncRateLimited()
			return rateLimitResponse(c, err)
		}

		// --- Tier 3: User concurrency ---
		concurrentLimit := tierConcurrent(tier)
		if err := deps.Limiter.CheckUserConcurrency(c.Context(), userID, concurrentLimit); err != nil {
			return rateLimitResponse(c, err)
		}
		defer deps.Limiter.ReleaseUserConcurrency(c.Context(), userID)

		// --- Parse request body ---
		var reqBody map[string]interface{}
		if err := c.BodyParser(&reqBody); err != nil {
			return c.Status(400).JSON(openAIError("Invalid request body", "invalid_request_error"))
		}

		model, _ := reqBody["model"].(string)
		if model == "" {
			model = "gpt-4o-mini"
		}
		model = resolveModel(c.Context(), deps, model)
		reqBody["model"] = model
		stream, _ := reqBody["stream"].(bool)

		// --- Tier 4: Accurate token counting with tiktoken ---
		promptTokens, _ := deps.Tok.CountRequestTokens(reqBody)
		tpmLimit := getIntLocal(c, "tpm_limit", tierTPM(tier))
		if err := deps.Limiter.CheckTPM(c.Context(),
			fmt.Sprintf("ratelimit:tpm:%s", userID), promptTokens, tpmLimit); err != nil {
			return rateLimitResponse(c, err)
		}

		// --- Pre-request balance & quota check ---
		// Estimate max cost for this request
		price := deps.Pricing.GetPrice(c.Context(), model)
		if price != nil {
			estCost := deps.Pricing.CalculateCost(model, promptTokens, 0, tier)
			if tier == "free" {
				costCents := estCost / 1_000_000
				if costCents < 1 {
					costCents = 1
				}
				if err := deps.Quota.CheckBalance(c.Context(), userID, costCents); err != nil {
					return c.Status(402).JSON(openAIError(
						fmt.Sprintf("Insufficient balance: %v", err), "insufficient_funds"))
				}
			}
		}

		// Check daily quota (free tier)
		if tier == "free" {
			quota, err := deps.Quota.CheckDailyQuota(c.Context(), userID)
			if err != nil || !quota.Allowed {
				msg := "Daily quota exceeded"
				if quota != nil {
					msg = fmt.Sprintf("Daily quota exceeded: %d/%d tokens. Resets in %s",
						quota.CurrentUsage, quota.DailyLimit, quota.ResetsAt.Format("15:04 UTC"))
				}
				return c.Status(429).JSON(openAIError(msg, "quota_exceeded"))
			}
		}

		// --- Channel acquisition with retry + backoff ---
		requestID := uuid.New().String()
		startTime := time.Now()
		bodyBytes, _ := json.Marshal(reqBody)

		resp, channel, err := executeWithRetry(c, deps, model, bodyBytes, stream, requestID, userID)
		if err != nil {
			GlobalMetrics.IncFailed()
			return c.Status(502).JSON(openAIError(
				fmt.Sprintf("Upstream request failed after %d retries: %v", maxRetries, err),
				"server_error"))
		}
		defer resp.Body.Close()
		defer deps.Pool.ReleaseChannel(c.Context(), channel)

		// --- Stream or buffer response ---
		if stream && resp.StatusCode == 200 {
			GlobalMetrics.SSEStart()
			return proxySSE(c, resp, deps, userID, apiKeyID, channel.ID, model, requestID, promptTokens, tier)
		}

		// Non-streaming: buffer full response
		c.Set("Content-Type", "application/json")
		c.Status(resp.StatusCode)

		var buf bytes.Buffer
		teeReader := io.TeeReader(resp.Body, &buf)
		responseBytes, _ := io.ReadAll(teeReader)

		// Extract exact token usage from response
		respPrompt, respCompletion := tokenizer.ParseResponseUsage(responseBytes)
		if respPrompt == 0 && respCompletion == 0 {
			// Fallback: use pre-counted prompt tokens, estimate completion
			respPrompt = promptTokens
			respCompletion = 0 // We'll use the total from response
		}

		// Async billing via worker pool
		deps.Billing.Enqueue(billing.BillingTask{
			UserID:           userID,
			APIKeyID:         apiKeyID,
			ChannelID:        channel.ID,
			Model:            model,
			RequestID:        requestID,
			Endpoint:         "chat/completions",
			PromptTokens:     max(respPrompt, 0),
			CompletionTokens: max(respCompletion, 0),
			PricingID:        "",
		})

		GlobalMetrics.AddTokens(respPrompt + respCompletion)
		GlobalMetrics.IncBillingEvent()
		GlobalMetrics.IncSuccess()

		// Track latency
		elapsed := time.Since(startTime).Milliseconds()
		log.Printf("[%s] %s %s -> %s %dms prompt=%d completion=%d",
			requestID[:8], model, channel.Name, channel.Provider, elapsed, respPrompt, respCompletion)

		deps.Pool.RecordSuccess(c.Context(), channel)
		return c.Send(responseBytes)
	}
}

// executeWithRetry attempts the upstream request with exponential backoff.
func executeWithRetry(c *fiber.Ctx, deps *HandlerDeps,
	model string, bodyBytes []byte, stream bool, requestID, userID string,
) (*http.Response, *pool.Channel, error) {

	var lastErr error

	for attempt := 0; attempt <= maxRetries; attempt++ {
		if attempt > 0 {
			backoff := time.Duration(math.Min(
				float64(baseBackoff)*math.Pow(2, float64(attempt-1)),
				float64(maxBackoff),
			))
			log.Printf("[%s] Retry %d/%d after %v", requestID[:8], attempt, maxRetries, backoff)

			select {
			case <-c.Context().Done():
				return nil, nil, fmt.Errorf("client disconnected during retry")
			case <-time.After(backoff):
			}
		}

		channel, err := deps.Pool.AcquireChannel(c.Context(), model)
		if err != nil {
			lastErr = err
			continue
		}

		baseURL := strings.TrimRight(channel.BaseURL, "/")
		targetURL := baseURL + "/v1/chat/completions"
		isGemini := channel.Provider == "gemini"
		reqBodyToSend := bodyBytes
		if isGemini {
			reqBodyToSend, targetURL, _ = prepareGeminiRequest(baseURL, channel.APIKey, model, bodyBytes, stream)
		}

		req, err := http.NewRequestWithContext(c.Context(), "POST", targetURL, bytes.NewReader(reqBodyToSend))
		if err != nil {
			deps.Pool.ReleaseChannel(c.Context(), channel)
			lastErr = err
			continue
		}
		req.Header.Set("Authorization", "Bearer "+channel.APIKey)
		req.Header.Set("Content-Type", "application/json")
		if stream {
			req.Header.Set("Accept", "text/event-stream")
		} else {
			req.Header.Set("Accept", "application/json")
		}
		req.Header.Set("X-Request-ID", requestID)

		var resp *http.Response
		if isGemini {
			resp = doGeminiRequest(targetURL, reqBodyToSend, model)
		} else {
			resp, err = channel.HTTPClient.Do(req)
		}
		if err != nil {
			deps.Pool.RecordError(c.Context(), channel, 500)
			deps.Pool.ReleaseChannel(c.Context(), channel)
			lastErr = err
			continue
		}

		switch resp.StatusCode {
		case 429:
			resp.Body.Close()
			deps.Pool.RecordError(c.Context(), channel, 429)
			deps.Pool.ReleaseChannel(c.Context(), channel)
			lastErr = fmt.Errorf("upstream rate limited (429)")
			continue
		case 401, 403:
			resp.Body.Close()
			deps.Pool.RecordError(c.Context(), channel, resp.StatusCode)
			deps.Pool.ReleaseChannel(c.Context(), channel)
			lastErr = fmt.Errorf("upstream auth error (%d)", resp.StatusCode)
			continue
		case 502, 503, 504:
			resp.Body.Close()
			deps.Pool.RecordError(c.Context(), channel, resp.StatusCode)
			deps.Pool.ReleaseChannel(c.Context(), channel)
			lastErr = fmt.Errorf("upstream unavailable (%d)", resp.StatusCode)
			continue
		}

		if resp.StatusCode >= 500 {
			deps.Pool.RecordError(c.Context(), channel, resp.StatusCode)
		}
		return resp, channel, nil
	}

	return nil, nil, fmt.Errorf("all retries exhausted: %w", lastErr)
}

// proxySSE streams Server-Sent Events from upstream to the client.
func proxySSE(c *fiber.Ctx, resp *http.Response, deps *HandlerDeps,
	userID, apiKeyID, channelID, model, requestID string, promptTokens int, tier string) error {

	c.Set("Content-Type", "text/event-stream")
	c.Set("Cache-Control", "no-cache, no-transform")
	c.Set("Connection", "keep-alive")
	c.Set("X-Accel-Buffering", "no")
	c.Status(200)

	streamComplete := make(chan struct{})
	var completionTokens int
	var lastStreamErr error

	c.Context().SetBodyStreamWriter(func(w *bufio.Writer) {
		defer close(streamComplete)
		defer resp.Body.Close()

		reader := bufio.NewReader(resp.Body)

		for {
			select {
			case <-c.Context().Done():
				return // Client disconnected
			default:
			}

			line, err := reader.ReadString('\n')
			if err != nil {
				if err != io.EOF {
					lastStreamErr = err
				}
				break
			}

			// Parse usage from SSE "data: {...}" chunks
			if strings.HasPrefix(line, "data: ") {
				data := strings.TrimPrefix(line, "data: ")
				if data == "[DONE]" || strings.TrimSpace(data) == "[DONE]" {
					w.WriteString("data: [DONE]\n\n")
					w.Flush()
					break
				}

				var chunk map[string]interface{}
				if json.Unmarshal([]byte(data), &chunk) == nil {
					if usage, ok := chunk["usage"].(map[string]interface{}); ok {
						if ct, ok := usage["completion_tokens"].(float64); ok {
							completionTokens = int(ct)
						}
						if pt, ok := usage["prompt_tokens"].(float64); ok {
							// Use actual prompt tokens from response if available
							if int(pt) > 0 {
								promptTokens = int(pt)
							}
						}
					}
				}
			}

			if _, err := w.WriteString(line); err != nil {
				return // Client disconnected
			}
			if strings.HasSuffix(line, "\n\n") || strings.HasSuffix(line, "\n") {
				w.Flush()
			}
		}
	})

	// After stream ends, record billing
	go func() {
		<-streamComplete
		GlobalMetrics.SSEEnd()
		if lastStreamErr != nil {
			log.Printf("[%s] SSE stream ended with error: %v", requestID[:8], lastStreamErr)
		}

		if promptTokens > 0 || completionTokens > 0 {
			deps.Billing.Enqueue(billing.BillingTask{
				UserID:           userID,
				APIKeyID:         apiKeyID,
				ChannelID:        channelID,
				Model:            model,
				RequestID:        requestID,
				Endpoint:         "chat/completions",
				PromptTokens:     max(promptTokens, 0),
				CompletionTokens: max(completionTokens, 0),
			})
			GlobalMetrics.AddTokens(promptTokens + completionTokens)
			GlobalMetrics.IncBillingEvent()
			GlobalMetrics.IncSuccess()
		}

		log.Printf("[%s] SSE complete: prompt=%d completion=%d total=%d",
			requestID[:8], promptTokens, completionTokens, promptTokens+completionTokens)
	}()

	return nil
}

// Embeddings proxies embedding requests.
func Embeddings(deps *HandlerDeps) fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID := c.Locals("user_id").(string)
		apiKeyID := c.Locals("api_key_id").(string)

		if err := deps.Limiter.AllowRPM(c.Context(), userID, defaultRPM); err != nil {
			return rateLimitResponse(c, err)
		}
		if err := deps.Limiter.CheckUserConcurrency(c.Context(), userID, defaultConcurrent); err != nil {
			return rateLimitResponse(c, err)
		}
		defer deps.Limiter.ReleaseUserConcurrency(c.Context(), userID)

		var reqBody map[string]interface{}
		c.BodyParser(&reqBody)
		model, _ := reqBody["model"].(string)
		if model == "" {
			model = "text-embedding-3-small"
		}
		model = resolveModel(c.Context(), deps, model)

		channel, err := deps.Pool.AcquireChannel(c.Context(), model)
		if err != nil {
			return c.Status(503).JSON(openAIError("No channel available", "server_error"))
		}
		defer deps.Pool.ReleaseChannel(c.Context(), channel)

		bodyBytes, _ := json.Marshal(reqBody)
		targetURL := strings.TrimRight(channel.BaseURL, "/") + "/v1/embeddings"

		req, _ := http.NewRequestWithContext(c.Context(), "POST", targetURL, bytes.NewReader(bodyBytes))
		req.Header.Set("Authorization", "Bearer "+channel.APIKey)
		req.Header.Set("Content-Type", "application/json")

		resp, err := channel.HTTPClient.Do(req)
		if err != nil {
			deps.Pool.RecordError(c.Context(), channel, 500)
			return c.Status(502).JSON(openAIError("Upstream error", "server_error"))
		}
		defer resp.Body.Close()

		if resp.StatusCode >= 500 || resp.StatusCode == 429 {
			deps.Pool.RecordError(c.Context(), channel, resp.StatusCode)
		} else {
			deps.Pool.RecordSuccess(c.Context(), channel)
		}

		c.Status(resp.StatusCode)
		respBody, _ := io.ReadAll(resp.Body)

		// Count embedding tokens from response usage
		respPrompt, _ := tokenizer.ParseResponseUsage(respBody)
		if respPrompt == 0 {
			// Fallback: count from input
			respPrompt, _ = deps.Tok.CountRequestTokens(reqBody)
		}

		if respPrompt > 0 {
			deps.Billing.Enqueue(billing.BillingTask{
				UserID:        userID,
				APIKeyID:      apiKeyID,
				ChannelID:     channel.ID,
				Model:         model,
				RequestID:     uuid.New().String(),
				Endpoint:      "embeddings",
				PromptTokens:  respPrompt,
			})
		}

		return c.Send(respBody)
	}
}

// ListModels moved to list_models.go

// --- Helpers ---

func openAIError(msg, typ string) fiber.Map {
	return fiber.Map{
		"error": fiber.Map{
			"message": msg,
			"type":    typ,
		},
	}
}

func rateLimitResponse(c *fiber.Ctx, err error) error {
	if rle, ok := err.(*ratelimit.RateLimitError); ok {
		return c.Status(429).JSON(fiber.Map{
			"error": fiber.Map{
				"message": rle.Message,
				"type":    rle.Type,
			},
			"retry_after": rle.RetryAfter,
		})
	}
	return c.Status(429).JSON(openAIError("Rate limit exceeded", "rate_limit_error"))
}

func tierRPM(tier string) int {
	switch tier {
	case "enterprise":
		return 300
	case "vip":
		return 120
	default:
		return defaultRPM
	}
}

func tierTPM(tier string) int {
	switch tier {
	case "enterprise":
		return 10_000_000
	case "vip":
		return 1_000_000
	default:
		return defaultTPM
	}
}

func tierConcurrent(tier string) int {
	switch tier {
	case "enterprise":
		return 20
	case "vip":
		return 10
	default:
		return defaultConcurrent
	}
}

func getIntLocal(c *fiber.Ctx, key string, fallback int) int {
	if v := c.Locals(key); v != nil {
		switch val := v.(type) {
		case int:
			return val
		case float64:
			return int(val)
		}
	}
	return fallback
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
