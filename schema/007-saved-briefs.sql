-- Brief Workshop — saved + customized content briefs.
-- Each row is a snapshot of a trend_insight at the moment the user clicked
-- "Save & Customize", plus their AI-expanded variations and chosen edits.
-- We snapshot the original brief fields rather than joining live so a saved
-- brief stays meaningful even if the underlying trend_insights row gets
-- replaced on the next analysis run.

CREATE TABLE IF NOT EXISTS saved_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trend_insight_id uuid REFERENCES trend_insights(id) ON DELETE SET NULL,
  trend_name text NOT NULL,
  performance_multiplier float,

  -- Original brief (snapshot from trend_insights at save time)
  original_content text,
  original_hook text,
  original_caption text,
  original_posting_time text,
  original_hashtags jsonb DEFAULT '[]'::jsonb,

  -- AI-expanded options (populated by /api/briefs/[id]/expand)
  hook_variations jsonb DEFAULT '[]'::jsonb,
  content_angles jsonb DEFAULT '[]'::jsonb,
  caption_variations jsonb DEFAULT '[]'::jsonb,

  -- User customizations (editable in the workshop)
  chosen_hook text,
  chosen_content text,
  chosen_caption text,
  chosen_posting_time text,
  chosen_hashtags jsonb DEFAULT '[]'::jsonb,
  user_notes text DEFAULT '',

  -- Scheduling
  scheduled_date date,
  scheduled_time text,

  -- Status tracking
  status text NOT NULL DEFAULT 'saved'
    CHECK (status IN ('saved', 'planning', 'filming', 'filmed', 'posted')),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS saved_briefs_user_id_idx
  ON saved_briefs(user_id);
CREATE INDEX IF NOT EXISTS saved_briefs_status_idx
  ON saved_briefs(status);
CREATE INDEX IF NOT EXISTS saved_briefs_scheduled_date_idx
  ON saved_briefs(scheduled_date);

-- One saved brief per (user, trend_insight) pair so the Insights page can
-- toggle between "Save & Customize" and "Edit brief" without duplicates.
CREATE UNIQUE INDEX IF NOT EXISTS saved_briefs_user_trend_unique
  ON saved_briefs(user_id, trend_insight_id)
  WHERE trend_insight_id IS NOT NULL;
