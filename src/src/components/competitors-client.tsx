"use client"

import { useState, useMemo } from "react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { PostsTable } from "@/components/posts-table"
import { Users, Clock, TrendingUp } from "lucide-react"

interface Profile {
  id: string
  username: string
  followers: number | null
  last_scraped: string | null
  is_own: boolean
}

interface Post {
  id: string
  profile_id: string
  posted_at: string | null
  caption: string | null
  likes: number | null
  comments: number | null
  views: number | null
  engagement_rate: number | null
  content_type: string | null
}

interface Props {
  ownProfile: Profile | null
  competitors: Profile[]
  allPosts: Post[]
}

// ─── Stopwords ────────────────────────────────────────────────────────────────
const STOPWORDS = new Set([
  "this","that","with","from","have","your","they","their","been","what","when",
  "will","would","could","should","about","there","just","more","some","into",
  "than","then","like","also","only","very","over","such","these","those",
  "after","before","while","even","where","here","does","each","much","both",
  "come","came","being","were","which","through","post","using","make","made",
  "most","many","well","said","know","think","need",
])

function tokenize(text: string | null): string[] {
  if (!text) return []
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w))
}

function computeMetrics(posts: Post[]) {
  if (posts.length === 0) return { avgLikes: 0, avgComments: 0, postsPerWeek: 0, topContentType: "—", avgEngagement: 0 }

  const avgLikes = Math.round(posts.reduce((s, p) => s + (p.likes ?? 0), 0) / posts.length)
  const avgComments = Math.round(posts.reduce((s, p) => s + (p.comments ?? 0), 0) / posts.length)
  const avgEngagement = parseFloat((posts.reduce((s, p) => s + (p.engagement_rate ?? 0), 0) / posts.length).toFixed(2))

  const dates = posts.map((p) => new Date(p.posted_at ?? 0).getTime()).filter(Boolean)
  const span = dates.length > 1 ? (Math.max(...dates) - Math.min(...dates)) / (1000 * 60 * 60 * 24 * 7) : 1
  const postsPerWeek = parseFloat((posts.length / Math.max(span, 1)).toFixed(1))

  const typeCounts: Record<string, number> = {}
  for (const p of posts) {
    const t = p.content_type ?? "other"
    typeCounts[t] = (typeCounts[t] ?? 0) + 1
  }
  const topContentType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—"

  return { avgLikes, avgComments, postsPerWeek, topContentType, avgEngagement }
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

const CHART_COLORS = [
  "#7c3aed", // purple (you)
  "#059669", // emerald
  "#d97706", // amber
  "#2563eb", // blue
  "#db2777", // pink
]

// ─── MetricRow ────────────────────────────────────────────────────────────────
function MetricRow({ label, ownValue, compValue }: { label: string; ownValue: string | number; compValue: string | number }) {
  const ownNum = typeof ownValue === "number" ? ownValue : null
  const compNum = typeof compValue === "number" ? compValue : null
  const max = Math.max(ownNum ?? 0, compNum ?? 0)

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-2 border-b last:border-0">
      <div className="text-right">
        <p className="text-sm font-semibold">{typeof ownValue === "number" ? formatNumber(ownValue) : ownValue}</p>
        {ownNum != null && max > 0 && (
          <div className="mt-1 h-1.5 rounded-full bg-slate-100 overflow-hidden flex justify-end">
            <div className="h-full rounded-full bg-purple-600" style={{ width: `${(ownNum / max) * 100}%` }} />
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground text-center whitespace-nowrap px-2">{label}</p>
      <div>
        <p className="text-sm font-semibold">{typeof compValue === "number" ? formatNumber(compValue) : compValue}</p>
        {compNum != null && max > 0 && (
          <div className="mt-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full rounded-full bg-amber-500" style={{ width: `${(compNum / max) * 100}%` }} />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export function CompetitorsClient({ ownProfile, competitors, allPosts }: Props) {
  const [selectedId, setSelectedId] = useState<string>(competitors[0]?.id ?? "")

  const competitor = competitors.find((c) => c.id === selectedId) ?? null
  const ownPosts = useMemo(() => allPosts.filter((p) => p.profile_id === ownProfile?.id), [allPosts, ownProfile])
  const compPosts = useMemo(() => allPosts.filter((p) => p.profile_id === selectedId), [allPosts, selectedId])

  const ownMetrics = useMemo(() => computeMetrics(ownPosts), [ownPosts])
  const compMetrics = useMemo(() => computeMetrics(compPosts), [compPosts])

  // All profiles overview (own + competitors)
  const allProfiles = useMemo(() => {
    const result = []
    if (ownProfile) {
      const posts = allPosts.filter((p) => p.profile_id === ownProfile.id)
      result.push({ profile: ownProfile, metrics: computeMetrics(posts), isOwn: true })
    }
    for (const c of competitors) {
      const posts = allPosts.filter((p) => p.profile_id === c.id)
      result.push({ profile: c, metrics: computeMetrics(posts), isOwn: false })
    }
    return result
  }, [allPosts, ownProfile, competitors])

  // Chart data for avg engagement across all profiles
  const engagementChartData = allProfiles.map((item, i) => ({
    name: `@${item.profile.username}`,
    avgLikes: item.metrics.avgLikes,
    postsPerWeek: item.metrics.postsPerWeek,
    colorIndex: i,
  }))

  // Top 3 posts per competitor
  const topPostsByCompetitor = useMemo(() => {
    return competitors.map((c) => {
      const posts = allPosts
        .filter((p) => p.profile_id === c.id)
        .sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0))
        .slice(0, 3)
      return { profile: c, posts }
    })
  }, [competitors, allPosts])

  // Keyword diff
  const keywordDiff = useMemo(() => {
    const ownWords = new Set(ownPosts.flatMap((p) => tokenize(p.caption)))
    const compWordCounts: Record<string, number> = {}
    for (const word of compPosts.flatMap((p) => tokenize(p.caption))) {
      compWordCounts[word] = (compWordCounts[word] ?? 0) + 1
    }
    return Object.entries(compWordCounts)
      .filter(([word]) => !ownWords.has(word))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
  }, [ownPosts, compPosts])

  const tooltipStyle = {
    backgroundColor: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "10px",
    fontSize: "12px",
    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.07)",
  }
  const tickStyle = { fontSize: 11, fill: "#94a3b8" }

  if (competitors.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            No competitors added yet — use the form above to track your first one.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">

      {/* ── Overview table ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">All Accounts Overview</CardTitle>
          <CardDescription className="text-xs">Metrics across all tracked profiles</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Account</th>
                  <th className="text-right px-4 py-2 font-medium text-muted-foreground">Followers</th>
                  <th className="text-right px-4 py-2 font-medium text-muted-foreground">Posts</th>
                  <th className="text-right px-4 py-2 font-medium text-muted-foreground">Avg Likes</th>
                  <th className="text-right px-4 py-2 font-medium text-muted-foreground">Avg Comments</th>
                  <th className="text-right px-4 py-2 font-medium text-muted-foreground">Posts/wk</th>
                  <th className="text-right px-4 py-2 font-medium text-muted-foreground">Top Format</th>
                </tr>
              </thead>
              <tbody>
                {allProfiles.map(({ profile, metrics, isOwn }, i) => {
                  const postCount = allPosts.filter((p) => p.profile_id === profile.id).length
                  return (
                    <tr key={profile.id} className={`border-b last:border-0 ${isOwn ? "bg-purple-50/50" : "hover:bg-slate-50"}`}>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                          <span className="font-medium">@{profile.username}</span>
                          {isOwn && <span className="text-[9px] px-1 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 font-semibold">You</span>}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right">{formatNumber(profile.followers)}</td>
                      <td className="px-4 py-2.5 text-right">{postCount}</td>
                      <td className="px-4 py-2.5 text-right">{formatNumber(metrics.avgLikes)}</td>
                      <td className="px-4 py-2.5 text-right">{formatNumber(metrics.avgComments)}</td>
                      <td className="px-4 py-2.5 text-right">{metrics.postsPerWeek > 0 ? metrics.postsPerWeek : "—"}</td>
                      <td className="px-4 py-2.5 text-right capitalize">{metrics.topContentType}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ── Avg Likes bar chart ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Average Likes per Post</CardTitle>
          <CardDescription className="text-xs">Compared across all tracked accounts</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={engagementChartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214.3 31.8% 91.4%)" vertical={false} />
              <XAxis dataKey="name" tick={tickStyle} tickLine={false} axisLine={false} />
              <YAxis tick={tickStyle} tickLine={false} axisLine={false} width={45} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value) => [formatNumber(typeof value === "number" ? value : null), "Avg Likes"]} />
              <Bar dataKey="avgLikes" radius={[6, 6, 0, 0]}>
                {engagementChartData.map((entry) => (
                  <Cell key={entry.name} fill={CHART_COLORS[entry.colorIndex % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* ── Top 3 posts per competitor ── */}
      <div className="space-y-3">
        <h2 className="text-sm font-medium">Top 3 Posts per Competitor</h2>
        {topPostsByCompetitor.map(({ profile, posts }) => (
          <Card key={profile.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">@{profile.username}</CardTitle>
              {posts.length === 0 && (
                <CardDescription className="text-xs">No posts scraped yet</CardDescription>
              )}
            </CardHeader>
            {posts.length > 0 && (
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/40">
                        <th className="text-left px-4 py-2 font-medium text-muted-foreground">Date</th>
                        <th className="text-left px-4 py-2 font-medium text-muted-foreground">Type</th>
                        <th className="text-right px-4 py-2 font-medium text-muted-foreground">Likes</th>
                        <th className="text-right px-4 py-2 font-medium text-muted-foreground">Comments</th>
                        <th className="text-left px-4 py-2 font-medium text-muted-foreground w-[280px]">Caption</th>
                        <th className="px-4 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {posts.map((post) => (
                        <tr key={post.id} className="border-b last:border-0">
                          <td className="px-4 py-2.5 whitespace-nowrap">
                            {post.posted_at ? new Date(post.posted_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—"}
                          </td>
                          <td className="px-4 py-2.5 capitalize">{post.content_type ?? "—"}</td>
                          <td className="px-4 py-2.5 text-right font-medium">{formatNumber(post.likes)}</td>
                          <td className="px-4 py-2.5 text-right">{formatNumber(post.comments)}</td>
                          <td className="px-4 py-2.5 max-w-[280px]">
                            <p className="truncate text-muted-foreground">{post.caption ?? "—"}</p>
                          </td>
                          <td className="px-4 py-2.5" />
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      {/* ── Deep comparison (one-on-one) ── */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-sm font-medium">Deep Comparison</h2>
          {competitors.length > 1 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">vs:</span>
              {competitors.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    c.id === selectedId
                      ? "bg-purple-50 text-purple-700 border-purple-300"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  @{c.username}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Side-by-side header */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
          <Card className="border-purple-200 bg-purple-50/30">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-purple-600" />
                <CardTitle className="text-sm font-semibold">You — @{ownProfile?.username ?? "—"}</CardTitle>
              </div>
              <CardDescription className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1"><Users className="h-3 w-3" />{formatNumber(ownProfile?.followers)}</span>
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDate(ownProfile?.last_scraped)}</span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{ownPosts.length} posts tracked</p>
            </CardContent>
          </Card>

          <Card className="border-orange-300/60">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-orange-400" />
                <CardTitle className="text-sm font-semibold">@{competitor?.username ?? "—"}</CardTitle>
              </div>
              <CardDescription className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1"><Users className="h-3 w-3" />{formatNumber(competitor?.followers)}</span>
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDate(competitor?.last_scraped)}</span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{compPosts.length} posts tracked</p>
            </CardContent>
          </Card>
        </div>

        {/* Metric rows + bar chart */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Head-to-head metrics</CardTitle>
              <div className="flex items-center gap-4 mt-1">
                <span className="flex items-center gap-1.5 text-xs"><span className="inline-block h-2 w-2 rounded-full bg-purple-600" />You</span>
                <span className="flex items-center gap-1.5 text-xs"><span className="inline-block h-2 w-2 rounded-full bg-orange-400" />Competitor</span>
              </div>
            </CardHeader>
            <CardContent>
              <MetricRow label="Avg Likes" ownValue={ownMetrics.avgLikes} compValue={compMetrics.avgLikes} />
              <MetricRow label="Avg Comments" ownValue={ownMetrics.avgComments} compValue={compMetrics.avgComments} />
              <MetricRow label="Posts/week" ownValue={ownMetrics.postsPerWeek} compValue={compMetrics.postsPerWeek} />
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-2">
                <p className="text-sm font-semibold text-right capitalize">{ownMetrics.topContentType}</p>
                <p className="text-xs text-muted-foreground text-center px-2">Top format</p>
                <p className="text-sm font-semibold capitalize">{compMetrics.topContentType}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Engagement comparison</CardTitle>
              <CardDescription className="text-xs">Avg per post</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={[
                    { metric: "Avg Likes", you: ownMetrics.avgLikes, them: compMetrics.avgLikes },
                    { metric: "Avg Comments", you: ownMetrics.avgComments, them: compMetrics.avgComments },
                  ]}
                  margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(214.3 31.8% 91.4%)" vertical={false} />
                  <XAxis dataKey="metric" tick={tickStyle} tickLine={false} axisLine={false} />
                  <YAxis tick={tickStyle} tickLine={false} axisLine={false} width={45} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="you" name="You" fill="#7c3aed" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="them" name="Competitor" fill="#d97706" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Keyword diff */}
        {keywordDiff.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-orange-500" />
                What they talk about that you don&apos;t
              </CardTitle>
              <CardDescription className="text-xs">
                Keywords in @{competitor?.username}&apos;s captions not found in yours — ranked by frequency
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {keywordDiff.map(([word, count]) => (
                  <span
                    key={word}
                    className="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-700"
                  >
                    {word}
                    <span className="text-orange-400 text-[10px]">×{count}</span>
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Competitor posts table */}
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-medium">@{competitor?.username} — All Posts</h3>
            <p className="text-xs text-muted-foreground">Top 10 by likes highlighted green</p>
          </div>
          {compPosts.length > 0 ? (
            <PostsTable posts={compPosts} />
          ) : (
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">
                  No posts scraped yet — scrape queued, will appear in ~2 minutes.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
