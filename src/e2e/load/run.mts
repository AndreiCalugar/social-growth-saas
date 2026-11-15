/**
 * Load test against the LOCAL staging copy, never production.
 *
 *   CREATORS=30 COMMENTS_PER_SECOND=10 DURATION=60s APP_URL=http://localhost:3200 \
 *     npx tsx --tsconfig tsconfig.json e2e/load/run.mts
 *
 * Seeds CREATORS creators (each with a simulated Instagram account and a
 * LINK automation), logs them all in, starts the fake Instagram, runs k6,
 * then checks every accepted comment got exactly one DM. Then a second k6
 * phase opens every tracked link and checks each click was counted once.
 * All test data is deleted at the end.
 */
import { spawn } from "node:child_process"
import { randomBytes, randomUUID } from "node:crypto"
import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import bcrypt from "bcrypt"
import { createClient } from "@supabase/supabase-js"

const here = path.dirname(fileURLToPath(import.meta.url))
const { encryptToken } = await import(path.join(here, "../../src/lib/meta/oauth.ts"))
const { startFakeInstagram, sentMessages } = await import(path.join(here, "../fake-instagram.ts"))

const APP_URL = process.env.APP_URL ?? "http://localhost:3200"
const CREATORS = Number(process.env.CREATORS ?? 30)
const COMMENTS_PER_SECOND = Number(process.env.COMMENTS_PER_SECOND ?? 10)
const DURATION = process.env.DURATION ?? "60s"
const SECRET = process.env.INSTAGRAM_APP_SECRET || process.env.FACEBOOK_APP_SECRET

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(supabaseUrl)) {
  throw new Error(`Load tests only run against local staging Supabase, got "${supabaseUrl || "(unset)"}"`)
}
if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(APP_URL)) throw new Error(`APP_URL must be local, got ${APP_URL}`)
if (!SECRET) throw new Error("INSTAGRAM_APP_SECRET is needed to sign webhooks")
const supabase = createClient(supabaseUrl, process.env.SUPABASE_SECRET_KEY!)

const runId = randomUUID().slice(0, 6)
const outDir = path.join(here, "../.auth")
mkdirSync(outDir, { recursive: true })
const userIds: string[] = []
// Holds session cookies and the webhook secret: deleted after the run.
const configFile = path.join(outDir, `load-${runId}.json`)
const bizIds: string[] = []

async function seedCreator(i: number) {
  const bizId = `sim_load_${runId}_${i}`
  const username = `load_creator_${runId}_${i}`
  const email = `load-${runId}-${i}@simulator.invalid`
  const password = randomBytes(9).toString("base64url")
  const { data: user, error } = await supabase
    .from("users")
    .insert({ email, password_hash: await bcrypt.hash(password, 4), name: username })
    .select("id")
    .single()
  if (error) throw new Error(`seed user ${i}: ${error.message}`)
  userIds.push(user.id)
  bizIds.push(bizId)
  await supabase.from("beta_access").insert({ user_id: user.id, instagram_username: username, is_professional: true, status: "approved" })
  const { data: account, error: accErr } = await supabase
    .from("instagram_accounts")
    .insert({ user_id: user.id, instagram_id: bizId, username, access_token: encryptToken("sim-token"), webhook_subscribed: true })
    .select("id")
    .single()
  if (accErr) throw new Error(`seed account ${i}: ${accErr.message}`)
  const { error: autoErr } = await supabase.from("dm_automations").insert({
    user_id: user.id,
    instagram_account_id: account.id,
    name: "Load LINK",
    trigger_type: "comment",
    match_any_post: true,
    keywords: ["LINK"],
    whole_word_match: true,
    dm_message: "Here you go: https://example.com/load",
    track_clicks: true,
    public_reply_enabled: true,
    public_reply_message: "Sent!",
    is_active: true,
  })
  if (autoErr) throw new Error(`seed automation ${i}: ${autoErr.message}`)
  return { email, password, username, bizId }
}

/** Logs in through NextAuth's credentials endpoint; returns the Cookie header. */
async function login(email: string, password: string): Promise<string> {
  const jar = new Map<string, string>()
  const keep = (res: Response) => {
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(";")
      const eq = pair.indexOf("=")
      jar.set(pair.slice(0, eq), pair.slice(eq + 1))
    }
  }
  const cookie = () => Array.from(jar, ([k, v]) => `${k}=${v}`).join("; ")
  const csrfRes = await fetch(`${APP_URL}/api/auth/csrf`)
  keep(csrfRes)
  const { csrfToken } = await csrfRes.json()
  const res = await fetch(`${APP_URL}/api/auth/callback/credentials`, {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie: cookie() },
    body: new URLSearchParams({ csrfToken, email, password, callbackUrl: `${APP_URL}/dms` }),
  })
  keep(res)
  if (![...jar.keys()].some((k) => k.includes("session-token"))) throw new Error(`login failed for ${email} (${res.status})`)
  return cookie()
}

