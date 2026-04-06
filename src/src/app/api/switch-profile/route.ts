import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function POST(req: NextRequest) {
  const { profile_id } = await req.json()

  if (!profile_id) {
    return NextResponse.json({ error: "profile_id required" }, { status: 400 })
  }

  // Set all profiles to is_own = false
  const { error: resetError } = await supabase
    .from("profiles")
    .update({ is_own: false })
    .neq("id", "00000000-0000-0000-0000-000000000000") // matches all rows

  if (resetError) {
    return NextResponse.json({ error: resetError.message }, { status: 500 })
  }

  // Set selected profile to is_own = true
  const { data, error } = await supabase
    .from("profiles")
    .update({ is_own: true })
    .eq("id", profile_id)
    .select("id, username, followers")
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ profile: data })
}
