package tokenizer

import (
	"encoding/json"
	"testing"
)

func TestTokenizer_New(t *testing.T) {
	tok := New()
	if tok == nil {
		t.Fatal("expected non-nil tokenizer")
	}
	if _, ok := tok.encodings["cl100k_base"]; !ok {
		t.Fatal("expected cl100k_base encoding registered")
	}
}

func TestTokenizer_CountTokens_Empty(t *testing.T) {
	tok := New()
	if n := tok.CountTokens("cl100k_base", ""); n != 0 {
		t.Errorf("expected 0 tokens for empty string, got %d", n)
	}
}

func TestTokenizer_CountTokens_ShortWord(t *testing.T) {
	tok := New()
	n := tok.CountTokens("cl100k_base", "hello")
	if n <= 0 {
		t.Errorf("expected >0 tokens for 'hello', got %d", n)
	}
}

func TestTokenizer_CountTokens_LongText(t *testing.T) {
	tok := New()
	text := "The quick brown fox jumps over the lazy dog. This is a longer piece of text that should be tokenized into multiple tokens by the simplified cl100k_base encoder."
	n := tok.CountTokens("cl100k_base", text)
	if n < 10 {
		t.Errorf("expected >=10 tokens for long text, got %d", n)
	}
}

func TestTokenizer_CountTokens_FallbackEncoding(t *testing.T) {
	tok := New()
	n := tok.CountTokens("unknown_encoding", "hello world testing")
	if n <= 0 {
		t.Errorf("expected >0 tokens with fallback, got %d", n)
	}
}

func TestTokenizer_CountMessagesTokens_BasicChat(t *testing.T) {
	tok := New()
	messages := []map[string]interface{}{
		{"role": "system", "content": "You are a helpful assistant."},
		{"role": "user", "content": "Hello, how are you?"},
	}
	n := tok.CountMessagesTokens("cl100k_base", messages)
	if n < 5 {
		t.Errorf("expected >=5 tokens for basic chat messages, got %d", n)
	}
}

func TestTokenizer_CountMessagesTokens_IncludesOverhead(t *testing.T) {
	tok := New()
	emptyMsg := []map[string]interface{}{
		{"role": "user", "content": ""},
	}
	n := tok.CountMessagesTokens("cl100k_base", emptyMsg)
	// Should have at least per-message overhead (3) + role tokens + primer (3)
	if n < 4 {
		t.Errorf("expected >=4 tokens for empty message (overhead), got %d", n)
	}
}

func TestTokenizer_CountMessagesTokens_MultiModal(t *testing.T) {
	tok := New()
	messages := []map[string]interface{}{
		{
			"role": "user",
			"content": []interface{}{
				map[string]interface{}{"type": "text", "text": "Describe this image"},
				map[string]interface{}{"type": "image_url", "image_url": map[string]interface{}{"url": "https://example.com/img.jpg"}},
			},
		},
	}
	n := tok.CountMessagesTokens("cl100k_base", messages)
	if n < 50 {
		t.Errorf("expected >=50 tokens for multi-modal message (includes 85 image base), got %d", n)
	}
}

func TestTokenizer_CountMessagesTokens_HighResImage(t *testing.T) {
	tok := New()
	messages := []map[string]interface{}{
		{
			"role": "user",
			"content": []interface{}{
				map[string]interface{}{"type": "image_url", "image_url": map[string]interface{}{"url": "https://example.com/img.jpg", "detail": "high"}},
			},
		},
	}
	lowRes := tok.CountMessagesTokens("cl100k_base", messages)
	// high detail adds 170 extra tokens
	if lowRes < 200 {
		t.Errorf("expected >=200 tokens for high-res image, got %d", lowRes)
	}
}

func TestTokenizer_CountRequestTokens_ChatCompletion(t *testing.T) {
	tok := New()
	body := map[string]interface{}{
		"model": "gpt-4o",
		"messages": []interface{}{
			map[string]interface{}{"role": "user", "content": "Hello"},
		},
		"max_tokens": float64(100),
	}
	count, encoding := tok.CountRequestTokens(body)
	if count < 3 {
		t.Errorf("expected >=3 tokens for chat completion, got %d", count)
	}
	if encoding != "cl100k_base" {
		t.Errorf("expected cl100k_base encoding, got %s", encoding)
	}
}

func TestTokenizer_CountRequestTokens_EmbeddingInput_String(t *testing.T) {
	tok := New()
	body := map[string]interface{}{
		"model": "text-embedding-3-small",
		"input": "Hello world",
	}
	count, _ := tok.CountRequestTokens(body)
	if count <= 0 {
		t.Errorf("expected >0 tokens for string input, got %d", count)
	}
}

func TestTokenizer_CountRequestTokens_EmbeddingInput_Array(t *testing.T) {
	tok := New()
	body := map[string]interface{}{
		"model": "text-embedding-3-small",
		"input": []interface{}{"first text", "second text", "third text"},
	}
	count, _ := tok.CountRequestTokens(body)
	if count <= 0 {
		t.Errorf("expected >0 tokens for array input, got %d", count)
	}
}

func TestTokenizer_CountRequestTokens_UnknownModel(t *testing.T) {
	tok := New()
	body := map[string]interface{}{
		"model": "custom-model-xyz",
		"messages": []interface{}{
			map[string]interface{}{"role": "user", "content": "test"},
		},
	}
	count, encoding := tok.CountRequestTokens(body)
	if count <= 0 {
		t.Errorf("expected >0 tokens for unknown model, got %d", count)
	}
	if encoding != "cl100k_base" {
		t.Errorf("expected cl100k_base fallback encoding, got %s", encoding)
	}
}

