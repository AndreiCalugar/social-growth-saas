-- Social Growth SaaS — Google OAuth support
-- Run against Supabase: psql $SUPABASE_DB_URL -f schema/015-google-oauth.sql
--
-- Allows users to sign in with Google: a Google-only account has no local
-- password, so password_hash must accept NULL. Existing rows already have
-- a hash and keep it; the credentials provider still works for them.

ALTER TABLE users
  ALTER COLUMN password_hash DROP NOT NULL;
