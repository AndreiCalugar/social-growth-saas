# Changelog

All notable changes to this project are documented here.

---

## [Unreleased]

- Workflow 2: AI analysis pipeline (Claude API)
- Workflow 3: Trend monitor (daily cron)
- Next.js frontend dashboard
- Auth system (NextAuth)
- Stripe billing integration
- Landing page

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
