# Insights Engine — Technical Overview

Built on branch: `feature/insights-engine`

---

## What It Is

The Insights Engine is the core product feature. It is **not** a dashboard that shows numbers — it is a cross-competitor trend detection system that analyzes posts from all tracked competitor accounts together and produces specific "mega-tips": actionable instructions telling the user exactly what content to create.

A mega-tip is defined as a validated content pattern that:
1. Appears in the top 20% of posts (by likes) for 2+ competitor accounts
2. Has a performance multiplier > 2× average engagement
3. The user's own account is **not** already doing it

---

## Git Log — All Commits on This Branch

```
b740d97 Add error logging to all API routes and fix insights error handling
3a24706 Step 4: Update sidebar with prominent Insights link and add trends CTA card to overview
1d9b81b Step 3: Add /insights page, API route, and InsightsClient component
2079ad2 Step 2: Add cross-competitor analysis n8n workflow (Insights Engine)
242a1fc Step 1: Add trend_insights schema migration
41d105a Update CLAUDE.md with insights engine product direction
```

---

## Files Created or Modified

### New files
| File | Purpose |
|---|---|
| `schema/003-trend-insights.sql` | Adds `trend_insights` table to Supabase |
| `n8n-workflows/cross-analysis-pipeline.json` | n8n Workflow 3 — the full analysis pipeline |
| `src/src/app/insights/page.tsx` | Server component — `/insights` route |
| `src/src/app/api/insights/route.ts` | GET API route — fetches latest batch of insights from Supabase |
| `src/src/components/insights-client.tsx` | Client component — Generate button, polling, mega-tip cards |

### Modified files
| File | What changed |
|---|---|
| `CLAUDE.md` | Replaced setup boilerplate with product vision + current phase |
| `src/src/app/page.tsx` | Added trends CTA card linking to /insights, fetches trendCount |
| `src/src/components/sidebar.tsx` | Insights link styled in orange with NEW badge; uses Sparkles icon |
| `src/src/app/api/profiles/route.ts` | Added request/response logging |
| `src/src/app/api/profiles/[id]/route.ts` | Added request/response logging |
| `src/src/app/api/competitors/route.ts` | Added request/response logging |
| `src/src/app/api/scrape-status/[profileId]/route.ts` | Added request/response logging |

---

## Database Schema Added

**File:** `schema/003-trend-insights.sql`

```sql
CREATE TABLE IF NOT EXISTS trend_insights (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id             uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  trend_name             text NOT NULL,
  confidence             float,          -- ratio 0.0–1.0 (e.g. 0.67 = 2/3 competitors)
  performance_multiplier float,          -- avg likes of pattern posts / avg likes overall
  example_posts          jsonb,          -- array of {caption_preview, likes, comments, competitor}
  recommendation         text,           -- the mega_tip text from Claude
  suggested_schedule     text,           -- reserved for future use
  is_mega_tip            boolean DEFAULT false,
  created_at             timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trend_insights_profile_id_idx ON trend_insights(profile_id);
CREATE INDEX IF NOT EXISTS trend_insights_created_at_idx ON trend_insights(created_at);
```

**Note:** `confidence` is stored as a float ratio but was also returned as a string label (e.g. `"2/3 competitors"`) from Claude. The label is computed at display time from the float. The `why_it_works` and `user_doing_it` fields from Claude are not persisted — they are used only to compute `is_mega_tip` before insert.

**Status:** Table must be created manually. Direct Postgres connections to Supabase are blocked from this machine. Run the SQL in Supabase → SQL Editor.

---

## End-to-End Data Flow

```
User clicks "Generate Insights"
         │
         ▼
InsightsClient.handleGenerate()
  POST http://localhost:5678/webhook/cross-analysis
  body: { own_profile_id: "uuid" }
         │
         ▼
n8n Webhook Trigger (path: cross-analysis)
         │
         ▼
Validate Input (Code node)
  - Extracts own_profile_id from body
  - Validates UUID format
         │
         ├──────────────────────────────┐
         ▼                              ▼
Fetch Own Posts                  Fetch Competitors
  GET /rest/v1/posts               GET /rest/v1/profiles
  ?profile_id=eq.{id}             ?is_own=eq.false
  &order=likes.desc                &platform=eq.instagram
  &limit=100                       → array of {id, username, followers}
  → own posts array
         │                              │
         └──────────┬───────────────────┘
                    ▼
             Merge Profiles (Code node)
               - Reads Fetch Own Posts via $('Fetch Own Posts')
               - Reads Fetch Competitors via $input
               - Validates ≥2 competitors exist
               - Builds competitor_ids array for IN query
                    │
                    ▼
         Fetch All Competitor Posts
           GET /rest/v1/posts
           ?profile_id=in.(id1,id2,id3)
           &order=likes.desc&limit=300
           → all competitor posts in one query
                    │
                    ▼
         Build Claude Prompt (Code node)
           - Groups posts by profile_id
           - Formats own posts (top 30) + competitor posts (top 50 each)
           - Sanitizes unicode/emoji from captions
           - Assembles system_prompt + user_prompt strings
                    │
                    ▼
         Call Claude API
           POST https://api.anthropic.com/v1/messages
           model: claude-sonnet-4-5
           max_tokens: 4096
           → JSON array of trend objects
                    │
                    ▼
         Parse & Enrich Response (Code node)
           - Strips markdown code fences if present
           - JSON.parse() Claude's response
           - Validates it's an array
           - Converts confidence "2/3" → 0.67 float
           - Sets is_mega_tip = user_doing_it === false && multiplier > 2
           - Outputs one item per trend (n8n fan-out)
                    │
                    ▼ (once per trend)
         Insert Trend Insight
           POST /rest/v1/trend_insights
           → saved row with uuid, profile_id, trend data
                    │
                    ▼
         Build Response (Code node)
           - Collects all inserted trends
           - Returns summary: { success, trends_detected, mega_tips, insights[] }
                    │
                    ▼
         Respond Success → HTTP 200 JSON back to frontend
                    │
                    ▼
InsightsClient receives response
  - Starts polling /api/insights every 3s
  - When rows appear in DB, stops polling
  - Renders mega-tip cards
```

