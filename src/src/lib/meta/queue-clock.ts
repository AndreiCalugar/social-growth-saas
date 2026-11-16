import { QueueClient } from "@vercel/queue"
import { supabase } from "@/lib/supabase"
import { pollAutomationComments } from "@/lib/meta/poll-comments"
import { drainDmQueue } from "@/lib/meta/process-queue"

/**
 * A second clock for the DM queue, on Vercel Queues (schema/031).
 *
 * pg_cron calls /api/cron/process-dms every 20 seconds, but on the free
 * Supabase plan it sometimes can't start jobs for hours. This clock is a
 * "tick" message that, each time it's delivered, first schedules the next
 * tick (one per minute, deduplicated by minute) and then does the queue
 * work only if pg_cron has been silent. pg_cron restarts the chain if it
 * ever stops. Both running at once is safe: queue rows are claimed
 * atomically.
 *
 * Vercel delivers a message to the deployment that sent it, so an old
 * deployment's chain would keep running old code. pg_cron always reaches
 * the current production deployment and records its id; a tick from any
 * other deployment stops its chain.
 *
 * Production only: previews, local dev and staging never send ticks.
 */

export const CLOCK_TOPIC = "dm-clock"
export const PG_CRON = "process-dms"
export const QUEUE_TICK = "queue-tick"

const TICK_SECONDS = 60
// pg_cron counts as running if it ran this recently (it runs every 20s).
const PG_CRON_ALIVE_MS = 90 * 1000
// The current deployment is known for sure only while pg_cron is alive;
// trust its record for this long.
const DEPLOYMENT_RECORD_MS = 5 * 60 * 1000
// Restart the chain if no tick ran for this long.
const TICK_STALE_MS = 3 * 60 * 1000

export interface Heartbeat {
  last_run_at: string
  deployment_id: string | null
}

export type TickDecision =
  | { action: "stop"; reason: "not_production" | "old_deployment" }
  | { action: "continue"; work: boolean }

/** What a delivered tick should do. Pure, so it's unit-tested. */
export function decideTick(input: {
  now: number
  isProduction: boolean
  deploymentId: string | null
  pgCron: Heartbeat | null
}): TickDecision {
  if (!input.isProduction || !input.deploymentId) return { action: "stop", reason: "not_production" }
  const pg = input.pgCron
  const pgAge = pg ? input.now - new Date(pg.last_run_at).getTime() : Infinity
  if (pg?.deployment_id && pg.deployment_id !== input.deploymentId && pgAge < DEPLOYMENT_RECORD_MS) {
    return { action: "stop", reason: "old_deployment" }
  }
  return { action: "continue", work: pgAge >= PG_CRON_ALIVE_MS }
}

/** Whether pg_cron should (re)start this deployment's tick chain. Pure. */
export function needsRearm(input: { now: number; deploymentId: string; tick: Heartbeat | null }): boolean {
  const t = input.tick
  if (!t) return true
  if (t.deployment_id !== input.deploymentId) return true
  return input.now - new Date(t.last_run_at).getTime() >= TICK_STALE_MS
}

/** The next tick: at the start of the next minute, one per minute however many senders. */
export function nextTick(now: number, deploymentId: string): { delaySeconds: number; idempotencyKey: string } {
  const minute = Math.floor(now / (TICK_SECONDS * 1000)) + 1
  const delaySeconds = Math.max(1, Math.ceil((minute * TICK_SECONDS * 1000 - now) / 1000))
  return { delaySeconds, idempotencyKey: `tick-${deploymentId}-${minute}` }
}

export function currentDeployment(): { isProduction: boolean; deploymentId: string | null } {
  return {
    isProduction: process.env.VERCEL_ENV === "production" && !process.env.META_GRAPH_BASE_URL,
    deploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? null,
  }
}

