-- Social Growth SaaS — every-minute DM queue drain via Supabase pg_cron
-- Run in Supabase → SQL Editor. Replace <CRON_SECRET> with the production
-- CRON_SECRET (Vercel → Settings → Environment Variables).
--
-- Vercel Hobby crons run at most daily, so the minute-level trigger for
-- /api/cron/process-dms lives in the database instead of an external pinger.
-- The route also polls watched posts for comments the webhook missed.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Re-runnable: drop the old schedule before creating it again.
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'process-dms';

SELECT cron.schedule(
  'process-dms',
  '* * * * *',
  $$
  SELECT net.http_get(
    url := 'https://www.getsocialgrowth.tech/api/cron/process-dms',
    headers := jsonb_build_object('Authorization', 'Bearer <CRON_SECRET>'),
    timeout_milliseconds := 60000
  );
  $$
);

-- Check it's running (after a minute or two):
--   SELECT status_code, created FROM net._http_response ORDER BY created DESC LIMIT 5;
-- Stop it:
--   SELECT cron.unschedule('process-dms');
