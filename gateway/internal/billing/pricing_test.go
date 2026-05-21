package billing

import (
	"testing"
)

func TestModelPrice_CalculateCost_FreeTier(t *testing.T) {
	pe := &PricingEngine{
		cache: map[string]*ModelPrice{
			"gpt-4o": {
				ModelName:       "gpt-4o",
				SellInputPrice:  3.50,
				SellOutputPrice: 14.00,
			},
		},
	}

	cost := pe.CalculateCost("gpt-4o", 1000, 0, "free")
	if cost <= 0 {
		t.Errorf("expected >0 cost for 1000 input tokens, got %d", cost)
	}
	// 1000/1000 * 3.50 * 100 = 350 cents
	if cost != 350 {
		t.Errorf("expected 350 cents for 1000 input tokens, got %d", cost)
	}
}

func TestModelPrice_CalculateCost_OutputTokens(t *testing.T) {
	pe := &PricingEngine{
		cache: map[string]*ModelPrice{
			"gpt-4o": {
				ModelName:       "gpt-4o",
				SellInputPrice:  3.50,
				SellOutputPrice: 14.00,
			},
		},
	}

	cost := pe.CalculateCost("gpt-4o", 0, 1000, "free")
	// 1000/1000 * 14.00 * 100 = 1400 cents
	if cost != 1400 {
		t.Errorf("expected 1400 cents for 1000 output tokens, got %d", cost)
	}
}

func TestModelPrice_CalculateCost_Combined(t *testing.T) {
	pe := &PricingEngine{
		cache: map[string]*ModelPrice{
			"gpt-4o": {
				ModelName:       "gpt-4o",
				SellInputPrice:  3.50,
				SellOutputPrice: 14.00,
			},
		},
	}

	cost := pe.CalculateCost("gpt-4o", 500, 500, "free")
	// 500/1000*3.50*100 + 500/1000*14.00*100 = 175 + 700 = 875
	if cost != 875 {
		t.Errorf("expected 875 cents for 500+500 tokens, got %d", cost)
	}
}

func TestModelPrice_CalculateCost_VIPDiscount(t *testing.T) {
	pe := &PricingEngine{
		cache: map[string]*ModelPrice{
			"gpt-4o": {
				ModelName:       "gpt-4o",
				SellInputPrice:  3.50,
				SellOutputPrice: 14.00,
				VIPDiscount:     0.9,
			},
		},
	}

	cost := pe.CalculateCost("gpt-4o", 1000, 0, "vip")
	// 350 * 0.9 = 315
	if cost != 315 {
		t.Errorf("expected 315 cents with VIP discount, got %d", cost)
	}
}

func TestModelPrice_CalculateCost_EnterpriseDiscount(t *testing.T) {
	pe := &PricingEngine{
		cache: map[string]*ModelPrice{
			"gpt-4o": {
				ModelName:          "gpt-4o",
				SellInputPrice:     3.50,
				SellOutputPrice:    14.00,
				EnterpriseDiscount: 0.8,
			},
		},
	}

	cost := pe.CalculateCost("gpt-4o", 1000, 0, "enterprise")
	// 350 * 0.8 = 280
	if cost != 280 {
		t.Errorf("expected 280 cents with enterprise discount, got %d", cost)
	}
}

func TestModelPrice_CalculateCost_MinimumOneCent(t *testing.T) {
	pe := &PricingEngine{
		cache: map[string]*ModelPrice{
			"cheap-model": {
				ModelName:       "cheap-model",
				SellInputPrice:  0.0001,
				SellOutputPrice: 0.0001,
			},
		},
	}

	cost := pe.CalculateCost("cheap-model", 1, 0, "free")
	if cost < 1 {
		t.Errorf("expected minimum 1 cent, got %d", cost)
	}
}

func TestModelPrice_CalculateCost_UnknownModel(t *testing.T) {
	// PricingEngine with nil rdb/pg — GetPrice returns nil for unknown model
	pe := &PricingEngine{cache: make(map[string]*ModelPrice)}

	// Manually inject a nil price for unknown model
	cost := pe.CalculateCost("nonexistent", 1000, 1000, "free")
	if cost != 0 {
		t.Errorf("expected 0 cost for unknown model, got %d", cost)
	}
}

func TestModelPrice_CalculateCost_LargeTokens(t *testing.T) {
	pe := &PricingEngine{
		cache: map[string]*ModelPrice{
			"gpt-4o-mini": {
				ModelName:       "gpt-4o-mini",
				SellInputPrice:  0.20,
				SellOutputPrice: 0.80,
			},
		},
	}

	// 100k prompt + 50k completion
	cost := pe.CalculateCost("gpt-4o-mini", 100000, 50000, "free")
	// 100000/1000*0.20*100 + 50000/1000*0.80*100 = 2000 + 4000 = 6000
	if cost != 6000 {
		t.Errorf("expected 6000 cents for large usage, got %d", cost)
	}
}

func TestPricingEngine_LoadsToCache(t *testing.T) {
	pe := NewPricingEngine(nil, nil)
	if pe == nil {
		t.Fatal("expected non-nil PricingEngine")
	}
	if pe.cache == nil {
		t.Fatal("expected non-nil cache map")
	}
	if len(pe.cache) != 0 {
		t.Errorf("expected empty cache on init, got %d entries", len(pe.cache))
	}
}
