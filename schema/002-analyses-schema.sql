-- Social Growth SaaS — Analyses & Recommendations Schema
-- Run in Supabase SQL Editor after 001-initial-schema.sql

-- AI analysis results per profile run
CREATE TABLE IF NOT EXISTS analyses (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id            uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  analysis_type         text NOT NULL DEFAULT 'performance',
  engagement_summary    jsonb,
  top_posts             jsonb,
  worst_posts           jsonb,
  best_posting_times    jsonb,
  content_type_breakdown jsonb,
  raw_response          text,
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- Actionable recommendations generated per analysis
CREATE TABLE IF NOT EXISTS recommendations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  analysis_id  uuid NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  category     text NOT NULL CHECK (category IN ('content', 'timing', 'engagement', 'hashtags', 'growth')),
  title        text NOT NULL,
  description  text,
  priority     text NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_analyses_profile_id       ON analyses(profile_id);
CREATE INDEX IF NOT EXISTS idx_analyses_created_at       ON analyses(created_at);
CREATE INDEX IF NOT EXISTS idx_recommendations_profile_id ON recommendations(profile_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_analysis_id ON recommendations(analysis_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_priority  ON recommendations(priority);
