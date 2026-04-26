-- Competitor-discovery hashtag suggestions cached on the user's own profile.
-- The /api/discover-hashtags route fills these from a Claude analysis of the
-- profile's post captions, so the UI doesn't re-run a Claude call every page
-- load. The user re-generates explicitly via "Refresh suggestions".
--
-- Shape of discovery_hashtags (matches what the API stores):
-- {
--   "detected_niche": "...",
--   "categories": [
--     { "name": "Niche-specific", "hashtags": [{ "tag": "#x", "note": "..." }] },
--     ...
--   ]
-- }

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS discovery_hashtags          jsonb,
  ADD COLUMN IF NOT EXISTS discovery_hashtags_updated  timestamptz;
