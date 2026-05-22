use std::{
    collections::HashMap,
    env,
    sync::{Mutex, MutexGuard, OnceLock},
};

use axum::{
    body::{to_bytes, Body},
    http::{Request, Response, StatusCode},
};
use serde_json::Value;
use sqlx::postgres::PgPoolOptions;
use tower::ServiceExt;

const TOUCHED_ENV_KEYS: [&str; 4] = [
    "DATABASE_URL",
    "SERVER_PORT",
    "PUBLIC_BASE_URL",
    "LOCAL_UPLOAD_DIR",
];

struct EnvGuard {
    _lock: MutexGuard<'static, ()>,
    snapshot: HashMap<&'static str, Option<String>>,
}

impl EnvGuard {
    fn new() -> Self {
        let lock = env_lock();
        let snapshot = TOUCHED_ENV_KEYS
            .into_iter()
            .map(|key| (key, env::var(key).ok()))
            .collect();

        Self {
            _lock: lock,
            snapshot,
        }
    }

    fn set(&self, key: &'static str, value: &str) {
        assert!(TOUCHED_ENV_KEYS.contains(&key));
        env::set_var(key, value);
    }

    fn remove(&self, key: &'static str) {
        assert!(TOUCHED_ENV_KEYS.contains(&key));
        env::remove_var(key);
    }
}

impl Drop for EnvGuard {
    fn drop(&mut self) {
        for key in TOUCHED_ENV_KEYS {
            match self.snapshot.get(key).and_then(|value| value.as_ref()) {
                Some(value) => env::set_var(key, value),
                None => env::remove_var(key),
            }
        }
    }
}

fn env_lock() -> MutexGuard<'static, ()> {
    static ENV_LOCK: OnceLock<Mutex<()>> = OnceLock::new();
    ENV_LOCK
        .get_or_init(|| Mutex::new(()))
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
}

fn set_required_env(env: &EnvGuard) {
    env.set(
        "DATABASE_URL",
        "postgres://postgres:postgres@localhost:5432/recocar_test",
    );
    env.set("SERVER_PORT", "34532");
}

fn test_config() -> recorouter_api::config::Config {
    recorouter_api::config::Config {
        database_url: "postgres://postgres:postgres@localhost:5432/recocar_test".to_string(),
        server_port: 34532,
        public_base_url: Some("https://car.shcxyz.site".to_string()),
        local_upload_dir: "uploads".into(),
        cos_secret_id: None,
        cos_secret_key: None,
        cos_bucket: None,
        cos_region: None,
    }
}

fn test_app() -> axum::Router {
    let config = test_config();
    let db = PgPoolOptions::new()
        .connect_lazy(&config.database_url)
        .expect("lazy db pool should be created");
    let storage = recorouter_api::storage::LocalStorage::new(config.local_upload_dir.clone());

    recorouter_api::app::router(config, db, storage)
}

async fn body_json(response: Response<Body>) -> Value {
    let body = to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("response body should read");
    serde_json::from_slice(&body).expect("response body should be json")
}

#[test]
fn config_reads_required_database_url() {
    let env = EnvGuard::new();
    set_required_env(&env);
    env.set("PUBLIC_BASE_URL", "https://car.shcxyz.site");
    env.set("LOCAL_UPLOAD_DIR", "/tmp/recorouter-uploads");

    let config = recorouter_api::config::Config::from_env().expect("config should load");

    assert_eq!(
        config.database_url,
        "postgres://postgres:postgres@localhost:5432/recocar_test"
    );
    assert_eq!(config.server_port, 34532);
    assert_eq!(
        config.public_base_url.as_deref(),
        Some("https://car.shcxyz.site")
    );
    assert_eq!(
        config.local_upload_dir.to_string_lossy(),
        "/tmp/recorouter-uploads"
    );
}

#[test]
fn config_defaults_local_upload_dir_to_relative_uploads() {
    let env = EnvGuard::new();
    set_required_env(&env);
    env.remove("LOCAL_UPLOAD_DIR");

    let config = recorouter_api::config::Config::from_env().expect("config should load");

    assert_eq!(config.local_upload_dir.to_string_lossy(), "uploads");
}

