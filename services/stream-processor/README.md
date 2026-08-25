# Stream Processing Engine

Corresponds to **plan.md Section 7.3**.

## Status: Functional against local Kafka + Redis
- Consumes `validated-telemetry`, upserts latest state into Redis (hot store) keyed by `vehicleId`.
- Out-of-order guard: ignores events older than the currently stored `lastTimestamp`.
- Derives `status` (MOVING/STOPPED) from speed and publishes changes to `state-changes`.

## Remaining TODOs
- Append every event (including stale/out-of-order ones) to a real historical/cold store
  (e.g., a time-series DB) — intentionally not implemented in this scaffold.
- Forward events to Alert Evaluation Service is handled independently (alert-service
  consumes `validated-telemetry` directly rather than via this service).

## Run
Requires `infra/docker-compose.yml` running.
```
npm install
npm start
```

