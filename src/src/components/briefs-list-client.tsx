"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ClipboardList,
  Sparkles,
  ArrowRight,
  Calendar,
  Trash2,
  Pencil,
  Loader2,
  AlertCircle,
  CalendarDays,
  CalendarOff,
  X,
} from "lucide-react"
import {
  STATUS_OPTIONS,
  STATUS_SORT_ORDER,
  StatusPillCycle,
  statusSortKey,
  type BriefStatus,
} from "@/components/status-pill"
import type { SavedBrief } from "@/components/brief-workshop"

type FilterValue = "all" | BriefStatus

const FILTER_ORDER: FilterValue[] = ["all", "saved", "planning", "filming", "filmed", "posted"]
const ACTIVE_STATUSES: BriefStatus[] = ["planning", "filming"]

function formatScheduledDate(date: string | null, time: string | null): string | null {
  if (!date) return null
  // date is YYYY-MM-DD; building a Date directly treats it as UTC, which can
  // shift the day. Pin to local midnight so "May 1" stays "May 1".
  const [y, m, d] = date.split("-").map(Number)
  if (!y || !m || !d) return null
  const dt = new Date(y, m - 1, d)
  const dayPart = dt.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  })
  if (!time) return dayPart
  // time is HH:MM in 24h; render in 12h with AM/PM.
  const [hh, mm] = time.split(":").map(Number)
  if (Number.isNaN(hh)) return dayPart
  const period = hh >= 12 ? "PM" : "AM"
  const h12 = ((hh + 11) % 12) + 1
  const minPart = Number.isNaN(mm) || mm === 0 ? "" : `:${String(mm).padStart(2, "0")}`
  return `${dayPart} at ${h12}${minPart} ${period}`
}

function startOfMonthIso(): string {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
}

function truncate(s: string, max: number) {
  if (s.length <= max) return s
  return s.slice(0, max - 1).trimEnd() + "…"
}

