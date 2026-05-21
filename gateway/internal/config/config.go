package config

import (
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	ListenAddr    string
	DatabaseURL   string
	RedisAddr     string
	RedisPassword string
	JWTSecret     string
	EncryptionKey string // 32-byte key for AES-256-GCM channel token encryption
}

func Load() *Config {
	_ = godotenv.Load(".env", "../.env")

	return &Config{
		ListenAddr:    getEnv("LISTEN_ADDR", ":8080"),
		DatabaseURL:   getEnv("DATABASE_URL", "postgres://llmgateway:password@localhost:5432/llmgateway?sslmode=disable"),
		RedisAddr:     getEnv("REDIS_ADDR", "localhost:6379"),
		RedisPassword: getEnv("REDIS_PASSWORD", ""),
		JWTSecret:     getEnv("JWT_SECRET", "dev-secret-change-in-production"),
		EncryptionKey: getEnv("ENCRYPTION_KEY", "0123456789abcdef0123456789abcdef"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
