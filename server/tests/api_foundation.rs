use std::{
    collections::HashMap,
    env, iter,
    sync::{Mutex, MutexGuard, OnceLock},
};

use axum::{
    body::{to_bytes, Body},
    http::{Request, Response, StatusCode},
    Router,
};
use serde_json::Value;
use sqlx::{postgres::PgPoolOptions, PgPool};
use tower::ServiceExt;

use recorouter_api::storage::{LocalStorage, Storage};

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
    let upload_dir = tempfile::tempdir()
        .expect("temp upload dir should be created")
        .keep();

    recorouter_api::config::Config {
        database_url: "postgres://postgres:postgres@localhost:5432/recocar_test".to_string(),
        server_port: 34532,
        public_base_url: Some("https://car.shcxyz.site".to_string()),
        local_upload_dir: upload_dir,
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
    let storage = recorouter_api::storage::LocalStorage::new(
        config.local_upload_dir.clone(),
        config.public_base_url.clone(),
    );

    recorouter_api::app::router(config, db, storage)
}

struct AuthTestContext {
    app: Router,
    storage: LocalStorage,
    pool: PgPool,
    admin_pool: PgPool,
    database_name: String,
    anon_role_existed: bool,
    service_role_existed: bool,
    _upload_dir: tempfile::TempDir,
}

