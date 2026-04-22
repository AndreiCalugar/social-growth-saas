export const dynamic = "force-dynamic"

import { supabase } from "@/lib/supabase"
import { auth } from "@/lib/auth"
import { formatNumber, formatRelativeTime } from "@/lib/format"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { RunAnalysisButton } from "@/components/run-analysis-button"
import { LikesChart } from "@/components/likes-chart"
import Link from "next/link"
import {
  Users, BarChart2, FileText, Sparkles,
  TrendingUp, TrendingDown, Minus, Zap,
  RefreshCw, PlusCircle, ChevronRight,
} from "lucide-react"

async function getDashboardData(userId: string) {
  const profileRes = await supabase
    .from("profiles")
    .select("id, username, followers, last_scraped")
    .eq("user_id", userId)
    .eq("is_own", true)
    .maybeSingle()

  const ownProfile = profileRes.data ?? null
  const ownProfileId = ownProfile?.id ?? null

  // Always fetch all of this user's profile ids so child-table queries stay scoped.
  const { data: allProfiles } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", userId)
  const profileIds = (allProfiles ?? []).map((p) => p.id)

  if (!ownProfileId) {
    return { ownProfile: null, postStats: { avgLikes: 0, postCount: 0, avgEngagement: 0 }, posts: [], latestAnalysis: null, recentRecs: [], trendCount: 0, megaTipCount: 0, topInsight: null, recentActivity: [], totalProfiles: profileIds.length }
  }

  const [postsRes, analysisRes, recsRes, scrapeRunsRes, analysesListRes] = await Promise.all([
    supabase
      .from("posts")
      .select("posted_at, likes, views, engagement_rate")
      .eq("profile_id", ownProfileId)
      .order("posted_at", { ascending: false })
      .limit(30),
    supabase
      .from("analyses")
      .select("created_at, engagement_summary")
      .eq("profile_id", ownProfileId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("recommendations")
      .select("title, category, priority, description")
      .eq("profile_id", ownProfileId)
      .order("priority", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("scrape_runs")
      .select("profile_id, status, completed_at, profiles(username)")
      .in("profile_id", profileIds.length > 0 ? profileIds : ["00000000-0000-0000-0000-000000000000"])
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(3),
    supabase
      .from("analyses")
      .select("created_at, profiles(username)")
      .in("profile_id", profileIds.length > 0 ? profileIds : ["00000000-0000-0000-0000-000000000000"])
      .order("created_at", { ascending: false })
      .limit(3),
  ])

  const posts = postsRes.data ?? []
  const avgLikes = posts.length > 0
    ? Math.round(posts.reduce((sum, p) => sum + (p.likes ?? 0), 0) / posts.length)
    : 0
  const avgEngagement = posts.length > 0
    ? posts.reduce((sum, p) => sum + (p.engagement_rate ?? 0), 0) / posts.length
    : 0

  // Count trend insights
  let trendCount = 0
  let megaTipCount = 0
  let topInsight: { trend_name: string; performance_multiplier: number; recommendation: string } | null = null

  const { data: latestInsight } = await supabase
    .from("trend_insights")
    .select("created_at")
    .eq("profile_id", ownProfileId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (latestInsight) {
    const cutoff = new Date(new Date(latestInsight.created_at).getTime() - 10 * 60 * 1000).toISOString()
    const { data: insights } = await supabase
      .from("trend_insights")
      .select("trend_name, performance_multiplier, recommendation, is_mega_tip")
      .eq("profile_id", ownProfileId)
      .gte("created_at", cutoff)
      .order("performance_multiplier", { ascending: false })
    trendCount = insights?.length ?? 0
    megaTipCount = insights?.filter((i) => i.is_mega_tip).length ?? 0
    const best = insights?.find((i) => i.is_mega_tip) ?? insights?.[0] ?? null
    if (best) topInsight = { trend_name: best.trend_name, performance_multiplier: best.performance_multiplier, recommendation: best.recommendation }
  }

  // Recent activity feed
  type ActivityItem = { type: "scrape" | "analysis"; label: string; time: string }
  const scrapeItems: ActivityItem[] = (scrapeRunsRes.data ?? []).map((r) => ({
    type: "scrape",
    label: `Scraped @${(r.profiles as unknown as { username: string } | null)?.username ?? "unknown"}`,
    time: r.completed_at ?? "",
  }))
  const analysisItems: ActivityItem[] = (analysesListRes.data ?? []).map((a) => ({
    type: "analysis",
    label: `Analysis run for @${(a.profiles as unknown as { username: string } | null)?.username ?? "unknown"}`,
    time: a.created_at ?? "",
  }))
  const recentActivity: ActivityItem[] = [...scrapeItems, ...analysisItems]
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    .slice(0, 5)

  return {
    ownProfile,
    postStats: { avgLikes, postCount: posts.length, avgEngagement },
    posts,
    latestAnalysis: analysisRes.data ?? null,
    recentRecs: recsRes.data ?? [],
    trendCount,
    megaTipCount,
    topInsight,
    recentActivity,
    totalProfiles: profileIds.length,
  }
}

const priorityStyles: Record<string, string> = {
  high: "bg-red-100 text-red-700 border-red-200",
  medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
  low: "bg-green-100 text-green-700 border-green-200",
}

export default async function OverviewPage() {
  const session = await auth()
  const userId = session!.user.id
  const { ownProfile, postStats, posts, latestAnalysis, recentRecs, trendCount, megaTipCount, topInsight, recentActivity, totalProfiles } =
    await getDashboardData(userId)

  // No profile empty state
  if (!ownProfile) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="text-center space-y-5 max-w-sm">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-purple-100 flex items-center justify-center">
            <TrendingUp className="h-8 w-8 text-purple-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Welcome to Social Growth</h1>
            <p className="text-sm text-slate-500 mt-2">
              Add your Instagram profile to start tracking analytics and discovering what content to create.
            </p>
          </div>
          <Link
            href="/profiles"
            className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-purple-700 transition-colors shadow-sm"
          >
            <PlusCircle className="h-4 w-4" />
            Add your Instagram profile
          </Link>
        </div>
      </div>
    )
  }

  const engagementSummary = latestAnalysis?.engagement_summary as {
    trend?: string; avg_likes?: number; avg_views?: number; trend_reasoning?: string
  } | null

  const chartData = [...posts].reverse().map((p) => ({
    date: p.posted_at ? new Date(p.posted_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "",
    likes: p.likes ?? 0,
    views: Math.round((p.views ?? 0) / 10),
  }))

  const TrendIcon = engagementSummary?.trend === "growing" ? TrendingUp : engagementSummary?.trend === "declining" ? TrendingDown : Minus
  const trendColor = engagementSummary?.trend === "growing" ? "text-green-600" : engagementSummary?.trend === "declining" ? "text-red-500" : "text-muted-foreground"

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Overview</h1>
          <p className="text-sm text-slate-500">
            @{ownProfile.username} · Last scraped {formatRelativeTime(ownProfile.last_scraped)}
          </p>
        </div>
        <RunAnalysisButton profileId={ownProfile.id} />
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2 pt-4">
            <CardDescription className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" /> Followers
            </CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-slate-900">
              {formatNumber(ownProfile.followers)}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <p className="text-xs text-slate-400">Instagram</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 pt-4">
            <CardDescription className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 flex items-center gap-1.5">
              <BarChart2 className="h-3.5 w-3.5" /> Avg Likes
            </CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-slate-900">
              {formatNumber(engagementSummary?.avg_likes ?? postStats.avgLikes)}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <p className="text-xs text-slate-400">per post</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 pt-4">
            <CardDescription className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" /> Posts Tracked
            </CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-slate-900">
              {postStats.postCount}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <p className="text-xs text-slate-400">
              across {totalProfiles} profile{totalProfiles !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 pt-4">
            <CardDescription className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" /> Last Analysis
            </CardDescription>
            <CardTitle className="text-sm font-bold leading-snug pt-1 text-slate-900">
              {latestAnalysis ? formatRelativeTime(latestAnalysis.created_at) : "—"}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            {engagementSummary?.trend ? (
              <p className={`text-xs flex items-center gap-1 font-medium ${trendColor}`}>
                <TrendIcon className="h-3 w-3" />
                {engagementSummary.trend}
              </p>
            ) : (
              <p className="text-xs text-slate-400">no analysis yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2">
        <Link
          href="/profiles"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
        >
          <PlusCircle className="h-3.5 w-3.5" /> Add Profile
        </Link>
        <Link
          href="/insights"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
        >
          <Sparkles className="h-3.5 w-3.5 text-amber-500" /> View Insights
        </Link>
        <Link
          href="/competitors"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
        >
          <Users className="h-3.5 w-3.5" /> Manage Competitors
        </Link>
      </div>

      {/* Chart + sidebar */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-slate-900">Likes over time</CardTitle>
            <CardDescription className="text-xs">Solid line = likes · Dashed = views ÷ 10</CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <LikesChart data={chartData} />
            ) : (
              <div className="flex h-60 flex-col items-center justify-center gap-3 text-sm text-slate-400">
                <BarChart2 className="h-10 w-10 text-slate-200" />
                <p>No post data yet</p>
                <Link
                  href="/profiles"
                  className="text-xs text-purple-600 underline underline-offset-2"
                >
                  Scrape your profile to see data
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right sidebar: recommendations or activity */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-slate-900">Top Recommendations</CardTitle>
              <CardDescription className="text-xs">From latest AI analysis</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentRecs.length > 0 ? (
                recentRecs.map((rec, i) => (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium ${priorityStyles[rec.priority] ?? ""}`}>
                        {rec.priority}
                      </span>
                      <span className="text-xs font-medium leading-none">{rec.title}</span>
                    </div>
                    <p className="text-xs text-slate-500 leading-snug line-clamp-2">{rec.description}</p>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <Sparkles className="h-8 w-8 text-slate-200" />
                  <p className="text-xs text-slate-400">No analysis yet</p>
                  <RunAnalysisButton profileId={ownProfile.id} />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Top mega-tip preview */}
      {topInsight && (
        <Link href="/insights" className="block">
          <Card className="border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50 hover:border-orange-300 transition-colors cursor-pointer">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-orange-100 p-2 shrink-0 mt-0.5">
                    <Zap className="h-4 w-4 text-orange-500" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold">{topInsight.trend_name}</p>
                      <span className="text-[10px] font-bold bg-orange-500 text-white px-1.5 py-0.5 rounded-full">
                        {topInsight.performance_multiplier.toFixed(1)}×
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                      {topInsight.recommendation}
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-orange-400 shrink-0 mt-1" />
              </div>
            </CardContent>
          </Card>
        </Link>
      )}

      {!topInsight && (
        <Link href="/insights" className="block">
          <Card className="border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50 hover:border-orange-300 transition-colors cursor-pointer">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-orange-100 p-2">
                    <Zap className="h-5 w-5 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">
                      {trendCount > 0 ? `${trendCount} trends detected in your niche` : "Discover what content to create"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {megaTipCount > 0
                        ? `${megaTipCount} mega-tip${megaTipCount !== 1 ? "s" : ""} ready`
                        : "Run the insights engine to detect trends across your competitors"}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-medium text-orange-600 shrink-0 flex items-center gap-1">
                  {trendCount > 0 ? "View insights" : "Generate"} <ChevronRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </CardContent>
          </Card>
        </Link>
      )}

      {/* Recent activity */}
      {recentActivity.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-900">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentActivity.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-slate-500">
                    {item.type === "scrape"
                      ? <RefreshCw className="h-3 w-3 shrink-0 text-purple-500" />
                      : <Sparkles className="h-3 w-3 shrink-0 text-amber-500" />
                    }
                    <span>{item.label}</span>
                  </div>
                  <span className="text-slate-400 tabular-nums">{formatRelativeTime(item.time)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
