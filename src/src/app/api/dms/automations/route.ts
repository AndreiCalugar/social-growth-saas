import { NextRequest, NextResponse } from "next/server"
import { joinReplyVariants, parseReplyVariants } from "@/lib/meta/reply-variants"
import { auth } from "@/lib/auth"
import { supabase } from "@/lib/supabase"
import { getAccountForUser } from "@/lib/meta/accounts"

const MAX_KEYWORDS = 20
const MAX_MESSAGE_LENGTH = 1000
const MAX_AUTOMATIONS = 20

interface AutomationBody {
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

const TRIGGER_TYPES = ["comment", "dm", "story_reply"] as const
type TriggerType = (typeof TRIGGER_TYPES)[number]

function triggerOf(body: { trigger_type?: string }): TriggerType | null {
  const t = body.trigger_type ?? "comment"
  return (TRIGGER_TYPES as readonly string[]).includes(t) ? (t as TriggerType) : null
}

function validateAutomationBody(body: AutomationBody): string | null {
  if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
    return "name is required"
  }
  if (
    !Array.isArray(body.keywords) ||
    body.keywords.length === 0 ||
    body.keywords.some((k) => typeof k !== "string" || !k.trim())
  ) {
    return "keywords must be a non-empty array of strings"
  }
  if (body.keywords.length > MAX_KEYWORDS) {
    return `At most ${MAX_KEYWORDS} keywords`
  }
  if (!body.dm_message || typeof body.dm_message !== "string" || !body.dm_message.trim()) {
    return "dm_message is required"
  }
  if (body.dm_message.length > MAX_MESSAGE_LENGTH) {
    return `dm_message must be at most ${MAX_MESSAGE_LENGTH} characters`
  }
  const trigger = triggerOf(body)
  if (!trigger) return "trigger_type must be comment, dm or story_reply"
  // DM and story-reply automations aren't tied to a post.
  if (trigger === "comment" && !body.match_any_post && !body.post_id) {
    return "Pick a post or enable match_any_post"
  }
  if (
    body.public_reply_enabled &&
    !joinReplyVariants(parseReplyVariants(body.public_reply_message))
  ) {
    return "public_reply_message is required when public reply is enabled"
  }
  return null
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: automations, error } = await supabase
    .from("dm_automations")
    .select("*")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ automations: automations ?? [] })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = (await req.json().catch(() => null)) as AutomationBody | null
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  const validationError = validateAutomationBody(body)
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 })
  }

  const account = await getAccountForUser(session.user.id)
  if (!account) {
    return NextResponse.json(
      { error: "Connect an Instagram account first" },
      { status: 404 }
    )
  }

  const { count } = await supabase
    .from("dm_automations")
    .select("id", { count: "exact", head: true })
    .eq("user_id", session.user.id)
  if ((count ?? 0) >= MAX_AUTOMATIONS) {
    return NextResponse.json(
      { error: `At most ${MAX_AUTOMATIONS} automations per account` },
      { status: 429 }
    )
  }

  const values: Record<string, unknown> = {
      user_id: session.user.id,
      instagram_account_id: account.id,
      name: body.name!.trim(),
      post_id: body.match_any_post ? null : body.post_id,
      post_url: body.post_url ?? null,
      match_any_post: Boolean(body.match_any_post),
      keywords: body.keywords!.map((k) => k.trim()).filter(Boolean),
      whole_word_match: body.whole_word_match ?? true,
      dm_message: body.dm_message!.trim(),
      public_reply_enabled: Boolean(body.public_reply_enabled),
      // One variation per line, normalized (max 5, trimmed, deduped).
      public_reply_message:
        joinReplyVariants(parseReplyVariants(body.public_reply_message)) || null,
      is_active: body.is_active ?? true,
  }
  if (body.track_clicks !== undefined) values.track_clicks = Boolean(body.track_clicks)
  // Only written when on, so creating without it works before schema/026.
  if (body.follow_gate) values.follow_gate = true

  // Comment automations leave trigger_type to its default, so they work
  // the same before and after schema/025. DM and story ones have no post
  // and nothing to reply to publicly.
  const trigger = triggerOf(body)!
  if (trigger !== "comment") {
    values.trigger_type = trigger
    values.match_any_post = false
    values.post_id = null
    values.post_url = null
    values.public_reply_enabled = false
    values.public_reply_message = null
  }

  const insert = (row: Record<string, unknown>) =>
    supabase.from("dm_automations").insert(row).select().maybeSingle()

  let { data: automation, error } = await insert(values)
  if (error && error.message.includes("follow_gate")) {
    return NextResponse.json(
      { error: "The follow-gate needs a database update (schema/026) first." },
      { status: 503 }
    )
  }
  // Never save a DM/story automation without its trigger: it would turn
  // into a comment automation on no post.
  if (error && error.message.includes("trigger_type")) {
    return NextResponse.json(
      { error: "DM and story triggers need a database update (schema/025) first." },
      { status: 503 }
    )
  }
  // Database not migrated yet (schema/024): create it without tracking.
  if (error && "track_clicks" in values && error.message.includes("track_clicks")) {
    const { track_clicks: _skipped, ...rest } = values
    ;({ data: automation, error } = await insert(rest))
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ automation }, { status: 201 })
}
