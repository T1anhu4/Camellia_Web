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
	RecordUsageWithShadow(pg, rdb, userID, apiKeyID, channelID, model, requestID,
		promptTokens, completionTokens, 0, "")
}

func RecordUsageWithShadow(pg *pgxpool.Pool, rdb *redis.Client,
	userID, apiKeyID, channelID, model, requestID string,
	promptTokens, completionTokens, cachedTokens int, channelProvider string) {

	totalTokens := promptTokens + completionTokens
	if totalTokens <= 0 {
		return
	}

	ctx := context.Background()

	var pricingID *string
	costInSubunits := int64(0) // 10^-8 yuan

	// Try model_pools pricing (RMB cents per 1M tokens)
	var poolIn, poolOut, perCallCents int
	var poolMode string
	err := pg.QueryRow(ctx,
		"SELECT input_price_cents, output_price_cents, per_call_price_cents, pricing_mode FROM model_pools WHERE name = $1 AND is_active = true LIMIT 1",
		model,
	).Scan(&poolIn, &poolOut, &perCallCents, &poolMode)

	if err == nil {
		if poolMode == "per_call" && perCallCents > 0 {
			// Per-call: price in RMB cents per request
			costInSubunits = int64(perCallCents) * 1_000_000
		} else if poolIn > 0 || poolOut > 0 {
			// Per-token: price in RMB cents per 1M tokens
			// cost = (tokens / 1_000_000) * price_cents * 1_000_000 (to subunits)
			// Simplified: cost_in_subunits = tokens * price_cents
			costInSubunits = int64(promptTokens)*int64(poolIn) + int64(completionTokens)*int64(poolOut)
		}
	} else {
		// Fallback to model_pricing (USD per 1K tokens)
		var inPrice, outPrice float64
		err := pg.QueryRow(ctx,
			"SELECT id, sell_input_price, sell_output_price FROM model_pricing WHERE model_name = $1 AND is_active = true LIMIT 1",
			model,
		).Scan(&pricingID, &inPrice, &outPrice)
		if err == nil {
			costInSubunits = int64(float64(promptTokens)*inPrice*100_000 + float64(completionTokens)*outPrice*100_000)
		}
	}

	// Deduct from user balance: costInSubunits / 1_000_000 = RMB cents
	deductCents := costInSubunits / 1_000_000
	var balanceAfter int64
	err = pg.QueryRow(ctx,
		`UPDATE users SET balance_cents = balance_cents - $1, daily_token_used = daily_token_used + $2, updated_at = NOW()
		 WHERE id = $3 RETURNING balance_cents`,
		deductCents, totalTokens, userID,
	).Scan(&balanceAfter)
	if err != nil {
		log.Printf("Billing: deduction failed for user %s: %v", userID, err)
		return
	}

	_, err = pg.Exec(ctx,
		`INSERT INTO billing_records (user_id, api_key_id, channel_id, model_name, request_id, prompt_tokens, completion_tokens, total_tokens, cost_cents, balance_after, pricing_id, status)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'success')`,
		userID, apiKeyID, channelID, model, requestID,
		promptTokens, completionTokens, totalTokens, deductCents, balanceAfter, pricingID,
	)
	if err != nil {
		log.Printf("Billing: insert failed: %v", err)
	}

	// Shadow billing for Gemini — deduct from channel balance with FOR UPDATE lock
	if channelProvider == "gemini" && channelID != "" {
		shadowCents := calculateGeminiShadowCost(promptTokens, completionTokens, cachedTokens)
		if shadowCents > 0 {
			tx, txErr := pg.Begin(ctx)
			if txErr == nil {
				var currentBalance int64
				scanErr := tx.QueryRow(ctx,
					"SELECT balance_cents FROM channels WHERE id = $1 FOR UPDATE", channelID,
				).Scan(&currentBalance)
				if scanErr == nil && currentBalance > 0 {
					newBalance := currentBalance
					if shadowCents <= currentBalance {
						newBalance = currentBalance - shadowCents
					} else {
						newBalance = 0
					}
					tx.Exec(ctx, "UPDATE channels SET balance_cents = $1, balance_updated_at = NOW() WHERE id = $2", newBalance, channelID)
					log.Printf("[ShadowBilling] Gemini %s: deduct=%d分 (prompt=%d comp=%d cached=%d) channel %d→%d",
						channelID[:8], shadowCents, promptTokens, completionTokens, cachedTokens, currentBalance, newBalance)
				}
				tx.Commit(ctx)
			}
		}
	}

	pipe := rdb.Pipeline()
	pipe.IncrBy(ctx, fmt.Sprintf("user:%s:daily_tokens", userID), int64(totalTokens))
	pipe.HSet(ctx, fmt.Sprintf("user:%s", userID), "balance_cents", balanceAfter)
	pipe.Exec(ctx)
}

// calculateGeminiShadowCost computes Google's actual cost in RMB cents.
// Gemini 2.5 Flash pricing (USD/1M tokens, 1:7.2 exchange rate):
//
//	Input:  $1.50/M → ¥0.0108/1K tokens
//	Output: $9.00/M → ¥0.0648/1K tokens
//	Cached input: 10% of input price (90% discount)
func calculateGeminiShadowCost(promptTokens, completionTokens, cachedTokens int) int64 {
	const exchangeRate = 7.2
	const inputPriceUSD = 1.50
	const outputPriceUSD = 9.00

	regularInput := promptTokens - cachedTokens
	if regularInput < 0 {
		regularInput = 0
	}

	regularInputCost := float64(regularInput) / 1_000_000.0 * inputPriceUSD
	cachedInputCost := float64(cachedTokens) / 1_000_000.0 * inputPriceUSD * 0.10
	outputCost := float64(completionTokens) / 1_000_000.0 * outputPriceUSD

	totalUSD := regularInputCost + cachedInputCost + outputCost
	totalRMB := totalUSD * exchangeRate
	return int64(totalRMB * 100) // convert to RMB cents
}