impl AuthTestContext {
    async fn cleanup(self) {
        let Self {
            app,
            storage: _,
            pool,
            admin_pool,
            database_name,
            anon_role_existed,
            service_role_existed,
            _upload_dir,
        } = self;

        drop(app);
        pool.close().await;

        sqlx::query(
            r#"
            SELECT pg_terminate_backend(pid)
            FROM pg_stat_activity
            WHERE datname = $1
              AND pid <> pg_backend_pid()
            "#,
        )
        .bind(&database_name)
        .execute(&admin_pool)
        .await
        .expect("test database connections should terminate");

        sqlx::query(&format!(r#"DROP DATABASE "{database_name}""#))
            .execute(&admin_pool)
            .await
            .expect("disposable auth test database should be dropped");

        if !anon_role_existed {
            let _ = sqlx::query("DROP ROLE IF EXISTS anon")
                .execute(&admin_pool)
                .await;
        }
        if !service_role_existed {
            let _ = sqlx::query("DROP ROLE IF EXISTS service_role")
                .execute(&admin_pool)
                .await;
        }

        admin_pool.close().await;
    }
}

async fn auth_test_context() -> Option<AuthTestContext> {
    let Ok(database_url) = env::var("TEST_DATABASE_URL") else {
        eprintln!("skipping auth DB-backed test because TEST_DATABASE_URL is not set");
        return None;
    };

    let admin_database_url = rewrite_database_url(&database_url, "postgres");
    let admin_pool = PgPoolOptions::new()
        .max_connections(1)
        .connect(&admin_database_url)
        .await
        .expect("admin test database should be reachable");
    let anon_role_existed: bool =
        sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')")
            .fetch_one(&admin_pool)
            .await
            .expect("anon role existence query should run");
    let service_role_existed: bool =
        sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role')")
            .fetch_one(&admin_pool)
            .await
            .expect("service_role existence query should run");

    let database_name = format!("recorouter_auth_test_{}", uuid::Uuid::new_v4().simple());
    sqlx::query(&format!(r#"CREATE DATABASE "{database_name}""#))
        .execute(&admin_pool)
        .await
        .expect("disposable auth test database should be created");

    let database_url = rewrite_database_url(&database_url, &database_name);
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await
        .expect("disposable auth test database should be reachable");

    recorouter_api::db::run_migrations(&pool)
        .await
        .expect("auth test migrations should run");

    let upload_dir = tempfile::tempdir().expect("temp upload dir should be created");
    let config = recorouter_api::config::Config {
        database_url,
        server_port: 34532,
        public_base_url: Some("https://car.shcxyz.site".to_string()),
        local_upload_dir: upload_dir.path().to_path_buf(),
        cos_secret_id: None,
        cos_secret_key: None,
        cos_bucket: None,
        cos_region: None,
    };
    let storage = LocalStorage::new(
        config.local_upload_dir.clone(),
        config.public_base_url.clone(),
    );
    let app = recorouter_api::app::router(config, pool.clone(), storage.clone());

    Some(AuthTestContext {
        app,
        storage,
        pool,
        admin_pool,
        database_name,
        anon_role_existed,
        service_role_existed,
        _upload_dir: upload_dir,
    })
}

fn multipart_body(boundary: &str, filename: &str, content_type: &str, content: &[u8]) -> Vec<u8> {
    multipart_body_with_field(boundary, "file", filename, content_type, content)
}

fn multipart_body_with_field(
    boundary: &str,
    field_name: &str,
    filename: &str,
    content_type: &str,
    content: &[u8],
) -> Vec<u8> {
    let mut body = Vec::new();
    body.extend_from_slice(format!("--{boundary}\r\n").as_bytes());
    body.extend_from_slice(
        format!(
            "Content-Disposition: form-data; name=\"{field_name}\"; filename=\"{filename}\"\r\n"
        )
        .as_bytes(),
    );
    body.extend_from_slice(format!("Content-Type: {content_type}\r\n\r\n").as_bytes());
    body.extend_from_slice(content);
    body.extend_from_slice(format!("\r\n--{boundary}--\r\n").as_bytes());
    body
}

fn payment_qr_multipart_body(
    boundary: &str,
    user_id: &str,
    filename: Option<&str>,
    content_type: Option<&str>,
    content: Option<&[u8]>,
) -> Vec<u8> {
    let mut body = Vec::new();
    body.extend_from_slice(format!("--{boundary}\r\n").as_bytes());
    body.extend_from_slice(b"Content-Disposition: form-data; name=\"userId\"\r\n\r\n");
    body.extend_from_slice(user_id.as_bytes());
    body.extend_from_slice(b"\r\n");

    if let (Some(filename), Some(content_type), Some(content)) = (filename, content_type, content) {
        body.extend_from_slice(format!("--{boundary}\r\n").as_bytes());
        body.extend_from_slice(
            format!("Content-Disposition: form-data; name=\"file\"; filename=\"{filename}\"\r\n")
                .as_bytes(),
        );
        body.extend_from_slice(format!("Content-Type: {content_type}\r\n\r\n").as_bytes());
        body.extend_from_slice(content);
        body.extend_from_slice(b"\r\n");
    }

    body.extend_from_slice(format!("--{boundary}--\r\n").as_bytes());
    body
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

#[tokio::test]
async fn enterprise_dispatch_legacy_migration_backfills_contract_data() {
    let Ok(database_url) = env::var("TEST_DATABASE_URL") else {
        eprintln!(
            "skipping enterprise migration backfill test because TEST_DATABASE_URL is not set"
        );
        return;
    };

    let admin_database_url = rewrite_database_url(&database_url, "postgres");
    let admin_pool = PgPoolOptions::new()
        .max_connections(1)
        .connect(&admin_database_url)
        .await
        .expect("admin test database should be reachable");
    let test_database = format!(
        "recorouter_migration_test_{}",
        uuid::Uuid::new_v4().simple()
    );
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
        .expect("disposable migration test database should be created");
    let test_database_url = rewrite_database_url(&database_url, &test_database);
    let pool = PgPoolOptions::new()
        .max_connections(1)
        .connect(&test_database_url)
        .await
        .expect("disposable migration test database should be reachable");

    recorouter_api::db::run_migrations(&pool)
        .await
        .expect("migrations should run");

    let admin_id: String = sqlx::query_scalar(
        r#"
        INSERT INTO users (phone, password, role, name, username, status)
        VALUES ('13900000999', 'hashed-secret', 'merchant', '迁移测试管理员', '迁移测试管理员', 'active')
        RETURNING id
        "#,
    )
    .fetch_one(&pool)
    .await
    .expect("admin user should insert");

    sqlx::query(
        "INSERT INTO enterprises (id, name, type, admin_id, status) VALUES ('legacy-enterprise', '旧企业', 'logistics', $1, 'active')",
    )
    .bind(&admin_id)
    .execute(&pool)
    .await
    .expect("enterprise should insert");

    sqlx::query(
        r#"
        INSERT INTO enterprise_demands (
            id, enterprise_id, vehicle_source, vehicle_allocation, status, created_at
        )
        VALUES (
            'legacy-own-demand',
            'legacy-enterprise',
            'own',
            $1::jsonb,
            'in_transit',
            '2026-05-24T00:00:00Z'
        )
        "#,
    )
    .bind(serde_json::json!({
        "vehicle_ids": ["kept-v1"],
        "ownVehicleIds": ["own-v1", "kept-v1"],
        "externalVehicleIds": ["external-v1"]
    }))
    .execute(&pool)
    .await
    .expect("legacy own enterprise demand should insert");

    sqlx::query(
        r#"
        INSERT INTO enterprise_demands (
            id, enterprise_id, vehicle_source, status, created_at
        )
        VALUES (
            'legacy-external-demand',
            'legacy-enterprise',
            'external',
            'pending',
            '2026-05-24T01:00:00Z'
        )
        "#,
    )
    .execute(&pool)
    .await
    .expect("legacy external enterprise demand should insert");

    sqlx::query(
        r#"
        INSERT INTO demands (id, merchant_id, remarks, status, created_at)
        VALUES ('legacy-public-demand', $1, '企业外部需求', 'pending', '2026-05-24T01:00:05Z')
        "#,
    )
    .bind(&admin_id)
    .execute(&pool)
    .await
    .expect("legacy public demand should insert");

    sqlx::raw_sql(include_str!(
        "../migrations/0003_enterprise_legacy_dispatch_contract.sql"
    ))
    .execute(&pool)
    .await
    .expect("legacy enterprise migration should rerun safely");

    let normalized_source: String = sqlx::query_scalar(
        "SELECT vehicle_source FROM enterprise_demands WHERE id = 'legacy-own-demand'",
    )
    .fetch_one(&pool)
    .await
    .expect("normalized source should load");
    assert_eq!(normalized_source, "internal");

    let allocation: Value = sqlx::query_scalar(
        "SELECT vehicle_allocation FROM enterprise_demands WHERE id = 'legacy-own-demand'",
    )
    .fetch_one(&pool)
    .await
    .expect("normalized allocation should load");
    let mut vehicle_ids = allocation["vehicle_ids"]
        .as_array()
        .expect("vehicle_ids should be array")
        .iter()
        .map(|value| value.as_str().unwrap().to_string())
        .collect::<Vec<_>>();
    vehicle_ids.sort();
    assert_eq!(vehicle_ids, vec!["external-v1", "kept-v1", "own-v1"]);
    assert!(allocation.get("ownVehicleIds").is_none());
    assert!(allocation.get("externalVehicleIds").is_none());

    let linked_external_demand_id: Option<String> = sqlx::query_scalar(
        "SELECT external_demand_id FROM enterprise_demands WHERE id = 'legacy-external-demand'",
    )
    .fetch_one(&pool)
    .await
    .expect("linked external demand id should load");
    assert_eq!(
        linked_external_demand_id,
        Some("legacy-public-demand".to_string())
    );

    for index_name in [
        "enterprise_demands_external_demand_id_idx",
        "enterprise_demands_status_idx",
        "vehicles_enterprise_dispatch_idx",
        "dairy_stations_enterprise_id_idx",
        "dairy_stations_point_type_idx",
    ] {
        let exists: bool = sqlx::query_scalar("SELECT to_regclass($1) IS NOT NULL")
            .bind(format!("public.{index_name}"))
            .fetch_one(&pool)
            .await
            .expect("index existence query should run");
        assert!(exists, "expected index {index_name} to exist");
    }

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
        .expect("disposable migration test database should be dropped");
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
async fn home_upload_rejects_non_image_files() {
    let boundary = "recocar-test-boundary";
    let response = test_app()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/home/upload")
                .header(
                    "content-type",
                    format!("multipart/form-data; boundary={boundary}"),
                )
                .body(Body::from(multipart_body(
                    boundary,
                    "bad.txt",
                    "text/plain",
                    b"not an image",
                )))
                .expect("request should build"),
        )
        .await
        .expect("request should complete");

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);

    let json = body_json(response).await;
    assert_eq!(json["message"], "不支持的文件类型，请上传图片文件");
}

#[tokio::test]
async fn home_upload_stores_image_and_returns_key_and_url() {
    let config = test_config();
    let db = PgPoolOptions::new()
        .connect_lazy(&config.database_url)
        .expect("lazy db pool should be created");
    let storage = recorouter_api::storage::LocalStorage::new(
        config.local_upload_dir.clone(),
        config.public_base_url.clone(),
    );
    let app = recorouter_api::app::router(config, db, storage.clone());
    let boundary = "recocar-test-boundary";

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/home/upload")
                .header(
                    "content-type",
                    format!("multipart/form-data; boundary={boundary}"),
                )
                .body(Body::from(multipart_body(
                    boundary,
                    "photo.png",
                    "image/png",
                    b"\x89PNG\r\n\x1a\n",
                )))
                .expect("request should build"),
        )
        .await
        .expect("request should complete");

    assert_eq!(response.status(), StatusCode::OK);

    let json = body_json(response).await;
    assert_eq!(json["code"], 200);
    assert_eq!(json["message"], "上传成功");

    let file_key = json["data"]["fileKey"]
        .as_str()
        .expect("file key should be a string");
    let file_key_pattern =
        regex::Regex::new(r"^cargo-photos/\d{13}-[A-Za-z0-9]{8}_[0-9a-f]{8}\.png$")
            .expect("file key pattern should compile");
    assert!(
        file_key_pattern.is_match(file_key),
        "expected storage-generated random suffix in file key, got {file_key}"
    );
    assert_eq!(
        json["data"]["url"],
        format!("https://car.shcxyz.site/api/uploads/{file_key}")
    );
    assert!(storage
        .exists(file_key)
        .await
        .expect("stored upload existence should be checked"));

    let served_response = app
        .oneshot(
            Request::builder()
                .uri(format!("/api/uploads/{file_key}"))
                .body(Body::empty())
                .expect("static upload request should build"),
        )
        .await
        .expect("static upload request should complete");

    assert_eq!(served_response.status(), StatusCode::OK);
    let served_bytes = to_bytes(served_response.into_body(), usize::MAX)
        .await
        .expect("served upload body should read");
    assert_eq!(&served_bytes[..], b"\x89PNG\r\n\x1a\n");
}

#[tokio::test]
async fn storage_factory_prefers_tencent_cos_when_configured() {
    let mut config = test_config();
    config.cos_secret_id = Some("AKIDEXAMPLE".to_string());
    config.cos_secret_key = Some("SECRETEXAMPLE".to_string());
    config.cos_bucket = Some("examplebucket-1250000000".to_string());
    config.cos_region = Some("ap-guangzhou".to_string());

    let storage = recorouter_api::storage::from_config(&config);
    let url = storage
        .public_url("payment_qr/demo.png")
        .await
        .expect("cos public url should be generated");

    assert!(
        url.starts_with(
            "https://examplebucket-1250000000.cos.ap-guangzhou.myqcloud.com/payment_qr/demo.png?q-sign-algorithm=sha1&q-ak=AKIDEXAMPLE&q-sign-time="
        ),
        "expected COS signed URL, got {url}"
    );
    assert!(url.contains("&q-key-time="));
    assert!(url.contains("&q-header-list=host&q-url-param-list=&q-signature="));
}

#[tokio::test]
async fn home_upload_rejects_oversized_image_files() {
    let boundary = "recocar-test-boundary";
    let oversized_image: Vec<u8> = iter::repeat(b'a').take(10 * 1024 * 1024 + 1).collect();
    let response = test_app()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/home/upload")
                .header(
                    "content-type",
                    format!("multipart/form-data; boundary={boundary}"),
                )
                .body(Body::from(multipart_body(
                    boundary,
                    "large.png",
                    "image/png",
                    &oversized_image,
                )))
                .expect("request should build"),
        )
        .await
        .expect("request should complete");

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);

    let json = body_json(response).await;
    assert_eq!(json["message"], "文件大小不能超过5MB");
}

#[tokio::test]
async fn home_upload_rejects_large_ignored_multipart_fields() {
    let boundary = "recocar-test-boundary";
    let large_metadata: Vec<u8> = iter::repeat(b'a').take(6 * 1024 * 1024 + 1).collect();
    let response = test_app()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/home/upload")
                .header(
                    "content-type",
                    format!("multipart/form-data; boundary={boundary}"),
                )
                .body(Body::from(multipart_body_with_field(
                    boundary,
                    "metadata",
                    "metadata.txt",
                    "text/plain",
                    &large_metadata,
                )))
                .expect("request should build"),
        )
        .await
        .expect("request should complete");

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);

    let json = body_json(response).await;
    assert_eq!(json["message"], "请求体过大");
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

