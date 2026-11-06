import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/supabase", () => ({ supabase: {} }))

import { explainFailure, summarizeConnectAttempts } from "./connect-attempts"

const NOW = new Date("2026-11-06T12:00:00Z").getTime()
const at = (minAgo: number) => new Date(NOW - minAgo * 60_000).toISOString()

describe("summarizeConnectAttempts", () => {
  it("returns null when they never tried", () => {
    expect(summarizeConnectAttempts([], NOW)).toBeNull()
  })

  it("flags a start with no return as never came back", () => {
    const s = summarizeConnectAttempts(
      [
        { outcome: "started", detail: null, created_at: at(60) },
        { outcome: "started", detail: null, created_at: at(30) },
      ],
      NOW
    )
    expect(s?.label).toBe("Never came back from Instagram")
    expect(s?.tries).toBe(2)
    expect(s?.lastAt).toBe(at(30))
  })

  it("treats a very recent start as in progress", () => {
    const s = summarizeConnectAttempts([{ outcome: "started", detail: null, created_at: at(1) }], NOW)
    expect(s?.label).toBe("On Instagram now")
  })

  it("uses the latest outcome regardless of order", () => {
    const s = summarizeConnectAttempts(
      [
        { outcome: "connected", detail: null, created_at: at(5) },
        { outcome: "failed", detail: "boom", created_at: at(20) },
        { outcome: "started", detail: null, created_at: at(21) },
      ],
      NOW
    )
    expect(s?.label).toBe("Connected")
    expect(s?.tone).toBe("ok")
  })

  it("explains failures", () => {
    const s = summarizeConnectAttempts(
      [{ outcome: "failed", detail: "User is not a professional account", created_at: at(10) }],
      NOW
    )
    expect(s?.hint).toMatch(/Business\/Creator/)
  })
})

describe("explainFailure", () => {
  it("recognises tester and expired-code errors", () => {
    expect(explainFailure("Insufficient developer role")).toMatch(/Tester/)
    expect(explainFailure("This authorization code has been used")).toMatch(/expired/)
    expect(explainFailure("")).toBe("Unknown error.")
  })
})
