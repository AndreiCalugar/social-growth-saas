"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { RefreshCw, Loader2 } from "lucide-react"
import { useJobTracker, useRotatingMessage, ESTIMATED_DURATION } from "@/components/job-tracker"

interface Props {
  username: string
  profileId: string
}

export function ScrapeNowButton({ username, profileId }: Props) {
  const router = useRouter()
  const { jobs, startScrape } = useJobTracker()
  const job = jobs.find((j) => j.id === `scrape-${username}`)
  const running = job?.status === "running"
  const message = useRotatingMessage("scrape", running)
  const lastStatusRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (lastStatusRef.current === "running" && job?.status === "done") {
      router.refresh()
    }
    lastStatusRef.current = job?.status
  }, [job?.status, router])

  async function handleClick() {
    if (running) return
    startScrape({ username, profileId })
    try {
      await fetch(`${process.env.NEXT_PUBLIC_N8N_URL}/webhook/scrape-instagram`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      })
    } catch {
      // job-tracker will time it out on its own
    }
  }

  return (
    <div className="flex flex-col gap-2 w-full sm:w-auto">
      <Button onClick={handleClick} disabled={running} size="sm" variant="outline">
        {running ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4" />
        )}
        {running ? "Scraping…" : "Scrape Now"}
      </Button>
      {running && (
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 flex items-start gap-2.5 w-full sm:w-80">
          <Loader2 className="h-4 w-4 animate-spin text-purple-600 mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-900">{message}</p>
            <p className="text-[11px] text-slate-500">Usually takes {ESTIMATED_DURATION.scrape}. You can navigate away.</p>
          </div>
        </div>
      )}
    </div>
  )
}
