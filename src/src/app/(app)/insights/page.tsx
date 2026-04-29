export const dynamic = "force-dynamic"

import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { auth } from "@/lib/auth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { InsightsClient } from "@/components/insights-client"

export default async function InsightsPage() {
  const session = await auth()
  const userId = session!.user.id

  const { data: ownProfile } = await supabase
    .from("profiles")
    .select("id, username")
    .eq("user_id", userId)
    .eq("is_own", true)
    .maybeSingle()

  const { data: competitorsWithPosts } = await supabase
    .from("profiles")
    .select("id, posts(count)")
    .eq("user_id", userId)
    .eq("is_own", false)

  const competitorCount = (competitorsWithPosts ?? []).filter(
    (c) => Array.isArray(c.posts) && c.posts.length > 0
  ).length

  // Fetch latest trend insights for own profile
  let insights: {
    id: string
    trend_name: string
    confidence: number | null
    performance_multiplier: number | null
    example_posts: unknown
    recommendation: string | null
    is_mega_tip: boolean | null
    created_at: string
    one_line_summary: string | null
    competitor_count: number | null
    total_competitors: number | null
    content_format: string | null
    hook: string | null
    caption_structure: string | null
    best_time: string | null
    hashtags: string[] | null
    competitor_edge: string | null
    trend_type: string | null
    detected_niche: string | null
  }[] = []
  let detectedNiche: string | null = null

  if (ownProfile) {
    const { data: latest } = await supabase
      .from("trend_insights")
      .select("created_at")
      .eq("profile_id", ownProfile.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (latest) {
      const cutoff = new Date(new Date(latest.created_at).getTime() - 10 * 60 * 1000).toISOString()
      const { data } = await supabase
        .from("trend_insights")
        .select(
          "id, trend_name, confidence, performance_multiplier, example_posts, recommendation, is_mega_tip, created_at, one_line_summary, competitor_count, total_competitors, content_format, hook, caption_structure, best_time, hashtags, competitor_edge, trend_type, detected_niche"
        )
        .eq("profile_id", ownProfile.id)
        .gte("created_at", cutoff)
        .order("performance_multiplier", { ascending: false })
      insights = data ?? []
      // Every row in the same run carries the same niche; pick the
      // first non-null value for the subtitle.
      detectedNiche = insights.find((i) => i.detected_niche)?.detected_niche ?? null
    }
  }

  // Map every trend_insight_id this user has saved → its saved_brief id, so the
  // Insights cards can swap "Save & Customize" for "Edit brief". Tolerate the
  // table not existing yet (schema/007 not run) by treating it as empty.
  let savedBriefMap: Record<string, string> = {}
  let totalSavedBriefs = 0
  if (insights.length > 0) {
    const { data: savedRows, error: savedErr } = await supabase
      .from("saved_briefs")
      .select("id, trend_insight_id")
      .eq("user_id", userId)
      .in("trend_insight_id", insights.map((i) => i.id))
    if (savedErr) {
      const tableMissing =
        savedErr.code === "42P01" ||
        savedErr.message?.includes("does not exist") ||
        savedErr.message?.includes("schema cache")
      if (!tableMissing) console.error("[insights page] saved_briefs lookup:", savedErr.message)
    } else {
      for (const row of savedRows ?? []) {
        if (row.trend_insight_id) savedBriefMap[row.trend_insight_id] = row.id
      }
    }
  }
  // Total count for the "View your content plan" banner — always reflects every
  // saved brief, not just ones whose trend_insight is in the current run.
  const { count: totalCount, error: totalErr } = await supabase
    .from("saved_briefs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
  if (!totalErr && typeof totalCount === "number") totalSavedBriefs = totalCount

  if (competitorCount < 3) {
    return (
      <div className="p-4 sm:p-6 max-w-2xl">
        <div className="mb-6">
          <h1 className="text-xl font-semibold">Insights</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cross-competitor trend detection engine
          </p>
        </div>
        <Card className="border-dashed">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <div className="text-4xl">📊</div>
            <div>
              <h2 className="text-base font-semibold mb-1">
                Add at least 3 competitors to unlock trend insights
              </h2>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                The insights engine analyzes posts across all your competitor accounts to detect
                what content patterns consistently outperform — then tells you exactly what to create.
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              You currently have {competitorCount} competitor{competitorCount === 1 ? "" : "s"} with scraped data.
              Need {Math.max(0, 3 - competitorCount)} more.
            </p>
            <Link
              href="/profiles"
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Add Competitors
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <InsightsClient
      ownProfileId={ownProfile?.id ?? null}
      ownUsername={ownProfile?.username ?? null}
      userId={userId}
      initialInsights={insights}
      competitorCount={competitorCount}
      initialSavedBriefMap={savedBriefMap}
      totalSavedBriefs={totalSavedBriefs}
      detectedNiche={detectedNiche}
    />
  )
}
