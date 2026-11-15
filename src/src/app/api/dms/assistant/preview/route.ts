import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getAccountForUser } from "@/lib/meta/accounts"
import {
  ASSISTANT_TONES,
  detectLanguage,
  disclosureLine,
  generateAssistantReply,
  type AssistantTone,
  type ConversationTurn,
} from "@/lib/ai/assistant"
import { MAX_KNOWLEDGE_LENGTH } from "@/lib/assistant-settings"

/**
 * "Try your assistant" in the editor: answers a test question with the
 * information typed so far, exactly as a follower would see it. Nothing is
 * sent to Instagram.
 */

// Rough per-user limit (per server instance) so the test box can't be
// used as a free Claude endpoint.
const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 15
const recent = new Map<string, number[]>()

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const now = Date.now()
  const times = (recent.get(session.user.id) ?? []).filter((t) => now - t < WINDOW_MS)
  if (times.length >= MAX_PER_WINDOW) {
    return NextResponse.json({ error: "Too many test questions, try again in a minute." }, { status: 429 })
  }
  recent.set(session.user.id, [...times, now])

  const body = (await req.json().catch(() => null)) as {
    knowledge?: string
    tone?: string
    question?: string
    history?: ConversationTurn[]
  } | null
  const knowledge = body?.knowledge?.trim() ?? ""
  const question = body?.question?.trim() ?? ""
  const tone = (ASSISTANT_TONES as string[]).includes(body?.tone ?? "") ? (body!.tone as AssistantTone) : "warm"
  if (!knowledge) return NextResponse.json({ error: "Write what the assistant should know first." }, { status: 400 })
  if (knowledge.length > MAX_KNOWLEDGE_LENGTH) return NextResponse.json({ error: "The information is too long." }, { status: 400 })
  if (!question || question.length > 1000) return NextResponse.json({ error: "Type a question." }, { status: 400 })
  const history = (Array.isArray(body?.history) ? body!.history : [])
    .filter((t) => (t?.role === "user" || t?.role === "assistant") && typeof t.text === "string")
    .slice(-12)

  const account = await getAccountForUser(session.user.id)
  const username = account?.username ?? "you"
  const result = await generateAssistantReply({ creatorUsername: username, knowledge, tone, history, question })
  const first = !history.some((t) => t.role === "assistant")
  const reply = first ? `${disclosureLine(detectLanguage(question, knowledge), tone, username)}\n\n${result.reply}` : result.reply
  return NextResponse.json({ reply, handoff: result.kind === "handoff" })
}
