-- ============================================================
-- 043_instagram_token_refresh.sql — Support automatic token
-- refresh for Instagram long-lived access tokens.
--
-- Instagram User Access Tokens expire after ~60 days. Short-lived
-- tokens (~1h) can be exchanged for long-lived ones via Meta's
-- /oauth/access_token endpoint. This migration adds the columns
-- needed to track token expiry and perform scheduled refreshes.
--
-- meta_app_id / meta_app_secret: stored per-account so different
-- workspaces can use their own Meta Apps (multi-tenant).
-- ============================================================

ALTER TABLE instagram_config
  ADD COLUMN IF NOT EXISTS meta_app_id TEXT,
  ADD COLUMN IF NOT EXISTS meta_app_secret TEXT,
  ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS token_refreshed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_refresh_error TEXT;

-- Index for the cron sweep — rows where the token expires soon
-- (within 7 days) and the config is still connected.
CREATE INDEX IF NOT EXISTS idx_instagram_config_token_expiry
  ON instagram_config (token_expires_at)
  WHERE status = 'connected' AND token_expires_at IS NOT NULL;
