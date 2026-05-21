package pool

import (
	"sync"
	"time"
)

// CircuitState represents the state of a circuit breaker.
type CircuitState int

const (
	CircuitClosed   CircuitState = iota // normal operation
	CircuitOpen                          // failing, reject requests
	CircuitHalfOpen                      // testing if upstream recovered
)

func (s CircuitState) String() string {
	switch s {
	case CircuitClosed:
		return "closed"
	case CircuitOpen:
		return "open"
	case CircuitHalfOpen:
		return "half-open"
	default:
		return "unknown"
	}
}

// CircuitBreaker implements a 3-state circuit breaker pattern.
// Closed → (failures >= threshold) → Open → (cooldown elapsed) → HalfOpen → (success) → Closed
type CircuitBreaker struct {
	mu sync.Mutex

	// Config
	failureThreshold int           // consecutive failures to open
	successThreshold int           // consecutive successes in half-open to close
	cooldown         time.Duration // time in open state before half-open
	halfOpenMaxReqs  int           // max probe requests in half-open state

	// State
	state              CircuitState
	consecutiveFails   int
	consecutiveSuccess int
	lastFailureTime    time.Time
	openAt             time.Time
	halfOpenReqs       int

	// Per-error-type cooldown multipliers
	rateLimitCooldown time.Duration // custom cooldown for 429 responses
}

// NewCircuitBreaker creates a new circuit breaker with sensible defaults.
func NewCircuitBreaker() *CircuitBreaker {
	return &CircuitBreaker{
		failureThreshold: 5,
		successThreshold: 2,
		cooldown:         30 * time.Second,
		halfOpenMaxReqs:  2,
		rateLimitCooldown: 15 * time.Second,
		state:            CircuitClosed,
	}
}

// Allow returns true if a request may pass through the circuit breaker.
func (cb *CircuitBreaker) Allow() bool {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	now := time.Now()

	switch cb.state {
	case CircuitClosed:
		return true
	case CircuitOpen:
		if now.After(cb.openAt.Add(cb.cooldown)) {
			cb.state = CircuitHalfOpen
			cb.halfOpenReqs = 0
			cb.consecutiveSuccess = 0
			return true
		}
		return false
	case CircuitHalfOpen:
		if cb.halfOpenReqs < cb.halfOpenMaxReqs {
			cb.halfOpenReqs++
			return true
		}
		return false
	default:
		return false
	}
}

// RecordSuccess records a successful request through the circuit breaker.
func (cb *CircuitBreaker) RecordSuccess() {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	cb.consecutiveFails = 0

	switch cb.state {
	case CircuitHalfOpen:
		cb.consecutiveSuccess++
		if cb.consecutiveSuccess >= cb.successThreshold {
			cb.state = CircuitClosed
			cb.consecutiveSuccess = 0
			cb.halfOpenReqs = 0
		}
	case CircuitClosed:
		// nothing to do, we're healthy
	}
}

// RecordFailure records a failed request, potentially opening the circuit.
// statusCode is used to apply per-error-type cooldowns.
func (cb *CircuitBreaker) RecordFailure(statusCode int) {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	now := time.Now()
	cb.consecutiveFails++
	cb.lastFailureTime = now

	// 401/403: instant and permanent (auth failure means token is dead)
	if statusCode == 401 || statusCode == 403 {
		cb.state = CircuitOpen
		cb.openAt = now
		cb.cooldown = 5 * time.Minute // auth failures don't self-heal quickly
		return
	}

	// 429: shorter cooldown since it's rate-limiting, not a hard error
	if statusCode == 429 {
		cb.state = CircuitOpen
		cb.openAt = now
		cb.cooldown = cb.rateLimitCooldown
		return
	}

	// 5xx or other errors: threshold-based
	if cb.consecutiveFails >= cb.failureThreshold {
		cb.state = CircuitOpen
		cb.openAt = now
		// Exponential backoff for repeated open circuits
		cb.cooldown = cb.cooldown * 2
		if cb.cooldown > 5*time.Minute {
			cb.cooldown = 5 * time.Minute
		}
	}
}

// State returns the current circuit breaker state.
func (cb *CircuitBreaker) State() CircuitState {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	return cb.state
}

// Reset forces the circuit breaker back to closed state.
func (cb *CircuitBreaker) Reset() {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	cb.state = CircuitClosed
	cb.consecutiveFails = 0
	cb.consecutiveSuccess = 0
	cb.halfOpenReqs = 0
	cb.cooldown = 30 * time.Second
}
