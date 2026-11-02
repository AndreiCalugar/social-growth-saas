import { supabase } from "@/lib/supabase"
import { matchKeywords } from "@/lib/meta/keyword-matcher"
import type { WebhookCommentEvent } from "@/lib/meta/webhook"

interface AutomationRow {
  id: string
  user_id: string
  instagram_account_id: string
  post_id: string | null
  match_any_post: boolean
  keywords: string[]
  whole_word_match: boolean
}

/**
 * Match one comment against the account's active automations and queue a
 * pending dm_logs row for the first hit. Shared by the webhook receiver and
 * the comment poller, so a comment seen by both is only handled once:
 * processed_comments dedups before matching, and the (automation_id,
 * comment_id) unique key backs that up.
 *
 * Returns true if a new row was queued.
 */
export async function queueMatchingComment(
  event: WebhookCommentEvent
): Promise<boolean> {
  const { error: dedupError } = await supabase
    .from("processed_comments")
    .insert({
      instagram_account_id: event.instagramAccountId,
      comment_id: event.commentId,
    })
  // 23505 = unique_violation → already handled this comment.
  if (dedupError) {
    if (dedupError.code === "23505") return false
    throw new Error(`processed_comments insert failed: ${dedupError.message}`)
  }

  const { data: account } = await supabase
    .from("instagram_accounts")
    .select("id, user_id")
    .eq("instagram_id", event.instagramAccountId)
    .maybeSingle()
  if (!account) return false

  const { data: automations } = await supabase
    .from("dm_automations")
    .select("id, user_id, instagram_account_id, post_id, match_any_post, keywords, whole_word_match")
    .eq("instagram_account_id", account.id)
    .eq("is_active", true)

  for (const automation of (automations ?? []) as AutomationRow[]) {
    const postMatches =
      automation.match_any_post ||
      (automation.post_id !== null &&
        (automation.post_id === event.mediaId ||
          automation.post_id === event.originalMediaId))
    if (!postMatches) continue

    const keywords = Array.isArray(automation.keywords)
      ? automation.keywords
      : []
    const match = matchKeywords(
      event.commentText,
      keywords,
      automation.whole_word_match
    )
    if (!match.matched) continue

    const { error: insertError } = await supabase.from("dm_logs").insert({
      user_id: automation.user_id,
      automation_id: automation.id,
      instagram_account_id: account.id,
      commenter_id: event.commenterId,
      commenter_name: event.commenterName ?? null,
      comment_id: event.commentId,
      comment_text: event.commentText,
      matched_keyword: match.matchedKeyword,
      status: "pending",
    })
    if (insertError && insertError.code !== "23505") {
      throw new Error(`dm_logs insert failed: ${insertError.message}`)
    }
    // First matching automation wins for this comment — matches
    // OpenReply's behavior of one DM per comment.
    return !insertError
  }

  return false
}
