-- Granular module permissions layered on top of account roles.
-- Role remains the coarse safety boundary; these rows let an owner/admin
-- choose what each teammate can view, edit or approve.

CREATE TABLE IF NOT EXISTS account_module_permissions (
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module TEXT NOT NULL,
  can_view BOOLEAN NOT NULL DEFAULT FALSE,
  can_edit BOOLEAN NOT NULL DEFAULT FALSE,
  can_approve BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (account_id, user_id, module),
  CONSTRAINT account_module_permissions_module_check CHECK (module IN ('client', 'commercial', 'marketing', 'automation', 'knowledge', 'reports', 'settings')),
  CONSTRAINT account_module_permissions_edit_implies_view CHECK (NOT can_edit OR can_view),
  CONSTRAINT account_module_permissions_approve_implies_edit CHECK (NOT can_approve OR can_edit)
);

CREATE INDEX IF NOT EXISTS idx_account_module_permissions_user ON account_module_permissions(account_id, user_id);
ALTER TABLE account_module_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS account_module_permissions_select ON account_module_permissions;
CREATE POLICY account_module_permissions_select ON account_module_permissions FOR SELECT USING (is_account_member(account_id));
DROP POLICY IF EXISTS account_module_permissions_write ON account_module_permissions;
CREATE POLICY account_module_permissions_write ON account_module_permissions FOR ALL USING (is_account_member(account_id, 'admin')) WITH CHECK (is_account_member(account_id, 'admin'));

CREATE OR REPLACE FUNCTION public.has_account_module_permission(
  p_account_id UUID,
  p_user_id UUID,
  p_module TEXT,
  p_action TEXT DEFAULT 'view'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role account_role_enum;
  v_allowed BOOLEAN;
BEGIN
  SELECT account_role INTO v_role FROM profiles WHERE account_id = p_account_id AND user_id = p_user_id;
  IF v_role IS NULL THEN RETURN FALSE; END IF;
  IF v_role IN ('owner', 'admin') THEN RETURN TRUE; END IF;
  SELECT CASE p_action WHEN 'edit' THEN can_edit WHEN 'approve' THEN can_approve ELSE can_view END
    INTO v_allowed FROM account_module_permissions
    WHERE account_id = p_account_id AND user_id = p_user_id AND module = p_module;
  RETURN COALESCE(v_allowed, FALSE);
END;
$$;

ALTER FUNCTION public.has_account_module_permission(UUID, UUID, TEXT, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.has_account_module_permission(UUID, UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_account_module_permission(UUID, UUID, TEXT, TEXT) TO authenticated, service_role;

COMMENT ON TABLE account_module_permissions IS 'Optional module-level visibility and action controls for account members.';
