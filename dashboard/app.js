// Fleet Operator Dashboard — vanilla JS + Leaflet (plan.md Section 7.7 / Section 12)
//
// Remaining TODOs:
//   - Implement server-side filtering once fleet size makes client-side filtering impractical.
//   - Add historical trip playback view (Section 12) using GET /v1/vehicles/{id}/trips.

const FLEET_API_BASE = window.FLEET_API_BASE || "http://localhost:8082";
const REALTIME_WS_URL = window.REALTIME_WS_URL || "ws://localhost:8083";
const FLEET_ID = "FLEET-A";

const STATUS_COLORS = {
  MOVING: "#22c55e",
  STOPPED: "#eab308",
  OFFLINE: "#9ca3af",
  ALERTING: "#ef4444",
};

/** Escape a value for safe insertion into innerHTML / Leaflet popup HTML (XSS mitigation). */
function escapeHtml(value) {
  const str = String(value ?? "");
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Returns a debounced version of fn that delays invocation until `delay` ms of inactivity. */
function debounce(fn, delay) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/** In-memory client-side state: Map<vehicleId, vehicleState> */
const vehicles = new Map();
/** Leaflet marker instances: Map<vehicleId, L.CircleMarker> */
const markers = new Map();

let statusFilter = "";
let searchTerm = "";

const vehicleListEl = document.getElementById("vehicleList");
const statusFilterEl = document.getElementById("statusFilter");
const searchInputEl = document.getElementById("searchInput");

// Initialize the Leaflet map, centered roughly over India (matches the demo data);
// real deployments would center on the fleet's operating region or auto-fit bounds.
const map = L.map("mapCanvas").setView([15.0, 78.0], 5);
const tileLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap contributors",
}).addTo(map);

// Surface a visible warning if map tiles fail to load (e.g., offline or blocked by a
// corporate proxy), instead of silently showing a blank map.
let tileErrorWarned = false;
tileLayer.on("tileerror", () => {
  if (tileErrorWarned) return;
  tileErrorWarned = true;
  console.warn("[dashboard] map tiles failed to load — check internet connection / proxy settings");
  const banner = document.getElementById("statusBanner");
  if (banner) {
    banner.style.display = "block";
    banner.textContent =
      "⚠ Map tiles could not be loaded. Check your internet connection or proxy settings.";
  }
});

statusFilterEl.addEventListener("change", (e) => {
  statusFilter = e.target.value;
  render();
});

searchInputEl.addEventListener(
  "input",
  debounce((e) => {
    searchTerm = e.target.value.trim().toLowerCase();
    render();
  }, 200)
);

function upsertVehicle(vehicle) {
  const existing = vehicles.get(vehicle.vehicleId);
  // Reconciliation guard: ignore updates older than what we already have (Section 12).
  if (existing && vehicle.lastTimestamp && existing.lastTimestamp &&
      new Date(vehicle.lastTimestamp) < new Date(existing.lastTimestamp)) {
    return;
  }
  vehicles.set(vehicle.vehicleId, { ...existing, ...vehicle });
  render();
}

function getFilteredVehicles() {
  return [...vehicles.values()].filter((v) => {
    if (statusFilter && v.status !== statusFilter) return false;
    if (searchTerm && !v.vehicleId.toLowerCase().includes(searchTerm)) return false;
    return true;
  });
}

function updateMapMarkers(list) {
  const visibleIds = new Set(list.map((v) => v.vehicleId));

  // Remove markers for vehicles no longer in the filtered list (or removed entirely).
  for (const [vehicleId, marker] of markers.entries()) {
    if (!visibleIds.has(vehicleId)) {
      map.removeLayer(marker);
      markers.delete(vehicleId);
    }
  }

  for (const v of list) {
    if (v.latitude == null || v.longitude == null) continue;
    const color = STATUS_COLORS[v.status] ?? "#3b82f6";
    const popupHtml = `
      <strong>${escapeHtml(v.vehicleId)}</strong><br/>
      Status: ${escapeHtml(v.status ?? "UNKNOWN")}<br/>
      Speed: ${escapeHtml(v.speedKph ?? "-")} kph<br/>
      Battery: ${escapeHtml(v.batteryPercent ?? "-")}%<br/>
      Last update: ${escapeHtml(v.lastTimestamp ?? "-")}`;

    let marker = markers.get(v.vehicleId);
    if (!marker) {
      marker = L.circleMarker([v.latitude, v.longitude], {
        radius: 8,
        color: "white",
        weight: 2,
        fillColor: color,
        fillOpacity: 1,
      }).addTo(map);
      marker.bindPopup(popupHtml);
      markers.set(v.vehicleId, marker);
    } else {
      marker.setLatLng([v.latitude, v.longitude]);
      marker.setStyle({ fillColor: color });
      marker.setPopupContent(popupHtml);
    }
  }
}

