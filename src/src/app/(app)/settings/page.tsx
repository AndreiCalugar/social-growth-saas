"use client"

import { useEffect, useState } from "react"

type Profile = {
  id: string
  username: string
  followers: number
  is_own: boolean
}

export default function SettingsPage() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [selectedId, setSelectedId] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [switching, setSwitching] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/profiles")
      .then((r) => r.json())
      .then(({ profiles: data }) => {
        if (data) {
          setProfiles(data)
          const own = data.find((p: Profile) => p.is_own)
          if (own) setSelectedId(own.id)
        }
        setLoading(false)
      })
  }, [])

  async function handleSwitch() {
    if (!selectedId) return
    setSwitching(true)
    const res = await fetch("/api/switch-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile_id: selectedId }),
    })
    const json = await res.json()
    setSwitching(false)

    if (res.ok) {
      setProfiles((prev) =>
        prev.map((p) => ({ ...p, is_own: p.id === selectedId }))
      )
      setToast(`Switched to @${json.profile.username}`)
      setTimeout(() => setToast(null), 3000)
    } else {
      setToast(`Error: ${json.error}`)
      setTimeout(() => setToast(null), 4000)
    }
  }

  const currentOwn = profiles.find((p) => p.is_own)

  return (
    <div className="p-6 max-w-xl">
      <h1 className="text-xl font-bold text-slate-900 mb-1">Settings</h1>
      <p className="text-slate-500 text-sm mb-8">Configure your workspace</p>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-slate-900 mb-1">Current Profile</h2>
        <p className="text-sm text-slate-500 mb-4">
          Switch which account is treated as &ldquo;your&rdquo; profile across all pages.
        </p>

        {loading ? (
          <div className="h-9 w-full animate-pulse rounded-lg bg-slate-100" />
        ) : (
          <div className="flex gap-3">
            <select
              className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  @{p.username}
                  {p.followers ? ` — ${p.followers.toLocaleString()} followers` : ""}
                  {p.is_own ? " (current)" : ""}
                </option>
              ))}
            </select>
            <button
              onClick={handleSwitch}
              disabled={switching || selectedId === currentOwn?.id}
              className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 hover:bg-purple-700 transition-colors shadow-sm"
            >
              {switching ? "Switching…" : "Switch"}
            </button>
          </div>
        )}

        {currentOwn && (
          <p className="mt-3 text-xs text-slate-500">
            Active: <span className="font-medium text-slate-900">@{currentOwn.username}</span>
          </p>
        )}
      </section>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}
