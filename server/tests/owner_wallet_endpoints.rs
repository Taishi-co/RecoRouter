use std::env;

use axum::{
    body::{to_bytes, Body},
    http::{Request, StatusCode},
    Router,
};
use serde_json::{json, Value};
use sqlx::{postgres::PgPoolOptions, PgPool};
use tower::ServiceExt;

use recorouter_api::{
    config::Config, modules::owner_wallet::credit_completed_order_income, storage::LocalStorage,
};

struct TestContext {
    app: Router,
    pool: PgPool,
    admin_pool: PgPool,
    database_name: String,
    _upload_dir: tempfile::TempDir,
}

impl TestContext {
    async fn new() -> Option<Self> {
        let Ok(database_url) = env::var("TEST_DATABASE_URL") else {
            eprintln!("skipping owner wallet endpoint test because TEST_DATABASE_URL is not set");
            return None;
        };

        let admin_database_url = rewrite_database_url(&database_url, "postgres");
        let admin_pool = PgPoolOptions::new()
            .max_connections(1)
            .connect(&admin_database_url)
            .await
            .expect("admin test database should be reachable");
        let database_name = format!("recorouter_wallet_test_{}", uuid::Uuid::new_v4().simple());
        sqlx::query(&format!(r#"CREATE DATABASE "{database_name}""#))
            .execute(&admin_pool)
            .await
            .expect("disposable wallet test database should be created");

        let database_url = rewrite_database_url(&database_url, &database_name);
        let pool = PgPoolOptions::new()
            .max_connections(5)
            .connect(&database_url)
            .await
            .expect("disposable wallet test database should be reachable");

        recorouter_api::db::run_migrations(&pool)
            .await
            .expect("wallet test migrations should run");

        let upload_dir = tempfile::tempdir().expect("temp upload dir should be created");
        let config = Config {
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
        let app = recorouter_api::app::router(config, pool.clone(), storage);

        Some(Self {
            app,
            pool,
            admin_pool,
            database_name,
            _upload_dir: upload_dir,
        })
    }

    async fn cleanup(self) {
        let Self {
            app,
            pool,
            admin_pool,
            database_name,
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
            .expect("disposable wallet test database should be dropped");

        admin_pool.close().await;
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

async fn request_json(
    app: &Router,
    method: &str,
    uri: &str,
    body: Option<Value>,
) -> (StatusCode, Value) {
    let mut builder = Request::builder().method(method).uri(uri);
    if body.is_some() {
        builder = builder.header("content-type", "application/json");
    }
    let response = app
        .clone()
        .oneshot(
            builder
                .body(Body::from(
                    body.map(|value| value.to_string()).unwrap_or_default(),
                ))
                .expect("request should build"),
        )
        .await
        .expect("request should complete");
    let status = response.status();
    let body = to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("response body should read");
    let json = if body.is_empty() {
        Value::Null
    } else {
        serde_json::from_slice(&body).expect("response body should be json")
    };

    (status, json)
}

async fn insert_user(pool: &PgPool, phone: &str, role: &str, name: &str) -> String {
    sqlx::query_scalar(
        r#"
        INSERT INTO users (phone, password, role, name, username, status, credit_score)
        VALUES ($1, 'hashed-secret', $2, $3, $3, 'active', 100)
        RETURNING id
        "#,
    )
    .bind(phone)
    .bind(role)
    .bind(name)
    .fetch_one(pool)
    .await
    .expect("user should be inserted")
}

async fn insert_wallet_credit(pool: &PgPool, owner_id: &str, amount_cents: i64) {
    sqlx::query(
        r#"
        INSERT INTO owner_wallet_ledger_entries (
            owner_id, entry_type, amount_cents, status, description
        )
        VALUES ($1, 'fare_credit', $2, 'posted', 'test credit')
        "#,
    )
    .bind(owner_id)
    .bind(amount_cents)
    .execute(pool)
    .await
    .expect("wallet credit should be inserted");
}

async fn insert_completed_paid_order(pool: &PgPool, owner_id: &str, merchant_id: &str) -> String {
    let demand_id: String = sqlx::query_scalar(
        r#"
        INSERT INTO demands (
            merchant_id, cargo_name, pickup_address, delivery_address, status, fare_price
        )
        VALUES ($1, '冷链货物', 'A', 'B', 'completed', 123.45)
        RETURNING id
        "#,
    )
    .bind(merchant_id)
    .fetch_one(pool)
    .await
    .expect("demand should be inserted");
    let vehicle_id: String = sqlx::query_scalar(
        r#"
        INSERT INTO vehicles (
            owner_id, vehicle_type, license_plate, status, trip_status,
            load_capacity, volume, battery_life
        )
        VALUES ($1, '冷链车', 'WALLET-1', 'active', 'idle', 1000, 20, 300)
        RETURNING id
        "#,
    )
    .bind(owner_id)
    .fetch_one(pool)
    .await
    .expect("vehicle should be inserted");

    sqlx::query_scalar(
        r#"
        INSERT INTO orders (
            demand_id, vehicle_id, merchant_id, owner_id, status,
            fare_price, payment_status, commission_payment_status, actual_complete_time
        )
        VALUES ($1, $2, $3, $4, 'completed', 123.45, 'paid', 'not_required', now())
        RETURNING id
        "#,
    )
    .bind(demand_id)
    .bind(vehicle_id)
    .bind(merchant_id)
    .bind(owner_id)
    .fetch_one(pool)
    .await
    .expect("order should be inserted")
}

#[tokio::test]
async fn completed_order_credit_helper_is_idempotent() {
    let Some(ctx) = TestContext::new().await else {
        return;
    };
    let owner_id = insert_user(&ctx.pool, "18000000001", "owner", "运力A").await;
    let merchant_id = insert_user(&ctx.pool, "18000000002", "merchant", "需求方A").await;
    let order_id = insert_completed_paid_order(&ctx.pool, &owner_id, &merchant_id).await;

    credit_completed_order_income(&ctx.pool, &order_id)
        .await
        .expect("first credit should succeed");
    credit_completed_order_income(&ctx.pool, &order_id)
        .await
        .expect("second credit should be idempotent");

    let (_status, body) = request_json(
        &ctx.app,
        "GET",
        &format!("/api/owner-wallet/{owner_id}"),
        None,
    )
    .await;

    assert_eq!(body["data"]["summary"]["availableBalanceCents"], 12345);
    assert_eq!(body["data"]["summary"]["lifetimeIncomeCents"], 12345);

    ctx.cleanup().await;
}

#[tokio::test]
async fn manual_fallback_withdrawal_reserves_balance() {
    let Some(ctx) = TestContext::new().await else {
        return;
    };
    let owner_id = insert_user(&ctx.pool, "18000000003", "owner", "运力B").await;
    insert_wallet_credit(&ctx.pool, &owner_id, 10_000).await;

    let (status, body) = request_json(
        &ctx.app,
        "POST",
        "/api/owner-wallet/withdrawals",
        Some(json!({
            "ownerId": owner_id,
            "amountCents": 2500,
            "provider": "manual"
        })),
    )
    .await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["data"]["withdrawal"]["status"], "pending_manual");
    assert_eq!(body["data"]["summary"]["availableBalanceCents"], 7500);

    ctx.cleanup().await;
}

#[tokio::test]
async fn wallet_rejects_withdrawal_above_available_balance() {
    let Some(ctx) = TestContext::new().await else {
        return;
    };
    let owner_id = insert_user(&ctx.pool, "18000000004", "owner", "运力C").await;
    insert_wallet_credit(&ctx.pool, &owner_id, 1000).await;

    let (status, _body) = request_json(
        &ctx.app,
        "POST",
        "/api/owner-wallet/withdrawals",
        Some(json!({
            "ownerId": owner_id,
            "amountCents": 2000,
            "provider": "manual"
        })),
    )
    .await;

    assert_eq!(status, StatusCode::BAD_REQUEST);

    ctx.cleanup().await;
}

#[tokio::test]
async fn manual_failure_releases_held_balance() {
    let Some(ctx) = TestContext::new().await else {
        return;
    };
    let owner_id = insert_user(&ctx.pool, "18000000005", "owner", "运力D").await;
    insert_wallet_credit(&ctx.pool, &owner_id, 10_000).await;

    let (_status, body) = request_json(
        &ctx.app,
        "POST",
        "/api/owner-wallet/withdrawals",
        Some(json!({
            "ownerId": owner_id,
            "amountCents": 3000,
            "provider": "manual"
        })),
    )
    .await;
    let withdrawal_id = body["data"]["withdrawal"]["id"]
        .as_str()
        .expect("withdrawal id should exist");

    let (_status, body) = request_json(
        &ctx.app,
        "POST",
        &format!("/api/admin/owner-withdrawals/{withdrawal_id}/manual-fail"),
        Some(json!({
            "reason": "银行卡信息有误"
        })),
    )
    .await;

    assert_eq!(body["data"]["withdrawal"]["status"], "failed");
    assert_eq!(body["data"]["summary"]["availableBalanceCents"], 10_000);

    ctx.cleanup().await;
}
