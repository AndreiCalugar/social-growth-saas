export const dynamic = "force-dynamic"

import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Users, Clock } from "lucide-react"

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

export default async function ProfilesPage() {
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, followers, last_scraped, is_own")
    .order("is_own", { ascending: false })
    .order("username", { ascending: true })

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold">Profiles</h1>
        <p className="text-sm text-muted-foreground">All tracked Instagram accounts</p>
      </div>

      {profiles && profiles.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {profiles.map((profile) => (
            <Link key={profile.id} href={`/profiles/${profile.id}`}>
              <Card className="hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold">@{profile.username}</CardTitle>
                    {profile.is_own && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                        Own
                      </span>
                    )}
                  </div>
                  <CardDescription className="flex items-center gap-1.5 text-xs">
                    <Users className="h-3 w-3" />
                    {formatNumber(profile.followers)} followers
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Scraped {formatDate(profile.last_scraped)}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              No profiles tracked yet — trigger a scrape from the Overview page to add one.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
