import { NextRequest, NextResponse } from "next/server"
import { pollAutomationComments } from "@/lib/meta/poll-comments"
import { drainDmQueue } from "@/lib/meta/process-queue"
import { recordPgCronRun } from "@/lib/meta/queue-clock"

/**
 * Watchdog entry point, called every 5 minutes by Supabase pg_cron (see
 * schema/018-dm-cron.sql, schema/032-cron-watchdog.sql).
 *
 * The DM queue is run every 20 seconds by the clock on Vercel Queues
 * (lib/meta/queue-clock.ts). Each pg_cron run records the current
 * deployment, restarts that clock if it stopped, and runs the queue once
 * itself, so the queue still moves every 5 minutes if the clock is down.
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

  // Before the work, so a slow run can't delay restarting the clock.
  const clock = await recordPgCronRun()
  const polled = await pollAutomationComments()
  const results = await drainDmQueue()

  return NextResponse.json({ success: true, clock, polled, ...results })
}
