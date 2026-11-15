import { supabase } from "@/lib/supabase"

/**
 * People who have messaged an account (schema/028). Instagram lets a
 * business message someone only within 24 hours of that person's last
 * message, so we remember when each person last wrote. It also tells a
 * first-time contact (welcome message) from someone we've seen before.
 */

export const MESSAGING_WINDOW_MS = 24 * 60 * 60 * 1000

/**
 * Record an incoming message. Returns whether we had seen this person
 * before. Before schema/028 (no table) everyone counts as known, so no
 * welcome message can fire by mistake.
 */
export async function recordInboundMessage(accountId: string, igsid: string): Promise<{ known: boolean }> {
  const { data: existing, error } = await supabase
    .from("instagram_contacts")
    .select("igsid")
    .eq("instagram_account_id", accountId)
    .eq("igsid", igsid)
    .maybeSingle()
  if (error) return { known: true }

  const { error: upsertError } = await supabase
    .from("instagram_contacts")
    .upsert(
      { instagram_account_id: accountId, igsid, last_inbound_at: new Date().toISOString() },
      { onConflict: "instagram_account_id,igsid" }
    )
  if (upsertError) console.warn("[contacts] could not record message:", upsertError.message)
  return { known: Boolean(existing) }
}

/** When this person last messaged the account, or null if never (or unknown). */
export async function lastInboundAt(accountId: string, igsid: string): Promise<Date | null> {
  const { data, error } = await supabase
    .from("instagram_contacts")
    .select("last_inbound_at")
    .eq("instagram_account_id", accountId)
    .eq("igsid", igsid)
    .maybeSingle()
  if (error || !data) return null
  return new Date(data.last_inbound_at)
}
