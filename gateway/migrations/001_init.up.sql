-- LLM Gateway - Initial Schema
-- Phase 1: Core tables for users, API keys, channels, billing

-- ============================================================
-- Extensions
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- Enums
-- ============================================================
CREATE TYPE user_role AS ENUM ('user', 'admin');
CREATE TYPE user_status AS ENUM ('active', 'disabled');
CREATE TYPE subscription_tier AS ENUM ('free', 'vip', 'enterprise');
CREATE TYPE channel_status AS ENUM ('active', 'disabled', 'rate_limited', 'error');
CREATE TYPE provider_type AS ENUM ('openai', 'azure', 'anthropic', 'google', 'deepseek', 'custom');

-- ============================================================
-- Users
-- ============================================================
CREATE TABLE users (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email       VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    nickname    VARCHAR(100),
    avatar_url  TEXT,
    role        user_role NOT NULL DEFAULT 'user',
    status      user_status NOT NULL DEFAULT 'active',

    -- Balance in USD cents (avoids floating-point issues)
    balance_cents    BIGINT NOT NULL DEFAULT 0,

    -- Subscription
    subscription_tier      subscription_tier NOT NULL DEFAULT 'free',
    subscription_expires_at TIMESTAMPTZ,

    -- Quota tracking (free tier daily limit)
    daily_token_quota  INT NOT NULL DEFAULT 10000,
    daily_token_used   INT NOT NULL DEFAULT 0,
    quota_reset_at     TIMESTAMPTZ,

    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);

-- ============================================================
-- API Keys
-- ============================================================
CREATE TABLE api_keys (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key_hash    VARCHAR(255) NOT NULL UNIQUE,   -- SHA-256 hash of the full key
    key_prefix  VARCHAR(12) NOT NULL,            -- First 8 chars for UI display
    name        VARCHAR(100) NOT NULL DEFAULT 'Default',
    is_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
    last_used_at TIMESTAMPTZ,

    -- Rate limit overrides (NULL = use tier default)
    rpm_limit   INT,    -- requests per minute
    tpm_limit   INT,    -- tokens per minute

    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_api_keys_user ON api_keys(user_id);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);

