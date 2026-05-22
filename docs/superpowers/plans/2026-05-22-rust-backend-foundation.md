# Rust Backend Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first independently testable Rust backend slice for RecoRouter: service scaffold, PostgreSQL migrations, shared response/error handling, health routes, local/COS-ready storage, uploads, auth, account settings, user roles, and platform settings.

**Architecture:** Create `server-rust/` beside the existing NestJS `server/` so old and new behavior can be compared during the rewrite. The Rust service uses `axum`, `sqlx`, `tokio`, `serde`, `tracing`, and a small module-per-domain structure. This first phase removes PostgREST from the new service path by connecting directly to PostgreSQL through `DATABASE_URL`.

**Tech Stack:** Rust 2021, axum, tokio, sqlx/postgres, tower-http, serde, bcrypt, uuid, chrono, rust_decimal, multer support through axum multipart, tempfile for tests.

---

## Scope

This is phase 1 of the full equivalent rewrite approved in `docs/superpowers/specs/2026-05-22-rust-backend-rewrite-design.md`.

Included in this plan:

- Rust service scaffold.
- Schema migration copied from the current Postgres initialization SQL.
- Common response and error format.
- `/api/health` and `/api/hello`.
- Static local upload serving under `/api/uploads/*`.
- `/api/home/upload`.
- `/api/auth/register`, `/api/auth/login`, `/api/auth/user-info`, `/api/auth/update-payment-qr`.
- `/api/account-settings/profile`, `/api/account-settings/send-sms-code`, `/api/account-settings/change-phone`, `/api/account-settings/change-password`, `/api/account-settings/logout`.
- `/api/user-roles/my-roles`, `/api/user-roles/active`, `/api/user-roles/create`, `/api/user-roles/switch`.
- `/api/platform/settings`, `/api/platform/payment-qr`.

Not included in this phase:

- Vehicles, demands, orders, rentals, enterprise dispatch, notifications, admin, fare, mock vehicle endpoints, and production deployment. These become follow-on phase plans after this phase is green.

## File Structure

Create:

- `server-rust/Cargo.toml`: Rust package metadata and dependencies.
- `server-rust/.env.example`: documented runtime variables.
- `server-rust/Dockerfile`: release image for the Rust API.
- `server-rust/migrations/0001_init.sql`: current PostgreSQL schema adapted from `server/database/init/01-schema.sql`.
- `server-rust/src/main.rs`: binary entrypoint.
- `server-rust/src/app.rs`: router assembly.
- `server-rust/src/config.rs`: environment parsing.
- `server-rust/src/error.rs`: API error type and HTTP mapping.
- `server-rust/src/response.rs`: response envelope helpers.
- `server-rust/src/db/mod.rs`: pool creation and migration runner.
- `server-rust/src/storage/mod.rs`: storage trait and factory.
- `server-rust/src/storage/local.rs`: local disk storage and public URL generation.
- `server-rust/src/modules/health.rs`: health and hello routes.
- `server-rust/src/modules/home.rs`: upload route.
- `server-rust/src/modules/auth.rs`: auth routes and payment QR upload.
- `server-rust/src/modules/account_settings.rs`: profile, phone, password, and logout routes.
- `server-rust/src/modules/user_roles.rs`: role list, create, active, and switch routes.
- `server-rust/src/modules/platform.rs`: platform settings routes.
- `server-rust/tests/api_foundation.rs`: integration tests using a real Postgres database URL supplied by `TEST_DATABASE_URL`.

Modify:

- `package.json`: add helper scripts for Rust build/test only after `server-rust` compiles.

Do not modify in this phase:

- Existing NestJS source under `server/src`.
- Frontend pages under `src/pages`.
- Production compose/nginx files.

## Task 1: Scaffold Rust Package And Config

**Files:**

- Create: `server-rust/Cargo.toml`
- Create: `server-rust/.env.example`
- Create: `server-rust/src/config.rs`
- Create: `server-rust/src/main.rs`
- Create: `server-rust/src/app.rs`
- Create: `server-rust/src/db/mod.rs`
- Test: `server-rust/tests/api_foundation.rs`

- [ ] **Step 1: Write the failing config test**

Create `server-rust/tests/api_foundation.rs` with this first test:

```rust
use std::env;

#[test]
fn config_reads_required_database_url() {
    env::set_var("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/recocar_test");
    env::set_var("SERVER_PORT", "34532");
    env::set_var("PUBLIC_BASE_URL", "https://car.shcxyz.site");
    env::set_var("LOCAL_UPLOAD_DIR", "/tmp/recorouter-uploads");

    let config = recorouter_api::config::Config::from_env().expect("config should load");

    assert_eq!(config.database_url, "postgres://postgres:postgres@localhost:5432/recocar_test");
    assert_eq!(config.server_port, 34532);
    assert_eq!(config.public_base_url.as_deref(), Some("https://car.shcxyz.site"));
    assert_eq!(config.local_upload_dir.to_string_lossy(), "/tmp/recorouter-uploads");
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
cd /Users/sunhanchen/Documents/recocar/projects/server-rust
cargo test config_reads_required_database_url
```

Expected: fail because `server-rust/Cargo.toml` and `recorouter_api::config::Config` do not exist yet.

- [ ] **Step 3: Create `Cargo.toml`**

Create `server-rust/Cargo.toml`:

```toml
[package]
name = "recorouter-api"
version = "0.1.0"
edition = "2021"

[lib]
name = "recorouter_api"
path = "src/lib.rs"

[[bin]]
name = "recorouter-api"
path = "src/main.rs"

[dependencies]
async-trait = "0.1"
axum = { version = "0.7", features = ["multipart", "macros"] }
bcrypt = "0.15"
chrono = { version = "0.4", features = ["serde"] }
dotenvy = "0.15"
http = "1"
mime = "0.3"
rand = "0.8"
regex = "1"
rust_decimal = { version = "1", features = ["serde-with-str"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
sqlx = { version = "0.8", features = ["runtime-tokio-rustls", "postgres", "chrono", "uuid", "json", "rust_decimal", "migrate"] }
thiserror = "1"
tokio = { version = "1", features = ["macros", "rt-multi-thread", "signal", "fs"] }
tower-http = { version = "0.6", features = ["cors", "fs", "trace"] }
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }
uuid = { version = "1", features = ["v4", "serde"] }

[dev-dependencies]
hyper = "1"
tempfile = "3"
tower = "0.5"
```

- [ ] **Step 4: Create the library root**

Create `server-rust/src/lib.rs`:

```rust
pub mod app;
pub mod config;
pub mod db;
pub mod error;
pub mod response;
pub mod storage;

pub mod modules {
    pub mod account_settings;
    pub mod auth;
    pub mod health;
    pub mod home;
    pub mod platform;
    pub mod user_roles;
}
```

- [ ] **Step 5: Implement config parsing**

Create `server-rust/src/config.rs`:

