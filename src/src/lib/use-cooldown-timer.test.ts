import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { renderHook } from "@testing-library/react"
import { act } from "react"
import {
  useCooldownTimer,
  computeCooldownTimer,
  formatTimerLabel,
} from "./use-cooldown-timer"

const NOW = new Date("2026-05-08T12:00:00Z").getTime()

describe("formatTimerLabel", () => {
  it("formats sub-minute durations as 0:ss with a zero-padded second", () => {
    expect(formatTimerLabel(0)).toBe("0:00")
    expect(formatTimerLabel(7)).toBe("0:07")
    expect(formatTimerLabel(59)).toBe("0:59")
  })

  it("formats minute boundaries", () => {
    expect(formatTimerLabel(60)).toBe("1:00")
    expect(formatTimerLabel(61)).toBe("1:01")
    expect(formatTimerLabel(599)).toBe("9:59")
    expect(formatTimerLabel(3599)).toBe("59:59")
  })

  it("clamps negative inputs to 0:00 instead of producing nonsense", () => {
    expect(formatTimerLabel(-5)).toBe("0:00")
  })
})

describe("computeCooldownTimer", () => {
  it("returns null for nullish or unparseable input", () => {
    expect(computeCooldownTimer(null, NOW)).toBeNull()
    expect(computeCooldownTimer(undefined, NOW)).toBeNull()
    expect(computeCooldownTimer("", NOW)).toBeNull()
    expect(computeCooldownTimer("not-a-date", NOW)).toBeNull()
  })

  it("returns null when the target is in the past (cooldown already elapsed)", () => {
    const past = new Date(NOW - 5 * 1000).toISOString()
    expect(computeCooldownTimer(past, NOW)).toBeNull()
  })

  it("ceils to the next whole second so the displayed countdown never shows 0:00 mid-tick", () => {
    const target = new Date(NOW + 500).toISOString() // 0.5s ahead
    const r = computeCooldownTimer(target, NOW)
    expect(r).not.toBeNull()
    expect(r!.secondsRemaining).toBe(1)
    expect(r!.label).toBe("0:01")
  })

  it("computes label and seconds for an active cooldown", () => {
    const target = new Date(NOW + 12 * 60_000 + 34 * 1000).toISOString()
    const r = computeCooldownTimer(target, NOW)
    expect(r).not.toBeNull()
    expect(r!.secondsRemaining).toBe(12 * 60 + 34)
    expect(r!.label).toBe("12:34")
  })
})

describe("useCooldownTimer (hook)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: NOW })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("returns null when handed null", () => {
    const { result } = renderHook(() => useCooldownTimer(null))
    expect(result.current).toBeNull()
  })

  it("ticks down by one second on every interval tick", () => {
    const target = new Date(NOW + 5 * 1000).toISOString()
    const { result } = renderHook(() => useCooldownTimer(target))

    expect(result.current?.secondsRemaining).toBe(5)
    expect(result.current?.label).toBe("0:05")

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(result.current?.secondsRemaining).toBe(4)
    expect(result.current?.label).toBe("0:04")

    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(result.current?.secondsRemaining).toBe(2)
  })

  it("auto-clears (returns null) when the cooldown elapses, so the button re-enables on its own", () => {
    const target = new Date(NOW + 2 * 1000).toISOString()
    const { result } = renderHook(() => useCooldownTimer(target))

    expect(result.current).not.toBeNull()
    act(() => {
      vi.advanceTimersByTime(2500)
    })
    expect(result.current).toBeNull()
  })

  it("re-syncs when a new nextAvailableAt is supplied (e.g. after a fresh 429)", () => {
    const first = new Date(NOW + 3 * 1000).toISOString()
    const { result, rerender } = renderHook(
      ({ at }: { at: string | null }) => useCooldownTimer(at),
      { initialProps: { at: first } },
    )
    expect(result.current?.secondsRemaining).toBe(3)

    const second = new Date(NOW + 30 * 1000).toISOString()
    rerender({ at: second })
    expect(result.current?.secondsRemaining).toBe(30)
  })

  it("stops ticking after the cooldown clears (no leaked interval)", () => {
    const target = new Date(NOW + 1 * 1000).toISOString()
    const { result } = renderHook(() => useCooldownTimer(target))

    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(result.current).toBeNull()
    // If the interval leaked, the hook would still be flipping state on
    // each tick. Advancing further must not change the (null) result.
    act(() => {
      vi.advanceTimersByTime(10_000)
    })
    expect(result.current).toBeNull()
  })
})
