use std::env;

use async_trait::async_trait;
use axum::{
    body::{to_bytes, Body},
    http::{Request, StatusCode},
    Router,
};
use serde_json::{json, Value};
use sqlx::{postgres::PgPoolOptions, PgPool};
use tower::ServiceExt;

use recorouter_api::{
    config::Config,
    error::ApiError,
    storage::{LocalStorage, Storage},
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
        Self::new_with_storage(|config| {
            LocalStorage::new(
                config.local_upload_dir.clone(),
                config.public_base_url.clone(),
            )
        })
        .await
    }

    async fn new_with_storage<S, F>(make_storage: F) -> Option<Self>
    where
        S: Storage + Send + Sync + 'static,
        F: FnOnce(&Config) -> S,
    {
        let Ok(database_url) = env::var("TEST_DATABASE_URL") else {
            eprintln!("skipping order endpoint test because TEST_DATABASE_URL is not set");
            return None;
        };

        let admin_database_url = rewrite_database_url(&database_url, "postgres");
        let admin_pool = PgPoolOptions::new()
            .max_connections(1)
            .connect(&admin_database_url)
            .await
            .expect("admin test database should be reachable");
        let database_name = format!("recorouter_order_test_{}", uuid::Uuid::new_v4().simple());
        sqlx::query(&format!(r#"CREATE DATABASE "{database_name}""#))
            .execute(&admin_pool)
            .await
            .expect("disposable order test database should be created");

        let database_url = rewrite_database_url(&database_url, &database_name);
        let pool = PgPoolOptions::new()
            .max_connections(5)
            .connect(&database_url)
            .await
            .expect("disposable order test database should be reachable");

        recorouter_api::db::run_migrations(&pool)
            .await
            .expect("order test migrations should run");

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
        let storage = make_storage(&config);
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
            .expect("disposable order test database should be dropped");

        admin_pool.close().await;
    }
}

#[derive(Clone)]
struct FailingUrlStorage;

#[async_trait]
impl Storage for FailingUrlStorage {
    async fn put(
        &self,
        _bytes: Vec<u8>,
        _file_name: &str,
        _content_type: Option<&str>,
    ) -> Result<String, ApiError> {
        Ok("unused/key.png".to_string())
    }

    async fn public_url(&self, _key: &str) -> Result<String, ApiError> {
        Err(ApiError::Storage("signing failed".to_string()))
    }

    async fn public_url_with_expiry(
        &self,
        _key: &str,
        _expire_time_seconds: i64,
    ) -> Result<String, ApiError> {
        Err(ApiError::Storage("signing failed".to_string()))
    }

    async fn exists(&self, _key: &str) -> Result<bool, ApiError> {
        Ok(false)
    }

    async fn delete(&self, _key: &str) -> Result<bool, ApiError> {
        Ok(false)
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

async fn insert_vehicle(pool: &PgPool, owner_id: &str, plate: &str) -> String {
    sqlx::query_scalar(
        r#"
        INSERT INTO vehicles (
            owner_id, vehicle_type, license_plate, status, trip_status,
            load_capacity, volume, battery_life
        )
        VALUES ($1, '冷链车', $2, 'active', 'idle', 1000, 20, 300)
        RETURNING id
        "#,
    )
    .bind(owner_id)
    .bind(plate)
    .fetch_one(pool)
    .await
    .expect("vehicle should be inserted")
}

async fn insert_demand(pool: &PgPool, merchant_id: &str, cargo_name: &str) -> String {
    sqlx::query_scalar(
        r#"
        INSERT INTO demands (
            merchant_id, cargo_name, cargo_type, weight, volume,
            pickup_time, pickup_address, delivery_address,
            pickup_location, delivery_location, estimated_distance, estimated_fare, status
        )
        VALUES (
            $1, $2, 'fresh', 200, 12,
            '2026-06-01T08:30:00Z', '上海仓', '杭州仓',
            '{"latitude":31.2,"longitude":121.4}'::jsonb,
            '{"latitude":30.2,"longitude":120.1}'::jsonb,
            8.5, 100, 'pending'
        )
        RETURNING id
        "#,
    )
    .bind(merchant_id)
    .bind(cargo_name)
    .fetch_one(pool)
    .await
    .expect("demand should be inserted")
}

#[tokio::test]
async fn order_static_commission_routes_are_not_captured_by_id_route() {
    let Some(context) = TestContext::new().await else {
        return;
    };

    let (summary_status, summary_body) =
        get_json(&context.app, "/api/orders/commission-summary").await;
    assert_eq!(summary_status, StatusCode::OK);
    assert_eq!(summary_body["message"], "查询成功");
    assert_eq!(summary_body["data"]["summary"]["totalOrders"], 0);
    assert_eq!(
        summary_body["data"]["commissionOrders"]
            .as_array()
            .unwrap()
            .len(),
        0
    );

    let (pending_status, pending_body) =
        get_json(&context.app, "/api/orders/commission-pending").await;
    assert_eq!(pending_status, StatusCode::OK);
    assert_eq!(pending_body["message"], "查询成功");
    assert_eq!(pending_body["data"].as_array().unwrap().len(), 0);

    context.cleanup().await;
}

#[tokio::test]
async fn order_lifecycle_matches_legacy_payment_and_commission_flow() {
    let Some(context) = TestContext::new().await else {
        return;
    };

    sqlx::query(
        r#"
        INSERT INTO platform_settings (id, commission_rate, commission_payment_qr)
        VALUES ('default', 8, 'platform/qr.png')
        ON CONFLICT (id) DO UPDATE
        SET commission_rate = EXCLUDED.commission_rate,
            commission_payment_qr = EXCLUDED.commission_payment_qr
        "#,
    )
    .execute(&context.pool)
    .await
    .expect("platform settings should be inserted");

    let merchant_id = insert_user(&context.pool, "13930000001", "merchant", "货主一").await;
    let owner_id = insert_user(&context.pool, "13930000002", "owner", "车主一").await;
    sqlx::query("UPDATE users SET wechat_payment_qr = 'owner/qr.png' WHERE id = $1")
        .bind(&owner_id)
        .execute(&context.pool)
        .await
        .expect("owner payment qr should be set");
    let vehicle_id = insert_vehicle(&context.pool, &owner_id, "沪O12345").await;
    let demand_id = insert_demand(&context.pool, &merchant_id, "冰鲜肉").await;

    let (create_status, create_body) = post_json(
        &context.app,
        "/api/orders",
        json!({
            "demand_id": demand_id,
            "vehicle_id": vehicle_id,
            "owner_id": owner_id
        }),
    )
    .await;
    assert_eq!(create_status, StatusCode::OK);
    assert_eq!(create_body["message"], "接单成功");
    assert_eq!(create_body["data"]["status"], "accepted");
    assert_eq!(create_body["data"]["merchant_id"], merchant_id);
    let order_id = create_body["data"]["id"].as_str().unwrap().to_string();

    sqlx::query("UPDATE orders SET fare_price = 100 WHERE id = $1")
        .bind(&order_id)
        .execute(&context.pool)
        .await
        .expect("fare should be set for lifecycle");

    let (list_status, list_body) = get_json(
        &context.app,
        &format!("/api/orders?owner_id={owner_id}&merchant_id={merchant_id}&status=accepted"),
    )
    .await;
    assert_eq!(list_status, StatusCode::OK);
    assert_eq!(list_body["message"], "查询成功");
    assert_eq!(list_body["data"][0]["id"], order_id);
    assert_eq!(list_body["data"][0]["demand"]["cargo_name"], "冰鲜肉");
    assert_eq!(list_body["data"][0]["demand"]["pickup_address"], "上海仓");
    assert_eq!(list_body["data"][0]["vehicle"]["vehicle_type"], "冷链车");
    assert_eq!(list_body["data"][0]["vehicle"]["plate_number"], "沪O12345");
    assert_eq!(list_body["data"][0]["vehicle"]["license_plate"], "沪O12345");
    assert_eq!(list_body["data"][0]["owner"]["name"], "车主一");
    assert_eq!(list_body["data"][0]["merchant"]["name"], "货主一");

    let (get_status, get_body) = get_json(&context.app, &format!("/api/orders/{order_id}")).await;
    assert_eq!(get_status, StatusCode::OK);
    assert_eq!(get_body["message"], "查询成功");
    assert_eq!(get_body["data"]["id"], order_id);

    let (confirm_fare_status, confirm_fare_body) = post_json(
        &context.app,
        &format!("/api/orders/{order_id}/confirm-fare"),
        json!({}),
    )
    .await;
    assert_eq!(confirm_fare_status, StatusCode::OK);
    assert_eq!(confirm_fare_body["message"], "运费已确认");
    assert_eq!(confirm_fare_body["data"]["merchant_confirmed"], true);

    let (start_status, start_body) = post_json(
        &context.app,
        &format!("/api/orders/{order_id}/start-transport"),
        json!({}),
    )
    .await;
    assert_eq!(start_status, StatusCode::OK);
    assert_eq!(start_body["message"], "已开始运输");
    assert_eq!(start_body["data"]["status"], "in_transit");

    let (complete_status, complete_body) = put_json(
        &context.app,
        &format!("/api/orders/{order_id}/complete"),
        json!({
            "pickup_photo_key": "orders/pickup.jpg",
            "delivery_photo_key": "orders/delivery.jpg"
        }),
    )
    .await;
    assert_eq!(complete_status, StatusCode::OK);
    assert_eq!(complete_body["message"], "运输已完成，等待需求方付款");
    assert_eq!(complete_body["data"]["status"], "transport_completed");
    assert_eq!(complete_body["data"]["payment_status"], "unpaid");
    assert_eq!(complete_body["data"]["commission_payment_status"], "unpaid");
    assert_eq!(complete_body["data"]["commission_amount"], 8.0);

    let (payment_info_status, payment_info_body) = get_json(
        &context.app,
        &format!("/api/orders/{order_id}/payment-info"),
    )
    .await;
    assert_eq!(payment_info_status, StatusCode::OK);
    assert_eq!(payment_info_body["message"], "查询成功");
    assert_eq!(payment_info_body["data"]["orderId"], order_id);
    assert_eq!(payment_info_body["data"]["farePrice"], 100.0);
    assert_eq!(payment_info_body["data"]["commissionAmount"], 8.0);
    assert_eq!(payment_info_body["data"]["ownerName"], "车主一");
    assert_eq!(
        payment_info_body["data"]["paymentQr"],
        "https://car.shcxyz.site/api/uploads/owner/qr.png"
    );

    let (mark_payment_status, mark_payment_body) = put_json(
        &context.app,
        &format!("/api/orders/{order_id}/payment-marked"),
        json!({}),
    )
    .await;
    assert_eq!(mark_payment_status, StatusCode::OK);
    assert_eq!(
        mark_payment_body["message"],
        "已标记为已付款，等待运力方确认"
    );
    assert_eq!(mark_payment_body["data"]["payment_status"], "paid");

    let (confirm_payment_status, confirm_payment_body) = put_json(
        &context.app,
        &format!("/api/orders/{order_id}/payment-confirm"),
        json!({}),
    )
    .await;
    assert_eq!(confirm_payment_status, StatusCode::OK);
    assert_eq!(
        confirm_payment_body["message"],
        "收款已确认，请向平台支付撮合佣金"
    );
    assert_eq!(confirm_payment_body["data"]["status"], "payment_confirmed");

    let (commission_info_status, commission_info_body) = get_json(
        &context.app,
        &format!("/api/orders/{order_id}/commission-info"),
    )
    .await;
    assert_eq!(commission_info_status, StatusCode::OK);
    assert_eq!(commission_info_body["message"], "查询成功");
    assert_eq!(
        commission_info_body["data"]["platformPaymentQr"],
        "https://car.shcxyz.site/api/uploads/platform/qr.png"
    );
    assert_eq!(
        commission_info_body["data"]["commissionPaymentStatus"],
        "unpaid"
    );

    let (mark_commission_status, mark_commission_body) = put_json(
        &context.app,
        &format!("/api/orders/{order_id}/commission-payment-marked"),
        json!({ "payment_proof": "proof/key.png" }),
    )
    .await;
    assert_eq!(mark_commission_status, StatusCode::OK);
    assert_eq!(
        mark_commission_body["message"],
        "已提交佣金支付，等待平台审核"
    );
    assert_eq!(mark_commission_body["data"]["status"], "commission_pending");
    assert_eq!(
        mark_commission_body["data"]["commission_payment_status"],
        "paid"
    );

    let (pending_status, pending_body) =
        get_json(&context.app, "/api/orders/commission-pending").await;
    assert_eq!(pending_status, StatusCode::OK);
    assert_eq!(pending_body["data"][0]["id"], order_id);
    assert_eq!(pending_body["data"][0]["cargoName"], "冰鲜肉");
    assert_eq!(pending_body["data"][0]["ownerName"], "车主一");

    let (summary_status, summary_body) =
        get_json(&context.app, "/api/orders/commission-summary").await;
    assert_eq!(summary_status, StatusCode::OK);
    assert_eq!(summary_body["data"]["summary"]["totalCommission"], 8.0);
    assert_eq!(summary_body["data"]["summary"]["pendingCommission"], 8.0);
    assert_eq!(summary_body["data"]["summary"]["confirmedCommission"], 0.0);
    assert_eq!(summary_body["data"]["commissionOrders"][0]["id"], order_id);

    sqlx::query("UPDATE vehicles SET trip_status = 'in_transit' WHERE id = $1")
        .bind(&vehicle_id)
        .execute(&context.pool)
        .await
        .expect("vehicle should be marked busy before final confirmation");

    let (confirm_commission_status, confirm_commission_body) = put_json(
        &context.app,
        &format!("/api/orders/{order_id}/commission-confirm"),
        json!({}),
    )
    .await;
    assert_eq!(confirm_commission_status, StatusCode::OK);
    assert_eq!(confirm_commission_body["message"], "佣金已确认，订单完成");
    assert_eq!(confirm_commission_body["data"]["status"], "completed");

    let vehicle_trip_status: String =
        sqlx::query_scalar("SELECT trip_status FROM vehicles WHERE id = $1")
            .bind(&vehicle_id)
            .fetch_one(&context.pool)
            .await
            .expect("vehicle trip status should fetch");
    assert_eq!(vehicle_trip_status, "idle");
    let owner_credit: i32 = sqlx::query_scalar("SELECT credit_score FROM users WHERE id = $1")
        .bind(&owner_id)
        .fetch_one(&context.pool)
        .await
        .expect("owner credit should fetch");
    let merchant_credit: i32 = sqlx::query_scalar("SELECT credit_score FROM users WHERE id = $1")
        .bind(&merchant_id)
        .fetch_one(&context.pool)
        .await
        .expect("merchant credit should fetch");
    assert_eq!(owner_credit, 102);
    assert_eq!(merchant_credit, 102);

    let (revenue_status, revenue_body) = get_json(
        &context.app,
        &format!("/api/orders/owner-revenue/{owner_id}"),
    )
    .await;
    assert_eq!(revenue_status, StatusCode::OK);
    assert_eq!(revenue_body["message"], "查询成功");
    assert_eq!(revenue_body["data"]["summary"]["totalFare"], 100.0);
    assert_eq!(revenue_body["data"]["summary"]["totalCommission"], 8.0);
    assert_eq!(revenue_body["data"]["summary"]["netRevenue"], 92.0);
    assert_eq!(revenue_body["data"]["revenueList"][0]["id"], order_id);

    context.cleanup().await;
}

#[tokio::test]
async fn zero_commission_order_completes_when_owner_confirms_payment() {
    let Some(context) = TestContext::new().await else {
        return;
    };

    sqlx::query(
        r#"
        INSERT INTO platform_settings (id, commission_rate, commission_payment_qr)
        VALUES ('default', 0, 'platform/qr.png')
        ON CONFLICT (id) DO UPDATE
        SET commission_rate = EXCLUDED.commission_rate,
            commission_payment_qr = EXCLUDED.commission_payment_qr
        "#,
    )
    .execute(&context.pool)
    .await
    .expect("platform zero commission should be inserted");

    let merchant_id = insert_user(&context.pool, "13930000013", "merchant", "零佣货主").await;
    let owner_id = insert_user(&context.pool, "13930000014", "owner", "零佣车主").await;
    let vehicle_id = insert_vehicle(&context.pool, &owner_id, "沪O00001").await;
    let demand_id = insert_demand(&context.pool, &merchant_id, "零佣货").await;

    let (create_status, create_body) = post_json(
        &context.app,
        "/api/orders",
        json!({
            "demand_id": demand_id,
            "vehicle_id": vehicle_id,
            "owner_id": owner_id
        }),
    )
    .await;
    assert_eq!(create_status, StatusCode::OK);
    let order_id = create_body["data"]["id"].as_str().unwrap().to_string();

    sqlx::query("UPDATE orders SET fare_price = 200 WHERE id = $1")
        .bind(&order_id)
        .execute(&context.pool)
        .await
        .expect("fare should be set for zero commission flow");

    let (confirm_fare_status, _) = post_json(
        &context.app,
        &format!("/api/orders/{order_id}/confirm-fare"),
        json!({}),
    )
    .await;
    assert_eq!(confirm_fare_status, StatusCode::OK);

    let (start_status, _) = post_json(
        &context.app,
        &format!("/api/orders/{order_id}/start-transport"),
        json!({}),
    )
    .await;
    assert_eq!(start_status, StatusCode::OK);

    let (complete_status, complete_body) = put_json(
        &context.app,
        &format!("/api/orders/{order_id}/complete"),
        json!({}),
    )
    .await;
    assert_eq!(complete_status, StatusCode::OK);
    assert_eq!(complete_body["data"]["commission_amount"], 0.0);
    assert_eq!(
        complete_body["data"]["commission_payment_status"],
        "not_required"
    );

    let (mark_payment_status, _) = put_json(
        &context.app,
        &format!("/api/orders/{order_id}/payment-marked"),
        json!({}),
    )
    .await;
    assert_eq!(mark_payment_status, StatusCode::OK);

    let (confirm_payment_status, confirm_payment_body) = put_json(
        &context.app,
        &format!("/api/orders/{order_id}/payment-confirm"),
        json!({}),
    )
    .await;
    assert_eq!(confirm_payment_status, StatusCode::OK);
    assert_eq!(confirm_payment_body["message"], "收款已确认，订单已完成");
    assert_eq!(confirm_payment_body["data"]["status"], "completed");
    assert_eq!(
        confirm_payment_body["data"]["commission_payment_status"],
        "not_required"
    );

    let vehicle_trip_status: String =
        sqlx::query_scalar("SELECT trip_status FROM vehicles WHERE id = $1")
            .bind(&vehicle_id)
            .fetch_one(&context.pool)
            .await
            .expect("vehicle trip status should fetch");
    assert_eq!(vehicle_trip_status, "idle");

    let (pending_status, pending_body) =
        get_json(&context.app, "/api/orders/commission-pending").await;
    assert_eq!(pending_status, StatusCode::OK);
    assert_eq!(pending_body["data"].as_array().unwrap().len(), 0);

    context.cleanup().await;
}

#[tokio::test]
async fn order_optional_bodies_and_empty_photo_keys_match_legacy() {
    let Some(context) = TestContext::new().await else {
        return;
    };

    let merchant_id = insert_user(&context.pool, "13930000005", "merchant", "货主三").await;
    let owner_id = insert_user(&context.pool, "13930000006", "owner", "车主三").await;
    let vehicle_id = insert_vehicle(&context.pool, &owner_id, "沪O13579").await;
    let demand_id = insert_demand(&context.pool, &merchant_id, "生鲜").await;

    let order_id: String = sqlx::query_scalar(
        r#"
        INSERT INTO orders (
            demand_id, vehicle_id, merchant_id, owner_id, status,
            merchant_confirmed, fare_price, pickup_photo_key, delivery_photo_key
        )
        VALUES ($1, $2, $3, $4, 'in_transit', true, 100, 'orders/old-pickup.jpg', 'orders/old-delivery.jpg')
        RETURNING id
        "#,
    )
    .bind(&demand_id)
    .bind(&vehicle_id)
    .bind(&merchant_id)
    .bind(&owner_id)
    .fetch_one(&context.pool)
    .await
    .expect("order should be inserted");

    let (complete_without_body_status, complete_without_body_body) = request_json(
        &context.app,
        "PUT",
        &format!("/api/orders/{order_id}/complete"),
        None,
    )
    .await;
    assert_eq!(complete_without_body_status, StatusCode::OK);
    assert_eq!(
        complete_without_body_body["message"],
        "运输已完成，等待需求方付款"
    );
    assert_eq!(
        complete_without_body_body["data"]["pickup_photo_key"],
        "orders/old-pickup.jpg"
    );
    assert_eq!(
        complete_without_body_body["data"]["delivery_photo_key"],
        "orders/old-delivery.jpg"
    );

    let vehicle_id = insert_vehicle(&context.pool, &owner_id, "沪O24680").await;
    let demand_id = insert_demand(&context.pool, &merchant_id, "鲜蔬").await;
    let order_id: String = sqlx::query_scalar(
        r#"
        INSERT INTO orders (
            demand_id, vehicle_id, merchant_id, owner_id, status,
            merchant_confirmed, fare_price, pickup_photo_key, delivery_photo_key
        )
        VALUES ($1, $2, $3, $4, 'in_transit', true, 100, 'orders/keep-pickup.jpg', 'orders/keep-delivery.jpg')
        RETURNING id
        "#,
    )
    .bind(&demand_id)
    .bind(&vehicle_id)
    .bind(&merchant_id)
    .bind(&owner_id)
    .fetch_one(&context.pool)
    .await
    .expect("order should be inserted");

    let (empty_photo_status, empty_photo_body) = put_json(
        &context.app,
        &format!("/api/orders/{order_id}/complete"),
        json!({
            "pickup_photo_key": "",
            "delivery_photo_key": ""
        }),
    )
    .await;
    assert_eq!(empty_photo_status, StatusCode::OK);
    assert_eq!(
        empty_photo_body["data"]["pickup_photo_key"],
        "orders/keep-pickup.jpg"
    );
    assert_eq!(
        empty_photo_body["data"]["delivery_photo_key"],
        "orders/keep-delivery.jpg"
    );

    let vehicle_id = insert_vehicle(&context.pool, &owner_id, "沪O11223").await;
    let demand_id = insert_demand(&context.pool, &merchant_id, "药品").await;
    let order_id: String = sqlx::query_scalar(
        r#"
        INSERT INTO orders (
            demand_id, vehicle_id, merchant_id, owner_id, status,
            fare_price, commission_amount, commission_payment_status
        )
        VALUES ($1, $2, $3, $4, 'payment_confirmed', 100, 8, 'unpaid')
        RETURNING id
        "#,
    )
    .bind(&demand_id)
    .bind(&vehicle_id)
    .bind(&merchant_id)
    .bind(&owner_id)
    .fetch_one(&context.pool)
    .await
    .expect("order should be inserted");

    let (commission_without_body_status, commission_without_body_body) = request_json(
        &context.app,
        "PUT",
        &format!("/api/orders/{order_id}/commission-payment-marked"),
        None,
    )
    .await;
    assert_eq!(commission_without_body_status, StatusCode::OK);
    assert_eq!(
        commission_without_body_body["message"],
        "已提交佣金支付，等待平台审核"
    );
    assert_eq!(
        commission_without_body_body["data"]["commission_payment_status"],
        "paid"
    );

    context.cleanup().await;
}

#[tokio::test]
async fn order_info_routes_return_null_qr_when_signing_fails() {
    let Some(context) = TestContext::new_with_storage(|_| FailingUrlStorage).await else {
        return;
    };

    sqlx::query(
        r#"
        INSERT INTO platform_settings (id, commission_rate, commission_payment_qr)
        VALUES ('default', 8, 'platform/qr.png')
        ON CONFLICT (id) DO UPDATE
        SET commission_rate = EXCLUDED.commission_rate,
            commission_payment_qr = EXCLUDED.commission_payment_qr
        "#,
    )
    .execute(&context.pool)
    .await
    .expect("platform settings should be inserted");

    let merchant_id = insert_user(&context.pool, "13930000007", "merchant", "货主四").await;
    let owner_id = insert_user(&context.pool, "13930000008", "owner", "车主四").await;
    sqlx::query("UPDATE users SET wechat_payment_qr = 'owner/qr.png' WHERE id = $1")
        .bind(&owner_id)
        .execute(&context.pool)
        .await
        .expect("owner payment qr should be set");
    let vehicle_id = insert_vehicle(&context.pool, &owner_id, "沪O33445").await;
    let demand_id = insert_demand(&context.pool, &merchant_id, "器械").await;
    let order_id: String = sqlx::query_scalar(
        r#"
        INSERT INTO orders (
            demand_id, vehicle_id, merchant_id, owner_id, status,
            fare_price, commission_amount, payment_status, commission_payment_status
        )
        VALUES ($1, $2, $3, $4, 'payment_confirmed', 100, 8, 'paid', 'unpaid')
        RETURNING id
        "#,
    )
    .bind(&demand_id)
    .bind(&vehicle_id)
    .bind(&merchant_id)
    .bind(&owner_id)
    .fetch_one(&context.pool)
    .await
    .expect("order should be inserted");

    let (payment_status, payment_body) = get_json(
        &context.app,
        &format!("/api/orders/{order_id}/payment-info"),
    )
    .await;
    assert_eq!(payment_status, StatusCode::OK);
    assert_eq!(payment_body["message"], "查询成功");
    assert!(payment_body["data"]["paymentQr"].is_null());

    let (commission_status, commission_body) = get_json(
        &context.app,
        &format!("/api/orders/{order_id}/commission-info"),
    )
    .await;
    assert_eq!(commission_status, StatusCode::OK);
    assert_eq!(commission_body["message"], "查询成功");
    assert!(commission_body["data"]["platformPaymentQr"].is_null());

    context.cleanup().await;
}

#[tokio::test]
async fn order_cancel_paths_restore_demand_and_vehicle_before_fare_confirmation() {
    let Some(context) = TestContext::new().await else {
        return;
    };

    let merchant_id = insert_user(&context.pool, "13930000003", "merchant", "货主二").await;
    let owner_id = insert_user(&context.pool, "13930000004", "owner", "车主二").await;
    let vehicle_id = insert_vehicle(&context.pool, &owner_id, "沪O54321").await;
    let demand_id = insert_demand(&context.pool, &merchant_id, "蛋糕").await;

    let (create_status, create_body) = post_json(
        &context.app,
        "/api/orders",
        json!({
            "demand_id": demand_id,
            "vehicle_id": vehicle_id,
            "owner_id": owner_id
        }),
    )
    .await;
    assert_eq!(create_status, StatusCode::OK);
    let order_id = create_body["data"]["id"].as_str().unwrap().to_string();
    sqlx::query("UPDATE demands SET owner_id = $2 WHERE id = $1")
        .bind(&demand_id)
        .bind(&owner_id)
        .execute(&context.pool)
        .await
        .expect("owner should be set on demand");
    sqlx::query("UPDATE vehicles SET trip_status = 'in_transit' WHERE id = $1")
        .bind(&vehicle_id)
        .execute(&context.pool)
        .await
        .expect("vehicle should be marked busy");

    let (cancel_status, cancel_body) = post_json(
        &context.app,
        &format!("/api/orders/{order_id}/cancel"),
        json!({
            "merchant_id": merchant_id,
            "reason": "临时取消"
        }),
    )
    .await;
    assert_eq!(cancel_status, StatusCode::OK);
    assert_eq!(cancel_body["message"], "订单已取消，需求已恢复待接单状态");
    assert_eq!(cancel_body["data"]["status"], "cancelled");
    assert_eq!(cancel_body["data"]["cancel_reason"], "临时取消");

    let demand_after_cancel: (String, Option<String>) =
        sqlx::query_as("SELECT status, owner_id FROM demands WHERE id = $1")
            .bind(&demand_id)
            .fetch_one(&context.pool)
            .await
            .expect("demand should fetch after cancel");
    assert_eq!(demand_after_cancel.0, "pending");
    assert_eq!(demand_after_cancel.1, None);
    let vehicle_after_cancel: String =
        sqlx::query_scalar("SELECT trip_status FROM vehicles WHERE id = $1")
            .bind(&vehicle_id)
            .fetch_one(&context.pool)
            .await
            .expect("vehicle should fetch after cancel");
    assert_eq!(vehicle_after_cancel, "idle");

    let vehicle_id = insert_vehicle(&context.pool, &owner_id, "沪O67890").await;
    let demand_id = insert_demand(&context.pool, &merchant_id, "鲜花").await;
    let order_id: String = sqlx::query_scalar(
        r#"
        INSERT INTO orders (
            demand_id, vehicle_id, merchant_id, owner_id, status, merchant_confirmed
        )
        VALUES ($1, $2, $3, $4, 'accepted', false)
        RETURNING id
        "#,
    )
    .bind(&demand_id)
    .bind(&vehicle_id)
    .bind(&merchant_id)
    .bind(&owner_id)
    .fetch_one(&context.pool)
    .await
    .expect("order should be inserted");
    sqlx::query("UPDATE demands SET status = 'accepted', owner_id = $2 WHERE id = $1")
        .bind(&demand_id)
        .bind(&owner_id)
        .execute(&context.pool)
        .await
        .expect("demand should be accepted");
    sqlx::query("UPDATE vehicles SET trip_status = 'in_transit' WHERE id = $1")
        .bind(&vehicle_id)
        .execute(&context.pool)
        .await
        .expect("vehicle should be busy");

    let (owner_cancel_status, owner_cancel_body) = post_json(
        &context.app,
        &format!("/api/orders/{order_id}/owner-cancel"),
        json!({
            "owner_id": owner_id,
            "reason": "车辆故障"
        }),
    )
    .await;
    assert_eq!(owner_cancel_status, StatusCode::OK);
    assert_eq!(
        owner_cancel_body["message"],
        "订单已取消，需求已恢复待接单状态"
    );
    assert_eq!(owner_cancel_body["data"]["status"], "cancelled");
    assert_eq!(owner_cancel_body["data"]["cancel_reason"], "车辆故障");

    context.cleanup().await;
}
