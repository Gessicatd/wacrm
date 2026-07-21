-- Consulting Methodology Engine foundation.
-- Account-scoped, auditable and intentionally free of clinical/patient data.

CREATE TABLE IF NOT EXISTS consulting_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  objective TEXT,
  scope JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft',
  methodology_id UUID,
  current_phase TEXT,
  start_date DATE,
  target_end_date DATE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT consulting_projects_status_check CHECK (status IN ('draft', 'active', 'paused', 'completed', 'archived'))
);

CREATE TABLE IF NOT EXISTS consulting_methodologies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  source_type TEXT NOT NULL DEFAULT 'internal',
  source_reference TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT consulting_methodologies_status_check CHECK (status IN ('draft', 'review', 'published', 'archived')),
  CONSTRAINT consulting_methodologies_source_check CHECK (source_type IN ('internal', 'course', 'document', 'pdf', 'transcription', 'site', 'template', 'project'))
);

ALTER TABLE consulting_projects
  DROP CONSTRAINT IF EXISTS consulting_projects_methodology_fk;
ALTER TABLE consulting_projects
  ADD CONSTRAINT consulting_projects_methodology_fk FOREIGN KEY (methodology_id) REFERENCES consulting_methodologies(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS consulting_methodology_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  methodology_id UUID NOT NULL REFERENCES consulting_methodologies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  objective TEXT,
  sequence INTEGER NOT NULL,
  inputs_required JSONB NOT NULL DEFAULT '[]'::jsonb,
  outputs_expected JSONB NOT NULL DEFAULT '[]'::jsonb,
  rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  dependencies JSONB NOT NULL DEFAULT '[]'::jsonb,
  validation_criteria JSONB NOT NULL DEFAULT '[]'::jsonb,
  human_review_required BOOLEAN NOT NULL DEFAULT TRUE,
  execution_type TEXT NOT NULL DEFAULT 'hybrid',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT consulting_steps_execution_type_check CHECK (execution_type IN ('manual', 'automated', 'agent', 'workflow', 'hybrid')),
  UNIQUE (methodology_id, sequence)
);

CREATE TABLE IF NOT EXISTS consulting_agent_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  agent_key TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  objective TEXT NOT NULL,
  instructions TEXT NOT NULL DEFAULT '',
  allowed_tools JSONB NOT NULL DEFAULT '[]'::jsonb,
  required_inputs JSONB NOT NULL DEFAULT '[]'::jsonb,
  expected_output_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  validation_rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  model_configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT consulting_agent_definitions_status_check CHECK (status IN ('draft', 'ready', 'active', 'paused', 'archived')),
  UNIQUE (account_id, agent_key, version)
);

CREATE TABLE IF NOT EXISTS consulting_workflow_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trigger_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
  retries INTEGER NOT NULL DEFAULT 2,
  timeout_seconds INTEGER NOT NULL DEFAULT 900,
  dependencies JSONB NOT NULL DEFAULT '[]'::jsonb,
  output_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT consulting_workflows_status_check CHECK (status IN ('draft', 'published', 'paused', 'archived')),
  CONSTRAINT consulting_workflows_retries_check CHECK (retries BETWEEN 0 AND 10),
  CONSTRAINT consulting_workflows_timeout_check CHECK (timeout_seconds BETWEEN 1 AND 86400),
  UNIQUE (account_id, name, version)
);

CREATE TABLE IF NOT EXISTS consulting_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES consulting_projects(id) ON DELETE CASCADE,
  methodology_id UUID REFERENCES consulting_methodologies(id) ON DELETE SET NULL,
  step_id UUID REFERENCES consulting_methodology_steps(id) ON DELETE SET NULL,
  agent_id UUID REFERENCES consulting_agent_definitions(id) ON DELETE SET NULL,
  workflow_id UUID REFERENCES consulting_workflow_definitions(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  input JSONB NOT NULL DEFAULT '{}'::jsonb,
  output JSONB NOT NULL DEFAULT '{}'::jsonb,
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  retry_count INTEGER NOT NULL DEFAULT 0,
  model_used TEXT,
  token_usage JSONB NOT NULL DEFAULT '{}'::jsonb,
  estimated_cost NUMERIC(12, 6),
  error TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT consulting_executions_status_check CHECK (status IN ('queued', 'running', 'waiting_review', 'completed', 'failed', 'cancelled')),
  CONSTRAINT consulting_executions_retry_check CHECK (retry_count >= 0)
);

CREATE TABLE IF NOT EXISTS consulting_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES consulting_projects(id) ON DELETE CASCADE,
  execution_id UUID REFERENCES consulting_executions(id) ON DELETE SET NULL,
  artifact_type TEXT NOT NULL,
  title TEXT NOT NULL,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft',
  version INTEGER NOT NULL DEFAULT 1,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT consulting_artifacts_status_check CHECK (status IN ('draft', 'in_review', 'approved', 'archived')),
  CONSTRAINT consulting_artifacts_type_check CHECK (artifact_type IN ('diagnosis', 'market_research', 'benchmark', 'icp', 'persona', 'swot', 'positioning', 'offer', 'funnel', 'journey', 'strategic_plan', 'kpi_framework', 'action_plan', 'executive_report'))
);

