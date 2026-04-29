import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { supabase } from "@/lib/supabase"
import { AppShell } from "@/components/app-shell"
import { FeedbackWidget } from "@/components/feedback-widget"

export const dynamic = "force-dynamic"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/login")
  }

  const userId = session.user.id

  const [{ data: ownProfile }, { data: user }, activeBriefsResp] = await Promise.all([
    supabase
      .from("profiles")
      .select("username")
      .eq("user_id", userId)
      .eq("is_own", true)
      .maybeSingle(),
    supabase
      .from("users")
      .select("email, name")
      .eq("id", userId)
      .maybeSingle(),
    // Count briefs in active states (Planning + Filming) for the sidebar
    // badge. `head: true` skips returning rows. Tolerates the saved_briefs
    // table not existing yet (schema/007 not applied) so we don't break the
    // shell for users that haven't run the migration.
    supabase
      .from("saved_briefs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("status", ["planning", "filming"]),
  ])

  const displayName =
    ownProfile?.username ??
    user?.name ??
    user?.email?.split("@")[0] ??
    "—"

  const activeBriefsCount =
    activeBriefsResp.error ? 0 : (activeBriefsResp.count ?? 0)

  return (
    <AppShell
      username={displayName}
      userEmail={user?.email ?? null}
      activeBriefsCount={activeBriefsCount}
    >
      {children}
      {/* Persistent feedback pill — only mounted inside the (app) layout
          so it never appears on /login or /signup. */}
      <FeedbackWidget />
    </AppShell>
  )
}
