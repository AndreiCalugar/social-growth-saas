"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { RefreshCw, Trash2, Loader2 } from "lucide-react"

interface Props {
  profileId: string
  username: string
}

export function ProfileCardActions({ profileId, username }: Props) {
  const [scrapeState, setScrapeState] = useState<"idle" | "loading" | "polling">("idle")
  const [deleteState, setDeleteState] = useState<"idle" | "confirm" | "loading">("idle")
  const router = useRouter()

  async function handleRescrape(e: React.MouseEvent) {
    e.preventDefault()
    setScrapeState("loading")
    try {
      await fetch(`${process.env.NEXT_PUBLIC_N8N_BASE_URL}/webhook/scrape-instagram`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      })
      setScrapeState("polling")
      pollStatus()
    } catch {
      setScrapeState("idle")
    }
  }

  function pollStatus() {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/scrape-status/${profileId}`)
        const data = await res.json()
        if (data.status === "completed" || data.status === "failed") {
          clearInterval(interval)
          setScrapeState("idle")
          router.refresh()
        }
      } catch { /* ignore */ }
    }, 10_000)
    setTimeout(() => { clearInterval(interval); setScrapeState("idle") }, 300_000)
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
        disabled={scrapeState !== "idle"}
        className="text-muted-foreground hover:text-primary disabled:opacity-40"
        title="Rescrape"
      >
        {scrapeState === "idle" ? (
          <RefreshCw className="h-3.5 w-3.5" />
        ) : (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
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