```rust
use std::{env, path::PathBuf};

use thiserror::Error;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Config {
    pub database_url: String,
    pub server_port: u16,
    pub public_base_url: Option<String>,
    pub local_upload_dir: PathBuf,
    pub cos_secret_id: Option<String>,
    pub cos_secret_key: Option<String>,
    pub cos_bucket: Option<String>,
    pub cos_region: Option<String>,
}

#[derive(Debug, Error)]
pub enum ConfigError {
    #[error("DATABASE_URL is required")]
    MissingDatabaseUrl,
    #[error("SERVER_PORT must be a valid port")]
    InvalidPort,
}

impl Config {
    pub fn from_env() -> Result<Self, ConfigError> {
        let _ = dotenvy::dotenv();

        let database_url = read_trimmed("DATABASE_URL").ok_or(ConfigError::MissingDatabaseUrl)?;
        let server_port = match read_trimmed("SERVER_PORT") {
            Some(value) => value.parse::<u16>().map_err(|_| ConfigError::InvalidPort)?,
            None => 34532,
        };
        let public_base_url = read_trimmed("PUBLIC_BASE_URL").map(|value| value.trim_end_matches('/').to_string());
        let local_upload_dir = read_trimmed("LOCAL_UPLOAD_DIR")
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from("uploads"));

        Ok(Self {
            database_url,
            server_port,
            public_base_url,
            local_upload_dir,
            cos_secret_id: read_trimmed("COS_SECRET_ID"),
            cos_secret_key: read_trimmed("COS_SECRET_KEY"),
            cos_bucket: read_trimmed("COS_BUCKET"),
            cos_region: read_trimmed("COS_REGION"),
        })
    }

    pub fn has_tencent_cos(&self) -> bool {
        self.cos_secret_id.is_some()
            && self.cos_secret_key.is_some()
            && self.cos_bucket.is_some()
            && self.cos_region.is_some()
    }
}

fn read_trimmed(key: &str) -> Option<String> {
    env::var(key).ok().map(|value| value.trim().to_string()).filter(|value| !value.is_empty())
}
```

- [ ] **Step 6: Add a minimal database module**

Create `server-rust/src/db/mod.rs`:

```rust
use sqlx::{postgres::PgPoolOptions, PgPool};

use crate::config::Config;

pub async fn connect(config: &Config) -> Result<PgPool, sqlx::Error> {
    PgPoolOptions::new()
        .max_connections(10)
        .connect(&config.database_url)
        .await
}
```

- [ ] **Step 7: Add minimal app and main files**

Create `server-rust/src/app.rs`:

```rust
use std::sync::Arc;

use axum::Router;
use sqlx::PgPool;
use tower_http::{cors::CorsLayer, trace::TraceLayer};

use crate::{config::Config, storage::Storage};

#[derive(Clone)]
pub struct AppState {
    pub config: Config,
    pub db: PgPool,
    pub storage: Arc<dyn Storage>,
}

pub fn build_router(state: AppState) -> Router {
    Router::new()
        .merge(crate::modules::health::router())
        .merge(crate::modules::home::router())
        .merge(crate::modules::auth::router())
        .merge(crate::modules::account_settings::router())
        .merge(crate::modules::user_roles::router())
        .merge(crate::modules::platform::router())
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}
```

Create `server-rust/src/main.rs`:

```rust
use std::net::SocketAddr;

use recorouter_api::{app, config::Config, db, storage};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    let config = Config::from_env()?;
    let db = db::connect(&config).await?;
    let storage = storage::from_config(&config).await?;
    let state = app::AppState { config: config.clone(), db, storage };
    let router = app::build_router(state);
    let addr = SocketAddr::from(([0, 0, 0, 0], config.server_port));

    tracing::info!("recorouter-api listening on {addr}");
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, router).await?;

    Ok(())
}
```

- [ ] **Step 8: Add `.env.example`**

Create `server-rust/.env.example`:

```dotenv
DATABASE_URL=postgres://postgres:change-me@postgres:5432/recocar
SERVER_PORT=34532
PUBLIC_BASE_URL=https://car.shcxyz.site
LOCAL_UPLOAD_DIR=/app/uploads
COS_SECRET_ID=
COS_SECRET_KEY=
COS_BUCKET=
COS_REGION=
```

- [ ] **Step 9: Run the config test again**

Run:

```bash
cd /Users/sunhanchen/Documents/recocar/projects/server-rust
cargo test config_reads_required_database_url
```

Expected: PASS.

- [ ] **Step 10: Commit**

Run:

```bash
cd /Users/sunhanchen/Documents/recocar/projects
git add server-rust/Cargo.toml server-rust/.env.example server-rust/src server-rust/tests/api_foundation.rs
git commit -m "feat: scaffold rust api service"
```

## Task 2: Response Envelope, Errors, And Health Routes

**Files:**

- Modify: `server-rust/src/error.rs`
- Modify: `server-rust/src/response.rs`
- Modify: `server-rust/src/modules/health.rs`
- Modify: `server-rust/src/app.rs`
- Test: `server-rust/tests/api_foundation.rs`

- [ ] **Step 1: Add failing health route tests**

Append to `server-rust/tests/api_foundation.rs`:

```rust
use axum::body::Body;
use http::{Request, StatusCode};
use serde_json::Value;
use tower::ServiceExt;

#[tokio::test]
async fn health_route_matches_existing_shape() {
    let app = test_app().await;

    let response = app
        .oneshot(Request::builder().uri("/api/health").body(Body::empty()).unwrap())
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    let body = body_json(response).await;
    assert_eq!(body["status"], "success");
    assert!(body["data"].as_str().unwrap().contains('T'));
}

#[tokio::test]
async fn hello_route_matches_existing_shape() {
    let app = test_app().await;

    let response = app
        .oneshot(Request::builder().uri("/api/hello").body(Body::empty()).unwrap())
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    let body = body_json(response).await;
    assert_eq!(body["status"], "success");
    assert_eq!(body["data"], "Hello, welcome to coze coding mini-program server!");
}
```

Also add these helpers at the bottom of the same file:

```rust
async fn body_json(response: axum::response::Response) -> Value {
    let bytes = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
    serde_json::from_slice(&bytes).unwrap()
}
```

The `test_app()` helper is introduced in Step 4.

- [ ] **Step 2: Run health tests to verify they fail**

Run:

```bash
cd /Users/sunhanchen/Documents/recocar/projects/server-rust
cargo test health_route_matches_existing_shape hello_route_matches_existing_shape
```

Expected: FAIL because `test_app`, health routes, and response helpers are not implemented.

- [ ] **Step 3: Implement response and error modules**

Create `server-rust/src/response.rs`:

```rust
use axum::{http::StatusCode, response::IntoResponse, Json};
use serde::Serialize;
use serde_json::json;

#[derive(Debug, Serialize)]
pub struct ApiEnvelope<T>
where
    T: Serialize,
{
    pub code: u16,
    pub message: String,
    pub data: T,
}

pub fn ok<T>(message: impl Into<String>, data: T) -> Json<ApiEnvelope<T>>
where
    T: Serialize,
{
    Json(ApiEnvelope {
        code: 200,
        message: message.into(),
        data,
    })
}

pub fn status_success(data: impl Serialize) -> impl IntoResponse {
    Json(json!({
        "status": "success",
        "data": data,
    }))
}

pub fn empty_message(message: impl Into<String>) -> impl IntoResponse {
    let body = json!({
        "code": 200,
        "message": message.into(),
    });
    (StatusCode::OK, Json(body))
}
```

Create `server-rust/src/error.rs`:

```rust
use axum::{http::StatusCode, response::{IntoResponse, Response}, Json};
use serde_json::json;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ApiError {
    #[error("{0}")]
    BadRequest(String),
    #[error("{0}")]
    Unauthorized(String),
    #[error("{0}")]
    NotFound(String),
    #[error("{0}")]
    Conflict(String),
    #[error("数据库错误: {0}")]
    Database(#[from] sqlx::Error),
    #[error("文件存储错误: {0}")]
    Storage(String),
}

impl ApiError {
    fn status(&self) -> StatusCode {
        match self {
            Self::BadRequest(_) => StatusCode::BAD_REQUEST,
            Self::Unauthorized(_) => StatusCode::UNAUTHORIZED,
            Self::NotFound(_) => StatusCode::NOT_FOUND,
            Self::Conflict(_) => StatusCode::CONFLICT,
            Self::Database(_) | Self::Storage(_) => StatusCode::BAD_REQUEST,
        }
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let status = self.status();
        let body = Json(json!({
            "statusCode": status.as_u16(),
            "message": self.to_string(),
            "error": status.canonical_reason().unwrap_or("Error"),
        }));
        (status, body).into_response()
    }
}
```

- [ ] **Step 4: Implement health routes and test app helper**

