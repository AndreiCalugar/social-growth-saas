import { NextRequest, NextResponse } from "next/server"
import { pollAutomationComments } from "@/lib/meta/poll-comments"
import { drainDmQueue } from "@/lib/meta/process-queue"

/**
 * Cron entry point, triggered every 20 seconds by Supabase pg_cron (see
 * schema/018-dm-cron.sql, schema/022-dm-cron-20s.sql).
 *
 * pollAutomationComments() first queues comments on watched posts that the
 * webhook never delivered, so a missed webhook delays a DM by one run
 * instead of losing it. Then the queue is drained (lib/meta/process-queue).
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET || process.env.NEXTAUTH_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const polled = await pollAutomationComments()
  const results = await drainDmQueue()

  return NextResponse.json({ success: true, polled, ...results })
}
