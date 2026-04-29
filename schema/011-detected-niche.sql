-- detected_niche stores Claude's auto-detected description of the user's
-- niche on each analysis run (e.g. "Specialty coffee shops" or
-- "Bikepacking & adventure cycling"). It's denormalized onto every
-- trend_insights row produced by a single run — every row in the same
-- run carries the same niche string. The frontend reads the most recent
-- non-null value for the subtitle on /insights.
--
-- Captured here so off-niche themes can be filtered or audited in the
-- diag payload, and so the user can see at a glance which niche the
-- engine inferred from their own posts.
--
-- Nullable so pre-feature rows continue to render unchanged.

ALTER TABLE trend_insights
  ADD COLUMN IF NOT EXISTS detected_niche text;
