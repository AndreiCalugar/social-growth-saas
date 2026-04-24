/**
 * Two-tier scrape cooldown used by every path that can trigger a scrape.
 *
 * - Within HARD_COOLDOWN_MS of last_scraped → always blocked. No point
 *   rescraping — data would be identical.
 * - Between hard and soft → blocked by default; accept `force: true` to
 *   override. Most rescrapes inside this window return ~identical data
 *   (same posts, marginal engagement drift).
 * - After SOFT_COOLDOWN_MS → freely allowed.
 *
 * Dedupe is handled naturally downstream: posts upsert on
 * platform_post_id, so even a forced rescrape just updates engagement
 * on existing rows + inserts any new posts.
 */

export const HARD_COOLDOWN_MS = 15 * 60 * 1000          // 15 minutes
export const SOFT_COOLDOWN_MS = 24 * 60 * 60 * 1000     // 24 hours

export type CooldownBlocked = {
  ok: false
  reason: "hard" | "soft"
  minutesUntilNext: number
  lastScrapedAt: string
}

export type CooldownResult = { ok: true } | CooldownBlocked

export function canScrape(
  lastScraped: string | null | undefined,
  opts: { force?: boolean } = {}
): CooldownResult {
  if (!lastScraped) return { ok: true }

  const age = Date.now() - new Date(lastScraped).getTime()
  if (Number.isNaN(age) || age < 0) return { ok: true }

  if (age < HARD_COOLDOWN_MS) {
    return {
      ok: false,
      reason: "hard",
      minutesUntilNext: Math.max(1, Math.ceil((HARD_COOLDOWN_MS - age) / 60_000)),
      lastScrapedAt: lastScraped,
    }
  }

  if (!opts.force && age < SOFT_COOLDOWN_MS) {
    return {
      ok: false,
      reason: "soft",
      minutesUntilNext: Math.max(1, Math.ceil((SOFT_COOLDOWN_MS - age) / 60_000)),
      lastScrapedAt: lastScraped,
    }
  }

  return { ok: true }
}

/** Human-readable countdown like "14 min" / "22 h" — for UI tooltips. */
export function formatMinutesUntil(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.round(minutes / 60)
  return `${hours} h`
}
