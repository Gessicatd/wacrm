-- Auditable execution transitions and mandatory human review.
-- Stores summaries only; credentials and raw provider secrets are forbidden.

CREATE TABLE IF NOT EXISTS consulting_execution_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  execution_id UUID NOT NULL REFERENCES consulting_executions(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT consulting_execution_events_type_check CHECK (event_type IN ('queued', 'started', 'tool_completed', 'waiting_review', 'approved', 'changes_requested', 'completed', 'failed', 'cancelled'))
);

CREATE TABLE IF NOT EXISTS consulting_artifact_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES consulting_projects(id) ON DELETE CASCADE,
  artifact_id UUID NOT NULL REFERENCES consulting_artifacts(id) ON DELETE CASCADE,
  execution_id UUID REFERENCES consulting_executions(id) ON DELETE SET NULL,
  decision TEXT NOT NULL,
  feedback TEXT,
  reviewed_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT consulting_artifact_reviews_decision_check CHECK (decision IN ('approved', 'changes_requested'))
);

CREATE INDEX IF NOT EXISTS idx_consulting_execution_events_execution ON consulting_execution_events(account_id, execution_id, created_at);
CREATE INDEX IF NOT EXISTS idx_consulting_artifact_reviews_artifact ON consulting_artifact_reviews(account_id, artifact_id, created_at DESC);

ALTER TABLE consulting_execution_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE consulting_artifact_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS consulting_executions_update ON consulting_executions;
CREATE POLICY consulting_executions_update ON consulting_executions FOR UPDATE USING (is_account_member(account_id, 'agent')) WITH CHECK (is_account_member(account_id, 'agent'));

DROP POLICY IF EXISTS consulting_execution_events_select ON consulting_execution_events;
CREATE POLICY consulting_execution_events_select ON consulting_execution_events FOR SELECT USING (is_account_member(account_id));
DROP POLICY IF EXISTS consulting_execution_events_insert ON consulting_execution_events;
CREATE POLICY consulting_execution_events_insert ON consulting_execution_events FOR INSERT WITH CHECK (is_account_member(account_id, 'agent'));

DROP POLICY IF EXISTS consulting_artifact_reviews_select ON consulting_artifact_reviews;
CREATE POLICY consulting_artifact_reviews_select ON consulting_artifact_reviews FOR SELECT USING (is_account_member(account_id));
DROP POLICY IF EXISTS consulting_artifact_reviews_insert ON consulting_artifact_reviews;
CREATE POLICY consulting_artifact_reviews_insert ON consulting_artifact_reviews FOR INSERT WITH CHECK (is_account_member(account_id, 'admin') AND reviewed_by = auth.uid());

DROP POLICY IF EXISTS consulting_artifacts_approve ON consulting_artifacts;
CREATE POLICY consulting_artifacts_approve ON consulting_artifacts FOR UPDATE USING (is_account_member(account_id, 'admin')) WITH CHECK (is_account_member(account_id, 'admin'));

COMMENT ON TABLE consulting_execution_events IS 'Sanitized audit trail. Never store access tokens, cookies, authorization headers or raw secrets.';
COMMENT ON TABLE consulting_artifact_reviews IS 'Human decisions required before strategic artifacts become approved.';
