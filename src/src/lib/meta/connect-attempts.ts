import { supabase } from "@/lib/supabase"

// Every step of "Connect Instagram" is logged so /admin/beta can show why an
// approved user still isn't connected. Logging never blocks the flow.

export type ConnectOutcome =
  | "started" // sent to instagram.com
  | "not_approved" // clicked Connect before beta approval
  | "connected"
  | "denied" // cancelled / declined on Instagram
  | "invalid" // missing code or bad state
  | "forbidden" // callback landed in another session
  | "already_connected" // that IG account belongs to another user
  | "failed" // token exchange / API / DB error

export interface ConnectAttempt {
  outcome: string
  detail: string | null
  created_at: string
}

export async function logConnectAttempt(
  userId: string,
  outcome: ConnectOutcome,
  detail?: string | null
): Promise<void> {
  try {
    const { error } = await supabase.from("instagram_connect_attempts").insert({
      user_id: userId,
      outcome,
      detail: detail ? detail.slice(0, 500) : null,
    })
    if (error) console.warn("[Connect attempts] Insert failed:", error.message)
  } catch (err) {
    console.warn("[Connect attempts] Insert failed:", err)
  }
}

// A start this recent may still be in progress on Instagram.
const IN_PROGRESS_MS = 5 * 60 * 1000

export interface ConnectSummary {
  tries: number
  lastAt: string
  /** Short label for the admin table. */
  label: string
  /** Most likely reason, in plain words. */
  hint: string
  tone: "ok" | "warn" | "error" | "neutral"
}

/** Summarize a user's attempts (any order) into the latest state. */
export function summarizeConnectAttempts(
  attempts: ConnectAttempt[],
  now: number = Date.now()
): ConnectSummary | null {
  if (attempts.length === 0) return null
  const sorted = [...attempts].sort((a, b) => b.created_at.localeCompare(a.created_at))
  const last = sorted[0]
  const tries = sorted.filter((a) => a.outcome === "started").length
  const base = { tries, lastAt: last.created_at }
  const detail = last.detail ?? ""

  switch (last.outcome) {
    case "connected":
      return { ...base, label: "Connected", hint: "", tone: "ok" }
    case "started":
      return now - new Date(last.created_at).getTime() < IN_PROGRESS_MS
        ? { ...base, label: "On Instagram now", hint: "Started a few minutes ago.", tone: "neutral" }
        : {
            ...base,
            label: "Never came back from Instagram",
            hint:
              "Instagram blocked the login — usually the tester invite isn't accepted yet (instagram.com/accounts/manage_access), or they closed the page.",
            tone: "warn",
          }
    case "not_approved":
      return { ...base, label: "Clicked Connect before approval", hint: "Approve them here.", tone: "warn" }
    case "denied":
      return {
        ...base,
        label: "Cancelled on Instagram",
        hint: detail || "They declined the permissions screen.",
        tone: "warn",
      }
    case "already_connected":
      return {
        ...base,
        label: "Account used by another login",
        hint: "That Instagram account is connected to a different email here.",
        tone: "error",
      }
    case "invalid":
    case "forbidden":
      return {
        ...base,
        label: "Login link expired",
        hint: "The Instagram redirect came back without a valid session — they can just try again.",
        tone: "warn",
      }
    default:
      return { ...base, label: "Error while connecting", hint: explainFailure(detail), tone: "error" }
  }
}

/** Turn a raw Meta / API error into a likely cause. */
export function explainFailure(detail: string): string {
  const d = detail.toLowerCase()
  if (/professional|business|creator|account type/.test(d))
    return `Not a Business/Creator account. (${detail})`
  if (/developer role|tester|not authorized|permission/.test(d))
    return `Not an accepted Instagram Tester. (${detail})`
  if (/code has been used|expired|authorization code/.test(d))
    return `The login link expired — trying again fixes it. (${detail})`
  return detail || "Unknown error."
}
