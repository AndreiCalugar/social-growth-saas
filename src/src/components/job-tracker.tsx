"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { useRouter } from "next/navigation"

export type JobKind = "scrape" | "analysis" | "insights"
export type JobStatus = "running" | "done" | "error"

export type Job = {
  id: string
  kind: JobKind
  label: string
  status: JobStatus
  startedAt: number
  finishedAt?: number
  errorMessage?: string
  profileId?: string
  ownProfileId?: string
  cursor?: string
}

type JobTrackerValue = {
  jobs: Job[]
  getJob: (id: string) => Job | undefined
  startScrape: (args: { username: string; profileId?: string }) => void
  startAnalysis: (args: { profileId: string; username: string }) => void
  startInsights: (args: { ownProfileId: string; cursor: string }) => void
  // End a running job imperatively (e.g. when the originating webhook has
  // returned a definitive success / empty / error response that the tracker's
  // polling can't discover — an empty-result insights run leaves no fresh
  // DB row for polling to latch onto).
  finishJob: (id: string, opts?: { success?: boolean; errorMessage?: string }) => void
  dismissJob: (id: string) => void
}

const JobTrackerContext = createContext<JobTrackerValue | null>(null)

const STORAGE_KEY = "sg:job-tracker:v1"
const MAX_AGE_MS = 15 * 60 * 1000
const POLL_MS = 4000
const AUTO_DISMISS_MS = 5000

// Per-kind timeouts. Real-world observed durations under normal load:
//   scrape    — Apify Instagram scraper: 85–120s. 180s gives 50% buffer.
//   analysis  — single-profile Claude Sonnet call: 15–60s. 180s is plenty.
//   insights  — cross-competitor analysis = large prompt + Claude Sonnet
//               + multiple DB inserts. Routinely 120–180s with 5+
//               competitors; 240s prevents the common false-positive.
const SCRAPE_TIMEOUT_MS = 180_000
const ANALYSIS_TIMEOUT_MS = 180_000
const INSIGHTS_TIMEOUT_MS = 240_000

function loadJobs(): Record<string, Job> {
  if (typeof window === "undefined") return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, Job>
    const now = Date.now()
    const out: Record<string, Job> = {}
    for (const [id, j] of Object.entries(parsed)) {
      if (now - j.startedAt > MAX_AGE_MS) continue
      out[id] = j
    }
    return out
  } catch {
    return {}
  }
}

function saveJobs(jobs: Record<string, Job>) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs))
  } catch {}
}

