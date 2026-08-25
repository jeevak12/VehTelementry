// Shared Redis client factory — used as the "hot" latest-state store (plan.md Section 11)
// and as a lightweight pub/sub layer for the Real-Time Update Service (Section 15).

const Redis = require("ioredis");

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

function createRedisClient() {
  return new Redis(REDIS_URL, { maxRetriesPerRequest: 3 });
}

const HOT_STATE_KEY_PREFIX = "vehicle:state:";
const DEDUP_KEY_PREFIX = "telemetry:dedup:";
const REALTIME_CHANNEL = "realtime:updates";

module.exports = {
  createRedisClient,
  HOT_STATE_KEY_PREFIX,
  DEDUP_KEY_PREFIX,
  REALTIME_CHANNEL,
};
