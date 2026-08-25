# Vehicle Telemetry & Fleet Visualization Platform

Scaffold for the system described in [`plan.md`](./plan.md). Each service under `services/` corresponds to a component in Section 7 of the plan. This is a **structural scaffold only** — see each service's README for what still needs implementation.

## Layout

```
services/
  ingestion-gateway/        # 7.1 Telemetry Ingestion Gateway
  validation-normalization/ # 7.2 Validation & Normalization Service
  stream-processor/         # 7.3 Stream Processing Engine
  alert-service/             # 7.4 Alert Evaluation Service
  fleet-api/                 # 7.5 Fleet & Telemetry API
  realtime-update-service/  # 7.6 Real-Time Update Service
dashboard/                   # 7.7 Fleet Operator Dashboard (plain HTML/CSS/vanilla JS, no build step)
shared/
  kafka.js                   # Shared KafkaJS client factory + topic name constants
  redis.js                   # Shared ioredis client factory + hot-store key helpers
  schemas/                   # Shared telemetry/alert/config JSON Schemas (Section 8)
infra/
  docker-compose.yml         # Local Kafka + Redis + Postgres for dev
docs/
  plan.md                    # Full implementation plan
```

## Getting Started (local dev)

1. `docker compose -f infra/docker-compose.yml up -d` — starts local Kafka, Redis, and Postgres.
2. In each `services/*` folder: `npm install && npm start`. Start them in this order for a working end-to-end flow:
   `ingestion-gateway` → `validation-normalization` → `stream-processor` → `alert-service` → `fleet-api` → `realtime-update-service`.
3. Open `dashboard/index.html` directly in a browser, or serve it with `npx serve dashboard`.
4. POST a sample telemetry event to see it flow end-to-end:
   ```
   curl -X POST http://localhost:8081/v1/telemetry -H "Content-Type: application/json" -d "{\"vehicleId\":\"VH-001\",\"timestamp\":\"2026-08-24T09:00:00Z\",\"latitude\":11.0168,\"longitude\":76.9558,\"speedKph\":72,\"batteryPercent\":64}"
   ```
5. See `plan.md` Section 18 for the recommended implementation phase order and each service's README for what's still stubbed (auth, historical/cold storage, pagination, config store).


