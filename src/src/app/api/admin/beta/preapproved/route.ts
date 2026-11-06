import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { supabase } from "@/lib/supabase"
import { isAdminEmail } from "@/lib/admin"
import { normalizeInstagramUsername } from "@/lib/beta"

/**
 * Admin: add or remove pre-approved Instagram handles. Adding a handle also
 * approves anyone already waiting with it, so it works whichever happens
 * first — the Meta invite or the user's request.
 */
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id || !isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const body = await request.json().catch(() => ({}))
  const toHandles = (v: unknown): string[] =>
    Array.isArray(v)
      ? Array.from(
          new Set(
            v
              .map((h) => normalizeInstagramUsername(String(h)))
              .filter((h): h is string => !!h)
          )
        )
      : []
  const add = toHandles(body.add)
  const remove = toHandles(body.remove)
  if (add.length === 0 && remove.length === 0) {
    return NextResponse.json({ error: "No valid handles." }, { status: 400 })
  }

  if (add.length > 0) {
    const { error } = await supabase
      .from("beta_preapproved_handles")
      .upsert(add.map((instagram_username) => ({ instagram_username })), {
        onConflict: "instagram_username",
      })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const now = new Date().toISOString()
    const { error: approveError } = await supabase
      .from("beta_access")
      .update({ status: "approved", approved_at: now, updated_at: now })
      .eq("status", "pending")
      .in("instagram_username", add)
    if (approveError) {
      return NextResponse.json({ error: approveError.message }, { status: 500 })
    }
  }

  if (remove.length > 0) {
    const { error } = await supabase
      .from("beta_preapproved_handles")
      .delete()
      .in("instagram_username", remove)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, added: add.length, removed: remove.length })
}
