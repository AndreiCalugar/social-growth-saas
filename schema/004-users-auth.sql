-- Social Growth SaaS — Users & Auth
-- Run against Supabase: psql $SUPABASE_DB_URL -f schema/004-users-auth.sql
-- NOTE: After running, execute scripts/seed-users.js to create test accounts
-- and backfill existing profiles with user_id values.

CREATE TABLE IF NOT EXISTS users (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email          text NOT NULL UNIQUE,
  password_hash  text NOT NULL,
  name           text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(lower(email));

-- Each profile belongs to a single user (tenant). Nullable during migration;
-- seed script backfills existing rows, then you can tighten to NOT NULL.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);

-- The existing (platform, username) UNIQUE constraint is now too strict:
-- two different users should be able to track the same competitor handle.
-- Swap it for a per-user unique instead.
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_platform_username_key;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_user_platform_username_key
  ON profiles(user_id, platform, username);
