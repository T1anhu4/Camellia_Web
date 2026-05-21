package ratelimit

import (
	"testing"
)

func TestNewTokenBucket(t *testing.T) {
	lim := NewTokenBucket(nil)
	if lim == nil {
		t.Fatal("expected non-nil limiter")
	}
	if lim.rdb != nil {
		t.Error("expected nil rdb when passing nil")
	}
}

func TestRateLimitError_ImplementsError(t *testing.T) {
	e := &RateLimitError{
		Message:    "Rate limit exceeded",
		RetryAfter: 5,
		Type:       "rate_limit_error",
	}
	if e.Error() != "Rate limit exceeded" {
		t.Errorf("expected 'Rate limit exceeded', got %s", e.Error())
	}
}

func TestRateLimitError_Fields(t *testing.T) {
	e := &RateLimitError{
		Message:    "Too many requests",
		RetryAfter: 10,
		Type:       "concurrency_limit",
	}
	if e.Message != "Too many requests" {
		t.Error("Message mismatch")
	}
	if e.RetryAfter != 10 {
		t.Error("RetryAfter mismatch")
	}
	if e.Type != "concurrency_limit" {
		t.Error("Type mismatch")
	}
}

func TestRateLimitError_ZeroRetry(t *testing.T) {
	e := &RateLimitError{Message: "blocked", RetryAfter: 0, Type: "rate_limit_error"}
	if e.RetryAfter != 0 {
		t.Error("zero retry should be allowed")
	}
}
