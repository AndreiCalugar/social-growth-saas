export const dynamic = "force-dynamic"

import { auth } from "@/lib/auth"
import { supabase } from "@/lib/supabase"
import { isAdminEmail } from "@/lib/admin"
import { notFound } from "next/navigation"

type FeedbackRow = {
  id: string
  rating: "love" | "okay" | "needs_work"
  message: string | null
  page_url: string | null
  created_at: string
  user_id: string | null
  users: { email: string | null } | null
}

const RATING_LABEL: Record<FeedbackRow["rating"], { emoji: string; label: string; tone: string }> = {
  love: { emoji: "😍", label: "Love it", tone: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  okay: { emoji: "😐", label: "Okay", tone: "bg-slate-50 text-slate-700 border-slate-200" },
  needs_work: { emoji: "😕", label: "Needs work", tone: "bg-amber-50 text-amber-800 border-amber-200" },
}

export default async function AdminPage() {
  const session = await auth()
  if (!session?.user?.id) notFound()
  if (!isAdminEmail(session.user.email)) notFound()

  // Returns each feedback row plus the joined user email. ON DELETE
  // SET NULL on user_id means deleted-account feedback survives with
  // a null users join.
  const { data, error } = await supabase
    .from("feedback")
    .select("id, rating, message, page_url, created_at, user_id, users(email)")
    .order("created_at", { ascending: false })
    .limit(500)

  // Tolerate the table not existing (schema/012 not yet run) so the
  // page renders an actionable error instead of a 500.
  let tableMissing = false
  let rows: FeedbackRow[] = []
  if (error) {
    if (error.code === "42P01" || error.message?.includes("does not exist")) {
      tableMissing = true
    } else {
      throw new Error(error.message)
    }
  } else {
    rows = (data ?? []) as unknown as FeedbackRow[]
  }

  const totals = rows.reduce(
    (acc, r) => {
      acc[r.rating] = (acc[r.rating] ?? 0) + 1
      return acc
    },
    {} as Record<FeedbackRow["rating"], number>,
  )

  return (
    <div className="p-4 sm:p-6 max-w-5xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Feedback</h1>
        <p className="text-sm text-slate-500 mt-1">
          {tableMissing
            ? "Run schema/012-feedback.sql to enable."
            : `${rows.length} ${rows.length === 1 ? "entry" : "entries"}, newest first.`}
        </p>
      </div>

      {!tableMissing && rows.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {(["love", "okay", "needs_work"] as const).map((r) => {
            const meta = RATING_LABEL[r]
            return (
              <div
                key={r}
                className={`rounded-lg border px-3 py-2.5 ${meta.tone}`}
              >
                <div className="flex items-baseline gap-2">
                  <span className="text-lg" aria-hidden>{meta.emoji}</span>
                  <span className="text-2xl font-bold tabular-nums">{totals[r] ?? 0}</span>
                </div>
                <p className="text-xs font-medium opacity-80 mt-0.5">{meta.label}</p>
              </div>
            )
          })}
        </div>
      )}

      {!tableMissing && rows.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center">
          <p className="text-sm text-slate-500">No feedback yet.</p>
        </div>
      )}

      {!tableMissing && rows.length > 0 && (
        <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="text-left font-semibold px-4 py-2.5">Rating</th>
                <th className="text-left font-semibold px-4 py-2.5">Message</th>
                <th className="text-left font-semibold px-4 py-2.5">User</th>
                <th className="text-left font-semibold px-4 py-2.5">Page</th>
                <th className="text-left font-semibold px-4 py-2.5">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => {
                const meta = RATING_LABEL[row.rating]
                return (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 align-top whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${meta.tone}`}
                      >
                        <span aria-hidden>{meta.emoji}</span>
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top text-slate-700 whitespace-pre-line">
                      {row.message || <span className="text-slate-400 italic">—</span>}
                    </td>
                    <td className="px-4 py-3 align-top text-slate-600 whitespace-nowrap">
                      {row.users?.email ?? <span className="text-slate-400 italic">deleted</span>}
                    </td>
                    <td className="px-4 py-3 align-top text-slate-500 font-mono text-xs whitespace-nowrap">
                      {row.page_url ?? "—"}
                    </td>
                    <td className="px-4 py-3 align-top text-slate-500 whitespace-nowrap">
                      {new Date(row.created_at).toLocaleString()}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
