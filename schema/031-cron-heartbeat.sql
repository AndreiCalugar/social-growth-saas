-- 031: Heartbeat for the DM queue job, so a backup scheduler can step in.
--
-- pg_cron (schema/018, 022) calls /api/cron/process-dms every 20 seconds.
-- On the free Supabase plan it sometimes can't start jobs for hours
-- ("job startup timeout", e.g. 2026-11-16 02:00-09:00 Romanian time).
-- Each pg_cron run records itself here; an external backup scheduler calls
-- the same route with ?backup=1 every minute, and it only does the work
-- when pg_cron hasn't run in the last 90 seconds.
--
-- Run in the Supabase SQL Editor. Safe to re-run.

CREATE TABLE IF NOT EXISTS cron_heartbeats (
  name        text PRIMARY KEY,
  last_run_at timestamptz NOT NULL DEFAULT now()
);

-- Only the server (service key) touches it.
ALTER TABLE cron_heartbeats ENABLE ROW LEVEL SECURITY;
