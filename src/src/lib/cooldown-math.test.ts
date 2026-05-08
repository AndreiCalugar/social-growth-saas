import { describe, it, expect } from "vitest"
import { computeCooldownStatus, computeQuotaStatus } from "./cooldown-math"

// Pin "now" to a deterministic instant so test expectations don't drift.
const NOW = new Date("2026-05-08T12:00:00Z").getTime()

function isoMinutesAgo(mins: number): string {
  return new Date(NOW - mins * 60_000).toISOString()
}

describe("computeCooldownStatus", () => {
  it("allows when there's no prior event", () => {
    const r = computeCooldownStatus(null, 60, NOW)
    expect(r.allowed).toBe(true)
    expect(r.minutesRemaining).toBe(0)
    expect(r.nextAvailableAt).toBeNull()
  })

  it("allows when last event is older than the cooldown", () => {
    const r = computeCooldownStatus(isoMinutesAgo(61), 60, NOW)
    expect(r.allowed).toBe(true)
  })

  it("blocks when last event is inside the cooldown window", () => {
    const r = computeCooldownStatus(isoMinutesAgo(15), 60, NOW)
    expect(r.allowed).toBe(false)
    expect(r.minutesRemaining).toBe(45)
    expect(r.secondsRemaining).toBe(45 * 60)
    expect(r.nextAvailableAt).toBe(
      new Date(NOW - 15 * 60_000 + 60 * 60_000).toISOString(),
    )
  })

  it("treats the exact-boundary case as allowed (cooldown elapsed)", () => {
    // last + cooldown == now → next attempt is fine.
    const r = computeCooldownStatus(isoMinutesAgo(60), 60, NOW)
    expect(r.allowed).toBe(true)
  })

  it("rounds up sub-minute remainders so the UI never shows '0 min remaining'", () => {
    // 30 seconds left → minutesRemaining must be 1 (banner needs >= 1).
    const lastIso = new Date(NOW - 59.5 * 60_000).toISOString()
    const r = computeCooldownStatus(lastIso, 60, NOW)
    expect(r.allowed).toBe(false)
    expect(r.minutesRemaining).toBe(1)
    expect(r.secondsRemaining).toBe(30)
  })

  it("falls open on garbage timestamps so a corrupt row doesn't soft-brick the feature", () => {
    expect(computeCooldownStatus("not-a-date", 60, NOW).allowed).toBe(true)
    expect(computeCooldownStatus("", 60, NOW).allowed).toBe(true)
    expect(computeCooldownStatus(undefined, 60, NOW).allowed).toBe(true)
  })
})

describe("computeQuotaStatus", () => {
  it("allows when below the cap", () => {
    const r = computeQuotaStatus(isoMinutesAgo(10), 4, 60, 5, NOW)
    expect(r.allowed).toBe(true)
  })

  it("allows when at the cap but the oldest row already aged out", () => {
    // count says 5, but the oldest is older than the window — DB row is
    // technically still being returned, but the gate shouldn't block.
    const r = computeQuotaStatus(isoMinutesAgo(75), 5, 60, 5, NOW)
    expect(r.allowed).toBe(true)
  })

  it("blocks at the cap and counts down to the oldest row aging out", () => {
    // Oldest expansion was 20 min ago, window is 60 min → 40 min until
    // it ages out and a slot reopens.
    const r = computeQuotaStatus(isoMinutesAgo(20), 5, 60, 5, NOW)
    expect(r.allowed).toBe(false)
    expect(r.minutesRemaining).toBe(40)
  })

  it("blocks when count is over the cap (drift safety)", () => {
    const r = computeQuotaStatus(isoMinutesAgo(5), 7, 60, 5, NOW)
    expect(r.allowed).toBe(false)
    expect(r.minutesRemaining).toBe(55)
  })

  it("falls open if the oldest timestamp is missing or invalid", () => {
    expect(computeQuotaStatus(null, 5, 60, 5, NOW).allowed).toBe(true)
    expect(computeQuotaStatus("not-a-date", 5, 60, 5, NOW).allowed).toBe(true)
  })

  it("emits an ISO nextAvailableAt the UI can hand straight to the timer hook", () => {
    const oldest = isoMinutesAgo(45)
    const r = computeQuotaStatus(oldest, 5, 60, 5, NOW)
    expect(r.nextAvailableAt).toBe(
      new Date(new Date(oldest).getTime() + 60 * 60_000).toISOString(),
    )
  })
})
