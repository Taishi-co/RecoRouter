use std::env;

use axum::{
    body::{to_bytes, Body},
    http::{Request, StatusCode},
    Router,
};
use serde_json::{json, Value};
use sqlx::{postgres::PgPoolOptions, PgPool};
use tower::ServiceExt;

use recorouter_api::{config::Config, storage::LocalStorage};

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
            eprintln!("skipping cancellation endpoint test because TEST_DATABASE_URL is not set");
            return None;
        };

        let admin_database_url = rewrite_database_url(&database_url, "postgres");
        let admin_pool = PgPoolOptions::new()
            .max_connections(1)
            .connect(&admin_database_url)
            .await
            .expect("admin test database should be reachable");
        let database_name = format!(
            "recorouter_cancellation_test_{}",
            uuid::Uuid::new_v4().simple()
        );
        sqlx::query(&format!(r#"CREATE DATABASE "{database_name}""#))
            .execute(&admin_pool)
            .await
            .expect("disposable cancellation test database should be created");

        let database_url = rewrite_database_url(&database_url, &database_name);
        let pool = PgPoolOptions::new()
            .max_connections(5)
            .connect(&database_url)
            .await
            .expect("disposable cancellation test database should be reachable");

        recorouter_api::db::run_migrations(&pool)
            .await
            .expect("cancellation test migrations should run");

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
            .expect("disposable cancellation test database should be dropped");

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

async fn post_json(app: &Router, uri: &str, body: Value) -> (StatusCode, Value) {
    request_json(app, "POST", uri, Some(body)).await
}

async fn put_json(app: &Router, uri: &str, body: Value) -> (StatusCode, Value) {
    request_json(app, "PUT", uri, Some(body)).await
}

async fn get_json(app: &Router, uri: &str) -> (StatusCode, Value) {
    request_json(app, "GET", uri, None).await
}

async fn insert_user(pool: &PgPool, phone: &str, role: &str, name: &str, credit: i32) -> String {
    sqlx::query_scalar(
        r#"
        INSERT INTO users (phone, password, role, name, username, status, credit_score)
        VALUES ($1, 'hashed-secret', $2, $3, $3, 'active', $4)
        RETURNING id
        "#,
    )
    .bind(phone)
    .bind(role)
    .bind(name)
    .bind(credit)
    .fetch_one(pool)
    .await
    .expect("user should be inserted")
}

async fn insert_vehicle(pool: &PgPool, owner_id: &str, plate: &str) -> String {
    sqlx::query_scalar(
        r#"
        INSERT INTO vehicles (owner_id, vehicle_type, license_plate, status, trip_status)
        VALUES ($1, '冷链车', $2, 'active', 'in_transit')
        RETURNING id
        "#,
    )
    .bind(owner_id)
    .bind(plate)
    .fetch_one(pool)
    .await
    .expect("vehicle should be inserted")
}

async fn insert_order(
    pool: &PgPool,
    merchant_id: &str,
    owner_id: &str,
    vehicle_id: &str,
    status: &str,
    merchant_confirmed: bool,
    cargo_name: &str,
) -> (String, String) {
    let demand_id: String = sqlx::query_scalar(
        r#"
        INSERT INTO demands (
            merchant_id, owner_id, cargo_name, cargo_type, weight, volume,
            pickup_time, pickup_address, delivery_address,
            pickup_location, delivery_location, status
        )
        VALUES (
            $1, $2, $3, 'fresh', 100, 5,
            '2026-06-01T08:30:00Z', '上海仓', '杭州仓',
            '{"latitude":31.2,"longitude":121.4}'::jsonb,
            '{"latitude":30.2,"longitude":120.1}'::jsonb, $4
        )
        RETURNING id
        "#,
    )
    .bind(merchant_id)
    .bind(owner_id)
    .bind(cargo_name)
    .bind(status)
    .fetch_one(pool)
    .await
    .expect("demand should be inserted");

    let order_id: String = sqlx::query_scalar(
        r#"
        INSERT INTO orders (
            demand_id, vehicle_id, merchant_id, owner_id, status, merchant_confirmed, fare_price
        )
        VALUES ($1, $2, $3, $4, $5, $6, 120)
        RETURNING id
        "#,
    )
    .bind(&demand_id)
    .bind(vehicle_id)
    .bind(merchant_id)
    .bind(owner_id)
    .bind(status)
    .bind(merchant_confirmed)
    .fetch_one(pool)
    .await
    .expect("order should be inserted");

    (order_id, demand_id)
}

#[tokio::test]
async fn cancellation_request_validates_and_deduplicates_pending_requests() {
    let Some(context) = TestContext::new().await else {
        return;
    };

    let merchant_id = insert_user(&context.pool, "13940000001", "merchant", "货主一", 100).await;
    let other_merchant_id =
        insert_user(&context.pool, "13940000002", "merchant", "货主二", 100).await;
    let owner_id = insert_user(&context.pool, "13940000003", "owner", "车主一", 100).await;
    let vehicle_id = insert_vehicle(&context.pool, &owner_id, "沪Q12345").await;
    let (order_id, _demand_id) = insert_order(
        &context.pool,
        &merchant_id,
        &owner_id,
        &vehicle_id,
        "accepted",
        true,
        "鲜奶",
    )
    .await;

    let (missing_status, missing_body) = post_json(
        &context.app,
        "/api/cancellations/request",
        json!({
            "order_id": "missing",
            "merchant_id": merchant_id,
            "reason": "计划变化"
        }),
    )
    .await;
    assert_eq!(missing_status, StatusCode::NOT_FOUND);
    assert_eq!(missing_body["message"], "订单不存在");

    let (forbidden_status, forbidden_body) = post_json(
        &context.app,
        "/api/cancellations/request",
        json!({
            "order_id": order_id,
            "merchant_id": other_merchant_id,
            "reason": "计划变化"
        }),
    )
    .await;
    assert_eq!(forbidden_status, StatusCode::BAD_REQUEST);
    assert_eq!(forbidden_body["message"], "无权操作此订单");

    let vehicle_id = insert_vehicle(&context.pool, &owner_id, "沪Q22222").await;
    let (unconfirmed_order_id, _) = insert_order(
        &context.pool,
        &merchant_id,
        &owner_id,
        &vehicle_id,
        "accepted",
        false,
        "蛋糕",
    )
    .await;
    let (unconfirmed_status, unconfirmed_body) = post_json(
        &context.app,
        "/api/cancellations/request",
        json!({
            "order_id": unconfirmed_order_id,
            "merchant_id": merchant_id,
            "reason": "计划变化"
        }),
    )
    .await;
    assert_eq!(unconfirmed_status, StatusCode::BAD_REQUEST);
    assert_eq!(
        unconfirmed_body["message"],
        "运费未确认，无需申请取消，可以直接取消"
    );

    let (request_status, request_body) = post_json(
        &context.app,
        "/api/cancellations/request",
        json!({
            "order_id": order_id,
            "merchant_id": merchant_id,
            "reason": "计划变化"
        }),
    )
    .await;
    assert_eq!(request_status, StatusCode::OK);
    assert_eq!(request_body["message"], "取消申请已提交，等待车主处理");
    assert_eq!(request_body["data"]["status"], "pending");
    assert_eq!(request_body["data"]["responder_id"], owner_id);

    let (duplicate_status, duplicate_body) = post_json(
        &context.app,
        "/api/cancellations/request",
        json!({
            "order_id": order_id,
            "merchant_id": merchant_id,
            "reason": "再次取消"
        }),
    )
    .await;
    assert_eq!(duplicate_status, StatusCode::BAD_REQUEST);
    assert_eq!(duplicate_body["message"], "已有待处理的取消申请");

    context.cleanup().await;
}

#[tokio::test]
async fn cancellation_approve_reject_pending_and_credit_score_match_legacy() {
    let Some(context) = TestContext::new().await else {
        return;
    };

    let merchant_id = insert_user(&context.pool, "13940000004", "merchant", "货主三", 5).await;
    let owner_id = insert_user(&context.pool, "13940000005", "owner", "车主二", 100).await;
    let vehicle_id = insert_vehicle(&context.pool, &owner_id, "沪Q33333").await;
    let (order_id, demand_id) = insert_order(
        &context.pool,
        &merchant_id,
        &owner_id,
        &vehicle_id,
        "accepted",
        true,
        "水果",
    )
    .await;
    let request_id: String = sqlx::query_scalar(
        r#"
        INSERT INTO cancellation_requests (
            order_id, requestor_id, responder_id, reason, status
        )
        VALUES ($1, $2, $3, '客户取消', 'pending')
        RETURNING id
        "#,
    )
    .bind(&order_id)
    .bind(&merchant_id)
    .bind(&owner_id)
    .fetch_one(&context.pool)
    .await
    .expect("request should be inserted");

    let (pending_status, pending_body) = get_json(
        &context.app,
        &format!("/api/cancellations/pending?owner_id={owner_id}"),
    )
    .await;
    assert_eq!(pending_status, StatusCode::OK);
    assert_eq!(pending_body["message"], "查询成功");
    assert_eq!(pending_body["data"][0]["id"], request_id);
    assert_eq!(pending_body["data"][0]["orders"]["id"], order_id);
    assert_eq!(pending_body["data"][0]["demands"]["cargo_name"], "水果");

    let (missing_credit_status, missing_credit_body) = get_json(
        &context.app,
        "/api/cancellations/credit-score?user_id=missing",
    )
    .await;
    assert_eq!(missing_credit_status, StatusCode::NOT_FOUND);
    assert_eq!(missing_credit_body["message"], "用户不存在");

    let (credit_status, credit_body) = get_json(
        &context.app,
        &format!("/api/cancellations/credit-score?user_id={merchant_id}"),
    )
    .await;
    assert_eq!(credit_status, StatusCode::OK);
    assert_eq!(credit_body["data"]["credit_score"], 5);

    let (approve_status, approve_body) = put_json(
        &context.app,
        &format!("/api/cancellations/{request_id}/handle"),
        json!({
            "action": "approve",
            "owner_id": owner_id,
            "response_reason": "同意"
        }),
    )
    .await;
    assert_eq!(approve_status, StatusCode::OK);
    assert_eq!(
        approve_body["message"],
        "已同意取消，需求方信用积分已扣除10分"
    );
    assert!(approve_body["data"].is_null());

    let request_status: String =
        sqlx::query_scalar("SELECT status FROM cancellation_requests WHERE id = $1")
            .bind(&request_id)
            .fetch_one(&context.pool)
            .await
            .expect("request status should fetch");
    assert_eq!(request_status, "approved");
    let order_after: (String, Option<String>) =
        sqlx::query_as("SELECT status, cancel_reason FROM orders WHERE id = $1")
            .bind(&order_id)
            .fetch_one(&context.pool)
            .await
            .expect("order should fetch");
    assert_eq!(order_after.0, "cancelled");
    assert_eq!(order_after.1.as_deref(), Some("双方协商取消：客户取消"));
    let demand_after: (String, Option<String>) =
        sqlx::query_as("SELECT status, owner_id FROM demands WHERE id = $1")
            .bind(&demand_id)
            .fetch_one(&context.pool)
            .await
            .expect("demand should fetch");
    assert_eq!(demand_after.0, "pending");
    assert_eq!(demand_after.1, None);
    let vehicle_trip_status: String =
        sqlx::query_scalar("SELECT trip_status FROM vehicles WHERE id = $1")
            .bind(&vehicle_id)
            .fetch_one(&context.pool)
            .await
            .expect("vehicle should fetch");
    assert_eq!(vehicle_trip_status, "idle");
    let credit_after: i32 = sqlx::query_scalar("SELECT credit_score FROM users WHERE id = $1")
        .bind(&merchant_id)
        .fetch_one(&context.pool)
        .await
        .expect("credit score should fetch");
    assert_eq!(credit_after, 0);

    let vehicle_id = insert_vehicle(&context.pool, &owner_id, "沪Q44444").await;
    let (order_id, _demand_id) = insert_order(
        &context.pool,
        &merchant_id,
        &owner_id,
        &vehicle_id,
        "accepted",
        true,
        "鲜花",
    )
    .await;
    let request_id: String = sqlx::query_scalar(
        r#"
        INSERT INTO cancellation_requests (
            order_id, requestor_id, responder_id, reason, status
        )
        VALUES ($1, $2, $3, '临时取消', 'pending')
        RETURNING id
        "#,
    )
    .bind(&order_id)
    .bind(&merchant_id)
    .bind(&owner_id)
    .fetch_one(&context.pool)
    .await
    .expect("request should be inserted");

    let (reject_status, reject_body) = put_json(
        &context.app,
        &format!("/api/cancellations/{request_id}/handle"),
        json!({
            "action": "reject",
            "owner_id": owner_id,
            "response_reason": "已装车"
        }),
    )
    .await;
    assert_eq!(reject_status, StatusCode::OK);
    assert_eq!(reject_body["message"], "已拒绝取消申请");
    assert!(reject_body["data"].is_null());
    let rejected_status: String =
        sqlx::query_scalar("SELECT status FROM cancellation_requests WHERE id = $1")
            .bind(&request_id)
            .fetch_one(&context.pool)
            .await
            .expect("request status should fetch");
    assert_eq!(rejected_status, "rejected");

    context.cleanup().await;
}