async fn register_auth_user(
    app: &Router,
    phone: &str,
    role: &str,
    name: &str,
) -> (StatusCode, Value) {
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/auth/register")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::json!({
                        "phone": phone,
                        "password": "secret123",
                        "name": name,
                        "role": role
                    })
                    .to_string(),
                ))
                .expect("register request should build"),
        )
        .await
        .expect("register request should complete");
    let status = response.status();
    let body = body_json(response).await;

    (status, body)
}

async fn post_json(app: &Router, uri: &str, body: Value) -> (StatusCode, Value) {
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(uri)
                .header("content-type", "application/json")
                .body(Body::from(body.to_string()))
                .expect("json request should build"),
        )
        .await
        .expect("json request should complete");
    let status = response.status();
    let body = optional_body_json(response).await;

    (status, body)
}

async fn put_json(app: &Router, uri: &str, body: Value) -> (StatusCode, Value) {
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("PUT")
                .uri(uri)
                .header("content-type", "application/json")
                .body(Body::from(body.to_string()))
                .expect("json request should build"),
        )
        .await
        .expect("json request should complete");
    let status = response.status();
    let body = optional_body_json(response).await;

    (status, body)
}

async fn delete_json(app: &Router, uri: &str) -> (StatusCode, Value) {
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri(uri)
                .body(Body::empty())
                .expect("delete request should build"),
        )
        .await
        .expect("delete request should complete");
    let status = response.status();
    let body = optional_body_json(response).await;

    (status, body)
}

async fn get_json(app: &Router, uri: &str) -> (StatusCode, Value) {
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri(uri)
                .body(Body::empty())
                .expect("get request should build"),
        )
        .await
        .expect("get request should complete");
    let status = response.status();
    let body = optional_body_json(response).await;

    (status, body)
}

async fn optional_body_json(response: Response<Body>) -> Value {
    let body = to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("response body should read");

    if body.is_empty() {
        Value::Null
    } else {
        serde_json::from_slice(&body).expect("response body should be json")
    }
}

#[tokio::test]
async fn address_books_default_toggling_and_missing_user_id_code_400_body() {
    let Some(context) = auth_test_context().await else {
        return;
    };
    let (_, register_body) =
        register_auth_user(&context.app, "13900000107", "merchant", "地址簿用户").await;
    let user_id = register_body["data"]["id"]
        .as_str()
        .expect("registered user id should be a string");

    let (missing_status, missing_body) = get_json(&context.app, "/api/address-books").await;
    assert_eq!(missing_status, StatusCode::OK);
    assert_eq!(missing_body["code"], 400);
    assert_eq!(missing_body["message"], "用户ID不能为空");
    assert_eq!(missing_body["data"], Value::Null);

    let (home_status, home_body) = post_json(
        &context.app,
        "/api/address-books",
        serde_json::json!({
            "user_id": user_id,
            "address_name": "家",
            "address": "上海市黄浦区中山东一路1号",
            "latitude": 31.2397,
            "longitude": 121.4998,
            "address_type": "home",
            "is_default": true
        }),
    )
    .await;
    assert_eq!(home_status, StatusCode::OK);
    assert_eq!(home_body["message"], "地址创建成功");
    assert_eq!(home_body["data"]["is_default"], true);
    let home_id = home_body["data"]["id"]
        .as_str()
        .expect("created home address id should be a string");

    let (work_status, work_body) = post_json(
        &context.app,
        "/api/address-books",
        serde_json::json!({
            "user_id": user_id,
            "address_name": "公司",
            "address": "上海市浦东新区世纪大道100号",
            "latitude": 31.2304,
            "longitude": 121.4737,
            "address_type": "work",
            "is_default": true
        }),
    )
    .await;
    assert_eq!(work_status, StatusCode::OK);
    assert_eq!(work_body["message"], "地址创建成功");
    let work_id = work_body["data"]["id"]
        .as_str()
        .expect("created work address id should be a string");

    let (list_status, list_body) = get_json(
        &context.app,
        &format!("/api/address-books?user_id={user_id}"),
    )
    .await;
    assert_eq!(list_status, StatusCode::OK);
    assert_eq!(list_body["message"], "查询成功");
    let addresses = list_body["data"]
        .as_array()
        .expect("addresses should be an array");
    assert_eq!(addresses.len(), 2);
    assert_eq!(addresses[0]["id"], work_id);
    assert_eq!(addresses[0]["is_default"], true);
    assert_eq!(addresses[1]["id"], home_id);
    assert_eq!(addresses[1]["is_default"], false);

    let (set_default_status, set_default_body) = post_json(
        &context.app,
        &format!("/api/address-books/{home_id}/set-default"),
        serde_json::json!({}),
    )
    .await;
    assert_eq!(set_default_status, StatusCode::OK);
    assert_eq!(set_default_body["message"], "设置默认地址成功");
    assert_eq!(set_default_body["data"]["id"], home_id);
    assert_eq!(set_default_body["data"]["is_default"], true);
    assert_eq!(
        set_default_body["data"]["updated_at"],
        home_body["data"]["updated_at"]
    );

    let (relisted_status, relisted_body) = get_json(
        &context.app,
        &format!("/api/address-books?user_id={user_id}"),
    )
    .await;
    assert_eq!(relisted_status, StatusCode::OK);
    let relisted = relisted_body["data"]
        .as_array()
        .expect("relisted addresses should be an array");
    assert_eq!(relisted[0]["id"], home_id);
    assert_eq!(relisted[0]["is_default"], true);
    assert_eq!(relisted[1]["id"], work_id);
    assert_eq!(relisted[1]["is_default"], false);

    context.cleanup().await;
}

