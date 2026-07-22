-- 060_harden_payment_provider_rls.sql
-- Payment provider rows contain encrypted credential material. Only admins
-- may read or manage them; operational roles use payments without access to
-- provider configuration.

DROP POLICY IF EXISTS payment_providers_select ON payment_providers;
CREATE POLICY payment_providers_select ON payment_providers FOR SELECT USING (is_account_member(account_id, 'admin'));
