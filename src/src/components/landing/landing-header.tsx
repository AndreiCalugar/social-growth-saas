"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { TrendingUp, Menu, X } from "lucide-react"

const NAV_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
]

export function LandingHeader({
  darkHero = false,
}: {
  /**
   * Set to `true` on pages where the first section is the dark hero
   * (i.e. the landing page). The header then uses light text until the
   * user scrolls past it. On white-background pages (legal pages, etc.)
   * leave it `false` — the header always uses dark text.
   */
  darkHero?: boolean
}) {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  // Light text only when we're actually sitting over the dark hero and
  // the mobile menu is closed. Open menus always show on a white panel so
  // the dropdown items stay readable.
  const onDark = darkHero && !scrolled && !mobileOpen
  const solidBg = scrolled || mobileOpen

  return (
    <header
      className={`sticky top-0 z-40 transition-all ${
        solidBg
          ? "bg-white/95 backdrop-blur-md border-b border-slate-200/70 shadow-sm"
          : "bg-transparent border-b border-transparent"
      }`}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-600 to-purple-800 shadow-sm ring-1 ring-white/20">
              <TrendingUp className="h-4 w-4 text-white" strokeWidth={2.5} />
            </div>
            <span
              className={`font-bold tracking-tight transition-colors ${
                onDark ? "text-white drop-shadow-sm" : "text-slate-900"
              }`}
            >
              Social Growth
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-7">
            {NAV_LINKS.map(({ href, label }) => (
              <a
                key={href}
                href={href}
                className={`text-sm font-medium transition-colors ${
                  onDark
                    ? "text-white/75 hover:text-white"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {label}
              </a>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/login"
              className={`text-sm font-medium transition-colors ${
                onDark
                  ? "text-white/85 hover:text-white"
                  : "text-slate-700 hover:text-slate-900"
              }`}
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="inline-flex h-9 items-center justify-center rounded-lg bg-purple-600 hover:bg-purple-700 px-4 text-sm font-medium text-white shadow-sm shadow-purple-500/20 transition-colors"
            >
              Start free
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            className={`md:hidden inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
              onDark
                ? "text-white hover:bg-white/10"
                : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {mobileOpen && (
          <div className="md:hidden pb-4 pt-2 flex flex-col gap-1 border-t border-slate-200/60">
            {NAV_LINKS.map(({ href, label }) => (
              <a
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className="px-2 py-2 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                {label}
              </a>
            ))}
            <div className="mt-2 flex flex-col gap-2 pt-2 border-t border-slate-100">
              <Link
                href="/login"
                className="px-2 py-2 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="inline-flex h-10 items-center justify-center rounded-lg bg-purple-600 hover:bg-purple-700 px-4 text-sm font-medium text-white shadow-sm"
              >
                Start free
              </Link>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
