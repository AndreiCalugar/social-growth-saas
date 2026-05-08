"use client"

import { useEffect, useState } from "react"

/**
 * Drive a per-second countdown UI from a server-supplied `nextAvailableAt`
 * timestamp. Returns null when no cooldown is active OR when the cooldown
 * has expired — components should treat null as "ready to retry."
 *
 * The hook also auto-clears the cooldown one tick after it elapses, so
 * the consuming component re-enables its action button without needing
 * its own timer logic.
 */
export type CooldownTimer = {
  secondsRemaining: number
  /** Compact label, e.g. "12:34" or "0:42". */
  label: string
}

export function useCooldownTimer(nextAvailableAt: string | null | undefined): CooldownTimer | null {
  const [timer, setTimer] = useState<CooldownTimer | null>(() => compute(nextAvailableAt))

  useEffect(() => {
    setTimer(compute(nextAvailableAt))
    if (!nextAvailableAt) return

    const interval = setInterval(() => {
      const next = compute(nextAvailableAt)
      setTimer(next)
      if (!next) clearInterval(interval)
    }, 1000)

    return () => clearInterval(interval)
  }, [nextAvailableAt])

  return timer
}

/**
 * Pure helper extracted for unit tests — given the target ISO and a
 * "now" timestamp, return the timer state (or null when elapsed).
 */
export function computeCooldownTimer(
  nextAvailableAt: string | null | undefined,
  nowMs: number = Date.now(),
): CooldownTimer | null {
  if (!nextAvailableAt) return null
  const target = new Date(nextAvailableAt).getTime()
  if (Number.isNaN(target)) return null
  const seconds = Math.max(0, Math.ceil((target - nowMs) / 1000))
  if (seconds <= 0) return null

  return { secondsRemaining: seconds, label: formatTimerLabel(seconds) }
}

/** Compact mm:ss / m:ss label, e.g. "12:34" or "0:42". */
export function formatTimerLabel(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds))
  const m = Math.floor(safe / 60)
  const s = safe % 60
  return `${m}:${s.toString().padStart(2, "0")}`
}

function compute(nextAvailableAt: string | null | undefined): CooldownTimer | null {
  return computeCooldownTimer(nextAvailableAt)
}
