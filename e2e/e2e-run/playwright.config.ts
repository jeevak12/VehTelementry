import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for the Fleet Operator Dashboard E2E suite.
 *
 * The dashboard (`dashboard/`) is a static, build-free HTML/CSS/JS app. When the
 * backend services (fleet-api / realtime-update-service) are not reachable, it
 * automatically falls back to deterministic demo data (see `dashboard/app.js`
 * `loadDemoData()`), which makes it possible to run these tests without standing
 * up the full Kafka/Redis stack.
 *
 * See https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [["html", { open: "never" }], ["list"]],

  use: {
    baseURL: process.env.DASHBOARD_BASE_URL ?? "http://localhost:4173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] } },
  ],

  webServer: {
    command: "npx serve ../dashboard -l 4173",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
