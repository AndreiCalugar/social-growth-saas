import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { auth } from "@/lib/auth"

const SAVED_BRIEF_COLUMNS =
  "id, user_id, trend_insight_id, trend_name, performance_multiplier, original_content, original_hook, original_caption, original_posting_time, original_hashtags, hook_variations, content_angles, caption_variations, chosen_hook, chosen_content, chosen_caption, chosen_posting_time, chosen_hashtags, user_notes, scheduled_date, scheduled_time, status, created_at, updated_at" as const

const ALLOWED_STATUSES = ["saved", "planning", "filming", "filmed", "posted"] as const

// Whitelist of user-editable fields. Anything else in the PATCH body is ignored.
const EDITABLE_FIELDS = new Set([
  "chosen_hook",
  "chosen_content",
  "chosen_caption",
  "chosen_posting_time",
  "chosen_hashtags",
  "user_notes",
  "scheduled_date",
  "scheduled_time",
  "status",
])

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const { data, error } = await supabase
    .from("saved_briefs")
    .select(SAVED_BRIEF_COLUMNS)
    .eq("id", id)
    .eq("user_id", session.user.id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json({ brief: data })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const body = await req.json().catch(() => ({}))

  const update: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(body ?? {})) {
    if (!EDITABLE_FIELDS.has(key)) continue
    if (key === "status" && !(ALLOWED_STATUSES as readonly string[]).includes(String(value))) {
      return NextResponse.json({ error: `Invalid status: ${value}` }, { status: 400 })
    }
    update[key] = value
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No editable fields supplied" }, { status: 400 })
  }

  update.updated_at = new Date().toISOString()

  const { data, error } = await supabase
    .from("saved_briefs")
    .update(update)
    .eq("id", id)
    .eq("user_id", session.user.id)
    .select(SAVED_BRIEF_COLUMNS)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json({ brief: data })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const { error, count } = await supabase
    .from("saved_briefs")
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("user_id", session.user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!count) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json({ success: true })
}
