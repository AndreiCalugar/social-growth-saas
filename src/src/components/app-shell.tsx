"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { Menu, TrendingUp } from "lucide-react"
import { Sidebar } from "./sidebar"
import { JobTrackerProvider } from "./job-tracker"
import { JobNotification } from "./job-notification"

export function AppShell({
  username,
  userEmail,
  children,
}: {
  username: string
  userEmail: string | null
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden"
      return () => {
        document.body.style.overflow = ""
      }
    }
  }, [open])

  return (
    <JobTrackerProvider>
      <div className="flex h-screen overflow-hidden">
        {open && (
          <div
            className="fixed inset-0 z-40 bg-slate-900/50 md:hidden"
            onClick={() => setOpen(false)}
            aria-hidden
          />
        )}

        <Sidebar
          username={username}
          userEmail={userEmail}
          open={open}
          onClose={() => setOpen(false)}
        />

        <div className="flex flex-1 flex-col overflow-hidden">
          <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 md:hidden">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-purple-600 to-purple-800 shadow-sm">
                <TrendingUp className="h-4 w-4 text-white" strokeWidth={2.5} />
              </div>
              <span className="font-bold text-slate-900 tracking-tight">Social Growth</span>
            </div>
            <button
              onClick={() => setOpen(true)}
              aria-label="Open menu"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100"
            >
              <Menu className="h-5 w-5" />
            </button>
          </header>
          <main
            key={pathname}
            className="relative flex-1 overflow-y-auto page-fade-in bg-gradient-to-b from-purple-50/40 via-slate-50 to-slate-50"
          >
            {/* Faint dot-grid texture — decorative, non-interactive */}
            <div
              className="pointer-events-none absolute inset-0 bg-dot-grid opacity-[0.025]"
              aria-hidden
            />
            <div className="relative">{children}</div>
          </main>
        </div>
      </div>
      <JobNotification />
    </JobTrackerProvider>
  )
}

