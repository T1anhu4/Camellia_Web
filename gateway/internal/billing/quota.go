package billing

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

// QuotaEnforcer checks and enforces daily token quotas for free-tier users.
type QuotaEnforcer struct {
	pg  *pgxpool.Pool
	rdb *redis.Client
}

func NewQuotaEnforcer(pg *pgxpool.Pool, rdb *redis.Client) *QuotaEnforcer {
	return &QuotaEnforcer{pg: pg, rdb: rdb}
}

// QuotaCheckResult represents the result of a quota check.
type QuotaCheckResult struct {
	Allowed        bool
	DailyLimit     int
	CurrentUsage   int
	Remaining      int
	ResetsAt       time.Time
}

// CheckDailyQuota checks if the user has remaining daily token quota.
// Returns nil error if allowed, or an error describing the limit.
func (qe *QuotaEnforcer) CheckDailyQuota(ctx context.Context, userID string) (*QuotaCheckResult, error) {
	result := &QuotaCheckResult{}

	// Try Redis first (fast path)
	key := fmt.Sprintf("user:%s:daily_tokens", userID)
	todayKey := fmt.Sprintf("quota:reset:%s:%s", userID, todayKey())

	currentUsage, err := qe.rdb.Get(ctx, key).Int64()
	if err != nil {
		currentUsage = 0
	}

	limit, err := qe.rdb.Get(ctx, todayKey).Int64()
	if err != nil {
		// Load from DB
		var dbLimit int
		var dbUsed int
		err := qe.pg.QueryRow(ctx,
			`SELECT daily_token_quota, daily_token_used FROM users WHERE id = $1`,
			userID,
		).Scan(&dbLimit, &dbUsed)
		if err != nil {
			return nil, fmt.Errorf("user not found")
		}
		limit = int64(dbLimit)
		currentUsage = int64(dbUsed)

		// Cache in Redis
		qe.rdb.Set(ctx, todayKey, limit, 24*time.Hour)
		qe.rdb.Set(ctx, key, currentUsage, 24*time.Hour)
	}

	now := time.Now()
	resetAt := time.Date(now.Year(), now.Month(), now.Day()+1, 0, 0, 0, 0, now.Location())

	result.DailyLimit = int(limit)
	result.CurrentUsage = int(currentUsage)
	result.Remaining = int(limit) - int(currentUsage)
	result.ResetsAt = resetAt

	if result.Remaining <= 0 {
		result.Allowed = false
		return result, fmt.Errorf("daily token quota exceeded (%d/%d). Resets at %s",
			result.CurrentUsage, result.DailyLimit, resetAt.Format("15:04 UTC"))
	}

	result.Allowed = true
	return result, nil
}

// RecordUsage increments the daily usage counter in Redis.
func (qe *QuotaEnforcer) RecordUsage(ctx context.Context, userID string, tokens int) error {
	key := fmt.Sprintf("user:%s:daily_tokens", userID)
	return qe.rdb.IncrBy(ctx, key, int64(tokens)).Err()
}

// CheckBalance checks if the user has sufficient balance for a request.
// Returns nil if balance is sufficient or user is on a non-free subscription.
func (qe *QuotaEnforcer) CheckBalance(ctx context.Context, userID string, requiredCents int64) error {
	// Check subscription tier first — VIP/Enterprise can go negative
	var tier string
	var balance int64
	err := qe.pg.QueryRow(ctx,
		`SELECT subscription_tier::text, balance_cents FROM users WHERE id = $1`,
		userID,
	).Scan(&tier, &balance)
	if err != nil {
		return fmt.Errorf("user not found")
	}

	if tier != "free" {
		return nil // VIP/Enterprise: allow
	}

	if balance < requiredCents {
		return fmt.Errorf("insufficient balance: have %d¢, need %d¢", balance, requiredCents)
	}

	return nil
}

func todayKey() string {
	return time.Now().UTC().Format("2006-01-02")
}