**On error (before Respond Success):** n8n returns empty HTTP 200 body. The frontend detects the empty body and shows: _"The n8n workflow crashed before finishing. Most likely cause: the trend_insights table doesn't exist in Supabase yet."_

---

## Claude API Prompt

### System prompt

```
You are a social media growth analyst specialising in Instagram content strategy.
Analyze all provided posts and detect content patterns that consistently outperform
average engagement. Return ONLY a valid JSON array, no markdown, no code blocks, no
explanation outside the JSON. Be extremely specific in mega_tip recommendations —
tell the creator exactly what video to make, what hook to use in the first 3 seconds,
caption structure, and best posting day/time.
```

### User prompt (template — {N} = number of competitors)

```
Analyze the following Instagram posts from {N} competitor accounts plus the user's own account.

IDENTIFY CONTENT PATTERNS across all accounts. Consider patterns such as: episodic series,
problem/solution, gear review, montage/recap, origin story, vulnerability/personal story,
human connection moment, educational how-to, food and culture, scenic adventure,
behind-the-scenes, challenge/transformation, Q&A, day-in-life, gear failure/mistake,
achievement celebration, myth-busting, comparison, route/destination reveal.

For EACH pattern identified:
1. Determine which competitors have it in their TOP 20% posts by likes
2. Only include the pattern if it appears in top 20% posts of 2+ competitors (VALIDATED TREND)
3. Calculate performance_multiplier = average likes of posts with this pattern /
   average likes of all posts for that competitor

--- OWN ACCOUNT ({own_count} posts, top by likes) ---
  1. [reel    ] 2025-09-14 | L:25420 C:312 V:189000 | "caption preview..."
  ...

--- COMPETITOR: @irina.narativa ({count} posts) ---
  1. [reel    ] 2026-01-15 | L:4200 C:89 V:52000 | "caption preview..."
  ...

--- COMPETITOR: @zicho.hu ({count} posts) ---
  ...

Return a JSON ARRAY (3–7 items max), sorted by performance_multiplier descending.
Each item MUST have exactly this structure:

{
  "trend_name": "Short descriptive name like 'Episodic Series Content'",
  "confidence": "X/{N} competitors",
  "performance_multiplier": 3.2,
  "why_it_works": "1-2 sentences explaining the psychological/algorithmic reason",
  "example_posts": [
    {"caption_preview": "first 80 chars", "likes": 1234, "comments": 56, "competitor": "@username"},
    {"caption_preview": "...", "likes": 890, "comments": 34, "competitor": "@username"},
    {"caption_preview": "...", "likes": 567, "comments": 23, "competitor": "@username"}
  ],
  "mega_tip": "VERY SPECIFIC instruction: describe exactly what to film, the opening hook
               line word-for-word, caption structure with example hashtags, and ideal posting
               day and time. Minimum 3 sentences.",
  "user_doing_it": true
}

Critical rules:
- performance_multiplier must be a number, not a string
- example_posts must have exactly 3 entries
- user_doing_it must be a boolean
- Return ONLY the JSON array
```

### Claude response shape (per trend)

```json
{
  "trend_name": "First-Time Journey Montage",
  "confidence": "2/2 competitors",
  "performance_multiplier": 13.2,
  "why_it_works": "Debut content triggers curiosity and the algorithm rewards novelty...",
  "example_posts": [...],
  "mega_tip": "Film a 60-second reel showing your first day on the trail...",
  "user_doing_it": false
}
```

---

## Frontend — Insights Page

### `/insights` route (server component)

**File:** `src/src/app/insights/page.tsx`

On load:
1. Fetches own profile (`is_own = true`)
2. Counts competitors with scraped posts
3. If `competitorCount < 3` → renders "Add 3 competitors" gate
4. If enough competitors → fetches latest batch of `trend_insights` from DB (within 10-minute window of most recent row)
5. Renders `<InsightsClient>` with initial data

### `InsightsClient` (client component)

**File:** `src/src/components/insights-client.tsx`

States: `idle | generating | done | error`

