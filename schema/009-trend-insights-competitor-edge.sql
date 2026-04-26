-- Cross-analysis trends now ALWAYS carry a "competitor_edge" — one concrete
-- thing competitors do differently or better than the user, regardless of
-- whether the user already does the broader pattern. This is the field
-- that makes "Already in your playbook" trends still useful (instead of
-- deadweight cards that just say "yep, you're doing this").
--
-- Nullable so insights written by the previous prompt continue to render.

ALTER TABLE trend_insights
  ADD COLUMN IF NOT EXISTS competitor_edge text;
