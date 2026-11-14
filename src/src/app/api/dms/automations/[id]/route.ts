import { NextRequest, NextResponse } from "next/server"
import { joinReplyVariants, parseReplyVariants } from "@/lib/meta/reply-variants"
import { auth } from "@/lib/auth"
import { supabase } from "@/lib/supabase"

const MAX_KEYWORDS = 20
const MAX_MESSAGE_LENGTH = 1000

interface AutomationPatch {
  name?: string
  post_id?: string | null
  post_url?: string | null
  match_any_post?: boolean
  keywords?: string[]
  whole_word_match?: boolean
  dm_message?: string
  public_reply_enabled?: boolean
  public_reply_message?: string | null
  is_active?: boolean
  track_clicks?: boolean
  trigger_type?: string
  follow_gate?: boolean
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

  const body = (await req.json().catch(() => null)) as AutomationPatch | null
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { data: existing } = await supabase
    .from("dm_automations")
    .select("id")
    .eq("id", id)
    .eq("user_id", session.user.id)
    .maybeSingle()
  if (!existing) {
    return NextResponse.json({ error: "Automation not found" }, { status: 404 })
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.name !== undefined) {
    if (!body.name.trim()) {
      return NextResponse.json({ error: "name cannot be empty" }, { status: 400 })
    }
    patch.name = body.name.trim()
  }
  if (body.keywords !== undefined) {
    if (
      !Array.isArray(body.keywords) ||
      body.keywords.length === 0 ||
      body.keywords.length > MAX_KEYWORDS ||
      body.keywords.some((k) => typeof k !== "string" || !k.trim())
    ) {
      return NextResponse.json(
        { error: `keywords must be 1-${MAX_KEYWORDS} non-empty strings` },
        { status: 400 }
      )
    }
    patch.keywords = body.keywords.map((k) => k.trim())
  }
  if (body.dm_message !== undefined) {
    if (!body.dm_message.trim() || body.dm_message.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json(
        { error: `dm_message must be 1-${MAX_MESSAGE_LENGTH} characters` },
        { status: 400 }
      )
    }
    patch.dm_message = body.dm_message.trim()
  }
  if (body.match_any_post !== undefined) {
    patch.match_any_post = Boolean(body.match_any_post)
    if (body.match_any_post) patch.post_id = null
  }
  if (body.post_id !== undefined && !body.match_any_post) {
    patch.post_id = body.post_id
  }
  if (body.post_url !== undefined) patch.post_url = body.post_url
  if (body.whole_word_match !== undefined) {
    patch.whole_word_match = Boolean(body.whole_word_match)
  }
  if (body.public_reply_enabled !== undefined) {
    patch.public_reply_enabled = Boolean(body.public_reply_enabled)
  }
  if (body.public_reply_message !== undefined) {
    // One variation per line, normalized (max 5, trimmed, deduped).
    patch.public_reply_message =
      joinReplyVariants(parseReplyVariants(body.public_reply_message)) || null
  }
  if (body.is_active !== undefined) patch.is_active = Boolean(body.is_active)
  if (body.track_clicks !== undefined) patch.track_clicks = Boolean(body.track_clicks)
  if (body.follow_gate !== undefined) patch.follow_gate = Boolean(body.follow_gate)
  if (body.trigger_type !== undefined) {
    if (!["comment", "dm", "story_reply"].includes(body.trigger_type)) {
      return NextResponse.json({ error: "trigger_type must be comment, dm or story_reply" }, { status: 400 })
    }
    patch.trigger_type = body.trigger_type
    if (body.trigger_type !== "comment") {
      // DM and story-reply automations have no post and no public reply.
      patch.match_any_post = false
      patch.post_id = null
      patch.post_url = null
      patch.public_reply_enabled = false
      patch.public_reply_message = null
    } else if (!body.match_any_post && !body.post_id) {
      return NextResponse.json({ error: "Pick a post or enable match_any_post" }, { status: 400 })
    }
  }

  const update = (values: Record<string, unknown>) =>
    supabase
      .from("dm_automations")
      .update(values)
      .eq("id", id)
      .eq("user_id", session.user.id)
      .select()
      .maybeSingle()

  let { data: automation, error } = await update(patch)
  // Before schema/026 nothing is gated, so "off" needs no column.
  if (error && patch.follow_gate === false && error.message.includes("follow_gate")) {
    delete patch.follow_gate
    ;({ data: automation, error } = await update(patch))
  }
  if (error && patch.follow_gate === true && error.message.includes("follow_gate")) {
    return NextResponse.json(
      { error: "The follow-gate needs a database update (schema/026) first." },
      { status: 503 }
    )
  }
  // Before schema/025 every automation is a comment one, so "comment"
  // needs no column. Anything else must not be half-saved.
  if (error && patch.trigger_type === "comment" && error.message.includes("trigger_type")) {
    const { trigger_type: _same, ...rest } = patch
    ;({ data: automation, error } = await update(rest))
  }
  if (error && "trigger_type" in patch && error.message.includes("trigger_type")) {
    return NextResponse.json(
      { error: "DM and story triggers need a database update (schema/025) first." },
      { status: 503 }
    )
  }
  // Database not migrated yet (schema/024): save everything else.
  if (error && "track_clicks" in patch && error.message.includes("track_clicks")) {
    const { track_clicks: _skipped, ...rest } = patch
    ;({ data: automation, error } = await update(rest))
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ automation })
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

  const { data: deleted, error } = await supabase
    .from("dm_automations")
    .delete()
    .eq("id", id)
    .eq("user_id", session.user.id)
    .select("id")

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!deleted || deleted.length === 0) {
    return NextResponse.json({ error: "Automation not found" }, { status: 404 })
  }
  return NextResponse.json({ success: true })
}
