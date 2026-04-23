"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Sparkles, Loader2, CheckCircle2 } from "lucide-react"

interface Props {
  profileId: string
}

export function RunAnalysisButton({ profileId }: Props) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle")
  const [message, setMessage] = useState("")
  const router = useRouter()

  async function handleClick() {
    setState("loading")
    setMessage("")
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_N8N_URL}/webhook/analyze-profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile_id: profileId, analysis_type: "performance" }),
      })
      const data = await res.json()
      if (data.success) {
        setState("done")
        setMessage(`Analysis complete — ${data.recommendations_saved} recommendations saved`)
        setTimeout(() => {
          setState("idle")
          router.refresh()
        }, 2000)
      } else {
        throw new Error(data.message || "Analysis failed")
      }
    } catch (e: unknown) {
      setState("error")
      setMessage(e instanceof Error ? e.message : "Unknown error")
      setTimeout(() => setState("idle"), 5000)
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Button onClick={handleClick} disabled={state === "loading"} size="sm">
        {state === "loading" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : state === "done" ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        {state === "loading" ? "Analysing…" : state === "done" ? "Done!" : "Run Analysis"}
      </Button>
      {message && (
        <span className={`text-xs ${state === "error" ? "text-destructive" : "text-muted-foreground"}`}>
          {message}
        </span>
      )}
    </div>
  )
}
