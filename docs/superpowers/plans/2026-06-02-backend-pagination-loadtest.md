# Backend Pagination And Load Test Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add pagination to unbounded core backend list endpoints and add a safe test-environment load-test harness.

**Architecture:** Keep endpoint compatibility by preserving the existing `data: []` response shape for affected list APIs, while adding optional `page`, `pageSize`, `limit`, and `offset` query support. Load testing runs against local or test deployments only and excludes real WeChat payment/transfer calls.

**Tech Stack:** Rust, Axum, SQLx/Postgres, Node.js built-in HTTP tooling, pnpm scripts.

---

### Task 1: Core List Pagination

**Files:**
- Modify: `server/src/modules/orders.rs`
- Modify: `server/src/modules/demands.rs`
- Modify: `server/src/modules/vehicles.rs`
- Modify: `server/src/modules/admin.rs`
- Test: `server/tests/order_endpoints.rs`
- Test: `server/tests/demand_endpoints.rs`
- Test: `server/tests/vehicle_endpoints.rs`
- Test: `server/tests/support_endpoints.rs`

- [ ] **Step 1: Write failing pagination tests**

Add focused tests that create multiple rows, call each list endpoint with `page=1&pageSize=1` and `page=2&pageSize=1`, and assert each page returns one distinct row.

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
cargo test --manifest-path server/Cargo.toml --test order_endpoints --test demand_endpoints --test vehicle_endpoints --test support_endpoints
```

Expected: the new pagination tests fail because current endpoints ignore pagination and return all rows.

- [ ] **Step 3: Implement minimal pagination**

Add query parsing with defaults:

```rust
page: query.page.unwrap_or(1).max(1)
page_size: query.page_size.or(query.limit).unwrap_or(20).clamp(1, 100)
offset: (page - 1) * page_size
```

Apply SQL `LIMIT` and `OFFSET` to:

- `GET /api/orders`
- `GET /api/demands`
- `GET /api/vehicles`
- `GET /api/admin/users`
- `GET /api/admin/orders`

Keep the response body as `ApiEnvelope<Vec<Value>>`.

- [ ] **Step 4: Run tests to verify GREEN**

Run:

```bash
cargo test --manifest-path server/Cargo.toml --test order_endpoints --test demand_endpoints --test vehicle_endpoints --test support_endpoints
```

Expected: the new pagination tests pass and existing tests remain green.

### Task 2: Safe Load-Test Harness

**Files:**
- Create: `scripts/loadtest-backend.mjs`
- Modify: `package.json`
- Create: `docs/backend-loadtest.md`

- [ ] **Step 1: Add load-test script**

Create a Node.js script that accepts:

```bash
BACKEND_BASE_URL=http://127.0.0.1:34532 LOADTEST_DURATION_SECONDS=30 LOADTEST_CONCURRENCY=10 pnpm loadtest:backend
```

The script should hit only safe read endpoints by default:

- `/api/health`
- `/api/orders?page=1&pageSize=20`
- `/api/demands?page=1&pageSize=20`
- `/api/vehicles?page=1&pageSize=20`

- [ ] **Step 2: Add package script**

Add:

```json
"loadtest:backend": "node scripts/loadtest-backend.mjs"
```

- [ ] **Step 3: Add documentation**

Document local/test-only usage, target environment variables, recommended baselines, and explicitly exclude real payment and transfer endpoints.

- [ ] **Step 4: Smoke test script**

Run:

```bash
BACKEND_BASE_URL=http://127.0.0.1:34532 LOADTEST_DURATION_SECONDS=3 LOADTEST_CONCURRENCY=1 pnpm loadtest:backend
```

Expected: script either reports endpoint metrics against a running local backend or fails clearly if no backend is listening.

