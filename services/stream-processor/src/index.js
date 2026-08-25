// Stream Processing Engine — plan.md Section 7.3
// Responsibilities: event-time processing keyed by vehicleId, out-of-order handling,
// upsert latest-state (hot store), derive status, forward state changes onward.
//
// Remaining TODO (see README.md): append every event to a real historical/cold store
// (e.g., a time-series DB) — intentionally out of scope for this scaffold.

const { createKafkaClient, TOPICS } = require("../../../shared/kafka");
const { createRedisClient, HOT_STATE_KEY_PREFIX } = require("../../../shared/redis");

const MOVING_SPEED_THRESHOLD_KPH = 3;

function deriveStatus(speedKph) {
  return speedKph > MOVING_SPEED_THRESHOLD_KPH ? "MOVING" : "STOPPED";
}

/**
 * Processes a single validated telemetry event: upserts hot-store latest state
 * (guarding against out-of-order/delayed events).
 * @param {import('ioredis').Redis} redis
 * @param {object} event - validated telemetry event
 * @returns {Promise<{ updated: boolean, latestState?: object }>}
 */
async function processEvent(redis, event) {
  const key = `${HOT_STATE_KEY_PREFIX}${event.vehicleId}`;
  const existingRaw = await redis.get(key);
  const existing = existingRaw ? JSON.parse(existingRaw) : null;

  // Out-of-order guard: only advance latest-state if this event is newer.
  if (existing && new Date(event.timestamp) <= new Date(existing.lastTimestamp)) {
    console.log(`[stream-processor] ignoring stale event for ${event.vehicleId}`);
    return { updated: false };
  }

  const latestState = {
    vehicleId: event.vehicleId,
    lastTimestamp: event.timestamp,
    latitude: event.latitude,
    longitude: event.longitude,
    speedKph: event.speedKph,
    batteryPercent: event.batteryPercent,
    status: deriveStatus(event.speedKph),
    activeAlerts: existing?.activeAlerts ?? [],
    lastUpdatedAt: new Date().toISOString(),
  };

  await redis.set(key, JSON.stringify(latestState));
  return { updated: true, latestState };
}

async function main() {
  const kafka = createKafkaClient("stream-processor");
  const consumer = kafka.consumer({ groupId: "stream-processor" });
  const producer = kafka.producer();
  const redis = createRedisClient();

  await producer.connect();
  await consumer.connect();
  await consumer.subscribe({ topic: TOPICS.VALIDATED_TELEMETRY, fromBeginning: false });

  console.log("[stream-processor] consuming from", TOPICS.VALIDATED_TELEMETRY);

  await consumer.run({
    eachMessage: async ({ message }) => {
      const event = JSON.parse(message.value.toString());
      const { updated, latestState } = await processEvent(redis, event);

      if (updated) {
        // Publish the state change for the Real-Time Update Service to fan out.
        await producer.send({
          topic: TOPICS.STATE_CHANGES,
          messages: [{ key: event.vehicleId, value: JSON.stringify(latestState) }],
        });
        console.log("[stream-processor] state updated:", latestState.vehicleId, latestState.status);
      }
    },
  });
}

if (require.main === module) {
  main().catch((err) => {
    console.error("[stream-processor] fatal error", err);
    process.exit(1);
  });
}

module.exports = { processEvent, deriveStatus };
