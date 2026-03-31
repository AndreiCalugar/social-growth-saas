"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { UserPlus, Loader2 } from "lucide-react"

export function AddCompetitorForm() {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle")
  const [message, setMessage] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
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
        setMessage(`@${data.profile.username} added — scrape queued (~2 min)`)
        setState("idle")
        router.refresh()
      } else {
        throw new Error(data.error ?? "Unknown error")
      }
    } catch (e: unknown) {
      setState("error")
      setMessage(e instanceof Error ? e.message : "Unknown error")
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
        <input
          ref={inputRef}
          type="text"
          placeholder="username"
          disabled={state === "loading"}
          className="h-9 w-56 rounded-md border border-input bg-background pl-7 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
        />
      </div>
      <Button type="submit" size="sm" disabled={state === "loading"}>
        {state === "loading" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <UserPlus className="h-4 w-4" />
        )}
        {state === "loading" ? "Adding…" : "Add Competitor"}
      </Button>
      {message && (
        <span className={`text-xs ${state === "error" ? "text-destructive" : "text-muted-foreground"}`}>
          {message}
        </span>
      )}
    </form>
  )
}
