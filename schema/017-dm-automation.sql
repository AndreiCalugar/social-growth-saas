-- Social Growth SaaS — Instagram DM automation (comment-to-DM)
-- Run against Supabase: psql $SUPABASE_DB_URL -f schema/017-dm-automation.sql
--
-- Ported/adapted from OpenReply's Prisma models (MIT, github.com/diwenne/openreply):
-- InstagramAccount, Automation, DmLog, ProcessedComment, WebhookEvent.
-- workspaceId becomes user_id (this app is tenant-per-user), and dm_logs
-- doubles as the send queue (status='pending' rows are drained by the
-- /api/cron/process-dms route) so no Redis/BullMQ is needed.

-- One connected Instagram professional account per user (MVP).
-- instagram_id is the professional-account user_id from /me — the id that
-- arrives as entry.id in webhooks and that the messaging API sends from.
-- It is globally UNIQUE: one IG account can belong to only one tenant.
CREATE TABLE IF NOT EXISTS instagram_accounts (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  instagram_id       text UNIQUE NOT NULL,
  username           text NOT NULL,
  name               text,
  -- AES-256-GCM, base64(iv | authTag | ciphertext), key = ENCRYPTION_KEY
  access_token       text NOT NULL,
  token_expires_at   timestamptz,
  token_error        text,               -- set when refresh/send hits a dead token → UI prompts reconnect
  webhook_subscribed boolean NOT NULL DEFAULT false,
  connected_at       timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_instagram_accounts_user_id
  ON instagram_accounts (user_id);

CREATE TABLE IF NOT EXISTS dm_automations (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  instagram_account_id uuid NOT NULL REFERENCES instagram_accounts(id) ON DELETE CASCADE,
  name                 text NOT NULL,
  -- Graph API media id (NOT the Apify platform_post_id — webhooks carry Graph ids).
  -- NULL with match_any_post = true means "all posts".
  post_id              text,
  post_url             text,
  match_any_post       boolean NOT NULL DEFAULT false,
  keywords             jsonb NOT NULL DEFAULT '[]',
  whole_word_match     boolean NOT NULL DEFAULT true,
  dm_message           text NOT NULL,
  public_reply_enabled boolean NOT NULL DEFAULT false,
  public_reply_message text,
  is_active            boolean NOT NULL DEFAULT true,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dm_automations_user_id
  ON dm_automations (user_id);
CREATE INDEX IF NOT EXISTS idx_dm_automations_account
  ON dm_automations (instagram_account_id);
CREATE INDEX IF NOT EXISTS idx_dm_automations_post_id
  ON dm_automations (post_id);

-- Send log AND queue: the webhook route inserts status='pending' rows,
-- the cron processor claims them (pending → processing → sent/failed).
CREATE TABLE IF NOT EXISTS dm_logs (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  automation_id        uuid NOT NULL REFERENCES dm_automations(id) ON DELETE CASCADE,
  instagram_account_id uuid NOT NULL REFERENCES instagram_accounts(id) ON DELETE CASCADE,
  commenter_id         text NOT NULL,
  commenter_name       text,
  comment_id           text NOT NULL,
  comment_text         text NOT NULL DEFAULT '',
  matched_keyword      text,
  status               text NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending','processing','sent','failed')),
  attempts             int NOT NULL DEFAULT 0,
  next_attempt_at      timestamptz NOT NULL DEFAULT now(),
  dm_sent_at           timestamptz,
  error_message        text,
  -- Public reply tracked independently of the DM: a DM failure never blocks
  -- or re-posts the public comment reply (and vice versa).
  public_reply_sent_at timestamptz,
  public_reply_error   text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  -- Idempotency across Meta webhook redeliveries.
  UNIQUE (automation_id, comment_id)
);

CREATE INDEX IF NOT EXISTS idx_dm_logs_queue
  ON dm_logs (status, next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_dm_logs_user_created
  ON dm_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dm_logs_account
  ON dm_logs (instagram_account_id);
-- Fast hourly rate-limit count: sent DMs per account in the last hour.
CREATE INDEX IF NOT EXISTS idx_dm_logs_rate_limit
  ON dm_logs (instagram_account_id, dm_sent_at)
  WHERE dm_sent_at IS NOT NULL;

-- Every comment id we've already handled, matched or not — dedup across
-- webhook redeliveries before automation matching even runs.
-- instagram_account_id here is Meta's id (text): events can arrive for
-- accounts we no longer have locally.
CREATE TABLE IF NOT EXISTS processed_comments (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instagram_account_id text NOT NULL,
  comment_id           text UNIQUE NOT NULL,
  seen_at              timestamptz NOT NULL DEFAULT now()
);

-- Raw webhook deliveries, for debugging misconfigured secrets / missed events.
CREATE TABLE IF NOT EXISTS webhook_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES users(id) ON DELETE SET NULL,
  object        text,
  payload       jsonb NOT NULL,
  status        text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','processed','failed','ignored')),
  error_message text,
  processed_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_created
  ON webhook_events (created_at DESC);
