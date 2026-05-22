package billing

import (
	"context"
	"encoding/json"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

// ModelPrice holds the sell-side pricing for a specific model.
type ModelPrice struct {
	ModelName         string  `json:"model_name"`
	SellInputPrice    float64 `json:"sell_input_price"`
	SellOutputPrice   float64 `json:"sell_output_price"`
	VIPDiscount       float64 `json:"vip_discount"`
	EnterpriseDiscount float64 `json:"enterprise_discount"`
}

// PricingEngine manages model pricing with in-memory + Redis caching.
type PricingEngine struct {
	pg  *pgxpool.Pool
	rdb *redis.Client

	mu       sync.RWMutex
	cache    map[string]*ModelPrice
	loadedAt time.Time
}

const pricingCacheTTL = 5 * time.Minute
const pricingRedisKey = "pricing:models"

func NewPricingEngine(pg *pgxpool.Pool, rdb *redis.Client) *PricingEngine {
	return &PricingEngine{
		pg:    pg,
		rdb:   rdb,
		cache: make(map[string]*ModelPrice),
	}
}

// Load refreshes the pricing cache from the database.
func (pe *PricingEngine) Load(ctx context.Context) error {
	rows, err := pe.pg.Query(ctx,
		`SELECT model_name, sell_input_price, sell_output_price,
		        vip_discount, enterprise_discount
		 FROM model_pricing WHERE is_active = true`)
	if err != nil {
		return err
	}
	defer rows.Close()

	pe.mu.Lock()
	defer pe.mu.Unlock()

	pe.cache = make(map[string]*ModelPrice)
	for rows.Next() {
		p := &ModelPrice{}
		if err := rows.Scan(&p.ModelName, &p.SellInputPrice, &p.SellOutputPrice,
			&p.VIPDiscount, &p.EnterpriseDiscount); err != nil {
			continue
		}
		pe.cache[p.ModelName] = p
	}
	pe.loadedAt = time.Now()

	// Sync to Redis for cross-instance caching
	data, _ := json.Marshal(pe.cache)
	pe.rdb.Set(ctx, pricingRedisKey, data, pricingCacheTTL)

	return nil
}

// GetPrice returns the pricing for a model, checking cache then DB.
func (pe *PricingEngine) GetPrice(ctx context.Context, model string) *ModelPrice {
	// Check in-memory cache
	pe.mu.RLock()
	if p, ok := pe.cache[model]; ok {
		pe.mu.RUnlock()
		return p
	}
	pe.mu.RUnlock()

	// Check Redis cache
	if pe.rdb != nil {
		data, err := pe.rdb.Get(ctx, pricingRedisKey).Bytes()
		if err == nil {
			var cache map[string]*ModelPrice
			if json.Unmarshal(data, &cache) == nil {
				if p, ok := cache[model]; ok {
					pe.mu.Lock()
					pe.cache[model] = p
					pe.mu.Unlock()
					return p
				}
			}
		}
	}

	// Fallback to DB
	if pe.pg != nil {
		p := &ModelPrice{}
		err := pe.pg.QueryRow(ctx,
			`SELECT model_name, sell_input_price, sell_output_price,
			        vip_discount, enterprise_discount
			 FROM model_pricing WHERE model_name = $1 AND is_active = true`,
			model,
		).Scan(&p.ModelName, &p.SellInputPrice, &p.SellOutputPrice,
			&p.VIPDiscount, &p.EnterpriseDiscount)

		if err == nil {
			pe.mu.Lock()
			pe.cache[model] = p
			pe.mu.Unlock()
			return p
		}
	}

	return nil
}

// CalculateCost computes the cost in cents for a given token usage.
// Uses input/output pricing split for accurate per-token-type charging.
func (pe *PricingEngine) CalculateCost(model string, promptTokens, completionTokens int, tier string) int64 {
	price := pe.GetPrice(context.Background(), model)
	if price == nil {
		return 0
	}

	inputCost := float64(promptTokens) / 1000.0 * price.SellInputPrice * 100
	outputCost := float64(completionTokens) / 1000.0 * price.SellOutputPrice * 100
	total := inputCost + outputCost

	// Apply tier discount
	switch tier {
	case "enterprise":
		total *= price.EnterpriseDiscount
	case "vip":
		total *= price.VIPDiscount
	}

	costCents := int64(total * 1_000_000) // convert cents to 10^-8 yuan
	return costCents
}

// StartRefreshLoop periodically reloads the pricing cache.
func (pe *PricingEngine) StartRefreshLoop(ctx context.Context, interval time.Duration) {
	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				if err := pe.Load(ctx); err != nil {
					// Log but don't crash
				}
			}
		}
	}()
}
