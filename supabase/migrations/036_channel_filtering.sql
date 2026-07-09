-- ============================================================
-- 036_channel_filtering.sql — Per-channel automations & flows
--
-- Adds a `channel` column to `automations` and `flows` so users
-- can scope triggers to WhatsApp-only, Instagram-only, or both
-- (NULL = both, backward compatible with existing rows).
--
-- The engine dispatch queries will filter:
--   WHERE (channel IS NULL OR channel = input.channel)
--
-- Idempotent — safe to run multiple times.
-- ============================================================

-- ============================================================
-- 1. automations
-- ============================================================
ALTER TABLE automations
  ADD COLUMN IF NOT EXISTS channel TEXT
  CHECK (channel IS NULL OR channel IN ('whatsapp', 'instagram'));

COMMENT ON COLUMN automations.channel IS
  'NULL = both channels. Set to ''whatsapp'' or ''instagram'' to scope triggers to that channel only.';

-- ============================================================
-- 2. flows
-- ============================================================
ALTER TABLE flows
  ADD COLUMN IF NOT EXISTS channel TEXT
  CHECK (channel IS NULL OR channel IN ('whatsapp', 'instagram'));

COMMENT ON COLUMN flows.channel IS
  'NULL = both channels. Set to ''whatsapp'' or ''instagram'' to scope triggers to that channel only.';
