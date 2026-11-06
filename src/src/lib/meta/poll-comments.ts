import { supabase } from "@/lib/supabase"
import { decryptToken } from "@/lib/meta/oauth"
import { getMediaComments, getUserMedia, TokenExpiredError } from "@/lib/meta/client"
import { markTokenError } from "@/lib/meta/accounts"
import { queueMatchingComment } from "@/lib/meta/enqueue"
import type { InstagramComment } from "@/lib/meta/client"

/**
 * Fallback for missed webhooks: read recent comments on every post an active
 * automation watches and queue the ones the webhook never delivered. Meta
 * doesn't guarantee delivery (in testing it skipped every comment from one
 * tester account), while reading comments works reliably.
 *
 * Only comments newer than LOOKBACK_MS and newer than the automation itself
 * are considered, so turning on an automation never DMs old commenters.
 * Dedup is shared with the webhook via queueMatchingComment.
 */

const LOOKBACK_MS = 24 * 60 * 60 * 1000
// For "any post" automations, how many of the latest posts to scan.
const ANY_POST_MEDIA_LIMIT = 5
// Comment ids per processed_comments lookup (keeps the request URL short).
const DEDUP_CHUNK = 100

/**
 * Which of these comment ids were already handled. One query per chunk
 * instead of an insert-and-fail per comment: every poll re-reads the last
 * 24h of comments, so without this a busy reel meant 100+ duplicate inserts
 * (each a unique-violation error in Postgres) every minute.
 */
async function alreadyProcessed(commentIds: string[]): Promise<Set<string>> {
  const seen = new Set<string>()
  for (let i = 0; i < commentIds.length; i += DEDUP_CHUNK) {
    const chunk = commentIds.slice(i, i + DEDUP_CHUNK)
    const { data, error } = await supabase
      .from("processed_comments")
      .select("comment_id")
      .in("comment_id", chunk)
    if (error) throw new Error(`processed_comments lookup failed: ${error.message}`)
    for (const row of data ?? []) seen.add(row.comment_id)
  }
  return seen
}

interface PollAutomation {
  instagram_account_id: string
  post_id: string | null
  match_any_post: boolean
  created_at: string
}

export async function pollAutomationComments(): Promise<{
  queued: number
  errors: number
}> {
  const result = { queued: 0, errors: 0 }

  const { data: automations } = await supabase
    .from("dm_automations")
    .select("instagram_account_id, post_id, match_any_post, created_at")
    .eq("is_active", true)

  // Per account: media to scan → earliest timestamp worth considering.
  const byAccount = new Map<string, { anyPostSince: number | null; media: Map<string, number> }>()
  const lookbackStart = Date.now() - LOOKBACK_MS
  for (const a of (automations ?? []) as PollAutomation[]) {
    const since = Math.max(lookbackStart, new Date(a.created_at).getTime())
    const entry = byAccount.get(a.instagram_account_id) ?? { anyPostSince: null, media: new Map() }
    if (a.match_any_post) {
      entry.anyPostSince = Math.min(entry.anyPostSince ?? Infinity, since)
    } else if (a.post_id) {
      entry.media.set(a.post_id, Math.min(entry.media.get(a.post_id) ?? Infinity, since))
    }
    byAccount.set(a.instagram_account_id, entry)
  }

  for (const [accountId, { anyPostSince, media }] of Array.from(byAccount)) {
    const { data: account } = await supabase
      .from("instagram_accounts")
      .select("id, instagram_id, access_token, token_error")
      .eq("id", accountId)
      .maybeSingle()
    if (!account || account.token_error) continue

    try {
      const token = decryptToken(account.access_token)

      if (anyPostSince !== null) {
        for (const m of await getUserMedia(token, ANY_POST_MEDIA_LIMIT)) {
          media.set(m.id, Math.min(media.get(m.id) ?? Infinity, anyPostSince))
        }
      }

      const candidates: { comment: InstagramComment; mediaId: string }[] = []
      for (const [mediaId, since] of Array.from(media)) {
        const comments = await getMediaComments(token, mediaId, { since })
        for (const c of comments) {
          if (!c.from?.id || c.from.id === account.instagram_id) continue
          if (new Date(c.timestamp).getTime() < since) continue
          candidates.push({ comment: c, mediaId })
        }
      }

      // Skip comments already handled (by the webhook or an earlier poll);
      // queueMatchingComment still dedups for anything that races in.
      const seen = await alreadyProcessed(candidates.map((x) => x.comment.id))
      for (const { comment: c, mediaId } of candidates) {
        if (seen.has(c.id)) continue
        const queued = await queueMatchingComment({
          instagramAccountId: account.instagram_id,
          commentId: c.id,
          commentText: c.text ?? "",
          commenterId: c.from!.id,
          commenterName: c.from!.username,
          mediaId,
        })
        if (queued) result.queued++
      }
    } catch (err) {
      result.errors++
      if (err instanceof TokenExpiredError) {
        await markTokenError(accountId, err.message)
      }
      console.error("[poll-comments] account", accountId, err)
    }
  }

  return result
}
