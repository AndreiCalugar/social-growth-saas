/**
 * Pure rate-limit math — no DB / network imports — split out from
 * cooldown.ts so unit tests can import this file without dragging
 * in the Supabase client (which fails to construct without env vars).
 *
 * Both helpers take an injectable `nowMs` so tests stay deterministic
 * without monkey-patching Date.
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

export const ALLOWED: CooldownStatus = {
  allowed: true,
  minutesRemaining: 0,
  secondsRemaining: 0,
  nextAvailableAt: null,
}

function buildBlocked(nextMs: number, nowMs: number): CooldownStatus {
  const deltaMs = Math.max(0, nextMs - nowMs)
  return {
    allowed: false,
    secondsRemaining: Math.ceil(deltaMs / 1000),
    minutesRemaining: Math.max(1, Math.ceil(deltaMs / 60_000)),
    nextAvailableAt: new Date(nextMs).toISOString(),
  }
}

/**
 * Single-event cooldown: block if the last matching event happened
 * within `cooldownMinutes` of `nowMs`.
 */
export function computeCooldownStatus(
  lastIso: string | null | undefined,
  cooldownMinutes: number,
  nowMs: number = Date.now(),
): CooldownStatus {
  if (!lastIso) return ALLOWED
  const lastMs = new Date(lastIso).getTime()
  if (Number.isNaN(lastMs)) return ALLOWED

  const nextMs = lastMs + cooldownMinutes * 60_000
  if (nextMs <= nowMs) return ALLOWED

  return buildBlocked(nextMs, nowMs)
}

/**
 * Bucket quota: block if `inWindowCount >= maxCount`. The countdown is
 * "until the oldest in-window row exits the window" — i.e. when one
 * quota slot reopens.
 */
export function computeQuotaStatus(
  oldestInWindowIso: string | null | undefined,
  inWindowCount: number,
  windowMinutes: number,
  maxCount: number,
  nowMs: number = Date.now(),
): CooldownStatus {
  if (inWindowCount < maxCount) return ALLOWED
  if (!oldestInWindowIso) return ALLOWED

  const oldestMs = new Date(oldestInWindowIso).getTime()
  if (Number.isNaN(oldestMs)) return ALLOWED

  const nextMs = oldestMs + windowMinutes * 60_000
  if (nextMs <= nowMs) return ALLOWED

  return buildBlocked(nextMs, nowMs)
}
