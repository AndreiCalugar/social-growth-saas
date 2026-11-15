import { defineConfig, devices } from "@playwright/test"

/**
 * Browser tests against the local staging copy (see e2e/global-setup.ts).
 * Start the app first, with staging Supabase and the fake Instagram:
 *   META_GRAPH_BASE_URL=http://localhost:4010 NEXTAUTH_URL=http://localhost:3100 npx next dev -p 3100
 * then, with the same env loaded:
 *   npm run e2e
 */
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  // The flow tests share one creator and build on each other.
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    baseURL: process.env.APP_URL ?? "http://localhost:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: /mobile\.spec\.ts/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /mobile\.spec\.ts/ },
  ],
})
