# Alert Evaluation Service

Corresponds to **plan.md Section 7.4**.

## Status: Functional against local Kafka + Redis
- Consumes `validated-telemetry`; evaluates overspeed/low-battery against `DEFAULT_CONFIG`.
- Runs a scheduled offline sweep every 30s over all hot-store vehicle states.
- Publishes triggered alerts to `alert-events`; records active alert types in the hot store for hysteresis.

## Remaining TODOs
- Load per-fleet thresholds from a real Configuration Store instead of `DEFAULT_CONFIG`.
- Implement alert-clearing logic (currently only triggers, never clears `clearedAt`).

## Run
Requires `infra/docker-compose.yml` running.
```
npm install
npm start
```

