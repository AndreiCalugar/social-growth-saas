export const dynamic = "force-dynamic"

import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { auth } from "@/lib/auth"
import { AddProfileModal } from "@/components/add-profile-modal"
import { ProfileCardActions } from "@/components/profile-card-actions"
import { ScrapingCardOverlay } from "@/components/scraping-card-overlay"
import { formatNumber, formatRelativeTime } from "@/lib/format"
import { Clock, FileText, TrendingUp, ArrowRight, Sparkles } from "lucide-react"

export default async function ProfilesPage() {
  const session = await auth()
  const userId = session!.user.id

  const profilesRes = await supabase
    .from("profiles")
    .select("id, username, followers, last_scraped, is_own")
    .eq("user_id", userId)
    .order("is_own", { ascending: false })
    .order("username", { ascending: true })

  const profiles = profilesRes.data ?? []
  const profileIds = profiles.map((p) => p.id)

  const postsRes = await supabase
    .from("posts")
    .select("profile_id, engagement_rate, likes")
    .in("profile_id", profileIds.length > 0 ? profileIds : ["00000000-0000-0000-0000-000000000000"])

  const posts = postsRes.data ?? []

  // Build per-profile stats
  const statsByProfile: Record<string, { count: number; avgEngagement: number | null; avgLikes: number | null }> = {}
  for (const profile of profiles) {
    const profilePosts = posts.filter((p) => p.profile_id === profile.id)
    const count = profilePosts.length
    const avgEngagement = count > 0
      ? profilePosts.reduce((sum, p) => sum + (p.engagement_rate ?? 0), 0) / count
      : null
    const avgLikes = count > 0
      ? profilePosts.reduce((sum, p) => sum + (p.likes ?? 0), 0) / count
      : null
    statsByProfile[profile.id] = { count, avgEngagement, avgLikes }
  }

  const ownProfiles = profiles.filter((p) => p.is_own)
  const competitors = profiles.filter((p) => !p.is_own)

  return (
    <div className="p-4 sm:p-6 space-y-8 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Profiles</h1>
          <p className="text-sm text-slate-500">Click any profile for a deep analysis of their posts — top performers, content mix, posting cadence, and trends</p>
        </div>
        <AddProfileModal />
      </div>

      {/* Own profiles */}
      {ownProfiles.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Your Profile</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ownProfiles.map((profile) => {
              const stats = statsByProfile[profile.id]
              return (
                <ProfileCard
                  key={profile.id}
                  profile={profile}
                  stats={stats}
                  badge={<span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-sm">Own</span>}
                />
              )
            })}
          </div>
        </section>
      )}

      {/* Competitors */}
      {competitors.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Competitors</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {competitors.map((profile) => {
              const stats = statsByProfile[profile.id]
              return (
                <ProfileCard
                  key={profile.id}
                  profile={profile}
                  stats={stats}
                />
              )
            })}
          </div>
        </section>
      )}

      {profiles.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 px-6 text-center">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center shadow-sm mb-5">
            <Sparkles className="h-7 w-7 text-white" />
          </div>
          <h3 className="text-lg font-semibold text-slate-800">No profiles yet</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mt-2">
            Add your Instagram account and a few competitors to start detecting what content is working.
          </p>
        </div>
      )}
    </div>
  )
}

interface ProfileCardProps {
  profile: { id: string; username: string; followers: number | null; last_scraped: string | null; is_own: boolean }
  stats: { count: number; avgEngagement: number | null; avgLikes: number | null }
  badge?: React.ReactNode
}

function scrapeStatus(last_scraped: string | null): { dot: string; label: string; pulse: boolean } {
  if (!last_scraped) return { dot: "bg-slate-300", label: "Never scraped", pulse: false }
  const ageHours = (Date.now() - new Date(last_scraped).getTime()) / (1000 * 60 * 60)
  if (ageHours < 24 * 7) return { dot: "bg-emerald-500", label: "Fresh", pulse: false }
  if (ageHours < 24 * 30) return { dot: "bg-amber-500", label: "Getting stale", pulse: true }
  return { dot: "bg-red-500", label: "Needs rescrape", pulse: true }
}

function ProfileCard({ profile, stats, badge }: ProfileCardProps) {
  const initials = profile.username.charAt(0).toUpperCase()
  const status = scrapeStatus(profile.last_scraped)
  return (
    <div className="group relative h-full">
      <ScrapingCardOverlay profileId={profile.id} />
      <Link href={`/profiles/${profile.id}`}>
        <div className="h-full rounded-xl border border-slate-200/60 bg-white hover:bg-gradient-to-br hover:from-white hover:to-purple-50/30 p-6 shadow-sm hover:shadow-md hover:border-purple-200 hover:scale-[1.01] transition-all cursor-pointer flex flex-col">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative shrink-0">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center shadow-sm ring-2 ring-white">
                  <span className="text-sm font-bold text-white">{initials}</span>
                </div>
                <span
                  className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-white ${status.dot} ${status.pulse ? "animate-pulse" : ""}`}
                  aria-label={status.label}
                  title={status.label}
                />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">@{profile.username}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{status.label}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {badge}
              <ProfileCardActions profileId={profile.id} username={profile.username} />
            </div>
          </div>

          <div className="mt-4 space-y-1.5 flex-1">
            <p className="text-xs text-slate-500 flex items-center gap-1.5">
              <FileText className="h-3 w-3 text-slate-400" />
              {stats.count} posts tracked
            </p>
            {stats.avgLikes != null && (
              <p className="text-xs text-slate-500 flex items-center gap-1.5">
                <TrendingUp className="h-3 w-3 text-slate-400" />
                {formatNumber(Math.round(stats.avgLikes))} avg likes
              </p>
            )}
            <p className="text-xs text-slate-500 flex items-center gap-1.5">
              <Clock className="h-3 w-3 text-slate-400" />
              {profile.last_scraped ? `Scraped ${formatRelativeTime(profile.last_scraped)}` : "Never scraped"}
            </p>
          </div>

          <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-100 text-xs font-medium text-purple-600 group-hover:text-purple-700">
            <span>View deep analysis</span>
            <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
          </div>
        </div>
      </Link>
    </div>
  )
}
