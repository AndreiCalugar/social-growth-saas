import { supabase } from "@/lib/supabase"
import { parseCommentEvents, parseMessageEvents, type WebhookPayload } from "@/lib/meta/webhook"
import { queueMatchingComment, queueMatchingMessage } from "@/lib/meta/enqueue"
import { drainDmQueue } from "@/lib/meta/process-queue"
import { findOpenGate, handleGateReply, type OpenGate } from "@/lib/meta/follow-gate"
import { recordInboundMessage } from "@/lib/meta/contacts"
import { findAiThread, handleAiMessage } from "@/lib/meta/ai-threads"

/**
 * Processing of one Instagram webhook delivery, shared by the webhook
 * receiver (app/api/instagram/webhook) and the replay of deliveries that
 * arrived while the database was down (app/api/queues/webhook-replay).
 *
 * handleWebhookPayload() does the quick part (match and queue) and returns
 * the slow part (sending, follow-gate checks, AI answers) for
 * runFollowUps(): the webhook runs that after responding, the replay
 * awaits it.
 */

export interface WebhookOutcome {
  queued: number
  gateReplies: { gate: OpenGate; senderId: string }[]
  aiMessages: { threadId: string; text: string }[]
}

/**
 * Match the delivery's comments and messages and queue what they trigger.
 * Only deliveries that did something (or failed) are saved in
 * webhook_events: most are read receipts and echoes (schema/032).
 * Throws if processing failed (after saving the failure).
 */
export async function handleWebhookPayload(payload: WebhookPayload): Promise<WebhookOutcome> {
  const outcome: WebhookOutcome = { queued: 0, gateReplies: [], aiMessages: [] }
  try {
    for (const event of parseCommentEvents(payload)) {
      if (await queueMatchingComment(event)) outcome.queued++
    }

    // DM and story-reply triggers. Kept apart so a problem here can never
    // stop the comment automations above.
    try {
      for (const message of parseMessageEvents(payload)) {
        // Remember they wrote (opens Instagram's 24h window for follow-ups)
        // and whether we'd seen them before (welcome message).
        const { data: account } = await supabase
          .from("instagram_accounts")
          .select("id")
          .eq("instagram_id", message.instagramAccountId)
          .maybeSingle()
        const contact = account ? await recordInboundMessage(account.id, message.senderId) : { known: true }

        // A tap on a follow-gate button (or any reply while a gate is
        // open) answers that gate instead of starting a new automation.
        const gate = await findOpenGate(message)
        if (gate) {
          outcome.gateReplies.push({ gate, senderId: message.senderId })
          continue
        }
        // A keyword for an automation (new conversation) wins; otherwise a
        // reply in an AI assistant conversation goes to the assistant.
        const aiThread = account ? await findAiThread(account.id, message.senderId) : null
        if (await queueMatchingMessage(message, { knownContact: contact.known || Boolean(aiThread) })) outcome.queued++
        else if (aiThread) outcome.aiMessages.push({ threadId: aiThread.id, text: message.text })
      }
    } catch (err) {
      console.error("[Instagram Webhook] message trigger error:", err)
    }

    if (outcome.queued > 0 || outcome.gateReplies.length > 0 || outcome.aiMessages.length > 0) {
      await saveEvent(payload, { status: "processed" })
    }
    return outcome
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("[Instagram Webhook] processing error:", err)
    await saveEvent(payload, { status: "failed", error_message: message })
    throw err
  }
}

/** Send what the delivery queued, answer follow-gates and AI conversations. */
export async function runFollowUps(outcome: WebhookOutcome): Promise<void> {
  // Side by side, so a slow AI answer doesn't hold up a DM.
  await Promise.all([
    (async () => {
      if (outcome.queued === 0) return
      try {
        await drainDmQueue()
      } catch (err) {
        console.error("[Instagram Webhook] immediate send failed:", err)
      }
    })(),
    (async () => {
      for (const { gate, senderId } of outcome.gateReplies) await handleGateReply(gate, senderId)
    })(),
    (async () => {
      // Claude takes a second or two per answer.
      for (const { threadId, text } of outcome.aiMessages) await handleAiMessage(threadId, text)
    })(),
  ])
}

/** Record a webhook delivery that did something or failed. Never throws. */
async function saveEvent(
  payload: WebhookPayload,
  outcome: { status: "processed" | "failed"; error_message?: string }
): Promise<void> {
  const { error } = await supabase.from("webhook_events").insert({
    object: payload.object ?? null,
    payload,
    ...outcome,
    processed_at: new Date().toISOString(),
  })
  if (error) console.warn("[Instagram Webhook] event not saved:", error.message)
}
