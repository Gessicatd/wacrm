-- Sensitive credential isolation. Ciphertext is still sensitive: an attacker
-- must not be able to read it and attempt offline key guessing.
DO $$
BEGIN
  IF to_regclass('public.calendar_connections') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Members can view calendar connections" ON public.calendar_connections;
    CREATE POLICY "Admins can view calendar connections" ON public.calendar_connections
      FOR SELECT USING (is_account_member(account_id, 'admin'));
  END IF;
  IF to_regclass('public.webhook_endpoints') IS NOT NULL THEN
    DROP POLICY IF EXISTS webhook_endpoints_select ON public.webhook_endpoints;
    CREATE POLICY webhook_endpoints_select ON public.webhook_endpoints
      FOR SELECT USING (is_account_member(account_id, 'admin'));
  END IF;
  IF to_regclass('public.instagram_config') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Members can view instagram config" ON public.instagram_config;
    DROP POLICY IF EXISTS instagram_config_select ON public.instagram_config;
    CREATE POLICY instagram_config_select ON public.instagram_config
      FOR SELECT USING (is_account_member(account_id, 'admin'));
  END IF;
  IF to_regclass('public.whatsapp_config') IS NOT NULL THEN
    DROP POLICY IF EXISTS whatsapp_config_select ON public.whatsapp_config;
    DROP POLICY IF EXISTS "Members can view whatsapp config" ON public.whatsapp_config;
    CREATE POLICY whatsapp_config_select ON public.whatsapp_config
      FOR SELECT USING (is_account_member(account_id, 'admin'));
  END IF;
END $$;

COMMENT ON TABLE public.calendar_connections IS 'OAuth tokens are encrypted at rest and readable only by account admins.';
