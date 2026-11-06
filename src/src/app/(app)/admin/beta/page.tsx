import { notFound, redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { supabase } from "@/lib/supabase"
import { isAdminEmail } from "@/lib/admin"
import { AdminBetaClient, type AdminBetaRow } from "@/components/admin-beta-client"

export const dynamic = "force-dynamic"

export default async function AdminBetaPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  if (!isAdminEmail(session.user.email)) notFound()

  const [
    { data: users },
    { data: beta, error: betaError },
    { data: accounts },
    { data: preapproved, error: preapprovedError },
  ] = await Promise.all([
      supabase
        .from("users")
        .select("id, email, name, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("beta_access")
        .select("user_id, instagram_username, is_professional, status, requested_at, approved_at"),
      supabase.from("instagram_accounts").select("user_id, username"),
      supabase
        .from("beta_preapproved_handles")
        .select("instagram_username, added_at")
        .order("added_at", { ascending: false }),
    ])

  const betaByUser = new Map((beta ?? []).map((b) => [b.user_id, b]))
  const connectedByUser = new Map((accounts ?? []).map((a) => [a.user_id, a.username]))

  const rows: AdminBetaRow[] = (users ?? []).map((u) => {
    const b = betaByUser.get(u.id)
    return {
      userId: u.id,
      email: u.email,
      name: u.name,
      signedUpAt: u.created_at,
      instagramUsername: b?.instagram_username ?? null,
      isProfessional: b?.is_professional ?? false,
      status: b ? (b.status as "pending" | "approved") : "none",
      requestedAt: b?.requested_at ?? null,
      approvedAt: b?.approved_at ?? null,
      connectedAs: connectedByUser.get(u.id) ?? null,
    }
  })

  return (
    <AdminBetaClient
      rows={rows}
      preapproved={(preapproved ?? []).map((p) => p.instagram_username)}
      migrationMissing={Boolean(betaError)}
      preapprovedMissing={Boolean(preapprovedError)}
    />
  )
}
