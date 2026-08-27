import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { supabase } from "@/lib/supabase"

/**
 * Disconnect the user's Instagram account. Deleting the row cascades to
 * dm_automations and dm_logs (see schema/017), so automations stop
 * immediately — pending queue rows are removed with them.
 */
export async function POST() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { error } = await supabase
    .from("instagram_accounts")
    .delete()
    .eq("user_id", session.user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
