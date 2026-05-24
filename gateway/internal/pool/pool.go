package pool

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/tls"
	"encoding/base64"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

// Channel represents an upstream LLM API token with circuit breaker protection.
type Channel struct {
	ID             string
	Name           string
	Provider       string
	APIKey         string
	BaseURL        string
	Models         []string
	Weight         int
	Priority       int
	MaxConcurrency int
	CostMultiplier float64
	MaxErrors      int

	// Circuit breaker (local, fast-path)
	breaker *CircuitBreaker

	// HTTP client with connection pooling
	HTTPClient *http.Client

	mu sync.Mutex
}

// ChannelSnapshot is a lightweight read-only view for selection.
type ChannelSnapshot struct {
	ID             string
	Name           string
	Provider       string
	APIKey         string
	BaseURL        string
	Weight         int
	Priority       int
	MaxConcurrency int
	Concurrency    int // from Redis
	BreakerState   CircuitState
	HTTPClient     *http.Client
}

// ChannelPool manages a pool of upstream API channels.
type ChannelPool struct {
	pg  *pgxpool.Pool
	rdb *redis.Client
	mu  sync.RWMutex

	byModel map[string][]*Channel
	byID    map[string]*Channel

	// Config
	healthCheckInterval time.Duration
	concurrencyKeyTTL   time.Duration
	encryptionKey       []byte
}

func NewChannelPool(pg *pgxpool.Pool, rdb *redis.Client, encryptionKey string) *ChannelPool {
	key := []byte(encryptionKey)
	if len(key) > 32 {
		key = key[:32]
	}
	return &ChannelPool{
		pg:                  pg,
		rdb:                 rdb,
		byModel:             make(map[string][]*Channel),
		byID:                make(map[string]*Channel),
		healthCheckInterval: 30 * time.Second,
		concurrencyKeyTTL:   2 * time.Minute,
		encryptionKey:       key,
	}
}

// LoadFromDB loads all active channels from PostgreSQL.
func (cp *ChannelPool) LoadFromDB(ctx context.Context) error {
	rows, err := cp.pg.Query(ctx,
		`SELECT id, name, provider, api_key_enc, base_url, models,
		        weight, priority, max_concurrency, max_errors, cost_multiplier
		 FROM channels WHERE status != 'disabled' ORDER BY priority DESC, weight DESC`)
	if err != nil {
		return fmt.Errorf("failed to load channels: %w", err)
	}
	defer rows.Close()

	cp.mu.Lock()
	defer cp.mu.Unlock()

	cp.byModel = make(map[string][]*Channel)
	cp.byID = make(map[string]*Channel)

	for rows.Next() {
		ch := &Channel{
			breaker: NewCircuitBreaker(),
			HTTPClient: &http.Client{
				Timeout: 5 * time.Minute,
				Transport: &http.Transport{
					TLSClientConfig:     &tls.Config{},
					MaxIdleConns:        200,
					MaxIdleConnsPerHost: 20,
					MaxConnsPerHost:     50,
					IdleConnTimeout:     90 * time.Second,
					DisableKeepAlives:   false,
					ForceAttemptHTTP2:   true,
				},
			},
		}
		var apiKeyEnc string
		var models []string
		if err := rows.Scan(&ch.ID, &ch.Name, &ch.Provider, &apiKeyEnc,
			&ch.BaseURL, &models, &ch.Weight, &ch.Priority,
			&ch.MaxConcurrency, &ch.MaxErrors, &ch.CostMultiplier); err != nil {
			log.Printf("Failed to scan channel row: %v", err)
			continue
		}
		if decrypted, err := cp.decrypt(apiKeyEnc); err == nil {
			ch.APIKey = decrypted
		} else {
			log.Printf("Failed to decrypt API key for channel %s: %v", ch.Name, err)
			ch.APIKey = apiKeyEnc
		}
		ch.Models = models
			if ch.Provider == "gemini" { ch.HTTPClient = &http.Client{Timeout: 5 * time.Minute, Transport: &http.Transport{TLSHandshakeTimeout: 10 * time.Second, DisableKeepAlives: false}} }
		cp.byID[ch.ID] = ch
		for _, m := range models {
			cp.byModel[m] = append(cp.byModel[m], ch)
		}

		// Initialize Redis concurrency counter
		cp.rdb.SetNX(ctx, cp.concurrencyKey(ch.ID), 0, cp.concurrencyKeyTTL)
	}

	log.Printf("Loaded %d channels across %d models", len(cp.byID), len(cp.byModel))
	return nil
}

