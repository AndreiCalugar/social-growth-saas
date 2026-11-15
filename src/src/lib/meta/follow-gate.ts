import { supabase } from "@/lib/supabase"
import {
  MetaApiError,
  RateLimitError,
  TokenExpiredError,
  getFollowStatus,
  sendDirectMessage,
  sendPrivateReply,
  type QuickReply,
} from "@/lib/meta/client"
import { decryptToken } from "@/lib/meta/oauth"
import { withTrackedLinks } from "@/lib/link-tracking"
import type { WebhookMessageEvent } from "@/lib/meta/webhook"

// Follow-gate: the link only goes to people who follow the account.
// Instagram only tells us whether someone follows after they have written
// to us, so comment triggers first get a short opener with a button; the
// tap (or any reply) is the message that lets us check. See schema/026.

export type GateStatus = "awaiting_tap" | "awaiting_follow" | "delivered"

// How long a person can come back and tap after the opener.
const GATE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

export const GATE_PAYLOAD_PREFIX = "FG:"

type Lang = "ro" | "en"

/** Romanian if the creator's DM looks Romanian, so the gate speaks their language. */
export function gateLanguage(dmMessage: string): Lang {
  return /[ăâîșțşţ]/i.test(dmMessage) ? "ro" : "en"
}

export function gateCopy(lang: Lang, username: string) {
  if (lang === "ro") {
    return {
      opener: "Salut! 👋 Apasă butonul de mai jos și îți trimit imediat ce ai cerut.",
      openerNoButton: "Salut! 👋 Răspunde-mi cu orice mesaj aici și îți trimit imediat ce ai cerut.",
      openerButton: "Trimite-mi link-ul",
      followAsk: `Aproape gata! 🙌 Dă-mi follow pe @${username}, apoi apasă butonul de mai jos și îți trimit link-ul.`,
      followButton: "Am dat follow ✅",
    }
  }
  return {
    opener: "Hey! 👋 Tap the button below and I'll send you what you asked for.",
    openerNoButton: "Hey! 👋 Reply with any message here and I'll send you what you asked for.",
    openerButton: "Send me the link",
    followAsk: `Almost there! 🙌 Follow @${username}, then tap the button below and I'll send you the link.`,
    followButton: "I followed ✅",
  }
}

function button(title: string, dmLogId: string): QuickReply[] {
  return [{ title, payload: `${GATE_PAYLOAD_PREFIX}${dmLogId}` }]
}

interface GateAccount {
  instagram_id: string
  username: string
  token: string
}

interface GateAutomation {
  id: string
  user_id: string
  dm_message: string
  track_clicks: boolean
}

interface GateRow {
  id: string
  comment_id: string
  commenter_id: string
  trigger_type: "comment" | "dm" | "story_reply"
}

async function realDm(automation: GateAutomation, dmLogId: string): Promise<string> {
  return automation.track_clicks
    ? withTrackedLinks({
        message: automation.dm_message,
        userId: automation.user_id,
        automationId: automation.id,
        dmLogId,
      })
    : automation.dm_message
}

// Errors where retrying the same request without buttons won't help.
function isHardFailure(err: unknown): boolean {
  return (
    err instanceof TokenExpiredError ||
    err instanceof RateLimitError ||
    (err instanceof MetaApiError && err.code === 551)
  )
}

/**
 * First message of a gated automation, sent from the queue. Throws on send
 * failure so the queue applies its usual retry rules. Returns the status to
 * store on the dm_logs row.
 */
export async function sendGateOpener(
  account: GateAccount,
  automation: GateAutomation,
  row: GateRow
): Promise<GateStatus> {
  const copy = gateCopy(gateLanguage(automation.dm_message), account.username)

  if (row.trigger_type === "comment") {
    // We can't see follow status yet. Ask for a tap; if Instagram refuses
    // buttons on a private reply, ask for any reply instead.
    try {
      await sendPrivateReply(account.token, account.instagram_id, row.comment_id, copy.opener, button(copy.openerButton, row.id))
    } catch (err) {
      if (isHardFailure(err)) throw err
      console.warn("[follow-gate] private reply with button refused, retrying without:", err instanceof Error ? err.message : err)
      await sendPrivateReply(account.token, account.instagram_id, row.comment_id, copy.openerNoButton)
    }
    return "awaiting_tap"
  }

  // DM / story reply: they already wrote to us, so we can check right away.
  return deliverOrAskToFollow(account, automation, row.id, row.commenter_id)
}

