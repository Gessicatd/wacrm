-- ============================================================
-- 032_add_account_id_to_messages.sql — Direct account scoping
-- on the messages table.
--
-- Previously messages relied on a subquery through
-- conversations to resolve account_id for RLS. With
-- multi-channel (Instagram) and service-role inserts, having
-- account_id directly on the row simplifies policies and
-- makes INSERT from API routes straightforward.
-- ============================================================

-- ============================================================
-- 1. ADD account_id (nullable first — backfill below)
-- ============================================================
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS account_id UUID
  REFERENCES accounts(id) ON DELETE CASCADE;

-- ============================================================
-- 2. BACKFILL — copy account_id from the parent conversation
-- ============================================================
UPDATE messages m
  SET account_id = c.account_id
  FROM conversations c
  WHERE c.id = m.conversation_id
    AND m.account_id IS NULL;

-- ============================================================
-- 3. NOT NULL — every message must belong to an account
-- ============================================================
ALTER TABLE messages
  ALTER COLUMN account_id SET NOT NULL;

-- ============================================================
-- 4. INDEX — account-scoped queries (list inbox, counts, etc.)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_messages_account
  ON messages(account_id);

-- ============================================================
-- 5. RLS — switch from subquery to direct account_id check
-- ============================================================
DROP POLICY IF EXISTS messages_select ON messages;
DROP POLICY IF EXISTS messages_modify ON messages;

CREATE POLICY messages_select ON messages
  FOR SELECT USING (is_account_member(account_id));

CREATE POLICY messages_insert ON messages
  FOR INSERT WITH CHECK (is_account_member(account_id, 'agent'));

CREATE POLICY messages_update ON messages
  FOR UPDATE USING (is_account_member(account_id, 'agent'));

CREATE POLICY messages_delete ON messages
  FOR DELETE USING (is_account_member(account_id, 'agent'));

-- ============================================================
-- 6. REALTIME — ensure messages are published
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  END IF;
END $$;
