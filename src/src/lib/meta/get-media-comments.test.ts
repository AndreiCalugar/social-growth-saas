import { afterEach, describe, expect, it, vi } from "vitest"
import { getMediaComments } from "./client"

// Three pages of comments, newest first, like the Graph API returns them.
const PAGES = [
  { ts: ["2026-11-05T12:00:00Z", "2026-11-05T11:00:00Z"], next: "page-1" },
  { ts: ["2026-11-05T10:00:00Z", "2026-11-05T09:00:00Z"], next: "page-2" },
  { ts: ["2026-11-04T10:00:00Z", "2026-11-04T09:00:00Z"], next: undefined },
]

function mockGraph() {
  const fetchMock = vi.fn(async (url: string) => {
    const i = url.includes("page-2") ? 2 : url.includes("page-1") ? 1 : 0
    const page = PAGES[i]
    return new Response(
      JSON.stringify({
        data: page.ts.map((timestamp, j) => ({ id: `${i}-${j}`, timestamp })),
        paging: page.next ? { next: `https://graph.instagram.com/${page.next}` } : {},
      }),
      { status: 200 }
    )
  })
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

afterEach(() => vi.unstubAllGlobals())

describe("getMediaComments pagination", () => {
  it("keeps paging while comments are newer than `since`", async () => {
    const fetchMock = mockGraph()
    const since = new Date("2026-11-05T08:00:00Z").getTime()
    const comments = await getMediaComments("token", "media", { since })
    // Page 3 starts older than `since`, but page 2's last item was still
    // newer, so page 3 is fetched and then paging stops.
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(comments).toHaveLength(6)
  })

  it("stops as soon as a page reaches comments older than `since`", async () => {
    const fetchMock = mockGraph()
    const since = new Date("2026-11-05T11:30:00Z").getTime()
    await getMediaComments("token", "media", { since })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("never fetches more than maxPages", async () => {
    const fetchMock = mockGraph()
    await getMediaComments("token", "media", { since: 0, maxPages: 2 })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
