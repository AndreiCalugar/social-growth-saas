import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { supabase } from "@/lib/supabase"
import { isAdminEmail } from "@/lib/admin"

/**
 * Admin: approve users (shows them "Connect Instagram") or move them back to
 * waiting. Approving works for any user, request or not — that's how the
 * Meta reviewer's account gets access.
 */
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id || !isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const body = await request.json().catch(() => ({}))
  const userIds: string[] = Array.isArray(body.userIds)
    ? body.userIds.filter((id: unknown) => typeof id === "string")
    : []
  const action = body.action
  if (userIds.length === 0 || (action !== "approve" && action !== "revoke")) {
    return NextResponse.json({ error: "Pick users and an action." }, { status: 400 })
  }

  const now = new Date().toISOString()
  const { error } = await supabase.from("beta_access").upsert(
    userIds.map((user_id) => ({
      user_id,
      status: action === "approve" ? "approved" : "pending",
      approved_at: action === "approve" ? now : null,
      updated_at: now,
    })),
    { onConflict: "user_id" }
  )
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true, updated: userIds.length })
}
