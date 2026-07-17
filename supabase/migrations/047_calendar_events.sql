-- Migration 047: Local calendar events with bidirectional Google Calendar sync.
-- Events are the local source of truth; n8n syncs with Google Calendar
-- via the sync_status column. Events can be linked to contacts and deals.

CREATE TABLE calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  google_event_id TEXT,
  google_calendar_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  is_all_day BOOLEAN NOT NULL DEFAULT false,
  timezone TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'cancelled', 'tentative')),
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  conference_link TEXT,
  attendees_json JSONB DEFAULT '[]'::jsonb,
  recurrence_rule TEXT,
  color TEXT,
  sync_status TEXT NOT NULL DEFAULT 'synced'
    CHECK (sync_status IN (
      'synced',
      'pending_create',
      'pending_update',
      'pending_delete',
      'conflict'
    )),
  last_synced_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- google_event_id is globally unique within an account (when set).
  CONSTRAINT unique_google_event UNIQUE (account_id, google_event_id)
);

CREATE INDEX idx_calendar_events_account
  ON calendar_events(account_id);

CREATE INDEX idx_calendar_events_sync_status
  ON calendar_events(account_id, sync_status)
  WHERE sync_status != 'synced';

CREATE INDEX idx_calendar_events_time_range
  ON calendar_events(account_id, start_at, end_at);

CREATE INDEX idx_calendar_events_contact
  ON calendar_events(contact_id)
  WHERE contact_id IS NOT NULL;

CREATE INDEX idx_calendar_events_deal
  ON calendar_events(deal_id)
  WHERE deal_id IS NOT NULL;

-- RLS: SELECT by any member; INSERT/UPDATE/DELETE by agent+.
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view calendar events"
  ON calendar_events FOR SELECT
  USING (is_account_member(account_id));

CREATE POLICY "Agents can insert calendar events"
  ON calendar_events FOR INSERT
  WITH CHECK (is_account_member(account_id, 'agent'));

CREATE POLICY "Agents can update calendar events"
  ON calendar_events FOR UPDATE
  USING (is_account_member(account_id, 'agent'));

CREATE POLICY "Agents can delete calendar events"
  ON calendar_events FOR DELETE
  USING (is_account_member(account_id, 'agent'));
