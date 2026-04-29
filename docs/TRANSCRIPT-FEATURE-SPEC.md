# Deep Video Analysis with Transcripts (Phase 2)

**Status:** Spec only. Not implemented. Captured here for when we're ready to build.
**Last updated:** 2026-04-29
**Predecessor:** `feature/insights-themes-redesign` — Phase 1 (top-posts → themes algorithm)

## What this is

After the Phase 1 insights run produces theme cards (~60s end-to-end), an
optional Phase 2 enriches those themes with the actual spoken content from
the top-performing reels. Whisper-transcribed dialogue, pacing notes, and
exact opening hooks replace the generated stubs in the brief.

The intent is *not* to gate Phase 1 on Phase 2 — the user gets workable
themes immediately and Phase 2 layers craft-level depth in the background.

## Original proposal (the user's framing)

```
1. Phase 1 runs as normal (30-60s) → user sees theme cards immediately
2. Phase 2 starts automatically in the background:
   - Take the top 15-20 reels from Phase 1 winner posts (videos only)
   - Use Apify to fetch each video URL
   - Send to OpenAI Whisper for transcription
   - Store transcript on posts.transcript
3. Send transcripts + Phase 1 themes to Claude:
   "For each theme, enhance the brief with exact opening hook, key
   phrases that correlate with high engagement, pacing notes."
4. Update existing trend_insights rows
5. Frontend detects enhancement and upgrades cards in place — shows
   "Enhanced with video analysis" badge

UX: User never waits. Phase 2 enhances over 3-5 minutes in the background.
Toast notification when deep analysis completes.
```

## Architecture decisions

### Video download → Whisper

**Decision: send MP4 directly to Whisper, no audio extraction.**

Whisper accepts MP4/MOV/WebM and extracts audio server-side. n8n's HTTP
node passes binary data through multipart uploads natively. Reels are
typically 5-15MB MP4 H.264, well under Whisper's 25MB cap.

Skipped:
- ffmpeg in n8n container — no payoff vs. complexity.
- Audio-only conversion — Whisper handles MP4 fine on its own.

If a future video exceeds 25MB, fail soft (skip + log) until we actually
have a user hitting the limit — then add transcoding.

### Separate workflow vs. extension of cross-analysis

**Decision: separate n8n workflow, webhook-triggered at the end of Phase 1.**

Rationale:
- Phase 1's webhook responds in ~60s and the frontend depends on that
  latency. Phase 2 takes 3-5 min — entangling them blocks the response.
- Different failure modes (Whisper API errors, video URL expiry, Apify
  quota) warrant different retry/backoff policies.
- If Phase 2 dies, Phase 1 results still ship — graceful degradation.
- Easier to throttle, A/B test, or disable Phase 2 independently.

Pattern:

```
Phase 1 workflow ends with:
  HTTP Request → POST {N8N_URL}/webhook/transcript-enrichment
  body: { profile_id, run_id, theme_ids }

Phase 2 workflow webhook receives, fetches the themes, transcribes,
enriches, persists.
```

### Auto-trigger vs. on-demand

**Decision: opt-in per theme via a "Deep analyze" button. Not auto-fire on every Phase 1 run.**

This is the biggest disagreement with the original proposal. Reasons:
- Most themes are about visual/format (e.g., "Cozy seasonal ambiance shot")
  where transcripts add nothing.
- Phase 2 costs $0.20-0.30 per run; running it on every Phase 1 quintuples
  per-user economics for marginal value on most themes.
- The user knows which themes they want to actually film — let them spend
  the cost where it matters.

Optional middle ground: a global "Auto-enhance reels in every run" toggle
in settings for power users.

### Transcript caching

**Decision: cache transcripts at `posts.transcript`, not at `trend_insights`.**

Once a post is transcribed, never transcribe it again — same video, same
audio. If the same competitor post shows up across multiple analysis runs
(very likely), Phase 2 reads the cache instead of paying Whisper again.
Major cost saver over time.

### Per-theme vs. per-run Claude enrichment

**Decision: one Claude call per theme, not one mega-call across all themes.**

For each theme, send Claude *only* the transcripts of that theme's example
posts plus the existing brief. Reasons:
- Faster (parallelizable across themes).
- Cheaper per call.
- Claude focuses better on a single theme's spoken pattern instead of
  cross-analyzing 20 unrelated transcripts.
- Failures are isolated — one theme's enrichment can fail without taking
  down the rest.

### Progressive UI updates

**Decision: add `trend_insights.enrichment_status` (`pending` / `enriched` / `failed`).**

Frontend polls this and upgrades cards individually as each finishes.
Better UX than "wait 5 min, everything refreshes at once" — user sees
progress.

## Open decisions (need user input when we build)

### Video URL strategy

Instagram CDN URLs are signed and expire in ~24-48 hours. By the time
Phase 2 runs (even minutes after Phase 1), the URL stored at scrape time
may be dead. Three options:

| Approach | Cost / run | Complexity | Notes |
|---|---|---|---|
| Re-scrape just top reels with Apify | ~$0.04-0.05 | Low | 15-20 calls × ~$0.0025. Cleanest. |
| Download videos at scrape time → S3/R2 | ~$0.0001 storage | Medium | Storage plumbing, lifecycle policies. |
| Run Phase 2 immediately after scrape | $0 | Low | Couples Phase 2 to scrape cycles. |

Recommend **option 1** (re-scrape) for v1 — cheapest infrastructure
investment and decouples Phase 2 timing.

### Selectivity

How many reels to transcribe per run? Original proposal said 15-20.
Recommend tighter:

- **Top 10 reels max**, filtered to:
  - `content_type = 'reel'` only (skip image/carousel)
  - `views > 500` (skip thin-engagement noise)
  - At most 2-3 reels per theme (more than that is diminishing returns)

