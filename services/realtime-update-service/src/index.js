// Real-Time Update Service — plan.md Section 7.6
// Responsibilities: maintain WebSocket connections per operator session, subscribe to
// state-change/alert topics, fan out updates.
//
// Remaining TODOs (see README.md):
//   - Add auth on WebSocket upgrade (verify bearer token, resolve authorized fleetIds).
//   - Filter fan-out by the fleetId(s) each connected client is authorized for
//     (currently broadcasts to all connected clients — no multi-tenant isolation yet).
//   - Use a shared pub/sub layer (e.g., Redis Pub/Sub) if this scales beyond one instance.

const WebSocket = require("ws");
const { createKafkaClient, TOPICS } = require("../../../shared/kafka");

const PORT = process.env.PORT || 8083;
const wss = new WebSocket.Server({ port: PORT });

const clients = new Set();

wss.on("connection", (ws) => {
  // TODO: parse fleetId from req.url query string and verify auth token.
  clients.add(ws);
  console.log("[realtime-update-service] client connected");
  ws.on("close", () => clients.delete(ws));
});

/**
 * Broadcasts an event to all connected clients.
 * TODO: filter recipients by fleetId authorization instead of broadcasting to all.
 * @param {object} event
 */
function broadcast(event) {
  const message = JSON.stringify(event);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

async function main() {
  const kafka = createKafkaClient("realtime-update-service");
  const consumer = kafka.consumer({ groupId: "realtime-update-service" });

  await consumer.connect();
  await consumer.subscribe({ topics: [TOPICS.STATE_CHANGES, TOPICS.ALERT_EVENTS], fromBeginning: false });

  console.log(`[realtime-update-service] listening on :${PORT}, consuming state-changes + alert-events`);

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      const event = JSON.parse(message.value.toString());
      broadcast({ topic, ...event });
    },
  });
}

main().catch((err) => {
  console.error("[realtime-update-service] fatal error", err);
  process.exit(1);
});

module.exports = { broadcast };

