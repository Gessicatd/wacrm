-- ============================================================
-- 043_healthcare_commercial_system.sql
-- Vertical commercial operating system for high-ticket health,
-- beauty and aesthetics providers.
--
-- Clinical records, diagnoses, images and prescriptions MUST remain
-- in the appropriate clinical system. These fields are commercial.
-- Idempotent and account-scoped.
-- ============================================================

-- Stage governance: every stage can explain what "done" means.
ALTER TABLE pipeline_stages
  ADD COLUMN IF NOT EXISTS entry_criteria TEXT,
  ADD COLUMN IF NOT EXISTS exit_criteria TEXT,
  ADD COLUMN IF NOT EXISTS sla_hours INTEGER,
  ADD COLUMN IF NOT EXISTS probability INTEGER;

ALTER TABLE pipeline_stages DROP CONSTRAINT IF EXISTS pipeline_stages_sla_hours_check;
ALTER TABLE pipeline_stages
  ADD CONSTRAINT pipeline_stages_sla_hours_check
  CHECK (sla_hours IS NULL OR sla_hours > 0);

ALTER TABLE pipeline_stages DROP CONSTRAINT IF EXISTS pipeline_stages_probability_check;
ALTER TABLE pipeline_stages
  ADD CONSTRAINT pipeline_stages_probability_check
  CHECK (probability IS NULL OR probability BETWEEN 0 AND 100);

-- Commercial context and operating controls for each opportunity.
ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS service_name TEXT,
  ADD COLUMN IF NOT EXISTS unit_name TEXT,
  ADD COLUMN IF NOT EXISTS professional_name TEXT,
  ADD COLUMN IF NOT EXISTS source_channel TEXT,
  ADD COLUMN IF NOT EXISTS campaign_name TEXT,
  ADD COLUMN IF NOT EXISTS lead_intent TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS appointment_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS appointment_status TEXT NOT NULL DEFAULT 'not_scheduled',
  ADD COLUMN IF NOT EXISTS forecast_category TEXT NOT NULL DEFAULT 'unclassified',
  ADD COLUMN IF NOT EXISTS next_action TEXT,
  ADD COLUMN IF NOT EXISTS next_action_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_action_channel TEXT,
  ADD COLUMN IF NOT EXISTS objection_code TEXT,
  ADD COLUMN IF NOT EXISTS loss_reason TEXT,
  ADD COLUMN IF NOT EXISTS recycle_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS consent_status TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS consent_source TEXT,
  ADD COLUMN IF NOT EXISTS consent_recorded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS handoff_status TEXT NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS handoff_notes TEXT,
  ADD COLUMN IF NOT EXISTS plan_presented_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS won_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lost_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_stage_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE deals DROP CONSTRAINT IF EXISTS deals_lead_intent_check;
ALTER TABLE deals ADD CONSTRAINT deals_lead_intent_check
  CHECK (lead_intent IN ('unknown', 'low', 'medium', 'high'));

ALTER TABLE deals DROP CONSTRAINT IF EXISTS deals_appointment_status_check;
ALTER TABLE deals ADD CONSTRAINT deals_appointment_status_check
  CHECK (appointment_status IN (
    'not_scheduled', 'scheduled', 'confirmed', 'completed',
    'no_show', 'cancelled', 'rescheduled'
  ));

ALTER TABLE deals DROP CONSTRAINT IF EXISTS deals_forecast_category_check;
ALTER TABLE deals ADD CONSTRAINT deals_forecast_category_check
  CHECK (forecast_category IN ('unclassified', 'commit', 'best_case', 'stretch'));

ALTER TABLE deals DROP CONSTRAINT IF EXISTS deals_consent_status_check;
ALTER TABLE deals ADD CONSTRAINT deals_consent_status_check
  CHECK (consent_status IN ('unknown', 'granted', 'revoked', 'not_required'));

ALTER TABLE deals DROP CONSTRAINT IF EXISTS deals_handoff_status_check;
ALTER TABLE deals ADD CONSTRAINT deals_handoff_status_check
  CHECK (handoff_status IN ('not_started', 'pending', 'complete', 'blocked'));

CREATE INDEX IF NOT EXISTS idx_deals_next_action_at
  ON deals(account_id, next_action_at) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_deals_appointment_at
  ON deals(account_id, appointment_at) WHERE appointment_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deals_forecast
  ON deals(account_id, forecast_category, expected_close_date) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_deals_recycle_at
  ON deals(account_id, recycle_at) WHERE recycle_at IS NOT NULL;

