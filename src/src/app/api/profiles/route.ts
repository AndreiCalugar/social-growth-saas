import { NextRequest, NextResponse, after } from "next/server"
import { supabase } from "@/lib/supabase"
import { auth } from "@/lib/auth"

// Fire the n8n scrape webhook after the response is sent so the client isn't
// blocked for the full ~2-minute Apify run. `after()` keeps the request alive
// on Vercel until the work completes.
function fireScrapeWebhook(username: string) {
  const n8nBase = process.env.NEXT_PUBLIC_N8N_URL
  after(async () => {
    try {
      await fetch(`${n8nBase}/webhook/scrape-instagram`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      })
    } catch (e) {
      console.error("[/api/profiles] scrape webhook error:", e)
    }
  })
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, followers, is_own")
    .eq("user_id", session.user.id)
    .order("username")

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ profiles: data })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = session.user.id

  const body = await req.json()
  const { username, is_own } = body

  if (!username || typeof username !== "string") {
    return NextResponse.json({ error: "username is required" }, { status: 400 })
  }

  const clean = username.replace(/^@/, "").trim().toLowerCase()

  // Only dedupe within the same user — two users can track the same handle.
  const { data: existing } = await supabase
    .from("profiles")
    .select("id, username, is_own")
    .eq("user_id", userId)
    .eq("username", clean)
    .maybeSingle()

  if (existing) {
    fireScrapeWebhook(clean)
    return NextResponse.json({ success: true, profile: existing })
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .insert({ username: clean, is_own: !!is_own, platform: "instagram", user_id: userId })
    .select("id, username, is_own")
    .single()

  if (error || !profile) {
    console.error("[/api/profiles POST] insert error:", error?.message)
    return NextResponse.json({ error: error?.message ?? "Failed to save profile" }, { status: 500 })
  }

  fireScrapeWebhook(clean)

  return NextResponse.json({ success: true, profile })
}
