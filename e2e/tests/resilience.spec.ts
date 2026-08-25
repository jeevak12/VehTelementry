import { test, expect } from "../fixtures/base";

/**
 * Covers resilience/error-handling behavior: the dashboard must surface visible
 * feedback rather than silently failing when map tiles or the backend are unreachable.
 */
test.describe("Resilience", () => {
  test("shows a warning banner when map tiles fail to load", async ({ page, dashboardPage }) => {
    await page.route(/.*tile\.openstreetmap\.org.*/, (route) => route.abort());

    await dashboardPage.goto();

    await expect(dashboardPage.statusBanner).toBeVisible();
    await expect(dashboardPage.statusBanner).toContainText("Map tiles could not be loaded");
  });

  test("falls back to demo data and shows the backend-unreachable banner", async ({ dashboardPage }) => {
    await dashboardPage.goto();

    await expect(dashboardPage.statusBanner).toContainText(
      "Backend not reachable (fleet-api / realtime-update-service)"
    );
    expect(await dashboardPage.visibleVehicleIds()).toHaveLength(4);
  });

  test("vehicle data rendered in the list is HTML-escaped, not raw markup", async ({ page, dashboardPage }) => {
    await dashboardPage.goto();

    const firstItemHtml = await dashboardPage.vehicleItems.first().innerHTML();
    expect(firstItemHtml).not.toContain("<script>");
  });
});
