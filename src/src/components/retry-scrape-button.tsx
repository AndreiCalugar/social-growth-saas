"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { RefreshCw, Loader2 } from "lucide-react"
import { useJobTracker } from "@/components/job-tracker"

interface Props {
  profileId: string
  username: string
}

export function RetryScrapeButton({ profileId, username }: Props) {
  const router = useRouter()
  const { jobs, startScrape } = useJobTracker()
  const job = jobs.find((j) => j.id === `scrape-${username}`)
  const running = job?.status === "running"
  const lastStatusRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (lastStatusRef.current === "running" && job?.status === "done") {
      router.refresh()
    }
    lastStatusRef.current = job?.status
  }, [job?.status, router])

  async function handleRetry(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (running) return
    startScrape({ username, profileId })
    try {
      await fetch(`${process.env.NEXT_PUBLIC_N8N_URL}/webhook/scrape-instagram`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      })
    } catch {
      // tracker times out on its own
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

  return (
    <button
      onClick={handleRetry}
      className="text-xs flex items-center gap-1 text-amber-600 hover:text-amber-700"
    >
      <RefreshCw className="h-3 w-3" />
      Retry scrape
    </button>
  )
}
