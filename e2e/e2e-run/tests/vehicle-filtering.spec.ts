import { test, expect } from "../fixtures/base";

/** Covers the status-filter and search-box interactions on the vehicle list/map. */
test.describe("Vehicle filtering", () => {
  test.beforeEach(async ({ dashboardPage }) => {
    await dashboardPage.goto();
  });

  test("filters the vehicle list to only ALERTING vehicles", async ({ dashboardPage }) => {
    await dashboardPage.filterByStatus("ALERTING");

    await expect(dashboardPage.vehicleItem("VH-004")).toBeVisible();
    await expect(dashboardPage.vehicleItem("VH-001")).toBeHidden();
    await expect(dashboardPage.vehicleItem("VH-002")).toBeHidden();
    await expect(dashboardPage.vehicleItem("VH-003")).toBeHidden();

    const ids = await dashboardPage.visibleVehicleIds();
    expect(ids).toEqual(["VH-004"]);
  });

  test("clears the status filter and restores the full vehicle list", async ({ dashboardPage }) => {
    await dashboardPage.filterByStatus("OFFLINE");
    expect(await dashboardPage.visibleVehicleIds()).toEqual(["VH-003"]);

    await dashboardPage.filterByStatus("");
    expect(await dashboardPage.visibleVehicleIds()).toHaveLength(4);
  });

  test("searches by vehicle ID and narrows the list", async ({ dashboardPage }) => {
    await dashboardPage.search("VH-002");

    await expect(dashboardPage.vehicleItem("VH-002")).toBeVisible();
    const ids = await dashboardPage.visibleVehicleIds();
    expect(ids).toEqual(["VH-002"]);
  });

  test("search is case-insensitive", async ({ dashboardPage }) => {
    await dashboardPage.search("vh-003");

    await expect(dashboardPage.vehicleItem("VH-003")).toBeVisible();
  });

  test("shows an empty list when the search term matches no vehicle", async ({ dashboardPage }) => {
    await dashboardPage.search("NON-EXISTENT-ID");

    await expect(dashboardPage.vehicleItems).toHaveCount(0);
  });

  test("combines status filter and search term", async ({ dashboardPage }) => {
    await dashboardPage.filterByStatus("MOVING");
    await dashboardPage.search("VH-001");

    const ids = await dashboardPage.visibleVehicleIds();
    expect(ids).toEqual(["VH-001"]);
  });
});
