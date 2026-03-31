export const dynamic = "force-dynamic"

import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { AddCompetitorForm } from "@/components/add-competitor-form"
import { CompetitorsClient } from "@/components/competitors-client"
import { DeleteCompetitorButton } from "@/components/delete-competitor-button"
import { Users, Clock } from "lucide-react"
import Link from "next/link"

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

export default async function CompetitorsPage() {
  const [profilesRes, postsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, username, followers, last_scraped, is_own")
      .order("is_own", { ascending: false })
      .order("username", { ascending: true }),
    supabase
      .from("posts")
      .select("id, profile_id, posted_at, caption, likes, comments, views, engagement_rate, content_type, url")
      .order("posted_at", { ascending: false }),
  ])

  const profiles = profilesRes.data ?? []
  const allPosts = postsRes.data ?? []

  const ownProfile = profiles.find((p) => p.is_own) ?? null
  const competitors = profiles.filter((p) => !p.is_own)

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Competitors</h1>
          <p className="text-sm text-muted-foreground">
            Track and compare against other Instagram accounts
          </p>
        </div>
        <AddCompetitorForm />
      </div>

      {/* Competitor cards list */}
      {competitors.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {competitors.map((c) => (
            <div key={c.id} className="group relative">
              <Link href={`/profiles/${c.id}`}>
                <Card className="hover:border-orange-300/60 hover:shadow-sm transition-all cursor-pointer">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-semibold">@{c.username}</CardTitle>
                      <DeleteCompetitorButton profileId={c.id} username={c.username} />
                    </div>
                    <CardDescription className="flex items-center gap-1.5 text-xs">
                      <Users className="h-3 w-3" />
                      {formatNumber(c.followers)} followers
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Scraped {formatDate(c.last_scraped)}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* Comparison section */}
      {ownProfile ? (
        <CompetitorsClient
          ownProfile={ownProfile}
          competitors={competitors}
          allPosts={allPosts}
        />
      ) : (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              Own profile not found. Run a scrape from the{" "}
              <Link href="/" className="text-primary underline underline-offset-2">Overview page</Link>{" "}
              first.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