CREATE TABLE IF NOT EXISTS consulting_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES consulting_projects(id) ON DELETE CASCADE,
  artifact_id UUID REFERENCES consulting_artifacts(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  justification TEXT,
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  expected_impact TEXT,
  effort TEXT,
  priority TEXT NOT NULL DEFAULT 'medium',
  risk TEXT,
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'proposed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT consulting_recommendations_priority_check CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  CONSTRAINT consulting_recommendations_status_check CHECK (status IN ('proposed', 'approved', 'in_progress', 'done', 'rejected'))
);

CREATE TABLE IF NOT EXISTS consulting_action_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES consulting_projects(id) ON DELETE CASCADE,
  recommendation_id UUID REFERENCES consulting_recommendations(id) ON DELETE SET NULL,
  objective TEXT,
  initiative TEXT,
  task TEXT NOT NULL,
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  priority TEXT NOT NULL DEFAULT 'medium',
  due_date DATE,
  dependencies JSONB NOT NULL DEFAULT '[]'::jsonb,
  kpi_key TEXT,
  completion_evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'todo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT consulting_action_items_priority_check CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  CONSTRAINT consulting_action_items_status_check CHECK (status IN ('todo', 'in_progress', 'blocked', 'done', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_consulting_projects_account ON consulting_projects(account_id, updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_consulting_methodologies_account ON consulting_methodologies(account_id, updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_consulting_steps_methodology ON consulting_methodology_steps(account_id, methodology_id, sequence);
CREATE INDEX IF NOT EXISTS idx_consulting_agents_account ON consulting_agent_definitions(account_id, status);
CREATE INDEX IF NOT EXISTS idx_consulting_workflows_account ON consulting_workflow_definitions(account_id, status);
CREATE INDEX IF NOT EXISTS idx_consulting_executions_project ON consulting_executions(account_id, project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_consulting_artifacts_project ON consulting_artifacts(account_id, project_id, updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_consulting_recommendations_project ON consulting_recommendations(account_id, project_id, status);
CREATE INDEX IF NOT EXISTS idx_consulting_action_items_project ON consulting_action_items(account_id, project_id, status, due_date);

ALTER TABLE consulting_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE consulting_methodologies ENABLE ROW LEVEL SECURITY;
ALTER TABLE consulting_methodology_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE consulting_agent_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE consulting_workflow_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE consulting_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE consulting_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE consulting_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE consulting_action_items ENABLE ROW LEVEL SECURITY;

-- Read isolation is account-scoped everywhere; writes require admin/agent as appropriate.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['consulting_projects','consulting_methodologies','consulting_methodology_steps','consulting_agent_definitions','consulting_workflow_definitions','consulting_executions','consulting_artifacts','consulting_recommendations','consulting_action_items'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_select ON %I', t, t);
    EXECUTE format('CREATE POLICY %I_select ON %I FOR SELECT USING (is_account_member(account_id))', t, t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS consulting_projects_write ON consulting_projects;
CREATE POLICY consulting_projects_write ON consulting_projects FOR ALL USING (is_account_member(account_id, 'admin')) WITH CHECK (is_account_member(account_id, 'admin'));
DROP POLICY IF EXISTS consulting_methodologies_write ON consulting_methodologies;
CREATE POLICY consulting_methodologies_write ON consulting_methodologies FOR ALL USING (is_account_member(account_id, 'admin')) WITH CHECK (is_account_member(account_id, 'admin'));
DROP POLICY IF EXISTS consulting_steps_write ON consulting_methodology_steps;
CREATE POLICY consulting_steps_write ON consulting_methodology_steps FOR ALL USING (is_account_member(account_id, 'admin')) WITH CHECK (is_account_member(account_id, 'admin'));
DROP POLICY IF EXISTS consulting_agents_write ON consulting_agent_definitions;
CREATE POLICY consulting_agents_write ON consulting_agent_definitions FOR ALL USING (is_account_member(account_id, 'admin')) WITH CHECK (is_account_member(account_id, 'admin'));
DROP POLICY IF EXISTS consulting_workflows_write ON consulting_workflow_definitions;
CREATE POLICY consulting_workflows_write ON consulting_workflow_definitions FOR ALL USING (is_account_member(account_id, 'admin')) WITH CHECK (is_account_member(account_id, 'admin'));
DROP POLICY IF EXISTS consulting_executions_write ON consulting_executions;
CREATE POLICY consulting_executions_write ON consulting_executions FOR INSERT WITH CHECK (is_account_member(account_id, 'agent'));
DROP POLICY IF EXISTS consulting_artifacts_write ON consulting_artifacts;
CREATE POLICY consulting_artifacts_write ON consulting_artifacts FOR ALL USING (is_account_member(account_id, 'agent')) WITH CHECK (is_account_member(account_id, 'agent'));
DROP POLICY IF EXISTS consulting_recommendations_write ON consulting_recommendations;
CREATE POLICY consulting_recommendations_write ON consulting_recommendations FOR ALL USING (is_account_member(account_id, 'agent')) WITH CHECK (is_account_member(account_id, 'agent'));
DROP POLICY IF EXISTS consulting_action_items_write ON consulting_action_items;
CREATE POLICY consulting_action_items_write ON consulting_action_items FOR ALL USING (is_account_member(account_id, 'agent')) WITH CHECK (is_account_member(account_id, 'agent'));

COMMENT ON TABLE consulting_projects IS 'Account-scoped consulting projects; do not store clinical or patient records.';
COMMENT ON TABLE consulting_executions IS 'Auditable methodology/agent executions with inputs, outputs and evidence.';
COMMENT ON TABLE consulting_artifacts IS 'Strategic artifacts generated for a project and reviewed before delivery.';
