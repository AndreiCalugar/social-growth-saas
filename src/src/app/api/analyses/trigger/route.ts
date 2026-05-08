import { NextRequest, NextResponse, after } from "next/server"
import { auth } from "@/lib/auth"
import { supabase } from "@/lib/supabase"
import { checkCooldown, rateLimitedResponse } from "@/lib/cooldown"

const COOLDOWN_MINUTES = 30

/**
 * Gate the analyze-profile n8n webhook behind a 30m-per-profile cooldown.
 * Single-profile analysis hits the Claude API once per run, so the cap
 * is laxer than the cross-analysis cooldown but still prevents loop-fire.
 *
 * Body: { profile_id: string, analysis_type?: string }
 * Responses:
 *   200 { success: true }                                          — fired
 *   429 { rateLimited: true, ... }                                 — blocked
 *   401 / 400 / 404 on auth / shape / ownership failures
 */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = (await req.json().catch(() => null)) as
    | { profile_id?: string; analysis_type?: string }
    | null
  const profileId = body?.profile_id
  const analysisType = body?.analysis_type ?? "performance"

  if (!profileId || typeof profileId !== "string") {
    return NextResponse.json({ error: "profile_id required" }, { status: 400 })
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, user_id")
    .eq("id", profileId)
    .eq("user_id", session.user.id)
    .maybeSingle()

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 })
  }

  const cooldown = await checkCooldown({
    table: "analyses",
    column: "created_at",
    filterField: "profile_id",
    filterValue: profileId,
    cooldownMinutes: COOLDOWN_MINUTES,
  })

  if (!cooldown.allowed) {
    return NextResponse.json(
      rateLimitedResponse(
        cooldown,
        `This profile was analyzed recently. Try again in ${cooldown.minutesRemaining} min.`
      ),
      { status: 429 }
    )
  }

  const n8nBase = process.env.NEXT_PUBLIC_N8N_URL
  if (!n8nBase) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_N8N_URL is not configured" },
      { status: 500 }
    )
  }

  // Fire-and-poll. The frontend job-tracker watches the analyses table
  // for fresh rows, so we don't need to await the workflow result here.
  after(async () => {
    try {
      await fetch(`${n8nBase}/webhook/analyze-profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile_id: profileId, analysis_type: analysisType }),
      })
    } catch (e) {
      console.error("[/api/analyses/trigger] webhook error:", e)
    }
  })

  return NextResponse.json({ success: true })
}
