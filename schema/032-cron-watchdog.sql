-- 032: Less Disk IO. pg_cron becomes a 5-minute watchdog; logs are pruned.
--
-- Running pg_cron every 20 seconds (schema/022) was ~85% of the database's
-- writes: every run logs a row in cron.job_run_details (updated twice) and
-- a request and response in pg_net. On the free plan that used up the
-- daily Disk IO budget, and then pg_cron couldn't start jobs at all
-- ("job startup timeout", e.g. 2026-11-16 22:00 to 2026-11-17 07:00 UTC).
--
-- The DM queue is now run every 20 seconds by the clock on Vercel Queues
-- (lib/meta/queue-clock.ts), which doesn't touch the database to keep
-- time. pg_cron calls the same /api/cron/process-dms every 5 minutes: it
-- restarts that clock if it stopped and runs the queue once itself.
--
-- Deploy the app before running this (the clock must run the queue on
-- every tick first). To go back: schedule := '20 seconds'.
--
-- Run in the Supabase SQL Editor. Safe to re-run.

-- 1. pg_cron: every 20 seconds -> every 5 minutes. Same command.
SELECT cron.alter_job(
  (SELECT jobid FROM cron.job WHERE jobname = 'process-dms'),
  schedule := '*/5 * * * *'
);

-- 2. Daily cleanup at 12:00 UTC (daytime, when the IO budget is fine).
--    pg_cron's run log: keep 1 day. Webhook events: keep 14 days (only
--    events that did something or failed are saved now).
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'cleanup-logs';

SELECT cron.schedule(
  'cleanup-logs',
  '0 12 * * *',
  $$
  DELETE FROM cron.job_run_details WHERE start_time < now() - interval '1 day';
  DELETE FROM public.webhook_events WHERE created_at < now() - interval '14 days';
  $$
);

-- 3. Clean up now: the old run log, and the read receipts and echoes that
--    were saved as 'ignored' before.
DELETE FROM cron.job_run_details WHERE start_time < now() - interval '1 day';
DELETE FROM public.webhook_events
WHERE status = 'ignored' OR created_at < now() - interval '14 days';

SELECT jobname, schedule, active FROM cron.job ORDER BY jobname;
