package middleware

import (
	"crypto/sha256"
	"encoding/hex"
	"testing"
)

func TestHashKey_Deterministic(t *testing.T) {
	key := "camellia-abcdef1234567890abcdef1234567890abcdef1234567890"
	h1 := hashKey(key)
	h2 := hashKey(key)
	if h1 != h2 {
		t.Fatal("hashKey must be deterministic")
	}
}

func TestHashKey_DifferentKeys(t *testing.T) {
	h1 := hashKey("camellia-key1")
	h2 := hashKey("camellia-key2")
	if h1 == h2 {
		t.Fatal("different keys must produce different hashes")
	}
}

func TestHashKey_Length(t *testing.T) {
	h := hashKey("test-key")
	if len(h) != 64 {
		t.Errorf("SHA-256 hex digest must be 64 chars, got %d", len(h))
	}
}

func TestHashKey_KnownValue(t *testing.T) {
	h := hashKey("test-api-key")
	expected := sha256Hex("test-api-key")
	if h != expected {
		t.Errorf("hashKey mismatch: got %s, want %s", h, expected)
	}
}

func TestToInt_VariousTypes(t *testing.T) {
	tests := []struct {
		input interface{}
		want  int
	}{
		{int(42), 42},
		{int64(100), 100},
		{float64(3.14), 3},
		{string("77"), 77},
		{string("invalid"), 0},
		{nil, 0},
		{true, 0},
	}
	for _, tt := range tests {
		got := toInt(tt.input)
		if got != tt.want {
			t.Errorf("toInt(%v)=%d, want %d", tt.input, got, tt.want)
		}
	}
}

func TestToInt_EdgeCases(t *testing.T) {
	if toInt(int(-5)) != -5 {
		t.Error("negative int")
	}
	if toInt(int64(0)) != 0 {
		t.Error("zero int64")
	}
	if toInt(float64(9999)) != 9999 {
		t.Error("large float")
	}
}

func sha256Hex(s string) string {
	h := sha256.Sum256([]byte(s))
	return hex.EncodeToString(h[:])
}