Quality over quantity.

### Multilingual handling

The user's existing data has Romanian competitors. Whisper auto-detects
language correctly, but the Claude enrichment prompt must say:

> "Transcripts may be in different languages. Analyze in original
> language. Quote phrases verbatim. If providing English summaries,
> mark them clearly as paraphrases — never present a translation as
> the original hook."

Otherwise Claude tends to silently translate, killing the value of
"exact spoken hook."

## Cost estimate

Per Phase 2 run (assuming ~15 reels, no transcript cache hits):

| Line item | Cost |
|---|---|
| Apify re-scrape (15-20 calls) | $0.04-0.05 |
| Whisper transcription (~20 min audio @ $0.006/min) | $0.10-0.15 |
| Claude enrichment (per-theme, 5-8 themes) | $0.05-0.10 |
| **Total per run** | **~$0.20-0.30** |

With transcript caching (`posts.transcript`), repeat runs over the same
competitor set drop to roughly:

| Line item | Cost |
|---|---|
| Apify re-scrape (only new posts since last run) | $0.01-0.02 |
| Whisper (only new posts) | $0.02-0.05 |
| Claude enrichment | $0.05-0.10 |
| **Total per repeat run** | **~$0.08-0.15** |

For comparison, Phase 1 alone is ~$0.05/run.

At ~$0.20/run for first-time, ~$0.10/run for repeat, the feature
is sustainable for a paid SaaS tier and prohibitively expensive on a
free tier — which aligns naturally with positioning it as a premium
"Deep analyze" upgrade.

## Technical gotchas

- **Expiring video URLs** — covered by re-scrape strategy.
- **Music-only reels** — Whisper returns empty. Store as `transcript: null`,
  not an error. Themes anchored on music-only reels skip enrichment
  gracefully.
- **Text-on-screen captions as the actual hook** — Whisper misses these.
  OCR is a much bigger project (separate model, frame extraction, etc.).
  Flag as a known v1 limitation; revisit if user demand surfaces.
- **Non-English content** — covered by multilingual prompt note above.
- **Apify rate limits** — fire requests in batches of 5 with a 2-3s delay
  between batches; n8n's `Wait` node handles this.
- **DRM / geo-blocking** — not a concern for typical user reels; Apify
  proxies handle geo if it ever becomes one.

## Schema changes (when we build)

```sql
-- Cache transcripts at the source-of-truth level, not the derived
-- trend_insights level. Once transcribed, a post's transcript is
-- immutable.
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS transcript text,
  ADD COLUMN IF NOT EXISTS transcript_lang text,
  ADD COLUMN IF NOT EXISTS transcribed_at timestamptz;

-- Track Phase 2 progress per theme so the frontend can render
-- card-level upgrade states instead of waiting for the whole run.
ALTER TABLE trend_insights
  ADD COLUMN IF NOT EXISTS enrichment_status text
    CHECK (enrichment_status IS NULL
           OR enrichment_status IN ('pending', 'enriched', 'failed')),
  ADD COLUMN IF NOT EXISTS enrichment_attempted_at timestamptz,
  ADD COLUMN IF NOT EXISTS enriched_at timestamptz;

-- Optional: store enriched brief fields separately so the frontend can
-- show before/after, and so reverting an enrichment doesn't lose the
-- original Phase 1 brief.
ALTER TABLE trend_insights
  ADD COLUMN IF NOT EXISTS enriched_hook text,
  ADD COLUMN IF NOT EXISTS enriched_pacing_notes text,
  ADD COLUMN IF NOT EXISTS enriched_key_phrases text;
```

## API & frontend touchpoints

### New endpoints

- `POST /api/insights/[id]/deep-analyze` — user clicks "Deep analyze" on
  a theme card. Server validates ownership, fires the Phase 2 webhook
  with `theme_ids: [id]`, sets `enrichment_status='pending'`, returns
  202.

### Polling

- Existing `/api/insights` GET response augmented with the new
  `enrichment_status` and `enriched_*` fields.
- Frontend polls every 4-8s while any theme is `pending`, stops when
  all themes are `enriched` or `failed`.

### Card UI states

- **No enrichment yet:** "Deep analyze" button (pay-per-use messaging
  if relevant).
- **Pending:** spinner + "Transcribing top reels…" sub-text.
- **Enriched:** "Enhanced with video analysis" badge + the
  `enriched_hook` replaces the generated `hook` field, key phrases
  appear inline, pacing notes in a new sub-section.
- **Failed:** "Couldn't analyze (no audio / API error)" — show why,
  retry button.

## Recommended approach (TL;DR)

1. Separate Phase 2 n8n workflow, webhook-triggered.
2. Send MP4 directly to Whisper.
3. **Opt-in per theme** via "Deep analyze" button (not auto on every run).
4. Cache transcripts at `posts.transcript` — re-use across analysis runs.
5. **Per-theme Claude enrichment calls**, not one mega-call.
6. `trend_insights.enrichment_status` for progressive card upgrades.
7. Re-scrape via Apify for fresh video URLs (don't store videos ourselves
   in v1).
8. Cap to 10 reels max per analysis, gated on `views > 500`.

Worst-case run cost with these choices: **$0.03-0.08 per user-initiated
theme deep-dive** (1-2 fresh transcripts × Whisper + 1 Claude call).
Cached runs are essentially free.

## Out of scope for v1

- OCR for text-on-screen captions.
- Local video storage (S3/R2) — re-scrape covers v1 needs.
- Auto-enhance every Phase 1 run — keep it opt-in.
- Long-form (>90s IGTV) — file size handling deferred until needed.
- Phase 2 history / version diff UI for enriched briefs.
