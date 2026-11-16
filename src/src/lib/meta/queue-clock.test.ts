import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/supabase", () => ({ supabase: {} }))
vi.mock("@/lib/meta/poll-comments", () => ({ pollAutomationComments: vi.fn() }))
vi.mock("@/lib/meta/process-queue", () => ({ drainDmQueue: vi.fn() }))

import {
  PG_CRON,
  QUEUE_TICK,
  decideTick,
  handleTick,
  needsRearm,
  nextTick,
  recordPgCronRun,
  type ClockDeps,
  type Heartbeat,
} from "./queue-clock"

const NOW = Date.parse("2026-11-16T03:00:30Z")
const ago = (ms: number) => new Date(NOW - ms).toISOString()
const beat = (msAgo: number, deployment_id: string | null = "dpl_new"): Heartbeat => ({
  last_run_at: ago(msAgo),
  deployment_id,
})

function fakeDeps(overrides: Partial<ClockDeps> & { beats?: Record<string, Heartbeat | null> } = {}) {
  const beats = { ...(overrides.beats ?? {}) }
  const sent: { delaySeconds: number; idempotencyKey: string }[] = []
  const written: string[] = []
  const deps: ClockDeps = {
    now: () => NOW,
    deployment: () => ({ isProduction: true, deploymentId: "dpl_new" }),
    readHeartbeat: async (name) => beats[name] ?? null,
    writeHeartbeat: async (name) => {
      written.push(name)
    },
    sendTick: async (delaySeconds, idempotencyKey) => {
      sent.push({ delaySeconds, idempotencyKey })
    },
    doWork: vi.fn(async () => ({ sent: 1 })),
    ...overrides,
  }
  return { deps, sent, written }
}

describe("decideTick", () => {
  const base = { now: NOW, isProduction: true, deploymentId: "dpl_new" }

  it("stops outside production", () => {
    expect(decideTick({ ...base, isProduction: false, pgCron: null })).toEqual({ action: "stop", reason: "not_production" })
    expect(decideTick({ ...base, deploymentId: null, pgCron: null })).toEqual({ action: "stop", reason: "not_production" })
  })

  it("keeps ticking but skips the work while pg_cron is alive", () => {
    expect(decideTick({ ...base, pgCron: beat(20_000) })).toEqual({ action: "continue", work: false })
  })

  it("does the work when pg_cron has been silent", () => {
    expect(decideTick({ ...base, pgCron: beat(120_000) })).toEqual({ action: "continue", work: true })
    expect(decideTick({ ...base, pgCron: null })).toEqual({ action: "continue", work: true })
  })

  it("stops an old deployment's chain when pg_cron reports a newer one", () => {
    expect(decideTick({ ...base, deploymentId: "dpl_old", pgCron: beat(20_000) })).toEqual({
      action: "stop",
      reason: "old_deployment",
    })
  })

  it("lets an old deployment keep the queue going if pg_cron has been down a while", () => {
    expect(decideTick({ ...base, deploymentId: "dpl_old", pgCron: beat(10 * 60_000) })).toEqual({
      action: "continue",
      work: true,
    })
  })
})

describe("nextTick", () => {
  it("targets the start of the next minute", () => {
    expect(nextTick(NOW, "dpl_new")).toEqual({
      delaySeconds: 30,
      idempotencyKey: `tick-dpl_new-${Math.floor(NOW / 60_000) + 1}`,
    })
  })

  it("gives every sender in the same minute the same key", () => {
    expect(nextTick(NOW + 25_000, "d").idempotencyKey).toBe(nextTick(NOW - 25_000, "d").idempotencyKey)
  })

  it("never schedules with zero delay", () => {
    const onBoundary = Math.floor(NOW / 60_000) * 60_000 + 59_999
    expect(nextTick(onBoundary, "d").delaySeconds).toBe(1)
  })
})

describe("needsRearm", () => {
  it("re-arms when there is no tick, a tick from another deployment, or a stale one", () => {
    expect(needsRearm({ now: NOW, deploymentId: "dpl_new", tick: null })).toBe(true)
    expect(needsRearm({ now: NOW, deploymentId: "dpl_new", tick: beat(30_000, "dpl_old") })).toBe(true)
    expect(needsRearm({ now: NOW, deploymentId: "dpl_new", tick: beat(4 * 60_000) })).toBe(true)
  })

  it("leaves a healthy chain alone", () => {
    expect(needsRearm({ now: NOW, deploymentId: "dpl_new", tick: beat(30_000) })).toBe(false)
  })
})

describe("handleTick", () => {
  it("schedules the next tick, records itself, and skips the work while pg_cron runs", async () => {
    const { deps, sent, written } = fakeDeps({ beats: { [PG_CRON]: beat(10_000) } })
    const result = await handleTick(deps)
    expect(sent).toHaveLength(1)
    expect(written).toEqual([QUEUE_TICK])
    expect(deps.doWork).not.toHaveBeenCalled()
    expect(result).toMatchObject({ worked: false })
  })

  it("runs the queue when pg_cron is silent", async () => {
    const { deps, sent } = fakeDeps({ beats: { [PG_CRON]: beat(5 * 60_000) } })
    const result = await handleTick(deps)
    expect(sent).toHaveLength(1)
    expect(deps.doWork).toHaveBeenCalledOnce()
    expect(result).toMatchObject({ worked: true, result: { sent: 1 } })
  })

  it("schedules the next tick before the work, and survives a work failure", async () => {
    const order: string[] = []
    const { deps } = fakeDeps({
      sendTick: async () => {
        order.push("send")
      },
      doWork: async () => {
        order.push("work")
        throw new Error("db down")
      },
    })
    const result = await handleTick(deps)
    expect(order).toEqual(["send", "work"])
    expect(result).toMatchObject({ worked: true, error: "db down" })
  })

  it("throws when the next tick can't be scheduled, so Vercel redelivers", async () => {
    const { deps } = fakeDeps({
      sendTick: async () => {
        throw new Error("queue unavailable")
      },
    })
    await expect(handleTick(deps)).rejects.toThrow("queue unavailable")
    expect(deps.doWork).not.toHaveBeenCalled()
  })

  it("ends an old deployment's chain without sending", async () => {
    const { deps, sent } = fakeDeps({
      deployment: () => ({ isProduction: true, deploymentId: "dpl_old" }),
      beats: { [PG_CRON]: beat(10_000, "dpl_new") },
    })
    expect(await handleTick(deps)).toEqual({ stopped: "old_deployment" })
    expect(sent).toHaveLength(0)
  })
})

describe("recordPgCronRun", () => {
  it("records pg_cron and starts the chain when there is none", async () => {
    const { deps, sent, written } = fakeDeps()
    expect(await recordPgCronRun(deps)).toEqual({ rearmed: true })
    expect(written).toEqual([PG_CRON])
    expect(sent).toHaveLength(1)
  })

  it("doesn't send when the chain is healthy", async () => {
    const { deps, sent } = fakeDeps({ beats: { [QUEUE_TICK]: beat(30_000) } })
    expect(await recordPgCronRun(deps)).toEqual({ rearmed: false })
    expect(sent).toHaveLength(0)
  })

  it("never sends outside production, and never throws", async () => {
    const local = fakeDeps({ deployment: () => ({ isProduction: false, deploymentId: null }) })
    expect(await recordPgCronRun(local.deps)).toEqual({ rearmed: false })
    expect(local.sent).toHaveLength(0)

    const broken = fakeDeps({
      sendTick: async () => {
        throw new Error("queue unavailable")
      },
    })
    expect(await recordPgCronRun(broken.deps)).toEqual({ rearmed: false })
  })
})