/** Check follow status, then send the real DM or the follow request. */
async function deliverOrAskToFollow(
  account: GateAccount,
  automation: GateAutomation,
  dmLogId: string,
  recipientId: string
): Promise<GateStatus> {
  let follows: boolean
  try {
    follows = await getFollowStatus(account.token, recipientId)
  } catch (err) {
    if (isHardFailure(err)) throw err
    // Instagram wouldn't tell us. Don't leave them stuck: send the link.
    console.warn("[follow-gate] follow check failed, delivering anyway:", err instanceof Error ? err.message : err)
    follows = true
  }

  if (follows) {
    await sendDirectMessage(account.token, account.instagram_id, recipientId, await realDm(automation, dmLogId))
    return "delivered"
  }
  const copy = gateCopy(gateLanguage(automation.dm_message), account.username)
  await sendDirectMessage(account.token, account.instagram_id, recipientId, copy.followAsk, button(copy.followButton, dmLogId))
  return "awaiting_follow"
}

export interface OpenGate {
  dmLogId: string
  previousStatus: Exclude<GateStatus, "delivered">
  accountId: string
  automationId: string
}

/**
 * Is this incoming message an answer to a follow-gate? (A tap on our
 * button, or any reply while one is open.) Null when there is none, or
 * before schema/026 has run.
 */
export async function findOpenGate(event: WebhookMessageEvent): Promise<OpenGate | null> {
  const { data: account } = await supabase
    .from("instagram_accounts")
    .select("id")
    .eq("instagram_id", event.instagramAccountId)
    .maybeSingle()
  if (!account) return null

  const since = new Date(Date.now() - GATE_WINDOW_MS).toISOString()
  const { data, error } = await supabase
    .from("dm_logs")
    .select("id, automation_id, gate_status")
    .eq("instagram_account_id", account.id)
    .eq("commenter_id", event.senderId)
    .in("gate_status", ["awaiting_tap", "awaiting_follow"])
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error || !data) return null

  return {
    dmLogId: data.id,
    previousStatus: data.gate_status as OpenGate["previousStatus"],
    accountId: account.id,
    automationId: data.automation_id,
  }
}

/**
 * Handle a tap/reply on an open gate: check follow status and send the
 * link or the follow request. Claims the row first so a double tap can't
 * send the link twice.
 */
export async function handleGateReply(gate: OpenGate, senderId: string): Promise<GateStatus | null> {
  // Claim: only one handler moves the row out of its waiting state.
  const { data: claimed } = await supabase
    .from("dm_logs")
    .update({ gate_status: "delivered", updated_at: new Date().toISOString() })
    .eq("id", gate.dmLogId)
    .eq("gate_status", gate.previousStatus)
    .select("id")
  if (!claimed || claimed.length === 0) return null

  const restore = (status: GateStatus, error?: string) =>
    supabase
      .from("dm_logs")
      .update({
        gate_status: status,
        ...(status === "delivered" ? { gate_delivered_at: new Date().toISOString() } : {}),
        ...(error ? { error_message: error } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", gate.dmLogId)

  try {
    const [{ data: account }, { data: automation }] = await Promise.all([
      supabase.from("instagram_accounts").select("instagram_id, username, access_token").eq("id", gate.accountId).maybeSingle(),
      supabase.from("dm_automations").select("id, user_id, dm_message, track_clicks").eq("id", gate.automationId).maybeSingle(),
    ])
    if (!account || !automation) {
      await restore(gate.previousStatus, "Automation or account missing when the person tapped")
      return null
    }

    const status = await deliverOrAskToFollow(
      { instagram_id: account.instagram_id, username: account.username, token: decryptToken(account.access_token) },
      automation as GateAutomation,
      gate.dmLogId,
      senderId
    )
    await restore(status)
    return status
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("[follow-gate] reply handling failed:", message)
    // Back to waiting: their next tap tries again.
    await restore(gate.previousStatus, message)
    return null
  }
}
