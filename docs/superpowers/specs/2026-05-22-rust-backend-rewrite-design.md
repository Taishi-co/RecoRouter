# Rust Backend Full Rewrite Design

Date: 2026-05-22

## Goal

Rewrite the existing NestJS backend as a Rust backend with equivalent behavior, keep the current Taro frontend working against the same `/api/*` surface, publish the project to `https://github.com/Taishi-co/RecoRouter`, and deploy it on `62.234.29.88` behind `https://car.shcxyz.site`.

The rewrite is a backend replacement, not a product redesign. Frontend changes should be limited to production domain/build/deploy wiring and any compatibility fixes required by API parity validation.

## Current System

The project lives in `/Users/sunhanchen/Documents/recocar/projects`.

Current frontend:

- Taro 4 + React 18 + TypeScript.
- Network layer uses relative `/api/*` paths through `src/network.ts`.
- Production deployment needs to serve the H5 build and proxy API calls under the same public domain.

Current backend:

- NestJS service under `server/`.
- Global API prefix is `/api`.
- Existing Docker deployment runs Postgres, PostgREST, a PostgREST nginx proxy, and the Node API.
- The Node API talks to PostgREST through the Supabase JS client.
- File storage supports Tencent COS and local fallback under `/api/uploads/*`.

Current data store:

- PostgreSQL schema is defined in `server/database/init/01-schema.sql`.
- Tables include `users`, `demands`, `vehicles`, `orders`, `cancellation_requests`, `notifications`, `platform_settings`, `address_books`, `favorite_routes`, `demand_templates`, `demand_schedules`, `demand_publish_logs`, `user_roles`, `vehicle_rentals`, `rental_reminders`, `rental_violations`, `enterprises`, `dairy_stations`, `enterprise_demands`, and `sms_codes`.

## Recommended Architecture

Use a single Rust API service:

- Web framework: `axum`.
- Async runtime: `tokio`.
- Database access: `sqlx` with PostgreSQL.
- Serialization and validation: `serde`, `serde_json`, `validator` or explicit request validation where local behavior requires custom messages.
- Password hashing: `bcrypt` compatible with the existing stored hashes.
- Multipart upload: `axum` multipart support.
- Object storage: a Rust storage abstraction with Tencent COS first and local storage fallback.
- Scheduling: `tokio-cron-scheduler` or an internal interval worker for demand schedule publishing and rental reminder checks.
- Observability: structured logs through `tracing` and request tracing middleware.

Remove the runtime dependency on PostgREST and Supabase client. Rust should connect directly to Postgres using a `DATABASE_URL`.

## API Parity Scope

The Rust service must preserve the existing public routes and response shape for:

- `auth`
- `account-settings`
- `admin`
- `address-books`
- `cancellations`
- `demands`
- `demand`
- `demand-templates`
- `demand-schedules`
- `enterprise`
- `enterprise-vehicles`
- `fare`
- `favorite-routes`
- `home`
- `mock`
- `notifications`
- `orders`
- `platform`
- `rental-reminders`
- `rentals`
- `station`
- `user-roles`
- `vehicles`

Compatibility rules:

- Keep the `/api` prefix.
- Preserve current query parameter names such as `user_id`, `owner_id`, `merchant_id`, `enterprise_id`, and `status`.
- Preserve route names even where the current backend has both `demand` and `demands`.
- Preserve successful POST responses as HTTP 200 where the NestJS interceptor changed default 201 responses to 200.
- Preserve static file serving under `/api/uploads/*`.
- Preserve permissive CORS behavior for current frontend clients.

## Rust Module Layout

Create the Rust backend under `server-rust/` first, then switch deployment to use it once parity checks pass. Keeping it separate during migration makes comparison against the Node service easier and avoids partially breaking the current server folder.

Proposed layout:

```text
server-rust/
  Cargo.toml
  Dockerfile
  migrations/
  src/
    main.rs
    app.rs
    config.rs
    error.rs
    response.rs
    db/
      mod.rs
      models.rs
    storage/
      mod.rs
      local.rs
      cos.rs
    modules/
      auth/
      account_settings/
      admin/
      address_books/
      cancellations/
      demands/
      enterprise/
      enterprise_vehicles/
      fare/
      favorite_routes/
      home/
      notifications/
      orders/
      platform/
      rentals/
      schedules/
      stations/
      user_roles/
      vehicles/
      vehicle_mock/
```

Each module owns:

- Route registration.
- Request and response structs.
- SQL queries for that module.
- Focused unit tests for pure business logic.
- Integration tests for high-risk API paths.

Shared modules own:

- Config loading.
- Database pool setup.
- Error-to-response mapping.
- Upload storage.
- Common pagination/filter helpers.
- Common response conventions.

## Database Design

Keep the current PostgreSQL schema as the source of truth for the first Rust release. Do not rename tables or columns during the rewrite.

Implementation details:

