/**
 * Instagram simulator: end-to-end tests for DM automations without real
 * Instagram accounts.
 *
 * It runs a fake Instagram Graph API on :4010 that records every message
 * the app sends and answers "does this person follow you?" from a list we
 * control. It sends the app webhooks signed exactly like Meta does, then
 * checks what the app sent back. Test data lives on an isolated simulated
 * creator (instagram_id "sim_…") and is deleted at the end.
 *
 * Usage (the app must be running with the simulator as its Instagram):
 *   META_GRAPH_BASE_URL=http://localhost:4010 npm run dev
 *   npx tsx --tsconfig tsconfig.json scripts/simulate-instagram.mts
 *
 * Env: APP_URL (default http://localhost:3000), plus the usual .env.local.
 */
import { createServer, type IncomingMessage } from "node:http"
import { createHmac, randomUUID } from "node:crypto"

const root = new URL("..", import.meta.url).pathname
const { supabase } = await import(root + "src/lib/supabase.ts")
const { encryptToken } = await import(root + "src/lib/meta/oauth.ts")

const APP_URL = process.env.APP_URL ?? "http://localhost:3000"
const SIM_PORT = 4010
const SECRET = process.env.INSTAGRAM_APP_SECRET || process.env.FACEBOOK_APP_SECRET
if (!SECRET) throw new Error("INSTAGRAM_APP_SECRET or FACEBOOK_APP_SECRET is needed to sign webhooks")

// ── Fake Instagram ─────────────────────────────────────────────────────

type SentMessage = {
  to: { comment_id?: string; id?: string }
  text: string
  buttons: { title: string; payload: string }[]
  at: number
}
const sent: SentMessage[] = []
const publicReplies: { commentId: string; text: string }[] = []
const followers = new Set<string>()
let refuseButtonsOnPrivateReply = false

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let body = ""
    req.on("data", (c) => (body += c))
    req.on("end", () => resolve(body))
  })
}

