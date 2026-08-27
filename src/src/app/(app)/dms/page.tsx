import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { supabase } from "@/lib/supabase"
import { DmsClient, type DmAutomation, type DmLogRow } from "@/components/dms-client"

export const dynamic = "force-dynamic"

export default async function DmsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const userId = session.user.id

  const [{ data: account }, { data: automations }, { data: logs }] =
    await Promise.all([
      supabase
        .from("instagram_accounts")
        .select("id, username, name, token_error, token_expires_at, webhook_subscribed, connected_at")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("dm_automations")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      supabase
        .from("dm_logs")
        .select("id, automation_id, commenter_name, commenter_id, comment_text, matched_keyword, status, error_message, dm_sent_at, public_reply_sent_at, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50),
    ])

  // Headline stats (all-time), cheap head-count queries.
  const [sentCount, pendingCount, failedCount] = await Promise.all(
    ["sent", "pending", "failed"].map(async (status) => {
      const { count } = await supabase
        .from("dm_logs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", status)
      return count ?? 0
    })
  )

  return (
    <DmsClient
      account={account ?? null}
      initialAutomations={(automations ?? []) as DmAutomation[]}
      initialLogs={(logs ?? []) as DmLogRow[]}
      stats={{ sent: sentCount, pending: pendingCount, failed: failedCount }}
    />
  )
}
