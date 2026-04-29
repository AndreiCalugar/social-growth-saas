import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { auth } from "@/lib/auth"

const SAVED_BRIEF_COLUMNS =
  "id, user_id, trend_insight_id, trend_name, trend_type, performance_multiplier, original_content, original_hook, original_caption, original_posting_time, original_hashtags, original_competitor_edge, hook_variations, content_angles, caption_variations, chosen_hook, chosen_content, chosen_caption, chosen_posting_time, chosen_hashtags, user_notes, scheduled_date, scheduled_time, status, created_at, updated_at" as const

const SYSTEM_PROMPT = "You are a creative content strategist for Instagram creators."

function buildUserPrompt(brief: {
  original_content: string | null
  original_hook: string | null
  original_caption: string | null
}) {
  return `Given this content brief, generate variations.

Original format: ${brief.original_content ?? "(not specified)"}
Original hook: ${brief.original_hook ?? "(not specified)"}
Original caption: ${brief.original_caption ?? "(not specified)"}

Return a SINGLE JSON object with this exact shape (no prose, no markdown fence):
{
  "hook_variations": [
    { "style": "curiosity", "hook": "...", "why": "1 sentence explanation" },
    { "style": "emotional", "hook": "...", "why": "..." },
    { "style": "confrontational", "hook": "...", "why": "..." }
  ],
  "content_angles": [
    { "angle": "montage style", "description": "2-3 sentences on how to film this way" },
    { "angle": "talking head", "description": "..." },
    { "angle": "POV/first person", "description": "..." }
  ],
  "caption_variations": [
    { "style": "storytelling", "caption": "full caption template" },
    { "style": "question-led", "caption": "..." },
    { "style": "list format", "caption": "..." }
  ]
}`
}

type Variations = {
  hook_variations: unknown
  content_angles: unknown
  caption_variations: unknown
}

function extractJson(text: string): Variations | null {
  // Claude usually returns plain JSON when asked, but tolerate ```json fences.
  const trimmed = text.trim()
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  const candidate = fenceMatch ? fenceMatch[1] : trimmed
  try {
    const parsed = JSON.parse(candidate)
    if (parsed && typeof parsed === "object") return parsed as Variations
  } catch {}
  return null
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const { data: brief, error: loadErr } = await supabase
    .from("saved_briefs")
    .select(SAVED_BRIEF_COLUMNS)
    .eq("id", id)
    .eq("user_id", session.user.id)
    .maybeSingle()

  if (loadErr) return NextResponse.json({ error: loadErr.message }, { status: 500 })
  if (!brief) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured" },
      { status: 500 }
    )
  }

  const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt(brief) }],
    }),
  })

  if (!claudeRes.ok) {
    const errText = await claudeRes.text().catch(() => "")
    return NextResponse.json(
      { error: `Claude API failed (${claudeRes.status}): ${errText.slice(0, 300)}` },
      { status: 502 }
    )
  }

  const claudeBody = (await claudeRes.json()) as {
    content?: Array<{ type: string; text?: string }>
  }
  const text =
    claudeBody.content
      ?.filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("") ?? ""

  const parsed = extractJson(text)
  if (!parsed) {
    return NextResponse.json(
      { error: "Could not parse Claude response as JSON", raw: text.slice(0, 500) },
      { status: 502 }
    )
  }

  const hook_variations = Array.isArray(parsed.hook_variations) ? parsed.hook_variations : []
  const content_angles = Array.isArray(parsed.content_angles) ? parsed.content_angles : []
  const caption_variations = Array.isArray(parsed.caption_variations) ? parsed.caption_variations : []

  const { data: updated, error: updErr } = await supabase
    .from("saved_briefs")
    .update({
      hook_variations,
      content_angles,
      caption_variations,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", session.user.id)
    .select(SAVED_BRIEF_COLUMNS)
    .single()

  if (updErr || !updated) {
    return NextResponse.json(
      { error: updErr?.message ?? "Failed to persist expansion" },
      { status: 500 }
    )
  }

  return NextResponse.json({ brief: updated })
}
