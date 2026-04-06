import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ profileId: string }> }
) {
  const { profileId } = await params
  console.log("[/api/scrape-status] GET profileId:", profileId)

  const { data, error } = await supabase
    .from("scrape_runs")
    .select("status, posts_scraped, completed_at")
    .eq("profile_id", profileId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error("[/api/scrape-status] error:", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!data) {
    console.log("[/api/scrape-status] no run found for", profileId)
    return NextResponse.json({ status: "pending" })
  }

  console.log("[/api/scrape-status] status:", data.status, "posts:", data.posts_scraped)
  return NextResponse.json({
    status: data.status,
    posts_scraped: data.posts_scraped,
    completed_at: data.completed_at,
  })
}
