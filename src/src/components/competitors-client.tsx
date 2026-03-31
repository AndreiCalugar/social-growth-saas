"use client"

import { useState, useMemo } from "react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
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
  url: string | null
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
  "come","came","being","were","which","through","para","para","para","post",
  "using","make","made","most","many","well","said","know","think","need",
])

function tokenize(text: string | null): string[] {
  if (!text) return []
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w))
}

// ─── Metrics helpers ──────────────────────────────────────────────────────────
function computeMetrics(posts: Post[]) {
  if (posts.length === 0) return { avgLikes: 0, avgComments: 0, postsPerWeek: 0, topContentType: "—" }

  const avgLikes = Math.round(posts.reduce((s, p) => s + (p.likes ?? 0), 0) / posts.length)
  const avgComments = Math.round(posts.reduce((s, p) => s + (p.comments ?? 0), 0) / posts.length)

  const dates = posts.map((p) => new Date(p.posted_at ?? 0).getTime()).filter(Boolean)
  const span = dates.length > 1 ? (Math.max(...dates) - Math.min(...dates)) / (1000 * 60 * 60 * 24 * 7) : 1
  const postsPerWeek = parseFloat((posts.length / Math.max(span, 1)).toFixed(1))

  const typeCounts: Record<string, number> = {}
  for (const p of posts) {
    const t = p.content_type ?? "other"
    typeCounts[t] = (typeCounts[t] ?? 0) + 1
  }
  const topContentType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—"

  return { avgLikes, avgComments, postsPerWeek, topContentType }
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

// ─── Sub-components ───────────────────────────────────────────────────────────
function MetricRow({
  label,
  ownValue,
  compValue,
}: {
  label: string
  ownValue: string | number
  compValue: string | number
}) {
  const ownNum = typeof ownValue === "number" ? ownValue : null
  const compNum = typeof compValue === "number" ? compValue : null
  const max = Math.max(ownNum ?? 0, compNum ?? 0)

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-2 border-b last:border-0">
      <div className="text-right">
        <p className="text-sm font-semibold">{typeof ownValue === "number" ? formatNumber(ownValue) : ownValue}</p>
        {ownNum != null && max > 0 && (
          <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden flex justify-end">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${(ownNum / max) * 100}%` }}
            />
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground text-center whitespace-nowrap px-2">{label}</p>
      <div>
        <p className="text-sm font-semibold">{typeof compValue === "number" ? formatNumber(compValue) : compValue}</p>
        {compNum != null && max > 0 && (
          <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-orange-400"
              style={{ width: `${(compNum / max) * 100}%` }}
            />
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

  // Bar chart data — avg likes + avg comments
  const chartData = [
    { metric: "Avg Likes", you: ownMetrics.avgLikes, them: compMetrics.avgLikes },
    { metric: "Avg Comments", you: ownMetrics.avgComments, them: compMetrics.avgComments },
  ]

  // Keyword diff: terms in competitor captions not in own captions
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
    backgroundColor: "hsl(0 0% 100%)",
    border: "1px solid hsl(214.3 31.8% 91.4%)",
    borderRadius: "8px",
    fontSize: "12px",
  }
  const tickStyle = { fontSize: 11, fill: "hsl(215.4 16.3% 46.9%)" }

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
      {/* Competitor selector */}
      {competitors.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">Compare against:</span>
          {competitors.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                c.id === selectedId
                  ? "bg-orange-100 text-orange-700 border-orange-300"
                  : "bg-muted text-muted-foreground border-border hover:text-foreground"
              }`}
            >
              @{c.username}
            </button>
          ))}
        </div>
      )}

      {/* Side-by-side header */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="border-primary/30">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-primary" />
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
              <CardTitle className="text-sm font-semibold">Competitor — @{competitor?.username ?? "—"}</CardTitle>
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

      {/* Metrics comparison */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Metric rows */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Head-to-head metrics</CardTitle>
            <div className="flex items-center gap-4 mt-1">
              <span className="flex items-center gap-1.5 text-xs"><span className="inline-block h-2 w-2 rounded-full bg-primary" />You</span>
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

        {/* Bar chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Engagement comparison</CardTitle>
            <CardDescription className="text-xs">Avg per post</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(214.3 31.8% 91.4%)" vertical={false} />
                <XAxis dataKey="metric" tick={tickStyle} tickLine={false} axisLine={false} />
                <YAxis tick={tickStyle} tickLine={false} axisLine={false} width={45} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="you" name="You" fill="hsl(221.2 83.2% 53.3%)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="them" name="Competitor" fill="hsl(38 92% 50%)" radius={[3, 3, 0, 0]} />
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
              Keywords appearing in @{competitor?.username}&apos;s captions not found in yours — ranked by frequency
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
          <h2 className="text-base font-semibold">@{competitor?.username} — All Posts</h2>
          <p className="text-xs text-muted-foreground">
            Top 10 by likes highlighted green — these are the formats worth studying
          </p>
        </div>
        {compPosts.length > 0 ? (
          <PostsTable posts={compPosts} />
        ) : (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">
                No posts scraped yet — scrape is queued and will appear here in ~2 minutes.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
