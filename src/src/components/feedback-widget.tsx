"use client"

import { useEffect, useRef, useState } from "react"
import { MessageCircle, X } from "lucide-react"
import { trackEvent } from "@/lib/analytics"

type Rating = "love" | "okay" | "needs_work"
type Status = "idle" | "sending" | "sent" | "error"

const RATING_OPTIONS: Array<{ value: Rating; emoji: string; label: string }> = [
  { value: "love", emoji: "😍", label: "Love it" },
  { value: "okay", emoji: "😐", label: "It's okay" },
  { value: "needs_work", emoji: "😕", label: "Needs work" },
]

export function FeedbackWidget() {
  const [open, setOpen] = useState(false)
  const [rating, setRating] = useState<Rating | null>(null)
  const [message, setMessage] = useState("")
  const [status, setStatus] = useState<Status>("idle")
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function reset() {
    setRating(null)
    setMessage("")
    setStatus("idle")
    setErrorMsg(null)
  }

  function close() {
    setOpen(false)
    // Defer reset so the user briefly sees the closing state without
    // the form contents flickering back to default during the animation.
    setTimeout(reset, 200)
  }

  // Auto-close after the success state. 2s gives the user time to read
  // the thank-you copy without feeling abrupt.
  useEffect(() => {
    if (status !== "sent") return
    const t = setTimeout(close, 2000)
    return () => clearTimeout(t)
  }, [status])

  // Esc closes the modal — basic keyboard accessibility.
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  async function handleSend() {
    if (!rating || status === "sending") return
    setStatus("sending")
    setErrorMsg(null)
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating,
          message: message.trim() || undefined,
          page_url: typeof window !== "undefined" ? window.location.pathname : null,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Request failed (${res.status})`)
      }
      trackEvent("feedback_submitted", { rating })
      setStatus("sent")
    } catch (e) {
      setStatus("error")
      setErrorMsg(e instanceof Error ? e.message : "Couldn't send. Try again?")
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        // z-30 sits below the job-notification toasts at z-50 so transient
        // toasts visually take precedence when both are visible.
        className="fixed bottom-4 right-4 z-30 inline-flex items-center gap-1.5 rounded-full bg-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-lg hover:bg-purple-700 transition-colors"
        aria-label="Open feedback widget"
      >
        <MessageCircle className="h-4 w-4" />
        Feedback
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={close} aria-hidden />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Send feedback"
            className="relative z-10 w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl"
          >
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-base font-bold text-slate-900">
                {status === "sent" ? "Thanks!" : "How's your experience so far?"}
              </h2>
              <button
                onClick={close}
                aria-label="Close feedback"
                className="text-slate-400 hover:text-slate-600 -mt-1 -mr-1 p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {status === "sent" ? (
              <p className="text-sm text-slate-600 leading-relaxed">
                Your feedback helps us improve. This will close in a moment.
              </p>
            ) : (
              <>
                {/* Rating buttons — horizontal row, click to select. */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {RATING_OPTIONS.map((opt) => {
                    const active = rating === opt.value
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          setRating(opt.value)
                          // Focus the textarea so power users can keep
                          // typing without an extra click.
                          textareaRef.current?.focus()
                        }}
                        className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-3 text-xs font-semibold transition-all ${
                          active
                            ? "border-purple-300 bg-purple-50 text-purple-700 shadow-sm"
                            : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                        }`}
                        aria-pressed={active}
                      >
                        <span className="text-2xl leading-none" aria-hidden>
                          {opt.emoji}
                        </span>
                        {opt.label}
                      </button>
                    )
                  })}
                </div>

                <textarea
                  ref={textareaRef}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Tell us more (optional)..."
                  rows={4}
                  maxLength={2000}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-300 resize-none"
                />

                {errorMsg && (
                  <p className="mt-2 text-xs text-red-600">{errorMsg}</p>
                )}

                <div className="mt-4 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={close}
                    className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={!rating || status === "sending"}
                    className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {status === "sending" ? "Sending…" : "Send"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
