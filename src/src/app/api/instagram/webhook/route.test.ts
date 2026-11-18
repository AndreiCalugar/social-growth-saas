import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const m = vi.hoisted(() => ({
  reachable: true,
  handle: vi.fn(),
  followUps: vi.fn(async () => {}),
  replay: vi.fn(async () => true),
  after: vi.fn(),
}))

vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after: m.after }))
vi.mock("@/lib/supabase", () => ({ supabase: { from: () => ({ insert: () => Promise.resolve({}) }) } }))
vi.mock("@/lib/meta/webhook", () => ({ verifyWebhookSignature: (_b: string, sig: string | null) => sig === "ok" }))
vi.mock("@/lib/meta/webhook-handler", () => ({ handleWebhookPayload: m.handle, runFollowUps: m.followUps }))
vi.mock("@/lib/meta/webhook-replay", () => ({
  databaseReachable: async () => m.reachable,
  scheduleReplay: m.replay,
}))

import { POST } from "./route"

const body = JSON.stringify({ object: "instagram", entry: [{ id: "1784", time: 1 }] })
const post = (signature = "ok") =>
  POST(
    new NextRequest("https://app.test/api/instagram/webhook", {
      method: "POST",
      body,
      headers: { "x-hub-signature-256": signature },
    })
  )

beforeEach(() => {
  m.reachable = true
  m.handle.mockReset().mockResolvedValue({ queued: 0, gateReplies: [], aiMessages: [] })
  m.replay.mockClear()
  m.after.mockClear()
})

describe("Instagram webhook POST", () => {
  it("rejects a bad signature without processing or replaying", async () => {
    const res = await post("bad")
    expect(res.status).toBe(401)
    expect(m.handle).not.toHaveBeenCalled()
    expect(m.replay).not.toHaveBeenCalled()
  })

  it("processes normally and sends after responding when something was queued", async () => {
    m.handle.mockResolvedValue({ queued: 1, gateReplies: [], aiMessages: [] })
    const res = await post()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ received: true, queued: 1 })
    expect(m.after).toHaveBeenCalledOnce()
    expect(m.replay).not.toHaveBeenCalled()
  })

  it("does nothing after responding for read receipts and echoes", async () => {
    await post()
    expect(m.after).not.toHaveBeenCalled()
  })

  it("keeps the delivery for replay when the database is down, without processing", async () => {
    m.reachable = false
    const res = await post()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ received: true, replay: true })
    expect(m.handle).not.toHaveBeenCalled()
    expect(m.replay).toHaveBeenCalledWith(body, JSON.parse(body), "database unreachable")
  })

  it("keeps the delivery for replay when processing fails, and still answers 200", async () => {
    m.handle.mockRejectedValue(new Error("processed_comments insert failed"))
    const res = await post()
    expect(res.status).toBe(200)
    expect(m.replay).toHaveBeenCalledWith(body, JSON.parse(body), "processing failed")
    expect(m.after).not.toHaveBeenCalled()
  })
})
