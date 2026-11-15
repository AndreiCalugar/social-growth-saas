// AI assistant settings sent by the editor (schema/029), validated the
// same way on create and update.
import { ASSISTANT_LANGUAGE_SETTINGS, ASSISTANT_TONES, type AssistantTone } from "@/lib/ai/assistant"

export const MAX_KNOWLEDGE_LENGTH = 4000

export interface AssistantInputBody {
  ai_enabled?: boolean
  ai_knowledge?: string | null
  ai_tone?: string
  ai_max_replies?: number
  ai_language?: string
}

/** The columns to write, or an error. Turning it on needs the information. */
export function assistantColumns(body: AssistantInputBody): { values: Record<string, unknown> } | { error: string } {
  const values: Record<string, unknown> = {}
  if (body.ai_knowledge !== undefined) {
    const k = (body.ai_knowledge ?? "").trim()
    if (k.length > MAX_KNOWLEDGE_LENGTH) return { error: `ai_knowledge must be at most ${MAX_KNOWLEDGE_LENGTH} characters` }
    values.ai_knowledge = k || null
  }
  if (body.ai_tone !== undefined) {
    if (!(ASSISTANT_TONES as string[]).includes(body.ai_tone)) return { error: "ai_tone must be warm, friendly or professional" }
    values.ai_tone = body.ai_tone as AssistantTone
  }
  if (body.ai_max_replies !== undefined) {
    const n = Number(body.ai_max_replies)
    if (!Number.isInteger(n) || n < 1 || n > 10) return { error: "ai_max_replies must be a whole number from 1 to 10" }
    values.ai_max_replies = n
  }
  if (body.ai_language !== undefined) {
    if (!(ASSISTANT_LANGUAGE_SETTINGS as string[]).includes(body.ai_language)) {
      return { error: "ai_language must be auto, ro or en" }
    }
    values.ai_language = body.ai_language
  }
  if (body.ai_enabled !== undefined) {
    values.ai_enabled = Boolean(body.ai_enabled)
    if (values.ai_enabled && !values.ai_knowledge) {
      return { error: "Write what the assistant should know, or turn it off." }
    }
  }
  return { values }
}

/** True if the database rejected an assistant column (schema/029 not run). */
export function isMissingAssistantColumn(message: string): boolean {
  return /\bai_(enabled|knowledge|tone|max_replies|language)\b/.test(message)
}
