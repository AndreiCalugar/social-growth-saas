import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getBaseUrl, getMissingInstagramOAuthEnv } from "@/lib/meta/env"
import { createOAuthState, getAuthorizationUrl } from "@/lib/meta/oauth"

/**
 * Kick off the Instagram Login OAuth flow ("Instagram API with Instagram
 * Login"). Redirects the signed-in user to instagram.com/oauth/authorize;
 * Meta sends them back to /api/instagram/callback with a code + our signed
 * state. Adapted from OpenReply's app/api/instagram/connect (MIT).
 */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.redirect(`${getBaseUrl()}/login`)
  }

  const missing = getMissingInstagramOAuthEnv()
  if (missing.length > 0) {
    return NextResponse.redirect(
      `${getBaseUrl()}/settings?instagram=misconfigured&missing=${encodeURIComponent(missing.join(","))}`
    )
  }

  const state = createOAuthState(session.user.id)
  const redirectUri = `${getBaseUrl()}/api/instagram/callback`
  return NextResponse.redirect(getAuthorizationUrl(redirectUri, state))
}
