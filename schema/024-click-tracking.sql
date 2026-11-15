-- 024: Link click tracking for DM automations.
--
-- When an automation has track_clicks on, every link in its DM is replaced
-- at send time with a short link (/r/<code>) that is unique per DM, so the
-- app can tell how many recipients clicked, not just how many clicks there
-- were. Visiting /r/<code> counts the click and redirects to target_url.
--
-- track_clicks defaults to false so existing automations keep sending their
-- links exactly as before; the editor turns it on for new ones.
--
-- Run in the Supabase SQL Editor. Safe to re-run.

ALTER TABLE dm_automations
  ADD COLUMN IF NOT EXISTS track_clicks boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS tracked_links (
  code             text PRIMARY KEY,
  user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  automation_id    uuid NOT NULL REFERENCES dm_automations(id) ON DELETE CASCADE,
  dm_log_id        uuid NOT NULL REFERENCES dm_logs(id) ON DELETE CASCADE,
  target_url       text NOT NULL,
  click_count      int NOT NULL DEFAULT 0,
  first_clicked_at timestamptz,
  last_clicked_at  timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  -- A retried send reuses the same code instead of minting a new one.
  UNIQUE (dm_log_id, target_url)
);

CREATE INDEX IF NOT EXISTS idx_tracked_links_automation
  ON tracked_links (automation_id);
CREATE INDEX IF NOT EXISTS idx_tracked_links_user
  ON tracked_links (user_id);

-- Count one click and return where to send the visitor, in one atomic step.
CREATE OR REPLACE FUNCTION register_link_click(p_code text)
RETURNS text
LANGUAGE sql
AS $$
  UPDATE tracked_links
     SET click_count      = click_count + 1,
         first_clicked_at = COALESCE(first_clicked_at, now()),
         last_clicked_at  = now()
   WHERE code = p_code
  RETURNING target_url;
$$;
