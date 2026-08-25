// Telemetry Ingestion Gateway — plan.md Section 7.1
// Responsibilities: authenticate device, accept telemetry (HTTPS), publish raw event to streaming backbone.
//
// Remaining TODOs (see README.md):
//   - Replace stub auth middleware with real device credential / mTLS verification.
//   - Add rate limiting (e.g., express-rate-limit) per device/vehicleId.
//   - Add MQTT listener as an alternative ingestion path for constrained devices.

const express = require("express");
const { v4: uuidv4 } = require("uuid");
const { createKafkaClient, TOPICS } = require("../../../shared/kafka");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8081;

const kafka = createKafkaClient("ingestion-gateway");
const producer = kafka.producer();
let producerReady = false;

async function initProducer() {
  await producer.connect();
  producerReady = true;
  console.log("[ingestion-gateway] Kafka producer connected");
}

// TODO: replace with real auth (device credentials / mTLS)
function authenticateStub(req, res, next) {
  next();
}

app.post("/v1/telemetry", authenticateStub, async (req, res) => {
  const payload = req.body;

  // Basic shape check only — full schema validation happens downstream
  // in the Validation & Normalization service (Section 7.2).
  if (!payload || !payload.vehicleId || !payload.timestamp) {
    return res.status(400).json({ error: "vehicleId and timestamp are required" });
  }

  if (!producerReady) {
    return res.status(503).json({ error: "ingestion pipeline not ready" });
  }

  const rawEvent = {
    ...payload,
    ingestId: uuidv4(),
    receivedAt: new Date().toISOString(),
  };

  try {
    await producer.send({
      topic: TOPICS.RAW_TELEMETRY,
      messages: [{ key: rawEvent.vehicleId, value: JSON.stringify(rawEvent) }],
    });
    console.log("[ingestion-gateway] published raw telemetry", rawEvent.ingestId);
    res.status(202).json({ accepted: true, ingestId: rawEvent.ingestId });
  } catch (err) {
    console.error("[ingestion-gateway] failed to publish", err);
    res.status(502).json({ error: "failed to publish telemetry" });
  }
});

app.get("/healthz", (_req, res) => res.status(200).send(producerReady ? "ok" : "starting"));

async function start() {
  await initProducer();
  app.listen(PORT, () => {
    console.log(`[ingestion-gateway] listening on :${PORT}`);
  });
}

start().catch((err) => {
  console.error("[ingestion-gateway] fatal startup error", err);
  process.exit(1);
});

process.on("SIGTERM", async () => {
  await producer.disconnect();
  process.exit(0);
});

