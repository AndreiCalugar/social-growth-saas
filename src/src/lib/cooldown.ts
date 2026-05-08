import { supabase } from "@/lib/supabase"
import {
  ALLOWED,
  computeCooldownStatus,
  computeQuotaStatus,
  type CooldownStatus,
} from "@/lib/cooldown-math"

/**
 * DB-backed rate-limit primitives used by every API route that triggers
 * an expensive operation (n8n webhook, Claude API, Apify scrape).
 *
 * The pure date math lives in `cooldown-math.ts` so it can be unit-tested
 * without booting Supabase. This file is the thin Supabase wrapper.
 */

export type { CooldownStatus } from "@/lib/cooldown-math"
export { computeCooldownStatus, computeQuotaStatus } from "@/lib/cooldown-math"

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
  return computeCooldownStatus(row?.[column], cooldownMinutes)
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

  // At the cap, the countdown is until the oldest in-window row exits
  // the window — that's when one quota slot reopens.
  const rows = (data ?? []) as unknown as Array<Record<string, string | null>>
  const oldestIso = rows[0]?.[column]
  return computeQuotaStatus(oldestIso, count ?? 0, windowMinutes, maxCount)
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
