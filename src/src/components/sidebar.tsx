"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Users,
  Swords,
  Lightbulb,
  Star,
  Settings,
  TrendingUp,
} from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/profiles", label: "Profiles", icon: Users },
  { href: "/competitors", label: "Competitors", icon: Swords },
  { href: "/insights", label: "Insights", icon: Lightbulb },
  { href: "/recommendations", label: "Recommendations", icon: Star },
  { href: "/settings", label: "Settings", icon: Settings },
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
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              pathname === href
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        ))}
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
