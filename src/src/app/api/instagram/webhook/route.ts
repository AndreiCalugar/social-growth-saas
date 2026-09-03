import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import {
  parseCommentEvents,
  verifyWebhookSignature,
  type WebhookPayload,
} from "@/lib/meta/webhook"
import { matchKeywords } from "@/lib/meta/keyword-matcher"

/**
 * Meta Instagram webhook receiver. Public route (excluded from the auth
 * middleware) — authenticity comes from the X-Hub-Signature-256 HMAC, not a
 * session. Structure adapted from OpenReply's app/api/webhook (MIT), with
 * BullMQ replaced by inserting pending rows into dm_logs; the cron
 * processor (/api/cron/process-dms) does the actual sending.
 *
 * Design rules:
 * - Keep it fast: a few indexed queries, no external calls.
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

interface AutomationRow {
  id: string
  user_id: string
  instagram_account_id: string
  post_id: string | null
  match_any_post: boolean
  keywords: string[]
  whole_word_match: boolean
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

  try {
    const events = parseCommentEvents(payload)

    for (const event of events) {
      // Dedup across Meta redeliveries, before any matching work.
      const { error: dedupError } = await supabase
        .from("processed_comments")
        .insert({
          instagram_account_id: event.instagramAccountId,
          comment_id: event.commentId,
        })
      // 23505 = unique_violation → already handled this comment.
      if (dedupError) {
        if (dedupError.code === "23505") continue
        throw new Error(`processed_comments insert failed: ${dedupError.message}`)
      }

      const { data: account } = await supabase
        .from("instagram_accounts")
        .select("id, user_id")
        .eq("instagram_id", event.instagramAccountId)
        .maybeSingle()
      if (!account) continue

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

        // Upsert-ignore on (automation_id, comment_id): a redelivered event
        // that slipped past processed_comments still can't double-queue.
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
        if (!insertError) queued++
        // First matching automation wins for this comment — matches
        // OpenReply's behavior of one DM per comment.
        break
      }
    }

    if (eventRow?.id) {
      await supabase
        .from("webhook_events")
        .update({
          status: queued > 0 ? "processed" : "ignored",
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

  // Signature was valid → 200 no matter what happened above.
  return NextResponse.json({ received: true, queued })
}
