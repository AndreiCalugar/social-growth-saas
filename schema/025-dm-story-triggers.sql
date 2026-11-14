-- 025: DM and story-reply triggers for automations.
--
-- An automation now listens to one of three things:
--   comment     — a keyword in a comment on a post (the original behaviour)
--   dm          — a keyword in a direct message to the account
--   story_reply — a keyword in a reply to one of the account's stories
--
-- DM and story triggers answer with a normal DM (the Send API, inside the
-- 24-hour window the person's own message opens), not a private reply to a
-- comment. Their dm_logs rows store the Instagram message id in comment_id,
-- which keeps the existing (automation_id, comment_id) dedup working.
--
-- Both columns default to 'comment', so every existing automation and log
-- row keeps its current meaning.
--
-- Run in the Supabase SQL Editor. Safe to re-run.

ALTER TABLE dm_automations
  ADD COLUMN IF NOT EXISTS trigger_type text NOT NULL DEFAULT 'comment';

ALTER TABLE dm_logs
  ADD COLUMN IF NOT EXISTS trigger_type text NOT NULL DEFAULT 'comment';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'dm_automations_trigger_type_check'
  ) THEN
    ALTER TABLE dm_automations
      ADD CONSTRAINT dm_automations_trigger_type_check
      CHECK (trigger_type IN ('comment', 'dm', 'story_reply'));
  END IF;
END $$;

-- "Has this person already been answered by this automation recently?"
-- (stops someone who keeps messaging the keyword from getting spammed).
CREATE INDEX IF NOT EXISTS idx_dm_logs_automation_recipient
  ON dm_logs (automation_id, commenter_id, created_at DESC);
