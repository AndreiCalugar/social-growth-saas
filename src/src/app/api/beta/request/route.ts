import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { supabase } from "@/lib/supabase"
import { normalizeInstagramUsername } from "@/lib/beta"

/**
 * A user asks to join the beta with their Instagram handle. Re-submitting
 * updates the handle; an approved user stays approved.
 */
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const username = normalizeInstagramUsername(String(body.instagram_username ?? ""))
  if (!username) {
    return NextResponse.json(
      { error: "Enter a valid Instagram username, like @yourbrand." },
      { status: 400 }
    )
  }

  const { data: existing } = await supabase
    .from("beta_access")
    .select("status")
    .eq("user_id", session.user.id)
    .maybeSingle()

  const now = new Date().toISOString()
  const { error } = await supabase.from("beta_access").upsert(
    {
      user_id: session.user.id,
      instagram_username: username,
      is_professional: Boolean(body.is_professional),
      status: existing?.status === "approved" ? "approved" : "pending",
      requested_at: now,
      updated_at: now,
    },
    { onConflict: "user_id" }
  )
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true, instagram_username: username })
}
