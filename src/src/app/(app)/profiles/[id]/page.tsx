export const dynamic = "force-dynamic"

import { notFound } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { auth } from "@/lib/auth"
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
  const session = await auth()
  const userId = session!.user.id

  const [profileRes, postsRes, analysisRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, username, followers, bio, last_scraped, is_own, user_id")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle(),
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
    <div className="p-4 sm:p-6 space-y-8 max-w-5xl">
      {/* Profile header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">@{profile.username}</h1>
            {profile.is_own && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                Own account
              </span>
            )}
          </div>
          {profile.bio && (
            <p className="text-sm text-muted-foreground max-w-lg">{profile.bio}</p>
          )}
          <div className="flex items-center gap-4 text-sm text-slate-500">
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
          <ScrapeNowButton username={profile.username} profileId={profile.id} />
          <RunAnalysisButton profileId={profile.id} username={profile.username} />
        </div>
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-1 pt-4">
            <CardDescription className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Total posts</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-slate-900">{posts.length}</CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <p className="text-xs text-slate-400">tracked</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4">
            <CardDescription className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Avg likes</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-slate-900">
              {formatNumber(
                engagementSummary?.avg_likes ??
                  (posts.length > 0
                    ? Math.round(posts.reduce((s, p) => s + (p.likes ?? 0), 0) / posts.length)
                    : null)
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <p className="text-xs text-slate-400">per post</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4">
            <CardDescription className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Avg views</CardDescription>
            <CardTitle className="text-2xl font-bold tabular-nums text-slate-900">
              {formatNumber(
                engagementSummary?.avg_views ??
                  (posts.length > 0
                    ? Math.round(posts.reduce((s, p) => s + (p.views ?? 0), 0) / posts.length)
                    : null)
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <p className="text-xs text-slate-400">per post</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4">
            <CardDescription className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Trend</CardDescription>
            <CardTitle className={`text-base font-semibold pt-1 flex items-center gap-1.5 ${trendColor}`}>
              <TrendIcon className="h-4 w-4" />
              {engagementSummary?.trend ?? "—"}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <p className="text-xs text-slate-400">from AI analysis</p>
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
            <ScrapeNowButton username={profile.username} profileId={profile.id} />
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      {postsAsc.length > 0 && <ProfileCharts posts={postsAsc} />}

      {/* ── AI ANALYSIS SECTIONS ── */}
      {!latestAnalysis ? (
        <Card className="border-dashed border-purple-200 bg-purple-50/30">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <div className="mx-auto h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="font-semibold text-sm text-slate-900">Run AI analysis to unlock deeper insights</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Claude will identify your top and worst posts, best posting times, and give you specific
                recommendations to grow faster.
              </p>
            </div>
            <RunAnalysisButton profileId={profile.id} username={profile.username} />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Analysis timestamp */}
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">AI Analysis</h2>
            <span className="text-xs text-slate-400">
              Run {formatRelativeTime(latestAnalysis.created_at)}
            </span>
          </div>

          {/* Trend reasoning */}
          {engagementSummary?.trend_reasoning && (
            <Card className="border-slate-200 bg-slate-50/50">
              <CardContent className="pt-4 pb-4">
                <p className="text-sm text-slate-600">
                  <span className={`font-semibold ${trendColor}`}>
                    <TrendIcon className="inline h-3.5 w-3.5 mr-1" />
                    {engagementSummary.trend}:{" "}
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
                  <CalendarClock className="h-4 w-4 text-purple-600" />
                  <CardTitle className="text-sm font-semibold">Best Posting Times</CardTitle>
                </div>
                <CardDescription className="text-xs">Recommended by AI based on your top posts</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Days of week */}
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Days</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {DAYS_ALL.map((day, i) => {
                      const isRecommended = bestTimes.days_of_week.includes(day)
                      return (
                        <span
                          key={day}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                            isRecommended
                              ? "bg-purple-600 text-white shadow-sm"
                              : "bg-slate-100 text-slate-400"
                          }`}
                        >
                          {DAYS_SHORT[i]}
                        </span>
                      )
                    })}
                  </div>
                </div>

                {/* Hours heatmap */}
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Hours (UTC)</p>
                  <div className="flex gap-1 flex-wrap">
                    {PEAK_HOURS.map((h) => {
                      const isRecommended = bestTimes.hours_utc.includes(h)
                      return (
                        <span
                          key={h}
                          className={`w-10 text-center py-1.5 rounded-lg text-[10px] font-semibold tabular-nums transition-colors ${
                            isRecommended
                              ? "bg-purple-600 text-white shadow-sm"
                              : "bg-slate-100 text-slate-400"
                          }`}
                        >
                          {h}:00
                        </span>
                      )
                    })}
                  </div>
                </div>

                {/* Reasoning */}
                <p className="text-xs text-slate-500 leading-relaxed border-t border-slate-100 pt-3">
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
                  <Card key={i} className="border-l-4 border-l-emerald-500 border-slate-200 overflow-hidden">
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
                        <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 capitalize font-medium">
                          {p.content_type}
                        </span>
                      </div>

                      {/* Caption */}
                      {p.caption && (
                        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                          {p.caption}
                        </p>
                      )}

                      {/* Why it worked */}
                      {p.why_it_worked && (
                        <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 mb-1">Why it worked</p>
                          <p className="text-xs text-emerald-900 leading-relaxed">{p.why_it_worked}</p>
                        </div>
                      )}

                      <p className="text-[10px] text-slate-400">{formatDate(p.posted_at)}</p>
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
                  <Card key={i} className="border-l-4 border-l-red-500 border-slate-200 overflow-hidden">
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
                        <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 capitalize font-medium">
                          {p.content_type}
                        </span>
                      </div>

                      {/* Caption */}
                      {p.caption && (
                        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                          {p.caption}
                        </p>
                      )}

                      {/* Why it underperformed */}
                      {p.why_it_underperformed && (
                        <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-red-700 mb-1">Why it underperformed</p>
                          <p className="text-xs text-red-900 leading-relaxed">{p.why_it_underperformed}</p>
                        </div>
                      )}

                      <p className="text-[10px] text-slate-400">{formatDate(p.posted_at)}</p>
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
                  <BarChart3 className="h-4 w-4 text-purple-600" />
                  <CardTitle className="text-sm font-semibold">Content Type Breakdown</CardTitle>
                </div>
                <CardDescription className="text-xs">AI performance analysis per format</CardDescription>
              </CardHeader>
              <CardContent>
                {(() => {
                  const entries = Object.entries(contentBreakdown)
                  const maxLikes = Math.max(...entries.map(([, d]) => d.avg_likes), 1)
                  const TYPE_COLORS: Record<string, string> = {
                    reel: "bg-purple-500",
                    carousel: "bg-emerald-500",
                    image: "bg-amber-500",
                    other: "bg-slate-400",
                  }
                  return (
                    <div className="divide-y divide-slate-100">
                      {entries.map(([type, data]) => (
                        <div key={type} className="py-3 first:pt-0 last:pb-0 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-slate-900 capitalize">{type}</span>
                            <div className="flex items-center gap-3 text-xs text-slate-500 tabular-nums">
                              <span>{data.count} posts</span>
                              <span className="flex items-center gap-1 font-medium text-slate-700">
                                <Heart className="h-3 w-3 text-rose-400" />
                                {formatNumber(data.avg_likes)} avg
                              </span>
                            </div>
                          </div>
                          {/* Horizontal bar */}
                          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${TYPE_COLORS[type] ?? TYPE_COLORS.other}`}
                              style={{ width: `${Math.round((data.avg_likes / maxLikes) * 100)}%` }}
                            />
                          </div>
                          {data.performance_note && (
                            <p className="text-xs text-slate-500 leading-relaxed">{data.performance_note}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                })()}
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
