-- 030: Reply language for the AI assistant.
--
-- 'auto' (default): answer in the person's language, and when that can't be
-- told (e.g. "ok"), in the automation's own language (its DM). 'ro' / 'en':
-- always that language - for creators whose audience is all Romanian.
--
-- Run in the Supabase SQL Editor. Safe to re-run.

ALTER TABLE dm_automations
  ADD COLUMN IF NOT EXISTS ai_language text NOT NULL DEFAULT 'auto';

ALTER TABLE dm_automations DROP CONSTRAINT IF EXISTS dm_automations_ai_language_check;
ALTER TABLE dm_automations
  ADD CONSTRAINT dm_automations_ai_language_check CHECK (ai_language IN ('auto', 'ro', 'en'));
