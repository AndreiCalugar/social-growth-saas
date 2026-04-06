"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Users,
  Swords,
  Sparkles,
  Star,
  Settings,
  TrendingUp,
} from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/", label: "Overview", icon: LayoutDashboard, highlight: false },
  { href: "/profiles", label: "Profiles", icon: Users, highlight: false },
  { href: "/competitors", label: "Competitors", icon: Swords, highlight: false },
  { href: "/insights", label: "Insights", icon: Sparkles, highlight: true },
  { href: "/recommendations", label: "Recommendations", icon: Star, highlight: false },
  { href: "/settings", label: "Settings", icon: Settings, highlight: false },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex h-screen w-56 flex-col border-r bg-background">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <TrendingUp className="h-5 w-5 text-primary" />
        <span className="font-semibold text-sm">Social Growth</span>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-1 p-3 flex-1">
        {navItems.map(({ href, label, icon: Icon, highlight }) => {
          const isActive = href === "/" ? pathname === href : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                isActive
                  ? highlight
                    ? "bg-orange-100 text-orange-700 font-semibold"
                    : "bg-primary/10 text-primary font-medium"
                  : highlight
                  ? "text-orange-600 hover:bg-orange-50 font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className={cn("h-4 w-4 shrink-0", highlight && !isActive && "text-orange-500")} />
              {label}
              {highlight && !isActive && (
                <span className="ml-auto rounded-full bg-orange-500 px-1.5 py-0.5 text-[9px] font-bold text-white leading-none">
                  NEW
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* User stub */}
      <div className="border-t p-3">
        <div className="flex items-center gap-2 rounded-md px-3 py-2">
          <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium text-primary">
            A
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-medium">andreixperience</span>
            <span className="text-xs text-muted-foreground">Free plan</span>
          </div>
        </div>
      </div>
    </aside>
  )
}
