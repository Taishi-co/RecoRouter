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
            eprintln!("skipping demand endpoint test because TEST_DATABASE_URL is not set");
            return None;
        };

        let admin_database_url = rewrite_database_url(&database_url, "postgres");
        let admin_pool = PgPoolOptions::new()
            .max_connections(1)
            .connect(&admin_database_url)
            .await
            .expect("admin test database should be reachable");
        let database_name = format!("recorouter_demand_test_{}", uuid::Uuid::new_v4().simple());
        sqlx::query(&format!(r#"CREATE DATABASE "{database_name}""#))
            .execute(&admin_pool)
            .await
            .expect("disposable demand test database should be created");

        let database_url = rewrite_database_url(&database_url, &database_name);
        let pool = PgPoolOptions::new()
            .max_connections(5)
            .connect(&database_url)
            .await
            .expect("disposable demand test database should be reachable");

        recorouter_api::db::run_migrations(&pool)
            .await
            .expect("demand test migrations should run");

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
            .expect("disposable demand test database should be dropped");

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

fn create_demand_body(merchant_id: &str) -> Value {
    json!({
        "merchant_id": merchant_id,
        "cargo_name": "鲜奶",
        "cargo_type": "fresh",
        "weight": "120.5",
        "volume": "8.25",
        "pickup_time": "2026-06-01T08:30:00Z",
        "pickup_address": "上海市浦东新区世纪大道100号",
        "pickup_location": "{\"latitude\":31.2304,\"longitude\":121.4737}",
        "delivery_address": "杭州市上城区解放东路18号",
        "delivery_location": "{\"latitude\":30.2741,\"longitude\":120.1551}",
        "remarks": "冷链优先",
        "pickup_lat": 31.2304,
        "pickup_lng": 121.4737,
        "delivery_lat": 30.2741,
        "delivery_lng": 120.1551,
        "estimated_distance": 180.5,
        "estimated_fare": 180.5,
        "cargo_photos": ["cargo/a.jpg", "cargo/b.jpg"]
    })
}

#[tokio::test]
async fn demand_list_applies_page_size_pagination_without_changing_array_shape() {
    let Some(context) = TestContext::new().await else {
        return;
    };
    let merchant_id = insert_user(&context.pool, "13920000901", "merchant", "分页货主").await;

    for index in 0..3 {
        sqlx::query(
            r#"
            INSERT INTO demands (
                merchant_id, cargo_name, cargo_type, weight, volume,
                pickup_time, pickup_address, delivery_address,
                pickup_location, delivery_location, status, created_at
            )
            VALUES (
                $1, $2, 'fresh', 100, 5,
                '2026-06-01T08:30:00Z', '上海仓', '杭州仓',
                '{"latitude":31.2,"longitude":121.4}'::jsonb,
                '{"latitude":30.2,"longitude":120.1}'::jsonb,
                'pending', $3::timestamptz
            )
            "#,
        )
        .bind(&merchant_id)
        .bind(format!("分页需求{index}"))
        .bind(format!("2026-06-01T08:3{index}:00Z"))
        .execute(&context.pool)
        .await
        .expect("demand should be inserted");
    }

    let (status, body) = get_json(
        &context.app,
        &format!("/api/demands?merchant_id={merchant_id}&page=2&pageSize=1"),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let data = body["data"]
        .as_array()
        .expect("data should remain an array");
    assert_eq!(data.len(), 1);
    assert_eq!(data[0]["cargo_name"], "分页需求1");

    context.cleanup().await;
}

#[tokio::test]
async fn demand_create_list_get_update_and_cancel_match_legacy_envelopes() {
    let Some(context) = TestContext::new().await else {
        return;
    };
    let merchant_id = insert_user(&context.pool, "13920000001", "merchant", "货主一").await;
    let owner_id = insert_user(&context.pool, "13920000002", "owner", "车主一").await;

    let (role_status, role_body) =
        post_json(&context.app, "/api/demands", create_demand_body(&owner_id)).await;
    assert_eq!(role_status, StatusCode::BAD_REQUEST);
    assert_eq!(role_body["message"], "只有需求方可以发布需求");

    let mut invalid_cargo_type_body = create_demand_body(&merchant_id);
    invalid_cargo_type_body["cargo_type"] = json!("bulk");
    let (invalid_cargo_status, invalid_cargo_body) =
        post_json(&context.app, "/api/demands", invalid_cargo_type_body).await;
    assert_eq!(invalid_cargo_status, StatusCode::BAD_REQUEST);
    assert_eq!(
        invalid_cargo_body["message"],
        "货品类型必须为 normal/fresh/fragile"
    );

    let (create_status, create_body) = post_json(
        &context.app,
        "/api/demands",
        create_demand_body(&merchant_id),
    )
    .await;
    assert_eq!(create_status, StatusCode::OK);
    assert_eq!(create_body["message"], "需求发布成功");
    assert_eq!(create_body["data"]["merchant_id"], merchant_id);
    assert_eq!(create_body["data"]["status"], "pending");
    assert_eq!(create_body["data"]["weight"], 120.5);
    assert_eq!(create_body["data"]["volume"], 8.25);
    assert_eq!(create_body["data"]["route_type"], "non_highway");
    assert_eq!(create_body["data"]["pickup_location"]["latitude"], 31.2304);
    assert_eq!(create_body["data"]["cargo_photos"][1], "cargo/b.jpg");
    let demand_id = create_body["data"]["id"].as_str().unwrap();

    let (list_status, list_body) = get_json(
        &context.app,
        &format!("/api/demands?merchant_id={merchant_id}"),
    )
    .await;
    assert_eq!(list_status, StatusCode::OK);
    assert_eq!(list_body["message"], "查询成功");
    assert_eq!(list_body["data"].as_array().unwrap().len(), 1);
    assert_eq!(list_body["data"][0]["id"], demand_id);

    let (pending_status, pending_body) =
        get_json(&context.app, "/api/demands?status=pending").await;
    assert_eq!(pending_status, StatusCode::OK);
    assert_eq!(pending_body["message"], "查询成功");
    assert!(pending_body["data"]
        .as_array()
        .unwrap()
        .iter()
        .any(|row| row["id"] == demand_id));

    let (get_status, get_body) = get_json(&context.app, &format!("/api/demands/{demand_id}")).await;
    assert_eq!(get_status, StatusCode::OK);
    assert_eq!(get_body["message"], "查询成功");
    assert_eq!(get_body["data"]["cargo_name"], "鲜奶");

    let (update_status, update_body) = put_json(
        &context.app,
        &format!("/api/demands/{demand_id}"),
        json!({
            "cargo_name": "鲜奶-更新",
            "weight": "140.75",
            "cargo_photos": ["cargo/updated.jpg"]
        }),
    )
    .await;
    assert_eq!(update_status, StatusCode::OK);
    assert_eq!(update_body["message"], "更新成功");
    assert_eq!(update_body["data"]["cargo_name"], "鲜奶-更新");
    assert_eq!(update_body["data"]["cargo_type"], "fresh");
    assert_eq!(update_body["data"]["weight"], 140.75);
    assert_eq!(update_body["data"]["volume"], 8.25);
    assert_eq!(
        update_body["data"]["pickup_address"],
        "上海市浦东新区世纪大道100号"
    );
    assert_eq!(update_body["data"]["cargo_photos"][0], "cargo/updated.jpg");

    let (empty_name_status, empty_name_body) = put_json(
        &context.app,
        &format!("/api/demands/{demand_id}"),
        json!({ "cargo_name": "" }),
    )
    .await;
    assert_eq!(empty_name_status, StatusCode::BAD_REQUEST);
    assert_eq!(empty_name_body["message"], "货品名称不能为空");

    let (cancel_status, cancel_body) = post_json(
        &context.app,
        &format!("/api/demands/{demand_id}/cancel"),
        json!({ "reason": "计划取消" }),
    )
    .await;
    assert_eq!(cancel_status, StatusCode::OK);
    assert_eq!(cancel_body["message"], "需求已删除");
    assert_eq!(cancel_body["data"]["id"], demand_id);

    let (missing_status, missing_body) =
        get_json(&context.app, &format!("/api/demands/{demand_id}")).await;
    assert_eq!(missing_status, StatusCode::NOT_FOUND);
    assert_eq!(missing_body["message"], "需求不存在");

    context.cleanup().await;
}

#[tokio::test]
async fn demand_calculate_distance_uses_deterministic_estimate_shape() {
    let Some(context) = TestContext::new().await else {
        return;
    };

    let (missing_status, missing_body) = post_json(
        &context.app,
        "/api/demands/calculate-distance",
        json!({
            "pickup_lat": 31.2304,
            "pickup_lng": 121.4737,
            "delivery_lat": 30.2741
        }),
    )
    .await;
    assert_eq!(missing_status, StatusCode::BAD_REQUEST);
    assert_eq!(missing_body["message"], "请提供完整的经纬度坐标");

    let (status, body) = post_json(
        &context.app,
        "/api/demands/calculate-distance",
        json!({
            "pickup_lat": 31.2304,
            "pickup_lng": 121.4737,
            "delivery_lat": 30.2741,
            "delivery_lng": 120.1551
        }),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["message"], "计算成功（基于估算）");
    assert_eq!(body["data"]["route_type"], "estimated");
    assert_eq!(body["data"]["is_estimate"], true);
    assert_eq!(body["data"]["distance"], body["data"]["estimated_fare"]);
    assert!(body["data"]["distance"].as_f64().unwrap() > 200.0);
    assert!(body["data"]["distance_text"]
        .as_str()
        .unwrap()
        .ends_with("公里"));
    assert!(body["data"]["duration_text"]
        .as_str()
        .unwrap()
        .starts_with("约"));
    assert_eq!(body["data"]["polyline"][0]["latitude"], 31.2304);
    assert_eq!(body["data"]["polyline"][1]["longitude"], 120.1551);

    context.cleanup().await;
}

#[tokio::test]
async fn demand_accept_updates_demand_order_vehicle_and_creates_notification() {
    let Some(context) = TestContext::new().await else {
        return;
    };
    let merchant_id = insert_user(&context.pool, "13920000003", "merchant", "货主二").await;
    let owner_id = insert_user(&context.pool, "13920000004", "owner", "车主二").await;
    let vehicle_id: String = sqlx::query_scalar(
        r#"
        INSERT INTO vehicles (
            owner_id, vehicle_type, license_plate, status, trip_status,
            base_price, base_distance, price_per_km
        )
        VALUES ($1, '冷链车', '沪C12345', 'active', 'idle', 30, 3, 3)
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
            pickup_time, pickup_address, delivery_address,
            pickup_location, delivery_location, estimated_distance, status
        )
        VALUES (
            $1, '冰鲜肉', 'fresh', 200, 12,
            '2026-06-01T08:30:00Z', '上海仓', '杭州仓',
            '{"latitude":31.2,"longitude":121.4}'::jsonb,
            '{"latitude":30.2,"longitude":120.1}'::jsonb,
            8.5, 'pending'
        )
        RETURNING id
        "#,
    )
    .bind(&merchant_id)
    .fetch_one(&context.pool)
    .await
    .expect("demand should be inserted");

    let (status, body) = post_json(
        &context.app,
        &format!("/api/demands/{demand_id}/accept"),
        json!({
            "ownerId": owner_id,
            "vehicleId": vehicle_id,
            "note": "自动计费"
        }),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["message"], "接单成功");
    assert_eq!(body["data"]["demand"]["status"], "accepted");
    assert_eq!(body["data"]["demand"]["owner_id"], owner_id);
    assert_eq!(body["data"]["order"]["demand_id"], demand_id);
    assert_eq!(body["data"]["order"]["vehicle_id"], vehicle_id);
    assert_eq!(body["data"]["order"]["status"], "accepted");
    assert_eq!(body["data"]["order"]["fare_price"], 46.5);
    assert_eq!(body["data"]["order"]["calculated_fare"], 46.5);
    assert_eq!(body["data"]["order"]["is_custom_fare"], false);
    assert_eq!(body["data"]["order"]["merchant_confirmed"], false);
    assert_eq!(
        body["data"]["order"]["fare_calculation_detail"]["total_fare"],
        46.5
    );

    let trip_status: String = sqlx::query_scalar("SELECT trip_status FROM vehicles WHERE id = $1")
        .bind(&vehicle_id)
        .fetch_one(&context.pool)
        .await
        .expect("vehicle trip status should fetch");
    assert_eq!(trip_status, "in_transit");

    let notification_count: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*)
        FROM notifications
        WHERE user_id = $1
          AND type = 'order_accepted'
          AND related_demand_id = $2
          AND related_order_id = $3
        "#,
    )
    .bind(&merchant_id)
    .bind(&demand_id)
    .bind(body["data"]["order"]["id"].as_str().unwrap())
    .fetch_one(&context.pool)
    .await
    .expect("notification count should fetch");
    assert_eq!(notification_count, 1);

    context.cleanup().await;
}

