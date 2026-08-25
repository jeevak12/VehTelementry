import { test, expect } from "../fixtures/base";

/**
 * Covers the initial page load and the demo-data fallback path, which is the
 * only deterministic data source available without the full backend stack
 * running (see `dashboard/app.js` `loadDemoData()`).
 */
test.describe("Dashboard initial load", () => {
  test.beforeEach(async ({ dashboardPage }) => {
    await dashboardPage.goto();
  });

  test("renders the demo vehicle list when the backend is unreachable", async ({ dashboardPage }) => {
    await expect(dashboardPage.statusBanner).toBeVisible();
    await expect(dashboardPage.statusBanner).toContainText("Backend not reachable");

    const ids = await dashboardPage.visibleVehicleIds();
    expect(ids).toEqual(expect.arrayContaining(["VH-001", "VH-002", "VH-003", "VH-004"]));
    expect(ids).toHaveLength(4);
  });

  test("shows the correct status badge for each demo vehicle", async ({ dashboardPage }) => {
    await expect(dashboardPage.vehicleItem("VH-001").getByText("MOVING")).toBeVisible();
    await expect(dashboardPage.vehicleItem("VH-002").getByText("STOPPED")).toBeVisible();
    await expect(dashboardPage.vehicleItem("VH-003").getByText("OFFLINE")).toBeVisible();
    await expect(dashboardPage.vehicleItem("VH-004").getByText("ALERTING")).toBeVisible();
  });

  test("renders a Leaflet map with tiles inside the map panel", async ({ dashboardPage, page }) => {
    await expect(dashboardPage.mapCanvas).toBeVisible();
    await expect(page.locator(".leaflet-container")).toBeVisible();
    await expect(page.locator(".leaflet-tile-pane img").first()).toBeVisible();
  });

  test("plots a map marker for every visible vehicle", async ({ dashboardPage, page }) => {
    const ids = await dashboardPage.visibleVehicleIds();
    await expect(page.locator("path.leaflet-interactive")).toHaveCount(ids.length);
  });
});
