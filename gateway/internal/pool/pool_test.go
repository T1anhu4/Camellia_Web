package pool

import (
	"net/http"
	"testing"
)

func TestSortSnapshots_PriorityFirst(t *testing.T) {
	snaps := []ChannelSnapshot{
		{ID: "a", Priority: 0, Weight: 10, MaxConcurrency: 10, Concurrency: 0},
		{ID: "b", Priority: 5, Weight: 1, MaxConcurrency: 10, Concurrency: 0},
		{ID: "c", Priority: 1, Weight: 5, MaxConcurrency: 10, Concurrency: 0},
	}
	sortSnapshots(snaps)
	if snaps[0].ID != "b" {
		t.Errorf("expected highest priority (b) first, got %s", snaps[0].ID)
	}
	if snaps[2].ID != "a" {
		t.Errorf("expected lowest priority (a) last, got %s", snaps[2].ID)
	}
}

func TestSortSnapshots_AvailableCapacity(t *testing.T) {
	snaps := []ChannelSnapshot{
		{ID: "a", Priority: 1, MaxConcurrency: 10, Concurrency: 8, Weight: 5},  // avail=2
		{ID: "b", Priority: 1, MaxConcurrency: 10, Concurrency: 0, Weight: 1},  // avail=10
		{ID: "c", Priority: 1, MaxConcurrency: 10, Concurrency: 5, Weight: 10}, // avail=5
	}
	sortSnapshots(snaps)
	if snaps[0].ID != "b" {
		t.Errorf("expected most capacity (b) first, got %s", snaps[0].ID)
	}
	if snaps[2].ID != "a" {
		t.Errorf("expected least capacity (a) last, got %s", snaps[2].ID)
	}
}

func TestSortSnapshots_WeightTiebreaker(t *testing.T) {
	snaps := []ChannelSnapshot{
		{ID: "a", Priority: 1, MaxConcurrency: 10, Concurrency: 0, Weight: 1},
		{ID: "b", Priority: 1, MaxConcurrency: 10, Concurrency: 0, Weight: 10},
	}
	sortSnapshots(snaps)
	if snaps[0].ID != "b" {
		t.Errorf("expected higher weight (b) first, got %s", snaps[0].ID)
	}
}

func TestCompareSnapshots_PriorityDominates(t *testing.T) {
	a := &ChannelSnapshot{Priority: 10, MaxConcurrency: 1, Concurrency: 1, Weight: 1}
	b := &ChannelSnapshot{Priority: 0, MaxConcurrency: 100, Concurrency: 0, Weight: 100}
	if compareSnapshots(a, b) <= 0 {
		t.Error("expected priority to dominate capacity+weight")
	}
}

func TestCompareSnapshots_Equal(t *testing.T) {
	a := &ChannelSnapshot{Priority: 5, MaxConcurrency: 10, Concurrency: 0, Weight: 3}
	b := &ChannelSnapshot{Priority: 5, MaxConcurrency: 10, Concurrency: 0, Weight: 3}
	if compareSnapshots(a, b) != 0 {
		t.Error("expected equal snapshots")
	}
}

func TestSortSnapshots_EmptySlice(t *testing.T) {
	sortSnapshots(nil)
	sortSnapshots([]ChannelSnapshot{})
	// No panic = pass
}

func TestSortSnapshots_SingleElement(t *testing.T) {
	snaps := []ChannelSnapshot{
		{ID: "only", Priority: 1},
	}
	sortSnapshots(snaps)
	if snaps[0].ID != "only" {
		t.Error("single element sort should keep it")
	}
}

func TestCircuitBreaker_IntegrationWithChannel(t *testing.T) {
	// Verify Channel struct fields for HTTP client
	ch := &Channel{
		ID:       "test-channel",
		Name:     "Test",
		Provider: "openai",
		breaker:  NewCircuitBreaker(),
		HTTPClient: &http.Client{},
	}
	if ch.breaker == nil {
		t.Fatal("expected circuit breaker on channel")
	}
	if ch.HTTPClient == nil {
		t.Fatal("expected HTTP client on channel")
	}
}

