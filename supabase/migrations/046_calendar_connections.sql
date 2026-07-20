-- Migration 046: Google Calendar OAuth2 connections per account.
-- Stores encrypted OAuth2 tokens for one Google Calendar connection per
-- account. Tokens are AES-256-GCM encrypted before storage (same module
-- as WhatsApp/Instagram tokens).

CREATE TABLE calendar_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  google_email TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  calendar_id TEXT DEFAULT 'primary',
  calendar_name TEXT,
  sync_enabled BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One active connection per account.
  CONSTRAINT unique_account_active UNIQUE (account_id, is_active)
);

CREATE INDEX idx_calendar_connections_account
  ON calendar_connections(account_id);

-- RLS: SELECT by any account member; INSERT/UPDATE/DELETE by admin+.
ALTER TABLE calendar_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view calendar connections"
  ON calendar_connections FOR SELECT
  USING (is_account_member(account_id));

CREATE POLICY "Admins can insert calendar connections"
  ON calendar_connections FOR INSERT
  WITH CHECK (is_account_member(account_id, 'admin'));

CREATE POLICY "Admins can update calendar connections"
  ON calendar_connections FOR UPDATE
  USING (is_account_member(account_id, 'admin'));

CREATE POLICY "Admins can delete calendar connections"
  ON calendar_connections FOR DELETE
  USING (is_account_member(account_id, 'admin'));
