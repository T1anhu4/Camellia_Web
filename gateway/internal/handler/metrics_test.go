package handler

import (
	"testing"
)

func TestMetrics_IncRequests(t *testing.T) {
	m := &Metrics{}
	m.IncRequests()
	if m.TotalRequests != 1 {
		t.Errorf("expected 1, got %d", m.TotalRequests)
	}
}

func TestMetrics_IncSuccess(t *testing.T) {
	m := &Metrics{}
	m.IncSuccess()
	if m.SuccessfulRequests != 1 {
		t.Errorf("expected 1, got %d", m.SuccessfulRequests)
	}
}

func TestMetrics_IncFailed(t *testing.T) {
	m := &Metrics{}
	m.IncFailed()
	if m.FailedRequests != 1 {
		t.Errorf("expected 1, got %d", m.FailedRequests)
	}
}

func TestMetrics_IncRateLimited(t *testing.T) {
	m := &Metrics{}
	m.IncRateLimited()
	if m.RateLimitedRequests != 1 {
		t.Errorf("expected 1, got %d", m.RateLimitedRequests)
	}
}

func TestMetrics_AddTokens(t *testing.T) {
	m := &Metrics{}
	m.AddTokens(100)
	m.AddTokens(50)
	if m.TokensProcessed != 150 {
		t.Errorf("expected 150, got %d", m.TokensProcessed)
	}
}

func TestMetrics_IncBillingEvent(t *testing.T) {
	m := &Metrics{}
	m.IncBillingEvent()
	m.IncBillingEvent()
	if m.BillingEventsSent != 2 {
		t.Errorf("expected 2, got %d", m.BillingEventsSent)
	}
}

func TestMetrics_SSEStartEnd(t *testing.T) {
	m := &Metrics{}
	m.SSEStart()
	if m.SSEStreamsActive != 1 {
		t.Errorf("expected 1 active SSE stream, got %d", m.SSEStreamsActive)
	}
	m.SSEStart()
	if m.SSEStreamsActive != 2 {
		t.Errorf("expected 2 active SSE streams, got %d", m.SSEStreamsActive)
	}
	m.SSEEnd()
	if m.SSEStreamsActive != 1 {
		t.Errorf("expected 1 after one end, got %d", m.SSEStreamsActive)
	}
	m.SSEEnd()
	if m.SSEStreamsActive != 0 {
		t.Errorf("expected 0 after both end, got %d", m.SSEStreamsActive)
	}
}

func TestMetrics_AllCounters(t *testing.T) {
	m := &Metrics{}
	// Simulate a typical request flow
	m.IncRequests()  // 1
	m.IncRequests()  // 2
	m.IncSuccess()   // 1
	m.IncFailed()    // 1
	m.IncRateLimited() // 1
	m.AddTokens(200) // 200
	m.IncBillingEvent() // 1
	m.SSEStart()     // 1
	m.SSEEnd()       // 0

	if m.TotalRequests != 2 {
		t.Errorf("TotalRequests: expected 2, got %d", m.TotalRequests)
	}
	if m.SuccessfulRequests != 1 {
		t.Errorf("SuccessfulRequests: expected 1, got %d", m.SuccessfulRequests)
	}
	if m.FailedRequests != 1 {
		t.Errorf("FailedRequests: expected 1, got %d", m.FailedRequests)
	}
	if m.RateLimitedRequests != 1 {
		t.Errorf("RateLimitedRequests: expected 1, got %d", m.RateLimitedRequests)
	}
	if m.TokensProcessed != 200 {
		t.Errorf("TokensProcessed: expected 200, got %d", m.TokensProcessed)
	}
	if m.BillingEventsSent != 1 {
		t.Errorf("BillingEventsSent: expected 1, got %d", m.BillingEventsSent)
	}
	if m.SSEStreamsActive != 0 {
		t.Errorf("SSEStreamsActive: expected 0, got %d", m.SSEStreamsActive)
	}
}

func TestMetrics_ConcurrentSafety(t *testing.T) {
	m := &Metrics{}
	done := make(chan struct{})
	for i := 0; i < 100; i++ {
		go func() {
			m.IncRequests()
			m.IncSuccess()
			m.IncFailed()
			m.IncRateLimited()
			m.AddTokens(10)
			m.IncBillingEvent()
			done <- struct{}{}
		}()
	}
	for i := 0; i < 100; i++ {
		<-done
	}
	if m.TotalRequests != 100 {
		t.Errorf("concurrent TotalRequests: expected 100, got %d", m.TotalRequests)
	}
	if m.TokensProcessed != 1000 {
		t.Errorf("concurrent TokensProcessed: expected 1000, got %d", m.TokensProcessed)
	}
}

func TestGlobalMetrics(t *testing.T) {
	prev := GlobalMetrics.TotalRequests
	GlobalMetrics.IncRequests()
	if GlobalMetrics.TotalRequests != prev+1 {
		t.Error("GlobalMetrics should work")
	}
	// Clean up
	GlobalMetrics.TotalRequests--
}

func TestTierDefaults(t *testing.T) {
	if tierRPM("free") != defaultRPM {
		t.Errorf("free RPM should be %d, got %d", defaultRPM, tierRPM("free"))
	}
	if tierRPM("vip") != 120 {
		t.Errorf("vip RPM should be 120, got %d", tierRPM("vip"))
	}
	if tierRPM("enterprise") != 300 {
		t.Errorf("enterprise RPM should be 300, got %d", tierRPM("enterprise"))
	}

	if tierTPM("free") != defaultTPM {
		t.Errorf("free TPM should be %d, got %d", defaultTPM, tierTPM("free"))
	}
	if tierTPM("vip") != 1000000 {
		t.Errorf("vip TPM should be 1000000, got %d", tierTPM("vip"))
	}
	if tierTPM("enterprise") != 10000000 {
		t.Errorf("enterprise TPM should be 10000000, got %d", tierTPM("enterprise"))
	}

	if tierConcurrent("free") != defaultConcurrent {
		t.Errorf("free concurrent should be %d, got %d", defaultConcurrent, tierConcurrent("free"))
	}
	if tierConcurrent("vip") != 10 {
		t.Errorf("vip concurrent should be 10, got %d", tierConcurrent("vip"))
	}
	if tierConcurrent("enterprise") != 20 {
		t.Errorf("enterprise concurrent should be 20, got %d", tierConcurrent("enterprise"))
	}
}

func TestMax(t *testing.T) {
	if max(5, 3) != 5 {
		t.Error("max(5,3) should be 5")
	}
	if max(3, 5) != 5 {
		t.Error("max(3,5) should be 5")
	}
	if max(0, 0) != 0 {
		t.Error("max(0,0) should be 0")
	}
	if max(-1, 0) != 0 {
		t.Error("max(-1,0) should be 0")
	}
}