- Move schema initialization into `server-rust/migrations`.
- Keep existing `server/database/init/01-schema.sql` available for comparison until the Rust deployment is proven.
- Use `sqlx::query!` or `query_as!` where practical.
- Use `serde_json::Value` for JSONB fields initially, then introduce typed structs where behavior is stable.
- Use `rust_decimal` for numeric money and distance fields where calculations affect fares, commissions, and prices.

## File Storage

Support the existing behavior:

- If `COS_SECRET_ID`, `COS_SECRET_KEY`, `COS_BUCKET`, and `COS_REGION` are configured, upload to Tencent COS.
- Otherwise save files under `LOCAL_UPLOAD_DIR`.
- Return a storage key from upload endpoints where the frontend expects a key.
- Generate public URLs through `PUBLIC_BASE_URL` for local storage, preserving `/api/uploads/<key>`.

The Rust storage abstraction should expose:

- `put(bytes, file_name, content_type) -> key`
- `public_url(key) -> url`
- `exists(key) -> bool`
- `delete(key) -> bool`

## Deployment Design

Docker Compose should become:

- `postgres`: PostgreSQL 16 with persistent volume.
- `recorouter-api`: Rust API image exposing an internal port.
- `nginx`: serves frontend H5 files and reverse proxies `/api/` to Rust.

Remove PostgREST and the PostgREST proxy from the new production compose file.

Public routing:

- `https://car.shcxyz.site/` serves the H5 frontend.
- `https://car.shcxyz.site/api/*` proxies to the Rust API.
- `https://car.shcxyz.site/api/health` is the primary health check.

Server prerequisites:

- DNS A record for `car.shcxyz.site` must point to `62.234.29.88`.
- Nginx on `62.234.29.88` currently redirects HTTP to `https://shcxyz.site/`; deployment must add a dedicated server block for `car.shcxyz.site`.
- TLS certificate should be issued for `car.shcxyz.site`.

## GitHub Publishing

The target repository is `Taishi-co/RecoRouter`. It currently exists and is empty, so initialize it from this project after the rewrite plan is approved.

Publishing rules:

- Do not include root-level old certificate/private key files from `/Users/sunhanchen/Documents/recocar`.
- Push the actual project directory, `/Users/sunhanchen/Documents/recocar/projects`.
- Set or add the RecoRouter remote deliberately, without losing the existing `RecoCar` remote until the transfer is verified.
- Use a branch and pull request flow if the target repository receives a default branch before publication; otherwise initialize `main`.

## Verification Plan

Before switching production traffic:

- Build frontend with `pnpm build:web`.
- Build Rust backend with `cargo test` and `cargo build --release`.
- Run database migrations against a local Postgres container.
- Run API smoke tests for auth, user roles, vehicles, demands, orders, rentals, notifications, enterprise dispatch, uploads, and health.
- Compare selected old NestJS responses against Rust responses for the same seeded data.
- Run Docker Compose locally and verify `/`, `/api/health`, and upload static file access.

After deployment:

- Verify DNS resolution for `car.shcxyz.site`.
- Verify HTTPS certificate and nginx routing.
- Verify `GET /api/health`.
- Verify frontend loads from the public domain.
- Verify login/register flow.
- Verify at least one merchant, owner, admin, and enterprise workflow.
- Verify upload endpoint returns a usable URL or key.

## Risks And Constraints

Full parity is the main risk. The existing backend has many business rules embedded in service files and not enough active tests. The rewrite should therefore proceed module by module with compatibility tests instead of a one-shot swap.

Current routing includes both merchant-side logistics (`demands`, `orders`, `rentals`) and enterprise-side dispatch (`demand`, `enterprise`, `enterprise-vehicles`, `station`). These must remain separate even where names are similar.

The production domain is not currently resolvable. Deployment cannot be fully validated until DNS points `car.shcxyz.site` to `62.234.29.88`.

The current server root contains old `car.recolink.cn` certificate files outside the Git repository. These are sensitive and must not be copied into `RecoRouter`.

## Implementation Sequence

1. Create a parity inventory from the existing NestJS controllers, DTOs, services, and SQL schema.
2. Scaffold `server-rust` with config, database pool, error handling, health route, and migrations.
3. Add storage abstraction and upload endpoints.
4. Port auth, users, user roles, account settings, and platform settings.
5. Port vehicles, demands, orders, cancellations, notifications, and fare logic.
6. Port rental workflows and reminders.
7. Port address books, favorite routes, demand templates, and demand schedules.
8. Port enterprise, stations, enterprise demands, enterprise vehicles, and mock vehicle endpoints.
9. Add Docker Compose and nginx for Rust API plus frontend static serving.
10. Update frontend production domain/build wiring for `car.shcxyz.site`.
11. Publish to `Taishi-co/RecoRouter`.
12. Deploy to `62.234.29.88` and validate public workflows.

## Self-Review

- No planned behavior depends on PostgREST or Supabase runtime APIs.
- The design preserves the current `/api/*` contract and avoids a frontend redesign.
- Deployment includes the required GitHub repository, server IP, and domain.
- Sensitive root-level certificate/private key files are explicitly excluded from publication.
- DNS is called out as an external prerequisite for final public validation.
