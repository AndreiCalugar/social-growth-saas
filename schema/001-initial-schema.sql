-- Social Growth SaaS — Initial Schema
-- Run against Supabase: psql $SUPABASE_DB_URL -f schema/001-initial-schema.sql

-- Profiles: Instagram/TikTok accounts being tracked
CREATE TABLE IF NOT EXISTS profiles (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform       text NOT NULL CHECK (platform IN ('instagram', 'tiktok')),
  username       text NOT NULL,
  profile_url    text,
  is_own         boolean NOT NULL DEFAULT false,
  followers      int,
  following      int,
  bio            text,
  last_scraped   timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (platform, username)
);

-- Posts: individual posts scraped from profiles
CREATE TABLE IF NOT EXISTS posts (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id         uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  platform_post_id   text UNIQUE NOT NULL,
  content_type       text,         -- reel, carousel, image, video
  caption            text,
  hashtags           jsonb NOT NULL DEFAULT '[]',
  likes              int,
  comments           int,
  shares             int,
  views              int,
  engagement_rate    float,
  posted_at          timestamptz,
  scraped_at         timestamptz NOT NULL DEFAULT now()
);

-- Scrape runs: audit log of every Apify run
CREATE TABLE IF NOT EXISTS scrape_runs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  apify_run_id   text,
  status         text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  posts_scraped  int NOT NULL DEFAULT 0,
  started_at     timestamptz NOT NULL DEFAULT now(),
  completed_at   timestamptz
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_posts_profile_id      ON posts(profile_id);
CREATE INDEX IF NOT EXISTS idx_posts_platform_post_id ON posts(platform_post_id);
CREATE INDEX IF NOT EXISTS idx_posts_posted_at        ON posts(posted_at);
CREATE INDEX IF NOT EXISTS idx_scrape_runs_profile_id ON scrape_runs(profile_id);
