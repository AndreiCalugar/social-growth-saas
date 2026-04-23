"use client"

import { signOut } from "next-auth/react"
import { LogOut } from "lucide-react"

export function LogOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition-colors shadow-sm"
    >
      <LogOut className="h-4 w-4" />
      Log out
    </button>
  )
}
