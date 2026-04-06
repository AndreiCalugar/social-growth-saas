import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { username } = body
  console.log("[/api/competitors POST] body:", body)

  if (!username || typeof username !== "string") {
    return NextResponse.json({ error: "username is required" }, { status: 400 })
  }

  const clean = username.replace(/^@/, "").trim().toLowerCase()

  // Check if profile already exists
  const { data: existing } = await supabase
    .from("profiles")
    .select("id, username")
    .eq("username", clean)
    .maybeSingle()

  if (existing) {
    console.log("[/api/competitors POST] already tracked:", existing.id, "re-triggering scrape")
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

  // Insert new competitor profile
  const { data: profile, error } = await supabase
    .from("profiles")
    .insert({ username: clean, is_own: false, platform: "instagram" })
    .select("id, username")
    .single()

  if (error || !profile) {
    console.error("[/api/competitors POST] insert error:", error?.message)
    return NextResponse.json({ error: error?.message ?? "Failed to save profile" }, { status: 500 })
  }

  console.log("[/api/competitors POST] created profile:", profile.id, profile.username)

  // Trigger n8n scrape webhook
  const n8nBase = process.env.NEXT_PUBLIC_N8N_BASE_URL ?? "http://localhost:5678"
  try {
    const scrapeRes = await fetch(`${n8nBase}/webhook/scrape-instagram`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: clean }),
    })
    console.log("[/api/competitors POST] scrape webhook status:", scrapeRes.status)
  } catch (e) {
    console.error("[/api/competitors POST] scrape webhook error:", e)
  }

  return NextResponse.json({ success: true, profile })
}
