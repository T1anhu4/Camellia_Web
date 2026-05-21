package pool

import (
	"sync"
	"testing"
	"time"
)

func TestCircuitBreaker_InitialState(t *testing.T) {
	cb := NewCircuitBreaker()
	if cb.State() != CircuitClosed {
		t.Fatalf("expected closed state, got %v", cb.State())
	}
	if !cb.Allow() {
		t.Fatal("expected Allow()=true in closed state")
	}
}

func TestCircuitBreaker_ClosedStaysClosedOnSuccess(t *testing.T) {
	cb := NewCircuitBreaker()
	for i := 0; i < 10; i++ {
		cb.RecordSuccess()
	}
	if cb.State() != CircuitClosed {
		t.Fatalf("expected closed after successes, got %v", cb.State())
	}
}

func TestCircuitBreaker_OpensAfterConsecutiveFailures(t *testing.T) {
	cb := NewCircuitBreaker()
	for i := 0; i < 5; i++ {
		cb.RecordFailure(500)
	}
	if cb.State() != CircuitOpen {
		t.Fatalf("expected open after 5 consecutive 5xx failures, got %v", cb.State())
	}
	if cb.Allow() {
		t.Fatal("expected Allow()=false in open state (before cooldown)")
	}
}

func TestCircuitBreaker_ResetsFailureCountOnSuccess(t *testing.T) {
	cb := NewCircuitBreaker()
	cb.RecordFailure(500)
	cb.RecordFailure(500)
	cb.RecordFailure(500)
	cb.RecordFailure(500) // 4 failures, still closed
	if cb.State() != CircuitClosed {
		t.Fatalf("expected closed after 4 failures, got %v", cb.State())
	}
	cb.RecordSuccess() // resets consecutive failures
	cb.RecordFailure(500)
	cb.RecordFailure(500)
	cb.RecordFailure(500)
	cb.RecordFailure(500) // 4 more, still closed because success reset
	if cb.State() != CircuitClosed {
		t.Fatalf("expected closed after reset+4 failures, got %v", cb.State())
	}
}

func TestCircuitBreaker_HalfOpenToClosedOnSuccess(t *testing.T) {
	cb := NewCircuitBreaker()
	// Force open with short cooldown
	cb.failureThreshold = 1
	cb.cooldown = 10 * time.Millisecond
	cb.successThreshold = 2

	cb.RecordFailure(500)
	if cb.State() != CircuitOpen {
		t.Fatal("expected open")
	}

	time.Sleep(20 * time.Millisecond) // wait for cooldown

	// First probe: half-open allows requests
	if !cb.Allow() {
		t.Fatal("expected Allow()=true in half-open (first probe)")
	}
	cb.RecordSuccess()

	// Second probe: still half-open
	if !cb.Allow() {
		t.Fatal("expected Allow()=true in half-open (second probe)")
	}
	cb.RecordSuccess()

	// Now should be closed
	if cb.State() != CircuitClosed {
		t.Fatalf("expected closed after 2 half-open successes, got %v", cb.State())
	}
}

func TestCircuitBreaker_HalfOpenFailureReopens(t *testing.T) {
	cb := NewCircuitBreaker()
	cb.failureThreshold = 1
	cb.cooldown = 10 * time.Millisecond
	cb.successThreshold = 2

	cb.RecordFailure(500)
	time.Sleep(20 * time.Millisecond)

	// Enter half-open
	if !cb.Allow() {
		t.Fatal("expected Allow()=true in half-open")
	}
	cb.RecordFailure(500) // probe fails

	if cb.State() != CircuitOpen {
		t.Fatalf("expected open after half-open probe failure, got %v", cb.State())
	}
}

func TestCircuitBreaker_ExponentialBackoffCooldown(t *testing.T) {
	cb := NewCircuitBreaker()
	cb.failureThreshold = 1

	initialCooldown := cb.cooldown

	// First open
	cb.RecordFailure(500)
	if cb.cooldown != 2*initialCooldown {
		t.Errorf("expected cooldown doubled to %v, got %v", 2*initialCooldown, cb.cooldown)
	}

	// Force closed then open again
	cb.Reset()
	cb.RecordFailure(500)
	if cb.cooldown != 2*initialCooldown {
		t.Errorf("expected cooldown at %v, got %v", 2*initialCooldown, cb.cooldown)
	}

	// Verify cap at 5 minutes
	cb.cooldown = 4*time.Minute + 30*time.Second
	cb.Reset()
	cb.RecordFailure(500)
	if cb.cooldown > 5*time.Minute {
		t.Errorf("expected cooldown capped at 5min, got %v", cb.cooldown)
	}
}

