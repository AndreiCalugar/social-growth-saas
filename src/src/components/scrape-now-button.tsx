"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { RefreshCw, Loader2, CheckCircle2 } from "lucide-react"

interface Props {
  username: string
}

export function ScrapeNowButton({ username }: Props) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle")
  const [message, setMessage] = useState("")

  async function handleClick() {
    setState("loading")
    setMessage("")
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_N8N_BASE_URL}/webhook/scrape-instagram`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      })
      if (res.ok) {
        setState("done")
        setMessage("Scrape queued — data will update in ~2 min")
        setTimeout(() => setState("idle"), 6000)
      } else {
        throw new Error(`HTTP ${res.status}`)
      }
    } catch (e: unknown) {
      setState("error")
      setMessage(e instanceof Error ? e.message : "Unknown error")
      setTimeout(() => setState("idle"), 5000)
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Button onClick={handleClick} disabled={state === "loading"} size="sm" variant="outline">
        {state === "loading" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : state === "done" ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : (
          <RefreshCw className="h-4 w-4" />
        )}
        {state === "loading" ? "Scraping…" : state === "done" ? "Queued!" : "Scrape Now"}
      </Button>
      {message && (
        <span className={`text-xs ${state === "error" ? "text-destructive" : "text-muted-foreground"}`}>
          {message}
        </span>
      )}
    </div>
  )
}
