import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { auth } from "@/lib/auth"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ profileId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { profileId } = await params

  const { data: owned } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", profileId)
    .eq("user_id", session.user.id)
    .maybeSingle()

  if (!owned) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

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
