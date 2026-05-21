package billing

import (
	"testing"
)

func TestNewQuotaEnforcer(t *testing.T) {
	qe := NewQuotaEnforcer(nil, nil)
	if qe == nil {
		t.Fatal("expected non-nil QuotaEnforcer")
	}
}

func TestQuotaCheckResult_Defaults(t *testing.T) {
	result := &QuotaCheckResult{}
	if result.Allowed {
		t.Error("expected Allowed=false by default")
	}
	if result.DailyLimit != 0 {
		t.Error("expected DailyLimit=0 by default")
	}
}

func TestQuotaCheckResult_Allowed(t *testing.T) {
	result := &QuotaCheckResult{
		Allowed:      true,
		DailyLimit:   10000,
		CurrentUsage: 5000,
		Remaining:    5000,
	}
	if !result.Allowed {
		t.Error("expected Allowed=true")
	}
	if result.Remaining != 5000 {
		t.Errorf("expected Remaining=5000, got %d", result.Remaining)
	}
}

func TestQuotaCheckResult_Exceeded(t *testing.T) {
	result := &QuotaCheckResult{
		Allowed:      false,
		DailyLimit:   10000,
		CurrentUsage: 10000,
		Remaining:    0,
	}
	if result.Allowed {
		t.Error("expected Allowed=false")
	}
	if result.Remaining != 0 {
		t.Errorf("expected Remaining=0, got %d", result.Remaining)
	}
}

func TestTodayKey(t *testing.T) {
	key := todayKey()
	if len(key) != 10 {
		t.Errorf("expected YYYY-MM-DD format (10 chars), got %d: %s", len(key), key)
	}
}

func TestBillingTask_Fields(t *testing.T) {
	task := BillingTask{
		UserID:           "user-1",
		APIKeyID:         "key-1",
		ChannelID:        "ch-1",
		Model:            "gpt-4o",
		RequestID:        "req-1",
		Endpoint:         "chat/completions",
		PromptTokens:     100,
		CompletionTokens: 50,
	}
	if task.PromptTokens+task.CompletionTokens != 150 {
		t.Error("token sum mismatch")
	}
	if task.Endpoint != "chat/completions" {
		t.Error("endpoint mismatch")
	}
}

func TestWorkerPool_NilPricingID(t *testing.T) {
	if nilPricingID("") != nil {
		t.Error("empty string should return nil")
	}
	if nilPricingID("123") != "123" {
		t.Error("non-empty should return same value")
	}
}

func TestKeyUserDailyTokens(t *testing.T) {
	key := keyUserDailyTokens("user-abc-123")
	if key != "user:user-abc-123:daily_tokens" {
		t.Errorf("unexpected daily tokens key: %s", key)
	}
}
