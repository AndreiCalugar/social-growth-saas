# Social Growth SaaS

> AI-powered Instagram analytics that turns competitor posts into a slate of actionable content themes.

## What it does

You add 3–7 competitors. The platform scrapes ~100 recent posts from each via Apify, scores them by per-creator outlier ratio, then asks Claude to group the top 50 winners into 5–8 filmable content themes — each one tied to specific format, hook, caption, posting-time, and hashtag guidance. Claude auto-detects your niche from your own posts, drops off-niche viral content, and flags themes you're already executing with a "refine your version" tip. Save any theme as a brief, AI-expand it into hook/content/caption variations, and schedule it.

The **Insights page** (`/insights`) is the core product — cross-competitor theme detection. Everything else (profile management, scrape pipeline, briefs workshop) is supporting context.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router, Turbopack), Tailwind CSS v4, shadcn/ui, Recharts |
| Backend API | Next.js API routes |
| Automation | n8n (self-hosted via Docker) |
| Scraping | Apify (Instagram Post Scraper) |
| AI | Claude API (claude-sonnet-4-5, 12K max_tokens for the insights run) |
| Database | Supabase (PostgreSQL via REST) |
| Auth | NextAuth.js (credentials, bcrypt) |
| Hosting | Vercel (production: api.narativ.space) |
| Billing | Stripe (planned) |

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Frontend (Next.js)                 │
│   Insights · Briefs workshop · Profiles · Overview   │
└──────────────────────┬──────────────────────────────┘
                       │ REST / webhooks
┌──────────────────────▼──────────────────────────────┐
│                 Backend API (Next.js)                │
│       Auth · CRUD · Trigger n8n · Brief expand       │
└──────────────────────┬──────────────────────────────┘
                       │ webhook triggers
┌──────────────────────▼──────────────────────────────┐
│              n8n Automation Engine                   │
│   WF1: Scrape  ·  WF2: Per-profile  ·  WF3: Themes  │
└───────────┬───────────────────────┬─────────────────┘
            │                       │
┌───────────▼──────┐   ┌────────────▼────────────────┐
│    Apify API     │   │       Claude API             │
│   Instagram      │   │  Theme grouping + briefs     │
│    scraping      │   │  Niche detection + filtering │
└──────────────────┘   └─────────────────────────────┘
            │                       │
