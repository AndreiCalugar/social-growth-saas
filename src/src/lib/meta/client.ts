// Meta Graph API client — the subset this app needs for comment-to-DM
// automation. Ported from OpenReply's lib/meta/client.ts (MIT,
// github.com/diwenne/openreply); button templates, insights, conversations
// and polling helpers were left behind on purpose.

import { getMetaGraphApiVersion, requireEnv } from "@/lib/meta/env"

function instagramGraphBase() {
  return `https://graph.instagram.com/${getMetaGraphApiVersion()}`
}

export class MetaApiError extends Error {
  constructor(
    public code: number,
    public subcode: number | undefined,
    public fbTraceId: string | undefined,
    message: string
  ) {
    super(message)
    this.name = "MetaApiError"
  }
}

export class TokenExpiredError extends MetaApiError {
  constructor(message: string, fbTraceId?: string) {
    super(190, undefined, fbTraceId, message)
    this.name = "TokenExpiredError"
  }
}

export class RateLimitError extends MetaApiError {
  constructor(message: string, fbTraceId?: string) {
    super(368, undefined, fbTraceId, message)
    this.name = "RateLimitError"
  }
}

export class PermissionError extends MetaApiError {
  constructor(message: string, fbTraceId?: string) {
    super(100, undefined, fbTraceId, message)
    this.name = "PermissionError"
  }
}

interface GraphApiError {
  error: {
    message: string
    type: string
    code: number
    error_subcode?: number
    fbtrace_id?: string
  }
}

export interface InstagramUser {
  id: string
  // Instagram professional account ID. This — not `id` (the app-scoped ID) —
  // is what appears as entry.id in webhooks and is used by the messaging API.
  user_id?: string
  username: string
  name?: string
  profile_picture_url?: string
  followers_count?: number
}

export interface InstagramMedia {
  id: string
  caption?: string
  media_type: string
  media_product_type?: string
  media_url?: string
  thumbnail_url?: string
  timestamp: string
  permalink?: string
  like_count?: number
  comments_count?: number
}

interface TokenResponse {
  access_token: string
  token_type?: string
  expires_in?: number
}

async function handleResponse<T>(response: Response): Promise<T> {
  const data = await response.json()

  if (!response.ok || (data as GraphApiError).error) {
    const err = (data as GraphApiError).error
    const code = err?.code ?? response.status
    const subcode = err?.error_subcode
    const traceId = err?.fbtrace_id
    // Without the path a Meta error is unattributable: a connect runs several
    // calls in a row that fail with the identical message. The query string is
    // dropped on purpose — it carries the access token.
    let path = ""
    try {
      path = ` (${new URL(response.url).pathname})`
    } catch {}
    const message = `${err?.message ?? "Unknown Meta API error"}${path} [code=${code} sub=${subcode ?? "-"} type=${err?.type ?? "-"} trace=${traceId ?? "-"}]`

    switch (code) {
      case 190:
        throw new TokenExpiredError(message, traceId)
      case 368:
      case 4:
      case 17:
        throw new RateLimitError(message, traceId)
      case 10:
      case 100:
      case 200:
        throw new PermissionError(message, traceId)
      default:
        throw new MetaApiError(code, subcode, traceId, message)
    }
  }

  return data as T
}

export async function sendPrivateReply(
  accessToken: string,
  instagramAccountId: string,
  commentId: string,
  message: string
): Promise<{ recipient_id: string; message_id: string }> {
  const response = await fetch(
    `${instagramGraphBase()}/${instagramAccountId}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        recipient: { comment_id: commentId },
        message: { text: message },
      }),
    }
  )

  return handleResponse(response)
}

export async function sendCommentReply(
  accessToken: string,
  commentId: string,
  message: string
): Promise<{ id: string }> {
  const response = await fetch(`${instagramGraphBase()}/${commentId}/replies`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ message }),
  })

  return handleResponse(response)
}

export async function getUserInfo(accessToken: string): Promise<InstagramUser> {
  const url = new URL(`${instagramGraphBase()}/me`)
  url.searchParams.set(
    "fields",
    "id,user_id,username,name,profile_picture_url,followers_count"
  )
  url.searchParams.set("access_token", accessToken)

  const response = await fetch(url.toString())
  return handleResponse<InstagramUser>(response)
}

const MEDIA_FIELDS =
  "id,caption,media_type,media_product_type,media_url,thumbnail_url,timestamp,permalink,like_count,comments_count"

export async function getUserMedia(
  accessToken: string,
  limit = 25
): Promise<InstagramMedia[]> {
  const url = new URL(`${instagramGraphBase()}/me/media`)
  url.searchParams.set("fields", MEDIA_FIELDS)
  url.searchParams.set("limit", limit.toString())
  url.searchParams.set("access_token", accessToken)

  const response = await fetch(url.toString())
  const data = await handleResponse<{ data: InstagramMedia[] }>(response)
  return data.data
}

export async function getLongLivedToken(
  shortLivedToken: string
): Promise<{ accessToken: string; expiresIn: number }> {
  const url = new URL(`${instagramGraphBase()}/access_token`)
  url.searchParams.set("grant_type", "ig_exchange_token")
  url.searchParams.set("client_secret", requireEnv("INSTAGRAM_APP_SECRET"))
  url.searchParams.set("access_token", shortLivedToken)

  const response = await fetch(url.toString())
  const data = await handleResponse<TokenResponse>(response)

  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in ?? 5184000,
  }
}

export async function refreshLongLivedToken(
  longLivedToken: string
): Promise<{ accessToken: string; expiresIn: number }> {
  const url = new URL(`${instagramGraphBase()}/refresh_access_token`)
  url.searchParams.set("grant_type", "ig_refresh_token")
  url.searchParams.set("access_token", longLivedToken)

  const response = await fetch(url.toString())
  const data = await handleResponse<TokenResponse>(response)

  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in ?? 5184000,
  }
}

export async function subscribeInstagramAccountToWebhooks(
  instagramAccountId: string,
  accessToken: string
): Promise<{ success: boolean }> {
  const response = await fetch(
    `${instagramGraphBase()}/${instagramAccountId}/subscribed_apps`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        subscribed_fields: ["comments", "messages"],
      }),
    }
  )

  return handleResponse(response)
}
