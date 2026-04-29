import { supabase } from "@/lib/supabase"

/**
 * Generic rate-limit primitives used by every API route that triggers
 * an expensive operation (n8n webhook, Claude API, Apify scrape).
 *
 * Two flavors:
 * - `checkCooldown`  — block if the last event for this filter is within
 *                      cooldownMinutes (single-event cooldown).
 * - `checkHourlyQuota` — block if N+ events for this filter have already
 *                      happened in the last `windowMinutes` (bucket quota).
 *
 * Both return `{ allowed, minutesRemaining, secondsRemaining,
 * nextAvailableAt }` so the API and UI can render a live countdown.
 */

export type CooldownStatus = {
  allowed: boolean
  /** Whole minutes until next attempt. Always >= 1 when blocked, 0 when allowed. */
  minutesRemaining: number
  /** Seconds until next attempt — drives the per-second UI countdown. */
  secondsRemaining: number
  /** ISO timestamp when the gate opens. null when already allowed. */
  nextAvailableAt: string | null
}

const ALLOWED: CooldownStatus = {
  allowed: true,
  minutesRemaining: 0,
  secondsRemaining: 0,
  nextAvailableAt: null,
}

function buildBlocked(nextMs: number): CooldownStatus {
  const now = Date.now()
  const deltaMs = Math.max(0, nextMs - now)
  return {
    allowed: false,
    secondsRemaining: Math.ceil(deltaMs / 1000),
    minutesRemaining: Math.max(1, Math.ceil(deltaMs / 60_000)),
    nextAvailableAt: new Date(nextMs).toISOString(),
  }
}

/**
 * Block if the most recent row for `filterField=filterValue` happened
 * within `cooldownMinutes`. Used for insights / analyses / any operation
 * where one event per window is plenty.
 *
 * Tolerates the table not existing yet (returns `allowed: true` so a
 * missing migration doesn't soft-brick the feature for everyone).
 */
export async function checkCooldown(opts: {
  table: string
  column: string
  filterField: string
  filterValue: string | number
  cooldownMinutes: number
}): Promise<CooldownStatus> {
  const { table, column, filterField, filterValue, cooldownMinutes } = opts

  const { data, error } = await supabase
    .from(table)
    .select(column)
    .eq(filterField, filterValue)
    .order(column, { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    if (error.code === "42P01" || error.message?.includes("does not exist")) {
      return ALLOWED
    }
    // Don't fail-closed on transient DB errors — the API will surface its
    // own error if the downstream operation fails. Log so silent skips
    // aren't invisible during incident triage.
    console.warn(`[checkCooldown] ${table} lookup failed:`, error.message)
    return ALLOWED
  }

  const row = data as Record<string, string | null> | null
  const lastIso = row?.[column]
  if (!lastIso) return ALLOWED

  const lastMs = new Date(lastIso).getTime()
  if (Number.isNaN(lastMs)) return ALLOWED

  const nextMs = lastMs + cooldownMinutes * 60_000
  if (nextMs <= Date.now()) return ALLOWED

  return buildBlocked(nextMs)
}

/**
 * Block if there are already `maxCount` rows matching the filter inside
 * the trailing `windowMinutes`. The countdown is the time until the
 * OLDEST in-window row ages out — i.e. when the user's quota frees up
 * by one slot.
 *
 * Used for the brief-expand 5/hour cap.
 */
export async function checkHourlyQuota(opts: {
  table: string
  column: string
  filterField: string
  filterValue: string | number
  windowMinutes: number
  maxCount: number
  /** Optional extra "<col> IS NOT NULL" filter — needed for brief-expand. */
  notNullColumn?: string
}): Promise<CooldownStatus> {
  const { table, column, filterField, filterValue, windowMinutes, maxCount, notNullColumn } = opts

  const cutoffIso = new Date(Date.now() - windowMinutes * 60_000).toISOString()

  let query = supabase
    .from(table)
    .select(column, { count: "exact" })
    .eq(filterField, filterValue)
    .gte(column, cutoffIso)
    .order(column, { ascending: true })
    .limit(1)

  if (notNullColumn) {
    query = query.not(notNullColumn, "is", null)
  }

  const { data, count, error } = await query

  if (error) {
    if (error.code === "42P01" || error.message?.includes("does not exist")) {
      return ALLOWED
    }
    console.warn(`[checkHourlyQuota] ${table} lookup failed:`, error.message)
    return ALLOWED
  }

  if ((count ?? 0) < maxCount) return ALLOWED

  // At the cap. The countdown is until the oldest in-window row exits
  // the window — that's when one quota slot reopens.
  const rows = (data ?? []) as unknown as Array<Record<string, string | null>>
  const oldestIso = rows[0]?.[column]
  if (!oldestIso) return ALLOWED

  const oldestMs = new Date(oldestIso).getTime()
  if (Number.isNaN(oldestMs)) return ALLOWED

  const nextMs = oldestMs + windowMinutes * 60_000
  if (nextMs <= Date.now()) return ALLOWED

  return buildBlocked(nextMs)
}

/** Build the JSON body returned to the client when a route is blocked. */
export function rateLimitedResponse(status: CooldownStatus, message: string) {
  return {
    rateLimited: true as const,
    minutesRemaining: status.minutesRemaining,
    secondsRemaining: status.secondsRemaining,
    nextAvailableAt: status.nextAvailableAt,
    message,
  }
}
