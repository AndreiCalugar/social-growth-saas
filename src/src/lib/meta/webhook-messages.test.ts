import { describe, expect, it } from "vitest"
import { parseCommentEvents, parseMessageEvents, type WebhookPayload } from "./webhook"

const ACCOUNT = "17841400000000001"
const FOLLOWER = "955632324073389"

function payload(messaging: unknown[]): WebhookPayload {
  return { object: "instagram", entry: [{ id: ACCOUNT, time: 1, messaging }] } as WebhookPayload
}

describe("parseMessageEvents", () => {
  it("reads a plain DM", () => {
    const events = parseMessageEvents(
      payload([{ sender: { id: FOLLOWER }, recipient: { id: ACCOUNT }, message: { mid: "m1", text: " VREAU " } }])
    )
    expect(events).toEqual([
      { instagramAccountId: ACCOUNT, messageId: "m1", senderId: FOLLOWER, text: "VREAU", isStoryReply: false },
    ])
  })

  it("marks story replies", () => {
    const [event] = parseMessageEvents(
      payload([
        {
          sender: { id: FOLLOWER },
          recipient: { id: ACCOUNT },
          message: { mid: "m2", text: "link", reply_to: { story: { id: "s1", url: "https://x" } } },
        },
      ])
    )
    expect(event.isStoryReply).toBe(true)
  })

  it("treats a reply to an earlier message as a plain DM", () => {
    const [event] = parseMessageEvents(
      payload([{ sender: { id: FOLLOWER }, message: { mid: "m3", text: "link", reply_to: { mid: "m0" } } }])
    )
    expect(event.isStoryReply).toBe(false)
  })

  it("never triggers on our own messages (echoes and the account itself)", () => {
    expect(
      parseMessageEvents(
        payload([
          { sender: { id: ACCOUNT }, recipient: { id: FOLLOWER }, message: { mid: "e1", text: "LINK", is_echo: true } },
          { sender: { id: ACCOUNT }, recipient: { id: FOLLOWER }, message: { mid: "e2", text: "LINK" } },
        ])
      )
    ).toEqual([])
  })

  it("skips messages without text, deleted ones, reads and reactions", () => {
    expect(
      parseMessageEvents(
        payload([
          { sender: { id: FOLLOWER }, message: { mid: "a1", attachments: [{ type: "ig_reel" }] } },
          { sender: { id: FOLLOWER }, message: { mid: "d1", text: "VREAU", is_deleted: true } },
          { sender: { id: FOLLOWER }, read: { mid: "m1" } },
          { sender: { id: FOLLOWER }, reaction: { mid: "m1", action: "react" } },
        ])
      )
    ).toEqual([])
  })

  it("leaves comment parsing alone", () => {
    const p = payload([{ sender: { id: FOLLOWER }, message: { mid: "m1", text: "VREAU" } }])
    expect(parseCommentEvents(p)).toEqual([])
  })
})
