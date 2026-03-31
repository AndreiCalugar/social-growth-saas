# Social Growth SaaS

> AI-powered Instagram & TikTok analytics platform that turns raw social data into actionable growth insights.

## What it does

Users connect their Instagram and TikTok profiles, add competitor accounts, and the platform automatically scrapes post data via Apify, analyzes it with Claude AI, and surfaces growth recommendations through a visual dashboard. The system re-scrapes weekly and updates insights automatically. Everything from content mix breakdowns to 30-day AI-generated content calendars is driven by real data from your niche.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, Tailwind CSS, shadcn/ui |
| Backend API | Next.js API routes |
| Automation engine | n8n (self-hosted via Docker) |
| Scraping | Apify (Instagram Post Scraper, TikTok Scraper) |
| AI analysis | Claude API (claude-sonnet-4-6) |
| Database | Supabase (PostgreSQL) |
| ORM | Prisma |
| Auth | NextAuth.js |
| Billing | Stripe |

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

- [x] Project infrastructure (Docker, n8n, Supabase schema)
- [x] Database schema (`profiles`, `posts`, `scrape_runs`)
- [x] Workflow 1: Instagram scrape pipeline (working end-to-end)
- [ ] Workflow 2: AI analysis pipeline (Claude API)
- [ ] Workflow 3: Trend monitor (daily cron)
- [ ] Frontend dashboard (Next.js)
- [ ] Auth system (NextAuth)
- [ ] Stripe billing
- [ ] Landing page

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
│   └── 001-initial-schema.sql   # Supabase PostgreSQL schema
├── n8n-workflows/
│   └── scrape-pipeline.json     # Workflow 1: Instagram scrape
├── scripts/
│   └── verify-setup.sh          # Infrastructure health checker
├── docs/
│   └── MVP-BLUEPRINT.md         # Full product blueprint
├── src/                         # Next.js app (coming Phase 1)
└── CHANGELOG.md
```
