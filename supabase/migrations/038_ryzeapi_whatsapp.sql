-- ============================================================
-- 038_ryzeapi_whatsapp.sql — RyzeAPI WhatsApp Provider
--
-- Adds RyzeAPI as an alternative WhatsApp transport provider.
-- When configured, messages from the RyzeAPI webhook arrive
-- directly; outbound sends route through the RyzeAPI REST API
-- instead of Meta's Cloud API. Both providers can coexist on
-- the same account — each conversation remembers which provider
-- created it (conversations.provider) and sends follow its origin.
-- ============================================================

-- ============================================================
-- 1. CONVERSATIONS — track which provider created the thread
-- ============================================================
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS provider TEXT
    CHECK (provider IN ('meta', 'ryzeapi'));

DROP INDEX IF EXISTS idx_conversations_provider;
CREATE INDEX IF NOT EXISTS idx_conversations_provider
  ON conversations(account_id, provider);

-- Backfill: conversations with channel='whatsapp' that pre-date
-- this migration default to Meta (the only provider available).
UPDATE conversations
   SET provider = 'meta'
 WHERE channel = 'whatsapp'
   AND provider IS NULL;

-- Instagram conversations don't use this column; leave them NULL.
-- No default constraint — new rows created by a webhook MUST
-- explicitly set provider so we never guess.

-- ============================================================
-- 2. RYZEAPI_CONFIG — one per account
-- ============================================================
CREATE TABLE IF NOT EXISTS ryzeapi_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Connection credentials (api_token encrypted with GCM, same
  -- encrypt()/decrypt() as whatsapp_config.access_token).
  api_url TEXT NOT NULL,
  api_token TEXT NOT NULL,

  -- Instance identity on the RyzeAPI server. Creating an instance
  -- returns a token we use for all subsequent calls (send, webhook
  -- config, etc.).
  instance_name TEXT NOT NULL,
  instance_token TEXT NOT NULL,

  -- Connection state tracking.
  status TEXT NOT NULL DEFAULT 'disconnected'
    CHECK (status IN ('connected', 'disconnected', 'pending_qr')),

  -- QR code displayed to the user while awaiting first pairing.
  qr_base64 TEXT,
  qr_expires_at TIMESTAMPTZ,

  -- Webhook label configured on the RyzeAPI instance.
  webhook_label TEXT DEFAULT 'wacrm',

  -- Timestamps.
  connected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One config per account — mutually exclusive with the global
  -- instance lock.
  UNIQUE(account_id)
);

CREATE INDEX IF NOT EXISTS idx_ryzeapi_config_account
  ON ryzeapi_config(account_id);

-- ============================================================
-- 3. RLS — same pattern as whatsapp_config + instagram_config
-- ============================================================
ALTER TABLE ryzeapi_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ryzeapi_config_select" ON ryzeapi_config;
CREATE POLICY ryzeapi_config_select ON ryzeapi_config
  FOR SELECT USING (is_account_member(account_id));

DROP POLICY IF EXISTS "ryzeapi_config_insert" ON ryzeapi_config;
CREATE POLICY ryzeapi_config_insert ON ryzeapi_config
  FOR INSERT WITH CHECK (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS "ryzeapi_config_update" ON ryzeapi_config;
CREATE POLICY ryzeapi_config_update ON ryzeapi_config
  FOR UPDATE USING (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS "ryzeapi_config_delete" ON ryzeapi_config;
CREATE POLICY ryzeapi_config_delete ON ryzeapi_config
  FOR DELETE USING (is_account_member(account_id, 'admin'));

-- ============================================================
-- 4. UPDATED_AT trigger
-- ============================================================
DROP TRIGGER IF EXISTS set_updated_at ON ryzeapi_config;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON ryzeapi_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 5. REALTIME
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'ryzeapi_config'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE ryzeapi_config;
  END IF;
END $$;
