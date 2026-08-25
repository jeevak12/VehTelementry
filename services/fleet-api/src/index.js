// Fleet & Telemetry API — plan.md Section 7.5 / API design in Section 9
//
// Remaining TODOs (see README.md):
//   - Add authentication middleware (bearer token) and fleet-scoped authorization.
//   - Implement /telemetry, /trips, /alerts against a real cold/historical store
//     (this scaffold has no historical persistence — see stream-processor README).
//   - Implement cursor-based pagination for list/history endpoints.

const express = require("express");
const { createRedisClient, HOT_STATE_KEY_PREFIX } = require("../../../shared/redis");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8082;
const redis = createRedisClient();

// TODO: real auth/authorization middleware (fleet-scoped).
function authStub(req, res, next) {
  next();
}

async function getAllVehicleStates() {
  const keys = await redis.keys(`${HOT_STATE_KEY_PREFIX}*`);
  if (keys.length === 0) return [];
  const values = await redis.mget(keys);
  return values.filter(Boolean).map((v) => JSON.parse(v));
}

app.get("/v1/fleets/:fleetId/vehicles", authStub, async (req, res) => {
  const { status, search } = req.query;
  let results = await getAllVehicleStates();
  if (status) results = results.filter((v) => v.status === status);
  if (search) results = results.filter((v) => v.vehicleId.toLowerCase().includes(String(search).toLowerCase()));
  res.json({ items: results, nextCursor: null }); // TODO: real pagination
});

app.get("/v1/vehicles/:vehicleId/status", authStub, async (req, res) => {
  const raw = await redis.get(`${HOT_STATE_KEY_PREFIX}${req.params.vehicleId}`);
  if (!raw) return res.status(404).json({ error: "not found" });
  res.json(JSON.parse(raw));
});

app.get("/v1/vehicles/:vehicleId/telemetry", authStub, (req, res) => {
  // TODO: query cold/historical store using req.query.from / req.query.to
  res.json({ items: [], nextCursor: null });
});

app.get("/v1/vehicles/:vehicleId/trips", authStub, (req, res) => {
  // TODO: derive trips from historical telemetry
  res.json({ items: [], nextCursor: null });
});

app.get("/v1/vehicles/:vehicleId/alerts", authStub, (req, res) => {
  // TODO: query alert history store
  res.json({ items: [], nextCursor: null });
});

app.get("/v1/fleets/:fleetId/config", authStub, (req, res) => {
  // TODO: read from Configuration Store
  res.json({
    fleetId: req.params.fleetId,
    overspeedThresholdKph: 60,
    lowBatteryThresholdPercent: 15,
    offlineTimeoutSeconds: 120,
  });
});


app.put("/v1/fleets/:fleetId/config", authStub, (req, res) => {
  // TODO: write to Configuration Store; require config:write scope
  res.json({ fleetId: req.params.fleetId, ...req.body });
});

app.get("/healthz", (_req, res) => res.send("ok"));

app.listen(PORT, () => console.log(`[fleet-api] listening on :${PORT}`));
