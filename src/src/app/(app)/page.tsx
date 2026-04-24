export const dynamic = "force-dynamic"

import { supabase } from "@/lib/supabase"
import { auth } from "@/lib/auth"
import { formatNumber, formatRelativeTime } from "@/lib/format"
import { RunAnalysisButton } from "@/components/run-analysis-button"
import { OnboardingLanding } from "@/components/onboarding-landing"
import Link from "next/link"
import {
  Users, Sparkles, ArrowRight, Zap, ChevronRight,
  TrendingUp, TrendingDown, Minus,
  Clapperboard, Fish, FileText, Clock, Hash,
  Heart, Calendar, Trophy, Clock3,
  RefreshCw, UserPlus,
} from "lucide-react"

// ---------------------------------------------------------------------------
// Stage detection
//
// The overview is progressive. The user's journey goes:
//   Stage 1  — Profile scraped, no analysis yet, no competitors yet.
//              Show a clean snapshot computed from raw posts + two CTAs.
//   Stage 2  — Analysis run. Show AI verdict + the top recommendation.
//              Still nudge toward competitors (or toward Generate Insights
//              if they've already added competitors but not generated yet).
//   Stage 3  — Insights generated. Show account health with competitor
//              comparison + the top content brief as a personal "assignment"
//              + compact stats.
//
// Each stage subsumes the one before: a stage-3 user doesn't need to see
// "run your first analysis" again.
// ---------------------------------------------------------------------------

type Stage = 1 | 2 | 3

interface DashboardData {
  ownProfile: { id: string; username: string; last_scraped: string | null } | null
  stage: Stage

  // Snapshot (all stages)
  avgLikes: number
  postsPerWeek: number
  bestPost: { likes: number; caption: string; posted_at: string | null } | null
  mostRecentPostAt: string | null
  postCount: number

  // Stage 2+
  engagementSummary: {
    trend?: string
    trend_reasoning?: string
    avg_likes?: number
  } | null
  latestAnalysisAt: string | null
  topRecommendation: { title: string; description: string; priority: string } | null
  totalRecommendations: number

  // Stage 3
  competitorCount: number
  competitorAvgLikes: number | null
  topBrief: TopBrief | null
  trendCount: number
  megaTipCount: number
  activity: ActivityItem[]
}

type ActivityItem =
  | { kind: "scrape"; at: string; username: string; posts: number | null }
  | { kind: "analysis"; at: string; username: string; trend: string | null }
  | { kind: "insights"; at: string; count: number; megaTipCount: number }
  | { kind: "competitor_added"; at: string; username: string }

interface TopBrief {
  trend_name: string
  one_line_summary: string | null
  performance_multiplier: number | null
  competitor_count: number | null
  total_competitors: number | null
  is_mega_tip: boolean
  recommendation: string | null
  content_format: string | null
  hook: string | null
  caption_structure: string | null
  best_time: string | null
  hashtags: string[] | null
}

