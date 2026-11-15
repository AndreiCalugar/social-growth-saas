-- 029: AI assistant on DM automations.
--
-- With ai_enabled on, people who write back after an automation's DM (a
-- question about the event, the price, the location...) get an answer from
-- Claude, based ONLY on ai_knowledge, the information the creator wrote.
-- The first AI reply says it's an AI assistant. After ai_max_replies
-- answers, or when the answer isn't in the information, it says the
-- creator will get back to them, stops, and flags the conversation.
--
-- dm_ai_threads: one per DM that started a conversation with the
-- assistant, with how many answers it gave and whether it handed over.
-- dm_ai_messages: the conversation itself (questions and AI answers), so
-- each answer has context and the creator can read it.
--
-- ai_enabled defaults to false: existing automations are unchanged.
--
-- Run in the Supabase SQL Editor. Safe to re-run.

ALTER TABLE dm_automations
  ADD COLUMN IF NOT EXISTS ai_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_knowledge text,
  ADD COLUMN IF NOT EXISTS ai_tone text NOT NULL DEFAULT 'warm',
  ADD COLUMN IF NOT EXISTS ai_max_replies integer NOT NULL DEFAULT 3;

ALTER TABLE dm_automations DROP CONSTRAINT IF EXISTS dm_automations_ai_tone_check;
ALTER TABLE dm_automations
  ADD CONSTRAINT dm_automations_ai_tone_check CHECK (ai_tone IN ('warm', 'friendly', 'professional'));

ALTER TABLE dm_automations DROP CONSTRAINT IF EXISTS dm_automations_ai_max_replies_check;
ALTER TABLE dm_automations
  ADD CONSTRAINT dm_automations_ai_max_replies_check CHECK (ai_max_replies BETWEEN 1 AND 10);

CREATE TABLE IF NOT EXISTS dm_ai_threads (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dm_log_id            uuid NOT NULL UNIQUE REFERENCES dm_logs(id) ON DELETE CASCADE,
  automation_id        uuid NOT NULL REFERENCES dm_automations(id) ON DELETE CASCADE,
  user_id              uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  instagram_account_id uuid NOT NULL REFERENCES instagram_accounts(id) ON DELETE CASCADE,
  igsid                text NOT NULL,
  -- open: the assistant answers; handed_off: it said "I'll pass this on" and stopped.
  status               text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'handed_off')),
  replies_count        integer NOT NULL DEFAULT 0,
  handoff_reason       text CHECK (handoff_reason IS NULL OR handoff_reason IN ('limit', 'not_covered', 'error')),
  needs_attention      boolean NOT NULL DEFAULT false,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- "Is this person talking to an assistant right now?" — checked for every incoming DM.
CREATE INDEX IF NOT EXISTS idx_dm_ai_threads_lookup
  ON dm_ai_threads (instagram_account_id, igsid, created_at DESC);

CREATE TABLE IF NOT EXISTS dm_ai_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id  uuid NOT NULL REFERENCES dm_ai_threads(id) ON DELETE CASCADE,
  role       text NOT NULL CHECK (role IN ('user', 'assistant')),
  text       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dm_ai_messages_thread ON dm_ai_messages (thread_id, created_at);

-- Server-only tables (service key bypasses RLS); the anon key can't read them.
ALTER TABLE dm_ai_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE dm_ai_messages ENABLE ROW LEVEL SECURITY;