#[tokio::test]
async fn favorite_routes_create_list_enrich_and_increment_use_count() {
    let Some(context) = auth_test_context().await else {
        return;
    };
    let (_, register_body) =
        register_auth_user(&context.app, "13900000108", "merchant", "常用线路用户").await;
    let user_id = register_body["data"]["id"]
        .as_str()
        .expect("registered user id should be a string");

    let pickup_id: String = sqlx::query_scalar(
        r#"
        INSERT INTO address_books (
            user_id, address_name, address, latitude, longitude, address_type
        )
        VALUES ($1, '取货仓', '苏州市工业园区金鸡湖大道1号', 31.2989, 120.5853, 'other')
        RETURNING id
        "#,
    )
    .bind(user_id)
    .fetch_one(&context.pool)
    .await
    .expect("pickup address should be inserted");

    let delivery_id: String = sqlx::query_scalar(
        r#"
        INSERT INTO address_books (
            user_id, address_name, address, latitude, longitude, address_type
        )
        VALUES ($1, '收货点', '杭州市上城区解放东路18号', 30.2741, 120.1551, 'work')
        RETURNING id
        "#,
    )
    .bind(user_id)
    .fetch_one(&context.pool)
    .await
    .expect("delivery address should be inserted");

    let (create_status, create_body) = post_json(
        &context.app,
        "/api/favorite-routes",
        serde_json::json!({
            "user_id": user_id,
            "route_name": "苏州到杭州",
            "pickup_address_id": pickup_id,
            "delivery_address_id": delivery_id,
            "pickup_address": "不应持久化的取货地址",
            "delivery_address": "不应持久化的收货地址",
            "estimated_distance": 168.5,
            "estimated_fare": 860.0
        }),
    )
    .await;
    assert_eq!(create_status, StatusCode::OK);
    assert_eq!(create_body["message"], "线路创建成功");
    assert_eq!(create_body["data"]["route_name"], "苏州到杭州");
    assert_eq!(create_body["data"]["use_count"], 0);
    assert_eq!(create_body["data"]["pickup_address"]["id"], pickup_id);
    assert_eq!(
        create_body["data"]["pickup_address"]["address_name"],
        "取货仓"
    );
    assert_eq!(create_body["data"]["delivery_address"]["id"], delivery_id);
    assert_eq!(
        create_body["data"]["delivery_address"]["address_name"],
        "收货点"
    );
    let route_id = create_body["data"]["id"]
        .as_str()
        .expect("created favorite route id should be a string");

    let (missing_status, missing_body) = get_json(&context.app, "/api/favorite-routes").await;
    assert_eq!(missing_status, StatusCode::OK);
    assert_eq!(missing_body["code"], 400);
    assert_eq!(missing_body["message"], "用户ID不能为空");
    assert_eq!(missing_body["data"], Value::Null);

    let (list_status, list_body) = get_json(
        &context.app,
        &format!("/api/favorite-routes?user_id={user_id}"),
    )
    .await;
    assert_eq!(list_status, StatusCode::OK);
    assert_eq!(list_body["message"], "查询成功");
    let routes = list_body["data"]
        .as_array()
        .expect("favorite routes should be an array");
    assert_eq!(routes.len(), 1);
    assert_eq!(routes[0]["id"], route_id);
    assert_eq!(
        routes[0]["pickup_address"]["address"],
        "苏州市工业园区金鸡湖大道1号"
    );
    assert_eq!(
        routes[0]["delivery_address"]["address"],
        "杭州市上城区解放东路18号"
    );
    assert_eq!(routes[0]["estimated_distance"], 168.5);

    let (update_status, update_body) = put_json(
        &context.app,
        &format!("/api/favorite-routes/{route_id}"),
        serde_json::json!({
            "estimated_distance": null,
            "estimated_fare": null
        }),
    )
    .await;
    assert_eq!(update_status, StatusCode::OK);
    assert_eq!(update_body["message"], "线路更新成功");
    assert_eq!(update_body["data"]["estimated_distance"], Value::Null);
    assert_eq!(update_body["data"]["estimated_fare"], Value::Null);

    let (increment_status, increment_body) = post_json(
        &context.app,
        &format!("/api/favorite-routes/{route_id}/increment-use-count"),
        serde_json::json!({}),
    )
    .await;
    assert_eq!(increment_status, StatusCode::OK);
    assert_eq!(increment_body["message"], "更新成功");
    assert_eq!(increment_body["data"]["id"], route_id);
    assert_eq!(increment_body["data"]["use_count"], 1);
    assert_eq!(increment_body["data"]["pickup_address"]["id"], pickup_id);
    assert_eq!(
        increment_body["data"]["delivery_address"]["id"],
        delivery_id
    );

    context.cleanup().await;
}

#[tokio::test]
async fn demand_templates_default_rename_and_delete_linked_schedules() {
    let Some(context) = auth_test_context().await else {
        return;
    };
    let (_, register_body) =
        register_auth_user(&context.app, "13900000109", "merchant", "需求模板用户").await;
    let user_id = register_body["data"]["id"]
        .as_str()
        .expect("registered user id should be a string");

    let (missing_status, missing_body) = get_json(&context.app, "/api/demand-templates").await;
    assert_eq!(missing_status, StatusCode::OK);
    assert_eq!(missing_body["code"], 400);
    assert_eq!(missing_body["message"], "用户ID不能为空");
    assert_eq!(missing_body["data"], Value::Null);

    let first_template = serde_json::json!({
        "user_id": user_id,
        "template_name": "常用模板A",
        "cargo_name": "冷链水果",
        "cargo_type": "fresh",
        "weight": 2.5,
        "volume": 8.0,
        "pickup_address": "上海市浦东新区民生路1号",
        "pickup_lat": 31.2304,
        "pickup_lng": 121.4737,
        "delivery_address": "杭州市上城区解放东路18号",
        "delivery_lat": 30.2741,
        "delivery_lng": 120.1551,
        "remarks": "轻拿轻放",
        "estimated_distance": 180.5,
        "estimated_fare": 920.0,
        "is_default": true
    });
    let (first_status, first_body) =
        post_json(&context.app, "/api/demand-templates", first_template).await;
    assert_eq!(first_status, StatusCode::OK);
    assert_eq!(first_body["message"], "模板创建成功");
    assert_eq!(first_body["data"]["is_default"], true);
    assert_eq!(first_body["data"]["use_count"], 0);
    let first_id = first_body["data"]["id"]
        .as_str()
        .expect("first template id should be a string");

    let second_template = serde_json::json!({
        "user_id": user_id,
        "template_name": "常用模板B",
        "cargo_name": "普通货物",
        "cargo_type": "normal",
        "weight": 5.0,
        "volume": 12.0,
        "pickup_address": "苏州市工业园区金鸡湖大道1号",
        "pickup_lat": 31.2989,
        "pickup_lng": 120.5853,
        "delivery_address": "南京市玄武区中山东路1号",
        "delivery_lat": 32.0603,
        "delivery_lng": 118.7969,
        "is_default": true
    });
    let (second_status, second_body) =
        post_json(&context.app, "/api/demand-templates", second_template).await;
    assert_eq!(second_status, StatusCode::OK);
    assert_eq!(second_body["message"], "模板创建成功");
    let second_id = second_body["data"]["id"]
        .as_str()
        .expect("second template id should be a string");

    let (list_status, list_body) = get_json(
        &context.app,
        &format!("/api/demand-templates?user_id={user_id}"),
    )
    .await;
    assert_eq!(list_status, StatusCode::OK);
    assert_eq!(list_body["message"], "查询成功");
    let templates = list_body["data"]
        .as_array()
        .expect("templates should be an array");
    assert_eq!(templates.len(), 2);
    assert_eq!(templates[0]["id"], second_id);
    assert_eq!(templates[0]["is_default"], true);
    assert_eq!(templates[1]["id"], first_id);
    assert_eq!(templates[1]["is_default"], false);

    let (set_default_status, set_default_body) = post_json(
        &context.app,
        &format!("/api/demand-templates/{first_id}/set-default"),
        serde_json::json!({}),
    )
    .await;
    assert_eq!(set_default_status, StatusCode::OK);
    assert_eq!(set_default_body["message"], "设置成功");
    assert_eq!(set_default_body["data"]["id"], first_id);
    assert_eq!(set_default_body["data"]["is_default"], true);

    let exact_schedule_id: String = sqlx::query_scalar(
        r#"
        INSERT INTO demand_schedules (
            user_id, template_id, schedule_name, schedule_type,
            base_date, base_time, status, next_publish_time
        )
        VALUES ($1, $2, '常用模板A', 'day', '2099-01-01', '08:00:00', 'active', '2099-01-01 08:00:00+00')
        RETURNING id
        "#,
    )
    .bind(user_id)
    .bind(first_id)
    .fetch_one(&context.pool)
    .await
    .expect("linked schedule using template name should be inserted");
    let custom_schedule_id: String = sqlx::query_scalar(
        r#"
        INSERT INTO demand_schedules (
            user_id, template_id, schedule_name, schedule_type,
            base_date, base_time, status, next_publish_time
        )
        VALUES ($1, $2, '自定义计划名', 'day', '2099-01-01', '09:00:00', 'paused', '2099-01-01 09:00:00+00')
        RETURNING id
        "#,
    )
    .bind(user_id)
    .bind(first_id)
    .fetch_one(&context.pool)
    .await
    .expect("linked schedule using custom name should be inserted");

    let (update_status, update_body) = put_json(
        &context.app,
        &format!("/api/demand-templates/{first_id}"),
        serde_json::json!({
            "template_name": "常用模板A新"
        }),
    )
    .await;
    assert_eq!(update_status, StatusCode::OK);
    assert_eq!(update_body["message"], "模板更新成功");
    assert_eq!(update_body["data"]["template_name"], "常用模板A新");

    let renamed_schedule_name: String =
        sqlx::query_scalar("SELECT schedule_name FROM demand_schedules WHERE id = $1")
            .bind(&exact_schedule_id)
            .fetch_one(&context.pool)
            .await
            .expect("renamed linked schedule should be readable");
    assert_eq!(renamed_schedule_name, "常用模板A新");
    let custom_schedule_name: String =
        sqlx::query_scalar("SELECT schedule_name FROM demand_schedules WHERE id = $1")
            .bind(&custom_schedule_id)
            .fetch_one(&context.pool)
            .await
            .expect("custom linked schedule should be readable");
    assert_eq!(custom_schedule_name, "自定义计划名");

    let (delete_status, delete_body) =
        delete_json(&context.app, &format!("/api/demand-templates/{first_id}")).await;
    assert_eq!(delete_status, StatusCode::OK);
    assert_eq!(
        delete_body["message"],
        "模板删除成功，同时删除了 2 个定时计划"
    );
    assert_eq!(delete_body["data"], Value::Null);

    let remaining_schedules: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM demand_schedules WHERE template_id = $1")
            .bind(first_id)
            .fetch_one(&context.pool)
            .await
            .expect("remaining linked schedule count should be readable");
    assert_eq!(remaining_schedules, 0);

    context.cleanup().await;
}

