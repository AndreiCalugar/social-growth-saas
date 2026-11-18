import { NextRequest, NextResponse, after } from "next/server"
import { supabase } from "@/lib/supabase"
import { verifyWebhookSignature, type WebhookPayload } from "@/lib/meta/webhook"
import { handleWebhookPayload, runFollowUps, type WebhookOutcome } from "@/lib/meta/webhook-handler"
import { databaseReachable, scheduleReplay } from "@/lib/meta/webhook-replay"

/**
 * Meta Instagram webhook receiver. Public route (excluded from the auth
 * middleware) — authenticity comes from the X-Hub-Signature-256 HMAC, not a
 * session. Structure adapted from OpenReply's app/api/webhook (MIT), with
 * BullMQ replaced by inserting pending rows into dm_logs. When something was
 * queued, the queue is drained right after the response is sent (after()),
 * so the DM goes out within seconds; the queue clock is the backup.
 * Processing itself lives in lib/meta/webhook-handler.ts.
 *
 * Design rules:
 * - Keep the response fast: a few indexed queries, no external calls before
 *   responding — sending happens in after().
 * - After the signature verifies, ALWAYS return 200 — Meta throttles and
 *   eventually disables subscriptions that keep failing. Errors are recorded
 *   on the webhook_events row instead of the HTTP status.
 * - Meta doesn't resend a delivery we answered with 200. If the database is
 *   down or processing fails, the delivery is kept on Vercel Queues and
 *   processed later (lib/meta/webhook-replay.ts).
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

  // Lookups that fail quietly would make every event look like "no
  // automation matched", so check the database first.
  if (!(await databaseReachable())) {
    const kept = await scheduleReplay(rawBody, payload, "database unreachable")
    return NextResponse.json({ received: true, replay: kept })
  }

  let outcome: WebhookOutcome
  try {
    outcome = await handleWebhookPayload(payload)
  } catch {
    const kept = await scheduleReplay(rawBody, payload, "processing failed")
    return NextResponse.json({ received: true, replay: kept })
  }

  const { queued, gateReplies, aiMessages } = outcome
  if (queued > 0 || gateReplies.length > 0 || aiMessages.length > 0) {
    after(() => runFollowUps(outcome))
  }

  // Signature was valid → 200 no matter what happened above.
  return NextResponse.json({ received: true, queued })
}
