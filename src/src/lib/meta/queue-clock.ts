import { QueueClient } from "@vercel/queue"
import { supabase } from "@/lib/supabase"
import { pollAutomationComments } from "@/lib/meta/poll-comments"
import { drainDmQueue } from "@/lib/meta/process-queue"

/**
 * The clock that runs the DM queue, on Vercel Queues (schema/031, 032).
 *
 * A "tick" message that, each time it's delivered, first schedules the
 * next tick (every 20 seconds, deduplicated per 20s slot) and then runs the
 * queue. It lives outside the database: running pg_cron every 20s used up
 * the free Supabase plan's Disk IO budget, which then stopped pg_cron from
 * starting jobs at night.
 *
 * pg_cron is now a watchdog every 5 minutes: it calls /api/cron/process-dms,
 * which runs the queue once and restarts the chain if it stopped. Both
 * running at once is safe: queue rows are claimed atomically.
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

const TICK_SECONDS = 20
// A tick records itself once a minute (every third slot), not every tick.
const HEARTBEAT_EVERY_SLOTS = 3
// pg_cron runs every 5 minutes and records the current deployment; trust
// that record for a bit more than two runs.
const DEPLOYMENT_RECORD_MS = 12 * 60 * 1000
// Restart the chain if no tick recorded itself for this long.
const TICK_STALE_MS = 3 * 60 * 1000

export interface Heartbeat {
  last_run_at: string
  deployment_id: string | null
}

export type TickDecision =
  | { action: "stop"; reason: "not_production" | "old_deployment" }
  | { action: "continue" }

/**
 * Whether a delivered tick keeps its chain going. Pure, so it's unit-tested.
 * A tick from an old deployment stops once pg_cron has recorded a newer
 * one; if pg_cron has been silent a while, it keeps the queue running.
 */
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
  return { action: "continue" }
}

/** Whether pg_cron should (re)start this deployment's tick chain. Pure. */
export function needsRearm(input: { now: number; deploymentId: string; tick: Heartbeat | null }): boolean {
  const t = input.tick
  if (!t) return true
  if (t.deployment_id !== input.deploymentId) return true
  return input.now - new Date(t.last_run_at).getTime() >= TICK_STALE_MS
}

/** The next tick: at the start of the next 20s slot, one per slot however many senders. */
export function nextTick(now: number, deploymentId: string): { delaySeconds: number; idempotencyKey: string } {
  const slot = Math.floor(now / (TICK_SECONDS * 1000)) + 1
  const delaySeconds = Math.max(1, Math.ceil((slot * TICK_SECONDS * 1000 - now) / 1000))
  return { delaySeconds, idempotencyKey: `tick-${deploymentId}-${slot}` }
}

/** Whether the tick running now should record its heartbeat (once a minute). */
export function recordsHeartbeat(now: number): boolean {
  return Math.floor(now / (TICK_SECONDS * 1000)) % HEARTBEAT_EVERY_SLOTS === 0
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
  | { scheduled: string; result?: unknown; error?: string }

/**
 * Handle one delivered tick: schedule the next one, then run the queue.
 * Scheduling comes first, so a failure in the work never breaks the chain.
 * Throws only if the next tick couldn't be scheduled (then Vercel
 * redelivers this one).
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
  if (recordsHeartbeat(deps.now())) await deps.writeHeartbeat(QUEUE_TICK, deploymentId)

  try {
    return { scheduled: next.idempotencyKey, result: await deps.doWork() }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[queue-clock] work failed:", message)
    return { scheduled: next.idempotencyKey, error: message }
  }
}

/**
 * Called on every pg_cron run (the 5-minute watchdog): record that pg_cron
 * reached this deployment, and restart the tick chain if it isn't running
 * here. Never throws: the clock must not stop the watchdog's own queue run.
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
