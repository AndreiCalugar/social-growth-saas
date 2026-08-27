import { NextRequest, NextResponse } from "next/server"
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
  if (!body.match_any_post && !body.post_id) {
    return "Pick a post or enable match_any_post"
  }
  if (body.public_reply_enabled && !body.public_reply_message?.trim()) {
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

  const { data: automation, error } = await supabase
    .from("dm_automations")
    .insert({
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
      public_reply_message: body.public_reply_message?.trim() || null,
      is_active: body.is_active ?? true,
    })
    .select()
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ automation }, { status: 201 })
}
