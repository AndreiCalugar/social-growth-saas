import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"
import { decryptToken, encryptToken } from "@/lib/meta/oauth"
import { refreshLongLivedToken } from "@/lib/meta/client"

/**
 * Refresh Instagram long-lived tokens nearing expiry (60-day tokens; refresh
 * anything expiring within 10 days). Adapted from OpenReply's
 * app/api/cron/refresh-tokens (MIT), Prisma → Supabase, minus workspace
 * usage-period resets. Run daily via system cron:
 *
 *   0 4 * * * curl -s -H "Authorization: Bearer $CRON_SECRET" \
 *     https://www.getsocialgrowth.tech/api/cron/refresh-tokens
 */

const DAYS_BEFORE_EXPIRY = 10

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET || process.env.NEXTAUTH_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const cutoff = new Date(
    Date.now() + DAYS_BEFORE_EXPIRY * 24 * 60 * 60 * 1000
  ).toISOString()

  const { data: accounts } = await supabase
    .from("instagram_accounts")
    .select("id, username, access_token")
    .neq("access_token", "")
    .not("token_expires_at", "is", null)
    .lte("token_expires_at", cutoff)

  const results: Array<{
    id: string
    username: string
    status: "refreshed" | "failed"
    error?: string
  }> = []

  for (const account of accounts ?? []) {
    try {
      const currentToken = decryptToken(account.access_token)
      const { accessToken: newToken, expiresIn } =
        await refreshLongLivedToken(currentToken)

      await supabase
        .from("instagram_accounts")
        .update({
          access_token: encryptToken(newToken),
          token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
          token_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", account.id)

      results.push({ id: account.id, username: account.username, status: "refreshed" })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error"
      // Surface the dead token on the account so the UI can prompt reconnect.
      await supabase
        .from("instagram_accounts")
        .update({
          token_error: `Token refresh failed: ${message}`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", account.id)
      results.push({ id: account.id, username: account.username, status: "failed", error: message })
    }
  }

  return NextResponse.json({
    success: true,
    totalProcessed: (accounts ?? []).length,
    results,
  })
}
