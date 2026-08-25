# Validation & Normalization Service

Corresponds to **plan.md Section 7.2**.

## Status: Functional against local Kafka + Redis
- Consumes `raw-telemetry`, validates against `shared/schemas/telemetry-event.schema.json` (Ajv).
- Dedup via Redis `SET NX` on `(vehicleId, timestamp)`.
- GPS plausibility check: flags implausible speed implied by distance/time vs. last known position.
- Publishes valid events to `validated-telemetry`, rejects (with reason) to `telemetry-dlq`.

## Remaining TODOs
- Real unit normalization (currently a passthrough).
- Tune `MAX_PLAUSIBLE_SPEED_KPH` and dedup TTL for real-world fleets.

## Run
Requires `infra/docker-compose.yml` running.
```
npm install
npm start
```

