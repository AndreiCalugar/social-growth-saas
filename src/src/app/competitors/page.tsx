export const dynamic = "force-dynamic"

import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { AddCompetitorForm } from "@/components/add-competitor-form"
import { CompetitorsClient } from "@/components/competitors-client"
import { DeleteCompetitorButton } from "@/components/delete-competitor-button"
import { RetryScrapeButton } from "@/components/retry-scrape-button"
import { Users, Clock, AlertTriangle, CheckCircle2 } from "lucide-react"
import Link from "next/link"

function formatNumber(n: number | null | undefined) {
  if (n == null) return "—"
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

function formatDate(d: string | null | undefined) {
  if (!d) return "Never"
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}

export default async function CompetitorsPage() {
  const [profilesRes, postsRes, scrapeRunsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, username, followers, last_scraped, is_own")
      .order("is_own", { ascending: false })
      .order("username", { ascending: true }),
    supabase
      .from("posts")
      .select("id, profile_id, posted_at, caption, likes, comments, views, engagement_rate, content_type")
      .order("posted_at", { ascending: false }),
    supabase
      .from("scrape_runs")
      .select("profile_id, status, completed_at")
      .order("completed_at", { ascending: false }),
  ])

  const profiles = profilesRes.data ?? []
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
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Competitors</h1>
          <p className="text-sm text-muted-foreground">
            Track and compare against other Instagram accounts
          </p>
        </div>
        <AddCompetitorForm />
      </div>

      {/* Competitor cards list */}
      {competitors.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {competitors.map((c) => {
            const lastRun = lastRunByProfile[c.id]
            const scrapeStatus = lastRun?.status ?? (c.last_scraped ? "completed" : "never")

            return (
              <div key={c.id} className="group relative">
                <Link href={`/profiles/${c.id}`}>
                  <Card className="hover:border-orange-300/60 hover:shadow-sm transition-all cursor-pointer">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-semibold">@{c.username}</CardTitle>
                        <DeleteCompetitorButton profileId={c.id} username={c.username} />
                      </div>
                      <CardDescription className="flex items-center gap-1.5 text-xs">
                        <Users className="h-3 w-3" />
                        {formatNumber(c.followers)} followers
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-1.5">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Scraped {formatDate(c.last_scraped)}
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
                        <p className="text-xs flex items-center gap-1 text-green-600">
                          <CheckCircle2 className="h-3 w-3" />
                          Scraped successfully
                        </p>
                      )}
                      {scrapeStatus === "never" && (
                        <p className="text-xs text-muted-foreground">Not scraped yet</p>
                      )}
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
            <p className="text-sm text-muted-foreground">
              Own profile not found. Run a scrape from the{" "}
              <Link href="/" className="text-primary underline underline-offset-2">Overview page</Link>{" "}
              first.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
