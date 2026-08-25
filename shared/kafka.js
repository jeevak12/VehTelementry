// Shared Kafka client factory used by all services.
// Centralizes broker connection config and topic name constants so
// every service refers to the same topics defined in plan.md Section 5.

const { Kafka, logLevel } = require("kafkajs");

const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || "localhost:9092").split(",");

const TOPICS = {
  RAW_TELEMETRY: "raw-telemetry",
  VALIDATED_TELEMETRY: "validated-telemetry",
  TELEMETRY_DLQ: "telemetry-dlq",
  ALERT_EVENTS: "alert-events",
  STATE_CHANGES: "state-changes",
};

/**
 * Creates a KafkaJS client for the given service (clientId used for logging/metrics).
 * @param {string} clientId
 */
function createKafkaClient(clientId) {
  return new Kafka({
    clientId,
    brokers: KAFKA_BROKERS,
    logLevel: logLevel.WARN,
    retry: { retries: 5 },
  });
}

/**
 * Ensures the given topics exist (idempotent). Useful for local dev where
 * auto-topic-creation may be disabled.
 * @param {import('kafkajs').Kafka} kafka
 * @param {string[]} topics
 */
async function ensureTopics(kafka, topics) {
  const admin = kafka.admin();
  await admin.connect();
  try {
    await admin.createTopics({
      waitForLeaders: true,
      topics: topics.map((topic) => ({ topic, numPartitions: 3 })),
    });
  } finally {
    await admin.disconnect();
  }
}

module.exports = { createKafkaClient, TOPICS, KAFKA_BROKERS, ensureTopics };
