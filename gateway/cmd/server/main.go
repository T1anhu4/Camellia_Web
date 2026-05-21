package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/limiter"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/gofiber/fiber/v2/middleware/requestid"

	"github.com/llmgateway/gateway/internal/billing"
	"github.com/llmgateway/gateway/internal/config"
	"github.com/llmgateway/gateway/internal/db"
	"github.com/llmgateway/gateway/internal/handler"
	"github.com/llmgateway/gateway/internal/middleware"
	"github.com/llmgateway/gateway/internal/pool"
	"github.com/llmgateway/gateway/internal/ratelimit"
	"github.com/llmgateway/gateway/internal/tokenizer"
)

func main() {
	cfg := config.Load()

	// --- Infrastructure ---
	pg, err := db.NewPostgres(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Failed to connect to PostgreSQL: %v", err)
	}
	defer pg.Close()

	rdb, err := db.NewRedis(cfg.RedisAddr, cfg.RedisPassword)
	if err != nil {
		log.Fatalf("Failed to connect to Redis: %v", err)
	}
	defer rdb.Close()

	// --- Phase 2: Channel pool with circuit breaker ---
	channelPool := pool.NewChannelPool(pg, rdb, cfg.EncryptionKey)
	if err := channelPool.LoadFromDB(context.Background()); err != nil {
		log.Fatalf("Failed to load channel pool: %v", err)
	}
	go channelPool.HealthCheckLoop(context.Background(), 30*time.Second)

	// --- Phase 4: Pricing engine (cached model pricing) ---
	pricing := billing.NewPricingEngine(pg, rdb)
	if err := pricing.Load(context.Background()); err != nil {
		log.Printf("Warning: failed to load pricing: %v", err)
	}
	pricing.StartRefreshLoop(context.Background(), 2*time.Minute)

	// --- Phase 4: Billing worker pool (async high-throughput writes) ---
	billingWorker := billing.NewWorkerPool(pg, rdb, pricing, 10000, 2)
	defer billingWorker.Shutdown(15 * time.Second)

	// --- Phase 4: Quota enforcer ---
	quota := billing.NewQuotaEnforcer(pg, rdb)

	// --- Phase 4: Tokenizer (tiktoken-accurate counting) ---
	tok := tokenizer.New()

	// --- Phase 2: Rate limiter ---
	lim := ratelimit.NewTokenBucket(rdb)

	// --- Handler dependencies ---
	deps := &handler.HandlerDeps{
		Pool:    channelPool,
		Limiter: lim,
		PG:      pg,
		RDB:     rdb,
		Billing: billingWorker,
		Pricing: pricing,
		Quota:   quota,
		Tok:     tok,
	}

	// --- Fiber app ---
	app := fiber.New(fiber.Config{
		AppName:               "LLM Gateway",
		ReadTimeout:           5 * time.Minute,
		WriteTimeout:          5 * time.Minute,
		IdleTimeout:           120 * time.Second,
		BodyLimit:             32 * 1024 * 1024,
		Concurrency:           256 * 1024,
		DisableStartupMessage: true,
		EnablePrintRoutes:     false,
		ServerHeader:          "LLM-Gateway",
		Network:               fiber.NetworkTCP,
	})

	// Global middleware
	app.Use(requestid.New())
	app.Use(recover.New(recover.Config{EnableStackTrace: true}))
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowHeaders: "Authorization, Content-Type, X-Request-ID",
		AllowMethods: "GET, POST, OPTIONS",
	}))
	app.Use(limiter.New(limiter.Config{
		Max:        10000,
		Expiration: 1 * time.Second,
		KeyGenerator: func(c *fiber.Ctx) string { return "global" },
		LimitReached: func(c *fiber.Ctx) error {
			return c.Status(503).JSON(fiber.Map{
				"error": fiber.Map{"message": "Server overloaded", "type": "server_error"},
			})
		},
	}))

	// Routes
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok", "time": time.Now().Unix()})
	})

	app.Get("/health/ready", func(c *fiber.Ctx) error {
		ctx, cancel := context.WithTimeout(c.Context(), 2*time.Second)
		defer cancel()
		dbOK := pg.Ping(ctx) == nil
		redisOK := rdb.Ping(ctx).Err() == nil
		if dbOK && redisOK {
			return c.Status(200).JSON(fiber.Map{
				"status": "ready", "postgres": "connected", "redis": "connected",
			})
		}
		return c.Status(503).JSON(fiber.Map{
			"status": "not_ready",
			"postgres": map[bool]string{true: "connected", false: "disconnected"}[dbOK],
			"redis":    map[bool]string{true: "connected", false: "disconnected"}[redisOK],
		})
	})

	// Prometheus metrics (no auth)
	app.Get("/metrics", handler.MetricsHandler())

	// OpenAI-compatible API routes
	v1 := app.Group("/v1", middleware.Auth(rdb, pg))

	v1.Post("/chat/completions", handler.ChatCompletions(deps))
	v1.Post("/embeddings", handler.Embeddings(deps))
	v1.Get("/models", handler.ListModels(deps))

	// --- Graceful shutdown ---
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		<-quit
		log.Println("Shutting down...")
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		billingWorker.Shutdown(10 * time.Second)
		channelPool.Shutdown(ctx)

		if err := app.ShutdownWithTimeout(30 * time.Second); err != nil {
			log.Printf("Shutdown error: %v", err)
		}
		log.Println("Server stopped.")
	}()

	log.Printf("LLM Gateway v2.0 starting on %s", cfg.ListenAddr)
	log.Printf("  Pricing engine: loaded")
	log.Printf("  Billing worker: 2 workers, 10k buffer")
	log.Printf("  Tokenizer: cl100k_base (tiktoken)")
	log.Printf("  Quota enforcer: active")

	if err := app.Listen(cfg.ListenAddr); err != nil {
		log.Fatalf("Server error: %v", err)
	}
}
