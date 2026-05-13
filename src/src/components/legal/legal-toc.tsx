"use client"

import { useEffect, useState } from "react"

export type TocEntry = { id: string; label: string }

export function LegalToc({ entries }: { entries: TocEntry[] }) {
  const [active, setActive] = useState<string | null>(entries[0]?.id ?? null)

  useEffect(() => {
    if (entries.length === 0) return

    const observer = new IntersectionObserver(
      (records) => {
        const visible = records
          .filter((r) => r.isIntersecting)
          .sort((a, b) => a.target.getBoundingClientRect().top - b.target.getBoundingClientRect().top)[0]
        if (visible?.target.id) {
          setActive(visible.target.id)
        }
      },
      { rootMargin: "-80px 0px -65% 0px", threshold: 0 },
    )

    entries.forEach(({ id }) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [entries])

  return (
    <nav aria-label="Table of contents" className="sticky top-24">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-3">
        On this page
      </p>
      <ul className="space-y-1.5 border-l border-slate-200">
        {entries.map(({ id, label }) => {
          const isActive = active === id
          return (
            <li key={id}>
              <a
                href={`#${id}`}
                className={`block -ml-px border-l-2 pl-3 py-1 text-xs transition-colors ${
                  isActive
                    ? "border-purple-600 text-purple-700 font-semibold"
                    : "border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300"
                }`}
              >
                {label}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
