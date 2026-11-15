-- 027: One automation, several triggers.
--
-- dm_automations.triggers lists what starts the automation, any of
-- 'comment', 'dm', 'story_reply' — e.g. {comment,dm} answers both a keyword
-- comment on the post and a keyword DM, with the same message and stats.
--
-- trigger_type (schema/025) stays, kept equal to the first trigger by the
-- app, so code deployed before this migration keeps working; a database
-- trigger fills triggers from trigger_type for writers that don't know it. Existing
-- automations get a one-item list from their trigger_type: nothing changes
-- for them.
--
-- dm_logs.trigger_type is unchanged: it records which trigger fired.
--
-- Run in the Supabase SQL Editor. Safe to re-run.

ALTER TABLE dm_automations
  ADD COLUMN IF NOT EXISTS triggers text[];

UPDATE dm_automations
SET triggers = ARRAY[trigger_type]
WHERE triggers IS NULL;

-- No column default: a default of {comment} would turn a DM automation
-- created by older code (which only writes trigger_type) into a comment
-- one. Instead this keeps triggers in step with trigger_type whenever a
-- writer doesn't set triggers itself.
CREATE OR REPLACE FUNCTION dm_automations_sync_triggers() RETURNS trigger AS $$
BEGIN
  IF NEW.triggers IS NULL THEN
    NEW.triggers := ARRAY[NEW.trigger_type];
  ELSIF TG_OP = 'UPDATE'
    AND NEW.trigger_type IS DISTINCT FROM OLD.trigger_type
    AND NEW.triggers IS NOT DISTINCT FROM OLD.triggers THEN
    NEW.triggers := ARRAY[NEW.trigger_type];
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS dm_automations_sync_triggers ON dm_automations;
CREATE TRIGGER dm_automations_sync_triggers
  BEFORE INSERT OR UPDATE ON dm_automations
  FOR EACH ROW EXECUTE FUNCTION dm_automations_sync_triggers();

ALTER TABLE dm_automations
  ALTER COLUMN triggers DROP DEFAULT,
  ALTER COLUMN triggers SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'dm_automations_triggers_check'
  ) THEN
    ALTER TABLE dm_automations
      ADD CONSTRAINT dm_automations_triggers_check
      CHECK (
        cardinality(triggers) >= 1
        AND triggers <@ ARRAY['comment', 'dm', 'story_reply']::text[]
      );
  END IF;
END $$;
