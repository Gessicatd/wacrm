-- Account-scoped research evidence supplied by authorized users.
-- Never stores credentials, authorization headers or provider tokens.

CREATE TABLE IF NOT EXISTS consulting_research_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES consulting_projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'other',
  reference TEXT,
  excerpt TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT consulting_research_sources_type_check CHECK (source_type IN ('website', 'ad', 'proposal', 'interview', 'transcript', 'report', 'internal', 'other')),
  CONSTRAINT consulting_research_sources_status_check CHECK (status IN ('active', 'archived')),
  CONSTRAINT consulting_research_sources_title_length CHECK (char_length(title) BETWEEN 1 AND 240),
  CONSTRAINT consulting_research_sources_excerpt_length CHECK (char_length(excerpt) BETWEEN 1 AND 4000)
);

CREATE INDEX IF NOT EXISTS idx_consulting_research_sources_project
  ON consulting_research_sources(account_id, project_id, created_at DESC)
  WHERE status = 'active';

ALTER TABLE consulting_research_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS consulting_research_sources_select ON consulting_research_sources;
CREATE POLICY consulting_research_sources_select ON consulting_research_sources
  FOR SELECT USING (is_account_member(account_id));

DROP POLICY IF EXISTS consulting_research_sources_insert ON consulting_research_sources;
CREATE POLICY consulting_research_sources_insert ON consulting_research_sources
  FOR INSERT WITH CHECK (is_account_member(account_id, 'agent') AND created_by = auth.uid());

DROP POLICY IF EXISTS consulting_research_sources_update ON consulting_research_sources;
CREATE POLICY consulting_research_sources_update ON consulting_research_sources
  FOR UPDATE USING (is_account_member(account_id, 'agent'))
  WITH CHECK (is_account_member(account_id, 'agent'));

COMMENT ON TABLE consulting_research_sources IS 'Authorized research excerpts. Credentials, tokens, cookies and sensitive personal data are forbidden.';
