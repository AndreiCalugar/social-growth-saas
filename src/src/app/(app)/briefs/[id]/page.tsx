export const dynamic = "force-dynamic"

import Link from "next/link"
import { notFound } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { auth } from "@/lib/auth"
import { BriefWorkshop } from "@/components/brief-workshop"

const SAVED_BRIEF_COLUMNS =
  "id, user_id, trend_insight_id, trend_name, performance_multiplier, original_content, original_hook, original_caption, original_posting_time, original_hashtags, hook_variations, content_angles, caption_variations, chosen_hook, chosen_content, chosen_caption, chosen_posting_time, chosen_hashtags, user_notes, scheduled_date, scheduled_time, status, created_at, updated_at" as const

export default async function BriefWorkshopPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  const userId = session!.user.id
  const { id } = await params

  const { data: brief } = await supabase
    .from("saved_briefs")
    .select(SAVED_BRIEF_COLUMNS)
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle()

  if (!brief) {
    notFound()
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <Link
        href="/insights"
        className="inline-flex items-center text-xs font-semibold text-slate-500 hover:text-purple-700 mb-4"
      >
        ← Back to Insights
      </Link>
      <BriefWorkshop initialBrief={brief} />
    </div>
  )
}