-- Keep lifecycle timestamps reliable even when deals are changed via
-- UI, public API or an automation.
CREATE OR REPLACE FUNCTION public.sync_deal_commercial_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();

  IF TG_OP = 'UPDATE' AND NEW.stage_id IS DISTINCT FROM OLD.stage_id THEN
    NEW.last_stage_changed_at := NOW();
  END IF;

  IF NEW.status = 'won' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'won') THEN
    NEW.won_at := COALESCE(NEW.won_at, NOW());
    NEW.lost_at := NULL;
    IF NEW.handoff_status = 'not_started' THEN
      NEW.handoff_status := 'pending';
    END IF;
  ELSIF NEW.status = 'lost' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'lost') THEN
    NEW.lost_at := COALESCE(NEW.lost_at, NOW());
    NEW.won_at := NULL;
  ELSIF NEW.status = 'open' THEN
    NEW.won_at := NULL;
    NEW.lost_at := NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_deal_commercial_timestamps ON deals;
CREATE TRIGGER trg_sync_deal_commercial_timestamps
  BEFORE INSERT OR UPDATE ON deals
  FOR EACH ROW EXECUTE FUNCTION public.sync_deal_commercial_timestamps();

-- One structured profile per account, generated by onboarding and
-- reviewed by the owner/manager before automation activation.
CREATE TABLE IF NOT EXISTS commercial_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
  business_name TEXT,
  specialty TEXT,
  primary_offer TEXT,
  ideal_customer_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  disqualifiers JSONB NOT NULL DEFAULT '[]'::jsonb,
  commercial_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  automation_boundaries JSONB NOT NULL DEFAULT '[]'::jsonb,
  tone_of_voice JSONB NOT NULL DEFAULT '{}'::jsonb,
  monthly_capacity INTEGER,
  target_90_days TEXT,
  onboarding_status TEXT NOT NULL DEFAULT 'draft',
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT commercial_profiles_status_check
    CHECK (onboarding_status IN ('draft', 'needs_evidence', 'ready', 'approved')),
  CONSTRAINT commercial_profiles_capacity_check
    CHECK (monthly_capacity IS NULL OR monthly_capacity >= 0)
);

CREATE TABLE IF NOT EXISTS commercial_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  submitted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  respondent_role TEXT,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  dimension_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  overall_score INTEGER,
  priority TEXT,
  evidence_status JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT commercial_assessments_score_check
    CHECK (overall_score IS NULL OR overall_score BETWEEN 0 AND 100)
);

CREATE INDEX IF NOT EXISTS idx_commercial_assessments_account_created
  ON commercial_assessments(account_id, created_at DESC);

ALTER TABLE commercial_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE commercial_assessments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS commercial_profiles_select ON commercial_profiles;
CREATE POLICY commercial_profiles_select ON commercial_profiles FOR SELECT
  USING (is_account_member(account_id));
DROP POLICY IF EXISTS commercial_profiles_insert ON commercial_profiles;
CREATE POLICY commercial_profiles_insert ON commercial_profiles FOR INSERT
  WITH CHECK (is_account_member(account_id, 'admin'));
DROP POLICY IF EXISTS commercial_profiles_update ON commercial_profiles;
CREATE POLICY commercial_profiles_update ON commercial_profiles FOR UPDATE
  USING (is_account_member(account_id, 'admin'))
  WITH CHECK (is_account_member(account_id, 'admin'));
DROP POLICY IF EXISTS commercial_profiles_delete ON commercial_profiles;
CREATE POLICY commercial_profiles_delete ON commercial_profiles FOR DELETE
  USING (is_account_member(account_id, 'owner'));

DROP POLICY IF EXISTS commercial_assessments_select ON commercial_assessments;
CREATE POLICY commercial_assessments_select ON commercial_assessments FOR SELECT
  USING (is_account_member(account_id));
DROP POLICY IF EXISTS commercial_assessments_insert ON commercial_assessments;
CREATE POLICY commercial_assessments_insert ON commercial_assessments FOR INSERT
  WITH CHECK (is_account_member(account_id, 'admin'));
DROP POLICY IF EXISTS commercial_assessments_update ON commercial_assessments;
CREATE POLICY commercial_assessments_update ON commercial_assessments FOR UPDATE
  USING (is_account_member(account_id, 'admin'))
  WITH CHECK (is_account_member(account_id, 'admin'));
DROP POLICY IF EXISTS commercial_assessments_delete ON commercial_assessments;
CREATE POLICY commercial_assessments_delete ON commercial_assessments FOR DELETE
  USING (is_account_member(account_id, 'owner'));

COMMENT ON TABLE commercial_profiles IS
  'Commercial onboarding only. Do not store clinical records, diagnoses, prescriptions or patient images.';
COMMENT ON COLUMN deals.handoff_notes IS
  'Commercial delivery context only; never copy clinical records into this field.';

