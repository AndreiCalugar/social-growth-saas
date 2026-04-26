export const dynamic = "force-dynamic"

import { supabase } from "@/lib/supabase"
import { auth } from "@/lib/auth"
import { AddCompetitorForm } from "@/components/add-competitor-form"
import { CompetitorsClient } from "@/components/competitors-client"
import { CompetitorDiscovery, type DiscoverySuggestions } from "@/components/competitor-discovery"
import { InstagramLink } from "@/components/instagram-link"
import { DeleteCompetitorButton } from "@/components/delete-competitor-button"
import { RetryScrapeButton } from "@/components/retry-scrape-button"
import { ScrapingCardOverlay } from "@/components/scraping-card-overlay"
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
  const ownUsername = ownProfile?.username ?? null

  // Extract @mentions from competitor post captions and rank by frequency
  // weighted by competitor coverage. We surface the top 10 unique mentions
  // that are NOT already tracked by this user and are not the user's own
  // handle. Lowercase normalizes "@Foo" and "@foo" to one entry.
  const trackedHandles = new Set(
    profiles.map((p) => p.username.toLowerCase().replace(/^@/, ""))
  )
  const competitorIds = new Set(competitors.map((c) => c.id))
  const mentionStats: Record<string, { count: number; competitors: Set<string> }> = {}
  const MENTION_RE = /@([A-Za-z0-9_.]{2,30})/g

  for (const post of allPosts) {
    if (!competitorIds.has(post.profile_id)) continue
    const caption = post.caption ?? ""
    if (!caption) continue
    const found = new Set<string>()
    let m: RegExpExecArray | null
    while ((m = MENTION_RE.exec(caption)) !== null) {
      const handle = m[1].toLowerCase()
      if (handle.endsWith(".")) continue // Trailing-dot false positives.
      if (trackedHandles.has(handle)) continue
      if (handle === ownUsername?.toLowerCase()) continue
      found.add(handle)
    }
    for (const handle of found) {
      const slot = (mentionStats[handle] ??= { count: 0, competitors: new Set() })
      slot.count++
      slot.competitors.add(post.profile_id)
    }
  }

  const mentionSuggestions = Object.entries(mentionStats)
    // Require ≥2 mentions to filter one-off shoutouts; drops noise hard.
    .filter(([, s]) => s.count >= 2)
    .map(([handle, s]) => ({
      username: handle,
      mention_count: s.count,
      competitor_count: s.competitors.size,
    }))
    .sort((a, b) => {
      // Rank by competitor coverage first (cross-account validation),
      // then by raw mention count.
      if (b.competitor_count !== a.competitor_count) return b.competitor_count - a.competitor_count
      return b.mention_count - a.mention_count
    })
    .slice(0, 10)

  const showDiscovery = Boolean(ownProfile)
  const hasOwnPosts = ownProfile
    ? allPosts.some((p) => p.profile_id === ownProfile.id)
    : false

  // Cached hashtag suggestions live on the own profile. Read them in a
  // separate query so the page still renders when schema/008 hasn't been
  // applied yet — the discovery section just falls back to the empty state
  // and prompts the user to "Analyze my profile".
  let cachedDiscovery: unknown = null
  let cachedDiscoveryUpdated: string | null = null
  if (ownProfile) {
    const { data: ownExtra, error: ownExtraErr } = await supabase
      .from("profiles")
      .select("discovery_hashtags, discovery_hashtags_updated")
      .eq("id", ownProfile.id)
      .maybeSingle()
    if (ownExtraErr) {
      const tableMissing =
        ownExtraErr.code === "42703" ||
        ownExtraErr.message?.includes("does not exist") ||
        ownExtraErr.message?.includes("schema cache")
      if (!tableMissing) {
        console.error("[competitors page] discovery_hashtags lookup:", ownExtraErr.message)
      }
    } else if (ownExtra) {
      cachedDiscovery = ownExtra.discovery_hashtags
      cachedDiscoveryUpdated = ownExtra.discovery_hashtags_updated as string | null
    }
  }

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

      {/* Discovery helper — only when the user has their own profile, since
          hashtag suggestions need their captions and mentions need at least
          one scraped competitor. Component handles its own collapsed state. */}
      {showDiscovery && (
        <CompetitorDiscovery
          ownProfileId={ownProfile!.id}
          ownUsername={ownProfile!.username}
          hasOwnPosts={hasOwnPosts}
          initialSuggestions={(cachedDiscovery as DiscoverySuggestions | null) ?? null}
          initialUpdatedAt={cachedDiscoveryUpdated}
          mentionSuggestions={mentionSuggestions}
        />
      )}

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
                <ScrapingCardOverlay profileId={c.id} />
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
                          <p className="text-sm font-semibold text-slate-900 truncate inline-flex items-center gap-1">
                            @{c.username}
                            <InstagramLink username={c.username} size="xs" />
                          </p>
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
