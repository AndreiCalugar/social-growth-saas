export const dynamic = "force-dynamic"

import { auth } from "@/lib/auth"
import { supabase } from "@/lib/supabase"
import { isAdminEmail } from "@/lib/admin"
import { fetchAdminAnalytics } from "@/lib/admin-analytics"
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

function StatusPill({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
        active
          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
          : "bg-slate-50 text-slate-400 border border-slate-200"
      }`}
    >
      {label}
    </span>
  )
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

  // Pull funnel/sources/recent in parallel with the feedback query —
  // they all hit different tables and the admin page is server-rendered.
  const [analytics, feedbackRes] = await Promise.all([
    fetchAdminAnalytics(),
    supabase
      .from("feedback")
      .select("id, rating, message, page_url, created_at, user_id, users(email)")
      .order("created_at", { ascending: false })
      .limit(500),
  ])
  const { data, error } = feedbackRes

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

  const { funnel, signupSources, recentUsers, signupSourceColumnMissing } = analytics

  return (
    <div className="p-4 sm:p-6 max-w-5xl space-y-8">
      {/* ── Funnel ── */}
      <section className="space-y-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Funnel</h2>
          <p className="text-sm text-slate-500 mt-1">
            Activation steps with step-over-step conversion.
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          {funnel.map((step, i) => {
            const widthPct =
              funnel[0].count === 0 ? 0 : Math.round((step.count / funnel[0].count) * 100)
            return (
              <div
                key={step.label}
                className={`relative px-4 py-3 ${i > 0 ? "border-t border-slate-100" : ""}`}
              >
                <div
                  className="absolute inset-y-0 left-0 bg-purple-50/70"
                  style={{ width: `${widthPct}%` }}
                  aria-hidden
                />
                <div className="relative flex items-baseline justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900">{step.label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {step.conversionPct === null ? (
                        <>Baseline</>
                      ) : (
                        <>
                          {step.conversionPct}% of previous step ·{" "}
                          {funnel[0].count === 0
                            ? "0"
                            : Math.round((step.count / funnel[0].count) * 100)}
                          % of signups
                        </>
                      )}
                    </p>
                  </div>
                  <span className="text-2xl font-bold tabular-nums text-slate-900">
                    {step.count}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── Signup sources ── */}
      <section className="space-y-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Signup sources</h2>
          <p className="text-sm text-slate-500 mt-1">
            {signupSourceColumnMissing
              ? "Run schema/013-signup-source.sql to enable source attribution."
              : "Where new signups came from. Untagged visits roll up as 'direct'."}
          </p>
        </div>
        {!signupSourceColumnMissing && signupSources.length > 0 && (
          <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="text-left font-semibold px-4 py-2.5">Source</th>
                  <th className="text-right font-semibold px-4 py-2.5">Count</th>
                  <th className="text-right font-semibold px-4 py-2.5">Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {signupSources.map((s) => (
                  <tr key={s.source} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 text-slate-700 font-mono text-xs">{s.source}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-900 font-semibold">
                      {s.count}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-500">
                      {s.pct}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!signupSourceColumnMissing && signupSources.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center">
            <p className="text-sm text-slate-500">No signups yet.</p>
          </div>
        )}
      </section>

      {/* ── Recent users ── */}
      <section className="space-y-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Recent users</h2>
          <p className="text-sm text-slate-500 mt-1">
            Last {recentUsers.length} signups · activation status at a glance.
          </p>
        </div>
        {recentUsers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center">
            <p className="text-sm text-slate-500">No signups yet.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="text-left font-semibold px-4 py-2.5">Email</th>
                  <th className="text-left font-semibold px-4 py-2.5">Name</th>
                  <th className="text-left font-semibold px-4 py-2.5">Source</th>
                  <th className="text-left font-semibold px-4 py-2.5">Signed up</th>
                  <th className="text-left font-semibold px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 text-slate-700 whitespace-nowrap">{u.email ?? "—"}</td>
                    <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">
                      {u.name ?? <span className="text-slate-400 italic">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 font-mono text-xs whitespace-nowrap">
                      {u.signup_source ?? "direct"}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <StatusPill active={u.hasProfile} label="Profile" />
                        <StatusPill active={u.hasInsights} label="Insights" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Feedback (existing section) ── */}
      <div>
        <h2 className="text-xl font-bold text-slate-900">Feedback</h2>
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
