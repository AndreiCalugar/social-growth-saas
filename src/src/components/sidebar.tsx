"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import {
  LayoutDashboard,
  Users,
  Swords,
  Sparkles,
  Settings,
  TrendingUp,
  LogOut,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/profiles", label: "Profiles", icon: Users },
  { href: "/competitors", label: "Competitors", icon: Swords },
  { href: "/insights", label: "Insights", icon: Sparkles, badge: "NEW" },
  { href: "/settings", label: "Settings", icon: Settings },
]

export function Sidebar({
  username,
  userEmail,
  open = false,
  onClose,
}: {
  username: string
  userEmail?: string | null
  open?: boolean
  onClose?: () => void
}) {
  const pathname = usePathname()

  return (
    <aside
      className={cn(
        "flex h-screen w-64 flex-col text-slate-200",
        "fixed inset-y-0 left-0 z-50 shadow-xl transition-transform duration-300 ease-out",
        open ? "translate-x-0" : "-translate-x-full",
        "md:static md:z-auto md:w-56 md:translate-x-0 md:shadow-none md:transition-none"
      )}
      style={{
        background:
          "linear-gradient(180deg, #1E1B4B 0%, #16122E 55%, #0F0A2A 100%)",
      }}
    >
      {/* Subtle top highlight line */}
      <div
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"
        aria-hidden
      />

      <div className="flex h-14 items-center justify-between gap-2.5 border-b border-white/10 px-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 border border-white/15 backdrop-blur-sm shadow-sm">
            <TrendingUp className="h-4 w-4 text-white" strokeWidth={2.5} />
          </div>
          <span className="font-bold text-white tracking-tight">Social Growth</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="md:hidden inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <nav className="flex flex-col gap-0.5 p-3 flex-1 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon, badge }) => {
          const isActive = href === "/" ? pathname === href : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all border-l-2",
                isActive
                  ? "border-l-purple-400 bg-white/10 text-white nav-bloom"
                  : "border-l-transparent text-slate-400 hover:bg-white/5 hover:text-white"
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0 transition-colors",
                  isActive ? "text-purple-300" : "text-slate-500 group-hover:text-slate-200"
                )}
              />
              {label}
              {badge && !isActive && (
                <span className="ml-auto relative rounded-full bg-gradient-to-br from-purple-500 to-purple-700 px-1.5 py-0.5 text-[9px] font-bold text-white leading-none shadow-sm">
                  <span className="absolute inset-0 rounded-full bg-purple-400/40 animate-ping" aria-hidden />
                  <span className="relative">{badge}</span>
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Thin gradient divider between nav and user section */}
      <div
        className="mx-3 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent"
        aria-hidden
      />

      <div className="p-3 flex flex-col gap-1">
        <div className="flex items-center gap-2.5 rounded-lg px-3 py-2">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center text-xs font-semibold text-white shrink-0 shadow-sm ring-1 ring-white/20">
            {username.charAt(0).toUpperCase()}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-semibold text-white truncate">@{username}</span>
            <span className="text-[10px] text-slate-500 truncate">{userEmail ?? "Free plan"}</span>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          Log out
        </button>
      </div>
    </aside>
  )
}
