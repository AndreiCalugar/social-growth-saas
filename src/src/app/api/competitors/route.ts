import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { auth } from "@/lib/auth"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = session.user.id

  const body = await req.json()
  const { username } = body

  if (!username || typeof username !== "string") {
    return NextResponse.json({ error: "username is required" }, { status: 400 })
  }

  const clean = username.replace(/^@/, "").trim().toLowerCase()

  const { data: existing } = await supabase
    .from("profiles")
    .select("id, username")
    .eq("user_id", userId)
    .eq("username", clean)
    .maybeSingle()

  if (existing) {
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

  const { data: profile, error } = await supabase
    .from("profiles")
    .insert({ username: clean, is_own: false, platform: "instagram", user_id: userId })
    .select("id, username")
    .single()

  if (error || !profile) {
    console.error("[/api/competitors POST] insert error:", error?.message)
    return NextResponse.json({ error: error?.message ?? "Failed to save profile" }, { status: 500 })
  }

  const n8nBase = process.env.NEXT_PUBLIC_N8N_BASE_URL ?? "http://localhost:5678"
  try {
    await fetch(`${n8nBase}/webhook/scrape-instagram`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: clean }),
    })
  } catch (e) {
    console.error("[/api/competitors POST] scrape webhook error:", e)
  }

  return NextResponse.json({ success: true, profile })
}
