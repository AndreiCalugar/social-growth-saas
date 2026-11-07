-- 022: Run the DM cron every 20 seconds instead of every minute.
--
-- Meta's review expects the reply within 30 seconds of the comment. The
-- webhook already sends instantly when it fires; this tightens the polling
-- backup to at most ~20s. Only the schedule changes — the job's command
-- (URL + CRON_SECRET from 018) is kept as is. Needs pg_cron 1.5+ (Supabase
-- has it).
--
-- Run in the Supabase SQL Editor. To go back: schedule := '* * * * *'.

SELECT cron.alter_job(
  (SELECT jobid FROM cron.job WHERE jobname = 'process-dms'),
  schedule := '20 seconds'
);

SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'process-dms';
