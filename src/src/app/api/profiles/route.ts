import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { username, is_own } = body
  console.log("[/api/profiles POST] body:", body)

  if (!username || typeof username !== "string") {
    return NextResponse.json({ error: "username is required" }, { status: 400 })
  }

  const clean = username.replace(/^@/, "").trim().toLowerCase()

  // Check if profile already exists
  const { data: existing } = await supabase
    .from("profiles")
    .select("id, username, is_own")
    .eq("username", clean)
    .maybeSingle()

  if (existing) {
    console.log("[/api/profiles POST] profile already exists:", existing.id, "re-triggering scrape")
    const n8nBase = process.env.NEXT_PUBLIC_N8N_BASE_URL ?? "http://localhost:5678"
    try {
      await fetch(`${n8nBase}/webhook/scrape-instagram`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: clean }),
      })
    } catch { /* best-effort */ }
    return NextResponse.json({ success: true, profile: existing })
  }

  // Insert new profile
  const { data: profile, error } = await supabase
    .from("profiles")
    .insert({ username: clean, is_own: !!is_own, platform: "instagram" })
    .select("id, username, is_own")
    .single()

  if (error || !profile) {
    console.error("[/api/profiles POST] insert error:", error?.message)
    return NextResponse.json({ error: error?.message ?? "Failed to save profile" }, { status: 500 })
  }

  console.log("[/api/profiles POST] created profile:", profile.id, profile.username)

  // Trigger n8n scrape webhook
  const n8nBase = process.env.NEXT_PUBLIC_N8N_BASE_URL ?? "http://localhost:5678"
  try {
    const scrapeRes = await fetch(`${n8nBase}/webhook/scrape-instagram`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: clean }),
    })
    console.log("[/api/profiles POST] scrape webhook status:", scrapeRes.status)
  } catch (e) {
    console.error("[/api/profiles POST] scrape webhook error:", e)
  }

  return NextResponse.json({ success: true, profile })
}
