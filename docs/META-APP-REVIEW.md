# Meta App Review — Advanced Access submission package

Everything needed to open the Instagram DM automation to **any creator**, not
just accounts we add by hand.

## What Standard Access allows today (verified 2026-11-03)

- Only accounts with a **role on the app** (admin, developer, Instagram
  Tester) can complete Instagram Login and connect.
- Once connected, the automation works for **every commenter** on that
  account's posts — role or not. Proven in production: @irina.narativa (no
  role on the app) commented "Link link" on @andreixperience's post and got
  the DM and the public reply within ~20 seconds.

So Advanced Access is **not** what makes sending work. It's what lets
arbitrary creators sign up and connect without being added as Instagram
Testers first. Until it's granted, beta creators can be onboarded via
App Roles → Add People → Instagram Tester (up to 500).

- **App:** GetSocialGrowth — App ID `1407330664831432`
- **Instagram App ID:** `1044211711748922`
- **Business:** Andrei Călugăr (PFA, CUI 51961870) — verified
- **Use case:** Instagram API with Instagram Login → "Manage messaging and content on Instagram"

---

## Submission checklist

| # | Item | Status |
|---|------|--------|
| 1 | Privacy Policy URL — https://www.getsocialgrowth.tech/privacy | ✅ live |
| 2 | Terms of Service URL — https://www.getsocialgrowth.tech/terms | ✅ live |
| 3 | Data deletion URL — https://www.getsocialgrowth.tech/data-deletion | ✅ live |
| 4 | App icon — `docs/app-icon-1024.png` (1024×1024 PNG) | ✅ ready, upload in App Settings → Basic |
| 5 | Business verification | ✅ approved 2026-11-02 |
| 6 | Permission usage descriptions (Step 1 below) | ✅ drafted |
| 7 | Screencast (Step 2 below) | ⏳ Andrei records |
| 8 | App Settings → Basic: Privacy, Terms, Data deletion URLs + icon | ⏳ Andrei |

---

## STEP 1 — Permissions and usage descriptions

Request exactly these three — they're the scopes the app asks for
(`src/src/lib/meta/oauth.ts`). **Remove anything else** from the submission
(e.g. `instagram_manage_comments`, `instagram_business_manage_insights`):
reviewers reject permissions the screencast doesn't demonstrate.
`public_profile` is added automatically — just agree to it.

Paste these into each permission's "Describe how your app uses this
permission" box. They must match what the reviewer sees in the screencast.

### instagram_business_basic
> We use instagram_business_basic to let a creator connect their own
> Instagram professional account to GetSocialGrowth via Instagram Login. We
> read the account's id, username and profile info only to show which account
> is connected in the user's dashboard and to link their DM automations to
> that account. We also list the user's own recent posts so they can choose
> which post an automation applies to.

### instagram_business_manage_comments
> We use instagram_business_manage_comments to power a comment-to-DM
> automation on the connected creator's own posts. When someone comments a
> keyword the creator configured (e.g. "LINK") on one of the creator's posts,
> we read that comment (via the comments webhook, or by reading recent
> comments on that post) to detect the keyword. When the creator has enabled
> it, we post one public reply to that comment (e.g. "Just sent you a DM!").
> We only act on the connected creator's own media, and only in response to
> real comments from their audience.

### instagram_business_manage_messages
> We use instagram_business_manage_messages to send a private reply (direct
> message) to a person who comments a configured keyword on the connected
> creator's post. The creator writes the DM content in advance (e.g. a link to
> their resource). We send exactly one private reply per matching comment,
> within Instagram's allowed window, on behalf of the creator's own account.
> We do not read direct messages or use them for any other purpose.

**"Ensure you have performed required API test calls"** — production traffic
already makes these calls (reading comments, replying, sending DMs). The
dashboard can take up to 24h to mark them done.

---

## STEP 2 — Screencast script

One screen recording, uploaded for all three permissions. Record on the live
site with @andreixperience connected. Keep it 2–4 minutes, with narration or
captions. The whole flow works today, so record it end to end.

**Shot list:**

1. **App intro (10s)** — Show the GetSocialGrowth dashboard. Caption:
   "GetSocialGrowth helps Instagram creators. This feature auto-DMs people who
   comment a keyword on their posts."
2. **Start connect (15s)** — Settings → click "Connect Instagram". Show the
   redirect to Instagram.
3. **Consent screen (15s)** — Slowly show the three permissions being
   granted: *View profile and access media*, *Access and manage comments*,
   *Access and manage messages*. Click Allow. **This is the shot that proves
   each permission** — linger on it.
4. **Back in app (15s)** — Show the connected account in the dashboard
   ("Connected as @andreixperience").
5. **Create automation (30s)** — Pick a post, type the keyword "LINK", write
   the DM message and the public reply, save. Caption which permission each
   field maps to.
6. **Trigger it (40s)** — From a second account (e.g. @andreicalugar.dev or
   any follower), comment "LINK" on that post. Then show (a) the DM arriving
   in the commenter's inbox [manage_messages] and (b) the public reply under
   the comment [manage_comments]. It takes up to ~1 minute — cut the wait.
7. **Wrap (10s)** — Show the DM log in the dashboard with the message marked
   **Sent**.

---

## STEP 3 — Submit

1. App dashboard → **App Review** → **Permissions and Features**.
2. For each of the 3 permissions, click **Request Advanced Access**.
3. Fill the usage description (Step 1) and attach the screencast (Step 2).
4. Make sure Privacy/Terms/Data-deletion URLs and the app icon are set in
   **App Settings → Basic**.
5. Submit. Review typically takes ~1–2 weeks.

---

## After approval

Nothing to build. The pipeline is live and automatic: webhook + every-minute
comment polling → keyword match → `dm_logs` queue → `/api/cron/process-dms`
(triggered every minute by Supabase pg_cron) → DM + public reply. Approval
only removes the Instagram Tester requirement for connecting, so anyone with
a Business or Creator account can sign up and connect.
