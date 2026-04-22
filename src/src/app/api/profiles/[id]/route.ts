import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { auth } from "@/lib/auth"

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  // Verify the profile belongs to the current user before deleting.
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", id)
    .eq("user_id", session.user.id)
    .maybeSingle()

  if (!profile) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  await supabase.from("posts").delete().eq("profile_id", id)
  await supabase.from("scrape_runs").delete().eq("profile_id", id)

  const { error } = await supabase
    .from("profiles")
    .delete()
    .eq("id", id)
    .eq("user_id", session.user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
