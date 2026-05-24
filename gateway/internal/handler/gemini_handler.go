package handler

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os/exec"
	"time"

	"github.com/llmgateway/gateway/internal/tokenizer"
)

// prepareGeminiRequest converts OpenAI request body to Gemini native format
// and constructs the AI Studio API URL with API key query parameter.
func prepareGeminiRequest(baseURL, apiKey, model string, bodyBytes []byte, stream bool) (reqBody []byte, targetURL string, err error) {
	if model == "" {
		model = "gemini-2.5-flash"
	}
	if stream {
		targetURL = baseURL + "/v1beta/models/" + model + ":streamGenerateContent?alt=sse&key=" + apiKey
	} else {
		targetURL = baseURL + "/v1beta/models/" + model + ":generateContent?key=" + apiKey
	}
	converted, convErr := tokenizer.ConvertOpenAIToGemini(bodyBytes, model)
	if convErr != nil {
		return bodyBytes, targetURL, nil
	}
	return converted, targetURL, nil
}

// doGeminiRequest executes a Gemini API call via system curl
// (bypasses Go TLS fingerprinting) and returns an OpenAI-formatted HTTP response.
func doGeminiRequest(url string, body []byte, model string) *http.Response {
	cmd := exec.Command("curl", "-s", "--connect-timeout", "10", "-m", "120", url,
		"-H", "Content-Type: application/json", "-d", "@-")
	log.Printf("[Gemini] body=%s", string(body[:min(len(body),200)]))
	cmd.Stdin = bytes.NewReader(body)
	out, err := cmd.Output()
	log.Printf("[Gemini] raw output len=%d err=%v", len(out), err)
	if err != nil {
		log.Printf("[Gemini] curl exec error: %v", err)
		return &http.Response{
			StatusCode: 502,
			Body:       io.NopCloser(bytes.NewReader([]byte(err.Error()))),
		}
	}

	// Check for Google API errors
	if bytes.Contains(out, []byte(`"error"`)) {
		code := 401
		if bytes.Contains(out, []byte("429")) || bytes.Contains(out, []byte("RESOURCE_EXHAUSTED")) {
			code = 429
		}
		log.Printf("[Gemini] Google API error (code=%d): %s", code, string(out[:min(len(out), 200)]))
		return &http.Response{
			StatusCode: code,
			Body:       io.NopCloser(bytes.NewReader(out)),
		}
	}

	// Parse Gemini response
	var geminiResp struct {
		Candidates []struct {
			Content struct {
				Parts []struct {
					Text string `json:"text"`
				} `json:"parts"`
				Role string `json:"role"`
			} `json:"content"`
			FinishReason string `json:"finishReason"`
		} `json:"candidates"`
		UsageMetadata struct {
			PromptTokenCount     int `json:"promptTokenCount"`
				CachedContentTokenCount  int `json:"cachedContentTokenCount"`
			CandidatesTokenCount int `json:"candidatesTokenCount"`
			TotalTokenCount      int `json:"totalTokenCount"`
		} `json:"usageMetadata"`
	}

	if err := json.Unmarshal(out, &geminiResp); err != nil || len(geminiResp.Candidates) == 0 {
		log.Printf("[Gemini] Failed to parse response: %v", err)
		return &http.Response{
			StatusCode: 200,
			Body:       io.NopCloser(bytes.NewReader(out)),
		}
	}

	c := geminiResp.Candidates[0]
	content := ""
	if len(c.Content.Parts) > 0 {
		content = c.Content.Parts[0].Text
	}

	finishReason := "stop"
	if c.FinishReason == "MAX_TOKENS" {
		finishReason = "length"
	} else if c.FinishReason == "SAFETY" {
		finishReason = "content_filter"
	}

	// Build OpenAI-compatible response
	openAIResp := map[string]interface{}{
		"id":      fmt.Sprintf("gemini-%d", time.Now().UnixNano()),
		"object":  "chat.completion",
		"created": time.Now().Unix(),
		"model":   model,
		"choices": []map[string]interface{}{
			{
				"index": 0,
				"message": map[string]interface{}{
					"role":    "assistant",
					"content": content,
				},
				"finish_reason": finishReason,
			},
		},
		"usage": map[string]interface{}{
			"prompt_tokens":     geminiResp.UsageMetadata.PromptTokenCount,
			"completion_tokens": geminiResp.UsageMetadata.CandidatesTokenCount,
			"total_tokens":      geminiResp.UsageMetadata.TotalTokenCount,
		},
	}

	openAIBytes, _ := json.Marshal(openAIResp)
	log.Printf("[Gemini] Success: %d prompt + %d completion = %d total tokens",
		geminiResp.UsageMetadata.PromptTokenCount,
		geminiResp.UsageMetadata.CandidatesTokenCount,
		geminiResp.UsageMetadata.TotalTokenCount)

	return &http.Response{
		StatusCode: 200,
		Body:       io.NopCloser(bytes.NewReader(openAIBytes)),
	}
}
