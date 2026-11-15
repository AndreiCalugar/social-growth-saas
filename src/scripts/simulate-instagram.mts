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
// People who already had a conversation with the creator before the app
// was connected: their history has a message from a month ago.
const oldConversations = new Set<string>()
let refuseButtonsOnPrivateReply = false

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let body = ""
    req.on("data", (c) => (body += c))
    req.on("end", () => resolve(body))
  })
}

// Fake Claude (the app runs with ANTHROPIC_BASE_URL pointing here): a
// predictable answer from the question, and the system prompt it got.
const claudeCalls: { system: string; question: string }[] = []
function fakeClaude(body: { system?: string; messages: { role: string; content: string }[] }) {
  const question = String(body.messages.at(-1)?.content ?? "")
  claudeCalls.push({ system: body.system ?? "", question })
  const q = question.toLowerCase()
  const answer = q.includes("parking")
    ? { reply: "Good question! I'll pass it to the creator, who'll get back to you.", needs_human: true }
    : q.includes("price") || q.includes("much")
      ? { reply: "It costs 100 lei, materials included.", needs_human: false }
      : { reply: "It's at Studio X, Main Street 1.", needs_human: false }
  return {
    id: `msg_sim_${randomUUID()}`,
    type: "message",
    role: "assistant",
    model: "claude-haiku-5-5",
    content: [{ type: "text", text: JSON.stringify(answer) }],
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 10 },
  }
}

