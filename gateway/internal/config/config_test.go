package config

import (
	"os"
	"testing"
)

func TestLoad_Defaults(t *testing.T) {
	// Clear relevant env vars
	for _, k := range []string{"LISTEN_ADDR", "DATABASE_URL", "REDIS_ADDR", "REDIS_PASSWORD", "JWT_SECRET", "ENCRYPTION_KEY"} {
		os.Unsetenv(k)
	}

	cfg := Load()
	if cfg.ListenAddr != ":8080" {
		t.Errorf("expected :8080, got %s", cfg.ListenAddr)
	}
	if cfg.RedisPassword != "" {
		t.Errorf("expected empty Redis password, got %s", cfg.RedisPassword)
	}
	if cfg.JWTSecret == "" {
		t.Error("expected default JWT secret")
	}
	if cfg.EncryptionKey == "" {
		t.Error("expected default encryption key")
	}
}

func TestLoad_FromEnv(t *testing.T) {
	os.Setenv("LISTEN_ADDR", ":9090")
	os.Setenv("JWT_SECRET", "my-secret-key")
	os.Setenv("ENCRYPTION_KEY", "abcdef0123456789abcdef0123456789")
	defer func() {
		os.Unsetenv("LISTEN_ADDR")
		os.Unsetenv("JWT_SECRET")
		os.Unsetenv("ENCRYPTION_KEY")
	}()

	cfg := Load()
	if cfg.ListenAddr != ":9090" {
		t.Errorf("expected :9090, got %s", cfg.ListenAddr)
	}
	if cfg.JWTSecret != "my-secret-key" {
		t.Errorf("expected my-secret-key, got %s", cfg.JWTSecret)
	}
	if cfg.EncryptionKey != "abcdef0123456789abcdef0123456789" {
		t.Errorf("expected custom encryption key, got %s", cfg.EncryptionKey)
	}
}

func TestGetEnv_Fallback(t *testing.T) {
	os.Unsetenv("NONEXISTENT_VAR")
	v := getEnv("NONEXISTENT_VAR", "fallback")
	if v != "fallback" {
		t.Errorf("expected fallback, got %s", v)
	}
}

func TestGetEnv_FromEnv(t *testing.T) {
	os.Setenv("MY_VAR", "custom_value")
	defer os.Unsetenv("MY_VAR")
	v := getEnv("MY_VAR", "fallback")
	if v != "custom_value" {
		t.Errorf("expected custom_value, got %s", v)
	}
}

func TestConfig_StructFields(t *testing.T) {
	cfg := &Config{
		ListenAddr:    ":8080",
		DatabaseURL:   "postgres://user:pass@host/db",
		RedisAddr:     "redis:6379",
		RedisPassword: "",
		JWTSecret:     "secret",
		EncryptionKey: "0123456789abcdef0123456789abcdef",
	}
	if cfg.ListenAddr != ":8080" {
		t.Error("config struct field mismatch")
	}
}
