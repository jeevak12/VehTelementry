import { test, expect } from "../fixtures/base";

/** Covers clicking a vehicle in the list panel and its effect on the map (pan + popup). */
test.describe("Map interaction", () => {
  test.beforeEach(async ({ dashboardPage }) => {
    await dashboardPage.goto();
  });

  test("opens a popup with vehicle details when selecting a vehicle from the list", async ({ dashboardPage }) => {
    await dashboardPage.selectVehicle("VH-001");

    await expect(dashboardPage.openPopup).toBeVisible();
    await expect(dashboardPage.openPopup).toContainText("VH-001");
    await expect(dashboardPage.openPopup).toContainText("MOVING");
  });

  test("popup reflects the selected vehicle's status and battery", async ({ dashboardPage }) => {
    await dashboardPage.selectVehicle("VH-004");

    await expect(dashboardPage.openPopup).toContainText("ALERTING");
    await expect(dashboardPage.openPopup).toContainText("9%");
  });

  test("switching selection updates the popup to the newly selected vehicle", async ({ dashboardPage }) => {
    await dashboardPage.selectVehicle("VH-002");
    await expect(dashboardPage.openPopup).toContainText("VH-002");

    await dashboardPage.selectVehicle("VH-003");
    await expect(dashboardPage.openPopup).toContainText("VH-003");
    await expect(dashboardPage.openPopup).not.toContainText("VH-002");
  });
});
