-- One-shot cleanup: remove trend_insights produced by the OLD algorithm
-- that ran before the "pre-filter top-50 winners → group by theme"
-- redesign. Those rows have two tells:
--   - performance_multiplier > 50 (the new path clamps at 50)
--   - detected_niche IS NULL (the new path always sets a niche)
--
-- Symptom that motivated this: the Overview page's "Your Assignment
-- This Week" card was surfacing stale 3146× rows because it picks the
-- top multiplier across all-time insights.
--
-- Re-running this is safe — a healthy modern run never matches the
-- predicate, so it's a no-op after the initial sweep.
DELETE FROM trend_insights
WHERE performance_multiplier > 50
   OR detected_niche IS NULL;
