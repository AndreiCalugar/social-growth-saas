"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { RefreshCw, Trash2, Loader2, Clock, AlertCircle } from "lucide-react"
import { useJobTracker } from "@/components/job-tracker"
import { triggerScrape } from "@/lib/trigger-scrape"
import { formatMinutesUntil } from "@/lib/scrape-cooldown"

interface Props {
  profileId: string
  username: string
}

type Cooldown = { reason: "hard" | "soft"; minutesUntilNext: number }

export function ProfileCardActions({ profileId, username }: Props) {
  const router = useRouter()
  const { jobs, startScrape } = useJobTracker()
  const job = jobs.find((j) => j.id === `scrape-${username}`)
  const scraping = job?.status === "running"
  const lastStatusRef = useRef<string | undefined>(undefined)

  const [deleteState, setDeleteState] = useState<"idle" | "confirm" | "loading">("idle")
  const [submitting, setSubmitting] = useState(false)
  const [cooldown, setCooldown] = useState<Cooldown | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (lastStatusRef.current === "running" && job?.status === "done") {
      router.refresh()
    }
    lastStatusRef.current = job?.status
  }, [job?.status, router])

  async function attempt(force: boolean, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (submitting || scraping) return
    setSubmitting(true)
    setError(null)
    try {
      const result = await triggerScrape(profileId, { force })
      if (result.status === "fired") {
        setCooldown(null)
        startScrape({ username, profileId })
        return
      }
      if (result.status === "cooldown") {
        setCooldown({ reason: result.reason, minutesUntilNext: result.minutesUntilNext })
        setTimeout(() => setCooldown(null), 4000)
        return
      }
      setError(result.message || "Error")
      setTimeout(() => setError(null), 5000)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault()
    setDeleteState("loading")
    await fetch(`/api/profiles/${profileId}`, { method: "DELETE" })
    router.refresh()
  }

  if (deleteState === "confirm") {
    return (
      <div className="flex items-center gap-1" onClick={(e) => e.preventDefault()}>
        <span className="text-[10px] text-muted-foreground">Remove?</span>
        <button onClick={handleDelete} className="text-[10px] font-medium text-destructive hover:underline">
          Yes
        </button>
        <button onClick={(e) => { e.preventDefault(); setDeleteState("idle") }} className="text-[10px] text-muted-foreground hover:underline">
          No
        </button>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center gap-1.5" onClick={(e) => e.preventDefault()} title={error}>
        <AlertCircle className="h-3 w-3 text-red-500" />
        <span className="text-[10px] text-red-600 truncate max-w-[140px]">{error}</span>
      </div>
    )
  }

  if (cooldown) {
    const isForceable = cooldown.reason === "soft"
    return (
      <div className="flex items-center gap-1.5" onClick={(e) => e.preventDefault()}>
        <Clock className="h-3 w-3 text-slate-400" />
        <span className="text-[10px] text-slate-500">
          {cooldown.reason === "hard" ? "Just scraped" : `Fresh · ${formatMinutesUntil(cooldown.minutesUntilNext)}`}
        </span>
        {isForceable && (
          <button
            onClick={(e) => attempt(true, e)}
            disabled={submitting}
            className="text-[10px] font-medium text-purple-600 hover:underline disabled:text-slate-400 disabled:cursor-not-allowed"
          >
            {submitting ? "…" : "Force"}
          </button>
        )}
      </div>
    )
  }

  const rescrapeBusy = submitting || scraping

  return (
    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.preventDefault()}>
      <button
        onClick={(e) => attempt(false, e)}
        disabled={rescrapeBusy}
        className="text-muted-foreground hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed"
        title={submitting ? "Starting…" : scraping ? "Scraping…" : "Rescrape"}
      >
        {rescrapeBusy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <RefreshCw className="h-3.5 w-3.5" />
        )}
      </button>
      <button
        onClick={(e) => { e.preventDefault(); setDeleteState("confirm") }}
        className="text-muted-foreground hover:text-destructive"
        title="Remove profile"
      >
        {deleteState === "loading" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Trash2 className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  )
}
