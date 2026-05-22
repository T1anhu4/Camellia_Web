package billing

import (
	"context"
	"fmt"
	"log"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

func RecordUsageDetailed(pg *pgxpool.Pool, rdb *redis.Client,
	userID, apiKeyID, channelID, model, requestID string,
	promptTokens, completionTokens int) {

	totalTokens := promptTokens + completionTokens
	if totalTokens <= 0 {
		return
	}

	ctx := context.Background()

	var pricingID *string
	costCents := int64(0)

	// Try model_pools pricing (RMB: per-token or per-call)
	var poolIn, poolOut, perCallCents int
	var poolMode string
	err := pg.QueryRow(ctx,
		"SELECT input_price_cents, output_price_cents, per_call_price_cents, pricing_mode FROM model_pools WHERE name = $1 AND is_active = true LIMIT 1",
		model,
	).Scan(&poolIn, &poolOut, &perCallCents, &poolMode)

	if err == nil {
		if poolMode == "per_call" && perCallCents > 0 {
			costCents = int64(perCallCents) * 1_000_000
		} else if poolIn > 0 || poolOut > 0 {
			costCents = int64(promptTokens)*int64(poolIn) + int64(completionTokens)*int64(poolOut)
		}
	} else {
		var inPrice, outPrice float64
		err := pg.QueryRow(ctx,
			"SELECT id, sell_input_price, sell_output_price FROM model_pricing WHERE model_name = $1 AND is_active = true LIMIT 1",
			model,
		).Scan(&pricingID, &inPrice, &outPrice)
		if err == nil {
			costCents = int64(float64(promptTokens)*inPrice*100_000 + float64(completionTokens)*outPrice*100_000)
		}
	}
	// No minimum floor — precise billing to 8 decimal places

	var balanceAfter int64
	err = pg.QueryRow(ctx,
		`UPDATE users SET balance_cents = balance_cents - $1 / 1000000, daily_token_used = daily_token_used + $2, updated_at = NOW()
		 WHERE id = $3 RETURNING balance_cents`,
		costCents, totalTokens, userID,
	).Scan(&balanceAfter)
	if err != nil {
		log.Printf("Billing: deduction failed for user %s: %v", userID, err)
		return
	}

	_, err = pg.Exec(ctx,
		`INSERT INTO billing_records (user_id, api_key_id, channel_id, model_name, request_id, prompt_tokens, completion_tokens, total_tokens, cost_cents, balance_after, pricing_id, status)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'success')`,
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
