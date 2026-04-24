"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { UserPlus, Loader2, X } from "lucide-react"

interface AddProfileModalProps {
  defaultIsOwn?: boolean
  triggerLabel?: string
  triggerClassName?: string
  triggerIcon?: React.ReactNode
}

export function AddProfileModal({
  defaultIsOwn = false,
  triggerLabel = "Add Profile",
  triggerClassName,
  triggerIcon,
}: AddProfileModalProps = {}) {
  const [open, setOpen] = useState(false)
  const [isOwn, setIsOwn] = useState(defaultIsOwn)
  const [state, setState] = useState<"idle" | "loading" | "polling" | "error">("idle")
  const [message, setMessage] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  function startPolling(profileId: string) {
    setState("polling")
    setMessage("Scraping in the background — keep working, ready in ~2 min")

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/scrape-status/${profileId}`)
        const data = await res.json()
        if (data.status === "completed") {
          clearInterval(interval)
          setState("idle")
          setMessage("")
          setOpen(false)
          router.refresh()
        } else if (data.status === "failed") {
          clearInterval(interval)
          setState("idle")
          setMessage("Scrape failed — Instagram may have rate-limited. Try again later.")
          router.refresh()
        }
      } catch {
        // ignore transient errors
      }
    }, 10_000)

    setTimeout(() => {
      clearInterval(interval)
      setState("idle")
      setMessage("Still scraping — close and refresh in a minute.")
    }, 300_000)
  }

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    const username = inputRef.current?.value?.trim()
    if (!username) return

    setState("loading")
    setMessage("")

    try {
      const res = await fetch("/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, is_own: isOwn }),
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

  function handleClose() {
    if (state === "loading") return
    setOpen(false)
    setState("idle")
    setMessage("")
  }

  return (
    <>
      {triggerClassName ? (
        <button type="button" onClick={() => setOpen(true)} className={triggerClassName}>
          {triggerIcon ?? <UserPlus className="h-4 w-4" />}
          {triggerLabel}
        </button>
      ) : (
        <Button size="sm" onClick={() => setOpen(true)}>
          {triggerIcon ?? <UserPlus className="h-4 w-4" />}
          {triggerLabel}
        </Button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={handleClose} />
          <div className="relative z-10 w-full max-w-sm rounded-lg border bg-background p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold">Add Instagram Profile</h2>
              <button onClick={handleClose} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Instagram username
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder="username"
                    disabled={state === "loading" || state === "polling"}
                    className="h-9 w-full rounded-md border border-input bg-background pl-7 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Profile type
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsOwn(false)}
                    className={`flex-1 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                      !isOwn
                        ? "border-orange-300 bg-orange-50 text-orange-700"
                        : "border-input text-muted-foreground hover:border-orange-200"
                    }`}
                  >
                    Competitor
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsOwn(true)}
                    className={`flex-1 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                      isOwn
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-input text-muted-foreground hover:border-primary/30"
                    }`}
                  >
                    Own Profile
                  </button>
                </div>
              </div>

              {message && (
                <p className={`text-xs ${state === "error" ? "text-destructive" : "text-muted-foreground"}`}>
                  {message}
                </p>
              )}

              <Button
                type="submit"
                className="w-full"
                size="sm"
                disabled={state === "loading" || state === "polling"}
              >
                {state === "loading" || state === "polling" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus className="h-4 w-4" />
                )}
                {state === "loading" ? "Adding…" : state === "polling" ? "Scraping…" : "Add & Scrape"}
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
