import { test, expect, devices } from "@playwright/test";
import { DashboardPage } from "../fixtures/dashboard-page";

/** Covers accessibility affordances and the mobile responsive layout breakpoint. */
test.describe("Accessibility and responsiveness", () => {
  test("status banner is announced via an aria-live region", async ({ page }) => {
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();

    await expect(dashboardPage.statusBanner).toHaveAttribute("aria-live", "polite");
    await expect(dashboardPage.statusBanner).toHaveAttribute("role", "status");
  });

  test("status filter and search input have accessible names", async ({ page }) => {
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();

    await expect(page.getByLabel("Filter by status")).toBeVisible();
    await expect(page.getByLabel("Search vehicle ID")).toBeVisible();
  });

});

test.describe("Accessibility and responsiveness – mobile viewport", () => {
  const { defaultBrowserType: _, ...pixel7 } = devices["Pixel 7"];
  test.use(pixel7);

  test("stacks the vehicle list above the map on narrow viewports", async ({ page }) => {
    const dashboardPage = new DashboardPage(page);
    await dashboardPage.goto();

    const listBox = await dashboardPage.vehicleList.boundingBox();
    const mapBox = await dashboardPage.mapCanvas.boundingBox();

    expect(listBox).not.toBeNull();
    expect(mapBox).not.toBeNull();
    expect(listBox!.y).toBeLessThan(mapBox!.y);
  });
});