const simServer = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${SIM_PORT}`)
  const parts = url.pathname.split("/").filter(Boolean) // [version, id, edge?]
  const reply = (status: number, body: unknown) => {
    res.writeHead(status, { "content-type": "application/json" })
    res.end(JSON.stringify(body))
  }

  if (req.method === "POST" && url.pathname === "/v1/messages") {
    return reply(200, fakeClaude(JSON.parse(await readBody(req))))
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
  if (req.method === "GET" && parts[1] === "me" && parts[2] === "conversations") {
    const user = url.searchParams.get("user_id") ?? ""
    return reply(200, { data: [{ id: `conv_${user}` }] })
  }
  if (req.method === "GET" && parts[1]?.startsWith("conv_") && url.searchParams.get("fields") === "messages") {
    const user = parts[1].slice("conv_".length)
    const times = [new Date().toISOString()]
    if (oldConversations.has(user)) times.push(new Date(Date.now() - 30 * 86400_000).toISOString())
    return reply(200, { id: parts[1], messages: { data: times.map((t, i) => ({ id: `m${i}`, created_time: t })) } })
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
    { key: "gate", name: "SIM gate", trigger_type: "comment", match_any_post: true, keywords: ["GATE"], dm_message: "Gated link: https://example.com/gated", follow_gate: true, followup_enabled: true, followup_message: "Gate reminder" },
    { key: "gateDm", name: "SIM gate dm", trigger_type: "dm", match_any_post: false, keywords: ["GATEDM"], dm_message: "Gated DM link: https://example.com/gated-dm", follow_gate: true },
    { key: "load", name: "SIM load", trigger_type: "comment", match_any_post: true, keywords: ["LOAD"], dm_message: "Load test: https://example.com/load" },
    // schema/028: welcome message (switched on only for its scenarios, so
    // it doesn't answer the other scenarios' first messages) and follow-ups.
    { key: "welcome", name: "SIM welcome", trigger_type: "new_conversation", triggers: ["new_conversation"], match_any_post: false, keywords: [], dm_message: "Welcome! Here's a gift: https://example.com/gift", is_active: false },
    { key: "fu", name: "SIM follow-up", trigger_type: "dm", triggers: ["dm"], match_any_post: false, keywords: ["FU"], dm_message: "Event link: https://example.com/event", track_clicks: true, followup_enabled: true, followup_delay_hours: 20, followup_audience: "not_clicked", followup_message: "Did you see the link? Seats are filling up: https://example.com/event" },
    { key: "fuReply", name: "SIM follow-up no reply", trigger_type: "dm", triggers: ["dm"], match_any_post: false, keywords: ["HELLO"], dm_message: "What can I help you with?", followup_enabled: true, followup_audience: "not_replied", followup_message: "Just making sure you saw my message!" },
    // schema/029: AI assistant, 2 answers per person.
    { key: "ai", name: "SIM ai", trigger_type: "dm", triggers: ["dm"], match_any_post: false, keywords: ["ASK"], dm_message: "Here are the details: https://example.com/ws", ai_enabled: true, ai_knowledge: "Workshop. Price: 100 lei. Place: Studio X, Main Street 1.", ai_tone: "warm", ai_max_replies: 2 },
    { key: "aiComment", name: "SIM ai comment", trigger_type: "comment", match_any_post: true, keywords: ["ASKC"], dm_message: "Details in DM: https://example.com/ws", ai_enabled: true, ai_knowledge: "Workshop. Price: 100 lei.", ai_max_replies: 3 },
    { key: "fuComment", name: "SIM follow-up comment", trigger_type: "comment", match_any_post: true, keywords: ["FUC"], dm_message: "Comment link: https://example.com/c", followup_enabled: true, followup_message: "Reminder!" },
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

  // ── Welcome message (new_conversation) ──
  await supabase.from("dm_automations").update({ is_active: true }).eq("id", ids.welcome)

  await scenario("Welcome: someone's first message ever gets the welcome DM", async () => {
    const user = `u_welcome_${runId}`
    await dm(bizId, user, "hi! love your content")
    const m = await waitFor("welcome", () => to(user)[0])
    assert(m.text.startsWith("Welcome!"), `unexpected text: ${m.text}`)
    const [log] = await logFor(ids.welcome, user)
    assert(log?.trigger_type === "new_conversation", `log trigger_type ${log?.trigger_type}`)
    return "welcomed"
  })

  await scenario("Welcome: their second message doesn't get it again", async () => {
    const user = `u_welcome_${runId}`
    await dm(bizId, user, "another question")
    await sleep(2500)
    assert(to(user).length === 1, `expected 1 message, got ${to(user).length}`)
    return "welcomed once"
  })

  await scenario("Welcome: an existing customer (conversation from before the app) never gets it", async () => {
    const user = `u_old_${runId}`
    oldConversations.add(user)
    await dm(bizId, user, "hey, me again")
    await sleep(2500)
    assert(to(user).length === 0, `an existing customer got a welcome: ${to(user)[0]?.text}`)
    return "not welcomed"
  })

  await scenario("Welcome: a first message with a keyword gets only that automation's DM", async () => {
    const user = `u_welcome_kw_${runId}`
    await dm(bizId, user, "INFO please")
    await waitFor("info answer", () => to(user)[0])
    await sleep(2000)
    assert(to(user).length === 1 && to(user)[0].text.startsWith("Info:"), `got ${to(user).map((m) => m.text).join(" | ")}`)
    return "keyword wins, one message"
  })

  await supabase.from("dm_automations").update({ is_active: false }).eq("id", ids.welcome)

  // ── Follow-ups ──
  const cronSecret = process.env.CRON_SECRET || process.env.NEXTAUTH_SECRET
  /** Make this person's follow-up due now and run the queue like the cron does. */
  async function runFollowupNow(automationId: string, user: string) {
    const [log] = await logFor(automationId, user)
    assert(log, "no DM log")
    const { data: f } = await supabase.from("dm_followups").select("id, send_after, status").eq("dm_log_id", log.id).maybeSingle()
    assert(f, "no follow-up was scheduled")
    await supabase.from("dm_followups").update({ send_after: new Date().toISOString() }).eq("id", f.id)
    const res = await fetch(`${APP_URL}/api/cron/process-dms`, { headers: { authorization: `Bearer ${cronSecret}` } })
    assert(res.ok, `cron answered ${res.status}`)
    const { data: after } = await supabase.from("dm_followups").select("status, skip_reason").eq("id", f.id).single()
    return { scheduledFor: f.send_after as string, ...after! }
  }

  await scenario("Follow-up: scheduled ~20h out, sent to someone who didn't open the link", async () => {
    const user = `u_fu_${runId}`
    await dm(bizId, user, "FU")
    await waitFor("first DM", () => to(user)[0])
    await sleep(500)
    const [log] = await logFor(ids.fu, user)
    const { data: f } = await supabase.from("dm_followups").select("send_after").eq("dm_log_id", log.id).single()
    const hours = (new Date(f!.send_after).getTime() - Date.now()) / 3600_000
    assert(hours > 19.9 && hours <= 20, `scheduled ${hours.toFixed(2)}h out`)
    const r = await runFollowupNow(ids.fu, user)
    assert(r.status === "sent", `status ${r.status} ${r.skip_reason ?? ""}`)
    const m = await waitFor("follow-up", () => to(user)[1])
    assert(m.text.startsWith("Did you see the link?") && /\/r\/[A-Za-z0-9]+/.test(m.text), `unexpected follow-up: ${m.text}`)
    const first = to(user)[0].text.match(/\/r\/[A-Za-z0-9]+/)?.[0]
    assert(m.text.includes(first!), "follow-up should reuse the first DM's tracked link")
    return `scheduled ${hours.toFixed(1)}h out, sent with the same tracked link`
  })

  await scenario("Follow-up: skipped for someone who already opened the link", async () => {
    const user = `u_fu_click_${runId}`
    await dm(bizId, user, "FU")
    const first = await waitFor("first DM", () => to(user)[0])
    const link = first.text.match(/https?:\/\/\S+\/r\/[A-Za-z0-9]+/)?.[0]
    assert(link, "no tracked link")
    await fetch(link, { redirect: "manual" })
    await sleep(500)
    const r = await runFollowupNow(ids.fu, user)
    assert(r.status === "skipped" && r.skip_reason === "clicked", `status ${r.status} ${r.skip_reason}`)
    assert(to(user).length === 1, "a follow-up was sent anyway")
    return "skipped: clicked"
  })

  await scenario("Follow-up: never sent outside Instagram's 24h window", async () => {
    const user = `u_fu_late_${runId}`
    await dm(bizId, user, "FU")
    await waitFor("first DM", () => to(user)[0])
    await sleep(500)
    const { data: account } = await supabase.from("instagram_accounts").select("id").eq("instagram_id", bizId).single()
    await supabase
      .from("instagram_contacts")
      .update({ last_inbound_at: new Date(Date.now() - 23.9 * 3600_000).toISOString() })
      .eq("instagram_account_id", account!.id)
      .eq("igsid", user)
    const r = await runFollowupNow(ids.fu, user)
    assert(r.status === "skipped" && r.skip_reason === "window_closed", `status ${r.status} ${r.skip_reason}`)
    assert(to(user).length === 1, "a late follow-up was sent")
    return "skipped: window closed"
  })

  await scenario("Follow-up \"didn't reply\": sent when they stayed silent", async () => {
    const user = `u_fu_silent_${runId}`
    await dm(bizId, user, "HELLO")
    await waitFor("first DM", () => to(user)[0])
    await sleep(500)
    const r = await runFollowupNow(ids.fuReply, user)
    assert(r.status === "sent", `status ${r.status} ${r.skip_reason ?? ""}`)
    const m = await waitFor("follow-up", () => to(user)[1])
    assert(m.text === "Just making sure you saw my message!", `unexpected: ${m.text}`)
    return "nudge sent"
  })

  await scenario("Follow-up \"didn't reply\": skipped once they wrote back", async () => {
    const user = `u_fu_replied_${runId}`
    await dm(bizId, user, "HELLO")
    await waitFor("first DM", () => to(user)[0])
    await sleep(500)
    await dm(bizId, user, "I'd like to know the prices")
    await sleep(500)
    const r = await runFollowupNow(ids.fuReply, user)
    assert(r.status === "skipped" && r.skip_reason === "replied", `status ${r.status} ${r.skip_reason}`)
    assert(to(user).length === 1, "a nudge was sent to someone who replied")
    return "skipped: replied"
  })

  await scenario("Follow-up: not scheduled for a plain comment (no conversation, Instagram wouldn't allow it)", async () => {
    const user = `u_fu_comment_${runId}`
    const commentId = await comment(bizId, user, "FUC")
    await waitFor("private reply", () => replyTo(commentId))
    await sleep(1000)
    const [log] = await logFor(ids.fuComment, user)
    const { count } = await supabase.from("dm_followups").select("id", { count: "exact", head: true }).eq("dm_log_id", log.id)
    assert(count === 0, `${count} follow-ups scheduled`)
    return "none scheduled"
  })

  // ── AI assistant ──
  async function aiThreadFor(automationId: string, user: string) {
    const [log] = await logFor(automationId, user)
    const { data } = await supabase.from("dm_ai_threads").select("*").eq("dm_log_id", log.id).maybeSingle()
    return data
  }

  await scenario("AI assistant: answers questions from the creator's info, first answer says it's AI", async () => {
    const user = `u_ai_${runId}`
    await dm(bizId, user, "ASK")
    await waitFor("automation DM", () => to(user)[0])
    await sleep(300)
    await dm(bizId, user, "how much is it?")
    const a1 = await waitFor("first AI answer", () => to(user)[1])
    assert(/AI assistant/.test(a1.text) && a1.text.includes("100 lei"), `unexpected: ${a1.text}`)
    assert(claudeCalls.at(-1)!.system.includes("Price: 100 lei"), "Claude didn't get the creator's info")
    await dm(bizId, user, "where is it?")
    const a2 = await waitFor("second AI answer", () => to(user)[2])
    assert(a2.text === "It's at Studio X, Main Street 1.", `second answer should have no AI intro again: ${a2.text}`)
    const t = await aiThreadFor(ids.ai, user)
    assert(t?.replies_count === 2 && t.status === "open", `thread ${t?.status} ${t?.replies_count}`)
    return "2 answers, disclosure on the first only"
  })

  await scenario("AI assistant: after the limit it says the creator will get back, then goes quiet", async () => {
    const user = `u_ai_${runId}`
    await dm(bizId, user, "and can I pay at the door?")
    const h = await waitFor("handoff", () => to(user)[3])
    assert(/get back to you/.test(h.text), `unexpected handoff: ${h.text}`)
    let t = await aiThreadFor(ids.ai, user)
    assert(t?.status === "handed_off" && t.handoff_reason === "limit" && t.needs_attention, `thread ${JSON.stringify(t)}`)
    await dm(bizId, user, "anyone there??")
    await sleep(2000)
    assert(to(user).length === 4, `the assistant kept talking: ${JSON.stringify(to(user).map((x) => x.text))}`)
    t = await aiThreadFor(ids.ai, user)
    assert(t?.needs_attention === true, "should still need the creator")
    return "handed off once, then silent, flagged Needs you"
  })

  await scenario("AI assistant: a question that isn't in the info is handed to the creator", async () => {
    const user = `u_ai_nc_${runId}`
    await dm(bizId, user, "ASK")
    await waitFor("automation DM", () => to(user)[0])
    await sleep(300)
    await dm(bizId, user, "is there parking?")
    const m = await waitFor("handoff answer", () => to(user)[1])
    assert(/AI assistant/.test(m.text) && /get back to you/.test(m.text), `unexpected: ${m.text}`)
    const t = await aiThreadFor(ids.ai, user)
    assert(t?.status === "handed_off" && t.handoff_reason === "not_covered", `thread ${t?.status} ${t?.handoff_reason}`)
    return "not covered → handed off"
  })

  await supabase.from("dm_automations").update({ is_active: true }).eq("id", ids.welcome)
  await scenario("AI assistant on a comment automation: a quick reply to the DM gets the AI, not the welcome", async () => {
    const user = `u_ai_c_${runId}`
    const commentId = await comment(bizId, user, "ASKC")
    await waitFor("private reply", () => replyTo(commentId))
    await sleep(300)
    await dm(bizId, user, "what's the price?")
    const m = await waitFor("AI answer", () => to(user)[0])
    assert(m.text.includes("100 lei") && !m.text.startsWith("Welcome"), `unexpected: ${m.text}`)
    await sleep(1000)
    assert(to(user).length === 1, `got ${to(user).map((x) => x.text).join(" | ")}`)
    return "AI answered, no welcome"
  })
  await supabase.from("dm_automations").update({ is_active: false }).eq("id", ids.welcome)

  await scenario("AI assistant off: a question after the DM gets no automatic answer", async () => {
    const user = `u_noai_${runId}`
    await dm(bizId, user, "FU")
    await waitFor("automation DM", () => to(user)[0])
    await sleep(300)
    await dm(bizId, user, "how much is it?")
    await sleep(2000)
    assert(to(user).length === 1, `got an answer from an automation without AI: ${to(user)[1]?.text}`)
    return "no answer"
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

  await scenario("Follow-gate + follow-up: the tap opens the conversation, so the follow-up is scheduled", async () => {
    const user = `u_gate_${runId}`
    const [log] = await logFor(ids.gate, user)
    const { data: f } = await supabase.from("dm_followups").select("send_after, status").eq("dm_log_id", log.id).maybeSingle()
    assert(f?.status === "scheduled", `follow-up ${f ? f.status : "missing"}`)
    return "scheduled after the link was delivered"
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
