-- Preserve the strategic decision behind a funnel, not only its stage names.
-- Safe to apply after the existing pipeline migrations; no customer content is stored here.
ALTER TABLE pipelines
  ADD COLUMN IF NOT EXISTS funnel_template_id TEXT,
  ADD COLUMN IF NOT EXISTS funnel_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS strategy_status TEXT NOT NULL DEFAULT 'draft';

ALTER TABLE pipelines DROP CONSTRAINT IF EXISTS pipelines_strategy_status_check;
ALTER TABLE pipelines ADD CONSTRAINT pipelines_strategy_status_check
  CHECK (strategy_status IN ('draft', 'validated', 'active', 'paused', 'archived'));

CREATE INDEX IF NOT EXISTS idx_pipelines_account_funnel_template
  ON pipelines(account_id, funnel_template_id);

COMMENT ON COLUMN pipelines.funnel_metadata IS
  'Versioned architecture snapshot: objective, traffic, assets, dependencies, metrics and message sequence.';
