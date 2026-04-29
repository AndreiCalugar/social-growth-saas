export const dynamic = "force-dynamic"

import { supabase } from "@/lib/supabase"
import { auth } from "@/lib/auth"
import { BriefsListClient } from "@/components/briefs-list-client"
import type { SavedBrief } from "@/components/brief-workshop"

const SAVED_BRIEF_COLUMNS =
  "id, user_id, trend_insight_id, trend_name, trend_type, performance_multiplier, original_content, original_hook, original_caption, original_posting_time, original_hashtags, original_competitor_edge, hook_variations, content_angles, caption_variations, chosen_hook, chosen_content, chosen_caption, chosen_posting_time, chosen_hashtags, user_notes, scheduled_date, scheduled_time, status, created_at, updated_at" as const

export default async function BriefsPage() {
  const session = await auth()
  const userId = session!.user.id

  // Tolerate the schema/007 migration not being applied yet — render the
  // empty state instead of crashing the page.
  let briefs: SavedBrief[] = []
  let tableMissing = false

  const { data, error } = await supabase
    .from("saved_briefs")
    .select(SAVED_BRIEF_COLUMNS)
    .eq("user_id", userId)

  if (error) {
    if (
      error.code === "42P01" ||
      error.message?.includes("does not exist") ||
      error.message?.includes("schema cache")
    ) {
      tableMissing = true
    } else {
      throw new Error(error.message)
    }
  } else {
    briefs = (data ?? []) as SavedBrief[]
  }

  return <BriefsListClient initialBriefs={briefs} tableMissing={tableMissing} />
}
