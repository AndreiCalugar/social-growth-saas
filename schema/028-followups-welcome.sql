-- 028: Follow-up messages and the "new conversation" welcome trigger.
--
-- 1. instagram_contacts: one row per person who has messaged an account,
--    with when they last wrote. Instagram only lets a business message
--    someone within 24 hours of that person's last message, so every
--    follow-up is checked against last_inbound_at before it goes out.
--
-- 2. Follow-up settings per automation (off by default): after N hours
--    (1-23, inside the 24h window) send one more message to the people who
--    didn't open the link, who did, who didn't reply, or everyone.
--
-- 3. dm_followups: the scheduled follow-ups, one per sent DM at most.
--    Sent by the same every-20-seconds job as the DM queue. A follow-up
--    whose 24h window has closed is skipped, never sent late.
--
-- 4. 'new_conversation' joins the allowed triggers: anyone who messages
--    the account for the very first time gets the automation's DM (a
--    welcome message), no keyword needed.
--
-- Existing automations are unchanged (follow-ups off, same triggers).
--
-- Run in the Supabase SQL Editor. Safe to re-run.

CREATE TABLE IF NOT EXISTS instagram_contacts (
  instagram_account_id uuid NOT NULL REFERENCES instagram_accounts(id) ON DELETE CASCADE,
  igsid                text NOT NULL,
  first_seen_at        timestamptz NOT NULL DEFAULT now(),
  last_inbound_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (instagram_account_id, igsid)
);

ALTER TABLE dm_automations
  ADD COLUMN IF NOT EXISTS followup_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS followup_delay_hours integer NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS followup_audience text NOT NULL DEFAULT 'not_clicked',
  ADD COLUMN IF NOT EXISTS followup_message text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dm_automations_followup_delay_check') THEN
    ALTER TABLE dm_automations
      ADD CONSTRAINT dm_automations_followup_delay_check
      CHECK (followup_delay_hours BETWEEN 1 AND 23);
  END IF;
END $$;

ALTER TABLE dm_automations DROP CONSTRAINT IF EXISTS dm_automations_followup_audience_check;
ALTER TABLE dm_automations
  ADD CONSTRAINT dm_automations_followup_audience_check
  CHECK (followup_audience IN ('not_clicked', 'clicked', 'not_replied', 'all'));

CREATE TABLE IF NOT EXISTS dm_followups (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dm_log_id            uuid NOT NULL UNIQUE REFERENCES dm_logs(id) ON DELETE CASCADE,
  automation_id        uuid NOT NULL REFERENCES dm_automations(id) ON DELETE CASCADE,
  user_id              uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  instagram_account_id uuid NOT NULL REFERENCES instagram_accounts(id) ON DELETE CASCADE,
  recipient_id         text NOT NULL,
  send_after           timestamptz NOT NULL,
  status               text NOT NULL DEFAULT 'scheduled'
                         CHECK (status IN ('scheduled', 'processing', 'sent', 'skipped', 'failed')),
  skip_reason          text,
  error_message        text,
  sent_at              timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dm_followups_due
  ON dm_followups (send_after)
  WHERE status = 'scheduled';

CREATE INDEX IF NOT EXISTS idx_dm_followups_automation
  ON dm_followups (automation_id, status);

-- Allow the 'new_conversation' trigger (schema/025 and 027 constraints).
ALTER TABLE dm_automations DROP CONSTRAINT IF EXISTS dm_automations_trigger_type_check;
ALTER TABLE dm_automations
  ADD CONSTRAINT dm_automations_trigger_type_check
  CHECK (trigger_type IN ('comment', 'dm', 'story_reply', 'new_conversation'));

ALTER TABLE dm_automations DROP CONSTRAINT IF EXISTS dm_automations_triggers_check;
ALTER TABLE dm_automations
  ADD CONSTRAINT dm_automations_triggers_check
  CHECK (
    cardinality(triggers) >= 1
    AND triggers <@ ARRAY['comment', 'dm', 'story_reply', 'new_conversation']::text[]
  );

-- Only the server (service key, which bypasses RLS) touches these tables;
-- with RLS on and no policies the public anon key can't read them.
ALTER TABLE instagram_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE dm_followups ENABLE ROW LEVEL SECURITY;