-- ============================================================
-- Channels (Upstream LLM API token pool)
-- ============================================================
CREATE TABLE channels (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(100) NOT NULL,
    provider        provider_type NOT NULL DEFAULT 'openai',
    api_key_enc     TEXT NOT NULL,               -- AES-256-GCM encrypted
    base_url        TEXT NOT NULL,
    models          TEXT[] NOT NULL DEFAULT '{}', -- supported model list
    org_id          TEXT,                         -- OpenAI org id, optional

    -- Load balancing
    weight          INT NOT NULL DEFAULT 1,      -- higher = more traffic
    priority        INT NOT NULL DEFAULT 0,      -- higher = preferred

    -- Concurrency control
    max_concurrency INT NOT NULL DEFAULT 10,
    current_concurrency INT NOT NULL DEFAULT 0,

    -- Auto-failover state
    status          channel_status NOT NULL DEFAULT 'active',
    error_count     INT NOT NULL DEFAULT 0,
    max_errors      INT NOT NULL DEFAULT 5,      -- consecutive errors before disable
    rate_limit_until TIMESTAMPTZ,                 -- backoff until

    -- Cost tracking (for provider billing)
    cost_multiplier REAL NOT NULL DEFAULT 1.0,   -- provider-specific markup

    last_health_check TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_channels_status ON channels(status);
CREATE INDEX idx_channels_provider ON channels(provider);

-- ============================================================
-- Model Pricing (sell-side pricing config)
-- ============================================================
CREATE TABLE model_pricing (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_name      VARCHAR(100) NOT NULL UNIQUE,
    model_display   VARCHAR(200),                -- e.g. "GPT-4o"

    -- Cost price (what we pay upstream, per 1K tokens)
    cost_input_price  REAL NOT NULL DEFAULT 0,
    cost_output_price REAL NOT NULL DEFAULT 0,

    -- Sell price (what users pay, per 1K tokens)
    sell_input_price   REAL NOT NULL DEFAULT 0,
    sell_output_price  REAL NOT NULL DEFAULT 0,

    -- Multiplier for different subscription tiers
    vip_discount       REAL NOT NULL DEFAULT 0.9,   -- 10% off
    enterprise_discount REAL NOT NULL DEFAULT 0.8,   -- 20% off

    is_active         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Billing Records (immutable ledger)
-- ============================================================
CREATE TABLE billing_records (
    id              BIGSERIAL PRIMARY KEY,
    user_id         UUID NOT NULL REFERENCES users(id),
    api_key_id      UUID REFERENCES api_keys(id),
    channel_id      UUID REFERENCES channels(id),

    -- Request info
    model_name      VARCHAR(100) NOT NULL,
    request_id      VARCHAR(64),
    endpoint        VARCHAR(50) NOT NULL DEFAULT 'chat/completions',

    -- Token breakdown
    prompt_tokens       INT NOT NULL DEFAULT 0,
    completion_tokens   INT NOT NULL DEFAULT 0,
    total_tokens        INT NOT NULL DEFAULT 0,

    -- Financial
    cost_cents       BIGINT NOT NULL DEFAULT 0,  -- amount deducted
    balance_after    BIGINT NOT NULL,            -- user balance after deduction
    pricing_id       UUID REFERENCES model_pricing(id),

    -- Status
    status           VARCHAR(20) NOT NULL DEFAULT 'success',
    error_msg        TEXT,

    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_billing_user ON billing_records(user_id, created_at DESC);
CREATE INDEX idx_billing_user_date ON billing_records(user_id, created_at);

-- Partition hint for production scaling:
-- ALTER TABLE billing_records PARTITION BY RANGE (created_at);

-- ============================================================
-- Subscription Plans
-- ============================================================
CREATE TABLE subscription_plans (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(100) NOT NULL,
    tier            subscription_tier NOT NULL UNIQUE,
    price_monthly_cents INT NOT NULL,
    price_yearly_cents  INT NOT NULL,
    daily_token_quota  INT NOT NULL,
    rpm_limit          INT NOT NULL DEFAULT 60,
    features            JSONB NOT NULL DEFAULT '{}',
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Verification Codes (email auth)
-- ============================================================
CREATE TABLE verification_codes (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email       VARCHAR(255) NOT NULL,
    code        VARCHAR(6) NOT NULL,
    purpose     VARCHAR(20) NOT NULL DEFAULT 'login',  -- 'login' | 'register'
    used        BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vc_email ON verification_codes(email, purpose, created_at DESC);

-- ============================================================
-- Admin Audit Log
-- ============================================================
CREATE TABLE audit_logs (
    id          BIGSERIAL PRIMARY KEY,
    admin_id    UUID REFERENCES users(id),
    action      VARCHAR(50) NOT NULL,
    target_type VARCHAR(50),         -- 'user', 'channel', 'model_pricing'
    target_id   VARCHAR(100),
    detail      JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Seed data: default subscription plans
-- ============================================================
INSERT INTO subscription_plans (name, tier, price_monthly_cents, price_yearly_cents, daily_token_quota, rpm_limit, features) VALUES
('Free',     'free',       0,      0,       10000, 10,  '{"models":["gpt-4o-mini"],"support":"community"}'::jsonb),
('VIP',      'vip',      1999,  19990,     100000, 60,  '{"models":["gpt-4o-mini","gpt-4o","claude-4-haiku"],"support":"priority"}'::jsonb),
('Enterprise','enterprise', 9999, 99990,   1000000, 300, '{"models":["all"],"support":"dedicated","custom_pricing":true}'::jsonb);

-- Seed default model pricing
INSERT INTO model_pricing (model_name, model_display, cost_input_price, cost_output_price, sell_input_price, sell_output_price) VALUES
('gpt-4o-mini',    'GPT-4o Mini',   0.15,  0.60,  0.20,  0.80),
('gpt-4o',         'GPT-4o',         2.50, 10.00,  3.50, 14.00),
('claude-4-haiku', 'Claude 4 Haiku', 1.00,  5.00,  1.50,  7.50);
