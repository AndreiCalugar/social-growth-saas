-- Structured content brief fields on trend_insights.
-- The Claude prompt now returns discrete fields (content, hook, caption
-- structure, best time, hashtags) plus a one-line summary and raw
-- competitor counts, so the UI can render labelled sections and a proper
-- "Found in X of Y" label instead of a percentage.
--
-- All new columns are nullable so rows written by the previous prompt
-- continue to render via the recommendation-paragraph fallback.

ALTER TABLE trend_insights
  ADD COLUMN IF NOT EXISTS one_line_summary  text,
  ADD COLUMN IF NOT EXISTS competitor_count  integer,
  ADD COLUMN IF NOT EXISTS total_competitors integer,
  ADD COLUMN IF NOT EXISTS content_format    text,
  ADD COLUMN IF NOT EXISTS hook              text,
  ADD COLUMN IF NOT EXISTS caption_structure text,
  ADD COLUMN IF NOT EXISTS best_time         text,
  ADD COLUMN IF NOT EXISTS hashtags          jsonb;