#[tokio::test]
async fn demand_stats_and_save_as_template_match_legacy_shapes() {
    let Some(context) = TestContext::new().await else {
        return;
    };
    let merchant_id = insert_user(&context.pool, "13920000005", "merchant", "货主三").await;
    for (cargo_name, cargo_type, status, weight, volume) in [
        ("日用品", "normal", "completed", 100.0, 5.0),
        ("水果", "fresh", "pending", 80.0, 4.0),
        ("玻璃", "fragile", "accepted", 60.0, 3.0),
    ] {
        sqlx::query(
            r#"
            INSERT INTO demands (
                merchant_id, cargo_name, cargo_type, weight, volume,
                pickup_time, pickup_address, delivery_address,
                pickup_location, delivery_location,
                pickup_lat, pickup_lng, delivery_lat, delivery_lng,
                estimated_distance, estimated_fare, status
            )
            VALUES (
                $1, $2, $3, $4, $5,
                '2026-06-01T08:30:00Z', '上海仓', '杭州仓',
                '{"latitude":31.2,"longitude":121.4}'::jsonb,
                '{"latitude":30.2,"longitude":120.1}'::jsonb,
                31.2, 121.4, 30.2, 120.1,
                12.5, 12.5, $6
            )
            "#,
        )
        .bind(&merchant_id)
        .bind(cargo_name)
        .bind(cargo_type)
        .bind(weight)
        .bind(volume)
        .bind(status)
        .execute(&context.pool)
        .await
        .expect("demand should be inserted");
    }

    let (stats_status, stats_body) = get_json(
        &context.app,
        &format!("/api/demands/stats/merchant?merchant_id={merchant_id}"),
    )
    .await;
    assert_eq!(stats_status, StatusCode::OK);
    assert_eq!(stats_body["message"], "查询成功");
    assert_eq!(stats_body["data"]["total_demands"], 3);
    assert_eq!(stats_body["data"]["status_counts"]["pending"], 1);
    assert_eq!(stats_body["data"]["status_counts"]["accepted"], 1);
    assert_eq!(stats_body["data"]["status_counts"]["completed"], 1);
    assert_eq!(stats_body["data"]["status_counts"]["cancelled"], 0);
    assert_eq!(stats_body["data"]["cargo_type_counts"]["normal"], 1);
    assert_eq!(stats_body["data"]["cargo_type_counts"]["fresh"], 1);
    assert_eq!(stats_body["data"]["cargo_type_counts"]["fragile"], 1);
    assert_eq!(stats_body["data"]["total_weight"], 100.0);
    assert_eq!(stats_body["data"]["total_volume"], 5.0);
    assert_eq!(
        stats_body["data"]["recent_demands"]
            .as_array()
            .unwrap()
            .len(),
        3
    );

    let demand_id = stats_body["data"]["recent_demands"][0]["id"]
        .as_str()
        .unwrap();
    let (template_status, template_body) = post_json(
        &context.app,
        &format!("/api/demands/{demand_id}/save-as-template"),
        json!({ "template_name": "常用线路" }),
    )
    .await;
    assert_eq!(template_status, StatusCode::OK);
    assert_eq!(template_body["message"], "模板创建成功");
    assert_eq!(template_body["data"]["user_id"], merchant_id);
    assert_eq!(template_body["data"]["template_name"], "常用线路");
    assert_eq!(template_body["data"]["pickup_lat"], 31.2);
    assert_eq!(template_body["data"]["delivery_lng"], 120.1);
    assert_eq!(template_body["data"]["is_default"], false);

    context.cleanup().await;
}
