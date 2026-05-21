package billing

import (
	"context"
	"log"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

// BillingTask represents a single billing record to be written asynchronously.
type BillingTask struct {
	UserID           string
	APIKeyID         string
	ChannelID        string
	Model            string
	RequestID        string
	Endpoint         string
	PromptTokens     int
	CompletionTokens int
	PricingID        string
}

// WorkerPool manages async billing writes with buffered channels and batch flushing.
type WorkerPool struct {
	pg      *pgxpool.Pool
	rdb     *redis.Client
	pricing *PricingEngine

	tasks    chan BillingTask
	buffer   []BillingTask
	bufMu    sync.Mutex
	flushCh  chan struct{}

	// Stats
	processed uint64
	dropped   uint64

	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup
}

// NewWorkerPool creates a billing worker pool.
// bufferSize: max pending tasks (default 10000)
// workers: number of writer goroutines (default 2)
func NewWorkerPool(pg *pgxpool.Pool, rdb *redis.Client, pricing *PricingEngine, bufferSize int, workers int) *WorkerPool {
	if bufferSize <= 0 {
		bufferSize = 10000
	}
	if workers <= 0 {
		workers = 2
	}

	ctx, cancel := context.WithCancel(context.Background())

	wp := &WorkerPool{
		pg:      pg,
		rdb:     rdb,
		pricing: pricing,
		tasks:   make(chan BillingTask, bufferSize),
		buffer:  make([]BillingTask, 0, 200),
		flushCh: make(chan struct{}, 1),
		ctx:     ctx,
		cancel:  cancel,
	}

	// Start workers
	for i := 0; i < workers; i++ {
		wp.wg.Add(1)
		go wp.worker(i)
	}

	// Start periodic flush goroutine
	wp.wg.Add(1)
	go wp.periodicFlush()

	return wp
}

// Enqueue adds a billing task to the queue. Non-blocking — drops if buffer is full.
func (wp *WorkerPool) Enqueue(task BillingTask) {
	select {
	case wp.tasks <- task:
		// Enqueued successfully
	default:
		// Buffer full — write directly (blocking fallback)
		wp.dropped++
		log.Printf("Billing worker: buffer full, writing directly (dropped=%d)", wp.dropped)
		go wp.writeDirect(task)
	}
}

// Shutdown gracefully stops the worker pool, flushing remaining tasks.
func (wp *WorkerPool) Shutdown(timeout time.Duration) {
	wp.cancel()
	close(wp.tasks)

	done := make(chan struct{})
	go func() {
		wp.wg.Wait()
		close(done)
	}()

	select {
	case <-done:
		log.Printf("Billing worker shut down gracefully (processed=%d, dropped=%d)", wp.processed, wp.dropped)
	case <-time.After(timeout):
		log.Printf("Billing worker shutdown timed out after %v", timeout)
	}
}

// worker processes billing tasks from the channel.
func (wp *WorkerPool) worker(id int) {
	defer wp.wg.Done()

	for {
		select {
		case <-wp.ctx.Done():
			// Drain remaining before exit
			wp.drainBuffer()
			return
		case task, ok := <-wp.tasks:
			if !ok {
				wp.drainBuffer()
				return
			}
			wp.addToBuffer(task)
		}
	}
}

// addToBuffer adds a task to the local buffer, flushing if needed.
func (wp *WorkerPool) addToBuffer(task BillingTask) {
	wp.bufMu.Lock()
	wp.buffer = append(wp.buffer, task)
	shouldFlush := len(wp.buffer) >= 200
	wp.bufMu.Unlock()

	if shouldFlush {
		select {
		case wp.flushCh <- struct{}{}:
		default:
		}
	}
}

// periodicFlush flushes the buffer every second to minimize write latency.
func (wp *WorkerPool) periodicFlush() {
	defer wp.wg.Done()

	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-wp.ctx.Done():
			return
		case <-ticker.C:
			select {
			case wp.flushCh <- struct{}{}:
			default:
			}
		case <-wp.flushCh:
			wp.drainBuffer()
		}
	}
}

// drainBuffer flushes all buffered tasks to the database in a batch.
func (wp *WorkerPool) drainBuffer() {
	wp.bufMu.Lock()
	if len(wp.buffer) == 0 {
		wp.bufMu.Unlock()
		return
	}

	// Swap buffer
	batch := wp.buffer
	wp.buffer = make([]BillingTask, 0, 200)
	wp.bufMu.Unlock()

	wp.flushBatch(batch)
}

// flushBatch writes a batch of billing records in a single transaction.
func (wp *WorkerPool) flushBatch(batch []BillingTask) {
	if len(batch) == 0 {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	tx, err := wp.pg.Begin(ctx)
	if err != nil {
		log.Printf("Billing: failed to begin batch tx: %v", err)
		wp.writeDirectBatch(batch)
		return
	}
	defer tx.Rollback(ctx)

	for _, task := range batch {
		// Look up pricing
		costCents := wp.pricing.CalculateCost(task.Model, task.PromptTokens, task.CompletionTokens, "free")

		// Update user balance
		_, err := tx.Exec(ctx,
			`UPDATE users
			 SET balance_cents = balance_cents - $1,
			     daily_token_used = daily_token_used + $2,
			     updated_at = NOW()
			 WHERE id = $3`,
			costCents, task.PromptTokens+task.CompletionTokens, task.UserID,
		)
		if err != nil {
			log.Printf("Billing: batch balance update failed for user %s: %v", task.UserID, err)
			continue
		}

		// Insert billing record
		_, err = tx.Exec(ctx,
			`INSERT INTO billing_records
			 (user_id, api_key_id, channel_id, model_name, request_id, endpoint,
			  prompt_tokens, completion_tokens, total_tokens, cost_cents, pricing_id, status)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'success')`,
			task.UserID, task.APIKeyID, task.ChannelID, task.Model, task.RequestID,
			task.Endpoint, task.PromptTokens, task.CompletionTokens,
			task.PromptTokens+task.CompletionTokens, costCents, nilPricingID(task.PricingID),
		)
		if err != nil {
			log.Printf("Billing: batch insert failed: %v", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		log.Printf("Billing: batch commit failed: %v", err)
		wp.writeDirectBatch(batch)
		return
	}

	wp.processed += uint64(len(batch))

	// Update Redis cache for all users in batch
	redisPipe := wp.rdb.Pipeline()
	for _, task := range batch {
		redisPipe.IncrBy(ctx,
			keyUserDailyTokens(task.UserID),
			int64(task.PromptTokens+task.CompletionTokens))
	}
	redisPipe.Exec(ctx)
}

// writeDirect writes a single task directly (blocking — used as overflow safety valve).
func (wp *WorkerPool) writeDirect(task BillingTask) {
	wp.writeDirectBatch([]BillingTask{task})
}

// writeDirectBatch writes tasks one-by-one (fallback when batch tx fails).
func (wp *WorkerPool) writeDirectBatch(batch []BillingTask) {
	for _, task := range batch {
		RecordUsageDetailed(wp.pg, wp.rdb,
			task.UserID, task.APIKeyID, task.ChannelID,
			task.Model, task.RequestID,
			task.PromptTokens, task.CompletionTokens)
	}
	wp.processed += uint64(len(batch))
}

func nilPricingID(id string) interface{} {
	if id == "" {
		return nil
	}
	return id
}

func keyUserDailyTokens(userID string) string {
	return "user:" + userID + ":daily_tokens"
}