Create `server-rust/src/modules/health.rs`:

```rust
use axum::{routing::get, Router};
use chrono::Utc;

use crate::response::status_success;

pub fn router() -> Router<crate::app::AppState> {
    Router::new()
        .route("/api/hello", get(hello))
        .route("/api/health", get(health))
}

async fn hello() -> impl axum::response::IntoResponse {
    status_success("Hello, welcome to coze coding mini-program server!")
}

async fn health() -> impl axum::response::IntoResponse {
    status_success(Utc::now().to_rfc3339())
}
```

Add `test_app()` to `server-rust/tests/api_foundation.rs`:

```rust
async fn test_app() -> axum::Router {
    use std::{path::PathBuf, sync::Arc};

    use recorouter_api::{
        app::{self, AppState},
        config::Config,
        storage::local::LocalStorage,
    };

    let database_url = std::env::var("TEST_DATABASE_URL")
        .unwrap_or_else(|_| "postgres://postgres:postgres@localhost:5432/recocar_test".to_string());
    let config = Config {
        database_url,
        server_port: 34532,
        public_base_url: Some("https://car.shcxyz.site".to_string()),
        local_upload_dir: PathBuf::from(tempfile::tempdir().unwrap().path()),
        cos_secret_id: None,
        cos_secret_key: None,
        cos_bucket: None,
        cos_region: None,
    };
    let db = sqlx::postgres::PgPoolOptions::new()
        .max_connections(1)
        .connect_lazy(&config.database_url)
        .unwrap();
    let storage = Arc::new(LocalStorage::new(config.local_upload_dir.clone(), config.public_base_url.clone()));

    app::build_router(AppState { config, db, storage })
}
```

- [ ] **Step 5: Run health tests again**

Run:

```bash
cd /Users/sunhanchen/Documents/recocar/projects/server-rust
cargo test health_route_matches_existing_shape hello_route_matches_existing_shape
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
cd /Users/sunhanchen/Documents/recocar/projects
git add server-rust/src/error.rs server-rust/src/response.rs server-rust/src/modules/health.rs server-rust/src/app.rs server-rust/tests/api_foundation.rs
git commit -m "feat: add rust api health routes"
```

## Task 3: Schema Migration And Seed Defaults

**Files:**

- Create: `server-rust/migrations/0001_init.sql`
- Modify: `server-rust/src/db/mod.rs`
- Test: `server-rust/tests/api_foundation.rs`

- [ ] **Step 1: Add failing migration test**

Append to `server-rust/tests/api_foundation.rs`:

```rust
#[tokio::test]
async fn migrations_create_core_tables_and_default_platform_settings() {
    let database_url = std::env::var("TEST_DATABASE_URL")
        .expect("set TEST_DATABASE_URL to run migration integration tests");
    let pool = sqlx::postgres::PgPoolOptions::new()
        .max_connections(1)
        .connect(&database_url)
        .await
        .unwrap();

    recorouter_api::db::run_migrations(&pool).await.unwrap();

    let user_table: (i64,) = sqlx::query_as(
        "select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'users'",
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    let settings: (String,) = sqlx::query_as("select id from platform_settings where id = 'default'")
        .fetch_one(&pool)
        .await
        .unwrap();

    assert_eq!(user_table.0, 1);
    assert_eq!(settings.0, "default");
}
```

- [ ] **Step 2: Run the migration test to verify it fails**

Run:

```bash
cd /Users/sunhanchen/Documents/recocar/projects/server-rust
TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/recocar_test cargo test migrations_create_core_tables_and_default_platform_settings
```

Expected: FAIL if no local test Postgres is running, or FAIL because `run_migrations` and migrations do not exist. If Postgres is not running, start one with:

```bash
docker run --name recorouter-test-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=recocar_test -p 55432:5432 -d postgres:16-alpine
```

Then rerun with:

```bash
TEST_DATABASE_URL=postgres://postgres:postgres@localhost:55432/recocar_test cargo test migrations_create_core_tables_and_default_platform_settings
```

- [ ] **Step 3: Create migration SQL**

Create `server-rust/migrations/0001_init.sql` by copying `server/database/init/01-schema.sql`, then make these exact edits:

```sql
INSERT INTO platform_settings (id, commission_rate, created_at, updated_at)
VALUES ('default', 5, now(), now())
ON CONFLICT (id) DO NOTHING;
```

Keep all existing tables, indexes, and `pgcrypto` extension from the current schema.

- [ ] **Step 4: Implement migration runner**

Modify `server-rust/src/db/mod.rs` to:

```rust
use sqlx::{postgres::PgPoolOptions, PgPool};

use crate::config::Config;

pub async fn connect(config: &Config) -> Result<PgPool, sqlx::Error> {
    PgPoolOptions::new()
        .max_connections(10)
        .connect(&config.database_url)
        .await
}

pub async fn run_migrations(pool: &PgPool) -> Result<(), sqlx::migrate::MigrateError> {
    sqlx::migrate!("./migrations").run(pool).await
}
```

- [ ] **Step 5: Run the migration test again**

Run:

```bash
cd /Users/sunhanchen/Documents/recocar/projects/server-rust
TEST_DATABASE_URL=postgres://postgres:postgres@localhost:55432/recocar_test cargo test migrations_create_core_tables_and_default_platform_settings
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
cd /Users/sunhanchen/Documents/recocar/projects
git add server-rust/migrations/0001_init.sql server-rust/src/db/mod.rs server-rust/tests/api_foundation.rs
git commit -m "feat: add rust database migrations"
```

## Task 4: Local Storage And Upload Route

**Files:**

- Create: `server-rust/src/storage/mod.rs`
- Create: `server-rust/src/storage/local.rs`
- Create: `server-rust/src/modules/home.rs`
- Modify: `server-rust/src/app.rs`
- Test: `server-rust/tests/api_foundation.rs`

- [ ] **Step 1: Add failing upload validation test**

Append to `server-rust/tests/api_foundation.rs`:

```rust
#[tokio::test]
async fn home_upload_rejects_non_image_files() {
    let app = test_app().await;
    let boundary = "X-BOUNDARY";
    let body = format!(
        "--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"bad.txt\"\r\nContent-Type: text/plain\r\n\r\nhello\r\n--{boundary}--\r\n"
    );

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/home/upload")
                .header("content-type", format!("multipart/form-data; boundary={boundary}"))
                .body(Body::from(body))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    let body = body_json(response).await;
    assert_eq!(body["message"], "不支持的文件类型，请上传图片文件");
}
```

- [ ] **Step 2: Run the upload test to verify it fails**

Run:

```bash
cd /Users/sunhanchen/Documents/recocar/projects/server-rust
cargo test home_upload_rejects_non_image_files
```

Expected: FAIL because storage and upload route are not implemented.

- [ ] **Step 3: Implement storage trait and local storage**

Create `server-rust/src/storage/mod.rs`:

```rust
use std::{path::PathBuf, sync::Arc};

use async_trait::async_trait;

use crate::{config::Config, error::ApiError};

pub mod local;

#[async_trait]
pub trait Storage: Send + Sync {
    async fn put(&self, bytes: Vec<u8>, file_name: &str, content_type: Option<&str>) -> Result<String, ApiError>;
    async fn public_url(&self, key: &str) -> Result<String, ApiError>;
    async fn exists(&self, key: &str) -> Result<bool, ApiError>;
    async fn delete(&self, key: &str) -> Result<bool, ApiError>;
}

pub async fn from_config(config: &Config) -> Result<Arc<dyn Storage>, ApiError> {
    let root: PathBuf = config.local_upload_dir.clone();
    Ok(Arc::new(local::LocalStorage::new(root, config.public_base_url.clone())))
}
```

Create `server-rust/src/storage/local.rs`:

