package model

import "time"

// User represents a registered user.
type User struct {
	ID                   string     `json:"id"`
	Email                string     `json:"email"`
	PasswordHash         string     `json:"-"`
	Nickname             string     `json:"nickname"`
	AvatarURL            string     `json:"avatar_url"`
	Role                 string     `json:"role"`
	Status               string     `json:"status"`
	BalanceCents         int64      `json:"balance_cents"`
	SubscriptionTier     string     `json:"subscription_tier"`
	SubscriptionExpiresAt *time.Time `json:"subscription_expires_at"`
	DailyTokenQuota      int        `json:"daily_token_quota"`
	DailyTokenUsed       int        `json:"daily_token_used"`
	CreatedAt            time.Time  `json:"created_at"`
}

// APIKey represents a user API key.
type APIKey struct {
	ID         string     `json:"id"`
	UserID     string     `json:"user_id"`
	KeyHash    string     `json:"-"`
	KeyPrefix  string     `json:"key_prefix"`
	Name       string     `json:"name"`
	IsEnabled  bool       `json:"is_enabled"`
	LastUsedAt *time.Time `json:"last_used_at"`
	RPMLimit   *int       `json:"rpm_limit"`
	TPMLimit   *int       `json:"tpm_limit"`
	CreatedAt  time.Time  `json:"created_at"`
}

// Channel represents an upstream API channel (extends pool.Channel metadata).
type Channel struct {
	ID               string    `json:"id"`
	Name             string    `json:"name"`
	Provider         string    `json:"provider"`
	BaseURL          string    `json:"base_url"`
	Models           []string  `json:"models"`
	Weight           int       `json:"weight"`
	Priority         int       `json:"priority"`
	MaxConcurrency   int       `json:"max_concurrency"`
	Status           string    `json:"status"`
	ErrorCount       int       `json:"error_count"`
	CostMultiplier   float64   `json:"cost_multiplier"`
	CreatedAt        time.Time `json:"created_at"`
}

// ModelPricing represents sell-side pricing configuration.
type ModelPricing struct {
	ID                string    `json:"id"`
	ModelName         string    `json:"model_name"`
	ModelDisplay      string    `json:"model_display"`
	CostInputPrice    float64   `json:"cost_input_price"`
	CostOutputPrice   float64   `json:"cost_output_price"`
	SellInputPrice    float64   `json:"sell_input_price"`
	SellOutputPrice   float64   `json:"sell_output_price"`
	VIPDiscount       float64   `json:"vip_discount"`
	EnterpriseDiscount float64  `json:"enterprise_discount"`
	IsActive          bool      `json:"is_active"`
}

// BillingRecord represents a single billing entry.
type BillingRecord struct {
	ID              int64     `json:"id"`
	UserID          string    `json:"user_id"`
	APIKeyID        string    `json:"api_key_id"`
	ChannelID       string    `json:"channel_id"`
	ModelName       string    `json:"model_name"`
	RequestID       string    `json:"request_id"`
	PromptTokens    int       `json:"prompt_tokens"`
	CompletionTokens int     `json:"completion_tokens"`
	TotalTokens     int       `json:"total_tokens"`
	CostCents       int64     `json:"cost_cents"`
	BalanceAfter    int64     `json:"balance_after"`
	CreatedAt       time.Time `json:"created_at"`
}
