import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // Delete posts first (no cascade set up), then the profile
  await supabase.from("posts").delete().eq("profile_id", id)
  await supabase.from("scrape_runs").delete().eq("profile_id", id)

  const { error } = await supabase
    .from("profiles")
    .delete()
    .eq("id", id)
    .eq("is_own", false) // Safety: never delete own profile

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
