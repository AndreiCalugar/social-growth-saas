import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const profileId = searchParams.get("profile_id")

  if (!profileId) {
    return NextResponse.json({ error: "profile_id required" }, { status: 400 })
  }

  // Get the most recent analysis batch — all insights created within 10 minutes of the latest one
  const { data: latest } = await supabase
    .from("trend_insights")
    .select("created_at")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!latest) {
    return NextResponse.json({ insights: [] })
  }

  // Fetch all insights from the same batch (within 10 min of the latest)
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
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ insights: data ?? [] })
}
