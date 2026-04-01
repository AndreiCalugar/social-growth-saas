import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ profileId: string }> }
) {
  const { profileId } = await params

  const { data, error } = await supabase
    .from("scrape_runs")
    .select("status, posts_scraped, completed_at")
    .eq("profile_id", profileId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ status: "pending" })
  }

  return NextResponse.json({
    status: data.status,
    posts_scraped: data.posts_scraped,
    completed_at: data.completed_at,
  })
}
