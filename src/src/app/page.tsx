export const dynamic = "force-dynamic"

import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { RunAnalysisButton } from "@/components/run-analysis-button"
import { LikesChart } from "@/components/likes-chart"
import { Users, BarChart2, FileText, Sparkles, TrendingUp, TrendingDown, Minus } from "lucide-react"

async function getDashboardData() {
  const [profileRes, postsRes, analysisRes, recsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, username, followers, last_scraped")
      .eq("is_own", true)
      .single(),
    supabase
      .from("posts")
      .select("posted_at, likes, views, engagement_rate")
      .order("posted_at", { ascending: true })
      .limit(30),
    supabase
      .from("analyses")
      .select("created_at, engagement_summary")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("recommendations")
      .select("title, category, priority, description")
      .order("priority", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(5),
  ])

  const posts = postsRes.data ?? []
  const avgLikes = posts.length > 0
    ? Math.round(posts.reduce((sum, p) => sum + (p.likes ?? 0), 0) / posts.length)
    : 0
  const postCount = posts.length

  return {
    ownProfile: profileRes.data ?? null,
    postStats: { avgLikes, postCount },
    posts,
    latestAnalysis: analysisRes.data ?? null,
    recentRecs: recsRes.data ?? [],
  }
}

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

const priorityStyles: Record<string, string> = {
  high: "bg-red-100 text-red-700 border-red-200",
  medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
  low: "bg-green-100 text-green-700 border-green-200",
}

export default async function OverviewPage() {
  const { ownProfile, postStats, posts, latestAnalysis, recentRecs } = await getDashboardData()

  const engagementSummary = latestAnalysis?.engagement_summary as {
    trend?: string
    avg_likes?: number
    avg_views?: number
    trend_reasoning?: string
  } | null

  const chartData = posts.map((p) => ({
    date: p.posted_at ? new Date(p.posted_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "",
    likes: p.likes ?? 0,
    views: Math.round((p.views ?? 0) / 10),
  }))

  const TrendIcon =
    engagementSummary?.trend === "growing"
      ? TrendingUp
      : engagementSummary?.trend === "declining"
      ? TrendingDown
      : Minus

  const trendColor =
    engagementSummary?.trend === "growing"
      ? "text-green-600"
      : engagementSummary?.trend === "declining"
      ? "text-red-500"
      : "text-muted-foreground"

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Overview</h1>
          <p className="text-sm text-muted-foreground">
            @{ownProfile?.username ?? "—"} · Last scraped {formatDate(ownProfile?.last_scraped)}
          </p>
        </div>
        {ownProfile && <RunAnalysisButton profileId={ownProfile.id} />}
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5 text-xs">
              <Users className="h-3.5 w-3.5" /> Followers
            </CardDescription>
            <CardTitle className="text-2xl font-bold">
              {formatNumber(ownProfile?.followers)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Instagram</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5 text-xs">
              <BarChart2 className="h-3.5 w-3.5" /> Avg Likes
            </CardDescription>
            <CardTitle className="text-2xl font-bold">
              {formatNumber(engagementSummary?.avg_likes ?? postStats.avgLikes)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">per post</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5 text-xs">
              <FileText className="h-3.5 w-3.5" /> Posts Tracked
            </CardDescription>
            <CardTitle className="text-2xl font-bold">
              {postStats.postCount}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">total scraped</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5 text-xs">
              <Sparkles className="h-3.5 w-3.5" /> Last Analysis
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-base leading-snug pt-1">
              {formatDate(latestAnalysis?.created_at)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {engagementSummary?.trend && (
              <p className={`text-xs flex items-center gap-1 ${trendColor}`}>
                <TrendIcon className="h-3 w-3" />
                {engagementSummary.trend}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Chart + Recommendations side by side */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* Likes over time */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Likes over time</CardTitle>
            <CardDescription className="text-xs">
              Solid line = likes · Dashed = views ÷ 10
            </CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <LikesChart data={chartData} />
            ) : (
              <div className="flex h-60 items-center justify-center text-sm text-muted-foreground">
                No post data yet — run a scrape first
              </div>
            )}
          </CardContent>
        </Card>

        {/* AI Recommendations */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Top Recommendations</CardTitle>
            <CardDescription className="text-xs">From latest AI analysis</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentRecs.length > 0 ? (
              recentRecs.map((rec, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium ${priorityStyles[rec.priority] ?? ""}`}
                    >
                      {rec.priority}
                    </span>
                    <span className="text-xs font-medium leading-none">{rec.title}</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-snug line-clamp-2">
                    {rec.description}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                No analysis yet — click &quot;Run Analysis&quot; above
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Trend insight */}
      {engagementSummary?.trend_reasoning && (
        <Card className="border-dashed">
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">
              <span className={`font-medium ${trendColor}`}>
                <TrendIcon className="inline h-3.5 w-3.5 mr-1" />
                Trend insight:{" "}
              </span>
              {engagementSummary.trend_reasoning}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
