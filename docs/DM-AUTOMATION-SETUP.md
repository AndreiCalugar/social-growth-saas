# DM Automation — Setup & Operations

Comment-to-DM automation ("someone comments LINK → they get a DM"), built on
the official **Instagram API with Instagram Login**. Core logic ported from the
MIT-licensed [OpenReply](https://github.com/diwenne/openreply) and adapted to
our stack: Supabase instead of Prisma, a `dm_logs` DB queue drained by cron
instead of Redis/BullMQ.

## Architecture at a glance

```
IG comment → Meta webhook → POST /api/instagram/webhook
                              (verify signature, dedup, keyword-match,
                               insert dm_logs row status='pending')

system cron (every minute) → GET /api/cron/process-dms
                              (claim pending rows, rate-limit 700/hr/account,
                               send private reply + optional public reply,
                               retries with backoff)

system cron (daily)        → GET /api/cron/refresh-tokens
                              (refresh 60-day tokens expiring within 10 days)
```

Key files:
- `schema/017-dm-automation.sql` — tables (run it in Supabase before anything)
- `src/src/lib/meta/` — OAuth + crypto, Graph API client, webhook parsing, keyword matcher
- `src/src/app/api/instagram/{connect,callback,disconnect,posts,webhook}/`
- `src/src/app/api/cron/{process-dms,refresh-tokens}/`
- `src/src/app/(app)/dms/` + `src/src/components/dms-client.tsx` — UI
- Settings card: `src/src/components/instagram-connect-card.tsx`

## One-time setup checklist

### 1. Database

Run the migration in the Supabase SQL editor (or psql):

```
psql $SUPABASE_DB_URL -f schema/017-dm-automation.sql
```

### 2. Meta developer app

1. Go to [developers.facebook.com/apps](https://developers.facebook.com/apps) →
   **Create App** → type **Business**.
2. Add the use case **"Manage messaging and content on Instagram"**
   (this is the "Instagram API with Instagram Login" — NOT Facebook Login,
   NOT the Marketing API).
3. **Instagram → API setup with Instagram login**: copy the
   **Instagram App ID** and **Instagram App Secret** → `INSTAGRAM_APP_ID`,
   `INSTAGRAM_APP_SECRET`.
4. **App Settings → Basic**: copy the **App Secret** → `FACEBOOK_APP_SECRET`
   (webhook signatures may be signed with either secret; we accept both).
5. Add the OAuth redirect URI:
   `https://www.getsocialgrowth.tech/api/instagram/callback`
6. **Webhooks** (deploy the app FIRST — Meta validates the URL immediately):
   - Callback URL: `https://www.getsocialgrowth.tech/api/instagram/webhook`
   - Verify token: the value you put in `WEBHOOK_VERIFY_TOKEN`
   - Subscribe to the **comments** and **messages** fields.
7. **App Roles → Instagram Testers**: add each beta user's IG account
   (must be **Business or Creator**, not personal). They must accept the
   invite in the Instagram app: Settings → Website permissions → Apps and
   websites → Tester invites.
8. Switch the app to **Live** mode. Testers work without App Review — and
   their automations reach **every** commenter, not just other testers.
9. Later, to open the feature to arbitrary users: submit for **Advanced
   Access** review of the 3 `instagram_business_*` scopes (needs business
   verification + a screencast; see docs/META-APP-REVIEW.md). Until then,
   only accounts with a role on the app can connect.

### 3. Environment variables

Add to `src/.env.local` (dev) and the Hostinger environment (prod) — see the
new block in `.env.example`: `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`,
`FACEBOOK_APP_SECRET`, `META_GRAPH_API_VERSION`, `WEBHOOK_VERIFY_TOKEN`,
`ENCRYPTION_KEY` (`openssl rand -hex 32`), `CRON_SECRET`.

`NEXTAUTH_URL` must be the public URL (`https://www.getsocialgrowth.tech`) —
the OAuth redirect and callback build on it.

### 4. Cron jobs (Vercel + external pinger)

The app deploys on **Vercel** (project `social-growth-saas`). Vercel's built-in
crons on the Hobby plan run at most **once per day**, so the two jobs split:

- **Daily token refresh** — `src/vercel.json` declares a Vercel cron for
  `/api/cron/refresh-tokens` at 04:00 UTC. When `CRON_SECRET` is set as an
  env var, Vercel automatically sends `Authorization: Bearer $CRON_SECRET`
  on cron invocations — exactly what the route expects. Nothing else to do.
- **Queue drain (every minute)** — Supabase `pg_cron` + `pg_net` call
  `https://www.getsocialgrowth.tech/api/cron/process-dms` every minute with
  `Authorization: Bearer <CRON_SECRET>`. Run `schema/018-dm-cron.sql` in the
  Supabase SQL Editor with the real secret filled in (never commit it).
  Check it with `SELECT status_code, created FROM net._http_response ORDER BY
  created DESC LIMIT 5;` — 401 means the secret doesn't match Vercel's.
  Each run also polls watched posts for comments the webhook missed.

The 1-minute cadence means worst-case ~1–2 min DM latency — fine for MVP.

## Local development

Meta can't reach localhost. Use a tunnel and a **second dev Meta app** so the
prod app's webhook config stays untouched:

```bash
cloudflared tunnel --url http://localhost:3000   # or ngrok http 3000
```

Point the dev app's redirect URI + webhook callback at the tunnel URL, and set
`NEXTAUTH_URL` to the tunnel URL while testing OAuth.

## Constraints worth remembering

- **Business/Creator accounts only** — personal IG accounts fail OAuth.
- **One IG account = one tenant** (`instagram_accounts.instagram_id` is
  globally unique).
- **Tokens live 60 days**; the daily cron refreshes anything expiring within
  10 days. A password change kills the token immediately → the account row
  gets `token_error` set and the UI shows a "Reconnect" prompt.
- **Meta caps private replies at 750/hour/account**; we stop at 700 and
  requeue the rest 30 minutes out.
- **Private replies must be sent within 7 days** of the comment.
- The webhook route always returns 200 once the signature verifies — Meta
  disables subscriptions that keep failing. Errors land in `webhook_events`.
- Automation post ids are **Graph API media ids** (picked via
  `/api/instagram/posts`), never the Apify `posts.platform_post_id`.
