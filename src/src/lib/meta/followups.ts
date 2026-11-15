import { supabase } from "@/lib/supabase"
import { decryptToken } from "@/lib/meta/oauth"
import { MetaApiError, TokenExpiredError, sendDirectMessage } from "@/lib/meta/client"
import { markTokenError } from "@/lib/meta/accounts"
import { withTrackedLinks } from "@/lib/link-tracking"
import { MESSAGING_WINDOW_MS, lastInboundAt } from "@/lib/meta/contacts"
import { simulatorAccountIds } from "@/lib/meta/simulator"
import type { FollowupAudience } from "@/lib/followup-settings"

/**
 * Follow-up messages (schema/028): one extra DM a few hours after an
 * automation's DM — "Did you see the link? Seats are filling up" to people
 * who didn't open it, or "Did the guide help?" to people who did.
 *
 * Instagram only allows it within 24 hours of the person's last message,
 * so:
 * - it's only scheduled for people who messaged us (DM / story / welcome
 *   triggers, or a follow-gate tap) — a plain comment opens no window;
 * - it's scheduled at most 23h after their last message;
 * - right before sending, the window is checked again. A follow-up that
 *   would be late is skipped, never sent outside the window.
 */

export type { FollowupAudience }

// Never send closer than this to the end of the 24h window.
const WINDOW_SAFETY_MS = 15 * 60 * 1000
const MAX_DELAY_HOURS = 23
const BATCH_SIZE = 25

export type FollowupDecision =
  | { send: true }
  | { send: false; reason: "automation_off" | "window_closed" | "clicked" | "not_clicked" | "replied" }

/** Whether a due follow-up should go out now. Pure, so it's unit-tested. */
export function decideFollowup(input: {
  now: Date
  lastInbound: Date | null
  audience: FollowupAudience
  clicked: boolean
  /** They wrote to us again after our DM went out. */
  replied: boolean
  automationLive: boolean
}): FollowupDecision {
  if (!input.automationLive) return { send: false, reason: "automation_off" }
  if (!input.lastInbound || input.now.getTime() > input.lastInbound.getTime() + MESSAGING_WINDOW_MS - WINDOW_SAFETY_MS) {
    return { send: false, reason: "window_closed" }
  }
  if (input.audience === "not_clicked" && input.clicked) return { send: false, reason: "clicked" }
  if (input.audience === "clicked" && !input.clicked) return { send: false, reason: "not_clicked" }
  if (input.audience === "not_replied" && input.replied) return { send: false, reason: "replied" }
  return { send: true }
}

/**
 * When to send: `delayHours` after now, but never later than 23h after
 * their last message. Null if that leaves no time (or they never wrote).
 */
export function followupSendAfter(now: Date, lastInbound: Date | null, delayHours: number): Date | null {
  if (!lastInbound) return null
  const hours = Math.min(Math.max(Math.round(delayHours), 1), MAX_DELAY_HOURS)
  const wanted = now.getTime() + hours * 3600_000
  const latest = lastInbound.getTime() + MAX_DELAY_HOURS * 3600_000
  const at = Math.min(wanted, latest)
  return at > now.getTime() ? new Date(at) : null
}

interface FollowupAutomation {
  id: string
  user_id: string
  is_active: boolean
  track_clicks?: boolean
  followup_enabled?: boolean
  followup_delay_hours?: number
  followup_audience?: FollowupAudience
  followup_message?: string | null
}

/**
 * Schedule the follow-up for a DM that just went out, if its automation
 * has one. Never throws: a follow-up problem must not affect the DM.
 */
export async function scheduleFollowup(dmLogId: string): Promise<void> {
  try {
    const { data: log } = await supabase
      .from("dm_logs")
      .select("id, automation_id, user_id, instagram_account_id, commenter_id")
      .eq("id", dmLogId)
      .maybeSingle()
    if (!log) return
    // "*" works before schema/028 too (then there are no follow-up columns).
    const { data: automation } = await supabase
      .from("dm_automations")
      .select("*")
      .eq("id", log.automation_id)
      .maybeSingle()
    const a = automation as FollowupAutomation | null
    if (!a?.followup_enabled || !a.followup_message?.trim()) return

    const sendAfter = followupSendAfter(
      new Date(),
      await lastInboundAt(log.instagram_account_id, log.commenter_id),
      a.followup_delay_hours ?? 20
    )
    // No open conversation (e.g. a plain comment): Instagram wouldn't allow it.
    if (!sendAfter) return

    const { error } = await supabase.from("dm_followups").upsert(
      {
        dm_log_id: log.id,
        automation_id: log.automation_id,
        user_id: log.user_id,
        instagram_account_id: log.instagram_account_id,
        recipient_id: log.commenter_id,
        send_after: sendAfter.toISOString(),
        // Same clock as instagram_contacts.last_inbound_at (this server's),
        // so "did they write after our DM?" compares like with like.
        created_at: new Date().toISOString(),
      },
      { onConflict: "dm_log_id", ignoreDuplicates: true }
    )
    if (error) console.warn("[followups] could not schedule:", error.message)
  } catch (err) {
    console.warn("[followups] schedule failed:", err instanceof Error ? err.message : err)
  }
}

