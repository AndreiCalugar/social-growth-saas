import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const profileId = searchParams.get("profile_id")
  console.log("[/api/insights] GET profile_id:", profileId)

  if (!profileId) {
    return NextResponse.json({ error: "profile_id required" }, { status: 400 })
  }

  const { data: latest, error: latestError } = await supabase
    .from("trend_insights")
    .select("created_at")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (latestError) {
    console.error("[/api/insights] latest query error:", latestError.message, latestError.code)
    // Table likely doesn't exist yet
    if (latestError.code === "42P01" || latestError.message?.includes("does not exist") || latestError.message?.includes("schema cache")) {
      return NextResponse.json({ insights: [], error: "trend_insights table not found — run schema/003-trend-insights.sql in Supabase" }, { status: 200 })
    }
    return NextResponse.json({ error: latestError.message }, { status: 500 })
  }

  if (!latest) {
    console.log("[/api/insights] no insights found for profile", profileId)
    return NextResponse.json({ insights: [] })
  }

  const cutoff = new Date(new Date(latest.created_at).getTime() - 10 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from("trend_insights")
    .select(
      "id, trend_name, confidence, performance_multiplier, example_posts, recommendation, suggested_schedule, is_mega_tip, created_at"
    )
    .eq("profile_id", profileId)
    .gte("created_at", cutoff)
    .order("performance_multiplier", { ascending: false })

  if (error) {
    console.error("[/api/insights] batch query error:", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  console.log("[/api/insights] returning", data?.length ?? 0, "insights")
  return NextResponse.json({ insights: data ?? [] })
}
