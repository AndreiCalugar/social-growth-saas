import { NextRequest, NextResponse, after } from "next/server"
import { supabase } from "@/lib/supabase"
import {
  parseCommentEvents,
  parseMessageEvents,
  verifyWebhookSignature,
  type WebhookPayload,
} from "@/lib/meta/webhook"
import { queueMatchingComment, queueMatchingMessage } from "@/lib/meta/enqueue"
import { drainDmQueue } from "@/lib/meta/process-queue"
import { findOpenGate, handleGateReply, type OpenGate } from "@/lib/meta/follow-gate"
import { recordInboundMessage } from "@/lib/meta/contacts"

/**
 * Meta Instagram webhook receiver. Public route (excluded from the auth
 * middleware) — authenticity comes from the X-Hub-Signature-256 HMAC, not a
 * session. Structure adapted from OpenReply's app/api/webhook (MIT), with
 * BullMQ replaced by inserting pending rows into dm_logs. When something was
 * queued, the queue is drained right after the response is sent (after()),
 * so the DM goes out within seconds; the cron run is the backup.
 *
 * Design rules:
 * - Keep the response fast: a few indexed queries, no external calls before
 *   responding — sending happens in after().
 * - After the signature verifies, ALWAYS return 200 — Meta throttles and
 *   eventually disables subscriptions that keep failing. Errors are recorded
 *   on the webhook_events row instead of the HTTP status.
 */

// Meta's initial verification handshake (dashboard "Verify and save").
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const mode = params.get("hub.mode")
  const token = params.get("hub.verify_token")
  const challenge = params.get("hub.challenge")

  if (mode === "subscribe" && token && token === process.env.WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge ?? "", { status: 200 })
  }
  return NextResponse.json({ error: "Verification failed" }, { status: 403 })
}

export async function POST(request: NextRequest) {
  // Raw body needed: the signature is over the exact bytes Meta sent.
  const rawBody = await request.text()
  const signature = request.headers.get("x-hub-signature-256")

  if (!verifyWebhookSignature(rawBody, signature)) {
    // Persist the rejection so a misconfigured app secret is visible in the
    // DB, not just in server logs.
    await supabase
      .from("webhook_events")
      .insert({
        payload: { raw: rawBody.slice(0, 2000) },
        status: "failed",
        error_message: "Invalid X-Hub-Signature-256",
      })
      .then(() => {})
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  let payload: WebhookPayload
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ received: true })
  }

  const { data: eventRow } = await supabase
    .from("webhook_events")
    .insert({ object: payload.object ?? null, payload, status: "pending" })
    .select("id")
    .maybeSingle()

  let queued = 0
  let errorMessage: string | null = null
  const gateReplies: { gate: OpenGate; senderId: string }[] = []

  try {
    const events = parseCommentEvents(payload)

    for (const event of events) {
      if (await queueMatchingComment(event)) queued++
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
          gateReplies.push({ gate, senderId: message.senderId })
          continue
        }
        if (await queueMatchingMessage(message, { knownContact: contact.known })) queued++
      }
    } catch (err) {
      console.error("[Instagram Webhook] message trigger error:", err)
    }

    if (eventRow?.id) {
      await supabase
        .from("webhook_events")
        .update({
          status: queued > 0 || gateReplies.length > 0 ? "processed" : "ignored",
          processed_at: new Date().toISOString(),
        })
        .eq("id", eventRow.id)
    }
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : "Unknown error"
    console.error("[Instagram Webhook] processing error:", err)
    if (eventRow?.id) {
      await supabase
        .from("webhook_events")
        .update({
          status: "failed",
          error_message: errorMessage,
          processed_at: new Date().toISOString(),
        })
        .eq("id", eventRow.id)
    }
  }

  if (queued > 0) {
    after(async () => {
      try {
        await drainDmQueue()
      } catch (err) {
        console.error("[Instagram Webhook] immediate send failed:", err)
      }
    })
  }

  // Follow-gate answers: check follow status and reply, after responding.
  if (gateReplies.length > 0) {
    after(async () => {
      for (const { gate, senderId } of gateReplies) {
        await handleGateReply(gate, senderId)
      }
    })
  }

  // Signature was valid → 200 no matter what happened above.
  return NextResponse.json({ received: true, queued })
}