export interface ClockDeps {
  now: () => number
  deployment: () => { isProduction: boolean; deploymentId: string | null }
  readHeartbeat: (name: string) => Promise<Heartbeat | null>
  writeHeartbeat: (name: string, deploymentId: string | null) => Promise<void>
  sendTick: (delaySeconds: number, idempotencyKey: string) => Promise<void>
  doWork: () => Promise<unknown>
}

let queue: QueueClient | null = null

export const defaultClockDeps: ClockDeps = {
  now: () => Date.now(),
  deployment: currentDeployment,
  async readHeartbeat(name) {
    const { data, error } = await supabase
      .from("cron_heartbeats")
      .select("last_run_at, deployment_id")
      .eq("name", name)
      .maybeSingle()
    if (error || !data) return null
    return data as Heartbeat
  },
  async writeHeartbeat(name, deploymentId) {
    const { error } = await supabase
      .from("cron_heartbeats")
      .upsert({ name, last_run_at: new Date().toISOString(), deployment_id: deploymentId })
    if (error) console.warn(`[queue-clock] heartbeat ${name} not saved:`, error.message)
  },
  async sendTick(delaySeconds, idempotencyKey) {
    queue ??= new QueueClient()
    // Ticks are only needed for a few minutes; don't keep them for a day.
    await queue.send(CLOCK_TOPIC, { kind: "tick" }, { delaySeconds, idempotencyKey, retentionSeconds: 3600 })
  },
  async doWork() {
    const polled = await pollAutomationComments()
    const drained = await drainDmQueue()
    return { polled, ...drained }
  },
}

export type TickResult =
  | { stopped: "not_production" | "old_deployment" }
  | { scheduled: string; worked: false }
  | { scheduled: string; worked: true; result?: unknown; error?: string }

/**
 * Handle one delivered tick. Schedules the next tick before any work, so
 * a failure in the work never breaks the chain. Throws only if the next
 * tick couldn't be scheduled (then Vercel redelivers this one).
 */
export async function handleTick(deps: ClockDeps = defaultClockDeps): Promise<TickResult> {
  const { isProduction, deploymentId } = deps.deployment()
  const decision = decideTick({
    now: deps.now(),
    isProduction,
    deploymentId,
    pgCron: await deps.readHeartbeat(PG_CRON),
  })
  if (decision.action === "stop") return { stopped: decision.reason }

  const next = nextTick(deps.now(), deploymentId!)
  await deps.sendTick(next.delaySeconds, next.idempotencyKey)
  await deps.writeHeartbeat(QUEUE_TICK, deploymentId)

  if (!decision.work) return { scheduled: next.idempotencyKey, worked: false }
  console.warn("[queue-clock] pg_cron is silent, the queue clock is running the DM queue")
  try {
    return { scheduled: next.idempotencyKey, worked: true, result: await deps.doWork() }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[queue-clock] work failed:", message)
    return { scheduled: next.idempotencyKey, worked: true, error: message }
  }
}

/**
 * Called on every pg_cron run: record that pg_cron (and this deployment)
 * is alive, and restart the tick chain if it isn't running here. Never
 * throws: the queue clock must not affect the DM queue.
 */
export async function recordPgCronRun(deps: ClockDeps = defaultClockDeps): Promise<{ rearmed: boolean }> {
  try {
    const { isProduction, deploymentId } = deps.deployment()
    await deps.writeHeartbeat(PG_CRON, deploymentId)
    if (!isProduction || !deploymentId) return { rearmed: false }
    if (!needsRearm({ now: deps.now(), deploymentId, tick: await deps.readHeartbeat(QUEUE_TICK) })) {
      return { rearmed: false }
    }
    const next = nextTick(deps.now(), deploymentId)
    await deps.sendTick(next.delaySeconds, next.idempotencyKey)
    return { rearmed: true }
  } catch (err) {
    console.warn("[queue-clock] could not record pg_cron run:", err instanceof Error ? err.message : err)
    return { rearmed: false }
  }
}
