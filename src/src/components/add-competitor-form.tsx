"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { UserPlus, Loader2 } from "lucide-react"

export function AddCompetitorForm() {
  const [state, setState] = useState<"idle" | "loading" | "polling" | "error">("idle")
  const [message, setMessage] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  function startPolling(profileId: string) {
    setState("polling")
    setMessage("Feel free to navigate away — profile ready in ~30s")

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/scrape-status/${profileId}`)
        const data = await res.json()
        if (data.status === "completed") {
          clearInterval(interval)
          setState("idle")
          setMessage("")
          router.refresh()
        } else if (data.status === "failed") {
          clearInterval(interval)
          setState("idle")
          setMessage("Scrape failed — Instagram may have rate-limited. Try again later.")
          router.refresh()
        }
      } catch {
        // ignore transient errors, keep polling
      }
    }, 10_000)

    // Stop polling after 5 minutes max
    setTimeout(() => {
      clearInterval(interval)
      if (state === "polling") {
        setState("idle")
        setMessage("Still scraping — refresh the page in a minute.")
      }
    }, 300_000)
  }

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    const username = inputRef.current?.value?.trim()
    if (!username) return

    setState("loading")
    setMessage("")

    try {
      const res = await fetch("/api/competitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      })
      const data = await res.json()

      if (data.success) {
        if (inputRef.current) inputRef.current.value = ""
        router.refresh()
        startPolling(data.profile.id)
      } else {
        throw new Error(data.error ?? "Unknown error")
      }
    } catch (e: unknown) {
      setState("error")
      setMessage(e instanceof Error ? e.message : "Unknown error")
    }
  }

  const isBusy = state === "loading" || state === "polling"
  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap">
      <div className="relative w-full sm:w-60">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none font-medium">@</span>
        <input
          ref={inputRef}
          type="text"
          placeholder="username"
          disabled={isBusy}
          className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all disabled:opacity-50"
        />
      </div>
      <button
        type="submit"
        disabled={isBusy}
        className="h-10 w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 px-4 text-sm font-medium text-white shadow-sm shadow-purple-500/20 disabled:opacity-70 disabled:cursor-not-allowed active:scale-95 transition-all"
      >
        {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
        {state === "loading" ? "Adding…" : state === "polling" ? "Scraping…" : "Add Competitor"}
      </button>
      {message && (
        <span className={`text-xs ${state === "error" ? "text-red-600" : "text-slate-500"}`}>
          {message}
        </span>
      )}
    </form>
  )
}
