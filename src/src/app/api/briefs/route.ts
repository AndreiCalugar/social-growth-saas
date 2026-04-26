import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { auth } from "@/lib/auth"

const SAVED_BRIEF_COLUMNS =
  "id, user_id, trend_insight_id, trend_name, trend_type, performance_multiplier, original_content, original_hook, original_caption, original_posting_time, original_hashtags, original_competitor_edge, hook_variations, content_angles, caption_variations, chosen_hook, chosen_content, chosen_caption, chosen_posting_time, chosen_hashtags, user_notes, scheduled_date, scheduled_time, status, created_at, updated_at" as const

const ALLOWED_STATUSES = ["saved", "planning", "filming", "filmed", "posted"] as const

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const statusFilter = searchParams.get("status")

  let query = supabase
    .from("saved_briefs")
    .select(SAVED_BRIEF_COLUMNS)
    .eq("user_id", session.user.id)

  if (statusFilter) {
    const statuses = statusFilter
      .split(",")
      .map((s) => s.trim())
      .filter((s) => (ALLOWED_STATUSES as readonly string[]).includes(s))
    if (statuses.length) {
      query = query.in("status", statuses)
    }
  }

  // Upcoming first by scheduled_date, then most-recently-created.
  // PostgREST puts NULLs last for ascending by default.
  const { data, error } = await query
    .order("scheduled_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ briefs: data ?? [] })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const userId = session.user.id

  const body = await req.json().catch(() => ({})) as {
    trend_insight_id?: string
    trend_name?: string
    performance_multiplier?: number | null
    original_content?: string | null
    original_hook?: string | null
    original_caption?: string | null
    original_posting_time?: string | null
    original_hashtags?: string[] | null
  }

  let row: {
    user_id: string
    trend_insight_id: string | null
    trend_name: string
    trend_type: string | null
    performance_multiplier: number | null
    original_content: string | null
    original_hook: string | null
    original_caption: string | null
    original_posting_time: string | null
    original_hashtags: string[]
    original_competitor_edge: string | null
  }

  if (body.trend_insight_id) {
    // Snapshot from the live trend_insights row, after verifying ownership
    // through the profile that owns that insight.
    const { data: insight, error: fetchErr } = await supabase
      .from("trend_insights")
      .select(
        "id, profile_id, trend_name, performance_multiplier, content_format, hook, caption_structure, best_time, hashtags, competitor_edge, trend_type"
      )
      .eq("id", body.trend_insight_id)
      .maybeSingle()

    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })
    if (!insight) return NextResponse.json({ error: "Trend insight not found" }, { status: 404 })

    const { data: owned } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", insight.profile_id)
      .eq("user_id", userId)
      .maybeSingle()

    if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 })

    // Idempotent on (user_id, trend_insight_id) — return the existing brief
    // so the UI can navigate straight into the workshop.
    const { data: existing } = await supabase
      .from("saved_briefs")
      .select(SAVED_BRIEF_COLUMNS)
      .eq("user_id", userId)
      .eq("trend_insight_id", insight.id)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ brief: existing, existed: true })
    }

    row = {
      user_id: userId,
      trend_insight_id: insight.id,
      trend_name: insight.trend_name,
      trend_type: (insight as { trend_type?: string | null }).trend_type ?? null,
      performance_multiplier: insight.performance_multiplier ?? null,
      original_content: insight.content_format ?? null,
      original_hook: insight.hook ?? null,
      original_caption: insight.caption_structure ?? null,
      original_posting_time: insight.best_time ?? null,
      original_hashtags: Array.isArray(insight.hashtags) ? insight.hashtags : [],
      original_competitor_edge:
        (insight as { competitor_edge?: string | null }).competitor_edge ?? null,
    }
  } else {
    if (!body.trend_name) {
      return NextResponse.json(
        { error: "trend_insight_id or trend_name is required" },
        { status: 400 }
      )
    }
    row = {
      user_id: userId,
      trend_insight_id: null,
      trend_name: body.trend_name,
      trend_type: null,
      performance_multiplier: body.performance_multiplier ?? null,
      original_content: body.original_content ?? null,
      original_hook: body.original_hook ?? null,
      original_caption: body.original_caption ?? null,
      original_posting_time: body.original_posting_time ?? null,
      original_hashtags: Array.isArray(body.original_hashtags) ? body.original_hashtags : [],
      original_competitor_edge: null,
    }
  }

  const { data: created, error } = await supabase
    .from("saved_briefs")
    .insert(row)
    .select(SAVED_BRIEF_COLUMNS)
    .single()

  if (error || !created) {
    return NextResponse.json({ error: error?.message ?? "Failed to save brief" }, { status: 500 })
  }

  return NextResponse.json({ brief: created, existed: false })
}
