-- 059_payment_provider_credentials.sql — encrypted provider credentials
-- The application encrypts this value with ENCRYPTION_KEY before writing it.
-- No API response returns the ciphertext or plaintext.

ALTER TABLE payment_providers
  ADD COLUMN IF NOT EXISTS credentials_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS credential_hint TEXT;

COMMENT ON COLUMN payment_providers.credentials_encrypted IS 'AES-256-GCM ciphertext; server-only and never returned to clients.';
COMMENT ON COLUMN payment_providers.credential_hint IS 'Non-secret label such as last four characters or configured account name.';
