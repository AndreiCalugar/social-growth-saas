import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { supabase } from "@/lib/supabase"
import { LogOutButton } from "@/components/log-out-button"
import {
  Mail, User as UserIcon, AtSign, Bell, CreditCard, AlertTriangle,
} from "lucide-react"

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

  const displayName = user?.name ?? user?.email?.split("@")[0] ?? "User"
  const initials = displayName.charAt(0).toUpperCase()

  return (
    <div className="p-4 sm:p-6 max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Settings</h1>
        <p className="text-slate-500 text-sm mt-0.5">Manage your account and preferences</p>
      </div>

      {/* Account section */}
      <section className="rounded-xl border border-slate-200/60 bg-white p-6 shadow-sm">
        <SectionHeader title="Account" subtitle="Your personal information" />

        <div className="mt-5 flex items-start gap-5">
          {/* Avatar */}
          <div className="relative shrink-0">
            <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center shadow-sm ring-2 ring-white">
              <span className="text-2xl font-bold text-white">{initials}</span>
            </div>
            <button
              type="button"
              disabled
              className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-white border border-slate-200 text-[10px] font-semibold text-slate-400 shadow-sm cursor-not-allowed"
              title="Coming soon"
            >
              Edit
            </button>
          </div>

          {/* Fields */}
          <div className="flex-1 min-w-0 space-y-4">
            <Field label="Name" icon={UserIcon}>
              <input
                type="text"
                defaultValue={user?.name ?? ""}
                placeholder="Add your name"
                disabled
                className="h-10 w-full pl-10 pr-4 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all disabled:cursor-not-allowed"
              />
            </Field>

            <Field label="Email" icon={Mail} readOnly>
              <input
                type="email"
                value={user?.email ?? ""}
                readOnly
                className="h-10 w-full pl-10 pr-4 rounded-lg border border-slate-200 bg-slate-100 text-sm text-slate-600 cursor-not-allowed"
              />
            </Field>

            <Field label="Tracked Instagram profile" icon={AtSign} readOnly>
              <input
                type="text"
                value={ownProfile ? `@${ownProfile.username}` : "Not set"}
                readOnly
                className="h-10 w-full pl-10 pr-4 rounded-lg border border-slate-200 bg-slate-100 text-sm text-slate-600 cursor-not-allowed"
              />
            </Field>
          </div>
        </div>
      </section>

      {/* Notifications placeholder */}
      <section className="rounded-xl border border-slate-200/60 bg-white p-6 shadow-sm opacity-75">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center">
              <Bell className="h-5 w-5 text-slate-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-slate-900">Notifications</h2>
                <span className="inline-flex items-center rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                  Pro
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Email + in-app alerts when insights finish, scrapes fail, or a mega-tip trend changes.
              </p>
            </div>
          </div>
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider shrink-0">
            Coming soon
          </span>
        </div>
      </section>

      {/* Billing placeholder */}
      <section className="rounded-xl border border-slate-200/60 bg-white p-6 shadow-sm opacity-75">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center">
              <CreditCard className="h-5 w-5 text-slate-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-slate-900">Billing</h2>
                <span className="inline-flex items-center rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                  Pro
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Upgrade for more competitors, faster scrapes, and unlimited insight runs.
              </p>
            </div>
          </div>
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider shrink-0">
            Coming soon
          </span>
        </div>
      </section>

      {/* Session */}
      <section className="rounded-xl border border-slate-200/60 bg-white p-6 shadow-sm">
        <SectionHeader title="Session" subtitle="Sign out of this browser" />
        <div className="mt-4">
          <LogOutButton />
        </div>
      </section>

      {/* Danger zone */}
      <section className="rounded-xl border border-red-200 bg-red-50/40 p-6">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-5 w-5 text-red-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-red-900">Danger zone</h2>
            <p className="text-xs text-red-700/80 mt-1 leading-relaxed">
              Permanently delete your account, all scraped data, and generated insights. This cannot be undone.
            </p>
            <button
              type="button"
              disabled
              title="Coming soon"
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3.5 py-2 text-xs font-semibold text-red-700 shadow-sm cursor-not-allowed opacity-70"
            >
              Delete account
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
    </div>
  )
}

function Field({
  label,
  icon: Icon,
  readOnly,
  children,
}: {
  label: string
  icon: React.ComponentType<{ className?: string }>
  readOnly?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-xs font-medium text-slate-700">{label}</span>
        {readOnly && (
          <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
            Read-only
          </span>
        )}
      </div>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-slate-400 pointer-events-none" />
        {children}
      </div>
    </div>
  )
}