#[tokio::test]
async fn demand_schedules_create_list_pause_delete_guard_publish_now_and_logs() {
    let Some(context) = auth_test_context().await else {
        return;
    };
    let (_, register_body) =
        register_auth_user(&context.app, "13900000110", "merchant", "定时计划用户").await;
    let user_id = register_body["data"]["id"]
        .as_str()
        .expect("registered user id should be a string");

    let template_id: String = sqlx::query_scalar(
        r#"
        INSERT INTO demand_templates (
            user_id, template_name, cargo_name, cargo_type, weight, volume,
            pickup_address, pickup_lat, pickup_lng,
            delivery_address, delivery_lat, delivery_lng,
            remarks, use_count, is_default
        )
        VALUES (
            $1, '计划模板', '电子配件', 'normal', 3.5, 6.0,
            '深圳市南山区科技园1号', 22.5405, 113.9345,
            '广州市天河区珠江新城1号', 23.1291, 113.2644,
            '防潮', 0, true
        )
        RETURNING id
        "#,
    )
    .bind(user_id)
    .fetch_one(&context.pool)
    .await
    .expect("template for schedule should be inserted");

    let (missing_status, missing_body) = get_json(&context.app, "/api/demand-schedules").await;
    assert_eq!(missing_status, StatusCode::OK);
    assert_eq!(missing_body["code"], 400);
    assert_eq!(missing_body["message"], "用户ID不能为空");
    assert_eq!(missing_body["data"], Value::Null);

    let (create_status, create_body) = post_json(
        &context.app,
        "/api/demand-schedules",
        serde_json::json!({
            "user_id": user_id,
            "template_id": template_id,
            "schedule_name": "计划模板",
            "schedule_type": "interval",
            "interval_days": 3,
            "base_date": "2099-01-01",
            "base_time": "08:30:00",
            "pickup_time_offset": "2h",
            "max_publish_count": 5,
            "end_time": "2099-12-31T23:59:59Z"
        }),
    )
    .await;
    assert_eq!(create_status, StatusCode::OK);
    assert_eq!(create_body["message"], "计划创建成功");
    assert_eq!(create_body["data"]["status"], "active");
    assert_eq!(create_body["data"]["published_count"], 0);
    assert!(create_body["data"]["next_publish_time"]
        .as_str()
        .is_some_and(|value| value.starts_with("2099-01-01T08:30:00")));
    let schedule_id = create_body["data"]["id"]
        .as_str()
        .expect("created schedule id should be a string");

    let (list_status, list_body) = get_json(
        &context.app,
        &format!("/api/demand-schedules?user_id={user_id}"),
    )
    .await;
    assert_eq!(list_status, StatusCode::OK);
    assert_eq!(list_body["message"], "查询成功");
    let schedules = list_body["data"]
        .as_array()
        .expect("schedules should be an array");
    assert_eq!(schedules.len(), 1);
    assert_eq!(schedules[0]["id"], schedule_id);
    assert_eq!(schedules[0]["template"]["template_name"], "计划模板");
    assert_eq!(schedules[0]["template"]["cargo_name"], "电子配件");
    assert_eq!(
        schedules[0]["template"]["pickup_address"],
        "深圳市南山区科技园1号"
    );
    assert_eq!(
        schedules[0]["template"]["delivery_address"],
        "广州市天河区珠江新城1号"
    );

    let (past_interval_status, past_interval_body) = post_json(
        &context.app,
        "/api/demand-schedules",
        serde_json::json!({
            "user_id": user_id,
            "template_id": template_id,
            "schedule_name": "旧版首次发布时间",
            "schedule_type": "interval",
            "interval_days": 3,
            "base_date": "2000-01-01",
            "base_time": "00:00:00",
            "end_time": "2099-12-31"
        }),
    )
    .await;
    assert_eq!(past_interval_status, StatusCode::OK);
    assert!(past_interval_body["data"]["next_publish_time"]
        .as_str()
        .is_some_and(|value| value.starts_with("2000-01-02T00:00:00")));
    assert!(past_interval_body["data"]["end_time"]
        .as_str()
        .is_some_and(|value| value.starts_with("2099-12-31T00:00:00")));

    let (get_status, get_body) = get_json(
        &context.app,
        &format!("/api/demand-schedules/{schedule_id}"),
    )
    .await;
    assert_eq!(get_status, StatusCode::OK);
    assert_eq!(get_body["message"], "查询成功");
    assert_eq!(get_body["data"]["id"], schedule_id);

    let (update_status, update_body) = put_json(
        &context.app,
        &format!("/api/demand-schedules/{schedule_id}"),
        serde_json::json!({
            "base_date": "2099-01-02",
            "base_time": "09:15:00",
            "schedule_type": "day"
        }),
    )
    .await;
    assert_eq!(update_status, StatusCode::OK);
    assert_eq!(update_body["message"], "计划更新成功");
    assert!(update_body["data"]["next_publish_time"]
        .as_str()
        .is_some_and(|value| value.starts_with("2099-01-02T09:15:00")));

    let (active_delete_status, active_delete_body) = delete_json(
        &context.app,
        &format!("/api/demand-schedules/{schedule_id}"),
    )
    .await;
    assert_eq!(active_delete_status, StatusCode::BAD_REQUEST);
    assert_eq!(
        active_delete_body["message"],
        "正在运行的计划不能删除，请先暂停或取消"
    );

    let (pause_status, pause_body) = post_json(
        &context.app,
        &format!("/api/demand-schedules/{schedule_id}/pause"),
        serde_json::json!({}),
    )
    .await;
    assert_eq!(pause_status, StatusCode::OK);
    assert_eq!(pause_body["message"], "计划已暂停");
    assert_eq!(pause_body["data"]["status"], "paused");

    let (resume_status, resume_body) = post_json(
        &context.app,
        &format!("/api/demand-schedules/{schedule_id}/resume"),
        serde_json::json!({}),
    )
    .await;
    assert_eq!(resume_status, StatusCode::OK);
    assert_eq!(resume_body["message"], "计划已恢复");
    assert_eq!(resume_body["data"]["status"], "active");

    let (pause_again_status, pause_again_body) = post_json(
        &context.app,
        &format!("/api/demand-schedules/{schedule_id}/pause"),
        serde_json::json!({}),
    )
    .await;
    assert_eq!(pause_again_status, StatusCode::OK);
    assert_eq!(pause_again_body["data"]["status"], "paused");

    let (publish_status, publish_body) = post_json(
        &context.app,
        &format!("/api/demand-schedules/{schedule_id}/publish-now"),
        serde_json::json!({
            "user_id": user_id
        }),
    )
    .await;
    assert_eq!(publish_status, StatusCode::OK);
    assert_eq!(publish_body["message"], "需求发布成功");
    assert_eq!(publish_body["data"]["schedule_id"], schedule_id);
    assert_eq!(
        publish_body["data"]["demand_info"]["cargo_name"],
        "电子配件"
    );
    assert_eq!(
        publish_body["data"]["demand_info"]["pickup_address"],
        "深圳市南山区科技园1号"
    );
    assert_eq!(
        publish_body["data"]["demand_info"]["delivery_address"],
        "广州市天河区珠江新城1号"
    );
    assert!(publish_body["data"]["published_at"].as_str().is_some());
    let demand_id = publish_body["data"]["demand_id"]
        .as_str()
        .expect("published demand id should be a string");

    sqlx::query(
        r#"
        INSERT INTO demand_publish_logs (
            schedule_id, publish_time, publish_type, status, created_at
        )
        VALUES
            ($1, '2099-01-01 00:00:00+00', 'older-publish', 'success', '2099-01-10 00:00:00+00'),
            ($1, '2099-01-02 00:00:00+00', 'later-publish', 'success', '2099-01-01 00:00:00+00')
        "#,
    )
    .bind(schedule_id)
    .execute(&context.pool)
    .await
    .expect("manual publish log rows should be inserted");

    let template_use_count: i32 =
        sqlx::query_scalar("SELECT use_count FROM demand_templates WHERE id = $1")
            .bind(&template_id)
            .fetch_one(&context.pool)
            .await
            .expect("template use count should be readable");
    assert_eq!(template_use_count, 1);
    let published_count: i32 =
        sqlx::query_scalar("SELECT published_count FROM demand_schedules WHERE id = $1")
            .bind(schedule_id)
            .fetch_one(&context.pool)
            .await
            .expect("schedule published count should be readable");
    assert_eq!(published_count, 1);

    let (logs_status, logs_body) = get_json(
        &context.app,
        &format!("/api/demand-schedules/{schedule_id}/logs"),
    )
    .await;
    assert_eq!(logs_status, StatusCode::OK);
    assert_eq!(logs_body["message"], "查询成功");
    let logs = logs_body["data"]
        .as_array()
        .expect("publish logs should be an array");
    assert_eq!(logs.len(), 3);
    assert_eq!(logs[0]["publish_type"], "later-publish");
    assert_eq!(logs[1]["publish_type"], "older-publish");
    assert_eq!(logs[2]["schedule_id"], schedule_id);
    assert_eq!(logs[2]["demand_id"], demand_id);
    assert_eq!(logs[2]["publish_type"], "manual");
    assert_eq!(logs[0]["status"], "success");

    let (delete_status, delete_body) = delete_json(
        &context.app,
        &format!("/api/demand-schedules/{schedule_id}"),
    )
    .await;
    assert_eq!(delete_status, StatusCode::OK);
    assert_eq!(delete_body["message"], "计划删除成功");
    assert_eq!(delete_body["data"], Value::Null);

    context.cleanup().await;
}

