import { beforeEach, describe, expect, it, vi } from "vitest"

// Minimal thenable stand-in for the Supabase query builder.
const processedLookups: string[][] = []
const ALREADY_PROCESSED = new Set(["c-old-1", "c-old-2"])

vi.mock("@/lib/supabase", () => {
  function builder(table: string) {
    let inValues: string[] = []
    const result = () => {
      if (table === "dm_automations") {
        return {
          data: [
            {
              instagram_account_id: "acc-1",
              post_id: "media-1",
              match_any_post: false,
              created_at: "2026-01-01T00:00:00Z",
            },
          ],
          error: null,
        }
      }
      if (table === "processed_comments") {
        processedLookups.push(inValues)
        return {
          data: inValues.filter((id) => ALREADY_PROCESSED.has(id)).map((comment_id) => ({ comment_id })),
          error: null,
        }
      }
      return { data: null, error: null }
    }
    const b = {
      select: () => b,
      eq: () => b,
      in: (_col: string, values: string[]) => {
        inValues = values
        return b
      },
      maybeSingle: async () => ({
        data: { id: "acc-1", instagram_id: "ig-owner", access_token: "enc", token_error: null },
        error: null,
      }),
      then: (resolve: (v: unknown) => void) => resolve(result()),
    }
    return b
  }
  return { supabase: { from: builder } }
})

vi.mock("@/lib/meta/oauth", () => ({ decryptToken: () => "token" }))
vi.mock("@/lib/meta/accounts", () => ({ markTokenError: vi.fn() }))

const now = new Date().toISOString()
vi.mock("@/lib/meta/client", () => ({
  TokenExpiredError: class extends Error {},
  getUserMedia: vi.fn(),
  getMediaComments: vi.fn(async () => [
    { id: "c-new-1", text: "Beta", timestamp: now, from: { id: "u1", username: "one" } },
    { id: "c-old-1", text: "Beta", timestamp: now, from: { id: "u2", username: "two" } },
    { id: "c-old-2", text: "Beta", timestamp: now, from: { id: "u3", username: "three" } },
    { id: "c-own", text: "Beta", timestamp: now, from: { id: "ig-owner", username: "me" } },
    { id: "c-new-2", text: "hi", timestamp: now, from: { id: "u4", username: "four" } },
  ]),
}))

const queueMatchingComment = vi.fn(async () => true)
vi.mock("@/lib/meta/enqueue", () => ({
  queueMatchingComment: (...args: unknown[]) => queueMatchingComment(...(args as [])),
}))

import { pollAutomationComments } from "./poll-comments"

describe("pollAutomationComments dedup", () => {
  beforeEach(() => {
    processedLookups.length = 0
    queueMatchingComment.mockClear()
  })

  it("looks up processed comments in one query and only queues new ones", async () => {
    const result = await pollAutomationComments()

    // One batched lookup, without the account's own comment.
    expect(processedLookups).toEqual([["c-new-1", "c-old-1", "c-old-2", "c-new-2"]])
    const queuedIds = queueMatchingComment.mock.calls.map(
      (call) => (call as unknown as [{ commentId: string }])[0].commentId
    )
    expect(queuedIds).toEqual(["c-new-1", "c-new-2"])
    expect(result).toEqual({ queued: 2, errors: 0 })
  })
})