const simServer = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${SIM_PORT}`)
  const parts = url.pathname.split("/").filter(Boolean) // [version, id, edge?]
  const reply = (status: number, body: unknown) => {
    res.writeHead(status, { "content-type": "application/json" })
    res.end(JSON.stringify(body))
  }

  if (req.method === "POST" && parts[2] === "messages") {
    const body = JSON.parse(await readBody(req))
    const buttons = (body.message?.quick_replies ?? []).map((q: { title: string; payload: string }) => ({
      title: q.title,
      payload: q.payload,
    }))
    if (refuseButtonsOnPrivateReply && body.recipient?.comment_id && buttons.length > 0) {
      return reply(400, { error: { message: "(#100) quick_replies not supported for private replies", type: "OAuthException", code: 100 } })
    }
    sent.push({ to: body.recipient, text: body.message?.text ?? "", buttons, at: Date.now() })
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
  reply(404, { error: { message: `simulator: no route for ${req.method} ${url.pathname}`, code: 100 } })
})

// ── Webhooks, signed like Meta ─────────────────────────────────────────

async function webhook(entry: Record<string, unknown>) {
  const body = JSON.stringify({ object: "instagram", entry: [{ time: Date.now(), ...entry }] })
  const signature = "sha256=" + createHmac("sha256", SECRET!).update(body).digest("hex")
  const res = await fetch(`${APP_URL}/api/instagram/webhook`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-hub-signature-256": signature },
    body,
  })
  if (res.status !== 200) throw new Error(`webhook answered ${res.status}: ${await res.text()}`)
}

/** Sends a comment webhook; returns the comment id. */
async function comment(bizId: string, from: string, text: string, mediaId = "sim_media_1"): Promise<string> {
  const id = `sim_comment_${randomUUID()}`
  await webhook({
    id: bizId,
    changes: [{ field: "comments", value: { id, text, from: { id: from, username: from }, media: { id: mediaId } } }],
  })
  return id
}

const dm = (bizId: string, from: string, text: string, opts: { story?: boolean; echo?: boolean; payload?: string } = {}) =>
  webhook({
    id: bizId,
    messaging: [
      {
        sender: { id: opts.echo ? bizId : from },
        recipient: { id: opts.echo ? from : bizId },
        timestamp: Date.now(),
        message: {
          mid: `sim_msg_${randomUUID()}`,
          text,
          ...(opts.echo ? { is_echo: true } : {}),
          ...(opts.story ? { reply_to: { story: { id: "sim_story", url: "https://example.com/story" } } } : {}),
          ...(opts.payload ? { quick_reply: { payload: opts.payload } } : {}),
        },
      },
    ],
  })

// ── Helpers ────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function waitFor<T>(what: string, check: () => T | undefined | false, ms = 15000): Promise<T> {
  const until = Date.now() + ms
  while (Date.now() < until) {
    const v = check()
    if (v) return v
    await sleep(150)
  }
  throw new Error(`timed out waiting for ${what}`)
}

/** Messages sent in a conversation with this person. */
const to = (id: string) => sent.filter((m) => m.to.id === id)
/** The private reply sent to this comment. */
const replyTo = (commentId: string) => sent.find((m) => m.to.comment_id === commentId)

async function logFor(automationId: string, sender: string) {
  const { data } = await supabase.from("dm_logs").select("*").eq("automation_id", automationId).eq("commenter_id", sender)
  return data ?? []
}

const results: { name: string; ok: boolean; detail: string }[] = []
async function scenario(name: string, run: () => Promise<string>) {
  const start = Date.now()
  try {
    const detail = await run()
    results.push({ name, ok: true, detail: `${detail} (${Date.now() - start} ms)` })
  } catch (err) {
    results.push({ name, ok: false, detail: err instanceof Error ? err.message : String(err) })
  }
  console.log(`${results.at(-1)!.ok ? "PASS" : "FAIL"}  ${name} — ${results.at(-1)!.detail}`)
}

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(message)
}

// ── Setup ──────────────────────────────────────────────────────────────

const runId = randomUUID().slice(0, 8)
const bizId = `sim_${runId}`
let userId = ""

async function setup() {
  const { data: user, error: userError } = await supabase
    .from("users")
    .insert({ email: `sim-${runId}@simulator.invalid`, password_hash: "!", name: "Instagram simulator" })
    .select("id")
    .single()
  if (userError) throw new Error(`setup user: ${userError.message}`)
  userId = user.id

  const { data: account, error: accountError } = await supabase
    .from("instagram_accounts")
    .insert({
      user_id: userId,
      instagram_id: bizId,
      username: `sim_creator_${runId}`,
      access_token: encryptToken("sim-token"),
      webhook_subscribed: true,
    })
    .select("id")
    .single()
  if (accountError) throw new Error(`setup account: ${accountError.message}`)

  const base = { user_id: userId, instagram_account_id: account.id, whole_word_match: true, is_active: true }
  const automations = [
    { key: "comment", name: "SIM comment", trigger_type: "comment", match_any_post: true, keywords: ["LINK"], dm_message: "Here is your link: https://example.com/a", public_reply_enabled: true, public_reply_message: "Check your DMs!" },
    { key: "dm", name: "SIM dm", trigger_type: "dm", match_any_post: false, keywords: ["INFO"], dm_message: "Info: https://example.com/info" },
    { key: "story", name: "SIM story", trigger_type: "story_reply", match_any_post: false, keywords: ["STORY"], dm_message: "Story link: https://example.com/story" },
    { key: "gate", name: "SIM gate", trigger_type: "comment", match_any_post: true, keywords: ["GATE"], dm_message: "Gated link: https://example.com/gated", follow_gate: true },
    { key: "gateDm", name: "SIM gate dm", trigger_type: "dm", match_any_post: false, keywords: ["GATEDM"], dm_message: "Gated DM link: https://example.com/gated-dm", follow_gate: true },
    { key: "load", name: "SIM load", trigger_type: "comment", match_any_post: true, keywords: ["LOAD"], dm_message: "Load test: https://example.com/load" },
    // schema/027: one automation answering both comments and DMs.
    { key: "multi", name: "SIM multi", trigger_type: "comment", triggers: ["comment", "dm"], match_any_post: true, keywords: ["BOTH"], dm_message: "Both ways: https://example.com/both", public_reply_enabled: true, public_reply_message: "Sent!" },
  ]
  const ids: Record<string, string> = {}
  for (const { key, ...a } of automations) {
    const { data, error } = await supabase.from("dm_automations").insert({ ...base, ...a }).select("id").single()
    if (error) throw new Error(`setup automation ${key}: ${error.message}`)
    ids[key] = data.id
  }
  return ids
}

async function cleanup() {
  if (userId) await supabase.from("users").delete().eq("id", userId) // cascades to account, automations, logs
  await supabase.from("processed_comments").delete().eq("instagram_account_id", bizId)
  await supabase.from("webhook_events").delete().contains("payload", { entry: [{ id: bizId }] })
}

// ── Scenarios ──────────────────────────────────────────────────────────

await new Promise<void>((r) => simServer.listen(SIM_PORT, r))
console.log(`Simulator on :${SIM_PORT}, app at ${APP_URL}, simulated creator ${bizId}\n`)

let ids: Record<string, string> = {}
try {
  ids = await setup()

  await scenario("Comment with keyword gets a private reply and a public reply", async () => {
    const user = `u_comment_${runId}`
    const commentId = await comment(bizId, user, "send me the LINK please")
    const m = await waitFor("private reply", () => replyTo(commentId))
    assert(m.text.startsWith("Here is your link"), `unexpected text: ${m.text}`)
    await waitFor("public reply", () => publicReplies.find((p) => p.commentId === m.to.comment_id))
    return "DM + public reply sent"
  })

  await scenario("Comment without the keyword does nothing", async () => {
    const before = sent.length
    await comment(bizId, `u_nokw_${runId}`, "nice post!")
    await sleep(2500)
    assert(sent.length === before, `expected no message, got ${sent.length - before}`)
    return "nothing sent"
  })

  await scenario("DM keyword trigger answers in the conversation", async () => {
    const user = `u_dm_${runId}`
    await dm(bizId, user, "hi, can I get the info?")
    const m = await waitFor("DM answer", () => to(user)[0])
    assert(m.text.startsWith("Info:"), `unexpected text: ${m.text}`)
    return "answered by DM"
  })

  await scenario("Same person asking again within 24h isn't answered twice", async () => {
    const user = `u_dm_${runId}`
    await dm(bizId, user, "INFO again")
    await sleep(2500)
    assert(to(user).length === 1, `expected 1 message, got ${to(user).length}`)
    return "cooldown respected"
  })

  await scenario("Our own messages (echoes) never trigger anything", async () => {
    const before = sent.length
    await dm(bizId, `u_echo_${runId}`, "INFO STORY LINK", { echo: true })
    await sleep(2500)
    assert(sent.length === before, "an echo triggered a message: DM loop risk")
    return "echo ignored"
  })

  await scenario("Story reply trigger", async () => {
    const user = `u_story_${runId}`
    await dm(bizId, user, "story 🔥", { story: true })
    const m = await waitFor("story answer", () => to(user)[0])
    assert(m.text.startsWith("Story link"), `unexpected text: ${m.text}`)
    return "answered story reply"
  })

  await scenario("Story keyword in a plain DM doesn't fire the story automation", async () => {
    const user = `u_story_dm_${runId}`
    await dm(bizId, user, "STORY")
    await sleep(2500)
    assert(to(user).length === 0, "story automation fired on a plain DM")
    return "not triggered"
  })

  await scenario("Comment + DM automation answers a keyword comment", async () => {
    const user = `u_multi_c_${runId}`
    const commentId = await comment(bizId, user, "BOTH please")
    const m = await waitFor("private reply", () => replyTo(commentId))
    assert(m.text.startsWith("Both ways"), `unexpected text: ${m.text}`)
    await waitFor("public reply", () => publicReplies.find((p) => p.commentId === commentId))
    return "private + public reply"
  })

  await scenario("Comment + DM automation answers a keyword DM in the conversation", async () => {
    const user = `u_multi_d_${runId}`
    await dm(bizId, user, "BOTH")
    const m = await waitFor("DM answer", () => to(user)[0])
    assert(m.text.startsWith("Both ways"), `unexpected text: ${m.text}`)
    const [log] = await logFor(ids.multi, user)
    assert(log?.trigger_type === "dm", `log trigger_type ${log?.trigger_type}`)
    return "answered by DM, logged as dm"
  })

  await scenario("Comment + DM automation also catches story replies", async () => {
    const user = `u_multi_s_${runId}`
    await dm(bizId, user, "BOTH", { story: true })
    const m = await waitFor("DM answer", () => to(user)[0])
    assert(m.text.startsWith("Both ways"), `unexpected text: ${m.text}`)
    return "story reply answered"
  })

  await scenario("Someone who commented and then DMs the keyword gets it once", async () => {
    const user = `u_multi_c_${runId}`
    await dm(bizId, user, "BOTH")
    await sleep(2500)
    assert(to(user).length === 0, `expected no second DM, got ${to(user).length}`)
    return "no duplicate across triggers"
  })

  await scenario("Follow-gate (comment): opener → not following → follow ask → follows → link", async () => {
    const user = `u_gate_${runId}`
    const commentId = await comment(bizId, user, "GATE")
    const opener = await waitFor("opener", () => replyTo(commentId))
    assert(opener.buttons[0]?.payload.startsWith("FG:"), "opener has no follow-gate button")
    const [row1] = await logFor(ids.gate, user)
    assert(row1?.gate_status === "awaiting_tap", `gate_status ${row1?.gate_status}`)

    // Tap while NOT following → asked to follow
    await dm(bizId, user, opener.buttons[0].title, { payload: opener.buttons[0].payload })
    const ask = await waitFor("follow ask", () => to(user).find((s) => s.buttons.length > 0))
    assert(/follow/i.test(ask.text), `unexpected ask: ${ask.text}`)
    let row = (await logFor(ids.gate, user))[0]
    for (let i = 0; i < 20 && row.gate_status !== "awaiting_follow"; i++) { await sleep(150); row = (await logFor(ids.gate, user))[0] }
    assert(row.gate_status === "awaiting_follow", `gate_status ${row.gate_status}`)

    // Follows, taps again → gets the link
    followers.add(user)
    await dm(bizId, user, ask.buttons[0].title, { payload: ask.buttons[0].payload })
    await waitFor("gated link", () => to(user).find((s) => s.text.startsWith("Gated link")))
    for (let i = 0; i < 20 && row.gate_status !== "delivered"; i++) { await sleep(150); row = (await logFor(ids.gate, user))[0] }
    assert(row.gate_status === "delivered", `gate_status ${row.gate_status}`)
    return "opener, follow ask and link all sent; status delivered"
  })

  await scenario("Follow-gate: a double tap sends the link only once", async () => {
    const user = `u_double_${runId}`
    followers.add(user)
    const commentId = await comment(bizId, user, "GATE")
    const opener = await waitFor("opener", () => replyTo(commentId))
    await Promise.all([
      dm(bizId, user, "tap", { payload: opener.buttons[0]?.payload }),
      dm(bizId, user, "tap", { payload: opener.buttons[0]?.payload }),
    ])
    await waitFor("link", () => to(user).find((s) => s.text.startsWith("Gated link")))
    await sleep(2500)
    const links = to(user).filter((s) => s.text.startsWith("Gated link")).length
    assert(links === 1, `link sent ${links} times`)
    return "exactly one link"
  })

  await scenario("Follow-gate (DM trigger): a follower gets the link right away", async () => {
    const user = `u_gatedm_${runId}`
    followers.add(user)
    await dm(bizId, user, "GATEDM")
    const m = await waitFor("gated DM link", () => to(user)[0])
    assert(m.text.startsWith("Gated DM link"), `unexpected text: ${m.text}`)
    return "delivered without an opener"
  })

  await scenario("Follow-gate: if Instagram refuses buttons, the opener falls back to plain text", async () => {
    refuseButtonsOnPrivateReply = true
    const user = `u_nobuttons_${runId}`
    try {
      const commentId = await comment(bizId, user, "GATE")
      const opener = await waitFor("plain opener", () => replyTo(commentId))
      assert(opener.buttons.length === 0 && /reply/i.test(opener.text), `unexpected opener: ${opener.text}`)
      followers.add(user)
      await dm(bizId, user, "ok")
      await waitFor("gated link after any reply", () => to(user).find((s) => s.text.startsWith("Gated link")))
      return `fallback opener "${opener.text.slice(0, 40)}…", link sent after a plain reply`
    } finally {
      refuseButtonsOnPrivateReply = false
    }
  })

  await scenario("30 people comment at the same moment: everyone gets exactly one DM", async () => {
    const users = Array.from({ length: 30 }, (_, i) => `u_load_${i}_${runId}`)
    const t0 = Date.now()
    await Promise.all(users.map((u) => comment(bizId, u, "LOAD")))
    const webhooksMs = Date.now() - t0
    // Webhooks drain the queue right away; the rest is the cron's job, so
    // keep draining like the every-20s cron would, a bit faster.
    const deadline = Date.now() + 60000
    let done = 0
    while (Date.now() < deadline) {
      const { count } = await supabase.from("dm_logs").select("id", { count: "exact", head: true }).eq("automation_id", ids.load).eq("status", "sent")
      done = count ?? 0
      if (done >= users.length) break
      await fetch(`${APP_URL}/api/cron/process-dms`, { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } }).catch(() => {})
      await sleep(500)
    }
    const loadMessages = sent.filter((s) => s.text.startsWith("Load test"))
    assert(done === users.length, `only ${done}/${users.length} sent`)
    assert(loadMessages.length === users.length, `${loadMessages.length} messages for ${users.length} people (duplicates or missing)`)
    return `30/30 sent once; 30 webhooks answered in ${webhooksMs} ms; all DMs out in ${Date.now() - t0} ms`
  })
} finally {
  await cleanup().catch((e) => console.error("cleanup failed:", e))
  simServer.close()
}

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} scenarios passed. Test data deleted.`)
process.exit(failed.length ? 1 : 0)
