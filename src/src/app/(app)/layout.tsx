import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { supabase } from "@/lib/supabase"
import { AppShell } from "@/components/app-shell"

export const dynamic = "force-dynamic"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/login")
  }

  const userId = session.user.id

  const [{ data: ownProfile }, { data: user }] = await Promise.all([
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
  ])

  const displayName =
    ownProfile?.username ??
    user?.name ??
    user?.email?.split("@")[0] ??
    "—"

  return (
    <AppShell username={displayName} userEmail={user?.email ?? null}>
      {children}
    </AppShell>
  )
}