// AcquireChannel atomically selects and acquires a concurrency slot on a channel.
// Uses Redis for atomic concurrency counting across multiple gateway instances.
func (cp *ChannelPool) AcquireChannel(ctx context.Context, model string) (*Channel, error) {
	// Build a snapshot of available channels under read lock
	snapshots := cp.buildSnapshots(model)
	if len(snapshots) == 0 {
		return nil, fmt.Errorf("no channel available for model: %s", model)
	}

	// Try channels in weighted priority order with Redis-atomic concurrency acquire
	// Sort: highest priority first, then by weight, then least connections
	sortSnapshots(snapshots)

	for _, snap := range snapshots {
		// Circuit breaker check (local, fast)
		if snap.BreakerState == CircuitOpen {
			continue
		}
		if snap.BreakerState == CircuitHalfOpen && snap.Concurrency > 1 {
			continue // let only low-concurrency channels handle half-open probes
		}
		if snap.Concurrency >= snap.MaxConcurrency {
			continue
		}

		// Atomic acquire via Redis INCR
		key := cp.concurrencyKey(snap.ID)
		newVal, err := cp.rdb.Incr(ctx, key).Result()
		if err != nil {
			continue
		}
		cp.rdb.Expire(ctx, key, cp.concurrencyKeyTTL)

		if newVal > int64(snap.MaxConcurrency) {
			// Exceeded limit, rollback
			cp.rdb.Decr(ctx, key)
			continue
		}

		// Successfully acquired
		ch := cp.byID[snap.ID]
		return ch, nil
	}

	return nil, fmt.Errorf("all channels exhausted or at capacity for model: %s", model)
}

// ReleaseChannel releases a concurrency slot atomically via Redis.
func (cp *ChannelPool) ReleaseChannel(ctx context.Context, ch *Channel) {
	key := cp.concurrencyKey(ch.ID)
	cp.rdb.Decr(ctx, key)
	// Floor at 0 in case of drift
	if val, err := cp.rdb.Get(ctx, key).Int64(); err == nil && val < 0 {
		cp.rdb.Set(ctx, key, 0, cp.concurrencyKeyTTL)
	}
}

// RecordSuccess marks a successful request on a channel.
func (cp *ChannelPool) RecordSuccess(ctx context.Context, ch *Channel) {
	ch.breaker.RecordSuccess()
	// Sync state to Redis for cross-instance visibility
	cp.rdb.HSet(ctx, "channel:"+ch.ID,
		"breaker_state", int(ch.breaker.State()),
		"last_success", time.Now().Unix(),
	)
}

// RecordError records a failure on a channel, potentially tripping the circuit breaker.
func (cp *ChannelPool) RecordError(ctx context.Context, ch *Channel, statusCode int) {
	ch.breaker.RecordFailure(statusCode)

	newState := ch.breaker.State()

	// Persist to DB
	cp.pg.Exec(ctx,
		`UPDATE channels SET status = $1, updated_at = NOW() WHERE id = $2`,
		breakerStateToDBStatus(newState), ch.ID)

	// Sync to Redis
	cp.rdb.HSet(ctx, "channel:"+ch.ID,
		"breaker_state", int(newState),
		"last_failure", time.Now().Unix(),
		"last_status_code", statusCode,
	)

	if newState == CircuitOpen {
		log.Printf("Channel %s (%s) circuit OPEN (status=%d)", ch.Name, ch.ID, statusCode)
	}
}

// HealthCheckLoop periodically reloads channels and resets recovered breakers.
func (cp *ChannelPool) HealthCheckLoop(ctx context.Context, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			cp.LoadFromDB(ctx)
			cp.probeRecovered(ctx)
		}
	}
}

// probeRecovered performs active health checks on channels in half-open state.
func (cp *ChannelPool) probeRecovered(ctx context.Context) {
	cp.mu.RLock()
	defer cp.mu.RUnlock()

	for _, ch := range cp.byID {
		if ch.breaker.State() == CircuitHalfOpen {
			go cp.activeProbe(ctx, ch)
		}
	}
}

