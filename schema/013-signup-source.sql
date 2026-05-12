-- Captures the utm_source URL parameter present when a user signed up
-- so we can attribute conversions to LinkedIn / Substack / Reddit / etc.
-- without a separate analytics warehouse.
--
-- Nullable on purpose: organic signups (direct visits, referrals without
-- a utm tag) leave this NULL, which we surface as "direct" in /admin.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS signup_source text;

CREATE INDEX IF NOT EXISTS users_signup_source_idx ON users (signup_source);
