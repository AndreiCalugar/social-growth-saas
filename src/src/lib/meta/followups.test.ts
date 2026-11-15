import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/supabase", () => ({ supabase: {} }))

import { decideFollowup, followupSendAfter } from "./followups"

const h = (n: number) => n * 3600_000
const now = new Date("2026-11-15T12:00:00Z")
const ago = (hours: number) => new Date(now.getTime() - h(hours))

describe("followupSendAfter", () => {
  it("waits the chosen hours after the DM", () => {
    expect(followupSendAfter(now, ago(0), 20)).toEqual(new Date(now.getTime() + h(20)))
  })

  it("never lands later than 23h after their last message", () => {
    // They wrote 10h ago: 20h from now would be 30h after → capped at 23h.
    expect(followupSendAfter(now, ago(10), 20)).toEqual(new Date(now.getTime() + h(13)))
  })

  it("isn't scheduled when they never messaged or the window is almost gone", () => {
    expect(followupSendAfter(now, null, 20)).toBeNull()
    expect(followupSendAfter(now, ago(23.5), 20)).toBeNull()
  })

  it("keeps the delay between 1 and 23 hours", () => {
    expect(followupSendAfter(now, ago(0), 0)).toEqual(new Date(now.getTime() + h(1)))
    expect(followupSendAfter(now, ago(0), 48)).toEqual(new Date(now.getTime() + h(23)))
  })
})

describe("decideFollowup", () => {
  const base = { now, lastInbound: ago(20), audience: "not_clicked" as const, clicked: false, automationLive: true }

  it("sends a reminder to someone who didn't open the link", () => {
    expect(decideFollowup(base)).toEqual({ send: true })
  })

  it("skips the reminder once they opened the link", () => {
    expect(decideFollowup({ ...base, clicked: true })).toEqual({ send: false, reason: "clicked" })
  })

  it("sends the feedback question only to people who opened it", () => {
    expect(decideFollowup({ ...base, audience: "clicked", clicked: true })).toEqual({ send: true })
    expect(decideFollowup({ ...base, audience: "clicked" })).toEqual({ send: false, reason: "not_clicked" })
  })

  it("never sends outside Instagram's 24h window", () => {
    expect(decideFollowup({ ...base, lastInbound: ago(23.9) })).toEqual({ send: false, reason: "window_closed" })
    expect(decideFollowup({ ...base, lastInbound: null })).toEqual({ send: false, reason: "window_closed" })
  })

  it("skips when the automation was paused or the follow-up turned off", () => {
    expect(decideFollowup({ ...base, automationLive: false })).toEqual({ send: false, reason: "automation_off" })
  })
})
