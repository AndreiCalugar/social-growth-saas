import { supabase } from "@/lib/supabase"
import { matchKeywords } from "@/lib/meta/keyword-matcher"
import type { WebhookCommentEvent, WebhookMessageEvent } from "@/lib/meta/webhook"
import { automationTriggers, messageTrigger, type TriggerType } from "@/lib/dm-triggers"
import { decryptToken } from "@/lib/meta/oauth"
import { getConversationMessageTimes } from "@/lib/meta/client"

export type { TriggerType }

interface AutomationRow {
  id: string
  user_id: string
  instagram_account_id: string
  post_id: string | null
  match_any_post: boolean
  keywords: string[]
  whole_word_match: boolean
  triggers: TriggerType[]
}

const AUTOMATION_COLUMNS =
  "id, user_id, instagram_account_id, post_id, match_any_post, keywords, whole_word_match"

// One answer per person per automation in this window, so someone who keeps
// messaging the keyword (or a conversation that repeats it) isn't spammed.
const MESSAGE_TRIGGER_COOLDOWN_MS = 24 * 60 * 60 * 1000

/**
 * The account's active automations with their triggers. Falls back step by
 * step for databases without schema/027 (single trigger_type) or without
 * schema/025 (every automation is a comment automation), so the comment
 * flow behaves exactly as before either way.
 */
async function loadActiveAutomations(accountId: string): Promise<AutomationRow[]> {
  for (const extra of [", triggers, trigger_type", ", trigger_type", ""]) {
    const { data, error } = await supabase
      .from("dm_automations")
      .select(AUTOMATION_COLUMNS + extra)
      .eq("instagram_account_id", accountId)
      .eq("is_active", true)
    if (error) continue
    return ((data ?? []) as unknown as (Omit<AutomationRow, "triggers"> & { triggers?: string[]; trigger_type?: string })[]).map(
      ({ triggers, trigger_type, ...a }) => ({ ...a, triggers: automationTriggers({ triggers, trigger_type }) })
    )
  }
  return []
}

/**
 * Match one comment against the account's active comment automations and
 * queue a pending dm_logs row for the first hit. Shared by the webhook
 * receiver and the comment poller, so a comment seen by both is only
 * handled once: processed_comments dedups before matching, and the
 * (automation_id, comment_id) unique key backs that up.
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

  const automations = (await loadActiveAutomations(account.id)).filter((a) =>
    a.triggers.includes("comment")
  )

  for (const automation of automations) {
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

/**
 * Match an incoming DM against the account's automations that listen to
 * DMs or story replies, and queue the answer. A story reply is checked
 * against story-reply automations first, then DM automations (it is a DM
 * too); a plain DM only against DM automations. The message id goes in
 * dm_logs.comment_id, so a webhook delivered twice is queued once.
 *
 * If no keyword matches, a first-ever message from this person starts the
 * account's welcome automation ("new_conversation" trigger), if any.
 *
 * Returns true if a new row was queued.
 */
export async function queueMatchingMessage(
  event: WebhookMessageEvent,
  opts: { knownContact?: boolean } = {}
): Promise<boolean> {
  const { data: account } = await supabase
    .from("instagram_accounts")
    .select("id, access_token")
    .eq("instagram_id", event.instagramAccountId)
    .maybeSingle()
  if (!account) return false

  const all = await loadActiveAutomations(account.id)
  const order: TriggerType[] = event.isStoryReply ? ["story_reply", "dm"] : ["dm"]
  const candidates = order.flatMap((type) =>
    all
      .filter((a) => messageTrigger(a.triggers, event.isStoryReply) === type)
      .map((automation) => ({ automation, trigger: type }))
  )

  for (const { automation, trigger } of candidates) {
    const match = matchKeywords(
      event.text,
      Array.isArray(automation.keywords) ? automation.keywords : [],
      automation.whole_word_match
    )
    if (!match.matched) continue

    // Already answered this person recently by this automation — through
    // any trigger, so someone who comments and then also DMs the keyword
    // gets the link once → do nothing (no other automation either: they're
    // mid-conversation about this one).
    const since = new Date(Date.now() - MESSAGE_TRIGGER_COOLDOWN_MS).toISOString()
    const { count } = await supabase
      .from("dm_logs")
      .select("id", { count: "exact", head: true })
      .eq("automation_id", automation.id)
      .eq("commenter_id", event.senderId)
      .gte("created_at", since)
    if ((count ?? 0) > 0) return false

    const { error: insertError } = await supabase.from("dm_logs").insert({
      user_id: automation.user_id,
      automation_id: automation.id,
      instagram_account_id: account.id,
      commenter_id: event.senderId,
      comment_id: event.messageId,
      comment_text: event.text,
      matched_keyword: match.matchedKeyword,
      trigger_type: trigger,
      status: "pending",
    })
    if (insertError && insertError.code !== "23505") {
      throw new Error(`dm_logs insert failed: ${insertError.message}`)
    }
    return !insertError
  }

  // No keyword automation answered: welcome a brand-new conversation.
  const welcome = all.find((a) => a.triggers.includes("new_conversation"))
  if (!welcome || opts.knownContact !== false) return false
  if (!(await isNewConversation(account.access_token, event.senderId))) return false

  const { error: insertError } = await supabase.from("dm_logs").insert({
    user_id: welcome.user_id,
    automation_id: welcome.id,
    instagram_account_id: account.id,
    commenter_id: event.senderId,
    comment_id: event.messageId,
    comment_text: event.text,
    matched_keyword: null,
    trigger_type: "new_conversation",
    status: "pending",
  })
  if (insertError && insertError.code !== "23505") {
    throw new Error(`dm_logs insert failed: ${insertError.message}`)
  }
  return !insertError
}

// Messages older than this mean the conversation existed before. A short
// grace lets "Hi" + "I want the guide" sent back to back still count as new.
const NEW_CONVERSATION_GRACE_MS = 2 * 60 * 1000

/**
 * Is this the person's first conversation with the account? We haven't
 * seen them (checked by the caller), but the app may have been connected
 * after they last talked: ask Instagram. If Instagram can't tell us, say
 * no — a "Welcome!" to an existing customer is worse than none.
 */
async function isNewConversation(encryptedToken: string, igsid: string): Promise<boolean> {
  try {
    const times = await getConversationMessageTimes(decryptToken(encryptedToken), igsid)
    const cutoff = Date.now() - NEW_CONVERSATION_GRACE_MS
    return !times.some((t) => new Date(t).getTime() < cutoff)
  } catch (err) {
    console.warn("[enqueue] conversation lookup failed, no welcome:", err instanceof Error ? err.message : err)
    return false
  }
}
