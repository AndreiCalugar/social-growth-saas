"use client"

import { Loader2, CheckCircle2, AlertCircle, X } from "lucide-react"
import { useJobTracker, type Job } from "./job-tracker"

export function JobNotification() {
  const { jobs, dismissJob } = useJobTracker()
  const visible = jobs.slice(0, 3)

  if (visible.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {visible.map((job) => (
        <JobPill key={job.id} job={job} onDismiss={() => dismissJob(job.id)} />
      ))}
    </div>
  )
}

function JobPill({ job, onDismiss }: { job: Job; onDismiss: () => void }) {
  const tone = toneFor(job)

  return (
    <div
      className={`pointer-events-auto flex items-center gap-2.5 rounded-full border px-3.5 py-2 shadow-lg backdrop-blur-sm max-w-sm ${tone.container}`}
    >
      <span className={tone.iconWrap}>{tone.icon}</span>
      <div className="min-w-0 flex-1">
        <p className={`text-xs font-semibold truncate ${tone.text}`}>
          {job.status === "done" ? `${job.label} — complete` : job.label}
          {job.status === "running" && "…"}
        </p>
        {job.status === "error" && job.errorMessage && (
          <p className="text-[11px] text-red-600 truncate">{job.errorMessage}</p>
        )}
      </div>
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        className={`shrink-0 rounded-full p-0.5 hover:bg-black/5 ${tone.text}`}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  )
}

function toneFor(job: Job) {
  if (job.status === "done") {
    return {
      container: "bg-emerald-50 border-emerald-200",
      iconWrap: "shrink-0",
      icon: <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
      text: "text-emerald-900",
    }
  }
  if (job.status === "error") {
    return {
      container: "bg-red-50 border-red-200",
      iconWrap: "shrink-0",
      icon: <AlertCircle className="h-4 w-4 text-red-600" />,
      text: "text-red-900",
    }
  }
  return {
    container: "bg-white border-slate-200",
    iconWrap: "shrink-0",
    icon: <Loader2 className="h-4 w-4 text-purple-600 animate-spin" />,
    text: "text-slate-900",
  }
}
