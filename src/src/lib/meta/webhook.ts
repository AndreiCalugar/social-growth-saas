// Webhook signature verification + comment-event parsing.
// Ported from OpenReply's lib/meta/webhook.ts (MIT, github.com/diwenne/openreply).
// Message/postback/read parsers were not ported — comment-to-DM only (MVP).

import { createHmac, timingSafeEqual } from "crypto"

export function verifyWebhookSignature(
  payload: string,
  signature: string | null
): boolean {
  if (!signature) return false

  // Instagram-Login apps sign webhooks with the Instagram app secret, while
  // Facebook-Login apps use the Facebook app secret. Both belong to the same
  // app, so accept a signature that matches either — this avoids a config
  // guess about which key Meta uses for a given app type.
  const secrets = [
    process.env.FACEBOOK_APP_SECRET,
    process.env.INSTAGRAM_APP_SECRET,
  ].filter((s): s is string => Boolean(s))

  if (secrets.length === 0) {
    throw new Error(
      "FACEBOOK_APP_SECRET or INSTAGRAM_APP_SECRET is required to verify webhooks"
    )
  }

  return secrets.some((secret) => {
    const expected =
      "sha256=" + createHmac("sha256", secret).update(payload).digest("hex")
    try {
      return timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    } catch {
      return false
    }
  })
}

export interface WebhookCommentEvent {
  instagramAccountId: string
  commentId: string
  commentText: string
  commenterId: string
  commenterName?: string
  mediaId: string
  /**
   * Set only when the comment was left on an ad: the id of the organic post
   * the ad was created from. Automations are configured against that post, so
   * matching has to consider it as well as mediaId.
   */
  originalMediaId?: string
}

interface WebhookEntry {
  id: string
  time: number
  changes?: Array<{
    field: string
    value: {
      id?: string
      comment_id?: string
      text?: string
      from?: {
        id?: string
        username?: string
      }
      media?: {
        id?: string
        // Present when media_product_type is "AD": the ad copy gets its own
        // media id, and this points back to the post it was boosted from.
        original_media_id?: string
        ad_id?: string
        media_product_type?: string
      }
      media_id?: string
    }
  }>
  messaging?: Array<{
    sender?: { id?: string }
    recipient?: { id?: string }
    timestamp?: number
    message?: {
      mid?: string
      text?: string
      // Our own outgoing messages (including the automation's DMs) come
      // back as echoes and must never trigger anything.
      is_echo?: boolean
      is_deleted?: boolean
      reply_to?: { story?: { id?: string; url?: string }; mid?: string }
    }
  }>
}

/** A DM to the connected account: a plain message or a reply to a story. */
export interface WebhookMessageEvent {
  instagramAccountId: string
  messageId: string
  senderId: string
  text: string
  isStoryReply: boolean
}

export interface WebhookPayload {
  object: string
  entry: WebhookEntry[]
}

export function parseCommentEvents(payload: WebhookPayload): WebhookCommentEvent[] {
  const events: WebhookCommentEvent[] = []

  if (payload.object !== "instagram") {
    return events
  }

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "comments") continue

      const value = change.value
      const commentId = value?.id ?? value?.comment_id
      const mediaId = value?.media?.id ?? value?.media_id
      // A comment on a boosted post arrives with the ad's media id, while the
      // automation is set up against the organic post. Keep both so the
      // processor can match either one.
      const originalMediaId =
        value?.media?.original_media_id === mediaId
          ? undefined
          : value?.media?.original_media_id
      const commenterId = value?.from?.id

      if (!entry.id || !commentId || !mediaId || !commenterId) {
        continue
      }

      // Skip the connected account's own comments and comment replies.
      // A private reply to yourself is rejected by Meta, so queueing one
      // only produces a failed log and wasted retries.
      if (commenterId === entry.id) {
        continue
      }

      events.push({
        instagramAccountId: entry.id,
        commentId,
        commentText: value.text ?? "",
        commenterId,
        commenterName: value.from?.username,
        mediaId,
        originalMediaId,
      })
    }
  }

  return events
}

/**
 * Incoming DMs with text, for DM-keyword and story-reply automations.
 * Skips echoes of our own messages, messages the account sent itself,
 * deleted messages and messages without text (stickers, shared reels).
 */
export function parseMessageEvents(payload: WebhookPayload): WebhookMessageEvent[] {
  const events: WebhookMessageEvent[] = []
  if (payload.object !== "instagram") return events

  for (const entry of payload.entry ?? []) {
    for (const item of entry.messaging ?? []) {
      const message = item.message
      const senderId = item.sender?.id
      const text = message?.text?.trim()
      if (!entry.id || !message?.mid || !senderId || !text) continue
      if (message.is_echo || message.is_deleted) continue
      if (senderId === entry.id) continue

      events.push({
        instagramAccountId: entry.id,
        messageId: message.mid,
        senderId,
        text,
        isStoryReply: Boolean(message.reply_to?.story),
      })
    }
  }

  return events
}
