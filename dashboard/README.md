# Fleet Operator Dashboard

Corresponds to **plan.md Section 7.7 / Section 12**.

## Status: Functional — plain HTML/CSS/vanilla JS
- `index.html` + `styles.css` + `app.js` — no build step, no framework, no bundler.
- Loads an initial snapshot from `fleet-api` and merges WebSocket deltas from
  `realtime-update-service`. Falls back to demo data if the backend isn't reachable.
- Vehicles are shown in a list panel and plotted as real map markers using
  **Leaflet** (loaded via CDN, no API key required) with OpenStreetMap tiles.
  Marker color reflects vehicle status; clicking a list item pans/zooms the map
  to that vehicle and opens its popup.

## Next steps (see plan.md Phase 4 & 6)
1. Add server-side filtering once fleet size makes client-side filtering impractical.
2. Add historical trip playback view using `GET /v1/vehicles/{id}/trips`.
3. Add reconnect-and-resync logic when the WebSocket connection drops.


## Run
Just open `index.html` in a browser, or serve the folder with any static file server, e.g.:
```
npx serve dashboard
```
Requires `fleet-api` (port 8082) and `realtime-update-service` (port 8083) running.
Override endpoints by setting `window.FLEET_API_BASE` / `window.REALTIME_WS_URL` before `app.js` loads.

