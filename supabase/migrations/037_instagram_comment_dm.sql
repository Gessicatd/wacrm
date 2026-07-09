-- ============================================================
-- 037_instagram_comment_dm.sql — Comment → DM private reply
--
-- Adds `instagram_comment_id` to the `messages` table so inbound
-- comment webhook events can store the Meta comment ID alongside
-- the message row. When an automation sends a reply, the engine
-- detects this field and routes through the Instagram private-reply
-- API (recipient.comment_id instead of recipient.id / IGSID).
--
-- Idempotent — safe to run multiple times.
-- ============================================================

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS instagram_comment_id TEXT;

COMMENT ON COLUMN messages.instagram_comment_id IS
  'Meta comment ID from the Instagram comments webhook. When set, outbound replies use the private-reply API (recipient.comment_id) instead of the normal DM send (recipient.id / IGSID).';
