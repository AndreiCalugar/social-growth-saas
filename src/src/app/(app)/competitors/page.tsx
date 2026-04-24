export const dynamic = "force-dynamic"

import { supabase } from "@/lib/supabase"
import { auth } from "@/lib/auth"
import { AddCompetitorForm } from "@/components/add-competitor-form"
import { CompetitorsClient } from "@/components/competitors-client"
import { DeleteCompetitorButton } from "@/components/delete-competitor-button"
import { RetryScrapeButton } from "@/components/retry-scrape-button"
import { Users, Clock, AlertTriangle, CheckCircle2, ArrowRight } from "lucide-react"
import Link from "next/link"
import { formatNumber, formatRelativeTime } from "@/lib/format"

export default async function CompetitorsPage() {
  const session = await auth()
  const userId = session!.user.id

  const profilesRes = await supabase
    .from("profiles")
    .select("id, username, followers, last_scraped, is_own")
    .eq("user_id", userId)
    .order("is_own", { ascending: false })
    .order("username", { ascending: true })

  const profiles = profilesRes.data ?? []
  const profileIds = profiles.map((p) => p.id)
  const safeIds = profileIds.length > 0 ? profileIds : ["00000000-0000-0000-0000-000000000000"]

  const [postsRes, scrapeRunsRes] = await Promise.all([
    supabase
      .from("posts")
      .select("id, profile_id, posted_at, caption, likes, comments, views, engagement_rate, content_type")
      .in("profile_id", safeIds)
      .order("posted_at", { ascending: false }),
    supabase
      .from("scrape_runs")
      .select("profile_id, status, completed_at")
      .in("profile_id", safeIds)
      .order("completed_at", { ascending: false }),
  ])

  const allPosts = postsRes.data ?? []
  const scrapeRuns = scrapeRunsRes.data ?? []

  // Last scrape run per profile
  const lastRunByProfile: Record<string, { status: string; completed_at: string | null }> = {}
  for (const run of scrapeRuns) {
    if (!lastRunByProfile[run.profile_id]) {
      lastRunByProfile[run.profile_id] = { status: run.status, completed_at: run.completed_at }
    }
  }

  const ownProfile = profiles.find((p) => p.is_own) ?? null
  const competitors = profiles.filter((p) => !p.is_own)

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Competitors</h1>
          <p className="text-sm text-slate-500">
            Click any card for a deep analysis of that profile's posts
          </p>
        </div>
        <AddCompetitorForm />
      </div>

      {/* Empty state */}
      {competitors.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 px-6 text-center">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center shadow-sm mb-5">
            <Users className="h-7 w-7 text-white" />
          </div>
          <h3 className="text-lg font-semibold text-slate-800">Add 3–5 competitors in your niche</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mt-2 leading-relaxed">
            The insights engine analyzes posts across all competitor accounts together to detect what
            content patterns consistently outperform — then tells you exactly what to create.
            You need at least 3 to unlock trend detection.
          </p>
        </div>
      )}

      {/* Competitor cards list */}
      {competitors.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {competitors.map((c) => {
            const lastRun = lastRunByProfile[c.id]
            const scrapeStatus = lastRun?.status ?? (c.last_scraped ? "completed" : "never")

            const statusDot =
              scrapeStatus === "failed"
                ? { color: "bg-red-500", label: "Scrape failed", pulse: true }
                : scrapeStatus === "never"
                ? { color: "bg-slate-300", label: "Not scraped yet", pulse: false }
                : ageBadge(c.last_scraped)

            return (
              <div key={c.id} className="group relative h-full">
                <Link href={`/profiles/${c.id}`}>
                  <div className="h-full rounded-xl border border-slate-200/60 bg-white hover:bg-gradient-to-br hover:from-white hover:to-purple-50/30 p-6 shadow-sm hover:shadow-md hover:border-purple-200 hover:scale-[1.01] transition-all cursor-pointer flex flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative shrink-0">
                          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center shadow-sm ring-2 ring-white">
                            <span className="text-sm font-bold text-white">{c.username.charAt(0).toUpperCase()}</span>
                          </div>
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-white ${statusDot.color} ${statusDot.pulse ? "animate-pulse" : ""}`}
                            aria-label={statusDot.label}
                            title={statusDot.label}
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">@{c.username}</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">{statusDot.label}</p>
                        </div>
                      </div>
                      <DeleteCompetitorButton profileId={c.id} username={c.username} />
                    </div>

                    <div className="mt-4 space-y-1.5 flex-1">
                      <p className="text-xs text-slate-500 flex items-center gap-1.5">
                        <Clock className="h-3 w-3 text-slate-400" />
                        {c.last_scraped ? `Scraped ${formatRelativeTime(c.last_scraped)}` : "Never scraped"}
                      </p>
                      {scrapeStatus === "failed" && (
                        <div className="space-y-1">
                          <p className="text-xs flex items-center gap-1 text-amber-600">
                            <AlertTriangle className="h-3 w-3" />
                            Rate-limited by Instagram.
                          </p>
                          <RetryScrapeButton profileId={c.id} username={c.username} />
                        </div>
                      )}
                      {scrapeStatus === "completed" && c.last_scraped && (
                        <p className="text-xs flex items-center gap-1.5 text-emerald-600">
                          <CheckCircle2 className="h-3 w-3" />
                          Scraped successfully
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-100 text-xs font-medium text-purple-600 group-hover:text-purple-700">
                      <span>View deep analysis</span>
                      <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </div>
                </Link>
              </div>
            )
          })}
        </div>
      )}

      {/* Comparison section */}
      {ownProfile ? (
        <CompetitorsClient
          ownProfile={ownProfile}
          competitors={competitors}
          allPosts={allPosts}
        />
      ) : (
        <div className="rounded-xl border border-slate-200/60 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">
            Own profile not found. Run a scrape from the{" "}
            <Link href="/" className="text-purple-600 underline underline-offset-2">Overview page</Link>{" "}
            first.
          </p>
        </div>
      )}
    </div>
  )
}

function ageBadge(last_scraped: string | null): { color: string; label: string; pulse: boolean } {
  if (!last_scraped) return { color: "bg-slate-300", label: "Never scraped", pulse: false }
  const ageHours = (Date.now() - new Date(last_scraped).getTime()) / (1000 * 60 * 60)
  if (ageHours < 24 * 7) return { color: "bg-emerald-500", label: "Fresh", pulse: false }
  if (ageHours < 24 * 30) return { color: "bg-amber-500", label: "Getting stale", pulse: true }
  return { color: "bg-red-500", label: "Needs rescrape", pulse: true }
}
