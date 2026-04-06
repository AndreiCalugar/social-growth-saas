# Changelog

All notable changes to this project are documented here.

---

## [Unreleased]

- Auth system (NextAuth)
- Stripe billing integration
- Landing page

---

## 2026-04-06 — Insights Engine (Workflow 3)

### Added
- **Insights Engine** (`/insights`): core product feature — cross-competitor trend detection with mega-tips
  - Analyzes posts from all tracked competitor accounts together via Claude API
  - Detects content patterns appearing in the top 20% of posts across 2+ competitors
  - Calculates `performance_multiplier` (avg likes of pattern posts / avg likes overall)
  - Produces "mega-tips": specific content briefs telling the user exactly what to film, hook line, caption structure, and posting schedule
  - Trends with multiplier < 1.5× filtered out before storage (safety net)
  - Trends from 2.0× threshold preferred; sub-threshold ones labelled "Emerging:"
- **Workflow 3: Cross-Competitor Analysis** (`n8n-workflows/cross-analysis-pipeline.json`):
  - Webhook `POST /webhook/cross-analysis` → fetches own posts + all competitor posts in parallel
  - Groups competitor posts by profile, builds structured Claude prompt with top posts per account
  - Calls Claude API (`claude-sonnet-4-5`, 4096 tokens) → parses JSON trend array
  - Validates example_posts are from competitor accounts only (not own_account)
  - Inserts validated trends into `trend_insights` table with `is_mega_tip` flag
- **`schema/003-trend-insights.sql`**: `trend_insights` table (`profile_id`, `trend_name`, `confidence`, `performance_multiplier`, `example_posts`, `recommendation`, `is_mega_tip`)
- **`/insights` page**: server component with competitor count gate (requires 3+), Generate button, polling, mega-tip cards
- **`/api/insights` route**: fetches latest batch of insights (10-minute window) ordered by multiplier
- **Sidebar**: Insights link styled orange with NEW badge and Sparkles icon
- **Overview CTA card**: shows trend count and mega-tip count linking to `/insights`
- **7 competitor accounts** tracked and scraped (andreixperience, irina.narativa, zicho.hu, spenwragg + others)
- **`docs/INSIGHTS-ENGINE.md`**: full technical overview — data flow, Claude prompts, schema, node map, sample output

### Fixed
- Scrape pipeline `Upsert Profile` node no longer overwrites `is_own` — rescraping an own account no longer sets it to `false`
- Overview page posts query now filters by own profile's `profile_id` (previously fetched posts from all accounts)
- Overview page post order changed to newest-first with chart reversed for correct timeline display

---

## 2026-03-31 — Competitor Comparison Page

### Added
- **Competitor comparison page** (`/competitors`):
  - Add competitor form: enter Instagram username → creates profile in Supabase + triggers scrape webhook automatically
  - Competitor card list with followers, last scraped date
  - Side-by-side comparison: select own profile vs competitor — avg likes, avg comments, posting frequency, top content type
  - Grouped bar chart comparing avg likes and avg comments
  - "What they do that you don't" keyword analysis table: terms appearing in competitor captions not found in own posts
  - Competitor posts table (sortable, top 10 highlighted green)

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
