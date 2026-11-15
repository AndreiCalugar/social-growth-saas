import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { supabase } from "@/lib/supabase"
import { getConnectedAccount } from "@/lib/meta/accounts"
import { getBetaRequest } from "@/lib/beta"
import {
  DmsClient,
  type AutomationSendStats,
  type ClickStats,
  type DmAutomation,
  type DmLogRow,
  type FollowupStats,
} from "@/components/dms-client"

export const dynamic = "force-dynamic"

export default async function DmsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const userId = session.user.id

  const [account, beta, { data: automations }, { data: logs }] = await Promise.all([
    getConnectedAccount(userId),
    getBetaRequest(userId, session.user.email),
    supabase
      .from("dm_automations")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("dm_logs")
      // "*" so columns from later migrations (gate_status) show up once they
      // exist, without breaking the page before.
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      // The activity list shows a few at a time (filterable per automation).
      .limit(200),
  ])

  // Sent / queued / failed per automation, shown on each row. Head-count
  // queries, so they stay exact however many DMs there are.
  const STATUSES = ["sent", "pending", "failed"] as const
  const statsByAutomation: Record<string, AutomationSendStats> = {}
  await Promise.all(
    ((automations ?? []) as DmAutomation[]).map(async (a) => {
      const [sent, pending, failed] = await Promise.all(
        STATUSES.map(async (status) => {
          const { count } = await supabase
            .from("dm_logs")
            .select("id", { count: "exact", head: true })
            .eq("automation_id", a.id)
            .eq("status", status)
          return count ?? 0
        })
      )
      statsByAutomation[a.id] = { sent, pending, failed }
    })
  )

  const [clickStats, followupStats] = await Promise.all([loadClickStats(userId), loadFollowupStats(userId)])

  return (
    <DmsClient
      account={account}
      beta={beta}
      initialAutomations={(automations ?? []) as DmAutomation[]}
      initialLogs={(logs ?? []) as DmLogRow[]}
      statsByAutomation={statsByAutomation}
      clickStats={clickStats}
      followupStats={followupStats}
    />
  )
}

// Click numbers per automation, counted per DM (one DM can hold several
// links). Empty if schema/024 hasn't run yet.
async function loadClickStats(userId: string): Promise<ClickStats> {
  const empty: ClickStats = { byAutomation: {}, clickedLogIds: [], totalClickedDms: 0 }
  const { data, error } = await supabase
    .from("tracked_links")
    .select("automation_id, dm_log_id, click_count")
    .eq("user_id", userId)
    .limit(10000)
  if (error || !data) return empty

  const tracked = new Map<string, Set<string>>()
  const clicked = new Map<string, Set<string>>()
  const clicks = new Map<string, number>()
  const clickedLogIds = new Set<string>()
  for (const row of data) {
    if (!tracked.has(row.automation_id)) tracked.set(row.automation_id, new Set())
    tracked.get(row.automation_id)!.add(row.dm_log_id)
    if (row.click_count > 0) {
      if (!clicked.has(row.automation_id)) clicked.set(row.automation_id, new Set())
      clicked.get(row.automation_id)!.add(row.dm_log_id)
      clickedLogIds.add(row.dm_log_id)
      clicks.set(row.automation_id, (clicks.get(row.automation_id) ?? 0) + row.click_count)
    }
  }

  const byAutomation: ClickStats["byAutomation"] = {}
  for (const [automationId, dms] of tracked) {
    byAutomation[automationId] = {
      trackedDms: dms.size,
      clickedDms: clicked.get(automationId)?.size ?? 0,
      clicks: clicks.get(automationId) ?? 0,
    }
  }
  return { byAutomation, clickedLogIds: Array.from(clickedLogIds), totalClickedDms: clickedLogIds.size }
}

// Follow-ups per automation (sent, and how many people opened the link
// after it) and each DM's follow-up status. Empty before schema/028.
async function loadFollowupStats(userId: string): Promise<FollowupStats> {
  const empty: FollowupStats = { byAutomation: {}, byLog: {} }
  const { data: followups, error } = await supabase
    .from("dm_followups")
    .select("dm_log_id, automation_id, status, send_after, skip_reason, sent_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(5000)
  if (error || !followups || followups.length === 0) return empty

  const sentIds = followups.filter((f) => f.status === "sent").map((f) => f.dm_log_id)
  const lastClick = new Map<string, number>()
  for (let i = 0; i < sentIds.length; i += 200) {
    const { data: links } = await supabase
      .from("tracked_links")
      .select("dm_log_id, last_clicked_at")
      .in("dm_log_id", sentIds.slice(i, i + 200))
      .not("last_clicked_at", "is", null)
    for (const l of links ?? []) {
      const t = new Date(l.last_clicked_at).getTime()
      lastClick.set(l.dm_log_id, Math.max(lastClick.get(l.dm_log_id) ?? 0, t))
    }
  }

  const stats: FollowupStats = { byAutomation: {}, byLog: {} }
  for (const f of followups) {
    stats.byLog[f.dm_log_id] = { status: f.status, sendAfter: f.send_after, skipReason: f.skip_reason }
    if (f.status !== "sent") continue
    const a = (stats.byAutomation[f.automation_id] ??= { sent: 0, clickedAfter: 0 })
    a.sent++
    if (f.sent_at && (lastClick.get(f.dm_log_id) ?? 0) > new Date(f.sent_at).getTime()) a.clickedAfter++
  }
  return stats
}
