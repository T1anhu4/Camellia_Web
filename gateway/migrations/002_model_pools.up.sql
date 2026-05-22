-- Migration 002: Model Pools + Channel enhancements (v3.0)

-- ============================================================
-- Model Pools — pricing & display layer for channels
-- ============================================================
CREATE TABLE model_pools (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(200),
    description TEXT,
    pricing_mode VARCHAR(20) NOT NULL DEFAULT 'per_token',  -- per_token | per_call
    input_price_cents   INT NOT NULL DEFAULT 0,   -- cents per 1M tokens
    output_price_cents  INT NOT NULL DEFAULT 0,
    cached_price_cents  INT NOT NULL DEFAULT 0,   -- cache-hit price
    per_call_price_cents INT NOT NULL DEFAULT 0,  -- per-call mode price
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_model_pools_name ON model_pools(name);
CREATE INDEX idx_model_pools_active ON model_pools(is_active);

-- ============================================================
-- Channels — add model_pool_id, key_priority, key_name, notes
-- ============================================================
ALTER TABLE channels
    ADD COLUMN IF NOT EXISTS model_pool_id UUID REFERENCES model_pools(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS key_priority  INT NOT NULL DEFAULT 3,
    ADD COLUMN IF NOT EXISTS key_name      VARCHAR(100),
    ADD COLUMN IF NOT EXISTS notes         TEXT;

CREATE INDEX IF NOT EXISTS idx_channels_pool ON channels(model_pool_id);
CREATE INDEX IF NOT EXISTS idx_channels_priority ON channels(key_priority);

-- ============================================================
-- Seed: default model pools
-- ============================================================
INSERT INTO model_pools (name, display_name, description, input_price_cents, output_price_cents, pricing_mode) VALUES
('gpt-4o-mini',    'GPT-4o Mini',    'OpenAI 高性价比小型模型', 15,  60,  'per_token'),
('gpt-4o',         'GPT-4o',         'OpenAI 旗舰多模态模型',  250, 1000,'per_token'),
('claude-4-haiku', 'Claude 4 Haiku', 'Anthropic 最快模型',     100, 500, 'per_token'),
('deepseek-v4-pro','DeepSeek V4 Pro','DeepSeek 旗舰 MoE 模型', 55,  219, 'per_token'),
('deepseek-v4-flash','DeepSeek V4 Flash','DeepSeek 高效快速模型', 14, 28,'per_token');
