-- 031: Heartbeats for the two clocks that run the DM queue.
--
-- Clock 1: pg_cron (schema/018, 022) calls /api/cron/process-dms every 20s.
-- On the free Supabase plan it sometimes can't start jobs for hours
-- ("job startup timeout", e.g. 2026-11-16 02:00-09:00 Romanian time).
--
-- Clock 2: a Vercel Queues "tick" message that re-schedules itself every
-- minute (lib/meta/queue-clock.ts). It does the queue work only when
-- pg_cron has been silent, and pg_cron restarts it if it stops.
--
-- Each clock records here when it last ran and from which Vercel
-- deployment, so a tick left over from an old deployment can stop itself.
--
-- Run in the Supabase SQL Editor. Safe to re-run.

CREATE TABLE IF NOT EXISTS cron_heartbeats (
  name          text PRIMARY KEY,
  last_run_at   timestamptz NOT NULL DEFAULT now(),
  deployment_id text
);

ALTER TABLE cron_heartbeats ADD COLUMN IF NOT EXISTS deployment_id text;

-- Only the server (service key) touches it.
ALTER TABLE cron_heartbeats ENABLE ROW LEVEL SECURITY;