export function JobTrackerProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const routerRef = useRef(router)
  routerRef.current = router
  const [jobs, setJobs] = useState<Record<string, Job>>({})
  const jobsRef = useRef(jobs)
  jobsRef.current = jobs

  // Hydrate from localStorage on mount
  useEffect(() => {
    setJobs(loadJobs())
  }, [])

  // Persist on change
  useEffect(() => {
    saveJobs(jobs)
  }, [jobs])

  const dismissJob = useCallback((id: string) => {
    setJobs((prev) => {
      if (!(id in prev)) return prev
      const next = { ...prev }
      delete next[id]
      return next
    })
  }, [])

  const markJobDone = useCallback((id: string) => {
    setJobs((prev) => {
      const existing = prev[id]
      if (!existing || existing.status === "done") return prev
      return { ...prev, [id]: { ...existing, status: "done", finishedAt: Date.now() } }
    })
    routerRef.current.refresh()
    setTimeout(() => dismissJob(id), AUTO_DISMISS_MS)
  }, [dismissJob])

  const markJobError = useCallback((id: string, message: string) => {
    setJobs((prev) => {
      const existing = prev[id]
      if (!existing || existing.status === "error") return prev
      return { ...prev, [id]: { ...existing, status: "error", finishedAt: Date.now(), errorMessage: message } }
    })
    routerRef.current.refresh()
    setTimeout(() => dismissJob(id), AUTO_DISMISS_MS * 2)
  }, [dismissJob])

  const finishJob = useCallback<JobTrackerValue["finishJob"]>((id, opts) => {
    if (opts?.success === false) {
      markJobError(id, opts.errorMessage ?? "Failed")
    } else {
      markJobDone(id)
    }
  }, [markJobDone, markJobError])

  // Poll running jobs
  useEffect(() => {
    // Alias the stable callbacks for concise use in checkJob.
    const markDone = markJobDone
    const markError = markJobError

    const interval = setInterval(async () => {
      const current = jobsRef.current
      const running = Object.values(current).filter((j) => j.status === "running")
      if (running.length === 0) return

      await Promise.all(running.map(checkJob))
    }, POLL_MS)

    async function checkJob(job: Job) {
      try {
        if (job.kind === "scrape" && job.profileId) {
          const res = await fetch(`/api/scrape-status/${job.profileId}`)
          if (!res.ok) return
          const data: { status: string; completed_at?: string | null } = await res.json()
          // The /api/scrape-status endpoint returns the most recent scrape_run
          // row. n8n only inserts a row at the END of its workflow, so while a
          // scrape is in flight the latest row is the PREVIOUS completed run —
          // we'd immediately mark the new job done against a stale timestamp.
          // Guard by requiring completed_at to be newer than when we started
          // watching this job (with 3s tolerance for clock skew).
          if (data.status === "completed" && data.completed_at) {
            const completedMs = new Date(data.completed_at).getTime()
            if (completedMs >= job.startedAt - 3000) {
              markDone(job.id)
            } else if (Date.now() - job.startedAt > SCRAPE_TIMEOUT_MS) {
              // No fresh completed_at row by the deadline → assume the n8n
              // workflow died silently. Surface it so the user isn't stuck.
              markError(job.id, "Scrape is taking longer than expected — check the n8n execution log, and refresh in a minute (the workflow may still finish).")
            }
          } else if (data.status === "failed") {
            markError(job.id, "Scrape failed — Instagram may have rate-limited. Try again later.")
          }
        } else if (job.kind === "analysis" && job.profileId) {
          const res = await fetch(`/api/analysis-status/${job.profileId}`)
          if (!res.ok) return
          const data: { latest: string | null } = await res.json()
          if (data.latest && (!job.cursor || data.latest > job.cursor)) {
            markDone(job.id)
          } else if (Date.now() - job.startedAt > ANALYSIS_TIMEOUT_MS) {
            markError(job.id, "Analysis is taking longer than expected — check the n8n execution log, and refresh in a minute.")
          }
        } else if (job.kind === "insights" && job.ownProfileId) {
          const res = await fetch(`/api/insights?profile_id=${job.ownProfileId}`)
          if (!res.ok) return
          const data: { insights?: Array<{ created_at: string }> } = await res.json()
          const latest = data.insights?.[0]?.created_at
          if (latest && (!job.cursor || latest > job.cursor)) {
            markDone(job.id)
          } else if (Date.now() - job.startedAt > INSIGHTS_TIMEOUT_MS) {
            markError(job.id, "Insights is taking longer than expected — check the n8n execution log, and refresh in a minute (the workflow may still finish).")
          }
        }
      } catch {
        // transient error — keep polling
      }
    }

    return () => clearInterval(interval)
  }, [markJobDone, markJobError])

  const startScrape = useCallback<JobTrackerValue["startScrape"]>(({ username, profileId }) => {
    const id = `scrape-${username}`
    setJobs((prev) => ({
      ...prev,
      [id]: {
        id,
        kind: "scrape",
        label: `Scraping @${username}`,
        status: "running",
        startedAt: Date.now(),
        profileId,
      },
    }))
  }, [])

  const startAnalysis = useCallback<JobTrackerValue["startAnalysis"]>(({ profileId, username }) => {
    const id = `analysis-${profileId}`
    const nowIso = new Date().toISOString()
    setJobs((prev) => ({
      ...prev,
      [id]: {
        id,
        kind: "analysis",
        label: `Analyzing @${username}`,
        status: "running",
        startedAt: Date.now(),
        profileId,
        cursor: nowIso,
      },
    }))
  }, [])

  const startInsights = useCallback<JobTrackerValue["startInsights"]>(({ ownProfileId, cursor }) => {
    const id = `insights-${ownProfileId}`
    setJobs((prev) => ({
      ...prev,
      [id]: {
        id,
        kind: "insights",
        label: "Generating insights",
        status: "running",
        startedAt: Date.now(),
        ownProfileId,
        cursor,
      },
    }))
  }, [])

  const getJob = useCallback((id: string) => jobs[id], [jobs])

  const value = useMemo<JobTrackerValue>(
    () => ({
      jobs: Object.values(jobs).sort((a, b) => b.startedAt - a.startedAt),
      getJob,
      startScrape,
      startAnalysis,
      startInsights,
      finishJob,
      dismissJob,
    }),
    [jobs, getJob, startScrape, startAnalysis, startInsights, finishJob, dismissJob]
  )

  return <JobTrackerContext.Provider value={value}>{children}</JobTrackerContext.Provider>
}

export function useJobTracker(): JobTrackerValue {
  const ctx = useContext(JobTrackerContext)
  if (!ctx) throw new Error("useJobTracker must be used inside JobTrackerProvider")
  return ctx
}

// Helper: rotating message sets for each job kind
export const ROTATING_MESSAGES: Record<JobKind, string[]> = {
  scrape: [
    "Connecting to Instagram…",
    "Scraping posts…",
    "Processing data…",
    "Almost done…",
  ],
  analysis: [
    "Analyzing your posts…",
    "Identifying patterns…",
    "Generating recommendations…",
  ],
  insights: [
    "Analyzing posts across your competitors…",
    "Detecting trends…",
    "Building your content briefs…",
  ],
}

export const ESTIMATED_DURATION: Record<JobKind, string> = {
  scrape: "1–2 minutes",
  analysis: "about 30 seconds",
  insights: "30–60 seconds",
}

export function useRotatingMessage(kind: JobKind, running: boolean): string {
  const messages = ROTATING_MESSAGES[kind]
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    if (!running) {
      setIdx(0)
      return
    }
    const interval = setInterval(() => {
      setIdx((i) => (i + 1) % messages.length)
    }, 5000)
    return () => clearInterval(interval)
  }, [running, messages.length])

  return messages[idx]
}