export function BriefsListClient({
  initialBriefs,
  tableMissing,
}: {
  initialBriefs: SavedBrief[]
  tableMissing: boolean
}) {
  const [briefs, setBriefs] = useState<SavedBrief[]>(initialBriefs)
  // Default filter hides "Posted" — they're done — unless the user only has
  // posted briefs, in which case we show All so the page isn't deceptively empty.
  const onlyPosted =
    initialBriefs.length > 0 && initialBriefs.every((b) => b.status === "posted")
  const [filter, setFilter] = useState<FilterValue>(onlyPosted ? "all" : "all")
  const [hidePosted, setHidePosted] = useState<boolean>(!onlyPosted)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const counts = useMemo(() => {
    const c: Record<FilterValue, number> = {
      all: briefs.length,
      saved: 0,
      planning: 0,
      filming: 0,
      filmed: 0,
      posted: 0,
    }
    for (const b of briefs) c[b.status]++
    return c
  }, [briefs])

  const visible = useMemo(() => {
    let list = briefs
    if (filter !== "all") {
      list = list.filter((b) => b.status === filter)
    } else if (hidePosted) {
      list = list.filter((b) => b.status !== "posted")
    }
    return [...list].sort((a, b) => {
      const sa = statusSortKey(a.status)
      const sb = statusSortKey(b.status)
      if (sa !== sb) return sa - sb
      const da = a.scheduled_date ?? "9999-99-99"
      const db = b.scheduled_date ?? "9999-99-99"
      if (da !== db) return da < db ? -1 : 1
      return a.created_at < b.created_at ? 1 : -1
    })
  }, [briefs, filter, hidePosted])

  const postedThisMonth = useMemo(() => {
    const since = startOfMonthIso()
    return briefs.filter((b) => b.status === "posted" && b.updated_at >= since).length
  }, [briefs])

  async function patchBrief(id: string, patch: Partial<SavedBrief>) {
    setBusyId(id)
    setErrorMsg(null)
    try {
      const res = await fetch(`/api/briefs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      })
      const json = await res.json()
      if (!res.ok || !json.brief) {
        throw new Error(json.error ?? `Save failed (${res.status})`)
      }
      setBriefs((list) => list.map((b) => (b.id === id ? json.brief : b)))
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Save failed")
    } finally {
      setBusyId(null)
    }
  }

  async function deleteBrief(id: string) {
    setBusyId(id)
    setErrorMsg(null)
    try {
      const res = await fetch(`/api/briefs/${id}`, { method: "DELETE" })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? `Delete failed (${res.status})`)
      }
      setBriefs((list) => list.filter((b) => b.id !== id))
      setConfirmDeleteId(null)
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Delete failed")
    } finally {
      setBusyId(null)
    }
  }

  if (briefs.length === 0) {
    return <BriefsEmptyState tableMissing={tableMissing} />
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center shadow-sm">
              <ClipboardList className="h-4 w-4 text-white" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">My Briefs</h1>
          </div>
          <p className="text-sm text-slate-500">
            Your content plan — saved, customized, and ready to film.
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        {FILTER_ORDER.map((f) => {
          const isActive = filter === f
          const opt = f === "all" ? null : STATUS_OPTIONS.find((o) => o.value === f)!
          const cls = isActive
            ? f === "all"
              ? "bg-slate-900 text-white shadow-sm"
              : opt!.active
            : f === "all"
            ? "border border-slate-300 text-slate-700 bg-white hover:bg-slate-50"
            : opt!.inactive
          return (
            <button
              key={f}
              onClick={() => {
                setFilter(f)
                if (f === "all") setHidePosted(true)
              }}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-all ${cls}`}
            >
              {f === "all" ? "All" : opt!.label}
              <span
                className={`tabular-nums text-[11px] rounded-full px-1.5 py-0.5 leading-none ${
                  isActive ? "bg-white/20" : "bg-slate-100 text-slate-600"
                }`}
              >
                {counts[f]}
              </span>
            </button>
          )
        })}
        {filter === "all" && counts.posted > 0 && (
          <button
            onClick={() => setHidePosted((v) => !v)}
            className="ml-1 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900"
          >
            {hidePosted ? (
              <>
                Show {counts.posted} posted
              </>
            ) : (
              <>
                <X className="h-3 w-3" /> Hide posted
              </>
            )}
          </button>
        )}
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{errorMsg}</p>
        </div>
      )}

      {/* List */}
      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          No briefs match this filter.
        </div>
      ) : (
        <div className="space-y-2.5">
          {visible.map((b) => (
            <BriefRow
              key={b.id}
              brief={b}
              busy={busyId === b.id}
              confirmingDelete={confirmDeleteId === b.id}
              onCycleStatus={(next) => patchBrief(b.id, { status: next })}
              onScheduleDate={(date) => patchBrief(b.id, { scheduled_date: date })}
              onAskDelete={() => setConfirmDeleteId(b.id)}
              onCancelDelete={() => setConfirmDeleteId(null)}
              onConfirmDelete={() => deleteBrief(b.id)}
            />
          ))}
        </div>
      )}

      {/* Footer stats */}
      <div className="rounded-xl border border-slate-200/60 bg-white px-4 py-3 text-xs text-slate-500 flex flex-wrap gap-x-3 gap-y-1">
        <span>
          <span className="font-semibold text-slate-900 tabular-nums">{counts.all}</span> brief{counts.all === 1 ? "" : "s"} saved
        </span>
        <span aria-hidden>·</span>
        <span>
          <span className="font-semibold text-amber-600 tabular-nums">{counts.filming}</span> filming
        </span>
        <span aria-hidden>·</span>
        <span>
          <span className="font-semibold text-emerald-600 tabular-nums">{postedThisMonth}</span> posted this month
        </span>
      </div>
    </div>
  )
}

