export const dynamic = "force-dynamic"

import { notFound } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ScrapeNowButton } from "@/components/scrape-now-button"
import { RunAnalysisButton } from "@/components/run-analysis-button"
import { ProfileCharts } from "@/components/profile-charts"
import { PostsTable } from "@/components/posts-table"
import { Users, Clock, TrendingUp, TrendingDown, Minus } from "lucide-react"

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

export default async function ProfileDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [profileRes, postsRes, analysisRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, username, followers, bio, last_scraped, is_own")
      .eq("id", id)
      .single(),
    supabase
      .from("posts")
      .select("id, posted_at, caption, likes, comments, views, engagement_rate, content_type, url")
      .eq("profile_id", id)
      .order("posted_at", { ascending: false }),
    supabase
      .from("analyses")
      .select("id, created_at, engagement_summary")
      .eq("profile_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  if (!profileRes.data) notFound()

  const profile = profileRes.data
  const posts = postsRes.data ?? []

  // Fetch recommendations for latest analysis
  const recsRes = analysisRes.data
    ? await supabase
        .from("recommendations")
        .select("id, title, category, priority, description")
        .eq("analysis_id", analysisRes.data.id)
        .order("priority", { ascending: true })
    : { data: [] }

  const latestAnalysis = analysisRes.data
  const recs = recsRes.data ?? []

  const engagementSummary = latestAnalysis?.engagement_summary as {
    trend?: string
    avg_likes?: number
    avg_views?: number
    trend_reasoning?: string
  } | null

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

  // Posts sorted by date asc for charts
  const postsAsc = [...posts].sort((a, b) =>
    new Date(a.posted_at ?? 0).getTime() - new Date(b.posted_at ?? 0).getTime()
  )

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Profile header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">@{profile.username}</h1>
            {profile.is_own && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                Own account
              </span>
            )}
          </div>
          {profile.bio && (
            <p className="text-sm text-muted-foreground max-w-lg">{profile.bio}</p>
          )}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {formatNumber(profile.followers)} followers
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              Scraped {formatDate(profile.last_scraped)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ScrapeNowButton username={profile.username} />
          <RunAnalysisButton profileId={profile.id} />
        </div>
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-1">
            <CardDescription className="text-xs">Total posts</CardDescription>
            <CardTitle className="text-2xl font-bold">{posts.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">tracked</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardDescription className="text-xs">Avg likes</CardDescription>
            <CardTitle className="text-2xl font-bold">
              {formatNumber(
                engagementSummary?.avg_likes ??
                  (posts.length > 0
                    ? Math.round(posts.reduce((s, p) => s + (p.likes ?? 0), 0) / posts.length)
                    : null)
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">per post</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardDescription className="text-xs">Avg views</CardDescription>
            <CardTitle className="text-2xl font-bold">
              {formatNumber(
                engagementSummary?.avg_views ??
                  (posts.length > 0
                    ? Math.round(posts.reduce((s, p) => s + (p.views ?? 0), 0) / posts.length)
                    : null)
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">per post</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardDescription className="text-xs">Trend</CardDescription>
            <CardTitle className={`text-base font-semibold pt-1 flex items-center gap-1.5 ${trendColor}`}>
              <TrendIcon className="h-4 w-4" />
              {engagementSummary?.trend ?? "—"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">from AI analysis</p>
          </CardContent>
        </Card>
      </div>

      {/* Engagement charts */}
      {postsAsc.length > 0 ? (
        <ProfileCharts posts={postsAsc} />
      ) : (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">No post data yet — click Scrape Now above.</p>
          </CardContent>
        </Card>
      )}

      {/* Posts table */}
      <div className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">All Posts</h2>
          <p className="text-xs text-muted-foreground">
            Top 10 by likes highlighted green · Bottom 10 red · Click a row to expand caption
          </p>
        </div>
        {posts.length > 0 ? (
          <PostsTable posts={posts} />
        ) : (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">No posts tracked yet.</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Latest AI analysis */}
      <div className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">Latest AI Analysis</h2>
          <p className="text-xs text-muted-foreground">
            {latestAnalysis
              ? `Run on ${formatDate(latestAnalysis.created_at)}`
              : "No analysis run yet — click Run Analysis above"}
          </p>
        </div>

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

        {recs.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {recs.map((rec) => (
              <Card key={rec.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start gap-2">
                    <span
                      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium shrink-0 mt-0.5 ${priorityStyles[rec.priority] ?? ""}`}
                    >
                      {rec.priority}
                    </span>
                    <CardTitle className="text-sm font-medium leading-snug">{rec.title}</CardTitle>
                  </div>
                  <CardDescription className="text-xs capitalize">{rec.category}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground leading-relaxed">{rec.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : latestAnalysis ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">No recommendations in this analysis.</p>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  )
}
