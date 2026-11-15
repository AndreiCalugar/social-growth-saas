// Follow-up settings sent by the editor (schema/028), validated the same
// way on create and update.

export const FOLLOWUP_AUDIENCES = ["not_clicked", "clicked", "not_replied", "all"] as const
export type FollowupAudience = (typeof FOLLOWUP_AUDIENCES)[number]

export interface FollowupInput {
  followup_enabled?: boolean
  followup_delay_hours?: number
  followup_audience?: string
  followup_message?: string | null
}

const MAX_MESSAGE_LENGTH = 1000

/**
 * The columns to write, or an error. Only fields that were sent are
 * written; turning it on needs a message.
 */
export function followupColumns(body: FollowupInput): { values: Record<string, unknown> } | { error: string } {
  const values: Record<string, unknown> = {}
  if (body.followup_delay_hours !== undefined) {
    const h = Number(body.followup_delay_hours)
    if (!Number.isInteger(h) || h < 1 || h > 23) return { error: "followup_delay_hours must be a whole number from 1 to 23" }
    values.followup_delay_hours = h
  }
  if (body.followup_audience !== undefined) {
    if (!(FOLLOWUP_AUDIENCES as readonly string[]).includes(body.followup_audience)) {
      return { error: "followup_audience must be not_clicked, clicked, not_replied or all" }
    }
    values.followup_audience = body.followup_audience
  }
  if (body.followup_message !== undefined) {
    const m = (body.followup_message ?? "").trim()
    if (m.length > MAX_MESSAGE_LENGTH) return { error: `followup_message must be at most ${MAX_MESSAGE_LENGTH} characters` }
    values.followup_message = m || null
  }
  if (body.followup_enabled !== undefined) {
    values.followup_enabled = Boolean(body.followup_enabled)
    if (values.followup_enabled && !values.followup_message) return { error: "Write the follow-up message, or turn it off." }
  }
  return { values }
}

/** True if the database rejected a follow-up column (schema/028 not run). */
export function isMissingFollowupColumn(message: string): boolean {
  return message.includes("followup_")
}

/** Audiences decided by whether the person opened the link. */
export function audienceNeedsClicks(audience: FollowupAudience): boolean {
  return audience === "not_clicked" || audience === "clicked"
}
