import { test as base, expect } from "@playwright/test";
import { DashboardPage } from "./dashboard-page";

/**
 * Extends the base Playwright `test` with a `dashboardPage` fixture so individual
 * tests don't need to construct the Page Object Model themselves, keeping setup DRY.
 */
export const test = base.extend<{ dashboardPage: DashboardPage }>({
  dashboardPage: async ({ page }, use) => {
    const dashboardPage = new DashboardPage(page);
    await use(dashboardPage);
  },
});

export { expect };
