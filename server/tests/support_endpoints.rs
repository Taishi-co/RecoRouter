use std::env;

use axum::{
    body::{to_bytes, Body},
    http::{Request, StatusCode},
    Router,
};
use serde_json::{json, Value};
use sqlx::{postgres::PgPoolOptions, PgPool};
use tower::ServiceExt;

use recorouter_api::storage::LocalStorage;

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
            eprintln!("skipping support endpoint test because TEST_DATABASE_URL is not set");
            return None;
        };

        let admin_database_url = rewrite_database_url(&database_url, "postgres");
        let admin_pool = PgPoolOptions::new()
            .max_connections(1)
            .connect(&admin_database_url)
            .await
            .expect("admin test database should be reachable");
        let database_name = format!("recorouter_support_test_{}", uuid::Uuid::new_v4().simple());
        sqlx::query(&format!(r#"CREATE DATABASE "{database_name}""#))
            .execute(&admin_pool)
            .await
            .expect("disposable support test database should be created");

        let database_url = rewrite_database_url(&database_url, &database_name);
        let pool = PgPoolOptions::new()
            .max_connections(5)
            .connect(&database_url)
            .await
            .expect("disposable support test database should be reachable");

        recorouter_api::db::run_migrations(&pool)
            .await
            .expect("support test migrations should run");

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
            .expect("disposable support test database should be dropped");

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

async fn post_json(app: &Router, uri: &str, body: Value) -> (StatusCode, Value) {
    request_json(app, "POST", uri, Some(body)).await
}

async fn put_json(app: &Router, uri: &str, body: Value) -> (StatusCode, Value) {
    request_json(app, "PUT", uri, Some(body)).await
}

async fn get_json(app: &Router, uri: &str) -> (StatusCode, Value) {
    request_json(app, "GET", uri, None).await
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
        INSERT INTO users (phone, password, role, name, username, status)
        VALUES ($1, 'hashed-secret', $2, $3, $3, 'active')
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

#[tokio::test]
async fn fare_calculation_matches_legacy_math_and_validation_messages() {
    let Some(context) = TestContext::new().await else {
        return;
    };
    let owner_id = insert_user(&context.pool, "13910000001", "owner", "车主一").await;
    let vehicle_id: String = sqlx::query_scalar(
        r#"
        INSERT INTO vehicles (
            owner_id, vehicle_type, license_plate, status,
            base_price, base_distance, price_per_km
        )
        VALUES ($1, '冷链车', '沪A12345', 'active', 30, 3, 3)
        RETURNING id
        "#,
    )
    .bind(&owner_id)
    .fetch_one(&context.pool)
    .await
    .expect("vehicle should be inserted");

    let (status, body) = post_json(
        &context.app,
        "/api/fare/calculate",
        json!({
            "vehicle_id": vehicle_id,
            "total_distance": 8.5
        }),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["code"], 200);
    assert_eq!(body["message"], "计算成功");
    assert_eq!(body["data"]["vehicle_type"], "冷链车");
    assert_eq!(body["data"]["extra_distance"], 5.5);
    assert_eq!(body["data"]["extra_fare"], 16.5);
    assert_eq!(body["data"]["total_fare"], 46.5);
    assert_eq!(body["data"]["route_type"], "non_highway");
    assert_eq!(body["data"]["is_estimate"], false);
    assert_eq!(body["data"]["calculation_detail"]["total_fare"], 46.5);

    let (missing_status, missing_body) = post_json(
        &context.app,
        "/api/fare/calculate",
        json!({
            "vehicle_id": "missing-vehicle",
            "total_distance": 8.5
        }),
    )
    .await;
    assert_eq!(missing_status, StatusCode::BAD_REQUEST);
    assert_eq!(missing_body["message"], "车辆不存在或定价信息不完整");

    let (range_status, range_body) = post_json(
        &context.app,
        "/api/fare/calculate-multiple",
        json!({
            "vehicle_ids": [body["data"]["vehicle_id"].as_str().unwrap()],
            "pickup_lat": 31.2304,
            "pickup_lng": 121.4737,
            "delivery_lat": 30.2741,
            "delivery_lng": 120.1551
        }),
    )
    .await;
    assert_eq!(range_status, StatusCode::OK);
    assert_eq!(range_body["message"], "计算成功");
    assert_eq!(range_body["data"]["vehicles"].as_array().unwrap().len(), 1);
    assert_eq!(range_body["data"]["route_info"]["route_type"], "estimated");
    assert_eq!(range_body["data"]["route_info"]["is_estimate"], true);
    assert_eq!(
        range_body["data"]["fare_range"]["min"],
        range_body["data"]["vehicles"][0]["total_fare"]
    );

    let (invalid_status, invalid_body) = post_json(
        &context.app,
        "/api/fare/validate-pricing",
        json!({
            "base_price": 600,
            "base_distance": 0.5,
            "price_per_km": 30
        }),
    )
    .await;
    assert_eq!(invalid_status, StatusCode::OK);
    assert_eq!(invalid_body["message"], "定价参数不合理");
    assert_eq!(invalid_body["data"]["valid"], false);
    assert!(invalid_body["data"]["errors"]
        .as_array()
        .unwrap()
        .contains(&json!("起步价必须在 10-500 元之间")));

    context.cleanup().await;
}

#[tokio::test]
async fn notifications_create_query_count_and_mark_read() {
    let Some(context) = TestContext::new().await else {
        return;
    };
    let user_id = insert_user(&context.pool, "13910000002", "merchant", "货主一").await;

    let (create_status, create_body) = post_json(
        &context.app,
        "/api/notifications",
        json!({
            "userId": user_id,
            "type": "order",
            "title": "订单更新",
            "content": "司机已接单",
            "relatedOrderId": "order-1"
        }),
    )
    .await;
    assert_eq!(create_status, StatusCode::OK);
    assert_eq!(create_body["message"], "通知创建成功");
    assert_eq!(create_body["data"]["is_read"], false);
    assert_eq!(create_body["data"]["related_order_id"], "order-1");
    let notification_id = create_body["data"]["id"].as_str().unwrap();

    let (second_create_status, second_create_body) = post_json(
        &context.app,
        "/api/notifications",
        json!({
            "userId": user_id,
            "type": "payment_received",
            "title": "支付更新",
            "content": "运费已入账",
            "relatedOrderId": "order-2"
        }),
    )
    .await;
    assert_eq!(second_create_status, StatusCode::OK);
    assert_eq!(second_create_body["message"], "通知创建成功");

    let (list_status, list_body) = get_json(
        &context.app,
        &format!("/api/notifications?user_id={user_id}&unread_only=true&page=1&limit=1"),
    )
    .await;
    assert_eq!(list_status, StatusCode::OK);
    assert_eq!(list_body["message"], "查询成功");
    assert_eq!(list_body["data"].as_array().unwrap().len(), 1);

    let (second_page_status, second_page_body) = get_json(
        &context.app,
        &format!("/api/notifications?user_id={user_id}&unread_only=true&page=2&limit=1"),
    )
    .await;
    assert_eq!(second_page_status, StatusCode::OK);
    assert_eq!(second_page_body["data"].as_array().unwrap().len(), 1);

    let (count_status, count_body) = get_json(
        &context.app,
        &format!("/api/notifications/unread-count?user_id={user_id}"),
    )
    .await;
    assert_eq!(count_status, StatusCode::OK);
    assert_eq!(count_body["data"]["unreadCount"], 2);

    let (mark_status, mark_body) = put_json(
        &context.app,
        &format!("/api/notifications/{notification_id}/mark-read"),
        json!({ "user_id": user_id }),
    )
    .await;
    assert_eq!(mark_status, StatusCode::OK);
    assert_eq!(mark_body["message"], "已标记为已读");
    assert_eq!(mark_body["data"]["is_read"], true);

    let (count_after_mark_status, count_after_mark_body) = get_json(
        &context.app,
        &format!("/api/notifications/unread-count?user_id={user_id}"),
    )
    .await;
    assert_eq!(count_after_mark_status, StatusCode::OK);
    assert_eq!(count_after_mark_body["data"]["unreadCount"], 1);

    let (missing_status, missing_body) = put_json(
        &context.app,
        "/api/notifications/missing-notification/mark-read",
        json!({ "user_id": user_id }),
    )
    .await;
    assert_eq!(missing_status, StatusCode::NOT_FOUND);
    assert_eq!(missing_body["message"], "通知不存在");

    let (all_status, all_body) = put_json(
        &context.app,
        "/api/notifications/mark-all-read",
        json!({ "user_id": user_id }),
    )
    .await;
    assert_eq!(all_status, StatusCode::OK);
    assert_eq!(all_body["message"], "已全部标记为已读");
    assert_eq!(all_body["data"], Value::Null);

    context.cleanup().await;
}

#[tokio::test]
async fn admin_endpoints_filter_update_enrich_and_group_statistics() {
    let Some(context) = TestContext::new().await else {
        return;
    };
    let merchant_id = insert_user(&context.pool, "13910000003", "merchant", "货主二").await;
    let owner_id = insert_user(&context.pool, "13910000004", "owner", "车主二").await;
    let vehicle_id: String = sqlx::query_scalar(
        r#"
        INSERT INTO vehicles (owner_id, vehicle_type, license_plate, status)
        VALUES ($1, '厢式货车', '粤B12345', 'active')
        RETURNING id
        "#,
    )
    .bind(&owner_id)
    .fetch_one(&context.pool)
    .await
    .expect("vehicle should be inserted");
    let demand_id: String = sqlx::query_scalar(
        r#"
        INSERT INTO demands (
            merchant_id, cargo_name, cargo_type, weight, volume,
            pickup_address, delivery_address, pickup_time, status
        )
        VALUES (
            $1, '牛奶', '食品', 120, 2.5,
            '上海市浦东新区世纪大道100号', '杭州市上城区解放东路18号',
            now(), 'completed'
        )
        RETURNING id
        "#,
    )
    .bind(&merchant_id)
    .fetch_one(&context.pool)
    .await
    .expect("demand should be inserted");
    sqlx::query(
        r#"
        INSERT INTO orders (
            demand_id, vehicle_id, merchant_id, owner_id, status,
            fare_price, commission_amount, actual_complete_time
        )
        VALUES ($1, $2, $3, $4, 'completed', 188.5, 9.4, now())
        "#,
    )
    .bind(&demand_id)
    .bind(&vehicle_id)
    .bind(&merchant_id)
    .bind(&owner_id)
    .execute(&context.pool)
    .await
    .expect("order should be inserted");

    let (users_status, users_body) =
        get_json(&context.app, "/api/admin/users?role=merchant&status=active").await;
    assert_eq!(users_status, StatusCode::OK);
    assert_eq!(users_body["message"], "查询成功");
    let users = users_body["data"].as_array().unwrap();
    assert_eq!(users.len(), 1);
    assert_eq!(users[0]["id"], merchant_id);
    assert!(users[0].get("password").is_none());

    let (update_status, update_body) = put_json(
        &context.app,
        &format!("/api/admin/users/{merchant_id}/status"),
        json!({ "status": "disabled" }),
    )
    .await;
    assert_eq!(update_status, StatusCode::OK);
    assert_eq!(update_body["message"], "更新成功");
    assert_eq!(update_body["data"]["status"], "disabled");
    assert!(update_body["data"].get("password").is_none());

    let (orders_status, orders_body) =
        get_json(&context.app, "/api/admin/orders?status=completed").await;
    assert_eq!(orders_status, StatusCode::OK);
    assert_eq!(orders_body["message"], "查询成功");
    let order = &orders_body["data"].as_array().unwrap()[0];
    assert_eq!(order["demand"]["cargo_name"], "牛奶");
    assert_eq!(order["vehicle"]["license_plate"], "粤B12345");
    assert_eq!(order["owner"]["phone"], "13910000004");
    assert_eq!(order["merchant"]["phone"], "13910000003");

    let (stats_status, stats_body) = get_json(&context.app, "/api/admin/statistics").await;
    assert_eq!(stats_status, StatusCode::OK);
    assert_eq!(stats_body["data"]["users"]["merchant"], 1);
    assert_eq!(stats_body["data"]["users"]["owner"], 1);
    assert_eq!(stats_body["data"]["users"]["disabled"], 1);
    assert_eq!(stats_body["data"]["orders"]["completed"], 1);
    assert_eq!(stats_body["data"]["vehicles"]["active"], 1);
    assert_eq!(stats_body["data"]["demands"]["completed"], 1);

    context.cleanup().await;
}

#[tokio::test]
async fn home_latest_statistics_and_analyze_cargo_shape() {
    let Some(context) = TestContext::new().await else {
        return;
    };
    let merchant_id = insert_user(&context.pool, "13910000005", "merchant", "货主三").await;
    let owner_id = insert_user(&context.pool, "13910000006", "owner", "车主三").await;
    let vehicle_id: String = sqlx::query_scalar(
        r#"
        INSERT INTO vehicles (owner_id, vehicle_type, license_plate, status, created_at)
        VALUES ($1, '新能源货车', '京C12345', 'active', now())
        RETURNING id
        "#,
    )
    .bind(&owner_id)
    .fetch_one(&context.pool)
    .await
    .expect("vehicle should be inserted");
    let demand_id: String = sqlx::query_scalar(
        r#"
        INSERT INTO demands (
            merchant_id, cargo_name, cargo_type, pickup_address,
            delivery_address, status, created_at
        )
        VALUES (
            $1, '纸箱', '日用品', '北京市朝阳区建国路88号',
            '天津市和平区南京路1号', 'pending', now()
        )
        RETURNING id
        "#,
    )
    .bind(&merchant_id)
    .fetch_one(&context.pool)
    .await
    .expect("demand should be inserted");
    sqlx::query(
        r#"
        INSERT INTO orders (
            demand_id, vehicle_id, merchant_id, owner_id, status,
            fare_price, commission_amount, actual_complete_time
        )
        VALUES ($1, $2, $3, $4, 'completed', 268.0, 13.4, now())
        "#,
    )
    .bind(&demand_id)
    .bind(&vehicle_id)
    .bind(&merchant_id)
    .bind(&owner_id)
    .execute(&context.pool)
    .await
    .expect("order should be inserted");

    let (latest_status, latest_body) = get_json(&context.app, "/api/home/latest-info").await;
    assert_eq!(
        latest_status,
        StatusCode::OK,
        "latest-info response body: {latest_body}"
    );
    assert_eq!(latest_body["message"], "查询成功");
    assert_eq!(
        latest_body["data"]["latestDemands"][0]["pickupAddress"],
        "北京市朝阳区***"
    );
    assert_eq!(
        latest_body["data"]["latestDemands"][0]["merchantPhone"],
        "139****0005"
    );
    assert_eq!(
        latest_body["data"]["availableVehicles"][0]["licensePlate"],
        "京C****"
    );
    assert!(latest_body["data"]["availableVehicles"][0]
        .get("createdAt")
        .is_none());
    assert_eq!(
        latest_body["data"]["completedOrders"][0]["ownerPhone"],
        "139****0006"
    );

    let (stats_status, stats_body) = get_json(&context.app, "/api/home/statistics").await;
    assert_eq!(stats_status, StatusCode::OK);
    assert_eq!(stats_body["data"]["orders"]["completed"], 1);
    assert_eq!(stats_body["data"]["vehicles"]["active"], 1);
    assert_eq!(stats_body["data"]["demands"]["pending"], 1);
    assert_eq!(stats_body["data"]["recentOrders"][0]["cargoName"], "纸箱");
    assert_eq!(stats_body["data"]["recentOrders"][0]["ownerName"], "车主三");

    let (empty_status, empty_body) = post_json(
        &context.app,
        "/api/home/analyze-cargo",
        json!({ "photos": [] }),
    )
    .await;
    assert_eq!(empty_status, StatusCode::BAD_REQUEST);
    assert_eq!(empty_body["message"], "请上传至少一张货品照片");

    let (analyze_status, analyze_body) = post_json(
        &context.app,
        "/api/home/analyze-cargo",
        json!({ "photos": ["https://car.shcxyz.site/photo.jpg"] }),
    )
    .await;
    assert_eq!(analyze_status, StatusCode::OK);
    assert_eq!(analyze_body["message"], "分析成功");
    assert_eq!(analyze_body["data"]["cargo_name"], "");
    assert_eq!(analyze_body["data"]["cargo_type"], "");
    assert_eq!(analyze_body["data"]["weight"], "");
    assert_eq!(analyze_body["data"]["volume"], "");

    context.cleanup().await;
}
