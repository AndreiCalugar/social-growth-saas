import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { pollAutomationComments } from "@/lib/meta/poll-comments"
import { drainDmQueue } from "@/lib/meta/process-queue"

/**
 * Cron entry point, triggered every 20 seconds by Supabase pg_cron (see
 * schema/018-dm-cron.sql, schema/022-dm-cron-20s.sql).
 *
 * pollAutomationComments() first queues comments on watched posts that the
 * webhook never delivered, so a missed webhook delays a DM by one run
 * instead of losing it. Then the queue is drained (lib/meta/process-queue).
 *
 * Backup: pg_cron on the free Supabase plan sometimes stops starting jobs
 * for hours. An external scheduler (cron-job.org, every minute) calls this
 * route with ?backup=1. That call only does the work when pg_cron hasn't
 * run for BACKUP_AFTER_MS (schema/031 heartbeat). Running both at once is
 * safe anyway: queue rows are claimed atomically.
 */

const HEARTBEAT = "process-dms"
const BACKUP_AFTER_MS = 90 * 1000

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET || process.env.NEXTAUTH_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const isBackup = request.nextUrl.searchParams.get("backup") === "1"

  if (isBackup) {
    const lastRun = await lastPrimaryRun()
    if (lastRun && Date.now() - lastRun.getTime() < BACKUP_AFTER_MS) {
      return NextResponse.json({ success: true, skipped: "pg_cron is running", lastRun })
    }
    console.warn(`[cron] pg_cron silent since ${lastRun?.toISOString() ?? "unknown"}, backup is running the queue`)
  } else {
    // Before the work, so a slow run doesn't make the backup think it's down.
    const { error } = await supabase
      .from("cron_heartbeats")
      .upsert({ name: HEARTBEAT, last_run_at: new Date().toISOString() })
    if (error) console.warn("[cron] heartbeat not saved:", error.message)
  }

  const polled = await pollAutomationComments()
  const results = await drainDmQueue()

  return NextResponse.json({ success: true, backup: isBackup, polled, ...results })
}

/** When pg_cron last called. Null if unknown (e.g. before schema/031): then the backup runs. */
async function lastPrimaryRun(): Promise<Date | null> {
  const { data, error } = await supabase
    .from("cron_heartbeats")
    .select("last_run_at")
    .eq("name", HEARTBEAT)
    .maybeSingle()
  if (error || !data) return null
  return new Date(data.last_run_at)
}
