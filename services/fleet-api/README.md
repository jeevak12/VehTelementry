# Fleet & Telemetry API

Corresponds to **plan.md Section 7.5** and API design in **Section 9**.

## Status: Functional against local Redis (hot store only)
- `/vehicles`, `/status` read real latest-state data from Redis.
- `/telemetry`, `/trips`, `/alerts`, `/config` (GET/PUT) remain stubbed — no cold store, alert history, or config store exist yet.
- Auth middleware is a stub — no real authentication/fleet-scoping yet.
- No pagination implemented (returns full result sets).

## Remaining TODOs
1. Implement `/telemetry`, `/trips`, `/alerts` against a real cold/historical store.
2. Add bearer-token auth and fleet-scoped authorization.
3. Implement cursor-based pagination.

## Run
Requires `infra/docker-compose.yml` running.
```
npm install
npm run dev
```