```rust
use std::path::{Path, PathBuf};

use async_trait::async_trait;
use tokio::fs;
use uuid::Uuid;

use crate::{error::ApiError, storage::Storage};

#[derive(Debug)]
pub struct LocalStorage {
    root: PathBuf,
    public_base_url: Option<String>,
}

impl LocalStorage {
    pub fn new(root: PathBuf, public_base_url: Option<String>) -> Self {
        Self { root, public_base_url }
    }

    fn build_key(&self, file_name: &str) -> String {
        let normalized = file_name.replace('\\', "/");
        let mut segments = normalized
            .split('/')
            .filter(|part| !part.trim().is_empty())
            .map(sanitize_segment)
            .collect::<Vec<_>>();
        if segments.is_empty() {
            segments.push("file".to_string());
        }
        let joined = segments.join("/");
        let path = Path::new(&joined);
        let stem = path.file_stem().and_then(|value| value.to_str()).unwrap_or("file");
        let ext = path.extension().and_then(|value| value.to_str()).map(|value| format!(".{value}")).unwrap_or_default();
        let suffix = Uuid::new_v4().simple().to_string();
        let suffix = &suffix[..8];
        match path.parent().and_then(|value| value.to_str()).filter(|value| !value.is_empty()) {
            Some(parent) => format!("{parent}/{stem}_{suffix}{ext}"),
            None => format!("{stem}_{suffix}{ext}"),
        }
    }

    fn resolve_key(&self, key: &str) -> Result<(String, PathBuf), ApiError> {
        let safe_key = key
            .replace('\\', "/")
            .split('/')
            .filter(|part| !part.trim().is_empty())
            .map(sanitize_segment)
            .collect::<Vec<_>>()
            .join("/");
        let resolved = self.root.join(&safe_key);
        if !resolved.starts_with(&self.root) {
            return Err(ApiError::Storage("Invalid file key".to_string()));
        }
        Ok((safe_key, resolved))
    }
}

#[async_trait]
impl Storage for LocalStorage {
    async fn put(&self, bytes: Vec<u8>, file_name: &str, _content_type: Option<&str>) -> Result<String, ApiError> {
        let key = self.build_key(file_name);
        let (_, resolved) = self.resolve_key(&key)?;
        if let Some(parent) = resolved.parent() {
            fs::create_dir_all(parent).await.map_err(|error| ApiError::Storage(error.to_string()))?;
        }
        fs::write(resolved, bytes).await.map_err(|error| ApiError::Storage(error.to_string()))?;
        Ok(key)
    }

    async fn public_url(&self, key: &str) -> Result<String, ApiError> {
        let (safe_key, _) = self.resolve_key(key)?;
        let encoded = safe_key.split('/').map(url_escape).collect::<Vec<_>>().join("/");
        let path = format!("/api/uploads/{encoded}");
        Ok(match &self.public_base_url {
            Some(base) => format!("{}{}", base.trim_end_matches('/'), path),
            None => path,
        })
    }

    async fn exists(&self, key: &str) -> Result<bool, ApiError> {
        let (_, resolved) = self.resolve_key(key)?;
        Ok(fs::try_exists(resolved).await.map_err(|error| ApiError::Storage(error.to_string()))?)
    }

    async fn delete(&self, key: &str) -> Result<bool, ApiError> {
        let (_, resolved) = self.resolve_key(key)?;
        match fs::remove_file(resolved).await {
            Ok(()) => Ok(true),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(true),
            Err(error) => Err(ApiError::Storage(error.to_string())),
        }
    }
}

fn sanitize_segment(segment: &str) -> String {
    let mut safe = segment
        .trim()
        .chars()
        .map(|ch| if ch.is_ascii_alphanumeric() || matches!(ch, '.' | '_' | '-') { ch } else { '_' })
        .collect::<String>();
    while safe.contains("__") {
        safe = safe.replace("__", "_");
    }
    safe = safe.trim_matches(['.', '_', '-']).to_string();
    if safe.is_empty() { "file".to_string() } else { safe }
}

fn url_escape(value: &str) -> String {
    value.replace(' ', "%20")
}
```

- [ ] **Step 4: Implement home upload route**

Create `server-rust/src/modules/home.rs`:

```rust
use axum::{extract::{Multipart, State}, routing::post, Json, Router};
use serde_json::json;

use crate::{app::AppState, error::ApiError, response::ok};

pub fn router() -> Router<AppState> {
    Router::new().route("/api/home/upload", post(upload_file))
}

async fn upload_file(State(state): State<AppState>, mut multipart: Multipart) -> Result<Json<crate::response::ApiEnvelope<serde_json::Value>>, ApiError> {
    let mut file_name = None;
    let mut content_type = None;
    let mut bytes = None;

    while let Some(field) = multipart.next_field().await.map_err(|error| ApiError::BadRequest(error.to_string()))? {
        if field.name() != Some("file") {
            continue;
        }
        file_name = field.file_name().map(str::to_string);
        content_type = field.content_type().map(str::to_string);
        bytes = Some(field.bytes().await.map_err(|error| ApiError::BadRequest(error.to_string()))?.to_vec());
        break;
    }

    let bytes = bytes.ok_or_else(|| ApiError::BadRequest("文件不能为空".to_string()))?;
    let file_name = file_name.unwrap_or_else(|| "file".to_string());
    let content_type = content_type.unwrap_or_else(|| "application/octet-stream".to_string());
    let allowed = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
    if !allowed.contains(&content_type.as_str()) {
        return Err(ApiError::BadRequest("不支持的文件类型，请上传图片文件".to_string()));
    }
    if bytes.len() > 5 * 1024 * 1024 {
        return Err(ApiError::BadRequest("文件大小不能超过5MB".to_string()));
    }

    let ext = file_name.rsplit('.').next().unwrap_or("jpg");
    let random = uuid::Uuid::new_v4().simple().to_string();
    let storage_name = format!("cargo-photos/{}-{}.{}", chrono::Utc::now().timestamp_millis(), &random[..12], ext);
    let key = state.storage.put(bytes, &storage_name, Some(&content_type)).await?;
    let url = state.storage.public_url(&key).await?;

    Ok(ok("上传成功", json!({ "fileKey": key, "url": url })))
}
```

- [ ] **Step 5: Run the upload validation test again**

Run:

```bash
cd /Users/sunhanchen/Documents/recocar/projects/server-rust
cargo test home_upload_rejects_non_image_files
```

Expected: PASS.

- [ ] **Step 6: Add successful upload test**

Append to `server-rust/tests/api_foundation.rs`:

```rust
#[tokio::test]
async fn home_upload_stores_image_and_returns_key_and_url() {
    let app = test_app().await;
    let boundary = "X-BOUNDARY";
    let body = format!(
        "--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"cargo.png\"\r\nContent-Type: image/png\r\n\r\nPNGDATA\r\n--{boundary}--\r\n"
    );

    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/home/upload")
                .header("content-type", format!("multipart/form-data; boundary={boundary}"))
                .body(Body::from(body))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    let body = body_json(response).await;
    assert_eq!(body["code"], 200);
    assert_eq!(body["message"], "上传成功");
    assert!(body["data"]["fileKey"].as_str().unwrap().starts_with("cargo-photos/"));
    assert!(body["data"]["url"].as_str().unwrap().starts_with("https://car.shcxyz.site/api/uploads/"));
}
```

- [ ] **Step 7: Run upload tests**

Run:

```bash
cd /Users/sunhanchen/Documents/recocar/projects/server-rust
cargo test home_upload_
```

Expected: PASS.

- [ ] **Step 8: Commit**

Run:

```bash
cd /Users/sunhanchen/Documents/recocar/projects
git add server-rust/src/storage server-rust/src/modules/home.rs server-rust/src/app.rs server-rust/tests/api_foundation.rs
git commit -m "feat: add rust local file uploads"
```

## Task 5: Auth Routes

**Files:**

