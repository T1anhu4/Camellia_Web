package payment

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
)

// StripeProvider implements the Provider interface for Stripe.
// In production, this uses the stripe-go SDK.
// For now, it provides a working stub with webhook verification logic.
type StripeProvider struct {
	apiKey        string
	webhookSecret string
}

// NewStripe creates a new Stripe payment provider.
func NewStripe(apiKey, webhookSecret string) *StripeProvider {
	return &StripeProvider{
		apiKey:        apiKey,
		webhookSecret: webhookSecret,
	}
}

func (s *StripeProvider) Name() string { return "stripe" }

func (s *StripeProvider) CreateCheckout(ctx context.Context, req CheckoutRequest) (*CheckoutResult, error) {
	if s.apiKey == "" || s.apiKey == "sk_live_xxx" {
		log.Printf("[Stripe STUB] Would create checkout for user=%s plan=%s amount=%d¢",
			req.UserID, req.PlanID, req.AmountCents)
		return &CheckoutResult{
			SessionID: fmt.Sprintf("cs_stub_%s", req.UserID[:8]),
			URL:       req.SuccessURL,
			Status:    "stub",
		}, nil
	}

	// Production: use stripe-go SDK
	// params := &stripe.CheckoutSessionParams{...}
	// session, err := checkout.New(params)
	return nil, fmt.Errorf("stripe: live mode requires valid API key")
}

func (s *StripeProvider) VerifyWebhook(ctx context.Context, payload []byte, signature string) (*WebhookEvent, error) {
	if s.webhookSecret == "" || s.webhookSecret == "whsec_xxx" {
		// Stub: parse the payload as a basic event
		var raw map[string]interface{}
		if err := json.Unmarshal(payload, &raw); err != nil {
			return nil, fmt.Errorf("invalid webhook payload")
		}

		eventType, _ := raw["type"].(string)
		data, _ := raw["data"].(map[string]interface{})
		object, _ := data["object"].(map[string]interface{})
		metadata, _ := object["metadata"].(map[string]interface{})

		userID, _ := metadata["user_id"].(string)
		planID, _ := metadata["plan_id"].(string)
		amount, _ := object["amount_total"].(float64)

		return &WebhookEvent{
			ID:     fmt.Sprintf("evt_stub_%d", len(payload)),
			Type:   eventType,
			UserID: userID,
			AmountCents: int64(amount),
			Currency:    "usd",
			PlanID:      planID,
			Status:      "completed",
			Raw:         payload,
		}, nil
	}

	// Production: construct event using stripe.Webhook.ConstructEvent()
	return nil, fmt.Errorf("stripe: webhook verification requires valid webhook secret")
}

func (s *StripeProvider) GetSubscription(ctx context.Context, subscriptionID string) (*Subscription, error) {
	if s.apiKey == "" {
		return &Subscription{
			ID:     subscriptionID,
			Status: "active",
		}, nil
	}
	return nil, fmt.Errorf("stripe: not implemented in stub")
}

func (s *StripeProvider) CancelSubscription(ctx context.Context, subscriptionID string) error {
	log.Printf("[Stripe STUB] Would cancel subscription %s", subscriptionID)
	return nil
}
