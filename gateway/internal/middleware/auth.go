package middleware

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

// Auth validates API keys against Redis cache (with DB fallback).
// Injects user_id, api_key_id, tier, rpm_limit, tpm_limit into request context.
func Auth(rdb *redis.Client, pg *pgxpool.Pool) fiber.Handler {
	return func(c *fiber.Ctx) error {
		authHeader := c.Get("Authorization")
		if authHeader == "" {
			return c.Status(401).JSON(fiber.Map{
				"error": fiber.Map{
					"message": "Missing API key. Use: Authorization: Bearer sk-xxx",
					"type":    "authentication_error",
				},
			})
		}

		key := strings.TrimPrefix(authHeader, "Bearer ")
		if key == authHeader || key == "" {
			return c.Status(401).JSON(fiber.Map{
				"error": fiber.Map{
					"message": "Invalid Authorization format",
					"type":    "authentication_error",
				},
			})
		}

		hash := hashKey(key)

		// Try Redis first (hot path — sub-millisecond)
		ctx := c.Context()
		cached, err := rdb.HGetAll(ctx, "apikey:"+hash).Result()
		if err == nil && len(cached) > 0 {
			data := make(map[string]interface{}, len(cached))
			for k, v := range cached {
				data[k] = v
			}
			setLocals(c, data)
			return c.Next()
		}

		// Fallback to PostgreSQL
		var userID, apiKeyID, tier string
		var rpmLimit, tpmLimit *int
		err = pg.QueryRow(context.Background(),
			`SELECT u.id, ak.id, u.subscription_tier::text, ak.rpm_limit, ak.tpm_limit
			 FROM api_keys ak
			 JOIN users u ON u.id = ak.user_id
			 WHERE ak.key_hash = $1 AND ak.is_enabled = true AND u.status = 'active'`,
			hash,
		).Scan(&userID, &apiKeyID, &tier, &rpmLimit, &tpmLimit)

		if err != nil {
			return c.Status(401).JSON(fiber.Map{
				"error": fiber.Map{
					"message": "Invalid or disabled API key",
					"type":    "authentication_error",
				},
			})
		}

		// Populate cache
		cacheData := map[string]interface{}{
			"user_id":    userID,
			"api_key_id": apiKeyID,
			"tier":       tier,
		}
		if rpmLimit != nil {
			cacheData["rpm_limit"] = *rpmLimit
		}
		if tpmLimit != nil {
			cacheData["tpm_limit"] = *tpmLimit
		}
		rdb.HSet(ctx, "apikey:"+hash, cacheData)
		rdb.Expire(ctx, "apikey:"+hash, 5*time.Minute)

		setLocals(c, cacheData)

		// Update last_used_at async (fire-and-forget)
		go func() {
			pg.Exec(context.Background(),
				"UPDATE api_keys SET last_used_at = NOW() WHERE id = $1", apiKeyID)
		}()

		return c.Next()
	}
}

func setLocals(c *fiber.Ctx, data map[string]interface{}) {
	c.Locals("user_id", data["user_id"])
	c.Locals("api_key_id", data["api_key_id"])
	c.Locals("tier", data["tier"])

	if v, ok := data["rpm_limit"]; ok && v != nil {
		c.Locals("rpm_limit", toInt(v))
	}
	if v, ok := data["tpm_limit"]; ok && v != nil {
		c.Locals("tpm_limit", toInt(v))
	}
}

func toInt(v interface{}) int {
	switch val := v.(type) {
	case int:
		return val
	case int64:
		return int(val)
	case float64:
		return int(val)
	case string:
		var i int
		fmt.Sscanf(val, "%d", &i)
		return i
	}
	return 0
}

func hashKey(key string) string {
	h := sha256.Sum256([]byte(key))
	return hex.EncodeToString(h[:])
}
