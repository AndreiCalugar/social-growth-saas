/**
 * The DM automation flows a creator goes through, in a real browser:
 * template → first automation → a comment gets a tracked DM → the click
 * shows up → a follower-only DM automation → pause.
 */
import { expect, test, type Page } from "@playwright/test"
import { addFollower, db, login, sendComment, sendDm, state, waitForMessage } from "./helpers"
import { FAKE_POSTS } from "./fake-instagram"

test.describe.configure({ mode: "serial" })

let page: Page

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage()
})
test.afterAll(async () => {
  await page.close()
})

/** The DB write can land just after Instagram got the message: reload until it shows. */
const expectAfterReload = (text: string) =>
  expect(async () => {
    await page.reload()
    await expect(page.locator("#activity").getByText(text).first()).toBeVisible({ timeout: 1000 })
  }).toPass({ timeout: 15_000 })

const row = (name: string) => page.locator("div.grid").filter({ has: page.getByText(name, { exact: true }) }).first()

test("logs in and sees the connected Instagram account", async () => {
  await login(page)
  await page.goto("/dms")
  await expect(page.getByText(state().username).first()).toBeVisible()
  // No automations yet → templates in the empty state.
  await expect(page.getByRole("button", { name: /Link in DM/ })).toBeVisible()
})

test("creates the first automation from the Link template", async () => {
  await page.getByRole("button", { name: /Link in DM/ }).click()
  await page.getByRole("button", { name: "English", exact: false }).first().click()
  await page.getByPlaceholder("https://").fill("example.com/guide")
  await page.getByRole("button", { name: /Continue/ }).click()

  // Editor opens prefilled; pick the post from the (fake) Instagram feed.
  await expect(page.getByPlaceholder(/Name your automation/)).toHaveValue("Link in DM")
  await page.getByTitle(FAKE_POSTS[0].caption).click()
  await page.getByRole("button", { name: "Go live" }).click()

  await expect(row("Link in DM").getByText("Live")).toBeVisible()
  const { data } = await db().from("dm_automations").select("*").eq("user_id", state().userId)
  expect(data).toHaveLength(1)
  expect(data![0]).toMatchObject({
    post_id: FAKE_POSTS[0].id,
    keywords: ["LINK"],
    track_clicks: true,
    trigger_type: "comment",
    is_active: true,
  })
  expect(data![0].dm_message).toContain("https://example.com/guide")
})

let shortLink = ""

test("a comment with the keyword gets a DM with a tracked link", async () => {
  const commentId = await sendComment("fan_one", "link please")
  const dm = await waitForMessage((m) => m.to.comment_id === commentId, "private reply")
  const match = dm.text.match(/https?:\/\/\S+\/r\/[A-Za-z0-9]+/)
  expect(match, `DM has a tracked link: ${dm.text}`).not.toBeNull()
  expect(dm.text).not.toContain("example.com/guide")
  shortLink = match![0]

  await page.reload()
  await expect(page.locator("#activity").getByText("fan_one").first()).toBeVisible()
})

test("comments without the keyword or on another post are ignored", async () => {
  await sendComment("fan_two", "nice post")
  await sendComment("fan_three", "LINK", FAKE_POSTS[1].id)
  await page.waitForTimeout(2000)
  const { data } = await db().from("dm_logs").select("commenter_name").eq("user_id", state().userId)
  expect(data!.map((r) => r.commenter_name)).toEqual(["fan_one"])
})

test("opening the link counts a click and shows it per automation", async () => {
  const res = await page.request.get(shortLink, { maxRedirects: 0 })
  expect(res.status()).toBe(302)
  expect(res.headers()["location"]).toBe("https://example.com/guide")

  // Instagram's link preview bot must not count.
  const bot = await page.request.get(shortLink, { maxRedirects: 0, headers: { "user-agent": "facebookexternalhit/1.1" } })
  expect(bot.status()).toBe(302)

  await page.reload()
  const r = row("Link in DM")
  await expect(r.getByText("100%").first()).toBeVisible()
  await expect(page.locator("#activity").getByText("Clicked").first()).toBeVisible()
  const { data } = await db().from("tracked_links").select("click_count").eq("user_id", state().userId)
  expect(data!.map((l) => l.click_count)).toEqual([1])
})

test("creates a follower-only DM automation from scratch", async () => {
  await page.getByRole("button", { name: /New automation/ }).first().click()
  await page.getByRole("button", { name: /Start from scratch/ }).click()

  await page.getByPlaceholder(/Name your automation/).fill("VIP list")
  await page.getByRole("radio", { name: /^DM/ }).click()
  // Comment-only steps disappear for DM automations.
  await expect(page.getByText("When someone comments on")).toHaveCount(0)
  const keyword = page.getByPlaceholder("LINK, GUIDE, PRICE…")
  await keyword.fill("VIP")
  await keyword.press("Enter")
  await page.getByPlaceholder(/Here's the link you asked for/).fill("Welcome to the VIP list: https://example.com/vip")
  const gate = page.getByRole("switch").nth(1)
  await gate.click()
  await expect(gate).toHaveAttribute("aria-checked", "true")
  await page.getByRole("button", { name: "Go live" }).click()

  await expect(row("VIP list").getByText("Followers only")).toBeVisible()
})

test("follow gate: asks to follow, then delivers once they follow", async () => {
  await sendDm("fan_vip", "VIP")
  const opener = await waitForMessage((m) => m.to.id === "fan_vip" && m.buttons.length > 0, "gate opener")
  const payload = opener.buttons[0].payload

  // Taps without following → asked to follow, no link yet.
  await sendDm("fan_vip", opener.buttons[0].title, payload)
  const ask = await waitForMessage(
    (m) => m.to.id === "fan_vip" && m.text.includes(`@${state().username}`),
    "follow request"
  )
  expect(ask.text).not.toContain("/r/")
  await expectAfterReload("Asked to follow")

  // Follows, taps again → gets the (tracked) link.
  await addFollower("fan_vip")
  await sendDm("fan_vip", ask.buttons[0]?.title ?? "Done", ask.buttons[0]?.payload ?? payload)
  await waitForMessage((m) => m.to.id === "fan_vip" && m.text.includes("VIP list") && m.text.includes("/r/"), "gated link")
  await expectAfterReload("Link sent")
})

test("pausing an automation stops its DMs", async () => {
  const r = row("Link in DM")
  await r.getByTitle("Pause").click()
  await expect(r.getByText("Paused")).toBeVisible()

  const commentId = await sendComment("fan_four", "LINK")
  await page.waitForTimeout(2500)
  const { sent } = await (await fetch("http://localhost:4010/__sent")).json()
  expect(sent.some((m: { to: { comment_id?: string } }) => m.to.comment_id === commentId)).toBe(false)
})

test("the activity filter shows one automation at a time", async () => {
  await page.locator("#activity select").selectOption({ label: "VIP list" })
  await expect(page.locator("#activity").getByText("fan_vip").first()).toBeVisible()
  await expect(page.locator("#activity").getByText("fan_one")).toHaveCount(0)
})
