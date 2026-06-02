# Backend Load Test Guide

This load test is for local and test environments. Do not run it against production without an explicit traffic window, seeded test data, and rollback coverage.

## Default Scope

The default script only calls safe read endpoints:

- `GET /api/health`
- `GET /api/orders?page=1&pageSize=20`
- `GET /api/demands?page=1&pageSize=20`
- `GET /api/vehicles?page=1&pageSize=20`

It intentionally excludes real WeChat payment, transfer, upload, and write endpoints.

## Full Readiness Load Test

For launch preparation, use the readiness script after the candidate backend is
deployed:

```bash
BACKEND_BASE_URL=https://car.shcxyz.site \
pnpm loadtest:backend:readiness
```

The readiness script runs a staged load test and writes a formal Markdown report
plus a JSON evidence file under `reports/loadtest/`.

The default phases are:

- smoke: `/api/health`, `/api/hello`
- public dashboard reads: home, admin, platform, rental reminder, and location reads
- core paginated reads: orders, demands, vehicles, admin users, admin orders
- business filtered reads: owner, merchant, auth user info, notification, wallet, rental, address book, favorite route, demand template, demand schedule, and support reads
- enterprise reads: enterprise, station, demand, external pending demand, and enterprise vehicle reads
- safe compute POSTs: fare calculation, distance calculation, pricing validation, cargo analysis, and optional login

The script auto-discovers fixture IDs from list endpoints and dependent list
endpoints. You can also provide IDs explicitly:

```bash
BACKEND_BASE_URL=https://car.shcxyz.site \
LOADTEST_USER_ID=<user_id> \
LOADTEST_OWNER_ID=<owner_id> \
LOADTEST_MERCHANT_ID=<merchant_id> \
LOADTEST_ENTERPRISE_ID=<enterprise_id> \
LOADTEST_ENTERPRISE_ADMIN_ID=<enterprise_admin_id> \
LOADTEST_VEHICLE_ID=<vehicle_id> \
LOADTEST_ENTERPRISE_VEHICLE_ID=<enterprise_vehicle_id> \
LOADTEST_DEMAND_ID=<demand_id> \
LOADTEST_ORDER_ID=<order_id> \
LOADTEST_RENTAL_ID=<rental_id> \
LOADTEST_ADDRESS_ID=<address_id> \
LOADTEST_FAVORITE_ROUTE_ID=<favorite_route_id> \
LOADTEST_DEMAND_TEMPLATE_ID=<demand_template_id> \
LOADTEST_DEMAND_SCHEDULE_ID=<demand_schedule_id> \
LOADTEST_STATION_ID=<station_id> \
pnpm loadtest:backend:readiness
```

Optional login pressure requires a real test account:

```bash
LOADTEST_LOGIN_PHONE=<test_phone> \
LOADTEST_LOGIN_PASSWORD=<test_password> \
pnpm loadtest:backend:readiness
```

If a required ID cannot be discovered, that endpoint is marked as skipped in the
report instead of causing a false failure.

Readiness thresholds default to:

- max error rate: `1%`
- max overall p95 latency: `5000ms`

Override them if the launch gate uses different SLOs:

```bash
LOADTEST_MAX_ERROR_RATE=0.005 \
LOADTEST_MAX_OVERALL_P95_MS=3000 \
pnpm loadtest:backend:readiness
```

For a short dry run:

```bash
BACKEND_BASE_URL=https://car.shcxyz.site \
LOADTEST_DURATION_SECONDS=10 \
LOADTEST_CONCURRENCY=2 \
pnpm loadtest:backend:readiness
```

## Run Locally

Start the backend first:

```bash
pnpm dev:server
```

Run a short smoke test:

```bash
BACKEND_BASE_URL=http://127.0.0.1:34532 \
LOADTEST_DURATION_SECONDS=3 \
LOADTEST_CONCURRENCY=1 \
pnpm loadtest:backend
```

Run a baseline test:

```bash
BACKEND_BASE_URL=http://127.0.0.1:34532 \
LOADTEST_DURATION_SECONDS=60 \
LOADTEST_CONCURRENCY=10 \
pnpm loadtest:backend
```

## Run Against A Test Deployment

```bash
BACKEND_BASE_URL=https://test.example.com \
LOADTEST_DURATION_SECONDS=120 \
LOADTEST_CONCURRENCY=20 \
pnpm loadtest:backend
```

## Optional Endpoint Set

Use `LOADTEST_ENDPOINTS` to override the default endpoint list:

```bash
LOADTEST_ENDPOINTS="/api/health,/api/orders?page=1&pageSize=20" \
pnpm loadtest:backend
```

Keep the custom list to read-only test-safe routes unless a dedicated sandbox fixture has been prepared.

## Metrics

The script reports:

- request count per endpoint
- status-code counts
- network errors
- requests per second
- p50, p95, and p99 latency

Treat any network error or 5xx response as a failed baseline. For the first backend baseline, record:

- `LOADTEST_CONCURRENCY=1`
- `LOADTEST_CONCURRENCY=5`
- `LOADTEST_CONCURRENCY=10`
- `LOADTEST_CONCURRENCY=20`

The current backend uses a small Postgres pool, so watch p95 and p99 latency as concurrency rises.

## Payment And Transfer Routes

Do not include these routes in the default load test:

- `/api/payments/prepay`
- `/api/payments/:id/sync`
- `/api/payments/wechat/notify`
- `/api/owner-wallet/withdraw`
- `/api/owner-wallet/wechat-transfer/notify`
- `/api/auth/captcha`
- `/api/rental-reminders/check-expiry`

Those routes should be tested with a sandbox or mock provider flow focused on idempotency, duplicate callback handling, and side-effect safety, not raw throughput.
