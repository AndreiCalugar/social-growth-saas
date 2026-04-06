import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  console.log("[/api/profiles/:id DELETE] id:", id)

  await supabase.from("posts").delete().eq("profile_id", id)
  await supabase.from("scrape_runs").delete().eq("profile_id", id)

  const { error } = await supabase
    .from("profiles")
    .delete()
    .eq("id", id)

  if (error) {
    console.error("[/api/profiles/:id DELETE] error:", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  console.log("[/api/profiles/:id DELETE] success")
  return NextResponse.json({ success: true })
}
