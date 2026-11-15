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
  // Comment is ticked by default: add DM, then untick Comment.
  await page.getByRole("checkbox", { name: /^DM/ }).click()
  await page.getByRole("checkbox", { name: /^Comment/ }).click()
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

test("one automation answers both comments and DMs", async () => {
  await page.getByRole("button", { name: /New automation/ }).first().click()
  await page.getByRole("button", { name: /Start from scratch/ }).click()

  await page.getByPlaceholder(/Name your automation/).fill("Both ways")
  const comment = page.getByRole("checkbox", { name: /^Comment/ })
  const dm = page.getByRole("checkbox", { name: /^DM/ })
  const story = page.getByRole("checkbox", { name: /^Story reply/ })
  await expect(comment).toHaveAttribute("aria-checked", "true")
  await dm.click()
  await expect(dm).toHaveAttribute("aria-checked", "true")
  // DM already covers story replies.
  await expect(story).toHaveAttribute("aria-checked", "true")
  await expect(story).toBeDisabled()
  // The last trigger can't be unticked.
  await comment.click()
  await dm.click()
  await expect(dm).toHaveAttribute("aria-checked", "true")
  await comment.click()

  await expect(page.getByText("And the comment or message contains")).toBeVisible()
  await page.getByRole("button", { name: "Any post", exact: true }).click()
  const keyword = page.getByPlaceholder("LINK, GUIDE, PRICE…")
  await keyword.fill("BOTH")
  await keyword.press("Enter")
  await page.getByPlaceholder(/Here's the link you asked for/).fill("Both ways: https://example.com/both")
  await page.getByRole("button", { name: "Go live" }).click()

  await expect(row("Both ways").getByText("Comments on any post or DMs containing")).toBeVisible()
  const { data } = await db().from("dm_automations").select("triggers, trigger_type").eq("name", "Both ways").single()
  expect(data).toEqual({ triggers: ["comment", "dm"], trigger_type: "comment" })

  const commentId = await sendComment("fan_both_c", "BOTH")
  await waitForMessage((m) => m.to.comment_id === commentId && m.text.startsWith("Both ways"), "reply to the comment")
  await sendDm("fan_both_d", "BOTH")
  await waitForMessage((m) => m.to.id === "fan_both_d" && m.text.startsWith("Both ways"), "reply to the DM")
})

test("the event template comes with a reminder follow-up", async () => {
  await page.getByRole("button", { name: /New automation/ }).first().click()
  await page.getByRole("button", { name: /Event sign-ups/ }).click()
  await page.getByRole("button", { name: "English", exact: false }).first().click()
  await page.getByPlaceholder("https://").fill("example.com/event")
  await page.getByRole("button", { name: /Continue/ }).click()

  const followup = page.getByRole("switch", { name: "Send a follow-up" })
  await expect(followup).toHaveAttribute("aria-checked", "true")
  await expect(page.getByRole("radio", { name: "Didn't open the link" })).toHaveAttribute("aria-checked", "true")
  await expect(page.getByLabel("Hours until the follow-up")).toHaveValue("20")
  await expect(page.getByLabel("Follow-up message")).toHaveValue(/Did you see the link\?[\s\S]*example\.com\/event/)
  // Comments alone can't be followed up: the editor says so.
  await expect(page.getByText(/Only people who message you can get a follow-up/)).toBeVisible()

  // Switching to "opened the link" swaps the ready-made text only if it's untouched.
  await page.getByLabel("Follow-up message").fill("My own reminder https://example.com/event")
  await page.getByRole("radio", { name: "Opened the link" }).click()
  await expect(page.getByLabel("Follow-up message")).toHaveValue("My own reminder https://example.com/event")
  await page.getByRole("radio", { name: "Didn't open the link" }).click()

  await page.getByRole("checkbox", { name: /^DM/ }).click()
  await expect(page.getByText(/Only people who message you can get a follow-up/)).toHaveCount(0)
  await page.getByRole("button", { name: "Any post", exact: true }).click()
  await page.getByRole("button", { name: "Go live" }).click()

  await expect(row("Event sign-ups").getByText("Follow-up after 20h")).toBeVisible()
  const { data } = await db()
    .from("dm_automations")
    .select("followup_enabled, followup_delay_hours, followup_audience, followup_message, track_clicks")
    .eq("name", "Event sign-ups")
    .single()
  expect(data).toEqual({
    followup_enabled: true,
    followup_delay_hours: 20,
    followup_audience: "not_clicked",
    followup_message: "My own reminder https://example.com/event",
    track_clicks: true,
  })
})

test("a welcome message needs no keyword", async () => {
  await page.getByRole("button", { name: /New automation/ }).first().click()
  await page.getByRole("button", { name: /Welcome message/ }).click()
  await page.getByRole("button", { name: "English", exact: false }).first().click()
  // The link is optional: leave it out and the DM is just a message.
  await expect(page.getByText("Tell me what I can help you with", { exact: false })).toBeVisible()
  await page.getByRole("button", { name: /Continue/ }).click()
  await expect(page.getByPlaceholder(/Here's the link you asked for/)).toHaveValue(/Tell me what I can help you with/)
  await expect(page.getByPlaceholder(/Here's the link you asked for/)).not.toHaveValue(/https?:/)
  // Comes with a nudge for people who don't reply.
  await expect(page.getByRole("switch", { name: "Send a follow-up" })).toHaveAttribute("aria-checked", "true")
  await expect(page.getByRole("radio", { name: "Didn't reply" })).toHaveAttribute("aria-checked", "true")
  await expect(page.getByLabel("Follow-up message")).toHaveValue(/Just making sure you saw my message/)

  await expect(page.getByRole("checkbox", { name: /^New conversation/ })).toHaveAttribute("aria-checked", "true")
  await expect(page.getByRole("checkbox", { name: /^Comment/ })).toHaveAttribute("aria-checked", "false")
  await expect(page.getByPlaceholder("LINK, GUIDE, PRICE…")).toHaveCount(0)
  await expect(page.getByText(/Anyone who messages you for the very first time/)).toBeVisible()
  await page.getByRole("button", { name: "Go live" }).click()

  await expect(row("Welcome message").getByText("New conversations")).toBeVisible()
  await expect(row("Welcome message").getByText("Follow-up after 20h")).toBeVisible()
  const { data } = await db()
    .from("dm_automations")
    .select("triggers, keywords, followup_enabled, followup_audience")
    .eq("name", "Welcome message")
    .single()
  expect(data).toEqual({ triggers: ["new_conversation"], keywords: [], followup_enabled: true, followup_audience: "not_replied" })
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