#[test]
fn config_trims_public_base_url_trailing_slash() {
    let env = EnvGuard::new();
    set_required_env(&env);
    env.set("PUBLIC_BASE_URL", "https://car.shcxyz.site/");
    env.set("LOCAL_UPLOAD_DIR", "/tmp/recorouter-uploads");

    let config = recorouter_api::config::Config::from_env().expect("config should load");

    assert_eq!(
        config.public_base_url.as_deref(),
        Some("https://car.shcxyz.site")
    );
}

#[tokio::test]
async fn migrations_create_core_tables_and_default_platform_settings() {
    let Ok(database_url) = env::var("TEST_DATABASE_URL") else {
        eprintln!("skipping migration test because TEST_DATABASE_URL is not set");
        return;
    };

    let admin_database_url = rewrite_database_url(&database_url, "postgres");
    let admin_pool = PgPoolOptions::new()
        .max_connections(1)
        .connect(&admin_database_url)
        .await
        .expect("admin test database should be reachable");
    let test_database = format!("recorouter_test_{}", uuid::Uuid::new_v4().simple());
    let anon_existed: bool =
        sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')")
            .fetch_one(&admin_pool)
            .await
            .expect("anon role existence query should run");
    let service_role_existed: bool =
        sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role')")
            .fetch_one(&admin_pool)
            .await
            .expect("service_role existence query should run");

    sqlx::query(&format!(r#"CREATE DATABASE "{test_database}""#))
        .execute(&admin_pool)
        .await
        .expect("disposable test database should be created");
    let test_database_url = rewrite_database_url(&database_url, &test_database);
    let pool = PgPoolOptions::new()
        .max_connections(1)
        .connect(&test_database_url)
        .await
        .expect("disposable test database should be reachable");

    recorouter_api::db::run_migrations(&pool).await.unwrap();

    let users_table_exists: bool = sqlx::query_scalar(
        r#"
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name = 'users'
        )
        "#,
    )
    .fetch_one(&pool)
    .await
    .expect("users table existence query should run");

    assert!(users_table_exists);

    let platform_settings_count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM platform_settings WHERE id = 'default'")
            .fetch_one(&pool)
            .await
            .expect("platform_settings default row query should run");

    assert_eq!(platform_settings_count, 1);

    pool.close().await;
    sqlx::query(&format!(
        r#"
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE datname = '{test_database}'
          AND pid <> pg_backend_pid()
        "#
    ))
    .execute(&admin_pool)
    .await
    .expect("test database connections should terminate");
    sqlx::query(&format!(r#"DROP DATABASE "{test_database}""#))
        .execute(&admin_pool)
        .await
        .expect("disposable test database should be dropped");
    if !anon_existed {
        let _ = sqlx::query("DROP ROLE IF EXISTS anon")
            .execute(&admin_pool)
            .await;
    }
    if !service_role_existed {
        let _ = sqlx::query("DROP ROLE IF EXISTS service_role")
            .execute(&admin_pool)
            .await;
    }
}

fn rewrite_database_url(database_url: &str, database: &str) -> String {
    let (without_query, query) = match database_url.split_once('?') {
        Some((base, query)) => (base, Some(query)),
        None => (database_url, None),
    };
    let slash = without_query
        .rfind('/')
        .expect("TEST_DATABASE_URL must include a database name");
    match query {
        Some(query) => format!("{}/{}?{}", &without_query[..slash], database, query),
        None => format!("{}/{}", &without_query[..slash], database),
    }
}

#[tokio::test]
async fn health_route_matches_existing_shape() {
    let response = test_app()
        .oneshot(
            Request::builder()
                .uri("/api/health")
                .body(Body::empty())
                .expect("request should build"),
        )
        .await
        .expect("request should complete");

    assert_eq!(response.status(), StatusCode::OK);

    let json = body_json(response).await;
    assert_eq!(json["status"], "success");
    assert!(
        json["data"]
            .as_str()
            .is_some_and(|value| value.contains('T')),
        "expected ISO-ish timestamp containing T, got {json}"
    );
}

#[tokio::test]
async fn hello_route_matches_existing_shape() {
    let response = test_app()
        .oneshot(
            Request::builder()
                .uri("/api/hello")
                .body(Body::empty())
                .expect("request should build"),
        )
        .await
        .expect("request should complete");

    assert_eq!(response.status(), StatusCode::OK);

    let json = body_json(response).await;
    assert_eq!(json["status"], "success");
    assert_eq!(
        json["data"],
        "Hello, welcome to coze coding mini-program server!"
    );
}