func TestTokenizer_CountRequestTokens_NoMessagesNoInput(t *testing.T) {
	tok := New()
	body := map[string]interface{}{
		"model": "gpt-4o",
	}
	count, _ := tok.CountRequestTokens(body)
	if count != 0 {
		t.Errorf("expected 0 tokens for empty body, got %d", count)
	}
}

func TestParseResponseUsage_Valid(t *testing.T) {
	resp := map[string]interface{}{
		"usage": map[string]interface{}{
			"prompt_tokens":     150,
			"completion_tokens": 80,
			"total_tokens":      230,
		},
	}
	body, _ := json.Marshal(resp)
	prompt, completion := ParseResponseUsage(body)
	if prompt != 150 {
		t.Errorf("expected prompt_tokens=150, got %d", prompt)
	}
	if completion != 80 {
		t.Errorf("expected completion_tokens=80, got %d", completion)
	}
}

func TestParseResponseUsage_InvalidJSON(t *testing.T) {
	prompt, completion := ParseResponseUsage([]byte("not json"))
	if prompt != 0 || completion != 0 {
		t.Error("expected 0,0 for invalid JSON")
	}
}

func TestParseResponseUsage_NoUsage(t *testing.T) {
	body := []byte(`{"id":"chatcmpl-123","choices":[{"message":{"content":"Hi"}}]}`)
	prompt, completion := ParseResponseUsage(body)
	if prompt != 0 || completion != 0 {
		t.Error("expected 0,0 when no usage field")
	}
}

func TestModelToEncoding_KnownModels(t *testing.T) {
	tests := []struct{ model string }{
		{"gpt-4o"},
		{"gpt-4o-mini"},
		{"gpt-4-turbo"},
		{"gpt-4"},
		{"gpt-3.5-turbo"},
		{"text-embedding-3-small"},
		{"text-embedding-ada-002"},
		{"claude-4-haiku"},
		{"claude-4-opus"},
		{"deepseek-v4-pro"},
		{"deepseek-v4-flash"},
	}
	for _, tt := range tests {
		enc := modelToEncoding(tt.model)
		if enc != "cl100k_base" {
			t.Errorf("model %q → encoding %q, want cl100k_base", tt.model, enc)
		}
	}
}

func TestCl100kBase_Encode_Empty(t *testing.T) {
	c := newCl100kBase()
	_, count := c.Encode("")
	if count != 0 {
		t.Errorf("expected 0 tokens for empty, got %d", count)
	}
}

func TestCl100kBase_Encode_SingleWord(t *testing.T) {
	c := newCl100kBase()
	_, count := c.Encode("hello")
	// 5-char word → chars <= 8 rule → 2 tokens
	if count < 1 || count > 3 {
		t.Errorf("expected 1-3 tokens for 'hello', got %d", count)
	}
}

func TestCl100kBase_Encode_Punctuation(t *testing.T) {
	c := newCl100kBase()
	_, count := c.Encode("Hello, world!")
	// "hello" (1) + comma (1) + "world" (1) + bang (1) = ~4
	if count < 2 || count > 8 {
		t.Errorf("expected 2-8 tokens for 'Hello, world!', got %d", count)
	}
}

func TestCl100kBase_Encode_LongWord(t *testing.T) {
	c := newCl100kBase()
	_, count := c.Encode("antidisestablishmentarianism")
	if count <= 1 {
		t.Errorf("expected >1 tokens for long word, got %d", count)
	}
}

func TestCl100kBase_Encode_CJK(t *testing.T) {
	c := newCl100kBase()
	_, count := c.Encode("你好世界")
	if count < 2 {
		t.Errorf("expected >=2 tokens for CJK text, got %d", count)
	}
}

func TestCl100kBase_Encode_MixedCJK(t *testing.T) {
	c := newCl100kBase()
	_, count := c.Encode("你好 world！这是一个测试")
	if count < 4 {
		t.Errorf("expected >=4 tokens for mixed CJK, got %d", count)
	}
}

func TestCl100kBase_Encode_Newlines(t *testing.T) {
	c := newCl100kBase()
	_, count := c.Encode("line one\nline two\n\nline three")
	if count < 4 {
		t.Errorf("expected >=4 tokens for multi-line text, got %d", count)
	}
}

func TestFallbackCount_English(t *testing.T) {
	n := fallbackCount("hello world")
	if n <= 0 {
		t.Errorf("expected >0 for fallback, got %d", n)
	}
}

func TestFallbackCount_CJK(t *testing.T) {
	n := fallbackCount("你好世界")
	if n <= 0 {
		t.Errorf("expected >0 for CJK fallback, got %d", n)
	}
}

func TestFallbackCount_Empty(t *testing.T) {
	n := fallbackCount("")
	if n != 1 {
		t.Errorf("expected 1 for empty fallback (min 1), got %d", n)
	}
}

func TestCl100kBase_SpecialTokens(t *testing.T) {
	c := newCl100kBase()
	if c.vocabSize != 100277 {
		t.Errorf("expected vocabSize=100277, got %d", c.vocabSize)
	}
	if _, ok := c.specialTokens["<|endoftext|>"]; !ok {
		t.Error("expected <|endoftext|> special token")
	}
}