- Create: `server-rust/src/modules/auth.rs`
- Modify: `server-rust/src/app.rs`
- Test: `server-rust/tests/api_foundation.rs`

- [ ] **Step 1: Add failing register/login tests**

Append to `server-rust/tests/api_foundation.rs`:

```rust
#[tokio::test]
async fn auth_register_and_login_preserve_response_shape() {
    let app = test_app().await;
    let phone = format!("139{:08}", rand::random::<u32>() % 100000000);

    let register = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/auth/register")
                .header("content-type", "application/json")
                .body(Body::from(serde_json::json!({
                    "phone": phone,
                    "password": "secret123",
                    "name": "测试用户",
                    "role": "owner"
                }).to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(register.status(), StatusCode::OK);
    let register_body = body_json(register).await;
    assert_eq!(register_body["code"], 200);
    assert_eq!(register_body["message"], "注册成功");
    assert_eq!(register_body["data"]["phone"], phone);
    assert_eq!(register_body["data"]["role"], "owner");
    assert_eq!(register_body["data"]["token"], register_body["data"]["id"]);

    let login = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/auth/login")
                .header("content-type", "application/json")
                .body(Body::from(serde_json::json!({
                    "phone": phone,
                    "password": "secret123"
                }).to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(login.status(), StatusCode::OK);
    let login_body = body_json(login).await;
    assert_eq!(login_body["code"], 200);
    assert_eq!(login_body["message"], "登录成功");
    assert_eq!(login_body["data"]["phone"], phone);
    assert_eq!(login_body["data"]["token"], login_body["data"]["id"]);
}
```

- [ ] **Step 2: Run auth tests to verify they fail**

Run:

```bash
cd /Users/sunhanchen/Documents/recocar/projects/server-rust
TEST_DATABASE_URL=postgres://postgres:postgres@localhost:55432/recocar_test cargo test auth_register_and_login_preserve_response_shape
```

Expected: FAIL because `/api/auth/register` and `/api/auth/login` are not implemented.

- [ ] **Step 3: Implement auth module**

Create `server-rust/src/modules/auth.rs` with:

```rust
use axum::{extract::{Multipart, Query, State}, routing::{get, post}, Json, Router};
use bcrypt::{hash, verify, DEFAULT_COST};
use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;

use crate::{app::AppState, error::ApiError, response::{ok, ApiEnvelope}};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/auth/register", post(register))
        .route("/api/auth/login", post(login))
        .route("/api/auth/user-info", get(user_info))
        .route("/api/auth/update-payment-qr", post(update_payment_qr))
}

#[derive(Debug, Deserialize)]
struct RegisterRequest {
    phone: String,
    password: String,
    name: String,
    role: String,
}

#[derive(Debug, Deserialize)]
struct LoginRequest {
    phone: String,
    password: String,
}

#[derive(Debug, Deserialize)]
struct UserInfoQuery {
    #[serde(rename = "userId")]
    user_id: String,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
struct UserInfo {
    id: String,
    phone: Option<String>,
    name: Option<String>,
    role: Option<String>,
    token: String,
}

#[derive(Debug, sqlx::FromRow)]
struct UserRow {
    id: String,
    phone: Option<String>,
    password: Option<String>,
    name: Option<String>,
    role: Option<String>,
    status: Option<String>,
}

async fn register(State(state): State<AppState>, Json(body): Json<RegisterRequest>) -> Result<Json<ApiEnvelope<UserInfo>>, ApiError> {
    validate_phone(&body.phone)?;
    if body.password.len() < 6 {
        return Err(ApiError::BadRequest("密码至少6位".to_string()));
    }
    if body.name.trim().is_empty() {
        return Err(ApiError::BadRequest("姓名不能为空".to_string()));
    }
    if !matches!(body.role.as_str(), "owner" | "merchant") {
        return Err(ApiError::BadRequest("角色必须为 owner 或 merchant".to_string()));
    }

    let exists: Option<(String,)> = sqlx::query_as("select id from users where phone = $1")
        .bind(&body.phone)
        .fetch_optional(&state.db)
        .await?;
    if exists.is_some() {
        return Err(ApiError::Conflict("该手机号已注册".to_string()));
    }

    let user_id = Uuid::new_v4().to_string();
    let password = hash(&body.password, DEFAULT_COST).map_err(|error| ApiError::BadRequest(error.to_string()))?;
    let row: UserRow = sqlx::query_as(
        "insert into users (id, phone, password, role, name, status) values ($1, $2, $3, $4, $5, 'active') returning id, phone, password, name, role, status",
    )
    .bind(&user_id)
    .bind(&body.phone)
    .bind(password)
    .bind(&body.role)
    .bind(&body.name)
    .fetch_one(&state.db)
    .await?;

    Ok(ok("注册成功", user_info_from_row(row)))
}

async fn login(State(state): State<AppState>, Json(body): Json<LoginRequest>) -> Result<Json<ApiEnvelope<UserInfo>>, ApiError> {
    validate_phone(&body.phone)?;
    let row: Option<UserRow> = sqlx::query_as("select id, phone, password, name, role, status from users where phone = $1")
        .bind(&body.phone)
        .fetch_optional(&state.db)
        .await?;
    let row = row.ok_or_else(|| ApiError::Unauthorized("用户不存在".to_string()))?;
    let password = row.password.clone().unwrap_or_default();
    let ok_password = verify(&body.password, &password).map_err(|error| ApiError::BadRequest(error.to_string()))?;
    if !ok_password {
        return Err(ApiError::Unauthorized("密码错误".to_string()));
    }
    if row.status.as_deref() == Some("disabled") {
        return Err(ApiError::Unauthorized("账号已被禁用".to_string()));
    }
    Ok(ok("登录成功", user_info_from_row(row)))
}

async fn user_info(State(state): State<AppState>, Query(query): Query<UserInfoQuery>) -> Result<Json<ApiEnvelope<serde_json::Value>>, ApiError> {
    let row: Option<(String, Option<String>, Option<String>, Option<String>, Option<String>, Option<chrono::DateTime<chrono::Utc>>)> =
        sqlx::query_as("select id, phone, name, role, avatar, wechat_payment_qr, created_at from users where id = $1")
            .bind(&query.user_id)
            .fetch_optional(&state.db)
            .await?;
    let (id, phone, name, role, avatar, payment_key, created_at) = row.ok_or_else(|| ApiError::NotFound("用户不存在".to_string()))?;
    let payment_url = match payment_key {
        Some(key) => state.storage.public_url(&key).await.ok(),
        None => None,
    };

    Ok(ok("查询成功", json!({
        "id": id,
        "phone": phone,
        "name": name,
        "role": role,
        "avatar": avatar,
        "wechat_payment_qr": payment_url,
        "created_at": created_at,
    })))
}

async fn update_payment_qr(State(state): State<AppState>, mut multipart: Multipart) -> Result<Json<ApiEnvelope<serde_json::Value>>, ApiError> {
    let mut user_id = None;
    let mut file_name = None;
    let mut content_type = None;
    let mut bytes = None;

    while let Some(field) = multipart.next_field().await.map_err(|error| ApiError::BadRequest(error.to_string()))? {
        match field.name() {
            Some("userId") => user_id = Some(field.text().await.map_err(|error| ApiError::BadRequest(error.to_string()))?),
            Some("file") => {
                file_name = field.file_name().map(str::to_string);
                content_type = field.content_type().map(str::to_string);
                bytes = Some(field.bytes().await.map_err(|error| ApiError::BadRequest(error.to_string()))?.to_vec());
            }
            _ => {}
        }
    }

    let user_id = user_id.ok_or_else(|| ApiError::BadRequest("用户ID不能为空".to_string()))?;
    let (id, phone, name, role): (String, Option<String>, Option<String>, Option<String>) =
        sqlx::query_as("select id, phone, name, role from users where id = $1")
            .bind(&user_id)
            .fetch_optional(&state.db)
            .await?
            .ok_or_else(|| ApiError::NotFound("用户不存在".to_string()))?;
    if role.as_deref() != Some("owner") {
        return Err(ApiError::BadRequest("只有车主可以上传收款码".to_string()));
    }
    let bytes = bytes.ok_or_else(|| ApiError::BadRequest("请上传收款码图片".to_string()))?;
    let original = file_name.unwrap_or_else(|| "payment.png".to_string());
    let storage_name = format!("payment_qr/{}_{}_{}", user_id, chrono::Utc::now().timestamp_millis(), original);
    let key = state.storage.put(bytes, &storage_name, content_type.as_deref()).await?;
    sqlx::query("update users set wechat_payment_qr = $1 where id = $2")
        .bind(&key)
        .bind(&user_id)
        .execute(&state.db)
        .await?;
    let url = state.storage.public_url(&key).await?;

    Ok(ok("收款码上传成功", json!({
        "id": id,
        "phone": phone,
        "name": name,
        "role": role,
        "wechat_payment_qr": url,
    })))
}

fn user_info_from_row(row: UserRow) -> UserInfo {
    UserInfo {
        token: row.id.clone(),
        id: row.id,
        phone: row.phone,
        name: row.name,
        role: row.role,
    }
}

fn validate_phone(phone: &str) -> Result<(), ApiError> {
    let re = regex::Regex::new(r"^1[3-9]\d{9}$").unwrap();
    if re.is_match(phone) {
        Ok(())
    } else {
        Err(ApiError::BadRequest("手机号格式不正确".to_string()))
    }
}
```

