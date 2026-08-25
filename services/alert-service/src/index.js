// Alert Evaluation Service — plan.md Section 7.4
// Responsibilities: evaluate overspeed/low-battery per event, periodic offline sweep,
// emit alert events, prevent alert-storming via hysteresis.
//
// Remaining TODO (see README.md): load thresholds from a real Configuration Store
// per fleetId — currently uses DEFAULT_CONFIG for all vehicles.

const { v4: uuidv4 } = require("uuid");
const { createKafkaClient, TOPICS } = require("../../../shared/kafka");
const { createRedisClient, HOT_STATE_KEY_PREFIX } = require("../../../shared/redis");

// TODO: load from Configuration Store per fleetId (see shared/schemas/fleet-config.schema.json)
const DEFAULT_CONFIG = {
  overspeedThresholdKph: 60,
  lowBatteryThresholdPercent: 15,
  offlineTimeoutSeconds: 120,
};

const OFFLINE_SWEEP_INTERVAL_MS = 30_000;

/**
 * Evaluates a single validated telemetry event against thresholds.
 * @param {object} event - validated telemetry event
 * @param {object} config - per-fleet thresholds
 * @param {string[]} activeAlertTypes - alert types already active for this vehicle (hysteresis)
 * @returns {object[]} newly triggered alert events
 */
function evaluateEvent(event, config = DEFAULT_CONFIG, activeAlertTypes = []) {
  const alerts = [];

  if (event.speedKph > config.overspeedThresholdKph && !activeAlertTypes.includes("OVERSPEED")) {
    alerts.push(makeAlert(event.vehicleId, "OVERSPEED", "WARNING", {
      speedKph: event.speedKph,
      thresholdKph: config.overspeedThresholdKph,
    }));
  }

  if (event.batteryPercent < config.lowBatteryThresholdPercent && !activeAlertTypes.includes("LOW_BATTERY")) {
    alerts.push(makeAlert(event.vehicleId, "LOW_BATTERY", "WARNING", {
      batteryPercent: event.batteryPercent,
      thresholdPercent: config.lowBatteryThresholdPercent,
    }));
  }

  return alerts;
}

function makeAlert(vehicleId, type, severity, details) {
  return {
    alertId: uuidv4(),
    vehicleId,
    type,
    severity,
    triggeredAt: new Date().toISOString(),
    clearedAt: null,
    details,
  };
}

/**
 * Scans all known vehicle states in the hot store and returns TELEMETRY_LOSS
 * alerts for vehicles whose last update predates the offline timeout.
 * @param {object[]} latestStates
 * @param {object} config
 */
function checkOfflineVehicles(latestStates, config = DEFAULT_CONFIG) {
  const now = Date.now();
  const offlineAlerts = [];
  for (const state of latestStates) {
    const ageSeconds = (now - new Date(state.lastTimestamp).getTime()) / 1000;
    if (ageSeconds > config.offlineTimeoutSeconds && !state.activeAlerts?.includes("TELEMETRY_LOSS")) {
      offlineAlerts.push(makeAlert(state.vehicleId, "TELEMETRY_LOSS", "CRITICAL", { ageSeconds }));
    }
  }
  return offlineAlerts;
}

/**
 * Records that an alert type is now active for a vehicle in the hot store,
 * so subsequent events don't re-trigger it (hysteresis, Section 7.4).
 */
async function markAlertActive(redis, vehicleId, alertType) {
  const key = `${HOT_STATE_KEY_PREFIX}${vehicleId}`;
  const raw = await redis.get(key);
  if (!raw) return;
  const state = JSON.parse(raw);
  state.activeAlerts = Array.from(new Set([...(state.activeAlerts ?? []), alertType]));
  await redis.set(key, JSON.stringify(state));
}

async function scanAllVehicleStates(redis) {
  const keys = await redis.keys(`${HOT_STATE_KEY_PREFIX}*`);
  if (keys.length === 0) return [];
  const values = await redis.mget(keys);
  return values.filter(Boolean).map((v) => JSON.parse(v));
}

async function main() {
  const kafka = createKafkaClient("alert-service");
  const consumer = kafka.consumer({ groupId: "alert-service" });
  const producer = kafka.producer();
  const redis = createRedisClient();

  await producer.connect();
  await consumer.connect();
  await consumer.subscribe({ topic: TOPICS.VALIDATED_TELEMETRY, fromBeginning: false });

  console.log("[alert-service] consuming from", TOPICS.VALIDATED_TELEMETRY);

  await consumer.run({
    eachMessage: async ({ message }) => {
      const event = JSON.parse(message.value.toString());
      const stateRaw = await redis.get(`${HOT_STATE_KEY_PREFIX}${event.vehicleId}`);
      const activeAlerts = stateRaw ? JSON.parse(stateRaw).activeAlerts ?? [] : [];

      const alerts = evaluateEvent(event, DEFAULT_CONFIG, activeAlerts);
      for (const alert of alerts) {
        await producer.send({
          topic: TOPICS.ALERT_EVENTS,
          messages: [{ key: alert.vehicleId, value: JSON.stringify(alert) }],
        });
        await markAlertActive(redis, alert.vehicleId, alert.type);
        console.log("[alert-service] triggered", alert.type, alert.vehicleId);
      }
    },
  });

  // Periodic offline sweep — cannot be event-driven since "absence of data" has no event (Section 7.4).
  setInterval(async () => {
    try {
      const states = await scanAllVehicleStates(redis);
      const offlineAlerts = checkOfflineVehicles(states, DEFAULT_CONFIG);
      for (const alert of offlineAlerts) {
        await producer.send({
          topic: TOPICS.ALERT_EVENTS,
          messages: [{ key: alert.vehicleId, value: JSON.stringify(alert) }],
        });
        await markAlertActive(redis, alert.vehicleId, alert.type);
        console.log("[alert-service] triggered TELEMETRY_LOSS", alert.vehicleId);
      }
    } catch (err) {
      console.error("[alert-service] offline sweep failed", err);
    }
  }, OFFLINE_SWEEP_INTERVAL_MS);
}

if (require.main === module) {
  main().catch((err) => {
    console.error("[alert-service] fatal error", err);
    process.exit(1);
  });
}

module.exports = { evaluateEvent, checkOfflineVehicles };

