-- 058_payments_core.sql — account-scoped payment foundation
-- Providers are adapters; secrets are never stored in these tables.

CREATE TABLE IF NOT EXISTS payment_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('pix_direct', 'gateway')),
  provider_key TEXT NOT NULL CHECK (provider_key ~ '^[a-z0-9_:-]{2,80}$'),
  display_name TEXT NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 120),
  status TEXT NOT NULL DEFAULT 'not_configured' CHECK (status IN ('not_configured', 'sandbox', 'active', 'disabled')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_id, kind, provider_key)
);

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  provider_id UUID REFERENCES payment_providers(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  external_reference TEXT NOT NULL CHECK (char_length(external_reference) BETWEEN 1 AND 180),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0 AND amount_cents <= 100000000),
  currency TEXT NOT NULL DEFAULT 'BRL' CHECK (currency = 'BRL'),
  description TEXT NOT NULL CHECK (char_length(description) BETWEEN 1 AND 500),
  method TEXT NOT NULL CHECK (method IN ('pix', 'gateway')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'expired', 'cancelled', 'refunded', 'failed')),
  provider_payment_id TEXT,
  checkout_url TEXT,
  pix_copy_paste TEXT,
  expires_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_id, external_reference)
);

CREATE TABLE IF NOT EXISTS payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES payments(id) ON DELETE CASCADE,
  provider_key TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('created', 'paid', 'expired', 'cancelled', 'refunded', 'failed')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_id, provider_key, idempotency_key)
);

CREATE INDEX IF NOT EXISTS payment_providers_account_idx ON payment_providers(account_id, kind, status);
CREATE INDEX IF NOT EXISTS payments_account_status_idx ON payments(account_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS payments_contact_idx ON payments(account_id, contact_id, created_at DESC);
CREATE INDEX IF NOT EXISTS payment_events_payment_idx ON payment_events(account_id, payment_id, received_at DESC);

ALTER TABLE payment_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_providers_select ON payment_providers;
CREATE POLICY payment_providers_select ON payment_providers FOR SELECT USING (is_account_member(account_id));
DROP POLICY IF EXISTS payment_providers_manage ON payment_providers;
CREATE POLICY payment_providers_manage ON payment_providers FOR ALL USING (is_account_member(account_id, 'admin')) WITH CHECK (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS payments_select ON payments;
CREATE POLICY payments_select ON payments FOR SELECT USING (is_account_member(account_id));
DROP POLICY IF EXISTS payments_manage ON payments;
CREATE POLICY payments_manage ON payments FOR ALL USING (is_account_member(account_id, 'admin')) WITH CHECK (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS payment_events_select ON payment_events;
CREATE POLICY payment_events_select ON payment_events FOR SELECT USING (is_account_member(account_id));

COMMENT ON TABLE payment_providers IS 'Payment adapters per account. Secrets belong in encrypted server configuration, never here.';
COMMENT ON TABLE payments IS 'Idempotent account-scoped payment intents and normalized provider status.';
COMMENT ON TABLE payment_events IS 'Sanitized provider events used for idempotent reconciliation and audit.';
