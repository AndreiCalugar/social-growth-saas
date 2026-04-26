-- Phase 1 of the outlier-aware insights engine. We now produce two kinds
-- of trends, and the UI labels them differently:
--
--   "validated" — pattern repeats across 2+ competitors (the original
--                 cross-account trend type the system has always returned).
--   "standout"  — a single-creator viral hit, where one post wildly
--                 outperforms its own creator's median (e.g. 10x). The
--                 magnitude IS the validation, even with no cross-account
--                 repetition. Workflow surfaces 2-4 of these per run when
--                 they exist.
--
-- saved_briefs snapshots trend_type so a brief stays meaningful even if the
-- source trend_insights row is replaced on the next analysis run, and so
-- the workshop UI can label a saved brief as a standout vs validated.
--
-- Both columns nullable so insights/briefs written by the previous pipeline
-- continue to render (treated as "validated" by the UI when null).

ALTER TABLE trend_insights
  ADD COLUMN IF NOT EXISTS trend_type text
    CHECK (trend_type IS NULL OR trend_type IN ('validated', 'standout'));

ALTER TABLE saved_briefs
  ADD COLUMN IF NOT EXISTS trend_type text
    CHECK (trend_type IS NULL OR trend_type IN ('validated', 'standout'));

-- Snapshot competitor_edge onto saved_briefs at save time so the workshop
-- still shows "how competitors do it differently" even if the underlying
-- trend_insight is replaced on a future analysis run.
ALTER TABLE saved_briefs
  ADD COLUMN IF NOT EXISTS original_competitor_edge text;
