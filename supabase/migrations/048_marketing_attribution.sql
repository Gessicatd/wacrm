-- Marketing attribution and provider connection foundation.
-- This migration stores commercial attribution only; never clinical data.

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS first_touch_attribution JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS last_touch_attribution JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS attribution_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_contacts_first_touch_source
  ON contacts ((first_touch_attribution->>'source'));
CREATE INDEX IF NOT EXISTS idx_contacts_last_touch_campaign
  ON contacts ((last_touch_attribution->>'campaign'));

CREATE TABLE IF NOT EXISTS marketing_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE UNIQUE,
  gtm_container_id TEXT,
  meta_pixel_id TEXT,
  meta_dataset_id TEXT,
  google_tag_id TEXT,
  google_ads_customer_id TEXT,
  consent_mode TEXT NOT NULL DEFAULT 'ask' CHECK (consent_mode IN ('ask', 'denied_by_default', 'granted_by_default')),
  enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE marketing_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS marketing_settings_select ON marketing_settings;
DROP POLICY IF EXISTS marketing_settings_modify ON marketing_settings;
CREATE POLICY marketing_settings_select ON marketing_settings FOR SELECT USING (is_account_member(account_id));
CREATE POLICY marketing_settings_modify ON marketing_settings FOR ALL USING (is_account_member(account_id, 'admin')) WITH CHECK (is_account_member(account_id, 'admin'));
CREATE INDEX IF NOT EXISTS idx_marketing_settings_account ON marketing_settings(account_id);

CREATE TABLE IF NOT EXISTS marketing_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('meta', 'google_ads')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'connected', 'expired', 'error', 'revoked')),
  provider_account_id TEXT,
  provider_account_name TEXT,
  scopes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  token_expires_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_error TEXT,
  connected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, provider, provider_account_id)
);
ALTER TABLE marketing_connections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS marketing_connections_select ON marketing_connections;
DROP POLICY IF EXISTS marketing_connections_modify ON marketing_connections;
CREATE POLICY marketing_connections_select ON marketing_connections FOR SELECT USING (is_account_member(account_id));
CREATE POLICY marketing_connections_modify ON marketing_connections FOR ALL USING (is_account_member(account_id, 'admin')) WITH CHECK (is_account_member(account_id, 'admin'));
CREATE INDEX IF NOT EXISTS idx_marketing_connections_account_provider ON marketing_connections(account_id, provider);

CREATE TABLE IF NOT EXISTS marketing_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  event_name TEXT NOT NULL,
  event_id TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('website', 'crm', 'whatsapp', 'instagram', 'meta', 'google_ads')),
  value NUMERIC,
  currency TEXT,
  attribution JSONB NOT NULL DEFAULT '{}'::jsonb,
  consent JSONB NOT NULL DEFAULT '{}'::jsonb,
  provider_status JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, event_id)
);
ALTER TABLE marketing_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS marketing_events_select ON marketing_events;
DROP POLICY IF EXISTS marketing_events_insert ON marketing_events;
CREATE POLICY marketing_events_select ON marketing_events FOR SELECT USING (is_account_member(account_id));
CREATE POLICY marketing_events_insert ON marketing_events FOR INSERT WITH CHECK (is_account_member(account_id, 'agent'));
CREATE INDEX IF NOT EXISTS idx_marketing_events_account_occurred ON marketing_events(account_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketing_events_campaign ON marketing_events(account_id, ((attribution->>'campaign')));

CREATE OR REPLACE FUNCTION set_marketing_settings_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS marketing_settings_updated_at ON marketing_settings;
CREATE TRIGGER marketing_settings_updated_at BEFORE UPDATE ON marketing_settings FOR EACH ROW EXECUTE FUNCTION set_marketing_settings_updated_at();
DROP TRIGGER IF EXISTS marketing_connections_updated_at ON marketing_connections;
CREATE TRIGGER marketing_connections_updated_at BEFORE UPDATE ON marketing_connections FOR EACH ROW EXECUTE FUNCTION set_marketing_settings_updated_at();