#[tokio::test]
async fn user_roles_register_user_creates_default_active_role() {
    let Some(context) = auth_test_context().await else {
        return;
    };
    let (_, register_body) =
        register_auth_user(&context.app, "13900000101", "merchant", "默认角色商户").await;
    let user_id = register_body["data"]["id"]
        .as_str()
        .expect("registered user id should be a string");

    let response = context
        .app
        .clone()
        .oneshot(
            Request::builder()
                .uri(format!("/api/user-roles/my-roles?userId={user_id}"))
                .body(Body::empty())
                .expect("user roles request should build"),
        )
        .await
        .expect("user roles request should complete");

    assert_eq!(response.status(), StatusCode::OK);
    let body = body_json(response).await;
    assert_eq!(body["code"], 200);
    assert_eq!(body["message"], "查询成功");
    assert_eq!(
        body["data"]
            .as_array()
            .expect("roles should be array")
            .len(),
        1
    );
    assert_eq!(body["data"][0]["user_id"], user_id);
    assert_eq!(body["data"][0]["role"], "merchant");
    assert_eq!(body["data"][0]["is_active"], true);
    assert_eq!(body["data"][0]["status"], "active");

    let active = context
        .app
        .clone()
        .oneshot(
            Request::builder()
                .uri(format!("/api/user-roles/active?userId={user_id}"))
                .body(Body::empty())
                .expect("active role request should build"),
        )
        .await
        .expect("active role request should complete");
    assert_eq!(active.status(), StatusCode::OK);
    let active_body = body_json(active).await;
    assert_eq!(active_body["message"], "查询成功");
    assert_eq!(active_body["data"]["role"], "merchant");
    assert_eq!(active_body["data"]["is_active"], true);

    context.cleanup().await;
}

#[tokio::test]
async fn user_roles_create_and_switch_updates_active_role_and_user_role() {
    let Some(context) = auth_test_context().await else {
        return;
    };
    let (_, register_body) =
        register_auth_user(&context.app, "13900000102", "merchant", "切换角色用户").await;
    let user_id = register_body["data"]["id"]
        .as_str()
        .expect("registered user id should be a string");

    let default_role = context
        .app
        .clone()
        .oneshot(
            Request::builder()
                .uri(format!("/api/user-roles/my-roles?userId={user_id}"))
                .body(Body::empty())
                .expect("default role request should build"),
        )
        .await
        .expect("default role request should complete");
    assert_eq!(default_role.status(), StatusCode::OK);

    let (create_status, create_body) = post_json(
        &context.app,
        "/api/user-roles/create",
        serde_json::json!({
            "userId": user_id,
            "role": "owner"
        }),
    )
    .await;
    assert_eq!(create_status, StatusCode::OK);
    assert_eq!(create_body["message"], "角色创建成功");
    assert_eq!(create_body["data"]["role"], "owner");
    assert_eq!(create_body["data"]["is_active"], false);

    let owner_role_id = create_body["data"]["id"]
        .as_str()
        .expect("created role id should be a string");
    let (switch_status, switch_body) = post_json(
        &context.app,
        "/api/user-roles/switch",
        serde_json::json!({
            "userId": user_id,
            "roleId": owner_role_id
        }),
    )
    .await;
    assert_eq!(switch_status, StatusCode::OK);
    assert_eq!(switch_body["message"], "角色切换成功");
    assert_eq!(switch_body["data"]["id"], user_id);
    assert_eq!(switch_body["data"]["role"], "owner");
    assert_eq!(
        switch_body["data"]["roles"],
        serde_json::json!(["merchant", "owner"])
    );
    assert!(switch_body["data"]["switchTime"].as_str().is_some());

    let stored_role: String = sqlx::query_scalar("SELECT role FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_one(&context.pool)
        .await
        .expect("updated user role should be readable");
    assert_eq!(stored_role, "owner");

    context.cleanup().await;
}

#[tokio::test]
async fn user_roles_create_rejects_missing_user_without_database_error() {
    let Some(context) = auth_test_context().await else {
        return;
    };

    let (status, body) = post_json(
        &context.app,
        "/api/user-roles/create",
        serde_json::json!({
            "userId": "missing-user",
            "role": "owner"
        }),
    )
    .await;

    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(body["message"], "用户不存在");

    context.cleanup().await;
}

#[tokio::test]
async fn platform_settings_returns_default_row_and_payment_qr_url() {
    let Some(context) = auth_test_context().await else {
        return;
    };

    let response = context
        .app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/platform/settings")
                .body(Body::empty())
                .expect("platform settings request should build"),
        )
        .await
        .expect("platform settings request should complete");
    assert_eq!(response.status(), StatusCode::OK);
    let body = body_json(response).await;
    assert_eq!(body["code"], 200);
    assert_eq!(body["message"], "查询成功");
    assert_eq!(body["data"]["id"], "default");
    assert_eq!(
        body["data"]["commission_rate"]
            .as_f64()
            .expect("commission rate should be numeric"),
        0.0
    );

    let (update_status, update_body) = put_json(
        &context.app,
        "/api/platform/settings",
        serde_json::json!({
            "commissionRate": 8.5,
            "commissionPaymentQr": "platform/payment.png"
        }),
    )
    .await;
    assert_eq!(update_status, StatusCode::OK);
    assert_eq!(update_body["message"], "更新成功");
    assert_eq!(
        update_body["data"]["commission_rate"]
            .as_f64()
            .expect("commission rate should be numeric"),
        8.5
    );
    assert_eq!(
        update_body["data"]["commission_payment_qr"],
        "platform/payment.png"
    );

    let payment_qr = context
        .app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/platform/payment-qr")
                .body(Body::empty())
                .expect("platform payment qr request should build"),
        )
        .await
        .expect("platform payment qr request should complete");
    assert_eq!(payment_qr.status(), StatusCode::OK);
    let payment_body = body_json(payment_qr).await;
    assert_eq!(payment_body["message"], "查询成功");
    assert_eq!(
        payment_body["data"]["paymentQr"],
        "https://car.shcxyz.site/api/uploads/platform/payment.png"
    );

    context.cleanup().await;
}

