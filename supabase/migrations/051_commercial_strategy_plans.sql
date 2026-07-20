-- Versioned, account-scoped strategic plans generated from commercial assessments.
-- Plans are commercial artifacts; never store clinical records here.

CREATE TABLE IF NOT EXISTS commercial_strategy_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  assessment_id UUID REFERENCES commercial_assessments(id) ON DELETE SET NULL,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft',
  plan JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT commercial_strategy_plans_status_check CHECK (status IN ('draft', 'in_review', 'approved', 'archived')),
  UNIQUE (account_id, version)
);

CREATE INDEX IF NOT EXISTS idx_commercial_strategy_plans_account ON commercial_strategy_plans(account_id, created_at DESC);
ALTER TABLE commercial_strategy_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS commercial_strategy_plans_select ON commercial_strategy_plans;
CREATE POLICY commercial_strategy_plans_select ON commercial_strategy_plans FOR SELECT USING (is_account_member(account_id));
DROP POLICY IF EXISTS commercial_strategy_plans_insert ON commercial_strategy_plans;
CREATE POLICY commercial_strategy_plans_insert ON commercial_strategy_plans FOR INSERT WITH CHECK (is_account_member(account_id, 'admin'));
DROP POLICY IF EXISTS commercial_strategy_plans_update ON commercial_strategy_plans;
CREATE POLICY commercial_strategy_plans_update ON commercial_strategy_plans FOR UPDATE USING (is_account_member(account_id, 'admin')) WITH CHECK (is_account_member(account_id, 'admin'));
DROP POLICY IF EXISTS commercial_strategy_plans_archive ON commercial_strategy_plans;
CREATE POLICY commercial_strategy_plans_archive ON commercial_strategy_plans FOR DELETE USING (is_account_member(account_id, 'owner'));

COMMENT ON TABLE commercial_strategy_plans IS 'Versioned commercial plans. Excludes clinical records and patient data.';
