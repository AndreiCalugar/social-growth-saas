import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getAccountForUser, getDecryptedToken, markTokenError } from "@/lib/meta/accounts"
import { getUserMedia, TokenExpiredError } from "@/lib/meta/client"

/**
 * Recent media of the connected Instagram account, straight from the Graph
 * API. The DM automation post picker MUST use these ids — webhooks carry
 * Graph media ids, which are NOT the Apify-scraped posts.platform_post_id.
 */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const account = await getAccountForUser(session.user.id)
  if (!account) {
    return NextResponse.json({ error: "No Instagram account connected" }, { status: 404 })
  }

  try {
    const media = await getUserMedia(getDecryptedToken(account), 50)
    return NextResponse.json({
      posts: media.map((m) => ({
        id: m.id,
        caption: m.caption ?? "",
        media_type: m.media_type,
        thumbnail_url: m.thumbnail_url ?? m.media_url ?? null,
        permalink: m.permalink ?? null,
        timestamp: m.timestamp,
        like_count: m.like_count ?? 0,
        comments_count: m.comments_count ?? 0,
      })),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    if (err instanceof TokenExpiredError) {
      await markTokenError(account.id, message)
      return NextResponse.json(
        { error: "Instagram token expired — reconnect your account", tokenExpired: true },
        { status: 401 }
      )
    }
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