#[tokio::test]
async fn account_send_sms_change_phone_and_change_password_update_login_behavior() {
    let Some(context) = auth_test_context().await else {
        return;
    };
    let (_, register_body) =
        register_auth_user(&context.app, "13900000103", "owner", "账号设置用户").await;
    let user_id = register_body["data"]["id"]
        .as_str()
        .expect("registered user id should be a string");
    let new_phone = "13900000104";

    let (sms_status, sms_body) = post_json(
        &context.app,
        "/api/account-settings/send-sms-code",
        serde_json::json!({
            "phone": new_phone,
            "type": "change_phone"
        }),
    )
    .await;
    assert_eq!(sms_status, StatusCode::OK);
    assert_eq!(sms_body["message"], "验证码已发送");
    let code = sms_body["data"]["code"]
        .as_str()
        .expect("sms code should be returned");
    assert_eq!(code.len(), 6);
    assert!(code.chars().all(|ch| ch.is_ascii_digit()));

    let (change_phone_status, change_phone_body) = post_json(
        &context.app,
        "/api/account-settings/change-phone",
        serde_json::json!({
            "user_id": user_id,
            "code": code,
            "newPhone": new_phone
        }),
    )
    .await;
    assert_eq!(change_phone_status, StatusCode::OK);
    assert_eq!(change_phone_body["code"], 200);
    assert_eq!(change_phone_body["message"], "手机号修改成功");

    let (old_login_status, old_login_body) = post_json(
        &context.app,
        "/api/auth/login",
        serde_json::json!({
            "phone": "13900000103",
            "password": "secret123"
        }),
    )
    .await;
    assert_eq!(old_login_status, StatusCode::UNAUTHORIZED);
    assert_eq!(old_login_body["message"], "用户不存在");

    let (new_login_status, new_login_body) = post_json(
        &context.app,
        "/api/auth/login",
        serde_json::json!({
            "phone": new_phone,
            "password": "secret123"
        }),
    )
    .await;
    assert_eq!(new_login_status, StatusCode::OK);
    assert_eq!(new_login_body["message"], "登录成功");
    assert_eq!(new_login_body["data"]["id"], user_id);

    let (change_password_status, change_password_body) = post_json(
        &context.app,
        "/api/account-settings/change-password",
        serde_json::json!({
            "user_id": user_id,
            "oldPassword": "secret123",
            "newPassword": "newsecret123"
        }),
    )
    .await;
    assert_eq!(change_password_status, StatusCode::OK);
    assert_eq!(change_password_body["message"], "密码修改成功，请重新登录");

    let (stale_password_status, stale_password_body) = post_json(
        &context.app,
        "/api/auth/login",
        serde_json::json!({
            "phone": new_phone,
            "password": "secret123"
        }),
    )
    .await;
    assert_eq!(stale_password_status, StatusCode::UNAUTHORIZED);
    assert_eq!(stale_password_body["message"], "密码错误");

    let (changed_password_status, changed_password_body) = post_json(
        &context.app,
        "/api/auth/login",
        serde_json::json!({
            "phone": new_phone,
            "password": "newsecret123"
        }),
    )
    .await;
    assert_eq!(changed_password_status, StatusCode::OK);
    assert_eq!(changed_password_body["message"], "登录成功");

    context.cleanup().await;
}

#[tokio::test]
async fn account_profile_update_matches_existing_shape() {
    let Some(context) = auth_test_context().await else {
        return;
    };
    sqlx::query(
        r#"
        INSERT INTO users (id, phone, password, role, name, status, credit_score)
        VALUES ('7428999e-92fa-4fec-9f75-09087edbf244', '13900000105', $1, 'owner', '资料用户', 'active', 100)
        "#,
    )
    .bind(bcrypt::hash("secret123", 10).expect("test password should hash"))
    .execute(&context.pool)
    .await
    .expect("fallback profile user should be inserted");
    let user_id = "7428999e-92fa-4fec-9f75-09087edbf244";

    let (update_status, update_body) = put_json(
        &context.app,
        "/api/account-settings/profile",
        serde_json::json!({
            "avatar_url": "avatars/profile.png",
            "nickname": "资料昵称",
            "gender": "female",
            "birthday": "1995-06-07"
        }),
    )
    .await;
    assert_eq!(update_status, StatusCode::OK);
    assert_eq!(update_body["message"], "更新成功");
    assert_eq!(update_body["data"]["id"], user_id);
    assert_eq!(update_body["data"]["avatar_url"], "avatars/profile.png");
    assert_eq!(update_body["data"]["nickname"], "资料昵称");
    assert_eq!(update_body["data"]["gender"], "female");
    assert_eq!(update_body["data"]["birthday"], "1995-06-07");
    assert_eq!(update_body["data"]["status"], "active");
    assert_eq!(update_body["data"]["credit_score"], 100);

    let response = context
        .app
        .clone()
        .oneshot(
            Request::builder()
                .uri(format!(
                    "/api/account-settings/profile?user_id={}",
                    register_auth_user(&context.app, "13900000106", "owner", "旁路用户")
                        .await
                        .1["data"]["id"]
                        .as_str()
                        .expect("query user id should be present")
                ))
                .body(Body::empty())
                .expect("profile request should build"),
        )
        .await
        .expect("profile request should complete");
    assert_eq!(response.status(), StatusCode::OK);
    let body = body_json(response).await;
    assert_eq!(body["message"], "获取成功");
    assert_eq!(body["data"]["id"], user_id);
    assert_eq!(body["data"]["phone"], "13900000105");
    assert_eq!(body["data"]["nickname"], "资料昵称");
    assert_eq!(body["data"]["avatar_url"], "avatars/profile.png");
    assert_eq!(body["data"]["gender"], "female");
    assert_eq!(body["data"]["birthday"], "1995-06-07");
    assert_eq!(body["data"]["role"], "owner");
    assert_eq!(body["data"]["name"], "资料用户");
    assert!(body["data"]["created_at"].as_str().is_some());

    context.cleanup().await;
}

#[tokio::test]
async fn auth_register_and_login_preserve_response_shape() {
    let Some(context) = auth_test_context().await else {
        return;
    };
    let phone = "13900000001";

    let (register_status, register_body) =
        register_auth_user(&context.app, phone, "owner", "测试用户").await;

    assert_eq!(register_status, StatusCode::OK);
    assert_eq!(register_body["code"], 200);
    assert_eq!(register_body["message"], "注册成功");
    assert!(register_body["data"]["id"].as_str().is_some());
    assert_eq!(register_body["data"]["phone"], phone);
    assert_eq!(register_body["data"]["name"], "测试用户");
    assert_eq!(register_body["data"]["role"], "owner");
    assert_eq!(register_body["data"]["token"], register_body["data"]["id"]);

    let login = context
        .app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/auth/login")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::json!({
                        "phone": phone,
                        "password": "secret123"
                    })
                    .to_string(),
                ))
                .expect("login request should build"),
        )
        .await
        .expect("login request should complete");

    assert_eq!(login.status(), StatusCode::OK);
    let login_body = body_json(login).await;
    assert_eq!(login_body["code"], 200);
    assert_eq!(login_body["message"], "登录成功");
    assert_eq!(login_body["data"]["id"], register_body["data"]["id"]);
    assert_eq!(login_body["data"]["phone"], phone);
    assert_eq!(login_body["data"]["name"], "测试用户");
    assert_eq!(login_body["data"]["role"], "owner");
    assert_eq!(login_body["data"]["token"], login_body["data"]["id"]);

    context.cleanup().await;
}