// activeProbe sends a lightweight request to verify channel health.
func (cp *ChannelPool) activeProbe(ctx context.Context, ch *Channel) {
	req, err := http.NewRequestWithContext(ctx, "GET",
		ch.BaseURL+"/v1/models", nil)
	if err != nil {
		return
	}
	req.Header.Set("Authorization", "Bearer "+ch.APIKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := ch.HTTPClient.Do(req)
	if err != nil {
		ch.breaker.RecordFailure(500)
		return
	}
	resp.Body.Close()

	if resp.StatusCode == 200 {
		ch.breaker.RecordSuccess()
		log.Printf("Channel %s (%s) health probe: recovered", ch.Name, ch.ID)
	} else if resp.StatusCode == 429 {
		ch.breaker.RecordFailure(429)
	} else if resp.StatusCode >= 500 {
		ch.breaker.RecordFailure(resp.StatusCode)
	} else {
		ch.breaker.RecordSuccess()
	}
}

// Shutdown gracefully shuts down the pool.
func (cp *ChannelPool) Shutdown(ctx context.Context) {
	log.Println("Channel pool shutting down...")
	// Drain all concurrency counters
	for id := range cp.byID {
		cp.rdb.Del(ctx, cp.concurrencyKey(id))
	}
}

// decrypt decrypts an AES-256-GCM encrypted base64 string.
func (cp *ChannelPool) decrypt(encoded string) (string, error) {
	if len(cp.encryptionKey) == 0 {
		return encoded, nil
	}
	buf, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return "", fmt.Errorf("base64 decode: %w", err)
	}
	if len(buf) < 28 { // 12 iv + 16 tag minimum
		return "", fmt.Errorf("ciphertext too short")
	}
	iv := buf[:12]
	tag := buf[12:28]
	ciphertext := buf[28:]
	block, err := aes.NewCipher(cp.encryptionKey)
	if err != nil {
		return "", err
	}
	aesgcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	plaintext, err := aesgcm.Open(nil, iv, append(ciphertext, tag...), nil)
	if err != nil {
		return "", fmt.Errorf("decrypt: %w", err)
	}
	return string(plaintext), nil
}

// --- Internal helpers ---

func (cp *ChannelPool) concurrencyKey(channelID string) string {
	return "channel:" + channelID + ":concurrency"
}

func (cp *ChannelPool) buildSnapshots(model string) []ChannelSnapshot {
	cp.mu.RLock()
	channels := cp.byModel[model]
	cp.mu.RUnlock()

	if len(channels) == 0 {
		return nil
	}

	// Batch-read Redis concurrency counters
	keys := make([]string, len(channels))
	for i, ch := range channels {
		keys[i] = cp.concurrencyKey(ch.ID)
	}
	vals, err := cp.rdb.MGet(context.Background(), keys...).Result()
	if err != nil {
		vals = make([]interface{}, len(keys))
	}

	snapshots := make([]ChannelSnapshot, len(channels))
	for i, ch := range channels {
		concurrency := 0
		if vals[i] != nil {
			if v, ok := vals[i].(string); ok {
				fmt.Sscanf(v, "%d", &concurrency)
			}
		}
		snapshots[i] = ChannelSnapshot{
			ID:             ch.ID,
			Name:           ch.Name,
			Provider:       ch.Provider,
			APIKey:         ch.APIKey,
			BaseURL:        ch.BaseURL,
			Weight:         ch.Weight,
			Priority:       ch.Priority,
			MaxConcurrency: ch.MaxConcurrency,
			Concurrency:    concurrency,
			BreakerState:   ch.breaker.State(),
			HTTPClient:     ch.HTTPClient,
		}
	}
	return snapshots
}

// sortSnapshots orders by priority desc, then (maxConcurrency - concurrency) desc, then weight desc.
// This implements "least-connections with priority and weight" selection.
func sortSnapshots(snaps []ChannelSnapshot) {
	// Fisher-Yates shuffle first for randomness within equal-priority groups
	for i := len(snaps) - 1; i > 0; i-- {
		j := rand.Intn(i + 1)
		snaps[i], snaps[j] = snaps[j], snaps[i]
	}

	// Stable sort by: priority desc → available capacity desc → weight desc
	for i := 0; i < len(snaps); i++ {
		for j := i + 1; j < len(snaps); j++ {
			if compareSnapshots(&snaps[i], &snaps[j]) < 0 {
				snaps[i], snaps[j] = snaps[j], snaps[i]
			}
		}
	}
}

func compareSnapshots(a, b *ChannelSnapshot) int {
	// Higher priority first
	if a.Priority != b.Priority {
		return a.Priority - b.Priority
	}
	// More available capacity first
	aAvail := a.MaxConcurrency - a.Concurrency
	bAvail := b.MaxConcurrency - b.Concurrency
	if aAvail != bAvail {
		return aAvail - bAvail
	}
	// Higher weight first
	if a.Weight != b.Weight {
		return a.Weight - b.Weight
	}
	return 0
}

func breakerStateToDBStatus(state CircuitState) string {
	switch state {
	case CircuitClosed:
		return "active"
	case CircuitOpen:
		return "error"
	case CircuitHalfOpen:
		return "active"
	default:
		return "active"
	}
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
