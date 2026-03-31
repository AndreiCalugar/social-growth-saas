"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Trash2, Loader2 } from "lucide-react"

interface Props {
  profileId: string
  username: string
}

export function DeleteCompetitorButton({ profileId, username }: Props) {
  const [state, setState] = useState<"idle" | "confirm" | "loading">("idle")
  const router = useRouter()

  async function handleDelete() {
    setState("loading")
    await fetch(`/api/competitors/${profileId}`, { method: "DELETE" })
    router.refresh()
  }

  if (state === "confirm") {
    return (
      <div className="flex items-center gap-1" onClick={(e) => e.preventDefault()}>
        <span className="text-[10px] text-muted-foreground">Delete @{username}?</span>
        <button
          onClick={handleDelete}
          className="text-[10px] font-medium text-destructive hover:underline"
        >
          Yes
        </button>
        <button
          onClick={() => setState("idle")}
          className="text-[10px] text-muted-foreground hover:underline"
        >
          No
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={(e) => { e.preventDefault(); setState("confirm") }}
      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
      title="Delete competitor"
    >
      {state === "loading" ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Trash2 className="h-3.5 w-3.5" />
      )}
    </button>
  )
}