async function getDashboardData(userId: string): Promise<DashboardData> {
  const { data: ownProfile } = await supabase
    .from("profiles")
    .select("id, username, last_scraped")
    .eq("user_id", userId)
    .eq("is_own", true)
    .maybeSingle()

  const ownProfileId = ownProfile?.id ?? null

  const { data: allProfiles } = await supabase
    .from("profiles")
    .select("id, is_own")
    .eq("user_id", userId)

  const competitorIds = (allProfiles ?? []).filter((p) => !p.is_own).map((p) => p.id)
  const competitorCount = competitorIds.length

  const empty: DashboardData = {
    ownProfile: ownProfile ?? null,
    stage: 1,
    avgLikes: 0,
    postsPerWeek: 0,
    bestPost: null,
    mostRecentPostAt: null,
    postCount: 0,
    engagementSummary: null,
    latestAnalysisAt: null,
    topRecommendation: null,
    totalRecommendations: 0,
    competitorCount,
    competitorAvgLikes: null,
    topBrief: null,
    trendCount: 0,
    megaTipCount: 0,
    activity: [],
  }

  if (!ownProfileId) return empty

  // Fetch everything the overview might need in parallel. Each query is cheap
  // and Supabase pooling handles the fan-out; the chosen stage just decides
  // which of these slices get rendered.
  const [
    postsRes,
    bestPostRes,
    latestAnalysisRes,
    topRecRes,
    totalRecsRes,
    insightsRes,
    competitorPostsRes,
  ] = await Promise.all([
    supabase
      .from("posts")
      .select("posted_at, likes")
      .eq("profile_id", ownProfileId)
      .order("posted_at", { ascending: false })
      .limit(100),
    supabase
      .from("posts")
      .select("likes, caption, posted_at")
      .eq("profile_id", ownProfileId)
      .order("likes", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("analyses")
      .select("created_at, engagement_summary")
      .eq("profile_id", ownProfileId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("recommendations")
      .select("title, description, priority")
      .eq("profile_id", ownProfileId)
      .order("priority", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("recommendations")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", ownProfileId),
    supabase
      .from("trend_insights")
      .select(
        "trend_name, one_line_summary, performance_multiplier, competitor_count, total_competitors, is_mega_tip, recommendation, content_format, hook, caption_structure, best_time, hashtags"
      )
      .eq("profile_id", ownProfileId)
      .order("is_mega_tip", { ascending: false })
      .order("performance_multiplier", { ascending: false })
      .limit(20),
    competitorIds.length > 0
      ? supabase
          .from("posts")
          .select("likes")
          .in("profile_id", competitorIds)
      : Promise.resolve({ data: [] as { likes: number | null }[] }),
  ])

  const posts = postsRes.data ?? []
  const avgLikes =
    posts.length > 0
      ? Math.round(posts.reduce((s, p) => s + (p.likes ?? 0), 0) / posts.length)
      : 0

  // Posts-per-week: average over the time span between the earliest and
  // latest post in the window. Falls back to 0 on a brand-new profile.
  let postsPerWeek = 0
  if (posts.length >= 2) {
    const dates = posts
      .map((p) => (p.posted_at ? new Date(p.posted_at).getTime() : null))
      .filter((t): t is number => typeof t === "number")
    if (dates.length >= 2) {
      const spanMs = Math.max(...dates) - Math.min(...dates)
      const spanWeeks = spanMs / (1000 * 60 * 60 * 24 * 7)
      postsPerWeek = spanWeeks > 0 ? Math.round((dates.length / spanWeeks) * 10) / 10 : 0
    }
  }

  const bestPost = bestPostRes.data
    ? {
        likes: bestPostRes.data.likes ?? 0,
        caption: bestPostRes.data.caption ?? "",
        posted_at: bestPostRes.data.posted_at ?? null,
      }
    : null

  const mostRecentPostAt = posts[0]?.posted_at ?? null

  const latestAnalysis = latestAnalysisRes.data
  const engagementSummary =
    (latestAnalysis?.engagement_summary as DashboardData["engagementSummary"]) ?? null

  const topRec = topRecRes.data
    ? {
        title: topRecRes.data.title ?? "Recommendation",
        description: topRecRes.data.description ?? "",
        priority: topRecRes.data.priority ?? "medium",
      }
    : null

  const insights = insightsRes.data ?? []
  const megaTips = insights.filter((i) => i.is_mega_tip === true)
  const topBriefRow = megaTips[0] ?? insights[0] ?? null
  const topBrief: TopBrief | null = topBriefRow
    ? {
        trend_name: topBriefRow.trend_name ?? "Trend",
        one_line_summary: topBriefRow.one_line_summary ?? null,
        performance_multiplier: topBriefRow.performance_multiplier ?? null,
        competitor_count: topBriefRow.competitor_count ?? null,
        total_competitors: topBriefRow.total_competitors ?? null,
        is_mega_tip: topBriefRow.is_mega_tip === true,
        recommendation: topBriefRow.recommendation ?? null,
        content_format: topBriefRow.content_format ?? null,
        hook: topBriefRow.hook ?? null,
        caption_structure: topBriefRow.caption_structure ?? null,
        best_time: topBriefRow.best_time ?? null,
        hashtags: parseHashtags(topBriefRow.hashtags),
      }
    : null

  const competitorPosts = (competitorPostsRes.data ?? []) as { likes: number | null }[]
  const competitorAvgLikes =
    competitorPosts.length > 0
      ? Math.round(
          competitorPosts.reduce((s, p) => s + (p.likes ?? 0), 0) / competitorPosts.length
        )
      : null

  // Stage resolution
  const hasOwnProfile = posts.length > 0
  const hasAnalysis = !!latestAnalysis
  const hasInsights = insights.length > 0

  let stage: Stage = 1
  if (hasOwnProfile && hasAnalysis && hasInsights) stage = 3
  else if (hasOwnProfile && hasAnalysis) stage = 2

  // Activity feed is only shown on Stage 3 — no point paying the queries
  // earlier when the section won't render.
  const allProfileIds = (allProfiles ?? []).map((p) => p.id)
  const activity =
    stage === 3
      ? await fetchRecentActivity({
          userId,
          ownProfileId,
          allProfileIds,
        })
      : []

  return {
    ownProfile: ownProfile ?? null,
    stage,
    avgLikes,
    postsPerWeek,
    bestPost,
    mostRecentPostAt,
    postCount: posts.length,
    engagementSummary,
    latestAnalysisAt: latestAnalysis?.created_at ?? null,
    topRecommendation: topRec,
    totalRecommendations: totalRecsRes.count ?? 0,
    competitorCount,
    competitorAvgLikes,
    topBrief,
    trendCount: insights.length,
    megaTipCount: megaTips.length,
    activity,
  }
}

async function fetchRecentActivity({
  userId,
  ownProfileId,
  allProfileIds,
}: {
  userId: string
  ownProfileId: string
  allProfileIds: string[]
}): Promise<ActivityItem[]> {
  const safeIds = allProfileIds.length > 0 ? allProfileIds : ["00000000-0000-0000-0000-000000000000"]

  const [scrapeRes, analysisRes, insightsRes, competitorsRes] = await Promise.all([
    supabase
      .from("scrape_runs")
      .select("completed_at, posts_scraped, profiles(username)")
      .in("profile_id", safeIds)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(5),
    supabase
      .from("analyses")
      .select("created_at, engagement_summary, profiles(username)")
      .in("profile_id", safeIds)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("trend_insights")
      .select("created_at, is_mega_tip")
      .eq("profile_id", ownProfileId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("profiles")
      .select("username, created_at")
      .eq("user_id", userId)
      .eq("is_own", false)
      .order("created_at", { ascending: false })
      .limit(5),
  ])

  const items: ActivityItem[] = []

  for (const r of scrapeRes.data ?? []) {
    const uname = (r.profiles as unknown as { username: string } | null)?.username
    if (!r.completed_at || !uname) continue
    items.push({ kind: "scrape", at: r.completed_at, username: uname, posts: r.posts_scraped ?? null })
  }

  for (const r of analysisRes.data ?? []) {
    const uname = (r.profiles as unknown as { username: string } | null)?.username
    if (!r.created_at || !uname) continue
    const trend = (r.engagement_summary as { trend?: string } | null)?.trend ?? null
    items.push({ kind: "analysis", at: r.created_at, username: uname, trend })
  }

  // Group trend_insights rows that were generated in the same batch (within
  // a 10-minute window) into a single "insights refreshed" event. Most runs
  // produce 3–7 rows; showing each as its own line would dominate the feed.
  const insightRows = (insightsRes.data ?? []).filter((r) => r.created_at)
  const batches: { at: string; count: number; megaTipCount: number }[] = []
  for (const r of insightRows) {
    const t = new Date(r.created_at as string).getTime()
    const mega = r.is_mega_tip === true
    const last = batches[batches.length - 1]
    if (last && t >= new Date(last.at).getTime() - 10 * 60 * 1000) {
      last.count += 1
      if (mega) last.megaTipCount += 1
    } else {
      batches.push({ at: r.created_at as string, count: 1, megaTipCount: mega ? 1 : 0 })
    }
  }
  for (const b of batches) {
    items.push({ kind: "insights", at: b.at, count: b.count, megaTipCount: b.megaTipCount })
  }

  for (const r of competitorsRes.data ?? []) {
    if (!r.created_at || !r.username) continue
    items.push({ kind: "competitor_added", at: r.created_at, username: r.username })
  }

  items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
  return items.slice(0, 5)
}

function parseHashtags(raw: unknown): string[] | null {
  if (Array.isArray(raw)) return raw.map(String).map((t) => t.replace(/^#/, "").trim()).filter(Boolean)
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed.map(String).map((t) => t.replace(/^#/, "").trim()).filter(Boolean)
    } catch {}
  }
  return null
}

export default async function OverviewPage() {
  const session = await auth()
  const userId = session!.user.id
  const data = await getDashboardData(userId)

  const { ownProfile } = data

  // True zero-profile user → the marketing landing. A user who added an own
  // profile but whose scrape isn't done yet (postCount === 0) still counts
  // as "has a profile" and gets Stage 1 below; we show a "scrape in progress"
  // hint instead of zeroed stats so nothing looks broken.
  const totalProfiles = data.competitorCount + (ownProfile ? 1 : 0)
  if (!ownProfile && totalProfiles === 0) return <OnboardingLanding />

  if (!ownProfile) {
    return (
      <div className="p-6 max-w-xl mx-auto mt-16 text-center">
        <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center shadow-sm mb-5">
          <TrendingUp className="h-7 w-7 text-white" />
        </div>
        <h1 className="text-lg font-semibold text-slate-900">Add your own Instagram profile</h1>
        <p className="text-sm text-slate-500 mt-2">
          You&apos;ve added competitors — now add your own account so we can compare and generate insights.
        </p>
        <Link
          href="/profiles"
          className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-purple-700 transition-colors shadow-sm mt-5"
        >
          Add your own profile <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-4xl">
      <OverviewHeader
        username={ownProfile.username}
        profileId={ownProfile.id}
        lastScraped={ownProfile.last_scraped}
      />

      {data.postCount === 0 ? (
        <ScrapeInProgressCard />
      ) : data.stage === 3 ? (
        <Stage3 data={data} />
      ) : data.stage === 2 ? (
        <Stage2 data={data} />
      ) : (
        <Stage1 data={data} />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Header — always the same: greeting + Run Analysis button (if profile scraped)
// ---------------------------------------------------------------------------

function OverviewHeader({
  username,
  profileId,
  lastScraped,
}: {
  username: string
  profileId: string
  lastScraped: string | null
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Overview</h1>
        <p className="text-sm text-slate-500 truncate">
          @{username}
          {lastScraped && ` · Last scraped ${formatRelativeTime(lastScraped)}`}
        </p>
      </div>
      <div className="shrink-0">
        <RunAnalysisButton profileId={profileId} username={username} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Stage 1 — Profile scraped, no analysis, no insights
// ---------------------------------------------------------------------------

function Stage1({ data }: { data: DashboardData }) {
  return (
    <div className="space-y-4">
      <AccountSnapshotCard data={data} />
      <RunAnalysisCTA />
      <AddCompetitorsCTA competitorCount={data.competitorCount} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Stage 2 — Analysis exists, no insights yet
// ---------------------------------------------------------------------------

function Stage2({ data }: { data: DashboardData }) {
  return (
    <div className="space-y-4">
      <AccountHealthCard data={data} showCompetitorComparison={false} />
      <TopRecommendationCard data={data} />
      {data.competitorCount >= 3 ? (
        <GenerateInsightsCTA competitorCount={data.competitorCount} />
      ) : (
        <AddCompetitorsCTA competitorCount={data.competitorCount} />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Stage 3 — Full experience
// ---------------------------------------------------------------------------

function Stage3({ data }: { data: DashboardData }) {
  return (
    <div className="space-y-4">
      <AccountHealthCard data={data} showCompetitorComparison={true} />
      <TopContentBriefCard data={data} />
      <CompactStatsRow data={data} />
      {data.topBrief && (
        <Link href="/insights" className="block group">
          <div className="relative bg-white rounded-xl border border-slate-200/60 shadow-sm hover:shadow-md hover:border-amber-200 transition-all overflow-hidden border-l-4 border-l-amber-500">
            <div
              className="border-shimmer pointer-events-none absolute inset-x-0 top-0 h-[3px]"
              aria-hidden
            />
            <div className="p-5 flex items-center gap-4">
              <div className="h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-sm">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900">
                  {data.trendCount} trend{data.trendCount !== 1 ? "s" : ""} detected · {data.megaTipCount} to try
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  See every insight we&apos;ve generated and copy the full briefs.
                </p>
              </div>
              <span className="text-xs font-semibold text-amber-600 shrink-0 flex items-center gap-1">
                View all <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </div>
          </div>
        </Link>
      )}

      {data.activity.length > 0 && <RecentActivitySection items={data.activity} />}
    </div>
  )
}

function RecentActivitySection({ items }: { items: ActivityItem[] }) {
  return (
    <section className="rounded-xl border border-slate-200/60 bg-white p-6 shadow-sm">
      <h2 className="text-[10px] font-bold uppercase tracking-[0.18em] text-purple-700">
        What&apos;s been happening
      </h2>
      <ul className="mt-4 space-y-3">
        {items.map((item, i) => (
          <li key={i}>
            <ActivityRow item={item} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const { icon: Icon, tint, label, detail } = formatActivity(item)
  return (
    <div className="flex items-start gap-3">
      <div className={`h-8 w-8 shrink-0 rounded-lg flex items-center justify-center ${tint}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-slate-900 leading-snug">{label}</p>
        {detail && <p className="text-[11px] text-slate-500 mt-0.5">{detail}</p>}
      </div>
      <span className="text-[11px] text-slate-400 shrink-0 tabular-nums mt-0.5">
        {formatRelativeTime(item.at)}
      </span>
    </div>
  )
}

function formatActivity(item: ActivityItem): {
  icon: React.ComponentType<{ className?: string }>
  tint: string
  label: React.ReactNode
  detail?: string
} {
  if (item.kind === "scrape") {
    return {
      icon: RefreshCw,
      tint: "bg-purple-50 text-purple-600",
      label: (
        <>
          Scraped <span className="font-semibold">@{item.username}</span>
        </>
      ),
      detail: item.posts != null ? `${item.posts} posts` : undefined,
    }
  }
  if (item.kind === "analysis") {
    const trendColor =
      item.trend === "growing"
        ? "text-emerald-600"
        : item.trend === "declining"
        ? "text-red-600"
        : "text-amber-600"
    return {
      icon: Sparkles,
      tint: "bg-amber-50 text-amber-600",
      label: (
        <>
          Analysis ran for <span className="font-semibold">@{item.username}</span>
          {item.trend && (
            <>
              {" — "}
              <span className={`font-medium ${trendColor}`}>{item.trend}</span>
            </>
          )}
        </>
      ),
    }
  }
  if (item.kind === "insights") {
    return {
      icon: Zap,
      tint: "bg-amber-50 text-amber-600",
      label: (
        <>
          Insights refreshed —{" "}
          <span className="font-semibold">
            {item.count} trend{item.count !== 1 ? "s" : ""}
          </span>{" "}
          detected
        </>
      ),
      detail: item.megaTipCount > 0 ? `${item.megaTipCount} mega-tip${item.megaTipCount !== 1 ? "s" : ""} ready` : undefined,
    }
  }
  // competitor_added
  return {
    icon: UserPlus,
    tint: "bg-indigo-50 text-indigo-600",
    label: (
      <>
        Added <span className="font-semibold">@{item.username}</span> to tracking
      </>
    ),
  }
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

function AccountSnapshotCard({ data }: { data: DashboardData }) {
  return (
    <section className="rounded-xl border border-slate-200/60 bg-white p-6 shadow-sm">
      <h2 className="text-[10px] font-bold uppercase tracking-[0.18em] text-purple-700">
        Your account snapshot
      </h2>
      <p className="text-lg font-semibold text-slate-900 mt-1">
        Here&apos;s how @{data.ownProfile?.username} looks right now.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mt-5">
        <StatRow
          icon={Heart}
          tint="bg-purple-50 text-purple-600"
          label="Average likes per post"
          value={formatNumber(data.avgLikes)}
        />
        <StatRow
          icon={Calendar}
          tint="bg-emerald-50 text-emerald-600"
          label="Posting frequency"
          value={`${data.postsPerWeek} / week`}
          hint={data.postsPerWeek === 0 ? "Needs ≥ 2 posts to calculate" : undefined}
        />
        <StatRow
          icon={Clock3}
          tint="bg-sky-50 text-sky-600"
          label="Most recent post"
          value={data.mostRecentPostAt ? formatRelativeTime(data.mostRecentPostAt) : "—"}
        />
        <StatRow
          icon={Trophy}
          tint="bg-amber-50 text-amber-600"
          label="Best post"
          value={data.bestPost ? `${formatNumber(data.bestPost.likes)} likes` : "—"}
          hint={
            data.bestPost?.caption
              ? `"${truncate(cleanCaption(data.bestPost.caption), 80)}"`
              : undefined
          }
        />
      </div>
    </section>
  )
}

function AccountHealthCard({
  data,
  showCompetitorComparison,
}: {
  data: DashboardData
  showCompetitorComparison: boolean
}) {
  const trend = data.engagementSummary?.trend ?? "stable"
  const reasoning =
    data.engagementSummary?.trend_reasoning?.trim() ||
    fallbackReasoning(trend)

  const tone =
    trend === "growing"
      ? { label: "growing", bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", icon: TrendingUp, pill: "bg-emerald-600" }
      : trend === "declining"
      ? { label: "declining", bg: "bg-red-50", border: "border-red-200", text: "text-red-700", icon: TrendingDown, pill: "bg-red-600" }
      : { label: "stable", bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", icon: Minus, pill: "bg-amber-600" }
  const ToneIcon = tone.icon

  return (
    <section className="rounded-xl border border-slate-200/60 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[10px] font-bold uppercase tracking-[0.18em] text-purple-700">
            Your account health
          </h2>
          <p className="text-lg font-semibold text-slate-900 mt-1">
            Your engagement is{" "}
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-semibold ${tone.bg} ${tone.text} border ${tone.border} align-middle`}>
              <ToneIcon className="h-3.5 w-3.5" />
              {tone.label}
            </span>
            .
          </p>
        </div>
      </div>

      <p className="text-sm text-slate-600 leading-relaxed mt-3">{reasoning}</p>

      <div className="grid grid-cols-2 gap-3 mt-5">
        <div className="rounded-lg border border-slate-100 bg-slate-50/50 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Your avg likes</p>
          <p className="text-xl font-bold tabular-nums text-slate-900 mt-0.5">
            {formatNumber(data.engagementSummary?.avg_likes ?? data.avgLikes)}
          </p>
        </div>
        {showCompetitorComparison ? (
          <div className="rounded-lg border border-slate-100 bg-slate-50/50 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Competitor avg</p>
            <p className="text-xl font-bold tabular-nums text-slate-900 mt-0.5">
              {data.competitorAvgLikes != null ? formatNumber(data.competitorAvgLikes) : "—"}
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-slate-100 bg-slate-50/50 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Posts / week</p>
            <p className="text-xl font-bold tabular-nums text-slate-900 mt-0.5">
              {data.postsPerWeek}
            </p>
          </div>
        )}
      </div>
    </section>
  )
}

function TopRecommendationCard({ data }: { data: DashboardData }) {
  if (!data.topRecommendation) return null
  const priorityStyles: Record<string, string> = {
    high: "bg-red-50 text-red-700 border-red-100",
    medium: "bg-amber-50 text-amber-700 border-amber-100",
    low: "bg-emerald-50 text-emerald-700 border-emerald-100",
  }
  const priority = data.topRecommendation.priority
  const pill = priorityStyles[priority] ?? priorityStyles.medium
  return (
    <section className="rounded-xl border border-slate-200/60 bg-white p-6 shadow-sm border-l-4 border-l-purple-500">
      <div className="flex items-center gap-2 mb-2">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.18em] text-purple-700">
          #1 Recommendation
        </h2>
        <span className={`text-[10px] font-semibold uppercase tracking-wider rounded-full px-2 py-0.5 border ${pill}`}>
          {priority}
        </span>
      </div>
      <p className="text-base font-semibold text-slate-900 leading-snug">
        {data.topRecommendation.title}
      </p>
      <p className="text-sm text-slate-600 leading-relaxed mt-2">
        {data.topRecommendation.description}
      </p>
      {data.totalRecommendations > 1 && (
        <Link
          href={`/profiles/${data.ownProfile?.id}`}
          className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-purple-600 hover:text-purple-700"
        >
          View all {data.totalRecommendations} recommendations
          <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </section>
  )
}

function TopContentBriefCard({ data }: { data: DashboardData }) {
  const brief = data.topBrief
  if (!brief) return null

  const multiplier = brief.performance_multiplier ?? 0
  const fraction =
    brief.competitor_count != null && brief.total_competitors != null
      ? `Found in ${brief.competitor_count} of ${brief.total_competitors} competitors`
      : null

  const accent = brief.is_mega_tip
    ? { border: "border-l-amber-500", label: "Your assignment this week", chip: "bg-amber-50 text-amber-700 border-amber-100", chipText: "Try this" }
    : { border: "border-l-emerald-500", label: "You're already doing this", chip: "bg-emerald-50 text-emerald-700 border-emerald-100", chipText: "Keep going" }

  return (
    <section className={`rounded-xl border border-slate-200/60 bg-white p-6 shadow-sm border-l-4 ${accent.border}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.18em] text-purple-700">
          {accent.label}
        </h2>
        {multiplier > 0 && (
          <span className="inline-flex items-baseline gap-0.5 rounded-full bg-slate-900 px-3 py-1.5 text-sm font-bold text-white tabular-nums shadow-sm">
            {multiplier.toFixed(1)}
            <span className="text-[11px] font-semibold text-slate-300">×</span>
          </span>
        )}
      </div>

      <p className="text-base font-semibold text-slate-900 leading-snug mt-2">
        {brief.trend_name}
      </p>
      {brief.one_line_summary && (
        <p className="text-sm text-slate-600 leading-snug mt-1">{brief.one_line_summary}</p>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-3">
        {fraction && (
          <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
            <Users className="h-3 w-3" />
            {fraction}
          </span>
        )}
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold border ${accent.chip}`}>
          <Zap className="h-3 w-3" /> {accent.chipText}
        </span>
      </div>

      <div className="space-y-3 mt-5">
        {brief.content_format && (
          <BriefRow icon={Clapperboard} label="Content" tone="purple">
            {brief.content_format}
          </BriefRow>
        )}
        {brief.hook && (
          <BriefRow icon={Fish} label="Opening hook" tone="amber">
            {brief.hook}
          </BriefRow>
        )}
        {brief.caption_structure && (
          <BriefRow icon={FileText} label="Caption structure" tone="slate">
            <span className="whitespace-pre-line">{brief.caption_structure}</span>
          </BriefRow>
        )}
        {brief.best_time && (
          <BriefRow icon={Clock} label="Best time to post" tone="emerald">
            {brief.best_time}
          </BriefRow>
        )}
        {brief.hashtags && brief.hashtags.length > 0 && (
          <BriefRow icon={Hash} label="Hashtags" tone="slate">
            <div className="flex flex-wrap gap-1.5">
              {brief.hashtags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center rounded-full bg-white border border-slate-200 px-2.5 py-0.5 text-[11px] font-medium text-slate-700"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </BriefRow>
        )}
        {!hasStructuredBrief(brief) && brief.recommendation && (
          <div className="rounded-lg bg-amber-50 border border-amber-100 px-4 py-3">
            <p className="text-sm text-amber-900 leading-relaxed">{brief.recommendation}</p>
          </div>
        )}
      </div>
    </section>
  )
}

function hasStructuredBrief(b: TopBrief) {
  return !!(b.content_format || b.hook || b.caption_structure || b.best_time || (b.hashtags && b.hashtags.length))
}

function CompactStatsRow({ data }: { data: DashboardData }) {
  const items: { label: string; value: string }[] = [
    { label: "Avg likes", value: formatNumber(data.avgLikes) },
    { label: "Competitors", value: String(data.competitorCount) },
    { label: "Trends", value: String(data.trendCount) },
    {
      label: "Last analysis",
      value: data.latestAnalysisAt ? formatRelativeTime(data.latestAnalysisAt) : "—",
    },
  ]
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-3 rounded-xl border border-slate-200/60 bg-white px-5 py-4 shadow-sm">
      {items.map((it, i) => (
        <div key={i} className="flex items-baseline gap-2">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
            {it.label}
          </span>
          <span className="text-sm font-semibold tabular-nums text-slate-900">{it.value}</span>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// CTAs
// ---------------------------------------------------------------------------

function RunAnalysisCTA() {
  return (
    <section className="rounded-xl border border-purple-200 bg-gradient-to-br from-purple-50 to-white p-6 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="h-11 w-11 shrink-0 rounded-xl bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center shadow-sm">
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1">
          <h3 className="text-base font-semibold text-slate-900">
            Run your first analysis to get personalized recommendations
          </h3>
          <p className="text-sm text-slate-600 mt-1 leading-relaxed">
            Takes about 30 seconds. AI will analyze your posting patterns and tell you what&apos;s working.
          </p>
          <p className="text-xs text-slate-500 mt-3">
            Use the <span className="font-semibold text-purple-700">Run Analysis</span> button at the top right of this page.
          </p>
        </div>
      </div>
    </section>
  )
}

function AddCompetitorsCTA({ competitorCount }: { competitorCount: number }) {
  const remaining = Math.max(0, 3 - competitorCount)
  return (
    <Link
      href="/competitors"
      className="group block rounded-xl border border-slate-200/60 bg-white p-6 shadow-sm hover:shadow-md hover:border-purple-200 transition-all"
    >
      <div className="flex items-start gap-4">
        <div className="h-11 w-11 shrink-0 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-700 flex items-center justify-center shadow-sm">
          <Users className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            {competitorCount === 0
              ? "Then add 3–5 competitors to unlock the Insights Engine"
              : `Add ${remaining} more competitor${remaining === 1 ? "" : "s"} to unlock the Insights Engine`}
            <ArrowRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5" />
          </h3>
          <p className="text-sm text-slate-600 mt-1 leading-relaxed">
            Compares niche competitors to find content formats that get 5–12× more engagement, then turns each finding into a ready-to-film brief.
          </p>
          {competitorCount > 0 && (
            <p className="text-[11px] text-slate-500 mt-2 font-medium">
              {competitorCount}/3 added
            </p>
          )}
        </div>
      </div>
    </Link>
  )
}

function GenerateInsightsCTA({ competitorCount }: { competitorCount: number }) {
  return (
    <Link
      href="/insights"
      className="group block rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-6 shadow-sm hover:shadow-md transition-all"
    >
      <div className="flex items-start gap-4">
        <div className="h-11 w-11 shrink-0 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-sm">
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1">
          <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            You&apos;re ready — generate your first insights
            <ArrowRight className="h-4 w-4 text-amber-500 transition-transform group-hover:translate-x-0.5" />
          </h3>
          <p className="text-sm text-slate-600 mt-1 leading-relaxed">
            We&apos;ll analyze {competitorCount} competitors to find which content formats are outperforming in your niche.
          </p>
        </div>
      </div>
    </Link>
  )
}

function ScrapeInProgressCard() {
  return (
    <section className="rounded-xl border border-slate-200/60 bg-white p-6 shadow-sm text-center">
      <div className="mx-auto h-12 w-12 rounded-2xl bg-purple-100 flex items-center justify-center mb-4">
        <Sparkles className="h-6 w-6 text-purple-600" />
      </div>
      <p className="text-sm font-semibold text-slate-900">Scraping your profile…</p>
      <p className="text-xs text-slate-500 mt-1">
        This takes about 2 minutes. Your snapshot will appear here as soon as data arrives.
      </p>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

function StatRow({
  icon: Icon,
  tint,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>
  tint: string
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="flex items-start gap-3">
      <div className={`h-9 w-9 shrink-0 rounded-lg flex items-center justify-center ${tint}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
        <p className="text-base font-bold tabular-nums text-slate-900 leading-tight mt-0.5">
          {value}
        </p>
        {hint && <p className="text-[11px] text-slate-500 mt-1 leading-snug">{hint}</p>}
      </div>
    </div>
  )
}

const briefTone: Record<
  "purple" | "amber" | "slate" | "emerald",
  { bg: string; border: string; icon: string; label: string }
> = {
  purple: { bg: "bg-purple-50/60", border: "border-purple-100", icon: "text-purple-600", label: "text-purple-700" },
  amber:  { bg: "bg-amber-50/60",  border: "border-amber-100",  icon: "text-amber-600",  label: "text-amber-700" },
  slate:  { bg: "bg-slate-50/80",  border: "border-slate-100",  icon: "text-slate-500",  label: "text-slate-500" },
  emerald:{ bg: "bg-emerald-50/60",border: "border-emerald-100",icon: "text-emerald-600",label: "text-emerald-700" },
}

function BriefRow({
  icon: Icon,
  label,
  children,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  children: React.ReactNode
  tone: "purple" | "amber" | "slate" | "emerald"
}) {
  const t = briefTone[tone]
  return (
    <div className={`rounded-lg border ${t.border} ${t.bg} p-3`}>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={`h-3.5 w-3.5 ${t.icon}`} />
        <span className={`text-[10px] font-bold uppercase tracking-wider ${t.label}`}>{label}</span>
      </div>
      <div className="text-sm text-slate-800 leading-relaxed">{children}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Utils
// ---------------------------------------------------------------------------

function truncate(s: string, max: number): string {
  if (s.length <= max) return s
  return s.slice(0, max - 1).trimEnd() + "…"
}

function cleanCaption(s: string): string {
  return s.replace(/\s+/g, " ").trim()
}

function fallbackReasoning(trend: string): string {
  if (trend === "growing") return "Your engagement is trending up — whatever you're doing is working."
  if (trend === "declining") return "Engagement has been slipping. The recommendations below point at the likely cause."
  return "Engagement is holding steady. Small format experiments usually unlock growth from here."
}
