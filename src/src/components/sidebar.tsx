"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import {
  LayoutDashboard,
  Users,
  Swords,
  Sparkles,
  Star,
  Settings,
  TrendingUp,
  LogOut,
} from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/profiles", label: "Profiles", icon: Users },
  { href: "/competitors", label: "Competitors", icon: Swords },
  { href: "/insights", label: "Insights", icon: Sparkles, badge: "NEW" },
  { href: "/recommendations", label: "Recommendations", icon: Star },
  { href: "/settings", label: "Settings", icon: Settings },
]

export function Sidebar({
  username,
  userEmail,
}: {
  username: string
  userEmail?: string | null
}) {
  const pathname = usePathname()

  return (
    <aside className="flex h-screen w-56 flex-col bg-white border-r border-slate-200">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2.5 border-b border-slate-200 px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-purple-600 to-purple-800 shadow-sm">
          <TrendingUp className="h-4 w-4 text-white" strokeWidth={2.5} />
        </div>
        <span className="font-bold text-slate-900 tracking-tight">Social Growth</span>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-0.5 p-3 flex-1">
        {navItems.map(({ href, label, icon: Icon, badge }) => {
          const isActive = href === "/" ? pathname === href : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all border-l-2",
                isActive
                  ? "border-l-purple-600 bg-purple-50 text-purple-700"
                  : "border-l-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  isActive ? "text-purple-600" : "text-slate-400"
                )}
              />
              {label}
              {badge && !isActive && (
                <span className="ml-auto rounded-full bg-purple-600 px-1.5 py-0.5 text-[9px] font-bold text-white leading-none">
                  {badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* User + logout */}
      <div className="border-t border-slate-200 p-3 flex flex-col gap-1">
        <div className="flex items-center gap-2.5 rounded-lg px-3 py-2">
          <div className="h-7 w-7 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center text-xs font-semibold text-white shrink-0">
            {username.charAt(0).toUpperCase()}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-semibold text-slate-900 truncate">@{username}</span>
            <span className="text-[10px] text-slate-400 truncate">{userEmail ?? "Free plan"}</span>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          Log out
        </button>
      </div>
    </aside>
  )
}
