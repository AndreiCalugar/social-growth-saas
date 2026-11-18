import { beforeEach, describe, expect, it, vi } from "vitest"

// A tiny stand-in for the supabase query chain used by databaseReachable().
const probe = vi.hoisted(() => ({ result: { error: null } as unknown, throws: false }))
vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        limit: () => ({
          abortSignal: async () => {
            if (probe.throws) throw new Error("fetch failed")
            return probe.result
          },
        }),
      }),
    }),
  },
}))
vi.mock("@/lib/meta/queue-clock", () => ({ currentDeployment: () => ({ isProduction: false, deploymentId: null }) }))

import {
  REPLAY_MAX_DELIVERIES,
  databaseReachable,
  replayDelaySeconds,
  scheduleReplay,
  shouldGiveUp,
  type ReplayDeps,
  type ReplayMessage,
} from "./webhook-replay"

const payload = { object: "instagram", entry: [{ id: "1784", time: 1 }] }
const raw = JSON.stringify(payload)

function fakeDeps(overrides: Partial<ReplayDeps> = {}) {
  const sent: { message: ReplayMessage; key: string }[] = []
  const deps: ReplayDeps = {
    isProduction: () => true,
    send: async (message, key) => {
      sent.push({ message, key })
    },
    ...overrides,
  }
  return { deps, sent }
}

describe("replayDelaySeconds", () => {
  it("starts at a minute and doubles up to 10 minutes", () => {
    expect([1, 2, 3, 4, 5, 6, 30].map(replayDelaySeconds)).toEqual([60, 120, 240, 480, 600, 600, 600])
  })
})

describe("shouldGiveUp", () => {
  it("keeps trying for about 6 hours, then stops", () => {
    expect(shouldGiveUp(REPLAY_MAX_DELIVERIES - 1)).toBe(false)
    expect(shouldGiveUp(REPLAY_MAX_DELIVERIES)).toBe(true)
    const totalSeconds = Array.from({ length: REPLAY_MAX_DELIVERIES - 1 }, (_, i) => replayDelaySeconds(i + 1)).reduce(
      (a, b) => a + b
    )
    expect(totalSeconds / 3600).toBeGreaterThan(5)
    expect(totalSeconds / 3600).toBeLessThan(8)
  })
})

describe("databaseReachable", () => {
  beforeEach(() => {
    probe.result = { error: null }
    probe.throws = false
  })

  it("is true when the read works", async () => {
    expect(await databaseReachable()).toBe(true)
  })

  it("is false on an error (timeout, 522) or a thrown fetch", async () => {
    probe.result = { error: { message: "AbortError" } }
    expect(await databaseReachable()).toBe(false)
    probe.throws = true
    expect(await databaseReachable()).toBe(false)
  })
})

describe("scheduleReplay", () => {
  it("keeps the delivery with a key that's the same for the same body", async () => {
    const { deps, sent } = fakeDeps()
    expect(await scheduleReplay(raw, payload, "database unreachable", deps)).toBe(true)
    expect(await scheduleReplay(raw, payload, "database unreachable", deps)).toBe(true)
    expect(sent).toHaveLength(2)
    expect(sent[0].message).toEqual({ payload, reason: "database unreachable" })
    expect(sent[0].key).toBe(sent[1].key)
    expect(sent[0].key).toMatch(/^wh-[0-9a-f]{32}$/)

    await scheduleReplay(raw + " ", payload, "x", deps)
    expect(sent[2].key).not.toBe(sent[0].key)
  })

  it("doesn't send outside production", async () => {
    const { deps, sent } = fakeDeps({ isProduction: () => false })
    expect(await scheduleReplay(raw, payload, "database unreachable", deps)).toBe(false)
    expect(sent).toHaveLength(0)
  })

  it("never throws when the queue is down", async () => {
    const { deps } = fakeDeps({
      send: async () => {
        throw new Error("queue unavailable")
      },
    })
    expect(await scheduleReplay(raw, payload, "database unreachable", deps)).toBe(false)
  })
})
