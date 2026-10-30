"use client"

import { useState } from "react"
import { signOut } from "next-auth/react"
import { Loader2 } from "lucide-react"

const CONFIRM_WORD = "DELETE"

export function DeleteAccountButton() {
  const [state, setState] = useState<"idle" | "confirm" | "loading">("idle")
  const [typed, setTyped] = useState("")
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    setState("loading")
    setError(null)
    const res = await fetch("/api/account", { method: "DELETE" })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? "Something went wrong. Please try again.")
      setState("confirm")
      return
    }
    await signOut({ callbackUrl: "/login" })
  }

  if (state === "idle") {
    return (
      <button
        type="button"
        onClick={() => setState("confirm")}
        className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3.5 py-2 text-xs font-semibold text-red-700 shadow-sm hover:bg-red-50 transition-colors"
      >
        Delete account
      </button>
    )
  }

  return (
    <div className="mt-4 space-y-3">
      <label className="block text-xs text-red-800">
        Type <span className="font-mono font-semibold">{CONFIRM_WORD}</span> to confirm
        <input
          type="text"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          disabled={state === "loading"}
          autoFocus
          className="mt-1.5 block w-full max-w-xs rounded-lg border border-red-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-200"
        />
      </label>
      {error && <p className="text-xs text-red-700">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleDelete}
          disabled={typed !== CONFIRM_WORD || state === "loading"}
          className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-red-700 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        >
          {state === "loading" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Permanently delete account
        </button>
        <button
          type="button"
          onClick={() => { setState("idle"); setTyped(""); setError(null) }}
          disabled={state === "loading"}
          className="rounded-lg px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
