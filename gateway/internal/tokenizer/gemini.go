package tokenizer

import "encoding/json"

// GeminiUsageMetadata extracts cached_content_token_count from Gemini's usage_metadata.
type GeminiUsageMeta struct {
	CachedContentTokenCount int `json:"cached_content_token_count"`
	TotalTokenCount         int `json:"total_token_count"`
	PromptTokenCount        int `json:"prompt_token_count"`
}

type GeminiUsage struct {
	UsageMetadata *GeminiUsageMeta `json:"usage_metadata"`
}

// ParseGeminiCachedTokens extracts cached_content_token_count from a Gemini response body.
// Returns 0 if the response doesn't contain usage_metadata.
func ParseGeminiCachedTokens(body []byte) (cachedTokens int, promptTokens int, completionTokens int) {
	var resp struct {
		UsageMetadata struct {
			CachedContentTokenCount int `json:"cached_content_token_count"`
			PromptTokenCount        int `json:"prompt_token_count"`
			CandidatesTokenCount    int `json:"candidates_token_count"`
			TotalTokenCount         int `json:"total_token_count"`
		} `json:"usage_metadata"`
	}
	if err := json.Unmarshal(body, &resp); err != nil || resp.UsageMetadata.TotalTokenCount == 0 {
		return 0, 0, 0
	}
	m := resp.UsageMetadata
	return m.CachedContentTokenCount, m.PromptTokenCount, m.CandidatesTokenCount
}

// ConvertOpenAIToGemini converts an OpenAI-format request body to Google Gemini native format.
// Returns the Gemini-format JSON bytes or nil if conversion fails.
func ConvertOpenAIToGemini(openAIBody []byte, model string) ([]byte, error) {
	var req struct {
		Messages []struct {
			Role    string `json:"role"`
			Content any    `json:"content"`
		} `json:"messages"`
		Stream      bool    `json:"stream"`
		MaxTokens   int     `json:"max_tokens"`
		Temperature float64 `json:"temperature"`
	}
	if err := json.Unmarshal(openAIBody, &req); err != nil {
		return nil, err
	}

	contents := make([]map[string]any, 0, len(req.Messages))
	for _, msg := range req.Messages {
		role := "user"
		if msg.Role == "system" {
			role = "user"
		} else if msg.Role == "assistant" {
			role = "model"
		} else {
			role = "user"
		}

		var parts []map[string]any
		switch v := msg.Content.(type) {
		case string:
			parts = []map[string]any{{"text": v}}
		case []any:
			for _, p := range v {
				if pm, ok := p.(map[string]any); ok {
					parts = append(parts, pm)
				}
			}
		default:
			parts = []map[string]any{{"text": ""}}
		}
		contents = append(contents, map[string]any{
			"role":  role,
			"parts": parts,
		})
	}

	geminiReq := map[string]any{
		"contents": contents,
	}
	if req.Stream {
		geminiReq["generationConfig"] = map[string]any{
			"temperature": req.Temperature,
		}
	}
	if req.MaxTokens > 0 {
		if req.MaxTokens < 500 { req.MaxTokens = 500 }
		if gc, ok := geminiReq["generationConfig"].(map[string]any); ok {
			gc["maxOutputTokens"] = req.MaxTokens
		} else {
			geminiReq["generationConfig"] = map[string]any{"maxOutputTokens": req.MaxTokens}
		}
	}

	return json.Marshal(geminiReq)
}

// ConvertGeminiSSEToOpenAI converts a Gemini SSE line to OpenAI SSE format.
// Returns the OpenAI-format SSE line, or empty string if this line should be skipped.
func ConvertGeminiSSEToOpenAI(geminiLine string, model string) string {
	if geminiLine == "" || geminiLine == "data: [DONE]" {
		return geminiLine
	}
	if geminiLine == "data: " {
		return ""
	}

	var geminiChunk struct {
		Candidates []struct {
			Content struct {
				Role  string `json:"role"`
				Parts []struct {
					Text string `json:"text"`
				} `json:"parts"`
			} `json:"content"`
			FinishReason string `json:"finishReason"`
		} `json:"candidates"`
		UsageMetadata *GeminiUsageMeta `json:"usage_metadata"`
	}

	data := geminiLine
	if len(data) > 6 && data[:6] == "data: " {
		data = data[6:]
	}

	if err := json.Unmarshal([]byte(data), &geminiChunk); err != nil {
		return geminiLine
	}

	// Build OpenAI-format chunk
	openAI := map[string]any{
		"object": "chat.completion.chunk",
		"model":  model,
	}

	if len(geminiChunk.Candidates) > 0 {
		c := geminiChunk.Candidates[0]
		var text string
		if len(c.Content.Parts) > 0 {
			text = c.Content.Parts[0].Text
		}

		delta := map[string]any{}
		if text != "" {
			delta["content"] = text
		}

		finishReason := ""
		switch c.FinishReason {
		case "STOP":
			finishReason = "stop"
		case "MAX_TOKENS":
			finishReason = "length"
		case "SAFETY":
			finishReason = "content_filter"
		}
		if finishReason != "" {
			delta["finish_reason"] = finishReason
		}

		openAI["choices"] = []map[string]any{{
			"index": 0,
			"delta": delta,
		}}
	}

	if geminiChunk.UsageMetadata != nil {
		openAI["usage"] = map[string]any{
			"prompt_tokens":            geminiChunk.UsageMetadata.PromptTokenCount,
			"completion_tokens":        geminiChunk.UsageMetadata.TotalTokenCount,
			"total_tokens":             geminiChunk.UsageMetadata.TotalTokenCount,
			"cached_content_token_count": geminiChunk.UsageMetadata.CachedContentTokenCount,
		}
	}

	result, _ := json.Marshal(openAI)
	return "data: " + string(result) + "\n"
}
