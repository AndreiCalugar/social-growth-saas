import { supabase } from "@/lib/supabase"

/**
 * Server-side helper used by /admin to compute the funnel + sources +
 * recent-user table. Kept out of the page file so the page stays focused
 * on layout and so the queries are easy to swap for a Postgres view if
 * we outgrow client-side aggregation.
 *
 * All counts are derived from raw rows on purpose: we don't yet have so
 * many users that DISTINCT-style aggregation justifies a custom RPC.
 */

export type FunnelStep = {
  label: string
  count: number
  /** Conversion vs the previous step. null on the first step. */
  conversionPct: number | null
}

export type SignupSourceRow = { source: string; count: number; pct: number }

export type RecentUserRow = {
  id: string
  email: string | null
  name: string | null
  signup_source: string | null
  created_at: string
  hasProfile: boolean
  hasInsights: boolean
}

export type AdminAnalytics = {
  funnel: FunnelStep[]
  signupSources: SignupSourceRow[]
  recentUsers: RecentUserRow[]
  /** True when schema/013 hasn't been applied yet — the page hides the
   *  Signup Sources section so it doesn't show "100% direct" misleadingly. */
  signupSourceColumnMissing: boolean
}

const COMPETITOR_THRESHOLD = 3

export async function fetchAdminAnalytics(): Promise<AdminAnalytics> {
  // Pull everything in parallel; each query is tiny on solo / pre-launch
  // scale, and Supabase's REST API doesn't expose SELECT DISTINCT for the
  // funnel counts we need.
  const [usersRes, profilesRes, insightsRes, briefsRes] = await Promise.all([
    supabase
      .from("users")
      .select("id, email, name, created_at, signup_source")
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, user_id, is_own"),
    supabase.from("trend_insights").select("profile_id"),
    supabase.from("saved_briefs").select("user_id"),
  ])

  // Tolerate signup_source not yet existing — refetch without it so we
  // don't 500 the admin page while schema/013 is pending.
  let usersRows = (usersRes.data ?? []) as Array<{
    id: string
    email: string | null
    name: string | null
    created_at: string
    signup_source: string | null
  }>
  let signupSourceColumnMissing = false
  if (
    usersRes.error &&
    (usersRes.error.code === "42703" ||
      usersRes.error.message?.includes("signup_source"))
  ) {
    signupSourceColumnMissing = true
    const retry = await supabase
      .from("users")
      .select("id, email, name, created_at")
      .order("created_at", { ascending: false })
    usersRows = (retry.data ?? []).map((u) => ({ ...u, signup_source: null }))
  } else if (usersRes.error) {
    throw new Error(usersRes.error.message)
  }

  const profilesRows = (profilesRes.data ?? []) as Array<{
    id: string
    user_id: string
    is_own: boolean | null
  }>
  const insightsRows = (insightsRes.data ?? []) as Array<{ profile_id: string }>
  const briefsRows = (briefsRes.data ?? []) as Array<{ user_id: string }>

  // profile_id -> user_id, so we can roll trend_insights up to users.
  const profileOwnerById = new Map<string, string>()
  for (const p of profilesRows) profileOwnerById.set(p.id, p.user_id)

  const usersWithProfile = new Set(profilesRows.map((p) => p.user_id))

  const competitorCountByUser = new Map<string, number>()
  for (const p of profilesRows) {
    if (p.is_own === true) continue
    competitorCountByUser.set(p.user_id, (competitorCountByUser.get(p.user_id) ?? 0) + 1)
  }
  const usersWithEnoughCompetitors = new Set<string>()
  for (const [userId, n] of competitorCountByUser) {
    if (n >= COMPETITOR_THRESHOLD) usersWithEnoughCompetitors.add(userId)
  }

  const usersWithInsights = new Set<string>()
  for (const i of insightsRows) {
    const userId = profileOwnerById.get(i.profile_id)
    if (userId) usersWithInsights.add(userId)
  }

  const usersWithBriefs = new Set(briefsRows.map((b) => b.user_id))

  const totalUsers = usersRows.length
  const steps: Array<{ label: string; count: number }> = [
    { label: "Signed up", count: totalUsers },
    { label: "Added a profile", count: usersWithProfile.size },
    { label: `Added ${COMPETITOR_THRESHOLD}+ competitors`, count: usersWithEnoughCompetitors.size },
    { label: "Generated insights", count: usersWithInsights.size },
    { label: "Saved a brief", count: usersWithBriefs.size },
  ]

  const funnel: FunnelStep[] = steps.map((s, i) => {
    if (i === 0) return { ...s, conversionPct: null }
    const prev = steps[i - 1].count
    const pct = prev === 0 ? 0 : Math.round((s.count / prev) * 100)
    return { ...s, conversionPct: pct }
  })

  // Signup sources — group nulls under "direct" so 100% of rows are
  // represented and the breakdown sums to total signups.
  const sourceCounts = new Map<string, number>()
  for (const u of usersRows) {
    const key = u.signup_source?.toLowerCase().trim() || "direct"
    sourceCounts.set(key, (sourceCounts.get(key) ?? 0) + 1)
  }
  const signupSources: SignupSourceRow[] = Array.from(sourceCounts.entries())
    .map(([source, count]) => ({
      source,
      count,
      pct: totalUsers === 0 ? 0 : Math.round((count / totalUsers) * 100),
    }))
    .sort((a, b) => b.count - a.count)

  const recentUsers: RecentUserRow[] = usersRows.slice(0, 20).map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    signup_source: u.signup_source,
    created_at: u.created_at,
    hasProfile: usersWithProfile.has(u.id),
    hasInsights: usersWithInsights.has(u.id),
  }))

  return { funnel, signupSources, recentUsers, signupSourceColumnMissing }
}
