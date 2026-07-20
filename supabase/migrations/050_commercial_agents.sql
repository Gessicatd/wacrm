-- Commercial agents: governed, account-scoped orchestration for the G2Dois method.
-- This migration stores configuration and audit metadata only. It does not
-- execute an external AI provider or ingest clinical data.

CREATE TABLE IF NOT EXISTS commercial_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  agent_key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  autonomy_mode TEXT NOT NULL DEFAULT 'suggest',
  allowed_tools JSONB NOT NULL DEFAULT '[]'::jsonb,
  approval_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  knowledge_scopes JSONB NOT NULL DEFAULT '[]'::jsonb,
  prompt_version TEXT NOT NULL DEFAULT 'v1',
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (account_id, agent_key),
  CONSTRAINT commercial_agents_status_check CHECK (status IN ('draft', 'ready', 'active', 'paused')),
  CONSTRAINT commercial_agents_autonomy_check CHECK (autonomy_mode IN ('suggest', 'approved_execution', 'automatic'))
);

CREATE TABLE IF NOT EXISTS commercial_agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES commercial_agents(id) ON DELETE CASCADE,
  trigger TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  input_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  output_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_code TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT commercial_agent_runs_status_check CHECK (status IN ('queued', 'running', 'waiting_approval', 'completed', 'failed', 'cancelled'))
);

CREATE TABLE IF NOT EXISTS commercial_agent_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  run_id UUID NOT NULL REFERENCES commercial_agent_runs(id) ON DELETE CASCADE,
  action_key TEXT NOT NULL,
  action_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'proposed',
  requires_approval BOOLEAN NOT NULL DEFAULT TRUE,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  payload_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  result_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT commercial_agent_actions_status_check CHECK (status IN ('proposed', 'approved', 'executed', 'rejected', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_commercial_agents_account ON commercial_agents(account_id, status);
CREATE INDEX IF NOT EXISTS idx_commercial_agent_runs_account ON commercial_agent_runs(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_commercial_agent_actions_account ON commercial_agent_actions(account_id, created_at DESC);

ALTER TABLE commercial_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE commercial_agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE commercial_agent_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS commercial_agents_select ON commercial_agents;
CREATE POLICY commercial_agents_select ON commercial_agents FOR SELECT USING (is_account_member(account_id));
DROP POLICY IF EXISTS commercial_agents_write ON commercial_agents;
CREATE POLICY commercial_agents_write ON commercial_agents FOR ALL USING (is_account_member(account_id, 'admin')) WITH CHECK (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS commercial_agent_runs_select ON commercial_agent_runs;
CREATE POLICY commercial_agent_runs_select ON commercial_agent_runs FOR SELECT USING (is_account_member(account_id));
DROP POLICY IF EXISTS commercial_agent_runs_write ON commercial_agent_runs;
CREATE POLICY commercial_agent_runs_write ON commercial_agent_runs FOR INSERT WITH CHECK (is_account_member(account_id, 'agent'));

DROP POLICY IF EXISTS commercial_agent_actions_select ON commercial_agent_actions;
CREATE POLICY commercial_agent_actions_select ON commercial_agent_actions FOR SELECT USING (is_account_member(account_id));
DROP POLICY IF EXISTS commercial_agent_actions_write ON commercial_agent_actions;
CREATE POLICY commercial_agent_actions_write ON commercial_agent_actions FOR INSERT WITH CHECK (is_account_member(account_id, 'agent'));
DROP POLICY IF EXISTS commercial_agent_actions_approve ON commercial_agent_actions;
CREATE POLICY commercial_agent_actions_approve ON commercial_agent_actions FOR UPDATE USING (is_account_member(account_id, 'admin')) WITH CHECK (is_account_member(account_id, 'admin'));

COMMENT ON TABLE commercial_agents IS 'Governed commercial agents. No clinical records or patient data belong here.';
COMMENT ON TABLE commercial_agent_actions IS 'Auditable proposed and approved actions produced by commercial agents.';
