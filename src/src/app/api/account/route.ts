import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { supabase } from "@/lib/supabase"

/**
 * Permanently delete the signed-in user's account. Deleting the users row
 * cascades to profiles (→ posts, scrape_runs, analyses, recommendations,
 * trend_insights), saved_briefs, instagram_accounts, dm_automations and
 * dm_logs. feedback and webhook_events keep their rows with user_id set to
 * NULL (see schema/012, schema/017).
 *
 * Cached avatars live at profile-pics/{username}.jpg and are shared across
 * users tracking the same handle, so we only remove ones no remaining
 * profile still references.
 */
export async function DELETE() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const userId = session.user.id

  const { data: profiles } = await supabase
    .from("profiles")
    .select("username")
    .eq("user_id", userId)

  const { error } = await supabase.from("users").delete().eq("id", userId)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const usernames = Array.from(new Set((profiles ?? []).map((p) => p.username)))
  if (usernames.length > 0) {
    const { data: stillUsed } = await supabase
      .from("profiles")
      .select("username")
      .in("username", usernames)
    const keep = new Set((stillUsed ?? []).map((p) => p.username))
    const orphaned = usernames.filter((u) => !keep.has(u)).map((u) => `${u}.jpg`)
    if (orphaned.length > 0) {
      // Best effort — the account is already gone; a stale avatar isn't worth failing on.
      await supabase.storage.from("profile-pics").remove(orphaned)
    }
  }

  return NextResponse.json({ success: true })
}