export interface FollowupResult {
  sent: number
  skipped: number
  failed: number
}

/** Send the follow-ups that are due. Called by the DM queue drain. */
export async function processDueFollowups(): Promise<FollowupResult> {
  const result: FollowupResult = { sent: 0, skipped: 0, failed: 0 }
  const now = () => new Date().toISOString()

  const onlyAccounts = await simulatorAccountIds()
  if (onlyAccounts && onlyAccounts.length === 0) return result

  // A run that died mid-send: mark it failed rather than risk a double
  // message (skipped against the simulator, like the DM queue).
  if (!onlyAccounts) {
    await supabase
      .from("dm_followups")
      .update({ status: "failed", error_message: "Interrupted while sending", updated_at: now() })
      .eq("status", "processing")
      .lt("updated_at", new Date(Date.now() - 10 * 60 * 1000).toISOString())
  }

  let dueQuery = supabase
    .from("dm_followups")
    .select("id")
    .eq("status", "scheduled")
    .lte("send_after", now())
  if (onlyAccounts) dueQuery = dueQuery.in("instagram_account_id", onlyAccounts)
  const { data: due, error: dueError } = await dueQuery.order("send_after").limit(BATCH_SIZE)
  // Table missing before schema/028: nothing to do.
  if (dueError || !due || due.length === 0) return result

  // Atomic claim: a concurrent run can't take the same rows.
  const { data: claimed } = await supabase
    .from("dm_followups")
    .update({ status: "processing", updated_at: now() })
    .in("id", due.map((d) => d.id))
    .eq("status", "scheduled")
    .select("id, dm_log_id, automation_id, user_id, instagram_account_id, recipient_id, created_at")

  for (const f of claimed ?? []) {
    const finish = (values: Record<string, unknown>) =>
      supabase.from("dm_followups").update({ ...values, updated_at: now() }).eq("id", f.id)

    try {
      const [{ data: automation }, { data: account }, { data: links }] = await Promise.all([
        supabase.from("dm_automations").select("*").eq("id", f.automation_id).maybeSingle(),
        supabase
          .from("instagram_accounts")
          .select("instagram_id, access_token")
          .eq("id", f.instagram_account_id)
          .maybeSingle(),
        supabase.from("tracked_links").select("click_count").eq("dm_log_id", f.dm_log_id),
      ])
      const a = automation as FollowupAutomation | null

      // The follow-up row is created right after our DM went out, so a
      // message from them after that is a reply.
      const lastInbound = await lastInboundAt(f.instagram_account_id, f.recipient_id)
      const decision = decideFollowup({
        now: new Date(),
        lastInbound,
        replied: Boolean(lastInbound && lastInbound.getTime() > new Date(f.created_at).getTime()),
        audience: a?.followup_audience ?? "not_clicked",
        clicked: (links ?? []).some((l) => l.click_count > 0),
        automationLive: Boolean(a?.is_active && a.followup_enabled && a.followup_message?.trim()),
      })
      if (!decision.send) {
        await finish({ status: "skipped", skip_reason: decision.reason })
        result.skipped++
        continue
      }
      if (!account) {
        await finish({ status: "failed", error_message: "Instagram account disconnected" })
        result.failed++
        continue
      }

      // Same short links as the first DM (same codes), so clicks add up.
      const message = a!.track_clicks
        ? await withTrackedLinks({
            message: a!.followup_message!,
            userId: f.user_id,
            automationId: f.automation_id,
            dmLogId: f.dm_log_id,
          })
        : a!.followup_message!
      await sendDirectMessage(decryptToken(account.access_token), account.instagram_id, f.recipient_id, message)
      await finish({ status: "sent", sent_at: now() })
      result.sent++
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error"
      if (err instanceof TokenExpiredError) await markTokenError(f.instagram_account_id, message)
      // One try only: a retry hours later could fall outside the window,
      // and a second reminder is worse than none. 551 = DMs closed.
      await finish({
        status: "failed",
        error_message: err instanceof MetaApiError ? `${message} (code ${err.code})` : message,
      })
      result.failed++
    }
  }

  return result
}
