import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { auth } from "@/lib/auth"

const ALLOWED_RATINGS = ["love", "okay", "needs_work"] as const
type Rating = (typeof ALLOWED_RATINGS)[number]

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const { rating, message, page_url } = body as {
    rating?: string
    message?: string
    page_url?: string
  }

  if (!rating || !ALLOWED_RATINGS.includes(rating as Rating)) {
    return NextResponse.json(
      { error: `Invalid rating. Expected one of: ${ALLOWED_RATINGS.join(", ")}` },
      { status: 400 },
    )
  }

  const { error } = await supabase.from("feedback").insert({
    user_id: session.user.id,
    rating,
    // Trim and cap to keep the table from being filled by stray pastes.
    message: typeof message === "string" ? message.trim().slice(0, 2000) || null : null,
    page_url: typeof page_url === "string" ? page_url.slice(0, 500) : null,
  })

  if (error) {
    if (error.code === "42P01" || error.message?.includes("does not exist")) {
      return NextResponse.json(
        { error: "feedback table missing — run schema/012-feedback.sql" },
        { status: 500 },
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
