import { supabase } from "@/lib/supabase"

/**
 * With META_GRAPH_BASE_URL set the app talks to the Instagram simulator,
 * so it must only touch simulated accounts (instagram_id "sim_…"): real
 * people's queued DMs would otherwise be "sent" to the simulator and lost.
 * Null when talking to the real Instagram.
 */
export async function simulatorAccountIds(): Promise<string[] | null> {
  if (!process.env.META_GRAPH_BASE_URL) return null
  const { data } = await supabase
    .from("instagram_accounts")
    .select("id")
    .like("instagram_id", "sim\\_%")
  return (data ?? []).map((a) => a.id)
}
