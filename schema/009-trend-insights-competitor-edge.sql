-- Cross-analysis trends carry a "competitor_edge" — one concrete thing
-- competitors do differently or better, regardless of whether the user
-- already does the broader pattern. This makes "Already in your playbook"
-- trends still useful (instead of deadweight cards that just say
-- "yep, you're doing this") and gives standout-hit trends a place to
-- explain why the single video popped.
--
-- This migration was previously introduced and reverted on
-- feature/ui-polish-pass-1; re-applying here as part of the outlier-aware
-- insights engine. IF NOT EXISTS makes it a no-op for users who already
-- ran the earlier version.

ALTER TABLE trend_insights
  ADD COLUMN IF NOT EXISTS competitor_edge text;
