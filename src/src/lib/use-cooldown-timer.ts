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

function compute(nextAvailableAt: string | null | undefined): CooldownTimer | null {
  if (!nextAvailableAt) return null
  const target = new Date(nextAvailableAt).getTime()
  if (Number.isNaN(target)) return null
  const seconds = Math.max(0, Math.ceil((target - Date.now()) / 1000))
  if (seconds <= 0) return null

  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  const label = `${m}:${s.toString().padStart(2, "0")}`
  return { secondsRemaining: seconds, label }
}
