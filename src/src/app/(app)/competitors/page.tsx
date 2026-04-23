export const dynamic = "force-dynamic"

import { supabase } from "@/lib/supabase"
import { auth } from "@/lib/auth"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
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
        <Card className="border-dashed">
          <CardContent className="pt-10 pb-10 text-center space-y-4">
            <div className="text-4xl">🎯</div>
            <div>
              <p className="font-semibold text-sm text-slate-900">Add 3–5 competitors in your niche</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                The insights engine analyzes posts across all competitor accounts together to detect what
                content patterns consistently outperform — then tells you exactly what to create.
                You need at least 3 to unlock trend detection.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Competitor cards list */}
      {competitors.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {competitors.map((c) => {
            const lastRun = lastRunByProfile[c.id]
            const scrapeStatus = lastRun?.status ?? (c.last_scraped ? "completed" : "never")

            return (
              <div key={c.id} className="group relative">
                <Link href={`/profiles/${c.id}`}>
                  <Card className="hover:border-purple-300 hover:shadow-md transition-all cursor-pointer">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-slate-400 to-slate-600 flex items-center justify-center shrink-0 shadow-sm">
                            <span className="text-sm font-bold text-white">{c.username.charAt(0).toUpperCase()}</span>
                          </div>
                          <div>
                            <CardTitle className="text-sm font-semibold text-slate-900">@{c.username}</CardTitle>
                          </div>
                        </div>
                        <DeleteCompetitorButton profileId={c.id} username={c.username} />
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-1.5 pt-0">
                      <p className="text-xs text-slate-500 flex items-center gap-1.5">
                        <Clock className="h-3 w-3 text-slate-400" />
                        {c.last_scraped ? `Scraped ${formatRelativeTime(c.last_scraped)}` : "Never scraped"}
                      </p>
                      {scrapeStatus === "failed" && (
                        <div className="space-y-1">
                          <p className="text-xs flex items-center gap-1 text-amber-600">
                            <AlertTriangle className="h-3 w-3" />
                            Last scrape failed — rate-limited.
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
                      {scrapeStatus === "never" && (
                        <p className="text-xs text-slate-400">Not scraped yet</p>
                      )}
                      <div className="flex items-center justify-between pt-2 mt-1 border-t border-slate-100 text-xs font-medium text-purple-600 group-hover:text-purple-700">
                        <span>View deep analysis</span>
                        <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </CardContent>
                  </Card>
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
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">
              Own profile not found. Run a scrape from the{" "}
              <Link href="/" className="text-purple-600 underline underline-offset-2">Overview page</Link>{" "}
              first.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
