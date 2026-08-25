import { type Page, type Locator, expect } from "@playwright/test";

/** Vehicle statuses surfaced by the dashboard's status filter and status badges. */
export type VehicleStatus = "MOVING" | "STOPPED" | "OFFLINE" | "ALERTING";

/**
 * Page Object Model for the Fleet Operator Dashboard (`dashboard/index.html`).
 *
 * Encapsulates all locators and common interactions so individual tests stay
 * focused on behavior/assertions rather than DOM structure.
 */
export class DashboardPage {
  readonly page: Page;
  readonly statusFilter: Locator;
  readonly searchInput: Locator;
  readonly statusBanner: Locator;
  readonly vehicleList: Locator;
  readonly mapCanvas: Locator;

  constructor(page: Page) {
    this.page = page;
    this.statusFilter = page.getByTestId("status-filter");
    this.searchInput = page.getByTestId("search-input");
    this.statusBanner = page.getByTestId("status-banner");
    this.vehicleList = page.getByTestId("vehicle-list");
    this.mapCanvas = page.getByTestId("map-canvas");
  }

  /** Navigates to the dashboard root and waits for the vehicle list to be populated. */
  async goto(): Promise<void> {
    await this.page.goto("/");
    await expect(this.vehicleItems.first()).toBeVisible();
  }

  /** All rendered vehicle list items, in current DOM order. */
  get vehicleItems(): Locator {
    return this.vehicleList.locator(".vehicle-item");
  }

  /** Locator for a single vehicle's list item by its vehicleId. */
  vehicleItem(vehicleId: string): Locator {
    return this.page.getByTestId(`vehicle-item-${vehicleId}`);
  }

  /** Filters the list/map by vehicle status via the status `<select>`. */
  async filterByStatus(status: VehicleStatus | ""): Promise<void> {
    await this.statusFilter.selectOption(status);
  }

  /** Types into the search box (debounced client-side; caller should assert with a web-first matcher). */
  async search(term: string): Promise<void> {
    await this.searchInput.fill(term);
  }

  /** Clicks a vehicle's list item, which pans the map to it and opens its popup. */
  async selectVehicle(vehicleId: string): Promise<void> {
    await this.vehicleItem(vehicleId).click();
  }

  /** Locator for the Leaflet popup currently open on the map (if any). */
  get openPopup(): Locator {
    return this.mapCanvas.locator(".leaflet-popup-content").last();
  }

  /** Returns the list of vehicleIds currently rendered, in DOM order. */
  async visibleVehicleIds(): Promise<string[]> {
    return this.vehicleItems.evaluateAll((items: Element[]) =>
      items.map((el) => el.getAttribute("data-id") ?? "")
    );
  }
}
