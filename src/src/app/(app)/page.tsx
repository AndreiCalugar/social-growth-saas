export const dynamic = "force-dynamic"

import { supabase } from "@/lib/supabase"
import { auth } from "@/lib/auth"
import { formatNumber, formatRelativeTime } from "@/lib/format"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { RunAnalysisButton } from "@/components/run-analysis-button"
import { LikesChart } from "@/components/likes-chart"
import { OnboardingLanding } from "@/components/onboarding-landing"
import Link from "next/link"
import {
  Users, BarChart2, FileText, Sparkles,
  TrendingUp, TrendingDown, Minus, Zap,
  RefreshCw, PlusCircle, ChevronRight, ArrowRight,
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
    .select("id, is_own")
    .eq("user_id", userId)
  const profileIds = (allProfiles ?? []).map((p) => p.id)
  const competitorCount = (allProfiles ?? []).filter((p) => !p.is_own).length

  if (!ownProfileId) {
    return { ownProfile: null, postStats: { avgLikes: 0, postCount: 0, avgEngagement: 0 }, posts: [], latestAnalysis: null, recentRecs: [], trendCount: 0, megaTipCount: 0, topInsight: null, recentActivity: [], totalProfiles: profileIds.length, competitorCount }
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
    competitorCount,
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
  const { ownProfile, postStats, posts, latestAnalysis, recentRecs, trendCount, megaTipCount, topInsight, recentActivity, totalProfiles, competitorCount } =
    await getDashboardData(userId)

  // Brand-new user: full onboarding landing page
  if (totalProfiles === 0) {
    return <OnboardingLanding />
  }

  // Has competitors but no own profile yet — narrower prompt to add own
  if (!ownProfile) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="text-center space-y-5 max-w-sm">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-purple-100 flex items-center justify-center">
            <TrendingUp className="h-8 w-8 text-purple-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Add your own Instagram profile</h1>
            <p className="text-sm text-slate-500 mt-2">
              You&apos;ve added competitors — now add your own account so we can compare and generate insights for you.
            </p>
          </div>
          <Link
            href="/profiles"
            className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-purple-700 transition-colors shadow-sm"
          >
            <PlusCircle className="h-4 w-4" />
            Add your own profile
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
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Overview</h1>
          <p className="text-sm text-slate-500 truncate">
            @{ownProfile.username} · Last scraped {formatRelativeTime(ownProfile.last_scraped)}
          </p>
        </div>
        <div className="shrink-0">
          <RunAnalysisButton profileId={ownProfile.id} username={ownProfile.username} />
        </div>
      </div>

      {/* Progressive onboarding banners */}
      {competitorCount < 3 ? (
        <Link
          href="/competitors"
          className="group flex items-center gap-3 rounded-xl border border-purple-200 bg-gradient-to-r from-purple-50 to-white p-4 hover:border-purple-300 hover:shadow-md transition-all"
        >
          <div className="h-10 w-10 shrink-0 rounded-xl bg-purple-600 flex items-center justify-center shadow-sm">
            <Users className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
              <span className="text-emerald-600">✓</span> Profile added
            </p>
            <p className="text-xs text-slate-600 mt-0.5">
              Now add {3 - competitorCount} more competitor{3 - competitorCount === 1 ? "" : "s"} ({competitorCount}/3) to unlock the Insights Engine.
            </p>
          </div>
          <ArrowRight className="h-4 w-4 text-purple-600 shrink-0 transition-transform group-hover:translate-x-0.5" />
        </Link>
      ) : trendCount === 0 ? (
        <Link
          href="/insights"
          className="group flex items-center gap-3 rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-white p-4 hover:border-amber-300 hover:shadow-md transition-all"
        >
          <div className="h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-sm">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900">You&apos;re ready!</p>
            <p className="text-xs text-slate-600 mt-0.5">
              Generate your first insights — we&apos;ll analyze {competitorCount} competitors to find what content is outperforming in your niche.
            </p>
          </div>
          <ArrowRight className="h-4 w-4 text-amber-600 shrink-0 transition-transform group-hover:translate-x-0.5" />
        </Link>
      ) : null}

      {/* Metric cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard
          accent="purple"
          icon={BarChart2}
          label="Avg Likes"
          value={formatNumber(engagementSummary?.avg_likes ?? postStats.avgLikes)}
          foot="per post"
        />
        <MetricCard
          accent="emerald"
          icon={FileText}
          label="Posts Tracked"
          value={postStats.postCount}
          foot={`across ${totalProfiles} profile${totalProfiles !== 1 ? "s" : ""}`}
        />
        <MetricCard
          accent="amber"
          icon={Sparkles}
          label="Last Analysis"
          value={latestAnalysis ? formatRelativeTime(latestAnalysis.created_at) : "—"}
          valueSize="sm"
          foot={
            engagementSummary?.trend ? (
              <span className={`inline-flex items-center gap-1 font-medium ${trendColor}`}>
                <TrendIcon className="h-3 w-3" />
                {engagementSummary.trend}
              </span>
            ) : (
              <span className="text-slate-400">no analysis yet</span>
            )
          }
        />
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2">
        <PillLink href="/profiles" icon={PlusCircle}>Add Profile</PillLink>
        <PillLink href="/insights" icon={Sparkles} iconClassName="text-amber-500">View Insights</PillLink>
        <PillLink href="/competitors" icon={Users}>Manage Competitors</PillLink>
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
                  <RunAnalysisButton profileId={ownProfile.id} username={ownProfile.username} />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Top mega-tip preview — styled like the real InsightCard for continuity */}
      {topInsight ? (
        <Link href="/insights" className="block group">
          <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm hover:shadow-md hover:border-amber-200 transition-all overflow-hidden border-l-4 border-l-amber-500">
            <div className="p-5 flex items-start gap-4">
              <div className="h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-sm">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-slate-900">{topInsight.trend_name}</p>
                  <span className="inline-flex items-baseline gap-0.5 rounded-full bg-slate-900 px-2 py-0.5 text-[11px] font-bold text-white tabular-nums">
                    {topInsight.performance_multiplier.toFixed(1)}
                    <span className="text-[9px] text-slate-300">×</span>
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 px-2 py-0.5 text-[10px] font-semibold border border-amber-100">
                    Try this
                  </span>
                </div>
                <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mt-1">
                  {topInsight.recommendation}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400 shrink-0 mt-2 transition-transform group-hover:translate-x-0.5" />
            </div>
          </div>
        </Link>
      ) : (
        <Link href="/insights" className="block group">
          <div className="bg-white rounded-xl border border-slate-200/60 shadow-sm hover:shadow-md hover:border-amber-200 transition-all overflow-hidden border-l-4 border-l-amber-500">
            <div className="p-5 flex items-center gap-4">
              <div className="h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-sm">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900">
                  {trendCount > 0 ? `${trendCount} trends detected in your niche` : "Discover what content to create"}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {megaTipCount > 0
                    ? `${megaTipCount} mega-tip${megaTipCount !== 1 ? "s" : ""} ready`
                    : "Run the insights engine to detect trends across your competitors"}
                </p>
              </div>
              <span className="text-xs font-semibold text-amber-600 shrink-0 flex items-center gap-1">
                {trendCount > 0 ? "View" : "Generate"}
                <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </div>
          </div>
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

const metricAccent: Record<"purple" | "emerald" | "amber", string> = {
  purple: "before:bg-purple-500",
  emerald: "before:bg-emerald-500",
  amber: "before:bg-amber-500",
}
const metricIconTint: Record<"purple" | "emerald" | "amber", string> = {
  purple: "bg-purple-50 text-purple-600",
  emerald: "bg-emerald-50 text-emerald-600",
  amber: "bg-amber-50 text-amber-600",
}

function MetricCard({
  accent,
  icon: Icon,
  label,
  value,
  foot,
  valueSize = "lg",
}: {
  accent: "purple" | "emerald" | "amber"
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: React.ReactNode
  foot: React.ReactNode
  valueSize?: "lg" | "sm"
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-slate-200/60 bg-white p-5 shadow-sm hover:shadow-md transition-all before:absolute before:top-0 before:left-0 before:right-0 before:h-1 ${metricAccent[accent]}`}
    >
      <div className="flex items-center gap-2.5">
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${metricIconTint[accent]}`}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
          {label}
        </span>
      </div>
      <p
        className={`mt-3 font-bold tabular-nums text-slate-900 ${
          valueSize === "lg" ? "text-2xl" : "text-sm leading-snug"
        }`}
      >
        {value}
      </p>
      <p className="text-xs text-slate-500 mt-1.5">{foot}</p>
    </div>
  )
}

function PillLink({
  href,
  icon: Icon,
  iconClassName,
  children,
}: {
  href: string
  icon: React.ComponentType<{ className?: string }>
  iconClassName?: string
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 hover:shadow-sm active:scale-95 transition-all"
    >
      <Icon className={`h-3.5 w-3.5 ${iconClassName ?? "text-slate-500"}`} />
      {children}
    </Link>
  )
}
