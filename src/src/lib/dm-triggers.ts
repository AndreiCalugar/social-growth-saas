// What starts a DM automation. One automation can listen to several
// triggers (schema/027): e.g. "comment LINK on the post OR DM me LINK".
// "new_conversation" (schema/028) fires on someone's very first message to
// the account, with or without a keyword: a welcome message.
// Shared by the API, the queue and the editor, so the rules live here once.

export const TRIGGER_TYPES = ["comment", "dm", "story_reply", "new_conversation"] as const
export type TriggerType = (typeof TRIGGER_TYPES)[number]

/**
 * Valid, deduped, in a fixed order, or null if nothing valid is left.
 * Story replies arrive as DMs, so "dm" already covers them and a separate
 * "story_reply" next to it is dropped.
 */
export function normalizeTriggers(input: unknown): TriggerType[] | null {
  if (!Array.isArray(input)) return null
  if (input.some((t) => !(TRIGGER_TYPES as readonly unknown[]).includes(t))) return null
  const set = new Set(input as TriggerType[])
  if (set.has("dm")) set.delete("story_reply")
  const list = TRIGGER_TYPES.filter((t) => set.has(t))
  return list.length > 0 ? list : null
}

/**
 * The triggers stored on an automation row. Rows from before schema/027
 * only have trigger_type, and rows from before schema/025 have neither
 * (they are comment automations).
 */
export function automationTriggers(a: { triggers?: string[] | null; trigger_type?: string | null }): TriggerType[] {
  return normalizeTriggers(a.triggers) ?? normalizeTriggers([a.trigger_type ?? "comment"]) ?? ["comment"]
}

/**
 * The single trigger_type kept next to `triggers` for code and rows that
 * predate schema/027: comment wins, since that's what needs a post.
 */
export function primaryTrigger(triggers: TriggerType[]): TriggerType {
  return triggers[0] ?? "comment"
}

/**
 * Which of an automation's triggers an incoming message fires, or null.
 * A story reply fires "story_reply" if the automation has it, else "dm";
 * a plain message only fires "dm".
 */
export function messageTrigger(triggers: TriggerType[], isStoryReply: boolean): TriggerType | null {
  if (isStoryReply && triggers.includes("story_reply")) return "story_reply"
  if (triggers.includes("dm")) return "dm"
  return null
}

/** Keyword triggers need keywords; a welcome message alone doesn't. */
export function needsKeywords(triggers: TriggerType[]): boolean {
  return triggers.some((t) => t !== "new_conversation")
}
