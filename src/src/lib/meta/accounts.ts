// Supabase helpers for connected Instagram accounts (instagram_accounts table).

import { supabase } from "@/lib/supabase"
import { decryptToken } from "@/lib/meta/oauth"
import { getUserInfo } from "@/lib/meta/client"

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

// Public-facing account info for the UI — never includes the token.
export interface ConnectedInstagramAccount {
  id: string
  username: string
  name: string | null
  profile_picture_url: string | null
  followers_count: number | null
  token_error: string | null
  token_expires_at: string | null
  webhook_subscribed: boolean
  connected_at: string
}

/**
 * The user's connected account plus live profile info (picture, name,
 * followers) read from Instagram. Profile pictures are signed CDN URLs that
 * expire, so they're fetched per page load instead of stored. Falls back to
 * the stored row if Instagram is unreachable or the token is dead.
 */
export async function getConnectedAccount(
  userId: string
): Promise<ConnectedInstagramAccount | null> {
  const account = await getAccountForUser(userId)
  if (!account) return null

  const result: ConnectedInstagramAccount = {
    id: account.id,
    username: account.username,
    name: account.name,
    profile_picture_url: null,
    followers_count: null,
    token_error: account.token_error,
    token_expires_at: account.token_expires_at,
    webhook_subscribed: account.webhook_subscribed,
    connected_at: account.connected_at,
  }
  if (account.token_error) return result

  try {
    const info = await getUserInfo(getDecryptedToken(account))
    result.username = info.username ?? result.username
    result.name = info.name ?? result.name
    result.profile_picture_url = info.profile_picture_url ?? null
    result.followers_count = info.followers_count ?? null
  } catch (err) {
    console.warn("[accounts] live profile fetch failed", err)
  }
  return result
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