func TestCircuitBreaker_AuthFailuresOpenInstantly(t *testing.T) {
	cb := NewCircuitBreaker()
	cb.RecordFailure(401)
	if cb.State() != CircuitOpen {
		t.Fatalf("expected open on 401, got %v", cb.State())
	}
	if cb.cooldown != 5*time.Minute {
		t.Errorf("expected 5min cooldown for 401, got %v", cb.cooldown)
	}
}

func TestCircuitBreaker_Auth403OpensInstantly(t *testing.T) {
	cb := NewCircuitBreaker()
	cb.RecordFailure(403)
	if cb.State() != CircuitOpen {
		t.Fatalf("expected open on 403, got %v", cb.State())
	}
}

func TestCircuitBreaker_RateLimitHasShortCooldown(t *testing.T) {
	cb := NewCircuitBreaker()
	cb.RecordFailure(429)
	if cb.State() != CircuitOpen {
		t.Fatalf("expected open on 429, got %v", cb.State())
	}
	if cb.cooldown != cb.rateLimitCooldown {
		t.Errorf("expected rate limit cooldown %v, got %v", cb.rateLimitCooldown, cb.cooldown)
	}
}

func TestCircuitBreaker_HalfOpenLimitsProbes(t *testing.T) {
	cb := NewCircuitBreaker()
	cb.failureThreshold = 1
	cb.cooldown = 10 * time.Millisecond
	cb.halfOpenMaxReqs = 2

	cb.RecordFailure(500)
	time.Sleep(20 * time.Millisecond)

	// Probe 1: Open→HalfOpen transition (free probe, doesn't count against limit)
	if !cb.Allow() {
		t.Fatal("probe 1 (transition) should be allowed")
	}
	// Probe 2: halfOpenReqs goes 0→1, still under limit
	if !cb.Allow() {
		t.Fatal("probe 2 should be allowed")
	}
	// Probe 3: halfOpenReqs goes 1→2, last allowed
	if !cb.Allow() {
		t.Fatal("probe 3 should be allowed (2 <= 2)")
	}
	// Probe 4: halfOpenReqs=2, 2 < 2 = false
	if cb.Allow() {
		t.Fatal("probe 4 should be denied (exceeded max 2 probes)")
	}
}

func TestCircuitBreaker_ConcurrentSafety(t *testing.T) {
	cb := NewCircuitBreaker()
	cb.failureThreshold = 3

	var wg sync.WaitGroup
	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			cb.Allow()
			cb.RecordSuccess()
			cb.RecordFailure(500)
			cb.State()
		}()
	}
	wg.Wait()
	// No race conditions = pass
}

func TestCircuitBreaker_Reset(t *testing.T) {
	cb := NewCircuitBreaker()
	cb.RecordFailure(500)
	cb.RecordFailure(500)
	cb.RecordFailure(500)
	cb.RecordFailure(500)
	cb.RecordFailure(500)
	if cb.State() != CircuitOpen {
		t.Fatal("expected open")
	}
	cb.Reset()
	if cb.State() != CircuitClosed {
		t.Fatalf("expected closed after reset, got %v", cb.State())
	}
}

func TestCircuitState_String(t *testing.T) {
	tests := []struct {
		state CircuitState
		want  string
	}{
		{CircuitClosed, "closed"},
		{CircuitOpen, "open"},
		{CircuitHalfOpen, "half-open"},
		{CircuitState(99), "unknown"},
	}
	for _, tt := range tests {
		if got := tt.state.String(); got != tt.want {
			t.Errorf("CircuitState(%d).String() = %q, want %q", tt.state, got, tt.want)
		}
	}
}

func TestCircuitBreaker_CooldownDoesNotExceedMax(t *testing.T) {
	cb := NewCircuitBreaker()
	cb.cooldown = 10 * time.Minute // already above max
	cb.failureThreshold = 1
	cb.RecordFailure(500)
	if cb.cooldown > 5*time.Minute {
		t.Errorf("cooldown %v exceeds max 5min", cb.cooldown)
	}
}
