import { test as base, expect } from "@playwright/test";
import { DashboardPage } from "./dashboard-page";
import * as fs from "fs";
import * as path from "path";

// 256×256 light blue-gray tile served locally so OSM tile requests render
// visibly in screenshots/videos without needing internet access.
const PLACEHOLDER_TILE = fs.readFileSync(
  path.resolve(__dirname, "../../dashboard/placeholder-tile.png")
);

/**
 * Extends the base Playwright `test` with a `dashboardPage` fixture so individual
 * tests don't need to construct the Page Object Model themselves, keeping setup DRY.
 */
export const test = base.extend<{ dashboardPage: DashboardPage }>({
  dashboardPage: async ({ page }, use) => {
    // Mock OSM tile requests to avoid corporate-proxy failures and keep tests deterministic.
    await page.route(/.*tile\.openstreetmap\.org.*/, (route) =>
      route.fulfill({ status: 200, contentType: "image/png", body: PLACEHOLDER_TILE })
    );
    const dashboardPage = new DashboardPage(page);
    await use(dashboardPage);
  },
});

export { expect };
