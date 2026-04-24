"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { useJobTracker } from "@/components/job-tracker"

const ESTIMATED_SCRAPE_MS = 120_000 // ~2 min

/**
 * Renders an overlay on a card when the job tracker has a running scrape
 * for the given profileId. Shows a spinner, "Scraping…", and a live
 * "elapsed / ~2 min" timer. Returns null when no matching job is running,
 * so mounting it is a no-op in the common case.
 */
export function ScrapingCardOverlay({ profileId }: { profileId: string }) {
  const { jobs } = useJobTracker()
  const job = jobs.find(
    (j) => j.kind === "scrape" && j.profileId === profileId && j.status === "running"
  )

  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!job) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [job])

  if (!job) return null

  const elapsedMs = Math.max(0, now - job.startedAt)
  const pct = Math.min(100, Math.round((elapsedMs / ESTIMATED_SCRAPE_MS) * 100))

  return (
    <div className="absolute inset-0 z-10 rounded-xl bg-white/85 backdrop-blur-sm flex flex-col items-center justify-center gap-3 text-center px-4 pointer-events-none">
      <div className="relative">
        <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
          <Loader2 className="h-6 w-6 text-purple-600 animate-spin" />
        </div>
        <span className="absolute inset-0 rounded-full ring-2 ring-purple-300/60 animate-pulse" aria-hidden />
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-900">Scraping @{job.label.replace(/^Scraping @/, "")}</p>
        <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
          {formatElapsed(elapsedMs)} / ~2 min
        </p>
      </div>
      <div className="w-32 h-1 rounded-full bg-slate-200 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-1000 ease-linear"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function formatElapsed(ms: number): string {
  const total = Math.floor(ms / 1000)
  const mm = Math.floor(total / 60)
  const ss = total % 60
  return `${mm}:${ss.toString().padStart(2, "0")}`
}
