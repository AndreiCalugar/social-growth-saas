import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { decryptToken } from "@/lib/meta/oauth"
import {
  RateLimitError,
  TokenExpiredError,
  MetaApiError,
  sendCommentReply,
  sendPrivateReply,
} from "@/lib/meta/client"
import { markTokenError } from "@/lib/meta/accounts"

/**
 * Drain the DM send queue (dm_logs rows with status='pending').
 * Replaces OpenReply's BullMQ worker (lib/queue/dm-worker.ts, MIT) with a
 * cron-triggered route — run every minute via system cron:
 *
 *   * * * * * curl -s -H "Authorization: Bearer $CRON_SECRET" \
 *     https://www.getsocialgrowth.tech/api/cron/process-dms
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
  comment_id: string
  attempts: number
  dm_sent_at: string | null
  public_reply_sent_at: string | null
}

function backoffMs(attempts: number): number {
  // 10min, 20min, 40min...
  return Math.pow(2, attempts) * 5 * 60 * 1000
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET || process.env.NEXTAUTH_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const nowIso = () => new Date().toISOString()

  // Recover rows stuck in 'processing' from a crashed/killed earlier run.
  const stuckCutoff = new Date(
    Date.now() - STUCK_PROCESSING_MINUTES * 60 * 1000
  ).toISOString()
  await supabase
    .from("dm_logs")
    .update({ status: "pending", updated_at: nowIso() })
    .eq("status", "processing")
    .lt("updated_at", stuckCutoff)

  const { data: candidates } = await supabase
    .from("dm_logs")
    .select("id, automation_id, instagram_account_id, comment_id, attempts, dm_sent_at, public_reply_sent_at")
    .eq("status", "pending")
    .lte("next_attempt_at", nowIso())
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE)

  const results = { sent: 0, failed: 0, requeued: 0, skipped: 0 }
  // Caches per invocation: hourly counts and decrypted tokens per account.
  const hourlyCount = new Map<string, number>()
  const accountCache = new Map<
    string,
    { instagram_id: string; token: string } | null
  >()

  for (const row of (candidates ?? []) as QueueRow[]) {
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
    const { data: automation } = await supabase
      .from("dm_automations")
      .select("id, is_active, dm_message, public_reply_enabled, public_reply_message")
      .eq("id", row.automation_id)
      .maybeSingle()

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
        .select("id, instagram_id, access_token")
        .eq("id", row.instagram_account_id)
        .maybeSingle()
      if (account) {
        try {
          accountCache.set(row.instagram_account_id, {
            instagram_id: account.instagram_id,
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
    if (!dmOk) {
      try {
        await sendPrivateReply(
          account.token,
          account.instagram_id,
          row.comment_id,
          automation.dm_message
        )
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
    if (
      automation.public_reply_enabled &&
      automation.public_reply_message &&
      !row.public_reply_sent_at
    ) {
      try {
        await sendCommentReply(
          account.token,
          row.comment_id,
          automation.public_reply_message
        )
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
  }

  return NextResponse.json({ success: true, ...results })
}
