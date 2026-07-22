-- Kommo contact import. Credentials are encrypted at application level.
CREATE TABLE IF NOT EXISTS kommo_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  subdomain TEXT NOT NULL, label TEXT NOT NULL DEFAULT 'Kommo', encrypted_access_token TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'configured', last_import_at TIMESTAMPTZ, metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(account_id, subdomain), CONSTRAINT kommo_connections_status_check CHECK (status IN ('configured','connected','paused','error'))
);
CREATE TABLE IF NOT EXISTS kommo_import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES kommo_connections(id) ON DELETE CASCADE, status TEXT NOT NULL DEFAULT 'queued',
  resources JSONB NOT NULL DEFAULT '["contacts"]'::jsonb, totals JSONB NOT NULL DEFAULT '{}'::jsonb, error TEXT,
  started_at TIMESTAMPTZ, finished_at TIMESTAMPTZ, created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT kommo_import_jobs_status_check CHECK (status IN ('queued','running','completed','failed','cancelled'))
);
CREATE TABLE IF NOT EXISTS kommo_import_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  job_id UUID REFERENCES kommo_import_jobs(id) ON DELETE SET NULL, resource_type TEXT NOT NULL, external_id TEXT NOT NULL,
  local_id UUID REFERENCES contacts(id) ON DELETE SET NULL, payload_hash TEXT, status TEXT NOT NULL DEFAULT 'imported', error TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(account_id, resource_type, external_id), CONSTRAINT kommo_import_records_status_check CHECK (status IN ('imported','skipped','failed'))
);
CREATE INDEX IF NOT EXISTS idx_kommo_connections_account ON kommo_connections(account_id);
CREATE INDEX IF NOT EXISTS idx_kommo_import_jobs_account ON kommo_import_jobs(account_id, created_at DESC);
ALTER TABLE kommo_connections ENABLE ROW LEVEL SECURITY; ALTER TABLE kommo_import_jobs ENABLE ROW LEVEL SECURITY; ALTER TABLE kommo_import_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS kommo_connections_account ON kommo_connections; CREATE POLICY kommo_connections_account ON kommo_connections FOR ALL USING (is_account_member(account_id, 'admin')) WITH CHECK (is_account_member(account_id, 'admin'));
DROP POLICY IF EXISTS kommo_jobs_account ON kommo_import_jobs; CREATE POLICY kommo_jobs_account ON kommo_import_jobs FOR ALL USING (is_account_member(account_id, 'viewer')) WITH CHECK (is_account_member(account_id, 'admin'));
DROP POLICY IF EXISTS kommo_records_account ON kommo_import_records; CREATE POLICY kommo_records_account ON kommo_import_records FOR SELECT USING (is_account_member(account_id, 'viewer'));
