# Social Growth SaaS

> AI-powered Instagram & TikTok analytics platform that turns raw social data into actionable growth insights.

## What it does

Users connect their Instagram and TikTok profiles, add competitor accounts, and the platform automatically scrapes post data via Apify, analyzes it with Claude AI, and surfaces growth recommendations through a visual dashboard. The system re-scrapes weekly and updates insights automatically. Everything from content mix breakdowns to 30-day AI-generated content calendars is driven by real data from your niche.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router, Turbopack), Tailwind CSS v4, shadcn/ui, Recharts |
| Backend API | Next.js API routes |
| Automation engine | n8n (self-hosted via Docker) |
| Scraping | Apify (Instagram Post Scraper) |
| AI analysis | Claude API (claude-sonnet-4-5) |
| Database | Supabase (PostgreSQL, REST) |
| Auth | NextAuth.js (credentials, bcrypt) |
| Hosting | Vercel (production: api.narativ.space) |
| Billing | Stripe (planned) |

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Frontend (Next.js)                 │
│         Dashboard · Profile mgmt · Calendar          │
└──────────────────────┬──────────────────────────────┘
                       │ REST / webhooks
┌──────────────────────▼──────────────────────────────┐
│                 Backend API (Next.js)                │
│          Auth · User data · Trigger workflows        │
└──────────────────────┬──────────────────────────────┘
                       │ webhook triggers
┌──────────────────────▼──────────────────────────────┐
│              n8n Automation Engine                   │
│   Workflow 1: Scrape  ·  WF2: Analyse  ·  WF3: Trend│
└───────────┬───────────────────────┬─────────────────┘
            │                       │
┌───────────▼──────┐   ┌────────────▼────────────────┐
│   Apify API      │   │       Claude API             │
│ Instagram/TikTok │   │  Insights · Recommendations  │
│    scraping      │   │    Content calendar          │
└──────────────────┘   └─────────────────────────────┘
            │                       │
┌───────────▼───────────────────────▼─────────────────┐
│              Supabase (PostgreSQL)                   │
│    profiles · posts · scrape_runs · analyses        │
└─────────────────────────────────────────────────────┘
```

## Current Status

### Shipped

- [x] Infrastructure (Docker, n8n, Supabase schema)
- [x] Database schema (`profiles`, `posts`, `scrape_runs`, `analyses`, `recommendations`, `trend_insights`, `users`)
- [x] Workflow 1: Instagram scrape pipeline (poll-loop fixed to wait for full Apify run; returns 100 posts per account)
- [x] Workflow 2: AI analysis pipeline (single-profile Claude analysis → engagement summary + top/worst posts + recommendations)
- [x] Workflow 3: Insights Engine — cross-competitor trend detection (Claude Sonnet 4.5, validated-only trends with competitor_count ≥ 2, multiplier range 1.5–25, safe empty-result handling)
- [x] Auth (NextAuth + Supabase `users` table, signup / login / session)
- [x] Split-screen login / signup pages with animated gradient showcase panel
- [x] Onboarding landing page for zero-profile users (hero + how-it-works + example brief + final CTA)
- [x] Stage-based Overview dashboard (snapshot → account health → content brief as the user progresses)
- [x] Real-time job tracker with bottom-right toast pills + on-card overlays + persistent state across navigation (scrape / analysis / insights)
- [x] Two-tier scrape cooldown (15-min hard block, 24-h soft block with force override)
- [x] Click-guard + freshness check on all action buttons (prevents double-firing Apify runs)
- [x] Insights page: sparse-data CTA, empty-run banner, safety filter that drops fabricated rows
- [x] Deployed to Vercel (production: api.narativ.space)

### Next

- [ ] Data-freshness cooldown for analysis + insights (skip re-runs when inputs haven't changed)
- [ ] Stripe billing
- [ ] Public marketing landing (/ when signed out)
- [ ] TikTok support

## Local Development Setup

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- Node.js 18+ (for the Next.js frontend, coming later)
- Accounts at [Apify](https://console.apify.com), [Supabase](https://supabase.com), and [Anthropic](https://console.anthropic.com)

### 1. Clone the repo

```bash
git clone https://github.com/AndreiCalugar/social-growth-saas.git
cd social-growth-saas
```

### 2. Create your `.env` file

```bash
cp .env.example .env
```

Fill in your keys:

```env
ANTHROPIC_API_KEY=sk-ant-...
APIFY_API_TOKEN=apify_api_...
SUPABASE_ANON_KEY=...
SUPABASE_SECRET_KEY=...
Project_URL=https://your-project.supabase.co
SUPABASE_DB_URL=postgresql://postgres:...@db.your-project.supabase.co:5432/postgres
N8N_API_KEY=...        # generate after first n8n login
```

### 3. Run the database schema

In your Supabase project, go to **SQL Editor** and run:

```bash
schema/001-initial-schema.sql
```

### 4. Start n8n

```bash
docker compose up -d
```

n8n will be available at **http://localhost:5678**

First time only:
1. Create your owner account at http://localhost:5678
2. Go to **Settings → API** → create an API key → add it to `.env` as `N8N_API_KEY`

### 5. Import the workflows

In n8n → **Workflows → Import from file** → pick any file from `n8n-workflows/`.

Activate each workflow with the toggle in the top-right.

### 6. Verify everything is working

```bash
bash scripts/verify-setup.sh
```

### 7. Trigger a test scrape

```bash
curl -X POST http://localhost:5678/webhook/scrape-instagram \
  -H "Content-Type: application/json" \
  -d '{"username": "yourusername"}'
```

## Folder Structure

```
social-growth-saas/
├── docker-compose.yml        # n8n service definition
├── .env                      # API keys (never committed)
├── .env.example              # Template for .env
├── schema/
│   ├── 001-initial-schema.sql       # profiles, posts, scrape_runs
│   └── 002-analyses-schema.sql      # analyses, recommendations
├── n8n-workflows/
│   ├── scrape-pipeline.json         # Workflow 1: Instagram scrape
│   ├── analysis-pipeline.json       # Workflow 2: Claude AI analysis
│   └── cross-analysis-pipeline.json # Workflow 3: Insights Engine (cross-competitor)
├── schema/
│   ├── 001-initial-schema.sql       # profiles, posts, scrape_runs
│   ├── 002-analyses-schema.sql      # analyses, recommendations
│   └── 003-trend-insights.sql       # trend_insights table
├── scripts/
│   └── verify-setup.sh              # Infrastructure health checker
├── docs/
│   ├── MVP-BLUEPRINT.md             # Full product blueprint
│   └── INSIGHTS-ENGINE.md           # Technical overview of Insights Engine
├── src/                             # Next.js app (in progress)
└── CHANGELOG.md
```
