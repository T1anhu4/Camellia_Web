package ratelimit

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

// Limiter implements multi-tier rate limiting backed by Redis.
type Limiter struct {
	rdb *redis.Client
}

func NewTokenBucket(rdb *redis.Client) *Limiter {
	return &Limiter{rdb: rdb}
}

// ============================================================
// Sliding Window: Requests Per Minute / Tokens Per Minute
// ============================================================

// AllowSlidingWindow checks if a request is allowed under a sliding window limit.
// Uses a Redis sorted set with Lua for atomicity.
func (l *Limiter) AllowSlidingWindow(ctx context.Context, key string, limit int, window time.Duration) error {
	now := time.Now().UnixMilli()
	windowStart := now - window.Milliseconds()

	script := `
		local key = KEYS[1]
		local limit = tonumber(ARGV[1])
		local window_start = tonumber(ARGV[2])
		local now = tonumber(ARGV[3])

		redis.call('ZREMRANGEBYSCORE', key, 0, window_start)
		local current = redis.call('ZCARD', key)

		if current < limit then
			local member = now .. '-' .. math.random(1000000)
			redis.call('ZADD', key, now, member)
			redis.call('EXPIRE', key, math.ceil(ARGV[4] / 1000) + 1)
			return {1, current + 1}
		else
			local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
			local retry = 1
			if #oldest > 0 then
				retry = math.max(1, math.ceil((tonumber(oldest[2]) + ARGV[4] + 1 - now) / 1000))
			end
			return {0, retry}
		end
	`

	result, err := l.rdb.Eval(ctx, script, []string{key},
		limit, windowStart, now, window.Milliseconds()).Result()
	if err != nil {
		return nil // Redis error: allow pass-through
	}

	parts := result.([]interface{})
	if parts[0].(int64) == 1 {
		return nil
	}

	retryAfter := int64(1)
	if v, ok := parts[1].(int64); ok {
		retryAfter = v
	}

	return &RateLimitError{
		Message:    "Rate limit exceeded",
		RetryAfter: retryAfter,
		Type:       "rate_limit_error",
	}
}

// ============================================================
// Token Bucket: Burst-friendly rate limiting
// ============================================================

// AllowTokenBucket implements a token bucket algorithm.
// refillRate: tokens per second, burst: max bucket capacity.
func (l *Limiter) AllowTokenBucket(ctx context.Context, key string, refillRate float64, burst int) error {
	now := time.Now().UnixMilli()

	script := `
		local key = KEYS[1]
		local refill_rate = tonumber(ARGV[1])   -- tokens per millisecond
		local burst = tonumber(ARGV[2])
		local now = tonumber(ARGV[3])

		-- Read bucket state
		local tokens = redis.call('HGET', key, 'tokens')
		local last = redis.call('HGET', key, 'last_refill')

		if not tokens then
			tokens = burst
			last = now
		else
			tokens = tonumber(tokens)
			last = tonumber(last)
		end

		-- Refill
		local elapsed = math.max(0, now - last)
		tokens = math.min(burst, tokens + elapsed * refill_rate)
		last = now

		if tokens >= 1 then
			tokens = tokens - 1
			redis.call('HMSET', key, 'tokens', tokens, 'last_refill', last)
			redis.call('EXPIRE', key, math.ceil(burst / refill_rate / 1000) + 10)
			return {1, tokens}
		else
			local wait_ms = math.ceil((1 - tokens) / refill_rate)
			redis.call('HMSET', key, 'tokens', tokens, 'last_refill', last)
			redis.call('EXPIRE', key, math.ceil(burst / refill_rate / 1000) + 10)
			return {0, math.max(1, math.ceil(wait_ms / 1000))}
		end
	`

	result, err := l.rdb.Eval(ctx, script, []string{key}, refillRate/1000, burst, now).Result()
	if err != nil {
		return nil
	}

	parts := result.([]interface{})
	if parts[0].(int64) == 1 {
		return nil
	}

	retryAfter := int64(1)
	if v, ok := parts[1].(int64); ok {
		retryAfter = v
	}
	return &RateLimitError{
		Message:    "Rate limit exceeded",
		RetryAfter: retryAfter,
		Type:       "rate_limit_error",
	}
}

