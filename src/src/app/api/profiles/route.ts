import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function POST(req: NextRequest) {
  const { username, is_own } = await req.json()

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
    // Re-trigger scrape
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
    return NextResponse.json({ error: error?.message ?? "Failed to save profile" }, { status: 500 })
  }

  // Trigger n8n scrape webhook
  const n8nBase = process.env.NEXT_PUBLIC_N8N_BASE_URL ?? "http://localhost:5678"
  try {
    await fetch(`${n8nBase}/webhook/scrape-instagram`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: clean }),
    })
  } catch { /* best-effort */ }

  return NextResponse.json({ success: true, profile })
}
