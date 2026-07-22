-- External diagnostic links. Tokens are stored as SHA-256 hashes only.
CREATE TABLE IF NOT EXISTS commercial_diagnostic_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  assessment_id UUID REFERENCES commercial_assessments(id) ON DELETE SET NULL,
  token_hash TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL DEFAULT 'Diagnóstico empresarial',
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'open',
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  CONSTRAINT commercial_diagnostic_forms_status_check CHECK (status IN ('open','submitted','closed','expired'))
);
CREATE TABLE IF NOT EXISTS commercial_diagnostic_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID NOT NULL REFERENCES commercial_diagnostic_forms(id) ON DELETE CASCADE,
  respondent_name TEXT,
  respondent_email TEXT,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  source TEXT NOT NULL DEFAULT 'external_form',
  review_status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  project_id UUID REFERENCES consulting_projects(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT commercial_diagnostic_responses_review_check CHECK (review_status IN ('pending','accepted','rejected'))
);
CREATE INDEX IF NOT EXISTS commercial_diagnostic_forms_account_idx ON commercial_diagnostic_forms(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS commercial_diagnostic_responses_form_idx ON commercial_diagnostic_responses(form_id, created_at DESC);
ALTER TABLE commercial_diagnostic_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE commercial_diagnostic_responses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS diagnostic_forms_account ON commercial_diagnostic_forms;
CREATE POLICY diagnostic_forms_account ON commercial_diagnostic_forms FOR ALL USING (account_id = public.current_account_id()) WITH CHECK (account_id = public.current_account_id());
DROP POLICY IF EXISTS diagnostic_responses_account ON commercial_diagnostic_responses;
CREATE POLICY diagnostic_responses_account ON commercial_diagnostic_responses FOR ALL USING (EXISTS (SELECT 1 FROM commercial_diagnostic_forms f WHERE f.id = form_id AND f.account_id = public.current_account_id())) WITH CHECK (EXISTS (SELECT 1 FROM commercial_diagnostic_forms f WHERE f.id = form_id AND f.account_id = public.current_account_id()));