- [ ] **Step 4: Run auth tests again**

Run:

```bash
cd /Users/sunhanchen/Documents/recocar/projects/server-rust
TEST_DATABASE_URL=postgres://postgres:postgres@localhost:55432/recocar_test cargo test auth_register_and_login_preserve_response_shape
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
cd /Users/sunhanchen/Documents/recocar/projects
git add server-rust/src/modules/auth.rs server-rust/src/app.rs server-rust/tests/api_foundation.rs
git commit -m "feat: port auth endpoints to rust"
```

## Task 6: Account Settings, User Roles, And Platform Settings

**Files:**

- Create: `server-rust/src/modules/account_settings.rs`
- Create: `server-rust/src/modules/user_roles.rs`
- Create: `server-rust/src/modules/platform.rs`
- Modify: `server-rust/src/app.rs`
- Test: `server-rust/tests/api_foundation.rs`

- [ ] **Step 1: Add failing smoke tests for the remaining phase-1 routes**

Append to `server-rust/tests/api_foundation.rs`:

```rust
#[tokio::test]
async fn account_user_roles_and_platform_routes_are_available() {
    let app = test_app().await;
    let phone = format!("138{:08}", rand::random::<u32>() % 100000000);

    let register = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/auth/register")
                .header("content-type", "application/json")
                .body(Body::from(serde_json::json!({
                    "phone": phone,
                    "password": "secret123",
                    "name": "角色用户",
                    "role": "merchant"
                }).to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    let user_id = body_json(register).await["data"]["id"].as_str().unwrap().to_string();

    let roles = app
        .clone()
        .oneshot(Request::builder().uri(format!("/api/user-roles/my-roles?userId={user_id}")).body(Body::empty()).unwrap())
        .await
        .unwrap();
    assert_eq!(roles.status(), StatusCode::OK);
    let roles_body = body_json(roles).await;
    assert_eq!(roles_body["code"], 200);
    assert_eq!(roles_body["data"][0]["role"], "merchant");

    let profile = app
        .clone()
        .oneshot(Request::builder().uri("/api/account-settings/profile").body(Body::empty()).unwrap())
        .await
        .unwrap();
    assert!(matches!(profile.status(), StatusCode::OK | StatusCode::BAD_REQUEST));

    let settings = app
        .oneshot(Request::builder().uri("/api/platform/settings").body(Body::empty()).unwrap())
        .await
        .unwrap();
    assert_eq!(settings.status(), StatusCode::OK);
    let settings_body = body_json(settings).await;
    assert_eq!(settings_body["code"], 200);
    assert_eq!(settings_body["message"], "查询成功");
}
```

- [ ] **Step 2: Run the smoke test to verify it fails**

Run:

```bash
cd /Users/sunhanchen/Documents/recocar/projects/server-rust
TEST_DATABASE_URL=postgres://postgres:postgres@localhost:55432/recocar_test cargo test account_user_roles_and_platform_routes_are_available
```

Expected: FAIL because account, user role, and platform route modules are not implemented.

- [ ] **Step 3: Implement `account_settings.rs`**

Create `server-rust/src/modules/account_settings.rs`:

