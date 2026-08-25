// Validation & Normalization Service — plan.md Section 7.2
// Responsibilities: schema validation, range checks, dedup, unit normalization,
// route malformed records to a dead-letter queue (DLQ).

const Ajv = require("ajv");
const schema = require("../../../shared/schemas/telemetry-event.schema.json");
const { createKafkaClient, TOPICS } = require("../../../shared/kafka");
const { createRedisClient, DEDUP_KEY_PREFIX } = require("../../../shared/redis");

const ajv = new Ajv();
const validate = ajv.compile(schema);
const redis = createRedisClient();

// Max plausible speed used to flag implausible GPS jumps between consecutive
// readings for the same vehicle (Section 7.2 "treat GPS as potentially noisy").
const MAX_PLAUSIBLE_SPEED_KPH = 300;
const DEDUP_TTL_SECONDS = 300; // short-lived idempotency window

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Validates and normalizes a single raw telemetry event.
 * Performs: schema validation, dedup check (Redis), GPS plausibility check
 * against the last known position (if available).
 * @param {object} rawEvent
 * @returns {Promise<{ valid: boolean, normalized?: object, errors?: object, reason?: string }>}
 */
async function validateAndNormalize(rawEvent) {
  const schemaValid = validate(rawEvent);
  if (!schemaValid) {
    return { valid: false, errors: validate.errors, reason: "schema_validation_failed" };
  }

  const dedupKey = `${DEDUP_KEY_PREFIX}${rawEvent.vehicleId}:${rawEvent.timestamp}`;
  const isNew = await redis.set(dedupKey, "1", "EX", DEDUP_TTL_SECONDS, "NX");
  if (!isNew) {
    return { valid: false, reason: "duplicate" };
  }

  const lastKnownKey = `telemetry:last-known:${rawEvent.vehicleId}`;
  const lastKnownRaw = await redis.get(lastKnownKey);
  if (lastKnownRaw) {
    const lastKnown = JSON.parse(lastKnownRaw);
    const distanceKm = haversineKm(lastKnown.latitude, lastKnown.longitude, rawEvent.latitude, rawEvent.longitude);
    const elapsedHours = Math.max(
      (new Date(rawEvent.timestamp) - new Date(lastKnown.timestamp)) / 3_600_000,
      1 / 3600 // floor at 1 second to avoid divide-by-zero
    );
    const impliedSpeedKph = distanceKm / elapsedHours;
    if (impliedSpeedKph > MAX_PLAUSIBLE_SPEED_KPH) {
      return { valid: false, reason: "implausible_gps_jump", errors: [{ impliedSpeedKph }] };
    }
  }
  await redis.set(
    lastKnownKey,
    JSON.stringify({ latitude: rawEvent.latitude, longitude: rawEvent.longitude, timestamp: rawEvent.timestamp }),
    "EX",
    3600
  );

  const normalized = { ...rawEvent };
  return { valid: true, normalized };
}

async function main() {
  const kafka = createKafkaClient("validation-normalization");
  const consumer = kafka.consumer({ groupId: "validation-normalization" });
  const producer = kafka.producer();

  await producer.connect();
  await consumer.connect();
  await consumer.subscribe({ topic: TOPICS.RAW_TELEMETRY, fromBeginning: false });

  console.log("[validation-normalization] consuming from", TOPICS.RAW_TELEMETRY);

  await consumer.run({
    eachMessage: async ({ message }) => {
      const rawEvent = JSON.parse(message.value.toString());
      const result = await validateAndNormalize(rawEvent);

      if (result.valid) {
        await producer.send({
          topic: TOPICS.VALIDATED_TELEMETRY,
          messages: [{ key: rawEvent.vehicleId, value: JSON.stringify(result.normalized) }],
        });
        console.log("[validation-normalization] validated", rawEvent.vehicleId, rawEvent.ingestId);
      } else {
        await producer.send({
          topic: TOPICS.TELEMETRY_DLQ,
          messages: [
            {
              key: rawEvent.vehicleId,
              value: JSON.stringify({ rawEvent, reason: result.reason, errors: result.errors }),
            },
          ],
        });
        console.log("[validation-normalization] rejected", rawEvent.vehicleId, result.reason);
      }
    },
  });
}

if (require.main === module) {
  main().catch((err) => {
    console.error("[validation-normalization] fatal error", err);
    process.exit(1);
  });
}

module.exports = { validateAndNormalize, haversineKm };