**Generate button flow:**
1. `handleGenerate()` — POSTs to `http://localhost:5678/webhook/cross-analysis`
2. Reads response as text first (never calls `.json()` directly — guards against empty body)
3. If empty body: throws error with explanation about missing table
4. If valid JSON and `success: true`: starts polling `/api/insights?profile_id=...` every 3 seconds
5. Polling stops when new rows appear or after 60s timeout

**Card rendering:**
- Mega-tips (orange border, MEGA TIP badge) rendered first
- Other detected trends rendered below in a 2-column grid
- Each card shows: trend name, confidence badge, engagement multiplier, top 3 example posts (mini table), mega_tip text in highlighted box
- `user_doing_it === false` → red "You're not doing this yet" badge
- `user_doing_it === true` → green "You're already doing this" badge

### `/api/insights` route

**File:** `src/src/app/api/insights/route.ts`

- GET with `?profile_id=uuid`
- Finds most recent `trend_insights` row for that profile
- Fetches all rows within 10 minutes of that timestamp (one "analysis batch")
- Returns `{ insights: [...] }` ordered by `performance_multiplier DESC`
- Detects missing table (Supabase PGRST205 error) and returns a helpful error string

---

## n8n Workflow — Node Summary

**Workflow ID in n8n:** `BZfRSfhfncEkmKQx`
**Webhook path:** `POST /webhook/cross-analysis`
**File:** `n8n-workflows/cross-analysis-pipeline.json` (secrets replaced with `YOUR_*` placeholders)

| Node | Type | Purpose |
|---|---|---|
| Webhook Trigger | webhook | Entry point, `responseMode: responseNode` |
| Validate Input | code | UUID validation of `own_profile_id` |
| Fetch Own Posts | httpRequest | GET own posts from Supabase (top 100 by likes) |
| Fetch Competitors | httpRequest | GET all competitor profiles |
| Merge Profiles | code | Joins upstream data, validates ≥2 competitors, builds `competitor_ids` |
| Fetch All Competitor Posts | httpRequest | GET all competitor posts in one IN() query (limit 300) |
| Build Claude Prompt | code | Formats posts as text table, assembles system + user prompts |
| Call Claude API | httpRequest | POST to Anthropic /v1/messages, `claude-sonnet-4-5`, 4096 tokens |
| Parse & Enrich Response | code | Parses JSON, strips fences, computes `is_mega_tip`, fan-out |
| Insert Trend Insight | httpRequest | POST each trend to Supabase `trend_insights` |
| Build Response | code | Assembles summary JSON |
| Respond Success | respondToWebhook | Returns JSON to original webhook caller |
| Error Trigger | errorTrigger | Fires in new execution on any node failure |
| Respond Error | respondToWebhook | Returns `{success: false, error: "..."}` (separate execution) |

**Known n8n limitation:** The Error Trigger fires in a *separate execution*, not the same one as the webhook. So when the main workflow errors, the original webhook call returns an empty body (not the error JSON). The frontend handles this by reading the body as text and checking for empty string.

---

## Navigation Changes

**Sidebar (`src/src/components/sidebar.tsx`):**
- Insights uses `Sparkles` icon instead of `Lightbulb`
- Styled orange when inactive (`.text-orange-600`, `.hover:bg-orange-50`)
- Shows `NEW` pill badge when not on the insights route
- Active state: `bg-orange-100 text-orange-700 font-semibold`

**Overview page (`src/src/app/page.tsx`):**
- Added `trendCount` and `megaTipCount` fetched from `trend_insights`
- Renders a CTA card at the bottom:
  - If trends exist: "X trends detected in your niche · Y mega-tips you should act on now"
  - If no trends: "Discover what content to create" → links to /insights

---

## Current Status

| Component | Status |
|---|---|
| Schema file written | ✅ |
| Schema applied to Supabase | ❌ **Needs manual step** — run `schema/003-trend-insights.sql` in Supabase SQL Editor |
| n8n workflow (Workflow 3) | ✅ Active in n8n (`BZfRSfhfncEkmKQx`) |
| Claude analysis | ✅ Confirmed working — execution 53 produced trends before table insert failed |
| `/insights` page | ✅ Builds clean, renders correctly |
| `/api/insights` route | ✅ Working, returns `{insights: []}` until table exists |
| Frontend error handling | ✅ Shows actionable message on empty n8n response |
| Sidebar + Overview CTA | ✅ Working |

**One remaining action to make it fully functional:**
Go to [Supabase SQL Editor](https://supabase.com/dashboard/project/arujkowiihftpghmxlwv/sql) and run the contents of `schema/003-trend-insights.sql`. After that, clicking Generate Insights will complete end-to-end and save trends to the database.

---

## Sample Output from Test Run (Execution 53)

Claude successfully analyzed posts from `andreixperience` + `irina.narativa` + `zicho.hu` and returned:

| Trend | Multiplier | Competitors |
|---|---|---|
| First-Time Journey Montage/Recap | 13.2× | 2/2 |
| Community Trip Announcement/CTA | 1.0× | 2/2 |
| Vulnerability & Struggle Confession | 0.92× | 2/2 |

The workflow failed only at the Supabase insert step (missing table), not in the Claude analysis step.
