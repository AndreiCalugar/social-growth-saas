"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Info } from "lucide-react"

// Renders the "2.6×" multiplier pill plus an Info icon that opens an
// explainer tooltip. The tooltip is portaled to document.body and uses
// position:fixed so it can escape overflow-hidden ancestors (the trend
// cards on /insights collapse with their own overflow-hidden, which
// would otherwise clip the popover).
//
// Used on /insights cards, /briefs list rows, and the /briefs/[id]
// workshop header so the affordance is consistent everywhere a
// multiplier shows up.

const POPOVER_WIDTH = 256 // matches w-64

export function MultiplierBadge({
  multiplier,
  size = "md",
}: {
  multiplier: number
  size?: "sm" | "md"
}) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const [mounted, setMounted] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  // createPortal needs document.body, which doesn't exist during SSR.
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open || !triggerRef.current) return
    function place() {
      const rect = triggerRef.current!.getBoundingClientRect()
      const margin = 8
      // Right-align the popover with the icon's right edge, then clamp into
      // the viewport so it never spills off-screen on narrow cards.
      const desiredLeft = rect.right - POPOVER_WIDTH
      const left = Math.max(margin, Math.min(desiredLeft, window.innerWidth - POPOVER_WIDTH - margin))
      const top = rect.bottom + 8
      setPosition({ top, left })
    }
    place()
    // Reposition on scroll/resize so the popover tracks the trigger while
    // it's open. `true` on scroll attaches in capture phase to catch
    // scrolls in any ancestor.
    window.addEventListener("scroll", place, true)
    window.addEventListener("resize", place)
    return () => {
      window.removeEventListener("scroll", place, true)
      window.removeEventListener("resize", place)
    }
  }, [open])

  const badgeSize = size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-3 py-1.5 text-sm"
  const xSize = size === "sm" ? "text-[9px]" : "text-[11px]"
  const iconSize = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"

  return (
    <span className="shrink-0 inline-flex items-center gap-1">
      <span
        className={`inline-flex items-baseline gap-0.5 rounded-full bg-slate-900 font-bold text-white tabular-nums shadow-sm ${badgeSize}`}
      >
        {multiplier.toFixed(1)}
        <span className={`${xSize} font-semibold text-slate-300`}>×</span>
      </span>
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        aria-label="What does this multiplier mean?"
        aria-expanded={open}
        className="text-slate-300 hover:text-slate-500 transition-colors"
      >
        <Info className={iconSize} />
      </button>
      {mounted && open && position &&
        createPortal(
          <span
            role="tooltip"
            style={{
              position: "fixed",
              top: position.top,
              left: position.left,
              width: POPOVER_WIDTH,
            }}
            className="z-50 rounded-lg border border-slate-200 bg-white p-3 text-left shadow-lg pointer-events-none"
          >
            <span className="block text-[10px] font-bold uppercase tracking-wider text-purple-700 mb-1">
              What does {multiplier.toFixed(1)}× mean?
            </span>
            <span className="block text-xs text-slate-600 leading-relaxed">
              Posts following this pattern get on average{" "}
              <span className="font-semibold text-slate-900">{multiplier.toFixed(1)}×</span> the
              engagement of an average post on the same competitor&apos;s account. The pattern was
              validated across at least 2 of your tracked competitors before it shows up here.
            </span>
          </span>,
          document.body
        )}
    </span>
  )
}
