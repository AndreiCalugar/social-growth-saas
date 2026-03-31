# Changelog

All notable changes to this project are documented here.

---

## [Unreleased]

- Workflow 3: Trend monitor (daily cron)
- Next.js frontend dashboard (in progress)
- Auth system (NextAuth)
- Stripe billing integration
- Landing page

---

## 2026-03-31 — Profile Analytics Page

### Added
- **Profile analytics page** (`/profiles/[id]`): full per-profile deep-dive view
  - Profile header with username, followers, bio, last scraped date, Scrape Now + Run Analysis buttons
  - Engagement charts: likes over time (30/60/90-day toggle), engagement by day of week, engagement by hour of day, content type donut chart
  - Posts table: all posts with date, caption preview, likes, comments, views, engagement rate — top 10 highlighted green, bottom 10 red, click to expand full caption
  - Latest AI analysis section with recommendation cards and priority badges

---

## 2026-03-31 — Workflow 2 & Frontend Init

### Added
- **Database schema** `schema/002-analyses-schema.sql`: `analyses` and `recommendations` tables with indexes
- **Workflow 2 — AI analysis pipeline** (`n8n-workflows/analysis-pipeline.json`):
  - Webhook POST `/analyze-profile` accepts `{profile_id, analysis_type}`
  - Fetches all posts + profile from Supabase, builds structured prompt
  - Calls Claude API (`claude-sonnet-4-20250514`) — returns engagement summary, top/worst posts, best posting times, content breakdown, 5 recommendations
  - Saves analysis row + batch-inserts recommendations to Supabase
  - First successful analysis of `@andreixperience` — 10 posts, 5 recommendations stored
- **Next.js frontend** (`src/`): scaffolded with TypeScript, Tailwind, App Router, shadcn/ui, recharts, Supabase JS client
- **Overview dashboard page** (`/`): metric cards (followers, avg likes, posts tracked, last analysis date) + likes-over-time chart with views overlay + AI recommendations panel + trend insight card

### Fixed
- Workflow 1 `engagement_rate` calculation now uses real `profile.followers` as divisor (was defaulting to 1, producing inflated values)
- Switched data fetching from Prisma (direct TCP — blocked) to Supabase JS client (REST/HTTPS — reliable)

---

## 2026-03-31 — Project Foundation

### Added
- **Project infrastructure**: Git repo, folder structure (`n8n-workflows/`, `src/`, `scripts/`, `docs/`, `schema/`), `.gitignore`
- **Docker setup**: `docker-compose.yml` running n8n on port 5678 with persistent volume, `Europe/Bucharest` timezone, and env var passthrough
- **Database schema**: `schema/001-initial-schema.sql` — `profiles`, `posts`, and `scrape_runs` tables with indexes, deployed to Supabase
- **Workflow 1 — Instagram scrape pipeline** (`n8n-workflows/scrape-pipeline.json`):
  - Webhook trigger → Apify `instagram-post-scraper` actor → poll loop (15s intervals) → dataset fetch
  - Transform node: engagement rate calculation, content type detection (reel/carousel/image), hashtag extraction
  - Upsert to Supabase: `profiles`, `posts`, and `scrape_runs` tables via REST API
  - First successful end-to-end scrape of `@andreixperience` — 10 posts stored
- **`scripts/verify-setup.sh`**: health checker for Docker, n8n, Apify, Supabase, and Claude API
- **`docs/MVP-BLUEPRINT.md`**: full product blueprint converted from source document
