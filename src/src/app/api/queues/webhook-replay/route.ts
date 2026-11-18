import { handleCallback } from "@vercel/queue"
import { handleWebhookPayload, runFollowUps } from "@/lib/meta/webhook-handler"
import {
  databaseReachable,
  replayDelaySeconds,
  shouldGiveUp,
  type ReplayMessage,
} from "@/lib/meta/webhook-replay"

/**
 * Consumer for the "webhook-replay" topic on Vercel Queues (see vercel.json
 * and lib/meta/webhook-replay.ts): an Instagram webhook delivery that
 * arrived while the database was down. Vercel calls this route itself; it
 * isn't reachable as a normal public endpoint.
 *
 * Throwing makes Vercel try again later, so this throws while the database
 * is still down. Re-processing is safe: comments are deduplicated
 * (processed_comments) and message triggers have a per-person cooldown.
 */
export const POST = handleCallback<ReplayMessage>(
  async (message, metadata) => {
    if (!(await databaseReachable())) throw new Error("database still unreachable")
    const outcome = await handleWebhookPayload(message.payload)
    await runFollowUps(outcome)
    console.log(
      "[webhook-replay] replayed:",
      JSON.stringify({ reason: message.reason, delivery: metadata.deliveryCount, queued: outcome.queued })
    )
  },
  {
    retry: (error, metadata) => {
      if (shouldGiveUp(metadata.deliveryCount)) {
        console.error(
          "[webhook-replay] gave up after",
          metadata.deliveryCount,
          "tries:",
          error instanceof Error ? error.message : error,
          metadata.messageId
        )
        return { acknowledge: true }
      }
      return { afterSeconds: replayDelaySeconds(metadata.deliveryCount) }
    },
  }
)