```rust
use axum::{extract::State, routing::{get, post, put}, Json, Router};
use bcrypt::{hash, verify, DEFAULT_COST};
use rand::Rng;
use serde::Deserialize;

use crate::{app::AppState, error::ApiError, response::{empty_message, ok}};

const FALLBACK_USER_ID: &str = "7428999e-92fa-4fec-9f75-09087edbf244";

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/account-settings/profile", get(get_profile).put(update_profile))
        .route("/api/account-settings/send-sms-code", post(send_sms_code))
        .route("/api/account-settings/change-phone", post(change_phone))
        .route("/api/account-settings/change-password", post(change_password))
        .route("/api/account-settings/logout", post(logout))
}

#[derive(Debug, Deserialize)]
struct UpdateProfileRequest {
    avatar_url: Option<String>,
    nickname: Option<String>,
    gender: Option<String>,
    birthday: Option<String>,
    user_id: Option<String>,
}

#[derive(Debug, Deserialize)]
struct SendSmsCodeRequest {
    phone: String,
    #[serde(rename = "type")]
    code_type: String,
}

#[derive(Debug, Deserialize)]
struct ChangePhoneRequest {
    code: String,
    #[serde(rename = "newPhone")]
    new_phone: String,
    user_id: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ChangePasswordRequest {
    #[serde(rename = "oldPassword")]
    old_password: String,
    #[serde(rename = "newPassword")]
    new_password: String,
    user_id: Option<String>,
}

async fn get_profile(State(state): State<AppState>) -> Result<impl axum::response::IntoResponse, ApiError> {
    let row = sqlx::query_as::<_, serde_json::Value>(
        "select row_to_json(u) from (select id, phone, nickname, avatar_url, gender, birthday, role, avatar_url, name, created_at from users where id = $1) u",
    )
    .bind(FALLBACK_USER_ID)
    .fetch_optional(&state.db)
    .await?;
    let profile = row.ok_or_else(|| ApiError::BadRequest("用户不存在".to_string()))?;
    Ok(ok("获取成功", profile))
}

async fn update_profile(State(state): State<AppState>, Json(body): Json<UpdateProfileRequest>) -> Result<impl axum::response::IntoResponse, ApiError> {
    let user_id = body.user_id.as_deref().unwrap_or(FALLBACK_USER_ID);
    if body.avatar_url.is_none() && body.nickname.is_none() && body.gender.is_none() && body.birthday.is_none() {
        return Err(ApiError::BadRequest("没有需要更新的字段".to_string()));
    }
    let row = sqlx::query_as::<_, serde_json::Value>(
        r#"
        update users set
          avatar_url = coalesce($2, avatar_url),
          nickname = coalesce($3, nickname),
          gender = coalesce($4, gender),
          birthday = coalesce($5::date, birthday),
          updated_at = now()
        where id = $1
        returning row_to_json(users)
        "#,
    )
    .bind(user_id)
    .bind(body.avatar_url)
    .bind(body.nickname)
    .bind(body.gender)
    .bind(body.birthday)
    .fetch_optional(&state.db)
    .await?;
    let profile = row.ok_or_else(|| ApiError::BadRequest("用户不存在".to_string()))?;
    Ok(ok("更新成功", profile))
}

async fn send_sms_code(State(state): State<AppState>, Json(body): Json<SendSmsCodeRequest>) -> Result<impl axum::response::IntoResponse, ApiError> {
    validate_phone(&body.phone)?;
    let recent: Option<(chrono::DateTime<chrono::Utc>,)> = sqlx::query_as(
        "select created_at from sms_codes where phone = $1 and type = $2 and created_at > now() - interval '60 seconds' limit 1",
    )
    .bind(&body.phone)
    .bind(&body.code_type)
    .fetch_optional(&state.db)
    .await?;
    if recent.is_some() {
        return Err(ApiError::BadRequest("发送过于频繁，请稍后再试".to_string()));
    }
    let code = format!("{:06}", rand::thread_rng().gen_range(0..=999999));
    sqlx::query("insert into sms_codes (phone, code, type, is_used, expires_at) values ($1, $2, $3, false, now() + interval '5 minutes')")
        .bind(&body.phone)
        .bind(&code)
        .bind(&body.code_type)
        .execute(&state.db)
        .await?;
    Ok(ok("验证码已发送", serde_json::json!({ "code": code })))
}

async fn change_phone(State(state): State<AppState>, Json(body): Json<ChangePhoneRequest>) -> Result<impl axum::response::IntoResponse, ApiError> {
    let user_id = body.user_id.as_deref().unwrap_or(FALLBACK_USER_ID);
    let code: Option<(String,)> = sqlx::query_as(
        "select id from sms_codes where phone = $1 and code = $2 and is_used = false and created_at > now() - interval '5 minutes' order by created_at desc limit 1",
    )
    .bind(&body.new_phone)
    .bind(&body.code)
    .fetch_optional(&state.db)
    .await?;
    let code_id = code.ok_or_else(|| ApiError::BadRequest("验证码无效或已过期".to_string()))?.0;
    let existing: Option<(String,)> = sqlx::query_as("select id from users where phone = $1 and id <> $2 limit 1")
        .bind(&body.new_phone)
        .bind(user_id)
        .fetch_optional(&state.db)
        .await?;
    if existing.is_some() {
        return Err(ApiError::BadRequest("该手机号已被使用".to_string()));
    }
    sqlx::query("update users set phone = $1, updated_at = now() where id = $2")
        .bind(&body.new_phone)
        .bind(user_id)
        .execute(&state.db)
        .await?;
    sqlx::query("update sms_codes set is_used = true where id = $1")
        .bind(code_id)
        .execute(&state.db)
        .await?;
    Ok(empty_message("手机号修改成功"))
}

async fn change_password(State(state): State<AppState>, Json(body): Json<ChangePasswordRequest>) -> Result<impl axum::response::IntoResponse, ApiError> {
    let user_id = body.user_id.as_deref().unwrap_or(FALLBACK_USER_ID);
    let row: Option<(String,)> = sqlx::query_as("select password from users where id = $1")
        .bind(user_id)
        .fetch_optional(&state.db)
        .await?;
    let old_hash = row.ok_or_else(|| ApiError::BadRequest("用户不存在".to_string()))?.0;
    if !verify(&body.old_password, &old_hash).map_err(|error| ApiError::BadRequest(error.to_string()))? {
        return Err(ApiError::BadRequest("原密码错误".to_string()));
    }
    let new_hash = hash(&body.new_password, DEFAULT_COST).map_err(|error| ApiError::BadRequest(error.to_string()))?;
    sqlx::query("update users set password = $1, updated_at = now() where id = $2")
        .bind(new_hash)
        .bind(user_id)
        .execute(&state.db)
        .await?;
    Ok(empty_message("密码修改成功，请重新登录"))
}

async fn logout() -> impl axum::response::IntoResponse {
    empty_message("退出成功")
}

fn validate_phone(phone: &str) -> Result<(), ApiError> {
    let re = regex::Regex::new(r"^1[3-9]\d{9}$").unwrap();
    if re.is_match(phone) { Ok(()) } else { Err(ApiError::BadRequest("手机号格式不正确".to_string())) }
}
```

- [ ] **Step 4: Implement `user_roles.rs`**

Create `server-rust/src/modules/user_roles.rs`:

```rust
use axum::{extract::{Query, State}, routing::{get, post}, Json, Router};
use serde::Deserialize;
use serde_json::json;

use crate::{app::AppState, error::ApiError, response::ok};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/user-roles/my-roles", get(my_roles))
        .route("/api/user-roles/active", get(active))
        .route("/api/user-roles/create", post(create))
        .route("/api/user-roles/switch", post(switch_role))
}

#[derive(Debug, Deserialize)]
struct UserIdQuery {
    #[serde(rename = "userId")]
    user_id: String,
}

#[derive(Debug, Deserialize)]
struct CreateRoleRequest {
    #[serde(rename = "userId")]
    user_id: String,
    role: String,
}

#[derive(Debug, Deserialize)]
struct SwitchRoleRequest {
    #[serde(rename = "userId")]
    user_id: String,
    #[serde(rename = "roleId")]
    role_id: String,
}

async fn my_roles(State(state): State<AppState>, Query(query): Query<UserIdQuery>) -> Result<impl axum::response::IntoResponse, ApiError> {
    let mut roles = role_rows(&state, &query.user_id).await?;
    if roles.is_empty() {
        let user_role: Option<(Option<String>,)> = sqlx::query_as("select role from users where id = $1")
            .bind(&query.user_id)
            .fetch_optional(&state.db)
            .await?;
        let role = user_role.ok_or_else(|| ApiError::NotFound("用户不存在".to_string()))?.0.unwrap_or_default();
        let inserted = insert_role(&state, &query.user_id, &role, true).await?;
        roles.push(inserted);
    }
    Ok(ok("查询成功", roles))
}

async fn active(State(state): State<AppState>, Query(query): Query<UserIdQuery>) -> Result<impl axum::response::IntoResponse, ApiError> {
    let active: Option<serde_json::Value> = sqlx::query_scalar(
        "select row_to_json(user_roles) from user_roles where user_id = $1 and is_active = true and status = 'active' limit 1",
    )
    .bind(&query.user_id)
    .fetch_optional(&state.db)
    .await?;
    match active {
        Some(role) => Ok(ok("查询成功", role)),
        None => {
            let user_role: Option<(Option<String>,)> = sqlx::query_as("select role from users where id = $1")
                .bind(&query.user_id)
                .fetch_optional(&state.db)
                .await?;
            let role = user_role.ok_or_else(|| ApiError::NotFound("用户不存在".to_string()))?.0.unwrap_or_default();
            let role = insert_role(&state, &query.user_id, &role, true).await?;
            Ok(ok("查询成功", role))
        }
    }
}

async fn create(State(state): State<AppState>, Json(body): Json<CreateRoleRequest>) -> Result<impl axum::response::IntoResponse, ApiError> {
    let existing: Option<(String,)> = sqlx::query_as("select id from user_roles where user_id = $1 and role = $2 and status = 'active'")
        .bind(&body.user_id)
        .bind(&body.role)
        .fetch_optional(&state.db)
        .await?;
    if existing.is_some() {
        return Err(ApiError::Conflict("您已经拥有该角色，无需重复创建".to_string()));
    }
    let count: (i64,) = sqlx::query_as("select count(*) from user_roles where user_id = $1 and status = 'active'")
        .bind(&body.user_id)
        .fetch_one(&state.db)
        .await?;
    let role = insert_role(&state, &body.user_id, &body.role, count.0 == 0).await?;
    if count.0 == 0 {
        sqlx::query("update users set role = $1 where id = $2").bind(&body.role).bind(&body.user_id).execute(&state.db).await?;
    }
    Ok(ok("角色创建成功", role))
}

async fn switch_role(State(state): State<AppState>, Json(body): Json<SwitchRoleRequest>) -> Result<impl axum::response::IntoResponse, ApiError> {
    let target: Option<(String,)> = sqlx::query_as("select role from user_roles where id = $1 and user_id = $2 and status = 'active'")
        .bind(&body.role_id)
        .bind(&body.user_id)
        .fetch_optional(&state.db)
        .await?;
    let target_role = target.ok_or_else(|| ApiError::NotFound("角色不存在或已被禁用".to_string()))?.0;
    sqlx::query("update user_roles set is_active = false where user_id = $1 and status = 'active'")
        .bind(&body.user_id)
        .execute(&state.db)
        .await?;
    sqlx::query("update user_roles set is_active = true where id = $1")
        .bind(&body.role_id)
        .execute(&state.db)
        .await?;
    sqlx::query("update users set role = $1 where id = $2")
        .bind(&target_role)
        .bind(&body.user_id)
        .execute(&state.db)
        .await?;
    let user: serde_json::Value = sqlx::query_scalar("select row_to_json(users) from users where id = $1")
        .bind(&body.user_id)
        .fetch_one(&state.db)
        .await?;
    let roles = role_rows(&state, &body.user_id).await?;
    Ok(ok("角色切换成功", json!({
        "id": user["id"],
        "username": user["username"],
        "phone": user["phone"],
        "name": user["name"],
        "role": target_role,
        "avatar_url": user["avatar_url"],
        "wechat_payment_qr": user["wechat_payment_qr"],
        "credit_score": user["credit_score"],
        "created_at": user["created_at"],
        "roles": roles.iter().map(|role| role["role"].clone()).collect::<Vec<_>>(),
        "switchTime": chrono::Utc::now().to_rfc3339(),
    })))
}

async fn role_rows(state: &AppState, user_id: &str) -> Result<Vec<serde_json::Value>, ApiError> {
    Ok(sqlx::query_scalar(
        "select row_to_json(user_roles) from user_roles where user_id = $1 and status = 'active' order by created_at desc",
    )
    .bind(user_id)
    .fetch_all(&state.db)
    .await?)
}

async fn insert_role(state: &AppState, user_id: &str, role: &str, active: bool) -> Result<serde_json::Value, ApiError> {
    Ok(sqlx::query_scalar(
        "insert into user_roles (user_id, role, is_active, status) values ($1, $2, $3, 'active') returning row_to_json(user_roles)",
    )
    .bind(user_id)
    .bind(role)
    .bind(active)
    .fetch_one(&state.db)
    .await?)
}
```

