package model

import (
	"encoding/json"
	"testing"
	"time"
)

func TestUser_PasswordHash_NotExported(t *testing.T) {
	u := User{
		ID:           "user-1",
		Email:        "test@example.com",
		PasswordHash: "secret-hash",
		Role:         "user",
	}
	body, err := json.Marshal(u)
	if err != nil {
		t.Fatal(err)
	}
	var result map[string]interface{}
	json.Unmarshal(body, &result)
	if _, ok := result["password_hash"]; ok {
		t.Error("password_hash must not be serialized to JSON")
	}
}

func TestAPIKey_KeyHash_NotExported(t *testing.T) {
	k := APIKey{
		ID:      "key-1",
		KeyHash: "abc123",
	}
	body, _ := json.Marshal(k)
	var result map[string]interface{}
	json.Unmarshal(body, &result)
	if _, ok := result["key_hash"]; ok {
		t.Error("key_hash must not be serialized to JSON")
	}
}

func TestChannel_JSON(t *testing.T) {
	ch := Channel{
		ID:       "ch-1",
		Name:     "openai",
		Provider: "openai",
		BaseURL:  "https://api.openai.com",
		Models:   []string{"gpt-4o", "gpt-4o-mini"},
		Weight:   1,
		Priority: 0,
		Status:   "active",
	}
	body, err := json.Marshal(ch)
	if err != nil {
		t.Fatal(err)
	}
	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		t.Fatal(err)
	}
	if result["name"] != "openai" {
		t.Error("channel name mismatch")
	}
}

func TestModelPricing_JSON(t *testing.T) {
	p := ModelPricing{
		ID:                 "mp-1",
		ModelName:          "gpt-4o",
		ModelDisplay:       "GPT-4o",
		CostInputPrice:     2.50,
		CostOutputPrice:    10.00,
		SellInputPrice:     3.50,
		SellOutputPrice:    14.00,
		VIPDiscount:        0.9,
		EnterpriseDiscount: 0.8,
		IsActive:           true,
	}
	body, _ := json.Marshal(p)
	var result map[string]interface{}
	json.Unmarshal(body, &result)
	if result["model_name"] != "gpt-4o" {
		t.Error("pricing model_name mismatch")
	}
}

func TestBillingRecord_Fields(t *testing.T) {
	now := time.Now()
	br := BillingRecord{
		ID:              1,
		UserID:          "user-1",
		APIKeyID:        "key-1",
		ChannelID:       "ch-1",
		ModelName:       "gpt-4o",
		RequestID:       "req-1",
		PromptTokens:    100,
		CompletionTokens: 50,
		TotalTokens:     150,
		CostCents:       350,
		BalanceAfter:    9650,
		CreatedAt:       now,
	}
	if br.TotalTokens != br.PromptTokens+br.CompletionTokens {
		t.Error("total_tokens should equal prompt + completion")
	}
	if br.CostCents < 0 {
		t.Error("cost_cents should not be negative")
	}
}

func TestUser_DefaultFields(t *testing.T) {
	u := User{}
	if u.Role != "" {
		t.Error("default role should be empty")
	}
	if u.Status != "" {
		t.Error("default status should be empty")
	}
}
