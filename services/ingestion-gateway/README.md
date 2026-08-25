# Ingestion Gateway

Corresponds to **plan.md Section 7.1**.

## Status: Functional against local Kafka
- `POST /v1/telemetry` validates basic shape and publishes to the `raw-telemetry` Kafka topic via KafkaJS.
- Auth middleware is still a stub — **no real authentication yet**.

## Remaining TODOs
1. Replace `authenticateStub` with device credential or mTLS verification.
2. Add rate limiting per `vehicleId`.
3. Optionally add an MQTT listener for constrained devices.

## Run
Requires `infra/docker-compose.yml` running (`docker compose -f infra/docker-compose.yml up -d`).
```
npm install
npm run dev
```

