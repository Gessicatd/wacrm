-- GoHighLevel transition import. Credentials are encrypted at rest and never returned to the browser.
CREATE TABLE IF NOT EXISTS ghl_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  location_id TEXT NOT NULL, label TEXT NOT NULL DEFAULT 'GoHighLevel', encrypted_access_token TEXT,
  status TEXT NOT NULL DEFAULT 'configured', last_import_at TIMESTAMPTZ, metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, location_id), CONSTRAINT ghl_connections_status_check CHECK (status IN ('configured','connected','paused','error'))
);
CREATE TABLE IF NOT EXISTS ghl_import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES ghl_connections(id) ON DELETE CASCADE, status TEXT NOT NULL DEFAULT 'queued',
  resources JSONB NOT NULL DEFAULT '["contacts"]'::jsonb, cursor TEXT, totals JSONB NOT NULL DEFAULT '{}'::jsonb, error TEXT,
  started_at TIMESTAMPTZ, finished_at TIMESTAMPTZ, created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ghl_import_jobs_status_check CHECK (status IN ('queued','running','completed','failed','cancelled'))
);
CREATE TABLE IF NOT EXISTS ghl_import_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES ghl_import_jobs(id) ON DELETE CASCADE, resource_type TEXT NOT NULL, external_id TEXT NOT NULL,
  local_id UUID, payload_hash TEXT, status TEXT NOT NULL DEFAULT 'imported', error TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, resource_type, external_id), CONSTRAINT ghl_import_records_status_check CHECK (status IN ('imported','skipped','failed'))
);
CREATE INDEX IF NOT EXISTS idx_ghl_connections_account ON ghl_connections(account_id);
CREATE INDEX IF NOT EXISTS idx_ghl_import_jobs_account ON ghl_import_jobs(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ghl_import_records_job ON ghl_import_records(account_id, job_id);
ALTER TABLE ghl_connections ENABLE ROW LEVEL SECURITY; ALTER TABLE ghl_import_jobs ENABLE ROW LEVEL SECURITY; ALTER TABLE ghl_import_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ghl_connections_account ON ghl_connections; CREATE POLICY ghl_connections_account ON ghl_connections FOR ALL USING (is_account_member(account_id, 'admin')) WITH CHECK (is_account_member(account_id, 'admin'));
DROP POLICY IF EXISTS ghl_jobs_account ON ghl_import_jobs; CREATE POLICY ghl_jobs_account ON ghl_import_jobs FOR ALL USING (is_account_member(account_id, 'viewer')) WITH CHECK (is_account_member(account_id, 'admin'));
DROP POLICY IF EXISTS ghl_records_account ON ghl_import_records; CREATE POLICY ghl_records_account ON ghl_import_records FOR SELECT USING (is_account_member(account_id, 'viewer'));
