-- 026: Follow-gate for DM automations.
--
-- With follow_gate on, the link is only sent to people who follow the
-- account. Instagram only reveals whether someone follows you after they
-- have messaged you, so the flow is:
--   1. They trigger the automation → we send a short opener with a
--      "Send me the link" button (gate_status = 'awaiting_tap').
--   2. They tap it (or write anything back) → we check if they follow.
--      Following → the real DM goes out (gate_status = 'delivered').
--      Not following → "Follow first, then tap again" (gate_status =
--      'awaiting_follow'); the next tap checks again.
-- DM and story-reply triggers skip step 1: the person already wrote to us.
--
-- follow_gate defaults to false, so existing automations are unchanged.
--
-- Run in the Supabase SQL Editor. Safe to re-run.

ALTER TABLE dm_automations
  ADD COLUMN IF NOT EXISTS follow_gate boolean NOT NULL DEFAULT false;

ALTER TABLE dm_logs
  ADD COLUMN IF NOT EXISTS gate_status text,
  ADD COLUMN IF NOT EXISTS gate_delivered_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'dm_logs_gate_status_check'
  ) THEN
    ALTER TABLE dm_logs
      ADD CONSTRAINT dm_logs_gate_status_check
      CHECK (gate_status IS NULL OR gate_status IN ('awaiting_tap', 'awaiting_follow', 'delivered'));
  END IF;
END $$;

-- "Is this person waiting on a follow-gate with this account?" — looked up
-- for every incoming DM.
CREATE INDEX IF NOT EXISTS idx_dm_logs_open_gates
  ON dm_logs (instagram_account_id, commenter_id, created_at DESC)
  WHERE gate_status IN ('awaiting_tap', 'awaiting_follow');
