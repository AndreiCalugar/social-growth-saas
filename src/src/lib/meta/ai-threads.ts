import { supabase } from "@/lib/supabase"
import { decryptToken } from "@/lib/meta/oauth"
import { TokenExpiredError, sendDirectMessage } from "@/lib/meta/client"
import { markTokenError } from "@/lib/meta/accounts"
import {
  detectLanguage,
  disclosureLine,
  generateAssistantReply,
  handoffMessage,
  type AssistantTone,
  type ConversationTurn,
} from "@/lib/ai/assistant"

/**
 * Conversations with an automation's AI assistant (schema/029).
 *
 * A thread opens when the automation's DM is delivered (if its assistant is
 * on). When the person writes back, the assistant answers from the
 * creator's information, at most ai_max_replies times. On the next
 * question, or as soon as the answer isn't in the information, it says the
 * creator will get back to them, stops for good, and flags the thread
 * "Needs you". Messages always arrive within Instagram's 24h window
 * because the person just wrote.
 */

// A reply this long after the DM still belongs to its conversation.
const THREAD_WINDOW_MS = 48 * 60 * 60 * 1000

interface AssistantAutomation {
  id: string
  user_id: string
  is_active: boolean
  ai_enabled?: boolean
  ai_knowledge?: string | null
  ai_tone?: AssistantTone
  ai_max_replies?: number
}

/** Open the assistant conversation for a delivered DM. Never throws. */
export async function openAiThread(dmLogId: string): Promise<void> {
  try {
    const { data: log } = await supabase
      .from("dm_logs")
      .select("id, automation_id, user_id, instagram_account_id, commenter_id")
      .eq("id", dmLogId)
      .maybeSingle()
    if (!log) return
    // "*" also works before schema/029 (then the AI columns are missing).
    const { data: automation } = await supabase.from("dm_automations").select("*").eq("id", log.automation_id).maybeSingle()
    const a = automation as AssistantAutomation | null
    if (!a?.ai_enabled || !a.ai_knowledge?.trim()) return

    const { error } = await supabase.from("dm_ai_threads").upsert(
      {
        dm_log_id: log.id,
        automation_id: log.automation_id,
        user_id: log.user_id,
        instagram_account_id: log.instagram_account_id,
        igsid: log.commenter_id,
      },
      { onConflict: "dm_log_id", ignoreDuplicates: true }
    )
    if (error) console.warn("[ai-threads] could not open:", error.message)
  } catch (err) {
    console.warn("[ai-threads] open failed:", err instanceof Error ? err.message : err)
  }
}

export interface AiThreadRef {
  id: string
  status: "open" | "handed_off"
}

/** This person's current assistant conversation with the account, if any. */
export async function findAiThread(accountId: string, igsid: string): Promise<AiThreadRef | null> {
  const { data, error } = await supabase
    .from("dm_ai_threads")
    .select("id, status")
    .eq("instagram_account_id", accountId)
    .eq("igsid", igsid)
    .gte("created_at", new Date(Date.now() - THREAD_WINDOW_MS).toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error || !data) return null
  return data as AiThreadRef
}

/**
 * Answer one message in an assistant conversation (run after the webhook
 * has responded). Returns what happened, for logs and tests.
 */
export async function handleAiMessage(
  threadId: string,
  text: string
): Promise<"answered" | "handed_off" | "silent" | "failed"> {
  const now = () => new Date().toISOString()
  try {
    const { data: inserted } = await supabase
      .from("dm_ai_messages")
      .insert({ thread_id: threadId, role: "user", text })
      .select("id")
      .single()

    const { data: thread } = await supabase
      .from("dm_ai_threads")
      .select("id, automation_id, instagram_account_id, igsid, status, replies_count")
      .eq("id", threadId)
      .maybeSingle()
    if (!thread) return "silent"

    // Already handed over: the creator answers from here. Flag the new message.
    if (thread.status !== "open") {
      await supabase.from("dm_ai_threads").update({ needs_attention: true, updated_at: now() }).eq("id", threadId)
      return "silent"
    }

    const [{ data: automation }, { data: account }] = await Promise.all([
      supabase.from("dm_automations").select("*").eq("id", thread.automation_id).maybeSingle(),
      supabase
        .from("instagram_accounts")
        .select("instagram_id, username, access_token")
        .eq("id", thread.instagram_account_id)
        .maybeSingle(),
    ])
    const a = automation as AssistantAutomation | null
    // Turned off (or paused) since: stay quiet, the creator sees the message.
    if (!a?.is_active || !a.ai_enabled || !a.ai_knowledge?.trim() || !account) return "silent"

    const tone = a.ai_tone ?? "warm"
    const maxReplies = a.ai_max_replies ?? 3
    const token = decryptToken(account.access_token)
    const send = (message: string) => sendDirectMessage(token, account.instagram_id, thread.igsid, message)
    const logReply = (reply: string) =>
      supabase.from("dm_ai_messages").insert({ thread_id: threadId, role: "assistant", text: reply })

    // Limit reached: one "I'll get back to you", then silence. The claim
    // (status still 'open') makes sure it's sent once.
    if (thread.replies_count >= maxReplies) {
      const { data: claimed } = await supabase
        .from("dm_ai_threads")
        .update({ status: "handed_off", handoff_reason: "limit", needs_attention: true, updated_at: now() })
        .eq("id", threadId)
        .eq("status", "open")
        .select("id")
      if (!claimed?.length) return "silent"
      const reply = handoffMessage(detectLanguage(text, a.ai_knowledge), tone, account.username)
      await send(reply)
      await logReply(reply)
      return "handed_off"
    }

    // Take a reply slot. If two messages arrive at once, only one answers.
    const { data: slot } = await supabase
      .from("dm_ai_threads")
      .update({ replies_count: thread.replies_count + 1, updated_at: now() })
      .eq("id", threadId)
      .eq("status", "open")
      .eq("replies_count", thread.replies_count)
      .select("id")
    if (!slot?.length) return "silent"

    const { data: earlier } = await supabase
      .from("dm_ai_messages")
      .select("id, role, text")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true })
    const history: ConversationTurn[] = (earlier ?? [])
      .filter((m) => m.id !== inserted?.id)
      .map((m) => ({ role: m.role as ConversationTurn["role"], text: m.text }))

    const result = await generateAssistantReply({
      creatorUsername: account.username,
      knowledge: a.ai_knowledge,
      tone,
      history,
      question: text,
    })

    // The first AI message in a conversation says it's an AI assistant.
    const first = thread.replies_count === 0
    const message = first
      ? `${disclosureLine(detectLanguage(text, a.ai_knowledge), tone, account.username)}\n\n${result.reply}`
      : result.reply
    await send(message)
    await logReply(message)

    if (result.kind === "handoff") {
      await supabase
        .from("dm_ai_threads")
        .update({ status: "handed_off", handoff_reason: "not_covered", needs_attention: true, updated_at: now() })
        .eq("id", threadId)
      return "handed_off"
    }
    return "answered"
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("[ai-threads] reply failed:", message)
    if (err instanceof TokenExpiredError) {
      const { data: t } = await supabase.from("dm_ai_threads").select("instagram_account_id").eq("id", threadId).maybeSingle()
      if (t) await markTokenError(t.instagram_account_id, message)
    }
    // The person didn't get an answer: make sure the creator sees it.
    await supabase
      .from("dm_ai_threads")
      .update({ needs_attention: true, updated_at: now() })
      .eq("id", threadId)
    return "failed"
  }
}
