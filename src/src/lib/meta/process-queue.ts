import { supabase } from "@/lib/supabase"
import { decryptToken } from "@/lib/meta/oauth"
import {
  RateLimitError,
  TokenExpiredError,
  MetaApiError,
  sendCommentReply,
  sendDirectMessage,
  sendPrivateReply,
} from "@/lib/meta/client"
import { markTokenError } from "@/lib/meta/accounts"
import { pickReplyVariant } from "@/lib/meta/reply-variants"
import { withTrackedLinks } from "@/lib/link-tracking"
import { sendGateOpener } from "@/lib/meta/follow-gate"
import { simulatorAccountIds } from "@/lib/meta/simulator"
import { processDueFollowups, scheduleFollowup, type FollowupResult } from "@/lib/meta/followups"

/**
 * Drain the DM send queue (dm_logs rows with status='pending'). Called by the
 * cron route after polling, and by the webhook right after it queues a
 * comment so the DM goes out in seconds instead of at the next cron run.
 * Rows are claimed atomically, so overlapping runs never double-send.
 * Replaces OpenReply's BullMQ worker (lib/queue/dm-worker.ts, MIT).
 *
 * Semantics kept from OpenReply's worker:
 * - per-account hourly cap (700, headroom under Meta's 750 private
 *   replies/hour) — over-cap rows are requeued 30 min out, attempts untouched
 * - TokenExpiredError → fail immediately + flag the account for reconnect
 * - Meta code 551 ("user not available", DMs closed) → fail, no retry
 * - RateLimitError from Meta → requeue with delay, attempts untouched
 * - other errors → exponential backoff, permanent fail after MAX_ATTEMPTS
 * - the public comment reply is handled independently of the DM: a DM
 *   failure never blocks or re-posts the public reply
 */

const BATCH_SIZE = 25
const MAX_ATTEMPTS = 3
const HOURLY_CAP_PER_ACCOUNT = 700
const RATE_LIMIT_REQUEUE_MS = 30 * 60 * 1000
const STUCK_PROCESSING_MINUTES = 10

interface QueueRow {
  id: string
  automation_id: string
  instagram_account_id: string
  // For DM and story-reply triggers this holds the incoming message id.
  comment_id: string
  commenter_id: string
  attempts: number
  dm_sent_at: string | null
  public_reply_sent_at: string | null
  trigger_type: "comment" | "dm" | "story_reply"
  gate_status: string | null
}

const QUEUE_COLUMNS =
  "id, automation_id, instagram_account_id, comment_id, commenter_id, attempts, dm_sent_at, public_reply_sent_at"

// Columns added by later migrations, newest last, with the value to assume
// while a migration hasn't run yet. A deploy that lands before its
// migration must keep sending DMs exactly as before.
const QUEUE_OPTIONAL = [
  { column: "trigger_type", fallback: "comment" }, // schema/025
  { column: "gate_status", fallback: null }, // schema/026
] as const

const AUTOMATION_COLUMNS = "id, user_id, is_active, dm_message, public_reply_enabled, public_reply_message"

const AUTOMATION_OPTIONAL = [
  { column: "track_clicks", fallback: false }, // schema/024
  { column: "follow_gate", fallback: false }, // schema/026
] as const

/**
 * Run a select with all optional columns; if the database rejects one,
 * retry without the newest remaining one and fill in its fallback value.
 */
async function selectWithFallback<T>(
  base: string,
  optional: readonly { column: string; fallback: unknown }[],
  run: (columns: string) => PromiseLike<{ data: unknown; error: { message: string } | null }>
): Promise<{ data: T | null; error: { message: string } | null }> {
  for (let keep = optional.length; keep >= 0; keep--) {
    const used = optional.slice(0, keep)
    const columns = [base, ...used.map((o) => o.column)].join(", ")
    const { data, error } = await run(columns)
    if (error) {
      if (keep > 0) {
        console.warn(`[process-queue] retrying without ${optional[keep - 1].column}:`, error.message)
        continue
      }
      return { data: null, error }
    }
    const missing = optional.slice(keep)
    const fill = (row: Record<string, unknown>) => {
      const out = { ...row }
      for (const o of missing) out[o.column] = o.fallback
      return out
    }
    if (Array.isArray(data)) return { data: data.map(fill) as T, error: null }
    return { data: (data ? fill(data as Record<string, unknown>) : null) as T, error: null }
  }
  return { data: null, error: { message: "unreachable" } }
}

/** Due rows, oldest first. */
async function loadPendingRows(now: string): Promise<QueueRow[]> {
  const onlyAccounts = await simulatorAccountIds()
  if (onlyAccounts && onlyAccounts.length === 0) return []

  const { data } = await selectWithFallback<QueueRow[]>(QUEUE_COLUMNS, QUEUE_OPTIONAL, (columns) => {
    let query = supabase
      .from("dm_logs")
      .select(columns)
      .eq("status", "pending")
      .lte("next_attempt_at", now)
    if (onlyAccounts) query = query.in("instagram_account_id", onlyAccounts)
    return query.order("created_at", { ascending: true }).limit(BATCH_SIZE)
  })
  return data ?? []
}

