"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { RefreshCw, Loader2 } from "lucide-react"

interface Props {
  profileId: string
  username: string
}

export function RetryScrapeButton({ profileId, username }: Props) {
  const [state, setState] = useState<"idle" | "loading" | "polling">("idle")
  const router = useRouter()

  async function handleRetry(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setState("loading")
    try {
      await fetch(`${process.env.NEXT_PUBLIC_N8N_BASE_URL}/webhook/scrape-instagram`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      })
      setState("polling")
      pollStatus()
    } catch {
      setState("idle")
    }
  }

  function pollStatus() {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/scrape-status/${profileId}`)
        const data = await res.json()
        if (data.status === "completed") {
          clearInterval(interval)
          setState("idle")
          router.refresh()
        } else if (data.status === "failed") {
          clearInterval(interval)
          setState("idle")
          router.refresh()
        }
      } catch {
        // ignore transient errors
      }
    }, 10_000)

    // Stop polling after 5 minutes max
    setTimeout(() => {
      clearInterval(interval)
      setState("idle")
    }, 300_000)
  }

  if (state === "polling") {
    return (
      <span className="text-xs flex items-center gap-1 text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Scraping… ~2 min
      </span>
    )
  }

  return (
    <button
      onClick={(e) => handleRetry(e)}
      disabled={state === "loading"}
      className="text-xs flex items-center gap-1 text-amber-600 hover:text-amber-700 disabled:opacity-50"
    >
      {state === "loading" ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <RefreshCw className="h-3 w-3" />
      )}
      Retry scrape
    </button>
  )
}
