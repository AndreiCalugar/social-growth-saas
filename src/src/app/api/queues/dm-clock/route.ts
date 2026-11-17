import { handleCallback } from "@vercel/queue"
import { handleTick } from "@/lib/meta/queue-clock"

/**
 * Consumer for the "dm-clock" topic on Vercel Queues (see vercel.json and
 * lib/meta/queue-clock.ts). Vercel calls this route itself; it isn't
 * reachable as a normal public endpoint.
 */
export const POST = handleCallback(
  async () => {
    const result = await handleTick()
    console.log("[queue-clock] tick:", JSON.stringify(result))
  },
  {
    // Only "couldn't schedule the next tick" throws. Retry a few times,
    // then drop it: the pg_cron watchdog restarts the chain.
    retry: (_error, metadata) =>
      metadata.deliveryCount > 5 ? { acknowledge: true } : { afterSeconds: 15 * metadata.deliveryCount },
  }
)
