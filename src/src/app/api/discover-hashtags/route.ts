import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { auth } from "@/lib/auth"

const SYSTEM_PROMPT = "You are an Instagram growth strategist."

type CaptionSample = { caption: string | null; hashtags: unknown }

function buildUserPrompt(username: string, samples: CaptionSample[]) {
  // Trim to keep the prompt small — 30 captions is plenty for niche detection
  // and keeps token costs predictable. Cap each caption length so a few
  // verbose posts can't dominate.
  const lines = samples.slice(0, 30).map((s, i) => {
    const cap = (s.caption ?? "").replace(/\s+/g, " ").trim().slice(0, 280)
    const tags =
      Array.isArray(s.hashtags) && s.hashtags.length
        ? ` [tags: ${(s.hashtags as unknown[])
            .map((t) => `#${String(t).replace(/^#/, "")}`)
            .slice(0, 8)
            .join(" ")}]`
        : ""
    return `${i + 1}. ${cap || "(no caption)"}${tags}`
  })

  return `Based on these Instagram post captions from @${username}, identify their niche and suggest 15-20 hashtags they should search on Instagram to find competitor accounts in their niche.

Group the hashtags into 3 categories:
1. "Niche-specific" — hashtags directly about their content topic (5-7 tags)
2. "Community" — hashtags used by communities and groups in this space (5-7 tags)
3. "Broader reach" — slightly wider hashtags where similar creators post (5-6 tags)

For each hashtag, add a brief note on what kind of accounts the user will find there.

Posts:
${lines.join("\n")}

Return a SINGLE JSON object with this exact shape (no prose, no markdown fence):
{
  "detected_niche": "one sentence describing their niche",
  "categories": [
    {
      "name": "Niche-specific",
      "hashtags": [
        { "tag": "#bikepacking", "note": "Core bikepacking creators and trip content" }
      ]
    },
    {
      "name": "Community",
      "hashtags": []
    },
    {
      "name": "Broader reach",
      "hashtags": []
    }
  ]
}`
}

function extractJson(text: string): unknown | null {
  const trimmed = text.trim()
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  const candidate = fence ? fence[1] : trimmed
  try {
    return JSON.parse(candidate)
  } catch {
    return null
  }
}

export async function POST(_req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const userId = session.user.id

  // Find the user's own profile.
  const { data: own, error: ownErr } = await supabase
    .from("profiles")
    .select("id, username")
    .eq("user_id", userId)
    .eq("is_own", true)
    .maybeSingle()

  if (ownErr) return NextResponse.json({ error: ownErr.message }, { status: 500 })
  if (!own) {
    return NextResponse.json(
      { error: "No own profile found. Add your own account first." },
      { status: 400 }
    )
  }

  // Pull a sample of recent posts. Hashtags column is jsonb; tolerate either
  // shape (string[] or { tag: string }[]) by passing as-is to the prompt.
  const { data: posts, error: postsErr } = await supabase
    .from("posts")
    .select("caption, hashtags")
    .eq("profile_id", own.id)
    .order("posted_at", { ascending: false })
    .limit(30)

  if (postsErr) return NextResponse.json({ error: postsErr.message }, { status: 500 })
  if (!posts || posts.length === 0) {
    return NextResponse.json(
      { error: "No posts scraped yet for your own profile. Run a scrape first." },
      { status: 400 }
    )
  }

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
      messages: [{ role: "user", content: buildUserPrompt(own.username, posts) }],
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
  if (!parsed || typeof parsed !== "object") {
    return NextResponse.json(
      { error: "Could not parse Claude response", raw: text.slice(0, 500) },
      { status: 502 }
    )
  }

  const now = new Date().toISOString()
  const { error: updErr } = await supabase
    .from("profiles")
    .update({
      discovery_hashtags: parsed,
      discovery_hashtags_updated: now,
    })
    .eq("id", own.id)
    .eq("user_id", userId)

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 })
  }

  return NextResponse.json({
    discovery_hashtags: parsed,
    discovery_hashtags_updated: now,
  })
}
