-- Trend insights: cross-competitor pattern detection results
CREATE TABLE IF NOT EXISTS trend_insights (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id             uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  trend_name             text NOT NULL,
  confidence             float,
  performance_multiplier float,
  example_posts          jsonb,
  recommendation         text,
  suggested_schedule     text,
  is_mega_tip            boolean DEFAULT false,
  created_at             timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trend_insights_profile_id_idx ON trend_insights(profile_id);
CREATE INDEX IF NOT EXISTS trend_insights_created_at_idx ON trend_insights(created_at);
