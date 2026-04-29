import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { supabase } from "@/lib/supabase"
import { checkCooldown, rateLimitedResponse } from "@/lib/cooldown"

const COOLDOWN_MINUTES = 60

/**
 * Gate the cross-analysis n8n webhook behind a 1h-per-profile cooldown
 * so a stuck button or impatient user can't burn the Claude budget by
 * re-running every few seconds.
 *
 * The route awaits and forwards the n8n response (rather than fire-and-
 * forget) because the frontend uses the synchronous `trends_detected: 0`
 * signal to render the empty-result banner — there's no DB row to poll
 * for in that case.
 *
 * Body: { own_profile_id: string }
 * Responses:
 *   200 <n8n response body>                                        — fired
 *   429 { rateLimited: true, minutesRemaining, secondsRemaining,
 *         nextAvailableAt, message }                               — blocked
 *   401 / 400 / 404 on auth / shape / ownership failures
 */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = (await req.json().catch(() => null)) as
    | { own_profile_id?: string }
    | null
  const ownProfileId = body?.own_profile_id

  if (!ownProfileId || typeof ownProfileId !== "string") {
    return NextResponse.json({ error: "own_profile_id required" }, { status: 400 })
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, user_id, is_own")
    .eq("id", ownProfileId)
    .eq("user_id", session.user.id)
    .maybeSingle()

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 })
  }

  const cooldown = await checkCooldown({
    table: "trend_insights",
    column: "created_at",
    filterField: "profile_id",
    filterValue: ownProfileId,
    cooldownMinutes: COOLDOWN_MINUTES,
  })

  if (!cooldown.allowed) {
    return NextResponse.json(
      rateLimitedResponse(
        cooldown,
        `You generated insights ${COOLDOWN_MINUTES - cooldown.minutesRemaining} min ago. Next run available in ${cooldown.minutesRemaining} min.`
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

  let n8nRes: Response
  try {
    n8nRes = await fetch(`${n8nBase}/webhook/cross-analysis`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        own_profile_id: ownProfileId,
        user_id: session.user.id,
        own_username: profile.username ?? "",
      }),
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Network error"
    return NextResponse.json(
      { error: `n8n webhook failed: ${message}` },
      { status: 502 }
    )
  }

  const rawText = await n8nRes.text().catch(() => "")
  if (!n8nRes.ok) {
    return NextResponse.json(
      { error: `n8n webhook failed (${n8nRes.status}): ${rawText.slice(0, 300)}` },
      { status: 502 }
    )
  }

  // Forward the n8n body verbatim so the frontend keeps its existing
  // shape contract (trends_detected, diag, etc.).
  let parsed: unknown
  try {
    parsed = JSON.parse(rawText)
  } catch {
    parsed = { raw: rawText }
  }
  return NextResponse.json(parsed)
}
