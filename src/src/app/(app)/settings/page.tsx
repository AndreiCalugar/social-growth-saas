import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { supabase } from "@/lib/supabase"
import { LogOutButton } from "@/components/log-out-button"
import { Mail, User as UserIcon, AtSign } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function SettingsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const userId = session.user.id

  const [{ data: user }, { data: ownProfile }] = await Promise.all([
    supabase.from("users").select("email, name").eq("id", userId).maybeSingle(),
    supabase
      .from("profiles")
      .select("username")
      .eq("user_id", userId)
      .eq("is_own", true)
      .maybeSingle(),
  ])

  return (
    <div className="p-4 sm:p-6 max-w-xl">
      <h1 className="text-xl font-bold text-slate-900 mb-1">Settings</h1>
      <p className="text-slate-500 text-sm mb-8">Your account</p>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <InfoRow icon={UserIcon} label="Name" value={user?.name ?? "—"} />
        <InfoRow icon={Mail} label="Email" value={user?.email ?? "—"} />
        <InfoRow
          icon={AtSign}
          label="Tracked profile"
          value={ownProfile ? `@${ownProfile.username}` : "Not set"}
        />

        <div className="pt-4 border-t border-slate-100">
          <LogOutButton />
        </div>
      </section>
    </div>
  )
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-9 w-9 shrink-0 rounded-lg bg-slate-100 flex items-center justify-center">
        <Icon className="h-4 w-4 text-slate-500" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          {label}
        </p>
        <p className="text-sm font-medium text-slate-900 truncate">{value}</p>
      </div>
    </div>
  )
}
