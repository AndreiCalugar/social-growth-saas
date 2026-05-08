"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Sparkles, Loader2, Clock } from "lucide-react"
import { useJobTracker, useRotatingMessage, ESTIMATED_DURATION } from "@/components/job-tracker"
import { useCooldownTimer } from "@/lib/use-cooldown-timer"

interface Props {
  profileId: string
  username: string
  /** ISO timestamp of the last analysis row, used to hydrate the cooldown
   *  on mount so a mid-cooldown reload shows the timer immediately. */
  lastAnalysisAt?: string | null
}

const COOLDOWN_MS = 30 * 60 * 1000

export function RunAnalysisButton({ profileId, username, lastAnalysisAt }: Props) {
  const router = useRouter()
  const { jobs, startAnalysis } = useJobTracker()
  const job = jobs.find((j) => j.id === `analysis-${profileId}`)
  const running = job?.status === "running"
  const message = useRotatingMessage("analysis", running)
  const lastStatusRef = useRef<string | undefined>(undefined)

  const [cooldownUntil, setCooldownUntil] = useState<string | null>(() => {
    if (!lastAnalysisAt) return null
    const next = new Date(lastAnalysisAt).getTime() + COOLDOWN_MS
    return next > Date.now() ? new Date(next).toISOString() : null
  })
  const cooldownTimer = useCooldownTimer(cooldownUntil)

  useEffect(() => {
    if (lastStatusRef.current === "running" && job?.status === "done") {
      router.refresh()
    }
    lastStatusRef.current = job?.status
  }, [job?.status, router])

  async function handleClick() {
    if (running || cooldownTimer) return
    let res: Response
    try {
      res = await fetch("/api/analyses/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile_id: profileId, analysis_type: "performance" }),
      })
    } catch {
      // Network failure: optimistically start the tracker — the polling
      // loop catches a fresh row if n8n still ran, otherwise its timeout
      // surfaces the error.
      startAnalysis({ profileId, username })
      return
    }

    if (res.status === 429) {
      const body = (await res.json().catch(() => ({}))) as { nextAvailableAt?: string }
      if (body.nextAvailableAt) setCooldownUntil(body.nextAvailableAt)
      return
    }

    if (!res.ok) return
    setCooldownUntil(null)
    startAnalysis({ profileId, username })
  }

  const disabled = running || !!cooldownTimer

  return (
    <div className="flex flex-col gap-2 w-full sm:w-auto">
      <Button onClick={handleClick} disabled={disabled} size="sm">
        {running ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : cooldownTimer ? (
          <Clock className="h-4 w-4" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        {running
          ? "Analysing…"
          : cooldownTimer
          ? `Available in ${cooldownTimer.label}`
          : "Run Analysis"}
      </Button>
      {running && (
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 flex items-start gap-2.5 w-full sm:w-80">
          <Loader2 className="h-4 w-4 animate-spin text-purple-600 mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-900">{message}</p>
            <p className="text-[11px] text-slate-500">Takes {ESTIMATED_DURATION.analysis}. You can navigate away.</p>
          </div>
        </div>
      )}
      {!running && cooldownTimer && (
        <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2.5 flex items-start gap-2.5 w-full sm:w-80">
          <Clock className="h-4 w-4 text-slate-500 mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-900">
              Next analysis available in {cooldownTimer.label}
            </p>
            <p className="text-[11px] text-slate-500">
              One run per 30 minutes per profile.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
