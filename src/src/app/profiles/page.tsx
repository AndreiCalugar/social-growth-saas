export const dynamic = "force-dynamic"

import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { AddProfileModal } from "@/components/add-profile-modal"
import { ProfileCardActions } from "@/components/profile-card-actions"
import { formatNumber, formatRelativeTime } from "@/lib/format"
import { Users, Clock, FileText, TrendingUp } from "lucide-react"

export default async function ProfilesPage() {
  const [profilesRes, postsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, username, followers, last_scraped, is_own")
      .order("is_own", { ascending: false })
      .order("username", { ascending: true }),
    supabase
      .from("posts")
      .select("profile_id, engagement_rate, likes"),
  ])

  const profiles = profilesRes.data ?? []
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
    <div className="p-6 space-y-8 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Profiles</h1>
          <p className="text-sm text-muted-foreground">Manage tracked Instagram accounts</p>
        </div>
        <AddProfileModal />
      </div>

      {/* Own profiles */}
      {ownProfiles.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Your Profile</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ownProfiles.map((profile) => {
              const stats = statsByProfile[profile.id]
              return (
                <ProfileCard
                  key={profile.id}
                  profile={profile}
                  stats={stats}
                  badge={<span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">Own</span>}
                />
              )
            })}
          </div>
        </section>
      )}

      {/* Competitors */}
      {competitors.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Competitors</h2>
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
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              No profiles yet — click "Add Profile" to get started.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

interface ProfileCardProps {
  profile: { id: string; username: string; followers: number | null; last_scraped: string | null; is_own: boolean }
  stats: { count: number; avgEngagement: number | null; avgLikes: number | null }
  badge?: React.ReactNode
}

function ProfileCard({ profile, stats, badge }: ProfileCardProps) {
  return (
    <div className="group relative">
      <Link href={`/profiles/${profile.id}`}>
        <Card className="hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer h-full">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">@{profile.username}</CardTitle>
              <div className="flex items-center gap-1.5">
                {badge}
                <ProfileCardActions profileId={profile.id} username={profile.username} />
              </div>
            </div>
            <CardDescription className="flex items-center gap-1.5 text-xs">
              <Users className="h-3 w-3" />
              {formatNumber(profile.followers)} followers
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1.5">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <FileText className="h-3 w-3" />
              {stats.count} posts
            </p>
            {stats.avgLikes != null && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                {formatNumber(Math.round(stats.avgLikes))} avg likes
              </p>
            )}
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {profile.last_scraped ? `Scraped ${formatRelativeTime(profile.last_scraped)}` : "Never scraped"}
            </p>
          </CardContent>
        </Card>
      </Link>
    </div>
  )
}
