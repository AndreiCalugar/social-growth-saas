"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Loader2,
  ShieldCheck,
  Users,
} from "lucide-react"
import { cn } from "@/lib/utils"

export interface AdminBetaRow {
  userId: string
  email: string
  name: string | null
  signedUpAt: string
  instagramUsername: string | null
  isProfessional: boolean
  status: "none" | "pending" | "approved"
  requestedAt: string | null
  approvedAt: string | null
  connectedAs: string | null
}

// Meta dashboard page where Instagram Testers are added.
const META_ROLES_URL =
  "https://developers.facebook.com/apps/1407330664831432/roles/roles/"

type Tab = "pending" | "approved" | "none"

export function AdminBetaClient({
  rows,
  migrationMissing,
}: {
  rows: AdminBetaRow[]
  migrationMissing: boolean
}) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>("pending")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const byTab = useMemo(
    () => ({
      pending: rows
        .filter((r) => r.status === "pending")
        .sort((a, b) => (a.requestedAt ?? "").localeCompare(b.requestedAt ?? "")),
      approved: rows.filter((r) => r.status === "approved"),
      none: rows.filter((r) => r.status === "none"),
    }),
    [rows]
  )
  const visible = byTab[tab]

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelected((prev) =>
      visible.every((r) => prev.has(r.userId))
        ? new Set()
        : new Set(visible.map((r) => r.userId))
    )
  }

  async function run(action: "approve" | "revoke" | "reset", ids: string[]) {
    if (ids.length === 0) return
    if (action === "reset") {
      const picked = rows.filter((r) => ids.includes(r.userId))
      const connected = picked.filter((r) => r.connectedAs).map((r) => `@${r.connectedAs}`)
      const ok = window.confirm(
        `Reset ${picked.length} account(s) to the start?\n\n` +
          `• Their beta request is removed — they'll see "Request beta access" again.\n` +
          (connected.length
            ? `• Instagram is disconnected for ${connected.join(", ")}, and their automations and DM history are deleted.\n`
            : "") +
          `\nTheir login account itself stays.`
      )
      if (!ok) return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/beta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: ids, action }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed")
      setSelected(new Set())
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed")
    } finally {
      setBusy(false)
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(text)
      setTimeout(() => setCopied(null), 1500)
    } catch {}
  }

  const selectedHere = visible.filter((r) => selected.has(r.userId)).map((r) => r.userId)

  return (
    <div className="p-4 sm:p-6 max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-purple-600" />
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Beta access</h1>
          </div>
          <p className="text-slate-500 text-sm mt-0.5">
            Add the handle as an Instagram Tester in Meta first, then approve
            here — that shows them the Connect Instagram button.
          </p>
        </div>
        <a
          href={META_ROLES_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300"
        >
          Meta App Roles
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      {migrationMissing && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          The <code>beta_access</code> table doesn&rsquo;t exist yet. Run{" "}
          <code>schema/019-beta-access.sql</code> in the Supabase SQL Editor.
          Until then everyone sees Connect Instagram.
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["pending", "Waiting", Clock],
            ["approved", "Approved", CheckCircle2],
            ["none", "No request", Users],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => {
              setTab(key)
              setSelected(new Set())
            }}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors",
              tab === key
                ? "bg-slate-900 text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
            <span className={cn("tabular-nums", tab === key ? "text-white/70" : "text-slate-400")}>
              {byTab[key].length}
            </span>
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {error}
        </div>
      )}

      {visible.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {tab !== "none" && (
            <button
              onClick={() => run("reset", selectedHere)}
              disabled={busy || selectedHere.length === 0}
              className="order-last inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              Reset to start ({selectedHere.length})
            </button>
          )}
          {tab !== "approved" ? (
            <button
              onClick={() => run("approve", selectedHere)}
              disabled={busy || selectedHere.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-purple-700 disabled:opacity-50"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Approve selected ({selectedHere.length})
            </button>
          ) : (
            <button
              onClick={() => run("revoke", selectedHere)}
              disabled={busy || selectedHere.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-red-300 hover:text-red-600 disabled:opacity-50"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Move back to waiting ({selectedHere.length})
            </button>
          )}
          {tab === "none" && (
            <span className="text-xs text-slate-500">
              Use this for accounts that never requested, like the Meta reviewer&rsquo;s.
            </span>
          )}
        </div>
      )}

      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          {tab === "pending" ? "No one is waiting. 🎉" : "Nothing here."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200/60 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-400">
                <th className="px-4 py-2.5">
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    checked={visible.every((r) => selected.has(r.userId))}
                    onChange={toggleAll}
                    className="h-4 w-4 rounded border-slate-300 text-purple-600"
                  />
                </th>
                <th className="px-4 py-2.5 font-semibold">Instagram</th>
                <th className="px-4 py-2.5 font-semibold">Account</th>
                <th className="px-4 py-2.5 font-semibold">
                  {tab === "approved" ? "Status" : tab === "pending" ? "Requested" : "Signed up"}
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr
                  key={r.userId}
                  className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60"
                >
                  <td className="px-4 py-3 align-top">
                    <input
                      type="checkbox"
                      aria-label={`Select ${r.email}`}
                      checked={selected.has(r.userId)}
                      onChange={() => toggle(r.userId)}
                      className="h-4 w-4 rounded border-slate-300 text-purple-600"
                    />
                  </td>
                  <td className="px-4 py-3 align-top">
                    {r.instagramUsername ? (
                      <div className="flex items-center gap-1.5">
                        <a
                          href={`https://www.instagram.com/${r.instagramUsername}/`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-slate-900 hover:text-purple-600 hover:underline"
                        >
                          @{r.instagramUsername}
                        </a>
                        <button
                          onClick={() => copy(r.instagramUsername!)}
                          title="Copy handle"
                          className="text-slate-400 hover:text-slate-700"
                        >
                          {copied === r.instagramUsername ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                    {r.instagramUsername && !r.isProfessional && (
                      <p className="mt-0.5 text-xs text-amber-700">Not confirmed Business/Creator</p>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <p className="font-medium text-slate-800">{r.name ?? "—"}</p>
                    <p className="text-xs text-slate-500">{r.email}</p>
                  </td>
                  <td className="px-4 py-3 align-top text-xs text-slate-500 whitespace-nowrap">
                    {tab === "approved" ? (
                      r.connectedAs ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-700">
                          <CheckCircle2 className="h-3 w-3" />
                          Connected @{r.connectedAs}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600">
                          Approved, not connected yet
                        </span>
                      )
                    ) : (
                      formatDate(tab === "pending" ? r.requestedAt : r.signedUpAt)
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function formatDate(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("ro-RO", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}
