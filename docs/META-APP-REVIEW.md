# Meta App Review — Advanced Access submission package

Everything needed to get the Instagram DM automation working in **production**
(for any follower, not just testers). Standard Access lets testers connect but
blocks every *write* operation — comment replies, hides, and private replies
all fail. Advanced Access on the three `instagram_business_*` permissions is the
only thing that unlocks them.

- **App:** GetSocialGrowth — App ID `1407330664831432`
- **Instagram App ID:** `1044211711748922`
- **Business:** Andrei Călugăr
- **Use case:** Instagram API with Instagram Login → "Manage messaging and content on Instagram"

---

## Submission checklist

| # | Item | Owner | Status |
|---|------|-------|--------|
| 1 | Privacy Policy URL — https://www.getsocialgrowth.tech/privacy | — | ✅ live |
| 2 | Terms of Service URL — https://www.getsocialgrowth.tech/terms | — | ✅ live |
| 3 | Data deletion URL — https://www.getsocialgrowth.tech/data-deletion | Andrei: merge+deploy branch | ⏳ built, needs deploy |
| 4 | App icon (1024×1024 PNG, no rounded corners, no transparency) | Andrei | ❌ needed |
| 5 | **Business verification** (see below) | Andrei | ❌ start first — long pole |
| 6 | Permission usage descriptions (§ below) | Claude | ✅ drafted |
| 7 | Screencast per permission (script § below) | Andrei records | ⏳ script ready |
| 8 | App Settings → Basic: set Data deletion URL to /data-deletion | Andrei/Claude | ⏳ after deploy |

---

## STEP 1 — Business verification (do this first)

This gates everything else and takes 1–5 business days, so start immediately.

1. Go to **Meta Business Suite**: https://business.facebook.com/settings
   (or Security Center: https://business.facebook.com/settings/security)
   — logged in as the account that owns the app (Andrei Călugăr).
2. Left sidebar → **Business settings** → **Security Center**.
3. Find **Business verification** → click **Start verification**.
4. Provide:
   - **Legal business details** — legal name, address, phone. For a sole
     proprietor / PFA / self-employed, use your registered name and address.
     If you have no registered company, select the individual/sole-proprietor
     path — Meta supports verifying an individual developer.
   - **Verification document** — one of: business registration certificate,
     tax document, utility bill, or (individual path) a government ID.
   - **Confirm** via a code sent to a business phone/email or a document.
5. Submit and wait. You'll get an email when it's approved.

> If Security Center doesn't show "Business verification," it appears
> automatically the first time you start an App Review that requires it
> (step below) — so you can also trigger it from the review flow itself.

---

## STEP 2 — Permission usage descriptions

Paste these into each permission's "Tell us how you'll use this permission"
box in App Review. They must match what the reviewer sees in the screencast.

### instagram_business_basic
> We use instagram_business_basic to let a creator connect their own
> Instagram professional account to GetSocialGrowth via Instagram Login. We
> read the account's id, username, and profile info solely to display which
> account is connected in the user's dashboard and to associate their DM
> automations with the correct account. We do not read or store media beyond
> what is needed to let the user pick which of their own posts an automation
> applies to.

### instagram_business_manage_comments
> We use instagram_business_manage_comments to power a comment-to-DM
> automation on the connected creator's own posts. When someone comments a
> keyword the creator configured (e.g. "LINK") on the creator's post, we read
> that comment via the comments webhook to detect the keyword, and — when the
> creator has enabled it — post a single public reply to that comment (e.g.
> "Just sent you a DM!"). All actions happen only on the connected creator's
> own media, triggered by real comments from their audience.

### instagram_business_manage_messages
> We use instagram_business_manage_messages to send a private reply (direct
> message) to a user who comments a configured keyword on the connected
> creator's post. The creator writes the DM content in advance (e.g. a link to
> their resource). We send exactly one private reply per matching comment,
> within Instagram's allowed window, on behalf of the creator's own account.
> We do not read or use direct messages for any other purpose.

---

## STEP 3 — Screencast script

Meta requires ONE screen recording that demonstrates the full flow and shows
each requested permission in action. Record on the live site while logged in
with a **tester** account (andreixperience) — testers can complete the OAuth
and the reviewer just needs to see the flow, permissions, and intent. Keep it
2–4 minutes, narrate or add captions.

**Shot list:**

1. **App intro (10s)** — Show the GetSocialGrowth dashboard. Caption:
   "GetSocialGrowth helps Instagram creators. This feature auto-DMs people who
   comment a keyword on their posts."
2. **Start connect (15s)** — Go to the DM Automation page → click "Connect
   Instagram". Show the redirect to Instagram.
3. **Consent screen (15s)** — On Instagram's consent screen, slowly show the
   three permissions being granted: *View profile and access media*, *Access
   and manage comments*, *Access and manage messages*. Click Allow. **This is
   the shot that proves each permission** — linger on it.
4. **Back in app (15s)** — Show the connected account now appears in the
   dashboard ("Connected as @andreixperience").
5. **Create automation (30s)** — Create a DM automation: pick a post, type the
   keyword "LINK", write the DM message and the public reply message, save.
   Caption which permission each field maps to.
6. **Trigger it (40s)** — Switch to a second phone/account, comment "LINK" on
   that post. Then show: (a) the DM arriving in the commenter's inbox
   [manage_messages], (b) the public reply appearing under the comment
   [manage_comments].
7. **Wrap (10s)** — Show the DM log in the dashboard listing the sent message.

> ⚠️ Shot 6 (the actual send) currently fails under Standard Access — that's
> expected and is exactly what this review unlocks. Options: (a) record shots
> 1–5 now and add shot 6 after Meta grants access on a provisional basis —
> many reviewers accept the connect+consent+config flow plus a clear
> description; or (b) if any partial send works during review, capture it.
> Meta explicitly reviews the *intent and flow*, not a guaranteed live send.

---

## STEP 4 — Submit

1. App dashboard → **App Review** → **Permissions and Features**.
2. For each of the 3 permissions, click **Request Advanced Access**.
3. Fill the usage description (§ Step 2) and attach the screencast (§ Step 3).
4. Ensure Privacy/Terms/Data-deletion URLs and the app icon are set in
   **App Settings → Basic**.
5. Submit. Review typically takes ~1–2 weeks.

---

## After approval

Nothing to build — the pipeline is already done and tested end-to-end
(webhook → keyword match → queue → cron processor → send). Once Advanced
Access is granted, the write operations that fail today start succeeding for
**all** commenters, not just testers. Remaining ops task: set up the external
every-minute pinger for `/api/cron/process-dms` (cron-job.org) so DMs send
without manual triggering — see docs/DM-AUTOMATION-SETUP.md.
