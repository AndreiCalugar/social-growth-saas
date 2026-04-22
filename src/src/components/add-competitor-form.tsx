"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { UserPlus, Loader2 } from "lucide-react"

export function AddCompetitorForm() {
  const [state, setState] = useState<"idle" | "loading" | "polling" | "error">("idle")
  const [message, setMessage] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  function startPolling(profileId: string) {
    setState("polling")
    setMessage("Scraping in background… ~2 min")

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

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap">
      <div className="relative w-full sm:w-56">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
        <input
          ref={inputRef}
          type="text"
          placeholder="username"
          disabled={state === "loading" || state === "polling"}
          className="h-9 w-full rounded-md border border-input bg-background pl-7 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
        />
      </div>
      <Button
        type="submit"
        size="sm"
        disabled={state === "loading" || state === "polling"}
        className="w-full sm:w-auto"
      >
        {state === "loading" || state === "polling" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <UserPlus className="h-4 w-4" />
        )}
        {state === "loading" ? "Adding…" : state === "polling" ? "Scraping…" : "Add Competitor"}
      </Button>
      {message && (
        <span className={`text-xs ${state === "error" ? "text-destructive" : "text-muted-foreground"}`}>
          {message}
        </span>
      )}
    </form>
  )
}
