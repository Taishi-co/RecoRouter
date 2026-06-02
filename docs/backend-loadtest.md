# Backend Load Test Guide

This load test is for local and test environments. Do not run it against production without an explicit traffic window, seeded test data, and rollback coverage.

## Default Scope

The default script only calls safe read endpoints:

- `GET /api/health`
- `GET /api/orders?page=1&pageSize=20`
- `GET /api/demands?page=1&pageSize=20`
- `GET /api/vehicles?page=1&pageSize=20`

It intentionally excludes real WeChat payment, transfer, upload, and write endpoints.

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

Those routes should be tested with a sandbox or mock provider flow focused on idempotency and duplicate callback handling, not raw throughput.