#[tokio::test]
async fn auth_user_info_returns_payment_qr_url_after_owner_upload() {
    let Some(context) = auth_test_context().await else {
        return;
    };
    let (_, register_body) =
        register_auth_user(&context.app, "13900000002", "owner", "车主用户").await;
    let user_id = register_body["data"]["id"]
        .as_str()
        .expect("registered user id should be a string")
        .to_string();
    let boundary = "recocar-auth-payment-boundary";

    let upload = context
        .app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/auth/update-payment-qr")
                .header(
                    "content-type",
                    format!("multipart/form-data; boundary={boundary}"),
                )
                .body(Body::from(payment_qr_multipart_body(
                    boundary,
                    &user_id,
                    Some("payment.png"),
                    Some("image/png"),
                    Some(b"\x89PNG\r\n\x1a\n"),
                )))
                .expect("payment qr upload request should build"),
        )
        .await
        .expect("payment qr upload request should complete");

    assert_eq!(upload.status(), StatusCode::OK);
    let upload_body = body_json(upload).await;
    assert_eq!(upload_body["code"], 200);
    assert_eq!(upload_body["message"], "收款码上传成功");
    assert_eq!(upload_body["data"]["id"], user_id);
    assert_eq!(upload_body["data"]["phone"], "13900000002");
    assert_eq!(upload_body["data"]["name"], "车主用户");
    assert_eq!(upload_body["data"]["role"], "owner");

    let payment_url = upload_body["data"]["wechat_payment_qr"]
        .as_str()
        .expect("payment url should be returned");
    let key = payment_url
        .strip_prefix("https://car.shcxyz.site/api/uploads/")
        .expect("payment url should use public upload prefix");
    let key_pattern = regex::Regex::new(&format!(
        r"^payment_qr/{}_\d{{13}}_payment_[0-9a-f]{{8}}\.png$",
        regex::escape(&user_id)
    ))
    .expect("payment qr key pattern should compile");
    assert!(
        key_pattern.is_match(key),
        "expected payment qr key under user prefix, got {key}"
    );
    assert!(context
        .storage
        .exists(key)
        .await
        .expect("stored payment qr should be checked"));

    let user_info = context
        .app
        .clone()
        .oneshot(
            Request::builder()
                .uri(format!("/api/auth/user-info?userId={user_id}"))
                .body(Body::empty())
                .expect("user info request should build"),
        )
        .await
        .expect("user info request should complete");

    assert_eq!(user_info.status(), StatusCode::OK);
    let user_info_body = body_json(user_info).await;
    assert_eq!(user_info_body["code"], 200);
    assert_eq!(user_info_body["message"], "查询成功");
    assert_eq!(user_info_body["data"]["id"], user_id);
    assert_eq!(user_info_body["data"]["phone"], "13900000002");
    assert_eq!(user_info_body["data"]["name"], "车主用户");
    assert_eq!(user_info_body["data"]["role"], "owner");
    assert_eq!(user_info_body["data"]["avatar"], Value::Null);
    assert_eq!(
        user_info_body["data"]["wechat_payment_qr"],
        upload_body["data"]["wechat_payment_qr"]
    );
    assert!(user_info_body["data"]["created_at"].as_str().is_some());

    context.cleanup().await;
}

#[tokio::test]
async fn auth_json_routes_keep_default_body_limit() {
    let large_json = format!("{{\"data\":\"{}\"}}", "a".repeat(3 * 1024 * 1024));

    let response = test_app()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/auth/login")
                .header("content-type", "application/json")
                .body(Body::from(large_json))
                .expect("large auth request should build"),
        )
        .await
        .expect("large auth request should complete");

    assert_eq!(response.status(), StatusCode::PAYLOAD_TOO_LARGE);
}

#[tokio::test]
async fn auth_payment_qr_rejects_unknown_user() {
    let Some(context) = auth_test_context().await else {
        return;
    };
    let boundary = "recocar-auth-payment-boundary";

    let response = context
        .app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/auth/update-payment-qr")
                .header(
                    "content-type",
                    format!("multipart/form-data; boundary={boundary}"),
                )
                .body(Body::from(payment_qr_multipart_body(
                    boundary,
                    "missing-user",
                    Some("payment.png"),
                    Some("image/png"),
                    Some(b"\x89PNG\r\n\x1a\n"),
                )))
                .expect("payment qr upload request should build"),
        )
        .await
        .expect("payment qr upload request should complete");

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
    let body = body_json(response).await;
    assert_eq!(body["message"], "用户不存在");

    context.cleanup().await;
}

#[tokio::test]
async fn auth_payment_qr_rejects_non_owner_user() {
    let Some(context) = auth_test_context().await else {
        return;
    };
    let (_, register_body) =
        register_auth_user(&context.app, "13900000003", "merchant", "商户用户").await;
    let user_id = register_body["data"]["id"]
        .as_str()
        .expect("registered user id should be a string")
        .to_string();
    let boundary = "recocar-auth-payment-boundary";

    let response = context
        .app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/auth/update-payment-qr")
                .header(
                    "content-type",
                    format!("multipart/form-data; boundary={boundary}"),
                )
                .body(Body::from(payment_qr_multipart_body(
                    boundary,
                    &user_id,
                    Some("payment.png"),
                    Some("image/png"),
                    Some(b"\x89PNG\r\n\x1a\n"),
                )))
                .expect("payment qr upload request should build"),
        )
        .await
        .expect("payment qr upload request should complete");

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    let body = body_json(response).await;
    assert_eq!(body["message"], "只有车主可以上传收款码");

    context.cleanup().await;
}

#[tokio::test]
async fn auth_payment_qr_accepts_present_file_without_image_content_type() {
    let Some(context) = auth_test_context().await else {
        return;
    };
    let (_, register_body) =
        register_auth_user(&context.app, "13900000005", "owner", "任意文件车主").await;
    let user_id = register_body["data"]["id"]
        .as_str()
        .expect("registered user id should be a string")
        .to_string();
    let boundary = "recocar-auth-payment-boundary";

    let response = context
        .app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/auth/update-payment-qr")
                .header(
                    "content-type",
                    format!("multipart/form-data; boundary={boundary}"),
                )
                .body(Body::from(payment_qr_multipart_body(
                    boundary,
                    &user_id,
                    Some("payment.bin"),
                    Some("application/octet-stream"),
                    Some(b"not image bytes"),
                )))
                .expect("payment qr upload request should build"),
        )
        .await
        .expect("payment qr upload request should complete");

    assert_eq!(response.status(), StatusCode::OK);
    let body = body_json(response).await;
    assert_eq!(body["message"], "收款码上传成功");

    context.cleanup().await;
}

#[tokio::test]
async fn auth_payment_qr_rejects_missing_file() {
    let Some(context) = auth_test_context().await else {
        return;
    };
    let (_, register_body) =
        register_auth_user(&context.app, "13900000004", "owner", "无文件车主").await;
    let user_id = register_body["data"]["id"]
        .as_str()
        .expect("registered user id should be a string")
        .to_string();
    let boundary = "recocar-auth-payment-boundary";

    let response = context
        .app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/auth/update-payment-qr")
                .header(
                    "content-type",
                    format!("multipart/form-data; boundary={boundary}"),
                )
                .body(Body::from(payment_qr_multipart_body(
                    boundary, &user_id, None, None, None,
                )))
                .expect("payment qr upload request should build"),
        )
        .await
        .expect("payment qr upload request should complete");

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    let body = body_json(response).await;
    assert_eq!(body["message"], "请上传收款码图片");

    context.cleanup().await;
}
