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
