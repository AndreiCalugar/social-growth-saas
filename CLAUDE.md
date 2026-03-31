# Developer Setup Guide — Social Growth SaaS
## Everything you need to install and configure, step by step

---

## What you're setting up

| Tool | What it does | Cost |
|------|-------------|------|
| Claude Code | AI coding assistant in your terminal | Requires Claude Pro ($20/mo) or Max ($100/mo) |
| Claude API | Powers the AI analysis in your SaaS | Pay-per-use (~$0.02/analysis). Get key at console.anthropic.com |
| Cursor | Your IDE (you already have this) | You already use this |
| Docker | Runs n8n locally for development | Free |
| n8n | Visual workflow automation (runs inside Docker) | Free (self-hosted) |
| Apify | Scrapes Instagram/TikTok data | Free tier ($5/mo credits). Get API token in Settings → Integrations |
| Supabase | PostgreSQL database (free tier) | Free for dev |

---

## Step 1: Check what you already have

Open your terminal and run these:

```bash
# Check if you have Git
git --version

# Check if you have Node.js (not required for Claude Code native, but useful)
node --version

# Check your OS
# On Mac: sw_vers
# On Windows: winver
# On Linux: uname -a
```

---

## Step 2: Install Docker

### macOS
1. Go to https://www.docker.com/products/docker-desktop/
2. Download Docker Desktop for Mac
3. Open the .dmg file and drag Docker to Applications
4. Launch Docker Desktop from Applications
5. Wait for the whale icon to appear in your menu bar (takes ~1 min)
6. Verify: `docker --version`

### Windows
1. Go to https://www.docker.com/products/docker-desktop/
2. Download Docker Desktop for Windows
3. Run the installer (enable WSL 2 backend when prompted)
4. Restart your computer
5. Launch Docker Desktop
6. Verify in PowerShell: `docker --version`

### Linux
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Log out and back in, then verify:
docker --version
```

---

## Step 3: Install Claude Code

Claude Code now uses a native installer — no Node.js required.

### macOS / Linux
```bash
curl -fsSL https://claude.ai/install.sh | bash
```

### Windows (PowerShell — NOT CMD)
```powershell
irm https://claude.ai/install.ps1 | iex
```

**Important:**
- Close your terminal completely after install, then open a new one
- You need a Claude Pro plan ($20/mo) minimum — the free plan doesn't include Claude Code
- Claude Code also works inside Cursor (it has a VS Code extension)

### Verify installation
```bash
claude --version
```

### First-time authentication
```bash
claude
```
This opens your browser for a one-time sign-in. After that, you're authenticated.

---

## Step 4: Get your API keys

You need 3 API keys. Save them somewhere secure (a .env file, NOT in code).

### 1. Claude API Key (for your SaaS product's AI analysis)
1. Go to https://console.anthropic.com
2. Sign up / log in
3. Go to API Keys → Create Key
4. Copy the key (starts with `sk-ant-...`)
5. Add ~$10 credits to start (Settings → Billing)

### 2. Apify API Token
1. Go to https://console.apify.com
2. Log in (you already have an account from the scraping)
3. Go to Settings → Integrations → API tokens
4. Copy your Personal API token

### 3. Supabase (Database)
1. Go to https://supabase.com → Start your project
2. Create a new project (free tier)
3. Choose a region close to you (EU West)
4. Save the database password they generate
5. Go to Settings → API → copy the `URL` and `anon key`
6. Go to Settings → Database → copy the `Connection string`

---

## Step 5: Start n8n with Docker

Run this single command to start n8n locally:

```bash
docker run -it --rm \
  --name n8n \
  -p 5678:5678 \
  -v n8n_data:/home/node/.n8n \
  -e GENERIC_TIMEZONE="Europe/Bucharest" \
  docker.n8n.io/n8nio/n8n
