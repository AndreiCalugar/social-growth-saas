-- 021: Log of "Connect Instagram" attempts.
--
-- One row each time a user starts the Instagram login and one when it comes
-- back (connected, denied, failed, …). A "started" row with nothing after it
-- means they never returned from Instagram — usually because the tester
-- invite wasn't accepted, so Instagram showed its own error page. Shown per
-- user in /admin/beta.
--
-- Run in the Supabase SQL Editor. Safe to re-run.

CREATE TABLE IF NOT EXISTS instagram_connect_attempts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  outcome    text NOT NULL,
  detail     text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_instagram_connect_attempts_user
  ON instagram_connect_attempts (user_id, created_at DESC);
