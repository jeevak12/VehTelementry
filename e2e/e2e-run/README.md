# Fleet Operator Dashboard — E2E Tests (Playwright)

End-to-end tests for `dashboard/` (the vanilla HTML/CSS/JS Fleet Operator Dashboard).

## Why these tests work without the backend running

The dashboard falls back to deterministic **demo data** (4 fixed vehicles: `VH-001`
MOVING, `VH-002` STOPPED, `VH-003` OFFLINE, `VH-004` ALERTING) whenever `fleet-api` /
`realtime-update-service` aren't reachable — see `dashboard/app.js` `loadDemoData()`.
This lets the full suite run deterministically in CI/sandbox environments with zero
backend dependencies. Tests do not require `infra/docker-compose.yml` or any of the
Node services under `services/`.

## Setup

```powershell
cd e2e
npm install
npm run install:browsers
```

## Run

```powershell
npm test              # headless, all projects (Chromium, Firefox, WebKit, mobile-chrome)
npm run test:headed   # headed mode
npm run test:debug    # Playwright Inspector
npm run report        # open the last HTML report
```

Playwright automatically starts a static file server for `dashboard/` on port `4173`
(via the `webServer` config in `playwright.config.ts`) before running tests, and reuses
an already-running server locally.

## Structure

- `playwright.config.ts` — global config: projects (desktop + mobile, 3 browser engines), `webServer`, retries/reporters.
- `fixtures/dashboard-page.ts` — `DashboardPage` Page Object Model wrapping all dashboard locators/interactions.
- `fixtures/base.ts` — extends Playwright's `test` with a `dashboardPage` fixture for DRY setup across specs.
- `tests/dashboard-initial-load.spec.ts` — initial snapshot load, demo-data fallback, map/marker rendering.
- `tests/vehicle-filtering.spec.ts` — status filter + search box behavior, including combined filters.
- `tests/map-interaction.spec.ts` — selecting a vehicle from the list opens/updates its map popup.
- `tests/accessibility.spec.ts` — `aria-live` banner, accessible labels, mobile responsive stacking layout.
- `tests/resilience.spec.ts` — tile-load-failure banner, backend-unreachable banner, XSS-escaping of rendered data.

## Notes

- Locators prefer `getByTestId` (elements have `data-testid` attributes added in
  `dashboard/index.html` / `dashboard/app.js`) and role/label-based locators
  (`getByLabel`) over CSS selectors, per project convention.
- No hardcoded timeouts are used; all assertions use Playwright's web-first `expect(...).toBeVisible()`-style matchers with built-in auto-waiting.
