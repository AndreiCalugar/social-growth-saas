-- The scrape pipeline upserts profiles with ON CONFLICT (platform, username).
-- Migration 004 dropped that constraint in favour of a per-user unique, which
-- broke the scraper. Restore the global unique; keep user_id for tenant
-- scoping at the application layer.
--
-- Consequence: two users cannot independently track the same handle — the
-- second insert will fail. We accept that for now (test phase). A future
-- migration can introduce a proper user_profiles join table if needed.

DROP INDEX IF EXISTS profiles_user_platform_username_key;

-- Recreate the original UNIQUE constraint (matches what scrape-pipeline.json
-- targets with on_conflict=platform,username).
ALTER TABLE profiles
  ADD CONSTRAINT profiles_platform_username_key UNIQUE (platform, username);
