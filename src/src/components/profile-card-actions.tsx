"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { RefreshCw, Trash2, Loader2 } from "lucide-react"
import { useJobTracker } from "@/components/job-tracker"

interface Props {
  profileId: string
  username: string
}

export function ProfileCardActions({ profileId, username }: Props) {
  const router = useRouter()
  const { jobs, startScrape } = useJobTracker()
  const job = jobs.find((j) => j.id === `scrape-${username}`)
  const scraping = job?.status === "running"
  const lastStatusRef = useRef<string | undefined>(undefined)

  const [deleteState, setDeleteState] = useState<"idle" | "confirm" | "loading">("idle")

  useEffect(() => {
    if (lastStatusRef.current === "running" && job?.status === "done") {
      router.refresh()
    }
    lastStatusRef.current = job?.status
  }, [job?.status, router])

  async function handleRescrape(e: React.MouseEvent) {
    e.preventDefault()
    if (scraping) return
    startScrape({ username, profileId })
    try {
      await fetch(`${process.env.NEXT_PUBLIC_N8N_URL}/webhook/scrape-instagram`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      })
    } catch {
      // tracker handles timeout
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

  return (
    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.preventDefault()}>
      <button
        onClick={handleRescrape}
        disabled={scraping}
        className="text-muted-foreground hover:text-primary disabled:opacity-40"
        title="Rescrape"
      >
        {scraping ? (
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
