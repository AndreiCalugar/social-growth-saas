// Supabase helpers for connected Instagram accounts (instagram_accounts table).

import { supabase } from "@/lib/supabase"
import { decryptToken } from "@/lib/meta/oauth"

export interface InstagramAccountRow {
  id: string
  user_id: string
  instagram_id: string
  username: string
  name: string | null
  access_token: string
  token_expires_at: string | null
  token_error: string | null
  webhook_subscribed: boolean
  connected_at: string
}

export async function getAccountForUser(
  userId: string
): Promise<InstagramAccountRow | null> {
  const { data } = await supabase
    .from("instagram_accounts")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle()
  return (data as InstagramAccountRow | null) ?? null
}

export function getDecryptedToken(account: InstagramAccountRow): string {
  return decryptToken(account.access_token)
}

/**
 * Record a dead-token condition on the account so the UI can prompt a
 * reconnect. Cleared (set to null) on successful refresh or reconnect.
 */
export async function markTokenError(
  accountId: string,
  message: string | null
): Promise<void> {
  await supabase
    .from("instagram_accounts")
    .update({ token_error: message, updated_at: new Date().toISOString() })
    .eq("id", accountId)
}
