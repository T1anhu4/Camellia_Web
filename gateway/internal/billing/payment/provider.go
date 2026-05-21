// Package payment defines the payment provider abstraction layer.
// Implementations: Stripe, Alipay, WeChat Pay.
package payment

import (
	"context"
	"time"
)

// Provider defines the interface for payment gateways.
type Provider interface {
	// CreateCheckout creates a checkout session / payment order.
	CreateCheckout(ctx context.Context, req CheckoutRequest) (*CheckoutResult, error)

	// VerifyWebhook validates and processes a payment webhook event.
	VerifyWebhook(ctx context.Context, payload []byte, signature string) (*WebhookEvent, error)

	// GetSubscription returns details about an active subscription.
	GetSubscription(ctx context.Context, subscriptionID string) (*Subscription, error)

	// CancelSubscription cancels an active subscription.
	CancelSubscription(ctx context.Context, subscriptionID string) error

	// Name returns the provider identifier (e.g. "stripe", "alipay").
	Name() string
}

// CheckoutRequest represents a payment/checkout initiation.
type CheckoutRequest struct {
	UserID      string
	UserEmail   string
	PlanID      string
	PlanName    string
	AmountCents int64
	Currency    string
	SuccessURL  string
	CancelURL   string
	Mode        string // "subscription" | "payment" (top-up)
	Metadata    map[string]string
}

// CheckoutResult contains the redirect URL for the checkout page.
type CheckoutResult struct {
	SessionID string
	URL       string
	Status    string
}

// WebhookEvent represents a payment provider webhook event.
type WebhookEvent struct {
	ID             string
	Type           string // "checkout.completed", "subscription.updated", "payment.succeeded"
	UserID         string // extracted from metadata
	AmountCents    int64
	Currency       string
	SubscriptionID string
	PlanID         string
	Status         string
	Raw            []byte // original payload
	CreatedAt      time.Time
}

// Subscription represents a user subscription.
type Subscription struct {
	ID             string
	Provider       string
	Status         string // "active", "past_due", "canceled", "trialing"
	PlanID         string
	CurrentPeriodStart time.Time
	CurrentPeriodEnd   time.Time
	CancelAt       *time.Time
	Metadata       map[string]string
}

// Plan represents a subscription plan for the payment provider.
type Plan struct {
	ID            string
	Name          string
	AmountCents   int64
	Currency      string
	Interval      string // "month", "year"
	Tier          string // "free", "vip", "enterprise"
	DailyTokenQuota int
}
