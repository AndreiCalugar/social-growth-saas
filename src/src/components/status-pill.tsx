"use client"

import { Check } from "lucide-react"

export type BriefStatus = "saved" | "planning" | "filming" | "filmed" | "posted"

interface StatusOption {
  value: BriefStatus
  label: string
  active: string
  inactive: string
  dot: string
}

export const STATUS_OPTIONS: StatusOption[] = [
  {
    value: "saved",
    label: "Saved",
    active: "bg-slate-600 text-white shadow-sm",
    inactive: "border border-slate-300 text-slate-700 bg-white hover:bg-slate-50",
    dot: "bg-slate-500",
  },
  {
    value: "planning",
    label: "Planning",
    active: "bg-blue-500 text-white shadow-sm",
    inactive: "border border-blue-300 text-blue-700 bg-white hover:bg-blue-50",
    dot: "bg-blue-500",
  },
  {
    value: "filming",
    label: "Filming",
    active: "bg-amber-500 text-white shadow-sm",
    inactive: "border border-amber-300 text-amber-700 bg-white hover:bg-amber-50",
    dot: "bg-amber-500",
  },
  {
    value: "filmed",
    label: "Filmed",
    active: "bg-purple-500 text-white shadow-sm",
    inactive: "border border-purple-300 text-purple-700 bg-white hover:bg-purple-50",
    dot: "bg-purple-500",
  },
  {
    value: "posted",
    label: "Posted",
    active: "bg-emerald-500 text-white shadow-sm",
    inactive: "border border-emerald-300 text-emerald-700 bg-white hover:bg-emerald-50",
    dot: "bg-emerald-500",
  },
]

export function getStatusOption(status: BriefStatus): StatusOption {
  return STATUS_OPTIONS.find((o) => o.value === status) ?? STATUS_OPTIONS[0]
}

// Order used both for visual sorting (Planning first, then Filming, then
// Saved, then Filmed, then Posted at bottom) and for the cycle button.
export const STATUS_SORT_ORDER: BriefStatus[] = [
  "planning",
  "filming",
  "saved",
  "filmed",
  "posted",
]

export function statusSortKey(status: BriefStatus): number {
  const idx = STATUS_SORT_ORDER.indexOf(status)
  return idx === -1 ? STATUS_SORT_ORDER.length : idx
}

const PILL_BASE =
  "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"

// Full row of 5 pills — used in the workshop header. The active one is solid;
// the rest are outline with their own colored hover state. Clicking an
// inactive pill calls onChange.
export function StatusPillRow({
  current,
  onChange,
  disabled = false,
}: {
  current: BriefStatus
  onChange: (next: BriefStatus) => void
  disabled?: boolean
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {STATUS_OPTIONS.map((opt) => {
        const isActive = opt.value === current
        return (
          <button
            key={opt.value}
            type="button"
            disabled={disabled || isActive}
            onClick={() => !isActive && onChange(opt.value)}
            title={isActive ? `Status: ${opt.label}` : `Click to mark as ${opt.label}`}
            aria-pressed={isActive}
            className={`${PILL_BASE} ${
              isActive ? `${opt.active} scale-[1.04]` : opt.inactive
            }`}
          >
            {isActive && <Check className="h-3.5 w-3.5" />}
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

// Single pill that cycles to the next status on click. Used inline in the
// /briefs list cards so users can advance a brief without opening it.
export function StatusPillCycle({
  current,
  onChange,
  disabled = false,
}: {
  current: BriefStatus
  onChange: (next: BriefStatus) => void
  disabled?: boolean
}) {
  const opt = getStatusOption(current)
  const idx = STATUS_OPTIONS.findIndex((o) => o.value === current)
  const next = STATUS_OPTIONS[(idx + 1) % STATUS_OPTIONS.length]

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onChange(next.value)
      }}
      title={`Click to mark as ${next.label}`}
      className={`${PILL_BASE} ${opt.active} hover:brightness-110`}
    >
      <Check className="h-3.5 w-3.5" />
      {opt.label}
    </button>
  )
}

// Read-only colored dot for compact list rows where you want a status hint
// without taking a full pill's worth of space.
export function StatusDot({ status }: { status: BriefStatus }) {
  const opt = getStatusOption(status)
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${opt.dot}`} aria-label={opt.label} />
}
