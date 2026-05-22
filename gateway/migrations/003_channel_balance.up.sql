-- Migration 003: Channel balance + provider tracking

ALTER TABLE channels
    ADD COLUMN IF NOT EXISTS balance_cents       INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS balance_updated_at   TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS balance_provider     VARCHAR(50),
    ADD COLUMN IF NOT EXISTS initial_balance_cents INT NOT NULL DEFAULT 0;