// ============================================================
// Concurrency Limiter
// ============================================================

// AcquireConcurrency atomically acquires a concurrency slot.
func (l *Limiter) AcquireConcurrency(ctx context.Context, key string, maxConcurrent int) error {
	script := `
		local key = KEYS[1]
		local limit = tonumber(ARGV[1])

		local current = redis.call('INCR', key)
		redis.call('EXPIRE', key, 120)

		if current <= limit then
			return {1, current}
		else
			redis.call('DECR', key)
			return {0, current - 1}
		end
	`

	result, err := l.rdb.Eval(ctx, script, []string{key}, maxConcurrent).Result()
	if err != nil {
		return nil // Redis error: allow
	}

	parts := result.([]interface{})
	if parts[0].(int64) == 1 {
		return nil
	}

	return &RateLimitError{
		Message:    fmt.Sprintf("Too many concurrent requests. Limit: %d", maxConcurrent),
		RetryAfter: 2,
		Type:       "concurrency_limit",
	}
}

// ReleaseConcurrency releases a concurrency slot.
func (l *Limiter) ReleaseConcurrency(ctx context.Context, key string) {
	l.rdb.Decr(ctx, key)
}

// ============================================================
// Token Per Minute (post-request tracking)
// ============================================================

// RecordTPM atomically increments the TPM counter and returns whether limit exceeded.
// This should be called BEFORE making the upstream request (pre-check).
func (l *Limiter) CheckTPM(ctx context.Context, key string, estimatedTokens int, limit int) error {
	if limit <= 0 {
		return nil
	}

	pipe := l.rdb.Pipeline()
	incr := pipe.IncrBy(ctx, key, int64(estimatedTokens))
	pipe.Expire(ctx, key, time.Minute)
	_, err := pipe.Exec(ctx)
	if err != nil {
		return nil
	}

	if incr.Val() > int64(limit) {
		return &RateLimitError{
			Message:    fmt.Sprintf("Token limit exceeded. Current: %d/%d tokens.", incr.Val(), limit),
			RetryAfter: 10,
			Type:       "tpm_limit",
		}
	}
	return nil
}

// ============================================================
// Convenience methods
// ============================================================

// AllowRPM checks requests-per-minute using a sliding window.
func (l *Limiter) AllowRPM(ctx context.Context, userID string, limit int) error {
	return l.AllowSlidingWindow(ctx,
		fmt.Sprintf("ratelimit:rpm:%s", userID), limit, time.Minute)
}

// AllowIP checks requests-per-minute per IP address.
func (l *Limiter) AllowIP(ctx context.Context, ip string, limit int) error {
	return l.AllowSlidingWindow(ctx,
		fmt.Sprintf("ratelimit:ip:%s", ip), limit, time.Minute)
}

// CheckUserConcurrency acquires a user-level concurrency slot.
func (l *Limiter) CheckUserConcurrency(ctx context.Context, userID string, limit int) error {
	return l.AcquireConcurrency(ctx,
		fmt.Sprintf("ratelimit:concurrent:%s", userID), limit)
}

// ReleaseUserConcurrency releases a user-level concurrency slot.
func (l *Limiter) ReleaseUserConcurrency(ctx context.Context, userID string) {
	l.ReleaseConcurrency(ctx, fmt.Sprintf("ratelimit:concurrent:%s", userID))
}

// ============================================================
// Error type
// ============================================================

type RateLimitError struct {
	Message    string
	RetryAfter int64
	Type       string
}

func (e *RateLimitError) Error() string {
	return e.Message
}