```

Then open your browser to: http://localhost:5678

First time:
- Create an n8n account (local, just email + password)
- You'll see the workflow editor — this is where you build your automation

To stop n8n: press Ctrl+C in the terminal.
To restart: run the same docker command again (your workflows are saved in the volume).

---

## Step 6: Create your project and open Claude Code

```bash
# Create the project directory
mkdir social-growth-saas
cd social-growth-saas

# Initialize the project
git init

# Create a .env file for your keys (NEVER commit this)
cat > .env << 'EOF'
ANTHROPIC_API_KEY=sk-ant-your-key-here
APIFY_API_TOKEN=apify_api_your-token-here
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_DB_URL=postgresql://postgres:your-password@db.your-project.supabase.co:5432/postgres
EOF

# Add .env to gitignore
echo ".env" > .gitignore

# Create a CLAUDE.md file (Claude Code reads this for project context)
cat > CLAUDE.md << 'EOF'
# Social Growth SaaS

## Project overview
A SaaS platform that scrapes Instagram/TikTok data via Apify, analyzes it with Claude API, and presents growth insights through a dashboard.

## Tech stack
- n8n for workflow automation (scraping + analysis pipelines)
- Next.js 14 + Tailwind + shadcn/ui for frontend
- Supabase (PostgreSQL) for database
- Prisma for ORM
- Apify API for social media scraping
- Claude API (Sonnet) for AI analysis

## Current phase
Building the n8n automation pipeline (Workflow 1: Scrape Pipeline)

## Key files
- .env — API keys (never commit)
- n8n-workflows/ — exported workflow JSON files
- src/ — Next.js application (coming later)
EOF

# Now launch Claude Code
claude
```

---

## Step 7: Your first Claude Code session

Once Claude Code is running, give it this first prompt:

```
I'm building an n8n workflow that scrapes Instagram profiles using the Apify API.

Here's what the workflow should do:
1. Accept an Instagram username as input (webhook trigger)
2. Call the Apify Instagram Post Scraper API to scrape the last 100 posts
3. Wait for the Apify run to complete
4. Fetch the dataset results
5. Transform the data (normalize fields, calculate engagement rate)
6. Store the results in my Supabase PostgreSQL database

My Apify API token is in .env as APIFY_API_TOKEN.
My Supabase connection string is in .env as SUPABASE_DB_URL.

Help me create:
1. The n8n workflow JSON file I can import
2. A SQL schema for the posts table in Supabase
3. A test script to verify the Apify API connection works
```

---

## IDE Setup (Cursor)

Cursor works great alongside Claude Code. Here's how to use both:

- **Cursor**: for browsing code, manual edits, git diffs, and visual review
- **Claude Code (terminal)**: for generating code, building features, debugging

You can also install the Claude Code extension in Cursor:
1. Open Cursor
2. Go to Extensions (Cmd+Shift+X / Ctrl+Shift+X)
3. Search "Claude Code"
4. Install the Anthropic extension
5. Click the spark icon in the top-right to open Claude Code inside Cursor

Or just run `claude` in Cursor's integrated terminal — both approaches work.

---

## Quick reference: daily workflow

```bash
# Start your dev environment
docker start n8n                    # If n8n container exists
# OR
docker run ... (the full command)   # If first time

# Open n8n in browser
open http://localhost:5678          # Mac
start http://localhost:5678         # Windows

# Open your project in Cursor
cursor social-growth-saas/

# Start Claude Code in the project
cd social-growth-saas
claude
```

---

## Costs summary

| Service | Monthly cost | Notes |
|---------|-------------|-------|
| Claude Pro (for Claude Code) | $20 | Or Max $100 for more usage |
| Claude API (for SaaS analysis) | ~$5-10 | Pay per use, scales with users |
| Apify | $0-5 | Free tier gives $5/mo credits |
| Supabase | $0 | Free tier for development |
| Docker | $0 | Free |
| n8n (self-hosted) | $0 | Free when self-hosted |
| **Total to start** | **~$25/mo** | |
