import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { supabase } from "@/lib/supabase"
import { getBaseUrl } from "@/lib/meta/env"
import {
  getLongLivedToken,
  getUserInfo,
  subscribeInstagramAccountToWebhooks,
} from "@/lib/meta/client"
import {
  encryptToken,
  exchangeCodeForToken,
  verifyOAuthState,
} from "@/lib/meta/oauth"
import { logConnectAttempt } from "@/lib/meta/connect-attempts"

/**
 * Instagram OAuth callback. Exchanges the code for a long-lived token,
 * resolves the professional account, subscribes it to our webhooks, and
 * stores the (encrypted) token. Adapted from OpenReply's
 * app/api/instagram/callback (MIT), Prisma → Supabase, workspace → user.
 *
 * Redirects back to /settings with ?instagram=<status> for toast feedback:
 *   connected | denied | invalid | forbidden | already_connected | failed
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code")
  const error = request.nextUrl.searchParams.get("error")
  const state = verifyOAuthState(request.nextUrl.searchParams.get("state"))
  const baseUrl = getBaseUrl()

  const session = await auth()
  // Attribute the attempt to whoever is signed in, else to the user the
  // signed state was issued for.
  const attemptUserId = session?.user?.id ?? state?.userId

  if (error) {
    if (attemptUserId) {
      const reason = [
        request.nextUrl.searchParams.get("error_reason"),
        request.nextUrl.searchParams.get("error_description"),
      ]
        .filter(Boolean)
        .join(": ")
      await logConnectAttempt(attemptUserId, "denied", reason || error)
    }
    return NextResponse.redirect(`${baseUrl}/settings?instagram=denied`)
  }

  if (!code || !state) {
    if (attemptUserId) await logConnectAttempt(attemptUserId, "invalid")
    return NextResponse.redirect(`${baseUrl}/settings?instagram=invalid`)
  }

  if (!session?.user?.id) {
    return NextResponse.redirect(`${baseUrl}/login`)
  }

  // The state was signed for the user who started the flow — reject a
  // callback landing in a different session.
  if (state.userId !== session.user.id) {
    await logConnectAttempt(session.user.id, "forbidden")
    return NextResponse.redirect(`${baseUrl}/settings?instagram=forbidden`)
  }

  try {
    const redirectUri = `${baseUrl}/api/instagram/callback`
    const { accessToken: shortLivedToken } = await exchangeCodeForToken(
      code,
      redirectUri
    )
    const { accessToken: longLivedToken, expiresIn } =
      await getLongLivedToken(shortLivedToken)
    const userInfo = await getUserInfo(longLivedToken)
    // Webhooks and the messaging API key off the professional account ID
    // (user_id), not the app-scoped `id`. Store user_id so comment webhooks
    // can be matched back to this account. Fall back to id if user_id is
    // ever absent.
    const instagramId = userInfo.user_id ?? userInfo.id

    // instagram_id is globally unique — one IG account, one tenant.
    const { data: existing } = await supabase
      .from("instagram_accounts")
      .select("id, user_id")
      .eq("instagram_id", instagramId)
      .maybeSingle()

    if (existing && existing.user_id !== session.user.id) {
      await logConnectAttempt(session.user.id, "already_connected", `@${userInfo.username}`)
      return NextResponse.redirect(
        `${baseUrl}/settings?instagram=already_connected`
      )
    }

    const encryptedToken = encryptToken(longLivedToken)
    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

    let webhookSubscribed = false
    try {
      const subscription = await subscribeInstagramAccountToWebhooks(
        instagramId,
        longLivedToken
      )
      webhookSubscribed = Boolean(subscription.success)
    } catch (subscriptionError) {
      console.warn(
        "[Instagram Callback] Webhook subscription failed:",
        subscriptionError
      )
    }

    const record = {
      user_id: session.user.id,
      instagram_id: instagramId,
      username: userInfo.username,
      name: userInfo.name ?? null,
      access_token: encryptedToken,
      token_expires_at: tokenExpiresAt,
      token_error: null,
      webhook_subscribed: webhookSubscribed,
      updated_at: new Date().toISOString(),
    }

    const { error: upsertError } = await supabase
      .from("instagram_accounts")
      .upsert(record, { onConflict: "instagram_id" })

    if (upsertError) throw new Error(upsertError.message)

    await logConnectAttempt(session.user.id, "connected", `@${userInfo.username}`)

    return NextResponse.redirect(`${baseUrl}/settings?instagram=connected`)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("[Instagram Callback] Error:", err)
    await logConnectAttempt(session.user.id, "failed", message)
    return NextResponse.redirect(
      `${baseUrl}/settings?instagram=failed&reason=${encodeURIComponent(
        message.slice(0, 200)
      )}`
    )
  }
}
