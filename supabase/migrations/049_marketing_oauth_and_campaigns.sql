-- OAuth credentials and synchronized campaign inventory for provider integrations.
-- Tokens are encrypted at application level; this migration never stores plaintext credentials.

ALTER TABLE marketing_connections
  ADD COLUMN IF NOT EXISTS access_token_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS refresh_token_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS provider_user_id TEXT,
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES marketing_connections(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('meta', 'google_ads')),
  provider_campaign_id TEXT NOT NULL,
  provider_account_id TEXT,
  name TEXT NOT NULL,
  status TEXT,
  objective TEXT,
  spend NUMERIC,
  impressions BIGINT,
  clicks BIGINT,
  conversions NUMERIC,
  raw_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, provider, provider_campaign_id)
);
ALTER TABLE marketing_campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS marketing_campaigns_select ON marketing_campaigns;
DROP POLICY IF EXISTS marketing_campaigns_modify ON marketing_campaigns;
CREATE POLICY marketing_campaigns_select ON marketing_campaigns FOR SELECT USING (is_account_member(account_id));
CREATE POLICY marketing_campaigns_modify ON marketing_campaigns FOR ALL USING (is_account_member(account_id, 'admin')) WITH CHECK (is_account_member(account_id, 'admin'));
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_account_provider ON marketing_campaigns(account_id, provider);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_account_synced ON marketing_campaigns(account_id, last_synced_at DESC);