function backoffMs(attempts: number): number {
  // 10min, 20min, 40min...
  return Math.pow(2, attempts) * 5 * 60 * 1000
}

interface QueueAutomation {
  id: string
  user_id: string
  is_active: boolean
  dm_message: string
  track_clicks: boolean
  follow_gate: boolean
  public_reply_enabled: boolean
  public_reply_message: string | null
}

/** The automation for a queued DM. */
async function loadAutomation(id: string): Promise<QueueAutomation | null> {
  const { data } = await selectWithFallback<QueueAutomation>(AUTOMATION_COLUMNS, AUTOMATION_OPTIONAL, (columns) =>
    supabase.from("dm_automations").select(columns).eq("id", id).maybeSingle()
  )
  return data
}

export interface DrainResult {
  sent: number
  failed: number
  requeued: number
  skipped: number
  followups?: FollowupResult
}

export async function drainDmQueue(): Promise<DrainResult> {
  const nowIso = () => new Date().toISOString()

  // Recover rows stuck in 'processing' from a crashed/killed earlier run.
  // (Skipped against the simulator: that's production's job.)
  const stuckCutoff = new Date(
    Date.now() - STUCK_PROCESSING_MINUTES * 60 * 1000
  ).toISOString()
  if (!process.env.META_GRAPH_BASE_URL) {
    await supabase
      .from("dm_logs")
      .update({ status: "pending", updated_at: nowIso() })
      .eq("status", "processing")
      .lt("updated_at", stuckCutoff)
  }

  const candidates = await loadPendingRows(nowIso())

  const results: DrainResult = { sent: 0, failed: 0, requeued: 0, skipped: 0 }
  // Caches per invocation: hourly counts and decrypted tokens per account.
  const hourlyCount = new Map<string, number>()
  const accountCache = new Map<
    string,
    { instagram_id: string; username: string; token: string } | null
  >()

  for (const row of candidates) {
    // Atomic claim: the .eq("status","pending") guard means a concurrently
    // running cron can't grab the same row.
    const { data: claimed } = await supabase
      .from("dm_logs")
      .update({ status: "processing", updated_at: nowIso() })
      .eq("id", row.id)
      .eq("status", "pending")
      .select("id")
    if (!claimed || claimed.length === 0) {
      results.skipped++
      continue
    }

    // Load automation + account (fresh each row is fine at BATCH_SIZE=25).
    const automation = await loadAutomation(row.automation_id)

    if (!automation || !automation.is_active) {
      await supabase
        .from("dm_logs")
        .update({
          status: "failed",
          error_message: "Automation deleted or deactivated before send",
          updated_at: nowIso(),
        })
        .eq("id", row.id)
      results.failed++
      continue
    }

    if (!accountCache.has(row.instagram_account_id)) {
      const { data: account } = await supabase
        .from("instagram_accounts")
        .select("id, instagram_id, username, access_token")
        .eq("id", row.instagram_account_id)
        .maybeSingle()
      if (account) {
        try {
          accountCache.set(row.instagram_account_id, {
            instagram_id: account.instagram_id,
            username: account.username,
            token: decryptToken(account.access_token),
          })
        } catch {
          accountCache.set(row.instagram_account_id, null)
        }
      } else {
        accountCache.set(row.instagram_account_id, null)
      }
    }
    const account = accountCache.get(row.instagram_account_id)
    if (!account) {
      await supabase
        .from("dm_logs")
        .update({
          status: "failed",
          error_message: "Instagram account disconnected or token unreadable",
          updated_at: nowIso(),
        })
        .eq("id", row.id)
      results.failed++
      continue
    }

    // Per-account hourly cap (DB count, cached per run + local increments).
    if (!hourlyCount.has(row.instagram_account_id)) {
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
      const { count } = await supabase
        .from("dm_logs")
        .select("id", { count: "exact", head: true })
        .eq("instagram_account_id", row.instagram_account_id)
        .gt("dm_sent_at", hourAgo)
      hourlyCount.set(row.instagram_account_id, count ?? 0)
    }
    if ((hourlyCount.get(row.instagram_account_id) ?? 0) >= HOURLY_CAP_PER_ACCOUNT) {
      await supabase
        .from("dm_logs")
        .update({
          status: "pending",
          next_attempt_at: new Date(Date.now() + RATE_LIMIT_REQUEUE_MS).toISOString(),
          updated_at: nowIso(),
        })
        .eq("id", row.id)
      results.requeued++
      continue
    }

    // --- Send the DM (skip if a previous partial run already sent it) ---
    let dmOk = Boolean(row.dm_sent_at)
    let terminalFailure = false
    // The automation's own DM (not a follow-gate opener) went out: that's
    // what a follow-up follows.
    let realDmSent = false
    if (!dmOk) {
      try {
        if (automation.follow_gate && !row.gate_status) {
          // Follow-gate: an opener with a button (comments), or the follow
          // check right away (DMs/story replies). See lib/meta/follow-gate.ts.
          const gateStatus = await sendGateOpener(account, automation, row)
          await supabase
            .from("dm_logs")
            .update({
              gate_status: gateStatus,
              ...(gateStatus === "delivered" ? { gate_delivered_at: nowIso() } : {}),
            })
            .eq("id", row.id)
          realDmSent = gateStatus === "delivered"
        } else {
        // Short links per recipient when click tracking is on; falls back to
        // the original text on any tracking error.
        const message = automation.track_clicks
          ? await withTrackedLinks({
              message: automation.dm_message,
              userId: automation.user_id,
              automationId: automation.id,
              dmLogId: row.id,
            })
          : automation.dm_message
        if (row.trigger_type === "comment") {
          // Private reply, tied to their comment.
          await sendPrivateReply(account.token, account.instagram_id, row.comment_id, message)
        } else {
          // They messaged us (DM or story reply): answer in the conversation.
          await sendDirectMessage(account.token, account.instagram_id, row.commenter_id, message)
        }
        realDmSent = true
        }
        dmOk = true
        hourlyCount.set(
          row.instagram_account_id,
          (hourlyCount.get(row.instagram_account_id) ?? 0) + 1
        )
        await supabase
          .from("dm_logs")
          .update({ dm_sent_at: nowIso(), updated_at: nowIso() })
          .eq("id", row.id)
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error"
        if (err instanceof TokenExpiredError) {
          // Dead token: fail now, flag the account so the UI prompts reconnect.
          await markTokenError(row.instagram_account_id, message)
          accountCache.set(row.instagram_account_id, null)
          await supabase
            .from("dm_logs")
            .update({ status: "failed", error_message: message, updated_at: nowIso() })
            .eq("id", row.id)
          results.failed++
          terminalFailure = true
        } else if (err instanceof MetaApiError && err.code === 551) {
          // Recipient closed their DMs — retrying can never succeed.
          await supabase
            .from("dm_logs")
            .update({ status: "failed", error_message: message, updated_at: nowIso() })
            .eq("id", row.id)
          results.failed++
          terminalFailure = true
        } else if (err instanceof RateLimitError) {
          await supabase
            .from("dm_logs")
            .update({
              status: "pending",
              next_attempt_at: new Date(Date.now() + RATE_LIMIT_REQUEUE_MS).toISOString(),
              error_message: message,
              updated_at: nowIso(),
            })
            .eq("id", row.id)
          results.requeued++
          terminalFailure = true
        } else {
          const attempts = row.attempts + 1
          const failedForGood = attempts >= MAX_ATTEMPTS
          await supabase
            .from("dm_logs")
            .update({
              status: failedForGood ? "failed" : "pending",
              attempts,
              next_attempt_at: new Date(Date.now() + backoffMs(attempts)).toISOString(),
              error_message: message,
              updated_at: nowIso(),
            })
            .eq("id", row.id)
          if (failedForGood) results.failed++
          else results.requeued++
          terminalFailure = true
        }
      }
    }
    if (terminalFailure) continue

    // --- Public comment reply, independent of the DM outcome ---
    // One of the automation's reply variations, picked at random.
    const publicReply = pickReplyVariant(automation.public_reply_message)
    // Only comments have something to reply to publicly.
    if (
      row.trigger_type === "comment" &&
      automation.public_reply_enabled &&
      publicReply &&
      !row.public_reply_sent_at
    ) {
      try {
        await sendCommentReply(account.token, row.comment_id, publicReply)
        await supabase
          .from("dm_logs")
          .update({ public_reply_sent_at: nowIso(), updated_at: nowIso() })
          .eq("id", row.id)
      } catch (err) {
        // Best-effort: record the error, never retry the DM because of it.
        const message = err instanceof Error ? err.message : "Unknown error"
        await supabase
          .from("dm_logs")
          .update({ public_reply_error: message, updated_at: nowIso() })
          .eq("id", row.id)
      }
    }

    await supabase
      .from("dm_logs")
      .update({ status: "sent", updated_at: nowIso() })
      .eq("id", row.id)
    results.sent++
    if (realDmSent) await scheduleFollowup(row.id)
  }

  // Follow-ups that are due (schema/028). Never lets a problem there
  // affect the DM results above.
  try {
    results.followups = await processDueFollowups()
  } catch (err) {
    console.error("[process-queue] follow-ups failed:", err)
  }

  return results
}
