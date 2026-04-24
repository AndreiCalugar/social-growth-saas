/**
 * Client-side wrapper around /api/scrape/trigger. Used by every UI surface
 * that can fire a scrape (retry button, profile detail rescrape, profile
 * card action) so the cooldown response is parsed consistently.
 */

export type TriggerResult =
  | { status: "fired"; username: string }
  | {
      status: "cooldown"
      reason: "hard" | "soft"
      minutesUntilNext: number
      lastScrapedAt: string
      username: string
    }
  | { status: "error"; message: string }

export async function triggerScrape(
  profileId: string,
  opts: { force?: boolean } = {}
): Promise<TriggerResult> {
  try {
    const res = await fetch("/api/scrape/trigger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileId, force: opts.force === true }),
    })
    const body = await res.json().catch(() => ({}))

    if (res.status === 409 && body?.ok === false) {
      return {
        status: "cooldown",
        reason: body.reason === "hard" ? "hard" : "soft",
        minutesUntilNext: Number(body.minutesUntilNext) || 0,
        lastScrapedAt: String(body.lastScrapedAt ?? ""),
        username: String(body.username ?? ""),
      }
    }
    if (res.ok && body?.success) {
      return { status: "fired", username: String(body.username ?? "") }
    }
    return { status: "error", message: body?.error ?? `HTTP ${res.status}` }
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "Network error" }
  }
}
