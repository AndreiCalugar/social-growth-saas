import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { auth } from "@/lib/auth"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = session.user.id

  const { profile_id } = await req.json()

  if (!profile_id) {
    return NextResponse.json({ error: "profile_id required" }, { status: 400 })
  }

  // Verify the target profile belongs to this user.
  const { data: target } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", profile_id)
    .eq("user_id", userId)
    .maybeSingle()

  if (!target) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  // Flip is_own only within this user's own profiles.
  const { error: resetError } = await supabase
    .from("profiles")
    .update({ is_own: false })
    .eq("user_id", userId)

  if (resetError) {
    return NextResponse.json({ error: resetError.message }, { status: 500 })
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({ is_own: true })
    .eq("id", profile_id)
    .eq("user_id", userId)
    .select("id, username, followers")
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ profile: data })
}