func TestBreakerStateToDBStatus(t *testing.T) {
	tests := []struct {
		state CircuitState
		want  string
	}{
		{CircuitClosed, "active"},
		{CircuitOpen, "error"},
		{CircuitHalfOpen, "active"},
		{CircuitState(999), "active"},
	}
	for _, tt := range tests {
		got := breakerStateToDBStatus(tt.state)
		if got != tt.want {
			t.Errorf("breakerStateToDBStatus(%v)=%q, want %q", tt.state, got, tt.want)
		}
	}
}

func TestChannelSnapshot_Fields(t *testing.T) {
	snap := ChannelSnapshot{
		ID:             "ch-1",
		Name:           "openai-1",
		Provider:       "openai",
		APIKey:         "sk-test",
		BaseURL:        "https://api.openai.com",
		Weight:         1,
		Priority:       0,
		MaxConcurrency: 10,
		Concurrency:    0,
		BreakerState:   CircuitClosed,
		HTTPClient:     &http.Client{},
	}
	if snap.ID != "ch-1" {
		t.Error("snapshot ID mismatch")
	}
	if snap.Concurrency != 0 {
		t.Error("snapshot concurrency should be 0")
	}
}

func TestDecrypt_InvalidBase64(t *testing.T) {
	cp := &ChannelPool{encryptionKey: []byte("0123456789abcdef0123456789abcdef")}
	_, err := cp.decrypt("!!!not-valid-base64!!!")
	if err == nil {
		t.Error("expected error for invalid base64")
	}
}

func TestDecrypt_EmptyCiphertext(t *testing.T) {
	cp := &ChannelPool{encryptionKey: []byte("0123456789abcdef0123456789abcdef")}
	_, err := cp.decrypt("")
	if err == nil {
		t.Error("expected error for empty ciphertext")
	}
}

func TestDecrypt_ShortCiphertext(t *testing.T) {
	cp := &ChannelPool{encryptionKey: []byte("0123456789abcdef0123456789abcdef")}
	_, err := cp.decrypt("YWJj") // "abc" in base64, only 3 bytes
	if err == nil {
		t.Error("expected error for too-short ciphertext")
	}
}

func TestDecrypt_NoEncryptionKey(t *testing.T) {
	cp := &ChannelPool{encryptionKey: []byte{}}
	result, err := cp.decrypt("YWJjZGVmZ2hpamtsbW5vcA==")
	if err != nil {
		t.Errorf("expected passthrough with empty key, got error: %v", err)
	}
	if result != "YWJjZGVmZ2hpamtsbW5vcA==" {
		t.Errorf("expected original string passthrough, got %s", result)
	}
}

func TestNewChannelPool(t *testing.T) {
	cp := NewChannelPool(nil, nil, "0123456789abcdef0123456789abcdef")
	if cp == nil {
		t.Fatal("expected non-nil pool")
	}
	if len(cp.encryptionKey) != 32 {
		t.Errorf("expected 32-byte key, got %d", len(cp.encryptionKey))
	}
	if cp.healthCheckInterval == 0 {
		t.Error("expected health check interval")
	}
}

func TestNewChannelPool_TruncatesLongKey(t *testing.T) {
	cp := NewChannelPool(nil, nil, "this-is-a-very-long-encryption-key-that-exceeds-32-bytes")
	if len(cp.encryptionKey) != 32 {
		t.Errorf("expected key truncated to 32 bytes, got %d", len(cp.encryptionKey))
	}
}

func TestConcurrencyKey(t *testing.T) {
	cp := &ChannelPool{}
	key := cp.concurrencyKey("channel-123")
	if key != "channel:channel-123:concurrency" {
		t.Errorf("unexpected concurrency key: %s", key)
	}
}
