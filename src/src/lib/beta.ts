// Beta access gate for DM automation (schema/019-beta-access.sql).
//
// While the Meta app is in Standard Access only Instagram Testers can
// connect, so new users request access and see "Connect Instagram" only once
// the admin approves them in /admin/beta. Turn the gate off after Meta grants
// Advanced Access.

import { supabase } from "@/lib/supabase"
import { isAdminEmail } from "@/lib/admin"

export const BETA_GATE_ENABLED = true

export type BetaStatus = "none" | "pending" | "approved"

export interface BetaRequest {
  status: BetaStatus
  instagram_username: string | null
}

export async function getBetaRequest(
  userId: string,
  email: string | null | undefined
): Promise<BetaRequest> {
  if (!BETA_GATE_ENABLED || isAdminEmail(email)) {
    return { status: "approved", instagram_username: null }
  }
  const { data, error } = await supabase
    .from("beta_access")
    .select("status, instagram_username")
    .eq("user_id", userId)
    .maybeSingle()
  // Table missing (migration not run yet) → don't lock anyone out.
  if (error) {
    console.warn("[beta] lookup failed, allowing access:", error.message)
    return { status: "approved", instagram_username: null }
  }
  if (!data) return { status: "none", instagram_username: null }
  return {
    status: data.status as BetaStatus,
    instagram_username: data.instagram_username,
  }
}

// Instagram usernames: letters, digits, dots, underscores, max 30.
export function normalizeInstagramUsername(raw: string): string | null {
  const handle = raw
    .trim()
    .replace(/^(https?:\/\/)?(www\.)?instagram\.com\//i, "")
    .replace(/^@/, "")
    .replace(/[/?#].*$/, "")
    .toLowerCase()
  return /^[a-z0-9._]{1,30}$/.test(handle) ? handle : null
}
