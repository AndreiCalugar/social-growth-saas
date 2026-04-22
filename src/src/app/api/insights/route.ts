import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { auth } from "@/lib/auth"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const profileId = searchParams.get("profile_id")

  if (!profileId) {
    return NextResponse.json({ error: "profile_id required" }, { status: 400 })
  }

  // Verify the profile belongs to this user.
  const { data: owned } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", profileId)
    .eq("user_id", session.user.id)
    .maybeSingle()

  if (!owned) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const { data: latest, error: latestError } = await supabase
    .from("trend_insights")
    .select("created_at")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (latestError) {
    if (latestError.code === "42P01" || latestError.message?.includes("does not exist") || latestError.message?.includes("schema cache")) {
      return NextResponse.json({ insights: [], error: "trend_insights table not found — run schema/003-trend-insights.sql in Supabase" }, { status: 200 })
    }
    return NextResponse.json({ error: latestError.message }, { status: 500 })
  }

  if (!latest) {
    return NextResponse.json({ insights: [] })
  }

  const cutoff = new Date(new Date(latest.created_at).getTime() - 10 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from("trend_insights")
    .select(
      "id, trend_name, confidence, performance_multiplier, example_posts, recommendation, suggested_schedule, is_mega_tip, created_at, one_line_summary, competitor_count, total_competitors, content_format, hook, caption_structure, best_time, hashtags"
    )
    .eq("profile_id", profileId)
    .gte("created_at", cutoff)
    .order("performance_multiplier", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ insights: data ?? [] })
}
