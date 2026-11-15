/** The DMs page on a phone: fits the screen and the main flow works. */
import { expect, test } from "@playwright/test"
import { login } from "./helpers"

const noHorizontalScroll = () => document.documentElement.scrollWidth <= window.innerWidth + 1

test("creates an automation on a phone without sideways scrolling", async ({ page }) => {
  await login(page)
  await page.goto("/dms")
  await expect(page.getByRole("button", { name: /New automation/ }).first()).toBeVisible()
  expect(await page.evaluate(noHorizontalScroll), "page fits the screen").toBe(true)
  // Templates sit in the empty state, or behind New automation once there are automations.
  const freeGuide = page.getByRole("button", { name: /Free guide/ })
  if (!(await freeGuide.isVisible())) await page.getByRole("button", { name: /New automation/ }).first().click()

  await page.getByRole("button", { name: /Free guide/ }).click()
  await page.getByPlaceholder("https://").fill("https://example.com/ebook")
  await page.getByRole("button", { name: /Continue/ }).click()
  await page.getByRole("button", { name: "Any post", exact: true }).click()
  expect(await page.evaluate(noHorizontalScroll), "editor fits the screen").toBe(true)
  await page.getByRole("button", { name: "Go live" }).click()

  // Compact stats line instead of columns.
  await expect(page.getByText("DMs", { exact: false }).filter({ visible: true }).first()).toBeVisible()
  await expect(page.getByText("Live").first()).toBeVisible()
  expect(await page.evaluate(noHorizontalScroll), "list fits the screen").toBe(true)
})
