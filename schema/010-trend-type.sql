-- Adds the trend_type column on trend_insights and saved_briefs, plus the
-- original_competitor_edge snapshot column on saved_briefs.
--
-- Historical context: trend_type was introduced for an outlier-aware
-- algorithm that distinguished "validated" (cross-competitor pattern) from
-- "standout" (single-creator viral hit). The current top-posts → themes
-- redesign collapses both kinds into a single "theme" concept and writes
-- trend_type = NULL on every new insert. The column stays in place so
-- pre-redesign rows (which carry 'validated' or 'standout') continue to
-- render, and so a future re-introduction of typed trends can reuse it.
--
-- The CHECK constraint deliberately permits NULL, which is what the
-- redesigned pipeline writes. Both columns are nullable and adding them is
-- idempotent — safe to re-run.

ALTER TABLE trend_insights
  ADD COLUMN IF NOT EXISTS trend_type text
    CHECK (trend_type IS NULL OR trend_type IN ('validated', 'standout'));

ALTER TABLE saved_briefs
  ADD COLUMN IF NOT EXISTS trend_type text
    CHECK (trend_type IS NULL OR trend_type IN ('validated', 'standout'));

-- Snapshot competitor_edge onto saved_briefs at save time so the workshop
-- still shows "how competitors execute it" even if the underlying
-- trend_insight is replaced on a future analysis run.
ALTER TABLE saved_briefs
  ADD COLUMN IF NOT EXISTS original_competitor_edge text;
