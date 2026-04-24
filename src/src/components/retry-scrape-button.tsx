"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { RefreshCw, Loader2 } from "lucide-react"
import { useJobTracker } from "@/components/job-tracker"
import { triggerScrape } from "@/lib/trigger-scrape"
import { formatMinutesUntil } from "@/lib/scrape-cooldown"

interface Props {
  profileId: string
  username: string
}

type Cooldown = { reason: "hard" | "soft"; minutesUntilNext: number }

export function RetryScrapeButton({ profileId, username }: Props) {
  const router = useRouter()
  const { jobs, startScrape } = useJobTracker()
  const job = jobs.find((j) => j.id === `scrape-${username}`)
  const running = job?.status === "running"
  const lastStatusRef = useRef<string | undefined>(undefined)

  const [cooldown, setCooldown] = useState<Cooldown | null>(null)

  useEffect(() => {
    if (lastStatusRef.current === "running" && job?.status === "done") {
      router.refresh()
    }
    lastStatusRef.current = job?.status
  }, [job?.status, router])

  async function attempt(force: boolean, e?: React.MouseEvent) {
    e?.preventDefault()
    e?.stopPropagation()
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

  if (running) {
    return (
      <span className="text-xs flex items-center gap-1 text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Scraping… ~2 min
      </span>
    )
  }

  if (cooldown?.reason === "hard") {
    return (
      <span className="text-xs text-slate-500">
        Just scraped — try again in {formatMinutesUntil(cooldown.minutesUntilNext)}
      </span>
    )
  }

  if (cooldown?.reason === "soft") {
    return (
      <div className="flex flex-col gap-1 items-start">
        <span className="text-xs text-slate-500">
          Already fresh — next refresh in {formatMinutesUntil(cooldown.minutesUntilNext)}.
        </span>
        <button
          onClick={(e) => attempt(true, e)}
          className="text-xs font-medium text-purple-600 hover:text-purple-700 underline underline-offset-2"
        >
          Rescrape anyway
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={(e) => attempt(false, e)}
      className="text-xs flex items-center gap-1 text-amber-600 hover:text-amber-700"
    >
      <RefreshCw className="h-3 w-3" />
      Retry scrape
    </button>
  )
}