/** Runs k6 without blocking: the fake Instagram lives in this process. */
function k6(phase: string, configFile: string, summaryFile: string): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn("k6", ["run", "--quiet", "--summary-export", summaryFile, path.join(here, "load.k6.js")], {
      stdio: "inherit",
      env: { ...process.env, LOAD_CONFIG: configFile, PHASE: phase },
    })
    // Non-zero = a threshold was crossed; the summary still has the numbers.
    child.on("exit", (code) => resolve(code === 0))
  })
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function cleanup() {
  for (let i = 0; i < userIds.length; i += 50) {
    await supabase.from("users").delete().in("id", userIds.slice(i, i + 50))
  }
  for (let i = 0; i < bizIds.length; i += 50) {
    await supabase.from("processed_comments").delete().in("instagram_account_id", bizIds.slice(i, i + 50))
  }
  await supabase.from("webhook_events").delete().like("payload->entry->0->>id", `sim_load_${runId}_%`)
}

const fake = await startFakeInstagram("load")
let ok = true
try {
  console.log(`Seeding ${CREATORS} creators…`)
  const creators = []
  for (let i = 0; i < CREATORS; i++) creators.push(await seedCreator(i))
  console.log("Logging them in…")
  const loggedIn = await Promise.all(creators.map(async (c) => ({ ...c, cookie: await login(c.email, c.password) })))

  writeFileSync(
    configFile,
    JSON.stringify({
      appUrl: APP_URL,
      secret: SECRET,
      duration: DURATION,
      commentsPerSecond: COMMENTS_PER_SECOND,
      creators: loggedIn.map(({ bizId, username, cookie }) => ({ bizId, username, cookie })),
      links: [],
    })
  )

  console.log(`\n── Phase 1: ${CREATORS} creators on the dashboard + ${COMMENTS_PER_SECOND} comments/s for ${DURATION} ──`)
  const mainSummary = path.join(outDir, `summary-main-${runId}.json`)
  ok = (await k6("main", configFile, mainSummary)) && ok

  // Every accepted comment must end with exactly one DM, none failed.
  const { readFileSync } = await import("node:fs")
  const accepted = JSON.parse(readFileSync(mainSummary, "utf8")).metrics.webhooks_accepted?.count ?? 0
  const drainStart = Date.now()
  let dms: { to: { comment_id?: string }; text: string }[] = []
  while (Date.now() - drainStart < 60_000) {
    dms = (await sentMessages()).sent.filter((m: { to: { comment_id?: string } }) => m.to.comment_id?.startsWith("load_"))
    if (dms.length >= accepted) break
    await sleep(500)
  }
  const drainMs = Date.now() - drainStart
  const perComment = new Map<string, number>()
  for (const m of dms) perComment.set(m.to.comment_id!, (perComment.get(m.to.comment_id!) ?? 0) + 1)
  const duplicates = [...perComment.values()].filter((n) => n > 1).length
  const countStatuses = async () => {
    const counts: Record<string, number> = {}
    for (const status of ["sent", "pending", "processing", "failed"]) {
      let total = 0
      for (let i = 0; i < userIds.length; i += 50) {
        const { count } = await supabase
          .from("dm_logs")
          .select("id", { count: "exact", head: true })
          .in("user_id", userIds.slice(i, i + 50))
          .eq("status", status)
        total += count ?? 0
      }
      counts[status] = total
    }
    return counts
  }
  let statusCounts = await countStatuses()
  while (Date.now() - drainStart < 60_000 && statusCounts.pending + statusCounts.processing > 0) {
    await sleep(500)
    statusCounts = await countStatuses()
  }
  const settledMs = Date.now() - drainStart
  const publicReplies = (await sentMessages()).publicReplies.length
  const dmCheck =
    perComment.size === accepted && duplicates === 0 && statusCounts.sent === accepted && statusCounts.failed === 0
  ok = ok && dmCheck
  console.log(
    `\nDM check: ${accepted} comments accepted → ${perComment.size} got a DM, ${duplicates} duplicates, ` +
      `${publicReplies} public replies; dm_logs ${JSON.stringify(statusCounts)}; all DMs sent ${drainMs} ms and all marked sent ${settledMs} ms after the load stopped → ${dmCheck ? "OK" : "PROBLEM"}`
  )

  // Phase 2: open every tracked link.
  const links = dms.map((m) => m.text.match(/https?:\/\/\S+\/r\/[A-Za-z0-9]+/)?.[0]).filter(Boolean) as string[]
  writeFileSync(configFile, JSON.stringify({ ...JSON.parse(readFileSync(configFile, "utf8")), links }))
  console.log(`\n── Phase 2: ${links.length} link clicks by up to 50 people at once ──`)
  const clickSummary = path.join(outDir, `summary-clicks-${runId}.json`)
  ok = (await k6("clicks", configFile, clickSummary)) && ok
  let clicks = 0
  for (let i = 0; i < userIds.length; i += 50) {
    const { data } = await supabase.from("tracked_links").select("click_count").in("user_id", userIds.slice(i, i + 50))
    clicks += (data ?? []).reduce((s, l) => s + l.click_count, 0)
  }
  const clickCheck = clicks === links.length
  ok = ok && clickCheck
  console.log(`Click check: ${links.length} opened → ${clicks} counted → ${clickCheck ? "OK" : "PROBLEM"}`)
} finally {
  fake.close()
  rmSync(configFile, { force: true })
  await cleanup().catch((e) => console.error("cleanup failed:", e))
  console.log("\nTest data deleted.")
}
console.log(ok ? "\nLOAD TEST PASSED" : "\nLOAD TEST HAD PROBLEMS (see above)")
process.exit(ok ? 0 : 1)
