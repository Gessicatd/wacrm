-- White-label and reseller foundation. No secrets are stored here.
CREATE TABLE IF NOT EXISTS account_branding (
  account_id UUID PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  brand_name TEXT NOT NULL,
  legal_name TEXT,
  logo_url TEXT,
  favicon_url TEXT,
  primary_color TEXT,
  support_email TEXT,
  support_url TEXT,
  custom_domain TEXT,
  terms_url TEXT,
  privacy_url TEXT,
  industry_profile TEXT NOT NULL DEFAULT 'other',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT account_branding_industry_check CHECK (industry_profile IN ('healthcare','professional_services','consulting','education','other'))
);
CREATE TABLE IF NOT EXISTS reseller_licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  customer_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  plan_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'trial',
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  seat_limit INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT reseller_license_status_check CHECK (status IN ('trial','active','suspended','expired','cancelled')),
  CONSTRAINT reseller_license_accounts_differ CHECK (reseller_account_id <> customer_account_id),
  UNIQUE (reseller_account_id, customer_account_id)
);
ALTER TABLE account_branding ENABLE ROW LEVEL SECURITY;
ALTER TABLE reseller_licenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS account_branding_select ON account_branding;
CREATE POLICY account_branding_select ON account_branding FOR SELECT USING (is_account_member(account_id));
DROP POLICY IF EXISTS account_branding_write ON account_branding;
CREATE POLICY account_branding_write ON account_branding FOR ALL USING (is_account_member(account_id, 'admin')) WITH CHECK (is_account_member(account_id, 'admin'));
DROP POLICY IF EXISTS reseller_licenses_select ON reseller_licenses;
CREATE POLICY reseller_licenses_select ON reseller_licenses FOR SELECT USING (is_account_member(reseller_account_id, 'admin') OR is_account_member(customer_account_id, 'admin'));
DROP POLICY IF EXISTS reseller_licenses_write ON reseller_licenses;
CREATE POLICY reseller_licenses_write ON reseller_licenses FOR ALL USING (is_account_member(reseller_account_id, 'admin')) WITH CHECK (is_account_member(reseller_account_id, 'admin'));
COMMENT ON TABLE account_branding IS 'White-label identity per customer account. URLs only; credentials and secrets are forbidden.';
COMMENT ON TABLE reseller_licenses IS 'Account-scoped reseller licenses. Billing provider secrets do not belong here.';