- [ ] **Step 5: Implement `platform.rs`**

Create `server-rust/src/modules/platform.rs`:

```rust
use axum::{extract::State, routing::{get, put}, Json, Router};
use serde::Deserialize;
use serde_json::json;

use crate::{app::AppState, error::ApiError, response::ok};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/platform/settings", get(get_settings).put(update_settings))
        .route("/api/platform/payment-qr", get(payment_qr))
}

#[derive(Debug, Deserialize)]
struct UpdateSettingsRequest {
    #[serde(rename = "commissionRate")]
    commission_rate: Option<rust_decimal::Decimal>,
    #[serde(rename = "commissionPaymentQr")]
    commission_payment_qr: Option<String>,
}

async fn get_settings(State(state): State<AppState>) -> Result<impl axum::response::IntoResponse, ApiError> {
    let settings: Option<serde_json::Value> = sqlx::query_scalar("select row_to_json(platform_settings) from platform_settings where id = 'default'")
        .fetch_optional(&state.db)
        .await?;
    Ok(ok("查询成功", settings))
}

async fn update_settings(State(state): State<AppState>, Json(body): Json<UpdateSettingsRequest>) -> Result<impl axum::response::IntoResponse, ApiError> {
    let existing: Option<(String,)> = sqlx::query_as("select id from platform_settings where id = 'default'")
        .fetch_optional(&state.db)
        .await?;
    if existing.is_none() {
        return Err(ApiError::NotFound("平台配置不存在".to_string()));
    }
    let settings: serde_json::Value = sqlx::query_scalar(
        "update platform_settings set commission_rate = coalesce($1, commission_rate), commission_payment_qr = coalesce($2, commission_payment_qr), updated_at = now() where id = 'default' returning row_to_json(platform_settings)",
    )
    .bind(body.commission_rate)
    .bind(body.commission_payment_qr)
    .fetch_one(&state.db)
    .await?;
    Ok(ok("更新成功", settings))
}

async fn payment_qr(State(state): State<AppState>) -> Result<impl axum::response::IntoResponse, ApiError> {
    let key: Option<(Option<String>,)> = sqlx::query_as("select commission_payment_qr from platform_settings where id = 'default'")
        .fetch_optional(&state.db)
        .await?;
    let key = key.and_then(|row| row.0).ok_or_else(|| ApiError::NotFound("平台收款码未设置".to_string()))?;
    let url = state.storage.public_url(&key).await?;
    Ok(ok("查询成功", json!({ "paymentQr": url })))
}
```

- [ ] **Step 6: Run the phase-1 route smoke test**

Run:

```bash
cd /Users/sunhanchen/Documents/recocar/projects/server-rust
TEST_DATABASE_URL=postgres://postgres:postgres@localhost:55432/recocar_test cargo test account_user_roles_and_platform_routes_are_available
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
cd /Users/sunhanchen/Documents/recocar/projects
git add server-rust/src/modules/account_settings.rs server-rust/src/modules/user_roles.rs server-rust/src/modules/platform.rs server-rust/src/app.rs server-rust/tests/api_foundation.rs
git commit -m "feat: port user settings and platform endpoints"
```

## Task 7: Dockerfile And Root Helper Scripts

**Files:**

- Create: `server-rust/Dockerfile`
- Modify: `package.json`

- [ ] **Step 1: Add Rust helper scripts**

Modify the root `package.json` scripts block to include:

```json
"build:rust-server": "cd server-rust && cargo build --release",
"test:rust-server": "cd server-rust && cargo test"
```

- [ ] **Step 2: Create Rust Dockerfile**

Create `server-rust/Dockerfile`:

```dockerfile
FROM rust:1-bookworm AS builder

WORKDIR /app
COPY Cargo.toml Cargo.lock* ./
COPY migrations ./migrations
COPY src ./src
RUN cargo build --release

FROM debian:bookworm-slim AS runner

WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/recorouter-api /usr/local/bin/recorouter-api
COPY --from=builder /app/migrations ./migrations

ENV SERVER_PORT=34532
EXPOSE 34532

CMD ["recorouter-api"]
```

- [ ] **Step 3: Run formatting, tests, and build**

Run:

```bash
cd /Users/sunhanchen/Documents/recocar/projects/server-rust
cargo fmt
cargo test
cargo build --release
```

Expected: all commands complete with exit code 0.

- [ ] **Step 4: Run frontend validation baseline**

Run:

```bash
cd /Users/sunhanchen/Documents/recocar/projects
pnpm validate
```

Expected: exit code 0, or a clearly unrelated pre-existing frontend lint/type failure documented before continuing.

- [ ] **Step 5: Commit**

Run:

```bash
cd /Users/sunhanchen/Documents/recocar/projects
git add server-rust/Dockerfile package.json server-rust/Cargo.lock
git commit -m "chore: add rust api build wiring"
```

## Self-Review

- Spec coverage: this plan covers the first deployable Rust backend slice and intentionally leaves logistics, rentals, enterprise dispatch, admin, notifications, and deployment for follow-on plans.
- Placeholder scan: the plan avoids open-ended filler language and gives exact file paths, test commands, and implementation snippets for each phase-1 task.
- Type consistency: module paths match `server-rust/src/lib.rs`, app state type is `crate::app::AppState`, and tests call the same routes declared in module routers.
- Risk: the `account-settings/profile` route currently uses the NestJS fallback user ID because the current service does the same. This should be revisited only when the frontend authentication model is changed.
