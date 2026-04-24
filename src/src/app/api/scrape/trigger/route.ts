import { NextRequest, NextResponse, after } from "next/server"
import { auth } from "@/lib/auth"
import { supabase } from "@/lib/supabase"
import { canScrape } from "@/lib/scrape-cooldown"

/**
 * Single source of truth for triggering a scrape. Any UI surface that lets
 * the user refresh / retry scrape data goes through this endpoint so the
 * two-tier cooldown is enforced consistently.
 *
 * Body: { profileId: string, force?: boolean }
 * Responses:
 *   200 { success: true, username }       — webhook queued via after()
 *   409 { ok: false, reason, minutesUntilNext, lastScrapedAt, username }
 *   401 / 404 on auth / ownership failures
 */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = (await req.json().catch(() => null)) as
    | { profileId?: string; force?: boolean }
    | null
  const profileId = body?.profileId
  const force = body?.force === true

  if (!profileId || typeof profileId !== "string") {
    return NextResponse.json({ error: "profileId is required" }, { status: 400 })
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, last_scraped, user_id")
    .eq("id", profileId)
    .eq("user_id", session.user.id)
    .maybeSingle()

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 })
  }

  const gate = canScrape(profile.last_scraped, { force })
  if (!gate.ok) {
    return NextResponse.json(
      {
        ok: false,
        reason: gate.reason,
        minutesUntilNext: gate.minutesUntilNext,
        lastScrapedAt: gate.lastScrapedAt,
        username: profile.username,
      },
      { status: 409 }
    )
  }

  const n8nBase = process.env.NEXT_PUBLIC_N8N_URL
  after(async () => {
    try {
      await fetch(`${n8nBase}/webhook/scrape-instagram`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: profile.username }),
      })
    } catch (e) {
      console.error("[/api/scrape/trigger] webhook error:", e)
    }
  })

  return NextResponse.json({ success: true, username: profile.username })
}
