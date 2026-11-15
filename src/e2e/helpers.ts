import { createHmac, randomUUID } from "node:crypto"
import { readFileSync } from "node:fs"
import { createClient } from "@supabase/supabase-js"
import { expect, type Page } from "@playwright/test"
import { STATE_FILE, type E2EState } from "./global-setup"
import { sentMessages, type SentMessage } from "./fake-instagram"

export const APP_URL = process.env.APP_URL ?? "http://localhost:3100"

export const state = (): E2EState => JSON.parse(readFileSync(STATE_FILE, "utf8"))

export const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!)

/** Posts a webhook signed like Meta does. */
async function webhook(entry: Record<string, unknown>) {
  const secret = process.env.INSTAGRAM_APP_SECRET || process.env.FACEBOOK_APP_SECRET
  if (!secret) throw new Error("INSTAGRAM_APP_SECRET is needed to sign webhooks")
  const body = JSON.stringify({ object: "instagram", entry: [{ time: Date.now(), ...entry }] })
  const res = await fetch(`${APP_URL}/api/instagram/webhook`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-hub-signature-256": "sha256=" + createHmac("sha256", secret).update(body).digest("hex"),
    },
    body,
  })
  expect(res.status, "webhook accepted").toBe(200)
}

export async function sendComment(from: string, text: string, mediaId = "sim_media_1"): Promise<string> {
  const id = `sim_comment_${randomUUID()}`
  await webhook({
    id: state().bizId,
    changes: [{ field: "comments", value: { id, text, from: { id: from, username: from }, media: { id: mediaId } } }],
  })
  return id
}

export async function sendDm(from: string, text: string, payload?: string) {
  const bizId = state().bizId
  await webhook({
    id: bizId,
    messaging: [
      {
        sender: { id: from },
        recipient: { id: bizId },
        timestamp: Date.now(),
        message: {
          mid: `sim_msg_${randomUUID()}`,
          text,
          ...(payload ? { quick_reply: { payload } } : {}),
        },
      },
    ],
  })
}

export async function addFollower(id: string) {
  await fetch("http://localhost:4010/__followers", { method: "POST", body: JSON.stringify({ id }) })
}

/** Waits until the fake Instagram received a message matching `match`. */
export async function waitForMessage(match: (m: SentMessage) => boolean, what: string): Promise<SentMessage> {
  let found: SentMessage | undefined
  await expect
    .poll(async () => {
      found = (await sentMessages()).sent.find(match)
      return !!found
    }, { message: `waiting for ${what}`, timeout: 15_000 })
    .toBe(true)
  return found!
}

export async function login(page: Page) {
  const { email, password } = state()
  await page.goto("/login")
  await page.locator("#email").fill(email)
  await page.locator("#password").fill(password)
  await page.getByRole("button", { name: /sign in|log in/i }).click()
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30_000 })
}