┌───────────▼───────────────────────▼─────────────────┐
│              Supabase (PostgreSQL)                   │
│   profiles · posts · scrape_runs · trend_insights   │
│   saved_briefs · users                              │
└─────────────────────────────────────────────────────┘
```

## Current Status

### Shipped

- [x] Auth (NextAuth + Supabase `users`, signup / login / session)
- [x] Split-screen login / signup with animated showcase panel
- [x] Onboarding landing for zero-profile users
- [x] Stage-based Overview dashboard (snapshot → account health → content brief)
- [x] Profiles + Competitors pages with AI-suggested handles via discovery hashtags
- [x] Workflow 1: Instagram scrape pipeline (poll-loop fixed, 100 posts/account, 15-min hard cooldown + 24-h soft block, click-guard)
- [x] Workflow 2: Per-profile Claude analysis (single-account engagement summary + recommendations)
- [x] **Workflow 3: Insights Engine — the core product**
  - Top-50 winners algorithm (deterministic scoring `outlier_ratio × log10(likes)`, then Claude grouping)
  - Per-creator median (not mean) so a single viral hit doesn't pull its own baseline up
  - Niche auto-detected from user's own top 10 posts; off-niche viral content filtered with auditable diag
  - Multiplier cap at 50× (with `50+` indicator) to prevent absurd values from skewed historical medians
  - Two-section UI: New opportunities (themes you don't yet do) + Refinements (themes you already do, with a specific competitor-edge tweak)
- [x] Briefs workshop: save themes, AI-expand into hook/content/caption variations, customize, schedule, status pills (saved → planning → filming → filmed → posted)
- [x] Real-time job tracker (bottom-right toast pills + on-card overlays + persistent state across navigation, separate timeouts per kind)
- [x] Empty-run banner + diag payload exposing exactly which stage dropped trends
- [x] Multiplier badge with portal-based explainer tooltip
- [x] Deployed to Vercel (production: api.narativ.space)

### Documented, not built

- [ ] **Phase 2: Whisper transcripts** — opt-in deep-analyze on individual themes that fetches the top reel videos, transcribes via OpenAI Whisper, and enriches briefs with exact spoken hooks + pacing notes. Full architecture spec at [`docs/TRANSCRIPT-FEATURE-SPEC.md`](docs/TRANSCRIPT-FEATURE-SPEC.md).

### Next (rough priority)

- [ ] First-run onboarding wizard (signup → add competitors → scrape all → first insight)
- [ ] Auto re-scrape + data-freshness indicator ("Last scraped 12 days ago — refresh?")
- [ ] Phase 2 transcripts (per spec above)
- [ ] Brief → publish integration (Buffer / Later / Meta API)
- [ ] Stripe billing + tier gating
- [ ] Public marketing landing page (`/` when signed out)

## Local Development Setup

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- Node.js 18+ for the Next.js frontend
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

### 3. Run the database migrations

In your Supabase project, **SQL Editor** → run each file in `schema/` in order:

```
schema/001-initial-schema.sql
schema/002-analyses-schema.sql
schema/003-trend-insights.sql
schema/004-users-auth.sql
schema/005-restore-profiles-unique.sql
schema/006-trend-insights-structured-brief.sql
schema/007-saved-briefs.sql
schema/008-discovery-hashtags.sql
schema/009-trend-insights-competitor-edge.sql
schema/010-trend-type.sql
schema/011-detected-niche.sql
```

All migrations are `IF NOT EXISTS` / idempotent — safe to re-run.

### 4. Start n8n

```bash
docker compose up -d
```

n8n will be available at **http://localhost:5678**.

First time only:
1. Create your owner account at http://localhost:5678
2. Go to **Settings → API** → create an API key → add it to `.env` as `N8N_API_KEY`

### 5. Import the workflows

In n8n → **Workflows → Import from file** → import each file from `n8n-workflows/`:
- `scrape-pipeline.json`
- `analysis-pipeline.json`
- `cross-analysis-pipeline.json`

Activate each workflow with the toggle in the top-right.

> **Heads up:** every time `n8n-workflows/cross-analysis-pipeline.json` is updated in this repo, you have to re-import it into your n8n instance — the imported workflow doesn't auto-sync from the file.

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

### 8. Start the frontend

```bash
cd src
npm install
npm run dev
```

Open http://localhost:3000.

## Folder Structure

```
social-growth-saas/
├── docker-compose.yml              # n8n service definition
├── .env                            # API keys (never committed)
├── .env.example                    # Template for .env
├── schema/                         # Supabase migrations, run in order
│   ├── 001-initial-schema.sql
│   ├── 002-analyses-schema.sql
│   ├── 003-trend-insights.sql
│   ├── 004-users-auth.sql
│   ├── 005-restore-profiles-unique.sql
│   ├── 006-trend-insights-structured-brief.sql
│   ├── 007-saved-briefs.sql
│   ├── 008-discovery-hashtags.sql
│   ├── 009-trend-insights-competitor-edge.sql
│   ├── 010-trend-type.sql
│   └── 011-detected-niche.sql
├── n8n-workflows/
│   ├── scrape-pipeline.json        # WF1: Instagram scrape
│   ├── analysis-pipeline.json      # WF2: Per-profile Claude analysis
│   └── cross-analysis-pipeline.json # WF3: Insights Engine (top-50 → themes)
├── scripts/
│   ├── seed-users.js               # Test user seeder
│   └── verify-setup.sh             # Infrastructure health checker
├── docs/
│   ├── MVP-BLUEPRINT.md            # Full product blueprint
│   ├── INSIGHTS-ENGINE.md          # Insights Engine technical overview
│   └── TRANSCRIPT-FEATURE-SPEC.md  # Phase 2 (transcripts) architecture spec
├── src/                            # Next.js app
│   └── src/
│       ├── app/                    # App Router pages + API routes
│       └── components/             # React components
└── CHANGELOG.md
```
