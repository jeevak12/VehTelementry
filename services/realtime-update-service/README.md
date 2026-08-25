# Real-Time Update Service

Corresponds to **plan.md Section 7.6**.

## Status: Functional against local Kafka
- Consumes `state-changes` and `alert-events` topics; broadcasts every message to **all** connected WebSocket clients.
- No auth on connect, no fleet-scoped filtering yet (single-tenant broadcast only).

## Remaining TODOs
1. Add auth + fleetId resolution on WebSocket upgrade.
2. Filter broadcasts by authorized fleetId per client.
3. Introduce Redis Pub/Sub (or similar) to support multiple service instances.

## Run
Requires `infra/docker-compose.yml` running.
```
npm install
npm start
```

