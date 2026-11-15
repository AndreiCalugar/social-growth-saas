/**
 * Seeds an isolated test creator on the LOCAL staging database and starts the
 * fake Instagram. Everything is deleted again in the returned teardown.
 *
 * Refuses to run unless Supabase points at localhost, so these tests can
 * never write to production.
 */
import { createClient } from "@supabase/supabase-js"
import bcrypt from "bcrypt"
import { randomBytes, randomUUID } from "node:crypto"
import { mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"
import { encryptToken } from "../src/lib/meta/oauth"
import { startFakeInstagram } from "./fake-instagram"

export const STATE_FILE = path.join(__dirname, ".auth", "state.json")

export type E2EState = {
  email: string
  password: string
  userId: string
  accountId: string
  bizId: string
  username: string
}

export default async function globalSetup() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
  if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(url)) {
    throw new Error(`E2E tests only run against local staging Supabase, got "${url || "(unset)"}"`)
  }
  const supabase = createClient(url, process.env.SUPABASE_SECRET_KEY!)

  const runId = randomUUID().slice(0, 8)
  const bizId = `sim_${runId}`
  const username = `e2e_creator_${runId}`
  const email = `e2e-${runId}@simulator.invalid`
  const password = randomBytes(12).toString("base64url")

  const { data: user, error: userError } = await supabase
    .from("users")
    .insert({ email, password_hash: await bcrypt.hash(password, 10), name: "E2E creator" })
    .select("id")
    .single()
  if (userError) throw new Error(`seed user: ${userError.message}`)

  const { error: betaError } = await supabase.from("beta_access").insert({
    user_id: user.id,
    instagram_username: username,
    is_professional: true,
    status: "approved",
    approved_at: new Date().toISOString(),
  })
  if (betaError) throw new Error(`seed beta access: ${betaError.message}`)

  const { data: account, error: accountError } = await supabase
    .from("instagram_accounts")
    .insert({
      user_id: user.id,
      instagram_id: bizId,
      username,
      access_token: encryptToken("sim-token"),
      webhook_subscribed: true,
    })
    .select("id")
    .single()
  if (accountError) throw new Error(`seed account: ${accountError.message}`)

  const state: E2EState = { email, password, userId: user.id, accountId: account.id, bizId, username }
  mkdirSync(path.dirname(STATE_FILE), { recursive: true })
  writeFileSync(STATE_FILE, JSON.stringify(state))

  const fakeInstagram = await startFakeInstagram(username)

  return async () => {
    fakeInstagram.close()
    await supabase.from("users").delete().eq("id", user.id) // cascades to account, automations, logs, links
    await supabase.from("processed_comments").delete().eq("instagram_account_id", bizId)
    await supabase.from("webhook_events").delete().contains("payload", { entry: [{ id: bizId }] })
  }
}
