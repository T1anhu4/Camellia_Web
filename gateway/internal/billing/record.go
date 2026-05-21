package billing

import (
	"context"
	"fmt"
	"log"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

// RecordUsageDetailed records billing with exact prompt/completion token breakdown.
func RecordUsageDetailed(pg *pgxpool.Pool, rdb *redis.Client,
	userID, apiKeyID, channelID, model, requestID string,
	promptTokens, completionTokens int) {

	totalTokens := promptTokens + completionTokens
	if totalTokens <= 0 {
		return
	}

	ctx := context.Background()

	var pricingID *string
	var sellInputPrice, sellOutputPrice float64
	var vipDiscount, enterpriseDiscount float64

	err := pg.QueryRow(ctx,
		`SELECT id, sell_input_price, sell_output_price, vip_discount, enterprise_discount
		 FROM model_pricing WHERE model_name = $1 AND is_active = true
		 ORDER BY updated_at DESC LIMIT 1`,
		model,
	).Scan(&pricingID, &sellInputPrice, &sellOutputPrice, &vipDiscount, &enterpriseDiscount)

	costCents := int64(0)
	if err == nil {
		inputCost := float64(promptTokens) / 1000.0 * sellInputPrice * 100
		outputCost := float64(completionTokens) / 1000.0 * sellOutputPrice * 100
		costCents = int64(inputCost + outputCost)
		if costCents < 1 {
			costCents = 1
		}
	}

	var balanceAfter int64
	err = pg.QueryRow(ctx,
		`UPDATE users
		 SET balance_cents = balance_cents - $1,
		     daily_token_used = daily_token_used + $2,
		     updated_at = NOW()
		 WHERE id = $3
		 RETURNING balance_cents`,
		costCents, totalTokens, userID,
	).Scan(&balanceAfter)

	if err != nil {
		log.Printf("Billing: deduction failed for user %s: %v", userID, err)
		return
	}

	_, err = pg.Exec(ctx,
		`INSERT INTO billing_records
		 (user_id, api_key_id, channel_id, model_name, request_id,
		  prompt_tokens, completion_tokens, total_tokens, cost_cents, balance_after, pricing_id, status)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'success')`,
		userID, apiKeyID, channelID, model, requestID,
		promptTokens, completionTokens, totalTokens, costCents, balanceAfter, pricingID,
	)

	if err != nil {
		log.Printf("Billing: insert failed: %v", err)
	}

	pipe := rdb.Pipeline()
	pipe.IncrBy(ctx, fmt.Sprintf("user:%s:daily_tokens", userID), int64(totalTokens))
	pipe.HSet(ctx, fmt.Sprintf("user:%s", userID), "balance_cents", balanceAfter)
	pipe.Exec(ctx)
}