function BriefRow({
  brief,
  busy,
  confirmingDelete,
  onCycleStatus,
  onScheduleDate,
  onAskDelete,
  onCancelDelete,
  onConfirmDelete,
}: {
  brief: SavedBrief
  busy: boolean
  confirmingDelete: boolean
  onCycleStatus: (next: BriefStatus) => void
  onScheduleDate: (date: string | null) => void
  onAskDelete: () => void
  onCancelDelete: () => void
  onConfirmDelete: () => void
}) {
  const router = useRouter()
  const [editingDate, setEditingDate] = useState(false)
  const scheduled = formatScheduledDate(brief.scheduled_date, brief.scheduled_time)
  const preview = brief.chosen_content ?? brief.original_content ?? brief.original_hook ?? ""

  return (
    <div className="rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start gap-4">
        {/* Status pill (cycle on click) */}
        <div className="shrink-0 pt-0.5">
          <StatusPillCycle
            current={brief.status}
            onChange={onCycleStatus}
            disabled={busy}
          />
        </div>

        {/* Body */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-3">
            <Link
              href={`/briefs/${brief.id}`}
              className="text-sm font-semibold text-slate-900 hover:text-purple-700 leading-snug truncate"
            >
              {brief.trend_name}
            </Link>
            {brief.performance_multiplier ? (
              <span className="shrink-0 inline-flex items-baseline gap-0.5 rounded-full bg-slate-900 px-2 py-0.5 text-[11px] font-bold text-white tabular-nums">
                {brief.performance_multiplier.toFixed(1)}
                <span className="text-[9px] font-semibold text-slate-300">×</span>
              </span>
            ) : null}
          </div>
          {preview && (
            <p className="text-xs text-slate-500 leading-snug mt-1">
              {truncate(preview, 80)}
            </p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px]">
            {editingDate ? (
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                <input
                  type="date"
                  autoFocus
                  defaultValue={brief.scheduled_date ?? ""}
                  onBlur={(e) => {
                    const value = e.target.value || null
                    setEditingDate(false)
                    if (value !== (brief.scheduled_date ?? null)) onScheduleDate(value)
                  }}
                  className="rounded border border-slate-300 px-1.5 py-0.5 text-[11px]"
                />
              </span>
            ) : scheduled ? (
              <button
                type="button"
                onClick={() => setEditingDate(true)}
                className="inline-flex items-center gap-1 font-medium text-emerald-700 hover:text-emerald-800"
                title="Click to edit"
              >
                <CalendarDays className="h-3.5 w-3.5" />
                Scheduled: {scheduled}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setEditingDate(true)}
                className="inline-flex items-center gap-1 font-medium text-slate-400 hover:text-purple-700"
                title="Click to schedule"
              >
                <CalendarOff className="h-3.5 w-3.5" />
                Not scheduled
              </button>
            )}
          </div>
        </div>

        {/* Right-side actions */}
        <div className="shrink-0 flex items-center gap-1">
          {confirmingDelete ? (
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2 py-1">
              <span className="text-[11px] font-medium text-red-700">Delete?</span>
              <button
                onClick={onConfirmDelete}
                disabled={busy}
                className="rounded px-1.5 py-0.5 text-[11px] font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : "Yes"}
              </button>
              <button
                onClick={onCancelDelete}
                disabled={busy}
                className="rounded px-1.5 py-0.5 text-[11px] font-medium text-slate-600 hover:text-slate-900"
              >
                No
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => router.push(`/briefs/${brief.id}`)}
                title="Edit brief"
                aria-label="Edit brief"
                className="rounded-lg p-1.5 text-slate-400 hover:text-purple-700 hover:bg-purple-50"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onAskDelete}
                title="Delete brief"
                aria-label="Delete brief"
                className="rounded-lg p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function BriefsEmptyState({ tableMissing }: { tableMissing: boolean }) {
  const [showHowItWorks, setShowHowItWorks] = useState(false)

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center shadow-sm">
            <ClipboardList className="h-4 w-4 text-white" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">My Briefs</h1>
        </div>
      </div>

      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 sm:p-12 text-center space-y-5">
        <div className="mx-auto h-16 w-16 rounded-2xl bg-gradient-to-br from-purple-100 to-purple-200 flex items-center justify-center">
          <Sparkles className="h-8 w-8 text-purple-600" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900">Your content plan starts here</h2>
          <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto leading-relaxed">
            Generate insights from your competitor data, then save the briefs you want to create.
            Each brief becomes an assignment you can customize, schedule, and track.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 justify-center pt-1">
          <Link
            href="/insights"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-purple-700 transition-colors shadow-sm"
          >
            <Sparkles className="h-4 w-4" />
            Generate Insights
            <ArrowRight className="h-4 w-4" />
          </Link>
          <button
            onClick={() => setShowHowItWorks((v) => !v)}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            How it works
          </button>
        </div>

        {showHowItWorks && (
          <ol className="mx-auto max-w-md text-left text-sm text-slate-700 space-y-2 pt-3 border-t border-slate-100">
            <HowItWorksStep n={1} title="Add competitors" body="Track 3–5 creators in your niche on the Competitors page." />
            <HowItWorksStep n={2} title="Generate insights" body="Cross-competitor trend detection finds the patterns that consistently outperform." />
            <HowItWorksStep n={3} title="Save briefs" body="Click 'Save & Customize' on any trend you want to create — it becomes a brief here." />
            <HowItWorksStep n={4} title="Film & post" body="Customize the hook, schedule the date, and move the status pill from Saved → Posted." />
          </ol>
        )}

        {tableMissing && (
          <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 inline-block">
            <Calendar className="inline h-3 w-3 mr-1" />
            Run <code className="font-mono">schema/007-saved-briefs.sql</code> to enable saved briefs.
          </p>
        )}
      </div>
    </div>
  )
}

function HowItWorksStep({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-purple-100 text-purple-700 text-[10px] font-bold">
        {n}
      </span>
      <span>
        <span className="font-semibold text-slate-900">{title}.</span>{" "}
        <span className="text-slate-600">{body}</span>
      </span>
    </li>
  )
}
