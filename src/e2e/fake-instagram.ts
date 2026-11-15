/**
 * Fake Instagram Graph API for the Playwright tests. The app must run with
 * META_GRAPH_BASE_URL pointing here (see playwright.config.ts).
 *
 * Answers what the DMs page and the DM queue call: /me, /me/media, sending
 * messages, public replies and "does this person follow you?". Tests read
 * what the app sent via GET /__sent and control followers via POST
 * /__followers.
 */
import { createServer, type IncomingMessage, type Server } from "node:http"
import { randomUUID } from "node:crypto"

export const FAKE_IG_PORT = 4010

export type SentMessage = {
  to: { comment_id?: string; id?: string }
  text: string
  buttons: { title: string; payload: string }[]
}

export const FAKE_POSTS = [
  { id: "sim_media_1", caption: "E2E post one: comment LINK for the guide" },
  { id: "sim_media_2", caption: "E2E post two" },
]

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let body = ""
    req.on("data", (c) => (body += c))
    req.on("end", () => resolve(body))
  })
}

export function startFakeInstagram(username: string): Promise<Server> {
  const sent: SentMessage[] = []
  const publicReplies: { commentId: string; text: string }[] = []
  const followers = new Set<string>()

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${FAKE_IG_PORT}`)
    const parts = url.pathname.split("/").filter(Boolean) // [version, id, edge?]
    const reply = (status: number, body: unknown) => {
      res.writeHead(status, { "content-type": "application/json" })
      res.end(JSON.stringify(body))
    }

    // Test controls
    if (url.pathname === "/__sent") return reply(200, { sent, publicReplies })
    if (url.pathname === "/__followers" && req.method === "POST") {
      const { id } = JSON.parse(await readBody(req))
      followers.add(id)
      return reply(200, { ok: true })
    }

    // Fake Claude (ANTHROPIC_BASE_URL points here): answers from the
    // system prompt's info, hands off on "parking".
    if (req.method === "POST" && url.pathname === "/v1/messages") {
      const body = JSON.parse(await readBody(req))
      const question = String(body.messages?.at(-1)?.content ?? "").toLowerCase()
      const answer = question.includes("parking")
        ? { reply: "I'll pass that to the creator, who'll get back to you.", needs_human: true }
        : { reply: String(body.system ?? "").includes("250 lei") ? "It's 250 lei, materials included." : "I don't know.", needs_human: false }
      return reply(200, {
        id: `msg_e2e_${randomUUID()}`,
        type: "message",
        role: "assistant",
        model: "claude-haiku-5-5",
        content: [{ type: "text", text: JSON.stringify(answer) }],
        stop_reason: "end_turn",
        stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 10 },
      })
    }

    // Graph API
    if (req.method === "GET" && parts[1] === "me" && parts.length === 2) {
      return reply(200, { id: "sim_e2e", user_id: "sim_e2e", username, name: "E2E creator", followers_count: 1234 })
    }
    if (req.method === "GET" && parts[1] === "me" && parts[2] === "media") {
      return reply(200, {
        data: FAKE_POSTS.map((p, i) => ({
          ...p,
          media_type: "IMAGE",
          media_product_type: "FEED",
          // A data URL keeps the test offline.
          media_url: "data:image/gif;base64,R0lGODlhAQABAAAAACw=",
          timestamp: new Date(Date.now() - i * 86400000).toISOString(),
          permalink: `https://www.instagram.com/p/${p.id}/`,
          like_count: 10,
          comments_count: 2,
        })),
      })
    }
    if (req.method === "POST" && parts[2] === "messages") {
      const body = JSON.parse(await readBody(req))
      sent.push({
        to: body.recipient,
        text: body.message?.text ?? "",
        buttons: (body.message?.quick_replies ?? []).map((q: { title: string; payload: string }) => ({
          title: q.title,
          payload: q.payload,
        })),
      })
      return reply(200, { recipient_id: body.recipient?.id ?? "sim_recipient", message_id: `sim_mid_${randomUUID()}` })
    }
    if (req.method === "POST" && parts[2] === "replies") {
      const body = new URLSearchParams(await readBody(req))
      publicReplies.push({ commentId: parts[1], text: body.get("message") ?? "" })
      return reply(200, { id: `sim_reply_${randomUUID()}` })
    }
    if (req.method === "GET" && url.searchParams.get("fields")?.includes("is_user_follow_business")) {
      return reply(200, { id: parts[1], is_user_follow_business: followers.has(parts[1]) })
    }
    reply(404, { error: { message: `fake instagram: no route for ${req.method} ${url.pathname}`, code: 100 } })
  })

  return new Promise((resolve, reject) => {
    server.once("error", reject)
    server.listen(FAKE_IG_PORT, () => resolve(server))
  })
}

export async function sentMessages(): Promise<{ sent: SentMessage[]; publicReplies: { commentId: string; text: string }[] }> {
  const res = await fetch(`http://localhost:${FAKE_IG_PORT}/__sent`)
  return res.json()
}
