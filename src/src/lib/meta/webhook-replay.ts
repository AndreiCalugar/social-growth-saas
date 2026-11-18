import { createHash } from "node:crypto"
import { QueueClient } from "@vercel/queue"
import { supabase } from "@/lib/supabase"
import { currentDeployment } from "@/lib/meta/queue-clock"
import type { WebhookPayload } from "@/lib/meta/webhook"

/**
 * Keeps webhook deliveries that arrive while the database is down.
 *
 * The webhook must answer Meta with 200 (Meta doesn't resend those), so an
 * event that can't be processed would be lost: on 2026-11-18 the database
 * was unresponsive for 1.5 hours. Instead the raw payload goes to a Vercel
 * Queues topic, outside the database, and /api/queues/webhook-replay
 * processes it once the database answers again.
 *
 * Production only: previews, local dev and staging don't send to the queue.
 */

export const REPLAY_TOPIC = "webhook-replay"

// First retry after a minute, doubling up to 10 minutes between tries.
const FIRST_DELAY_SECONDS = 60
const MAX_DELAY_SECONDS = 10 * 60
// About 6 hours of retries, then give up (the payload is logged).
export const REPLAY_MAX_DELIVERIES = 40
// Long enough for every retry; a day is the queue's default.
const RETENTION_SECONDS = 24 * 60 * 60
// A check that doesn't answer in this time counts as down.
const PROBE_TIMEOUT_MS = 5_000

export interface ReplayMessage {
  payload: WebhookPayload
  reason: string
}

/** Seconds to wait before the next try, after `deliveryCount` failed ones. Pure. */
export function replayDelaySeconds(deliveryCount: number): number {
  const n = Math.max(1, deliveryCount)
  return Math.min(MAX_DELAY_SECONDS, FIRST_DELAY_SECONDS * 2 ** (n - 1))
}

/** Whether a replay that failed `deliveryCount` times should stop. Pure. */
export function shouldGiveUp(deliveryCount: number): boolean {
  return deliveryCount >= REPLAY_MAX_DELIVERIES
}

/** Whether the database answers a tiny read quickly. Never throws. */
export async function databaseReachable(timeoutMs = PROBE_TIMEOUT_MS): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("cron_heartbeats")
      .select("name")
      .limit(1)
      .abortSignal(AbortSignal.timeout(timeoutMs))
    return !error
  } catch {
    return false
  }
}

export interface ReplayDeps {
  isProduction: () => boolean
  send: (message: ReplayMessage, idempotencyKey: string) => Promise<void>
}

let queue: QueueClient | null = null

export const defaultReplayDeps: ReplayDeps = {
  isProduction: () => currentDeployment().isProduction,
  async send(message, idempotencyKey) {
    queue ??= new QueueClient()
    await queue.send(REPLAY_TOPIC, message, {
      delaySeconds: FIRST_DELAY_SECONDS,
      idempotencyKey,
      retentionSeconds: RETENTION_SECONDS,
    })
  },
}

/**
 * Keep a delivery for later. Returns whether it was kept. Never throws:
 * the webhook answers 200 either way, and the payload is logged if it
 * couldn't be kept.
 */
export async function scheduleReplay(
  rawBody: string,
  payload: WebhookPayload,
  reason: string,
  deps: ReplayDeps = defaultReplayDeps
): Promise<boolean> {
  if (!deps.isProduction()) {
    console.warn(`[webhook-replay] not kept (${reason}), only production replays`)
    return false
  }
  // The same delivery sent twice is kept once.
  const key = "wh-" + createHash("sha256").update(rawBody).digest("hex").slice(0, 32)
  try {
    await deps.send({ payload, reason }, key)
    console.warn(`[webhook-replay] kept for replay (${reason})`)
    return true
  } catch (err) {
    console.error(
      `[webhook-replay] could not keep it (${reason}):`,
      err instanceof Error ? err.message : err,
      rawBody.slice(0, 4000)
    )
    return false
  }
}
