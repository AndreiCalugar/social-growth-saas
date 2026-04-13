export const dynamic = "force-dynamic"

import { notFound } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { formatNumber, formatDate, formatRelativeTime } from "@/lib/format"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ScrapeNowButton } from "@/components/scrape-now-button"
import { RunAnalysisButton } from "@/components/run-analysis-button"
import { ProfileCharts } from "@/components/profile-charts"
import { PostsTable } from "@/components/posts-table"
import {
  Users, Clock, TrendingUp, TrendingDown, Minus,
  ThumbsUp, ThumbsDown, Sparkles, CalendarClock,
  BarChart3, Eye, Heart, MessageCircle,
} from "lucide-react"

const DAYS_ALL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
const DAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const PEAK_HOURS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]

const priorityStyles: Record<string, string> = {
  high: "bg-red-100 text-red-700 border-red-200",
  medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
  low: "bg-green-100 text-green-700 border-green-200",
}

type AIPost = {
  platform_post_id: string
  content_type: string
  likes: number
  comments?: number
  views?: number
  posted_at: string
  why_it_worked?: string
  why_it_underperformed?: string
  caption?: string
}

type BestTimes = {
  days_of_week: string[]
  hours_utc: number[]
  reasoning: string
}

type ContentBreakdown = Record<string, {
  count: number
  avg_likes: number
  avg_views?: number
  performance_note: string
}>

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
      .select("id, platform_post_id, posted_at, caption, likes, comments, views, engagement_rate, content_type")
      .eq("profile_id", id)
      .order("posted_at", { ascending: false }),
    supabase
      .from("analyses")
      .select("id, created_at, engagement_summary, top_posts, worst_posts, best_posting_times, content_type_breakdown")
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

  // Build caption lookup from scraped posts
  const captionById: Record<string, string> = {}
  for (const p of posts) {
    if (p.platform_post_id) captionById[p.platform_post_id] = p.caption ?? ""
  }

  // Enrich AI posts with captions
  const topPosts: AIPost[] = ((latestAnalysis?.top_posts as AIPost[]) ?? []).map((p) => ({
    ...p,
    caption: captionById[p.platform_post_id] ?? "",
  }))
  const worstPosts: AIPost[] = ((latestAnalysis?.worst_posts as AIPost[]) ?? []).map((p) => ({
    ...p,
    caption: captionById[p.platform_post_id] ?? "",
  }))

  const bestTimes = latestAnalysis?.best_posting_times as BestTimes | null
  const contentBreakdown = latestAnalysis?.content_type_breakdown as ContentBreakdown | null

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

  const postsAsc = [...posts].sort((a, b) =>
    new Date(a.posted_at ?? 0).getTime() - new Date(b.posted_at ?? 0).getTime()
  )

  return (
    <div className="p-6 space-y-8 max-w-5xl">
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
              {profile.last_scraped ? `Scraped ${formatRelativeTime(profile.last_scraped)}` : "Never scraped"}
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
          <CardHeader className="pb-1 pt-4">
            <CardDescription className="text-xs">Total posts</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums">{posts.length}</CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <p className="text-xs text-muted-foreground">tracked</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4">
            <CardDescription className="text-xs">Avg likes</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums">
              {formatNumber(
                engagementSummary?.avg_likes ??
                  (posts.length > 0
                    ? Math.round(posts.reduce((s, p) => s + (p.likes ?? 0), 0) / posts.length)
                    : null)
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <p className="text-xs text-muted-foreground">per post</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4">
            <CardDescription className="text-xs">Avg views</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums">
              {formatNumber(
                engagementSummary?.avg_views ??
                  (posts.length > 0
                    ? Math.round(posts.reduce((s, p) => s + (p.views ?? 0), 0) / posts.length)
                    : null)
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <p className="text-xs text-muted-foreground">per post</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4">
            <CardDescription className="text-xs">Trend</CardDescription>
            <CardTitle className={`text-base font-semibold pt-1 flex items-center gap-1.5 ${trendColor}`}>
              <TrendIcon className="h-4 w-4" />
              {engagementSummary?.trend ?? "—"}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <p className="text-xs text-muted-foreground">from AI analysis</p>
          </CardContent>
        </Card>
      </div>

      {/* No posts empty state */}
      {posts.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="pt-10 pb-10 text-center space-y-4">
            <div className="text-4xl">📭</div>
            <div>
              <p className="font-medium text-sm">No posts scraped yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Click &quot;Scrape Now&quot; above to fetch posts from @{profile.username}
              </p>
            </div>
            <ScrapeNowButton username={profile.username} />
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      {postsAsc.length > 0 && <ProfileCharts posts={postsAsc} />}

      {/* ── AI ANALYSIS SECTIONS ── */}
      {!latestAnalysis ? (
        <Card className="border-dashed border-primary/30 bg-primary/5">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-sm">Run AI analysis to unlock deeper insights</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                Claude will identify your top and worst posts, best posting times, and give you specific
                recommendations to grow faster.
              </p>
            </div>
            <RunAnalysisButton profileId={profile.id} />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Analysis timestamp */}
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">AI Analysis</h2>
            <span className="text-xs text-muted-foreground">
              Run {formatRelativeTime(latestAnalysis.created_at)}
            </span>
          </div>

          {/* Trend reasoning */}
          {engagementSummary?.trend_reasoning && (
            <Card className="border-dashed">
              <CardContent className="pt-4 pb-4">
                <p className="text-sm text-muted-foreground">
                  <span className={`font-medium ${trendColor}`}>
                    <TrendIcon className="inline h-3.5 w-3.5 mr-1" />
                    Trend:{" "}
                  </span>
                  {engagementSummary.trend_reasoning}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Best Posting Times */}
          {bestTimes && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-primary" />
                  <CardTitle className="text-sm font-semibold">Best Posting Times</CardTitle>
                </div>
                <CardDescription className="text-xs">Recommended by AI based on your top posts</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Days of week grid */}
                <div className="space-y-1.5">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Days</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {DAYS_ALL.map((day, i) => {
                      const isRecommended = bestTimes.days_of_week.includes(day)
                      return (
                        <span
                          key={day}
                          className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                            isRecommended
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {DAYS_SHORT[i]}
                        </span>
                      )
                    })}
                  </div>
                </div>

                {/* Hours grid */}
                <div className="space-y-1.5">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Hours (UTC)</p>
                  <div className="flex gap-1 flex-wrap">
                    {PEAK_HOURS.map((h) => {
                      const isRecommended = bestTimes.hours_utc.includes(h)
                      return (
                        <span
                          key={h}
                          className={`w-9 text-center py-1 rounded text-xs font-medium tabular-nums ${
                            isRecommended
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {h}:00
                        </span>
                      )
                    })}
                  </div>
                </div>

                {/* Reasoning */}
                <p className="text-xs text-muted-foreground leading-relaxed border-t pt-3">
                  {bestTimes.reasoning}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Top Posts */}
          {topPosts.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <ThumbsUp className="h-4 w-4 text-green-600" />
                <h3 className="text-sm font-semibold">Top Posts — What Worked</h3>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {topPosts.map((p, i) => (
                  <Card key={i} className="border-green-200/60 bg-green-50/20">
                    <CardContent className="pt-4 pb-4 space-y-3">
                      {/* Stats row */}
                      <div className="flex items-center gap-3 text-sm">
                        <span className="flex items-center gap-1 font-semibold tabular-nums">
                          <Heart className="h-3.5 w-3.5 text-rose-500" />
                          {formatNumber(p.likes)}
                        </span>
                        {p.views != null && (
                          <span className="flex items-center gap-1 text-muted-foreground text-xs tabular-nums">
                            <Eye className="h-3 w-3" />
                            {formatNumber(p.views)}
                          </span>
                        )}
                        {p.comments != null && (
                          <span className="flex items-center gap-1 text-muted-foreground text-xs tabular-nums">
                            <MessageCircle className="h-3 w-3" />
                            {formatNumber(p.comments)}
                          </span>
                        )}
                        <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground capitalize">
                          {p.content_type}
                        </span>
                      </div>

                      {/* Caption */}
                      {p.caption && (
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                          {p.caption}
                        </p>
                      )}

                      {/* Why it worked */}
                      {p.why_it_worked && (
                        <div className="rounded-md bg-green-100/60 border border-green-200/50 px-3 py-2">
                          <p className="text-[11px] font-medium text-green-800 mb-0.5">Why it worked</p>
                          <p className="text-xs text-green-700 leading-relaxed">{p.why_it_worked}</p>
                        </div>
                      )}

                      <p className="text-[10px] text-muted-foreground">{formatDate(p.posted_at)}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Worst Posts */}
          {worstPosts.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <ThumbsDown className="h-4 w-4 text-red-500" />
                <h3 className="text-sm font-semibold">Bottom Posts — What to Avoid</h3>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {worstPosts.map((p, i) => (
                  <Card key={i} className="border-red-200/60 bg-red-50/20">
                    <CardContent className="pt-4 pb-4 space-y-3">
                      {/* Stats row */}
                      <div className="flex items-center gap-3 text-sm">
                        <span className="flex items-center gap-1 font-semibold tabular-nums text-muted-foreground">
                          <Heart className="h-3.5 w-3.5 text-rose-400" />
                          {formatNumber(p.likes)}
                        </span>
                        {p.views != null && (
                          <span className="flex items-center gap-1 text-muted-foreground text-xs tabular-nums">
                            <Eye className="h-3 w-3" />
                            {formatNumber(p.views)}
                          </span>
                        )}
                        <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground capitalize">
                          {p.content_type}
                        </span>
                      </div>

                      {/* Caption */}
                      {p.caption && (
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                          {p.caption}
                        </p>
                      )}

                      {/* Why it underperformed */}
                      {p.why_it_underperformed && (
                        <div className="rounded-md bg-red-100/60 border border-red-200/50 px-3 py-2">
                          <p className="text-[11px] font-medium text-red-800 mb-0.5">Why it underperformed</p>
                          <p className="text-xs text-red-700 leading-relaxed">{p.why_it_underperformed}</p>
                        </div>
                      )}

                      <p className="text-[10px] text-muted-foreground">{formatDate(p.posted_at)}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Content Type Breakdown (AI enhanced) */}
          {contentBreakdown && Object.keys(contentBreakdown).length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  <CardTitle className="text-sm font-semibold">Content Type Breakdown</CardTitle>
                </div>
                <CardDescription className="text-xs">AI performance analysis per format</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="divide-y">
                  {Object.entries(contentBreakdown).map(([type, data]) => (
                    <div key={type} className="py-3 first:pt-0 last:pb-0 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium capitalize">{type}</span>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground tabular-nums">
                          <span>{data.count} posts</span>
                          <span className="flex items-center gap-1">
                            <Heart className="h-3 w-3 text-rose-400" />
                            {formatNumber(data.avg_likes)} avg
                          </span>
                          {data.avg_views != null && (
                            <span className="flex items-center gap-1">
                              <Eye className="h-3 w-3" />
                              {formatNumber(data.avg_views)} avg views
                            </span>
                          )}
                        </div>
                      </div>
                      {data.performance_note && (
                        <p className="text-xs text-muted-foreground leading-relaxed">{data.performance_note}</p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recommendations */}
          {recs.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Recommendations</h3>
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
            </div>
          )}
        </div>
      )}

      {/* All Posts table */}
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
    </div>
  )
}