function render() {
  const list = getFilteredVehicles();

  vehicleListEl.innerHTML = list
    .map(
      (v) => `
      <li class="vehicle-item" data-id="${escapeHtml(v.vehicleId)}" data-testid="vehicle-item-${escapeHtml(v.vehicleId)}">
        <div class="vehicle-id">${escapeHtml(v.vehicleId)}</div>
        <div class="vehicle-meta">${escapeHtml(v.speedKph ?? "-")} kph · ${escapeHtml(v.batteryPercent ?? "-")}% battery</div>
        <span class="status-badge ${escapeHtml(v.status ?? "")}">${escapeHtml(v.status ?? "UNKNOWN")}</span>
      </li>`
    )
    .join("");

  updateMapMarkers(list);
}

// Single delegated click listener set up once (outside render()) — avoids re-binding
// a listener per list item on every render call.
vehicleListEl.addEventListener("click", (e) => {
  const item = e.target.closest(".vehicle-item");
  if (!item) return;
  const marker = markers.get(item.dataset.id);
  if (marker) {
    map.closePopup();
    map.setView(marker.getLatLng(), 10);
    marker.openPopup();
  }
});

async function loadInitialSnapshot() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2000);
  try {
    const res = await fetch(`${FLEET_API_BASE}/v1/fleets/${FLEET_ID}/vehicles`, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    (data.items ?? []).forEach(upsertVehicle);
    setBackendStatus(true);
  } catch (err) {
    console.warn("[dashboard] fleet-api not reachable, loading demo data instead:", err.message);
    setBackendStatus(false);
    loadDemoData();
  }
}

/** Demo/offline fallback data so the dashboard is viewable without the backend running. */
function loadDemoData() {
  const demoVehicles = [
    { vehicleId: "VH-001", lastTimestamp: new Date().toISOString(), latitude: 11.0168, longitude: 76.9558, speedKph: 72, batteryPercent: 64, status: "MOVING", activeAlerts: ["OVERSPEED"] },
    { vehicleId: "VH-002", lastTimestamp: new Date().toISOString(), latitude: 12.9716, longitude: 77.5946, speedKph: 0, batteryPercent: 88, status: "STOPPED", activeAlerts: [] },
    { vehicleId: "VH-003", lastTimestamp: new Date(Date.now() - 5 * 60_000).toISOString(), latitude: 13.0827, longitude: 80.2707, speedKph: 0, batteryPercent: 42, status: "OFFLINE", activeAlerts: [] },
    { vehicleId: "VH-004", lastTimestamp: new Date().toISOString(), latitude: 19.076, longitude: 72.8777, speedKph: 45, batteryPercent: 9, status: "ALERTING", activeAlerts: ["LOW_BATTERY"] },
  ];
  demoVehicles.forEach(upsertVehicle);

  // Fit the map to show all demo markers on first load.
  const bounds = L.latLngBounds(demoVehicles.map((v) => [v.latitude, v.longitude]));
  map.fitBounds(bounds, { padding: [40, 40] });
}

function setBackendStatus(connected) {
  const banner = document.getElementById("statusBanner");
  if (!banner) return;
  if (connected) {
    banner.style.display = "none";
  } else {
    banner.style.display = "block";
    banner.textContent =
      "⚠ Backend not reachable (fleet-api / realtime-update-service). Showing demo data. " +
      "Start the services (see README) to see live data.";
  }
}

const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 30000;
let reconnectAttempts = 0;
let reconnectTimer = null;
let isFirstConnect = true;

function connectRealtimeStream() {
  let ws;
  try {
    ws = new WebSocket(REALTIME_WS_URL);
  } catch (err) {
    console.warn("[dashboard] could not create WebSocket:", err.message);
    scheduleReconnect();
    return;
  }

  ws.onopen = () => {
    setBackendStatus(true);
    reconnectAttempts = 0;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    // Resync in case any updates were missed while disconnected (skip on the very first connect,
    // since loadInitialSnapshot() already handles that case).
    if (!isFirstConnect) {
      loadInitialSnapshot();
    }
    isFirstConnect = false;
  };
  ws.onerror = () => console.warn("[dashboard] realtime WebSocket error (is realtime-update-service running?)");
  ws.onmessage = (msg) => {
    try {
      upsertVehicle(JSON.parse(msg.data));
    } catch (err) {
      console.error("[dashboard] failed to parse realtime message", err);
    }
  };
  ws.onclose = () => {
    console.warn("[dashboard] realtime connection closed — will attempt to reconnect");
    setBackendStatus(false);
    scheduleReconnect();
  };
}

/** Exponential backoff reconnect (1s, 2s, 4s, ... capped at RECONNECT_MAX_DELAY_MS). */
function scheduleReconnect() {
  if (reconnectTimer) return; // already scheduled
  const delay = Math.min(
    RECONNECT_BASE_DELAY_MS * 2 ** reconnectAttempts,
    RECONNECT_MAX_DELAY_MS
  );
  reconnectAttempts += 1;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectRealtimeStream();
  }, delay);
}


loadInitialSnapshot();
connectRealtimeStream();
render();

