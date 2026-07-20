-- Knowledge Base foundation. Text-only, account-scoped, no clinical data.
CREATE TABLE IF NOT EXISTS knowledge_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  title TEXT NOT NULL, description TEXT, source_type TEXT NOT NULL DEFAULT 'manual', source_uri TEXT,
  mime_type TEXT, status TEXT NOT NULL DEFAULT 'draft', checksum TEXT, metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  current_version_id UUID, deleted_at TIMESTAMPTZ, created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT knowledge_documents_status_check CHECK (status IN ('draft','active','archived','error')),
  CONSTRAINT knowledge_documents_source_check CHECK (source_type IN ('manual','upload','transcription','pdf','playbook','internal'))
);
CREATE TABLE IF NOT EXISTS knowledge_document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE, version_number INTEGER NOT NULL,
  content TEXT NOT NULL, checksum TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'ready', metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (document_id, version_number), UNIQUE (account_id, checksum),
  CONSTRAINT knowledge_versions_status_check CHECK (status IN ('pending','processing','ready','error','archived'))
);
CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
  version_id UUID NOT NULL REFERENCES knowledge_document_versions(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL, content TEXT NOT NULL, checksum TEXT NOT NULL, token_count INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb, embedding JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (version_id, chunk_index), UNIQUE (version_id, checksum)
);
CREATE TABLE IF NOT EXISTS knowledge_ingestion_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
  version_id UUID REFERENCES knowledge_document_versions(id) ON DELETE SET NULL,
  idempotency_key TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'queued', attempts INTEGER NOT NULL DEFAULT 0,
  error_code TEXT, error_message TEXT, requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ, completed_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (account_id, idempotency_key),
  CONSTRAINT knowledge_jobs_status_check CHECK (status IN ('queued','processing','completed','failed','cancelled'))
);
CREATE TABLE IF NOT EXISTS knowledge_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  document_id UUID REFERENCES knowledge_documents(id) ON DELETE SET NULL, actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id UUID, metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE knowledge_documents ADD CONSTRAINT knowledge_documents_current_version_fk FOREIGN KEY (current_version_id) REFERENCES knowledge_document_versions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_kb_documents_account_status ON knowledge_documents(account_id,status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kb_versions_account_document ON knowledge_document_versions(account_id,document_id,version_number DESC);
CREATE INDEX IF NOT EXISTS idx_kb_chunks_account_version ON knowledge_chunks(account_id,version_id,chunk_index);
CREATE INDEX IF NOT EXISTS idx_kb_jobs_account_status ON knowledge_ingestion_jobs(account_id,status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kb_audit_account_created ON knowledge_audit_logs(account_id,created_at DESC);
ALTER TABLE knowledge_documents ENABLE ROW LEVEL SECURITY; ALTER TABLE knowledge_document_versions ENABLE ROW LEVEL SECURITY; ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY; ALTER TABLE knowledge_ingestion_jobs ENABLE ROW LEVEL SECURITY; ALTER TABLE knowledge_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY kb_documents_select ON knowledge_documents FOR SELECT USING (is_account_member(account_id));
CREATE POLICY kb_documents_write ON knowledge_documents FOR INSERT WITH CHECK (is_account_member(account_id,'admin'));
CREATE POLICY kb_documents_update ON knowledge_documents FOR UPDATE USING (is_account_member(account_id,'admin')) WITH CHECK (is_account_member(account_id,'admin'));
CREATE POLICY kb_documents_delete ON knowledge_documents FOR DELETE USING (is_account_member(account_id,'owner'));
CREATE POLICY kb_versions_select ON knowledge_document_versions FOR SELECT USING (is_account_member(account_id));
CREATE POLICY kb_versions_write ON knowledge_document_versions FOR INSERT WITH CHECK (is_account_member(account_id,'admin'));
CREATE POLICY kb_versions_update ON knowledge_document_versions FOR UPDATE USING (is_account_member(account_id,'admin')) WITH CHECK (is_account_member(account_id,'admin'));
CREATE POLICY kb_chunks_select ON knowledge_chunks FOR SELECT USING (is_account_member(account_id));
CREATE POLICY kb_chunks_write ON knowledge_chunks FOR INSERT WITH CHECK (is_account_member(account_id,'admin'));
CREATE POLICY kb_jobs_select ON knowledge_ingestion_jobs FOR SELECT USING (is_account_member(account_id));
CREATE POLICY kb_jobs_write ON knowledge_ingestion_jobs FOR INSERT WITH CHECK (is_account_member(account_id,'admin'));
CREATE POLICY kb_jobs_update ON knowledge_ingestion_jobs FOR UPDATE USING (is_account_member(account_id,'admin')) WITH CHECK (is_account_member(account_id,'admin'));
CREATE POLICY kb_audit_select ON knowledge_audit_logs FOR SELECT USING (is_account_member(account_id));
CREATE POLICY kb_audit_write ON knowledge_audit_logs FOR INSERT WITH CHECK (is_account_member(account_id,'admin'));
COMMENT ON TABLE knowledge_documents IS 'Text knowledge only; never store clinical records, diagnoses, prescriptions or patient images.';
