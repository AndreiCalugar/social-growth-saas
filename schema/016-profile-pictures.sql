-- Social Growth SaaS — Profile pictures + richer profile metadata
-- Run against Supabase: psql $SUPABASE_DB_URL -f schema/016-profile-pictures.sql
--
-- Adds the columns we hydrate from the apify/instagram-profile-scraper
-- actor (run separately from the post scraper) and used by the
-- profile cards. profile_pic_url stores a Supabase Storage public URL —
-- not the raw Instagram CDN URL, which is signed and expires within
-- hours to days. See storage bucket setup notes below.
--
-- Supabase Storage bucket (one-time, via dashboard or SQL):
--   1. Create a PUBLIC bucket named `profile-pics`.
--      Dashboard: Storage → New bucket → Public.
--      Or SQL:
--        INSERT INTO storage.buckets (id, name, public)
--        VALUES ('profile-pics', 'profile-pics', true)
--        ON CONFLICT (id) DO NOTHING;
--   2. Allow the service role (used by n8n) to write objects.
--      Public read is automatic for a public bucket.
--      The default RLS policies for storage already allow the
--      service_role key to insert/upsert, so no extra policy is
--      needed if n8n is using SUPABASE_SECRET_KEY / service role.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS profile_pic_url text,
  ADD COLUMN IF NOT EXISTS full_name      text,
  ADD COLUMN IF NOT EXISTS is_verified    boolean NOT NULL DEFAULT false;
