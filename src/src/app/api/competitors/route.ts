import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function POST(req: NextRequest) {
  const { username } = await req.json()

  if (!username || typeof username !== "string") {
    return NextResponse.json({ error: "username is required" }, { status: 400 })
  }

  const clean = username.replace(/^@/, "").trim().toLowerCase()

  // Upsert profile as competitor (is_own = false)
  const { data: profile, error } = await supabase
    .from("profiles")
    .upsert(
      { username: clean, is_own: false },
      { onConflict: "username", ignoreDuplicates: false }
    )
    .select("id, username")
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
  } catch {
    // Webhook trigger is best-effort — profile was saved, scrape may start later
  }

  return NextResponse.json({ success: true, profile })
}
