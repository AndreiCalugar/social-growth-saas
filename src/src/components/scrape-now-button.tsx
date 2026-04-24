"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { RefreshCw, Loader2, Clock } from "lucide-react"
import { useJobTracker, useRotatingMessage, ESTIMATED_DURATION } from "@/components/job-tracker"
import { triggerScrape } from "@/lib/trigger-scrape"
import { formatMinutesUntil } from "@/lib/scrape-cooldown"

interface Props {
  username: string
  profileId: string
}

type Cooldown = { reason: "hard" | "soft"; minutesUntilNext: number }

export function ScrapeNowButton({ username, profileId }: Props) {
  const router = useRouter()
  const { jobs, startScrape } = useJobTracker()
  const job = jobs.find((j) => j.id === `scrape-${username}`)
  const running = job?.status === "running"
  const message = useRotatingMessage("scrape", running)
  const lastStatusRef = useRef<string | undefined>(undefined)

  const [cooldown, setCooldown] = useState<Cooldown | null>(null)

  useEffect(() => {
    if (lastStatusRef.current === "running" && job?.status === "done") {
      router.refresh()
    }
    lastStatusRef.current = job?.status
  }, [job?.status, router])

  async function attempt(force: boolean) {
    if (running) return
    const result = await triggerScrape(profileId, { force })
    if (result.status === "fired") {
      setCooldown(null)
      startScrape({ username, profileId })
      return
    }
    if (result.status === "cooldown") {
      setCooldown({ reason: result.reason, minutesUntilNext: result.minutesUntilNext })
    }
  }

  return (
    <div className="flex flex-col gap-2 w-full sm:w-auto">
      <Button onClick={() => attempt(false)} disabled={running} size="sm" variant="outline">
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
      {!running && cooldown && (
        <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2.5 flex items-start gap-2.5 w-full sm:w-80">
          <Clock className="h-4 w-4 text-slate-500 mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-900">
              {cooldown.reason === "hard"
                ? `Just scraped — try again in ${formatMinutesUntil(cooldown.minutesUntilNext)}`
                : `Already fresh — next refresh available in ${formatMinutesUntil(cooldown.minutesUntilNext)}`}
            </p>
            {cooldown.reason === "soft" && (
              <button
                onClick={() => attempt(true)}
                className="text-[11px] font-medium text-purple-600 hover:text-purple-700 underline underline-offset-2 mt-1"
              >
                Rescrape anyway
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
