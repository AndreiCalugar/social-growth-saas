import { randomBytes } from "node:crypto"
import { supabase } from "@/lib/supabase"
import { getBaseUrl } from "@/lib/meta/env"

// Click tracking for DM links. At send time every http(s) link in the DM is
// swapped for /r/<code>, one code per DM and link, so we can count how many
// recipients clicked. See schema/024-click-tracking.sql.

const CODE_ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
const CODE_LENGTH = 8

// http(s) URLs up to the first whitespace. Trailing punctuation that usually
// ends a sentence (".", ",", "!", ")") is trimmed off below.
const URL_PATTERN = /https?:\/\/[^\s<>"]+/gi
const TRAILING_PUNCTUATION = /[.,!?;:)\]}'"»”]+$/

export function generateCode(): string {
  const bytes = randomBytes(CODE_LENGTH)
  let code = ""
  for (const b of bytes) code += CODE_ALPHABET[b % CODE_ALPHABET.length]
  return code
}

/** Distinct links in a message, in order of appearance. */
export function extractLinks(message: string): string[] {
  const found = new Set<string>()
  for (const match of message.matchAll(URL_PATTERN)) {
    const url = match[0].replace(TRAILING_PUNCTUATION, "")
    if (url.length > "https://".length) found.add(url)
  }
  return Array.from(found)
}

/** Replace each link with its short link, leaving everything else untouched. */
export function rewriteLinks(message: string, shortLinks: Map<string, string>): string {
  return message.replace(URL_PATTERN, (raw) => {
    const url = raw.replace(TRAILING_PUNCTUATION, "")
    const short = shortLinks.get(url)
    return short ? short + raw.slice(url.length) : raw
  })
}

export function shortLinkFor(code: string): string {
  return `${getBaseUrl().replace(/\/$/, "")}/r/${code}`
}

/**
 * The DM text with tracked links, or the original text if anything fails.
 * Tracking must never stop a DM from going out.
 */
export async function withTrackedLinks(opts: {
  message: string
  userId: string
  automationId: string
  dmLogId: string
}): Promise<string> {
  const links = extractLinks(opts.message)
  if (links.length === 0) return opts.message

  try {
    // Reuse codes from an earlier attempt of the same DM (a retried send).
    const { data: existing, error: loadError } = await supabase
      .from("tracked_links")
      .select("code, target_url")
      .eq("dm_log_id", opts.dmLogId)
    if (loadError) throw loadError

    const codes = new Map<string, string>()
    for (const row of existing ?? []) codes.set(row.target_url, row.code)

    const missing = links.filter((url) => !codes.has(url))
    if (missing.length > 0) {
      const rows = missing.map((target_url) => ({
        code: generateCode(),
        user_id: opts.userId,
        automation_id: opts.automationId,
        dm_log_id: opts.dmLogId,
        target_url,
      }))
      const { error: insertError } = await supabase.from("tracked_links").insert(rows)
      if (insertError) throw insertError
      for (const row of rows) codes.set(row.target_url, row.code)
    }

    const shortLinks = new Map<string, string>()
    for (const [url, code] of codes) shortLinks.set(url, shortLinkFor(code))
    return rewriteLinks(opts.message, shortLinks)
  } catch (err) {
    console.error("[link-tracking] falling back to untracked links", err)
    return opts.message
  }
}

// Link-preview crawlers (Instagram fetches every link in a DM to build the
// preview card) and other bots must not count as clicks.
const BOT_USER_AGENT =
  /facebookexternalhit|facebot|meta-externalagent|meta-externalfetcher|\bbot\b|bot\/|crawler|spider|preview|slurp|whatsapp|telegram|discord|slack|skype|curl|wget|python-requests|headless/i

export function isBotUserAgent(userAgent: string | null): boolean {
  if (!userAgent) return true
  return BOT_USER_AGENT.test(userAgent)
}
