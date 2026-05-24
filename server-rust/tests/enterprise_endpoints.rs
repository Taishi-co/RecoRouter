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
            eprintln!("skipping enterprise endpoint test because TEST_DATABASE_URL is not set");
            return None;
        };
        let admin_database_url = rewrite_database_url(&database_url, "postgres");
        let admin_pool = PgPoolOptions::new()
            .max_connections(1)
            .connect(&admin_database_url)
            .await
            .expect("admin test database should be reachable");
        let database_name = format!(
            "recorouter_enterprise_test_{}",
            uuid::Uuid::new_v4().simple()
        );
        sqlx::query(&format!(r#"CREATE DATABASE "{database_name}""#))
            .execute(&admin_pool)
            .await
            .expect("disposable enterprise test database should be created");

        let database_url = rewrite_database_url(&database_url, &database_name);
        let pool = PgPoolOptions::new()
            .max_connections(5)
            .connect(&database_url)
            .await
            .expect("disposable enterprise test database should be reachable");
        recorouter_api::db::run_migrations(&pool)
            .await
            .expect("enterprise test migrations should run");

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
            .expect("disposable enterprise test database should be dropped");
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

async fn delete_json(app: &Router, uri: &str) -> (StatusCode, Value) {
    request_json(app, "DELETE", uri, None).await
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
async fn enterprise_station_and_enterprise_vehicle_routes_match_legacy_shapes() {
    let Some(context) = TestContext::new().await else {
        return;
    };
    let admin_id = insert_user(&context.pool, "13950000001", "enterprise", "企业管理员").await;

    let (create_status, create_body) = post_json(
        &context.app,
        "/api/enterprise",
        json!({
            "name": "唐山乳业",
            "type": "dairy",
            "adminId": admin_id
        }),
    )
    .await;
    assert_eq!(create_status, StatusCode::OK);
    assert_eq!(create_body["message"], "success");
    let enterprise_id = create_body["data"]["id"].as_str().unwrap().to_string();

    let (admin_status, admin_body) =
        get_json(&context.app, &format!("/api/enterprise/admin/{admin_id}")).await;
    assert_eq!(admin_status, StatusCode::OK);
    assert_eq!(admin_body["data"]["id"], enterprise_id);

    let (update_status, update_body) = put_json(
        &context.app,
        &format!("/api/enterprise/{enterprise_id}"),
        json!({ "name": "唐山乳业集团", "status": "active" }),
    )
    .await;
    assert_eq!(update_status, StatusCode::OK);
    assert_eq!(update_body["data"]["name"], "唐山乳业集团");

    let (station_status, station_body) = post_json(
        &context.app,
        "/api/station",
        json!({
            "enterpriseId": enterprise_id,
            "name": "路北奶站",
            "address": "唐山市路北区",
            "location": { "lat": 39.63, "lng": 118.18 },
            "phone": "0315000000",
            "customer_type": "external"
        }),
    )
    .await;
    assert_eq!(station_status, StatusCode::OK);
    assert_eq!(station_body["message"], "success");
    assert!(station_body["data"]["id"]
        .as_str()
        .unwrap()
        .starts_with("station-"));
    assert_eq!(station_body["data"]["customer_type"], "external");
    let station_id = station_body["data"]["id"].as_str().unwrap().to_string();

    let (station_list_status, station_list_body) = get_json(
        &context.app,
        &format!("/api/station?enterpriseId={enterprise_id}&keyword=路北&page=1&pageSize=10"),
    )
    .await;
    assert_eq!(station_list_status, StatusCode::OK);
    assert_eq!(station_list_body["data"]["total"], 1);
    assert_eq!(station_list_body["data"]["list"][0]["id"], station_id);

    let (vehicle_status, vehicle_body) = post_json(
        &context.app,
        "/api/enterprise-vehicles",
        json!({
            "enterprise_id": enterprise_id,
            "vehicle_id": "ent-vehicle-001",
            "vehicle_code": "ENT-A001",
            "vehicle_type": "无人配送车",
            "load_capacity": 500,
            "volume": 10,
            "length": 3.5,
            "width": 1.8,
            "height": 2.1,
            "has_cold_chain": true,
            "usage_mode": "internal"
        }),
    )
    .await;
    assert_eq!(vehicle_status, StatusCode::OK);
    assert_eq!(vehicle_body["message"], "success");
    assert_eq!(vehicle_body["data"]["id"], "ent-vehicle-001");
    assert_eq!(vehicle_body["data"]["owner_id"], admin_id);
    assert_eq!(vehicle_body["data"]["status"], "active");

    let (vehicle_list_status, vehicle_list_body) = get_json(
        &context.app,
        &format!("/api/enterprise-vehicles?enterprise_id={enterprise_id}&usage_mode=internal"),
    )
    .await;
    assert_eq!(vehicle_list_status, StatusCode::OK);
    assert_eq!(vehicle_list_body["data"].as_array().unwrap().len(), 1);

    let (stats_status, stats_body) = get_json(
        &context.app,
        &format!("/api/enterprise-vehicles/stats?enterprise_id={enterprise_id}"),
    )
    .await;
    assert_eq!(stats_status, StatusCode::OK);
    assert_eq!(stats_body["data"]["total"], 1);
    assert_eq!(stats_body["data"]["idle"], 1);
    assert_eq!(stats_body["data"]["internal"], 1);

    let (usage_status, usage_body) = put_json(
        &context.app,
        "/api/enterprise-vehicles/ent-vehicle-001/usage-mode",
        json!({ "usage_mode": "external" }),
    )
    .await;
    assert_eq!(usage_status, StatusCode::OK);
    assert_eq!(usage_body["data"]["usage_mode"], "external");

    let (today_status, today_body) = put_json(
        &context.app,
        "/api/enterprise-vehicles/ent-vehicle-001/today-stats",
        json!({ "internal_orders": 2, "external_orders": 1, "distance": 88.5 }),
    )
    .await;
    assert_eq!(today_status, StatusCode::OK);
    assert_eq!(today_body["data"]["success"], true);

    let (enterprise_stats_status, enterprise_stats_body) = get_json(
        &context.app,
        &format!("/api/enterprise/{enterprise_id}/stats"),
    )
    .await;
    assert_eq!(enterprise_stats_status, StatusCode::OK);
    assert_eq!(enterprise_stats_body["data"]["totalVehicles"], 1);
    assert_eq!(enterprise_stats_body["data"]["totalDistance"], 88.5);
    assert_eq!(
        enterprise_stats_body["data"]["stationStats"][0]["stationName"],
        "路北奶站"
    );

    let (delete_station_status, delete_station_body) =
        delete_json(&context.app, &format!("/api/station/{station_id}")).await;
    assert_eq!(delete_station_status, StatusCode::OK);
    assert_eq!(delete_station_body["data"]["message"], "删除成功");

    context.cleanup().await;
}

#[tokio::test]
async fn enterprise_demand_and_mock_routes_match_legacy_shapes() {
    let Some(context) = TestContext::new().await else {
        return;
    };
    let admin_id = insert_user(&context.pool, "13950000002", "enterprise", "企业管理员二").await;
    let enterprise_id: String = sqlx::query_scalar(
        r#"
        INSERT INTO enterprises (name, type, admin_id, status)
        VALUES ('唐山配送', 'dairy', $1, 'active')
        RETURNING id
        "#,
    )
    .bind(&admin_id)
    .fetch_one(&context.pool)
    .await
    .expect("enterprise should be inserted");

    let (create_status, create_body) = post_json(
        &context.app,
        "/api/demand",
        json!({
            "enterpriseId": enterprise_id,
            "pickupPointType": "warehouse",
            "pickupPointInfo": { "name": "中心仓", "address": "唐山配送中心", "latitude": 39.63, "longitude": 118.18 },
            "deliveryPoints": [
                { "stationId": "s1", "name": "路北奶站", "address": "路北区", "latitude": 39.64, "longitude": 118.19, "status": "pending" },
                { "stationId": "s2", "name": "路南奶站", "address": "路南区", "latitude": 39.61, "longitude": 118.16, "status": "pending" }
            ],
            "cargoInfo": { "type": "鲜奶", "quantity": 120 },
            "timeWindow": { "start": "08:00", "end": "10:00" },
            "vehicleSource": "external"
        }),
    )
    .await;
    assert_eq!(create_status, StatusCode::OK);
    assert_eq!(create_body["message"], "success");
    assert!(create_body["data"]["id"]
        .as_str()
        .unwrap()
        .starts_with("demand-"));
    assert!(create_body["data"]["external_demand_id"]
        .as_str()
        .unwrap()
        .starts_with("pub-"));
    let demand_id = create_body["data"]["id"].as_str().unwrap().to_string();

    let public_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM demands WHERE merchant_id = $1 AND remarks = '企业外部需求'",
    )
    .bind(&admin_id)
    .fetch_one(&context.pool)
    .await
    .expect("public demands count should fetch");
    assert_eq!(public_count, 1);

    sqlx::query(
        r#"
        INSERT INTO vehicles (
            id, owner_id, enterprise_id, vehicle_code, vehicle_type,
            load_capacity, volume, status, trip_status, usage_mode
        )
        VALUES ('internal-v1', $1, $2, 'INTERNAL-V1', '无人配送车', 500, 10, 'active', 'idle', 'internal')
        "#,
    )
    .bind(&admin_id)
    .bind(&enterprise_id)
    .execute(&context.pool)
    .await
    .expect("internal vehicle should be inserted");

    let (list_status, list_body) = get_json(
        &context.app,
        &format!("/api/demand?enterpriseId={enterprise_id}&status=pending&page=1&pageSize=10"),
    )
    .await;
    assert_eq!(list_status, StatusCode::OK);
    assert_eq!(list_body["data"]["total"], 1);

    let (pending_status, pending_body) = get_json(
        &context.app,
        &format!("/api/demand/pending/{enterprise_id}"),
    )
    .await;
    assert_eq!(pending_status, StatusCode::OK);
    assert_eq!(pending_body["data"].as_array().unwrap().len(), 1);

    let (allocate_status, allocate_body) = put_json(
        &context.app,
        &format!("/api/demand/{demand_id}/allocate"),
        json!({ "vehicle_allocation": { "vehicle_ids": ["internal-v1"], "driver": "张三" } }),
    )
    .await;
    assert_eq!(allocate_status, StatusCode::OK);
    assert_eq!(allocate_body["data"]["status"], "in_transit");

    let internal_vehicle_status: String =
        sqlx::query_scalar("SELECT trip_status FROM vehicles WHERE id = 'internal-v1'")
            .fetch_one(&context.pool)
            .await
            .expect("internal vehicle status should fetch");
    assert_eq!(internal_vehicle_status, "in_transit");

    let (point_status, point_body) = put_json(
        &context.app,
        &format!("/api/demand/{demand_id}/delivery-points"),
        json!({ "action": "update_status", "stationId": "s1", "status": "completed" }),
    )
    .await;
    assert_eq!(point_status, StatusCode::OK);
    assert_eq!(
        point_body["data"]["delivery_points"][0]["status"],
        "completed"
    );

    let (stats_status, stats_body) = get_json(
        &context.app,
        &format!("/api/demand/stats/enterprise?enterprise_id={enterprise_id}"),
    )
    .await;
    assert_eq!(stats_status, StatusCode::OK);
    assert_eq!(stats_body["data"]["in_transit"], 1);
    assert_eq!(stats_body["data"]["total"], 1);

    let public_demand_id: String = sqlx::query_scalar(
        "SELECT id FROM demands WHERE merchant_id = $1 AND status = 'pending' LIMIT 1",
    )
    .bind(&admin_id)
    .fetch_one(&context.pool)
    .await
    .expect("public demand id should fetch");

    sqlx::query(
        r#"
        INSERT INTO vehicles (
            id, owner_id, enterprise_id, vehicle_code, vehicle_type,
            load_capacity, volume, status, trip_status, usage_mode
        )
        VALUES
            ('v1', $1, $2, 'V1', '无人配送车', 500, 10, 'active', 'idle', 'external'),
            ('v2', $1, $2, 'V2', '无人配送车', 500, 10, 'active', 'idle', 'external')
        "#,
    )
    .bind(&admin_id)
    .bind(&enterprise_id)
    .execute(&context.pool)
    .await
    .expect("external vehicles should be inserted");

    let (accept_status, accept_body) = post_json(
        &context.app,
        &format!("/api/demand/external/{public_demand_id}/accept"),
        json!({ "enterprise_id": enterprise_id, "vehicle_ids": ["v1", "v2"] }),
    )
    .await;
    assert_eq!(accept_status, StatusCode::OK);
    assert_eq!(accept_body["data"]["external_demand_id"], public_demand_id);

    let in_transit_vehicle_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM vehicles WHERE id IN ('v1', 'v2') AND trip_status = 'in_transit'",
    )
    .fetch_one(&context.pool)
    .await
    .expect("vehicle trip status count should fetch");
    assert_eq!(in_transit_vehicle_count, 2);

    let (mock_status, mock_body) = get_json(&context.app, "/api/mock/vehicles/all").await;
    assert_eq!(mock_status, StatusCode::OK);
    assert_eq!(mock_body["message"], "success");
    assert!(mock_body["data"].as_array().unwrap().len() >= 2);

    let (trajectory_status, trajectory_body) =
        get_json(&context.app, "/api/mock/vehicles/trajectories").await;
    assert_eq!(trajectory_status, StatusCode::OK);
    assert!(trajectory_body["data"].is_object());

    context.cleanup().await;
}

#[tokio::test]
async fn enterprise_external_demand_cancel_cancels_public_demand() {
    let Some(context) = TestContext::new().await else {
        return;
    };
    let admin_id = insert_user(&context.pool, "13950000003", "enterprise", "企业管理员三").await;
    let enterprise_id: String = sqlx::query_scalar(
        r#"
        INSERT INTO enterprises (name, type, admin_id, status)
        VALUES ('唐山社区团购', 'dairy', $1, 'active')
        RETURNING id
        "#,
    )
    .bind(&admin_id)
    .fetch_one(&context.pool)
    .await
    .expect("enterprise should be inserted");

    let (create_status, create_body) = post_json(
        &context.app,
        "/api/demand",
        json!({
            "enterpriseId": enterprise_id,
            "pickupPointType": "warehouse",
            "pickupPointInfo": { "name": "团购仓", "address": "唐山团购仓", "latitude": 39.63, "longitude": 118.18 },
            "deliveryPoints": [
                { "stationId": "leader-1", "name": "社区团长A", "address": "社区A", "latitude": 39.64, "longitude": 118.19, "businessMode": "community_group_buy", "pointType": "community_leader", "status": "pending" }
            ],
            "cargoInfo": { "type": "团购生鲜", "quantity": 60, "businessMode": "community_group_buy" },
            "timeWindow": { "start": "14:00", "end": "16:00" },
            "vehicleSource": "external"
        }),
    )
    .await;
    assert_eq!(create_status, StatusCode::OK);
    let demand_id = create_body["data"]["id"].as_str().unwrap().to_string();
    let public_demand_id = create_body["data"]["external_demand_id"]
        .as_str()
        .unwrap()
        .to_string();

    let (cancel_status, cancel_body) = put_json(
        &context.app,
        &format!("/api/demand/{demand_id}/cancel"),
        json!({}),
    )
    .await;
    assert_eq!(cancel_status, StatusCode::OK);
    assert_eq!(cancel_body["data"]["success"], true);

    let public_status: String = sqlx::query_scalar("SELECT status FROM demands WHERE id = $1")
        .bind(&public_demand_id)
        .fetch_one(&context.pool)
        .await
        .expect("public demand status should fetch");
    assert_eq!(public_status, "cancelled");

    context.cleanup().await;
}

#[tokio::test]
async fn enterprise_internal_demand_completion_releases_allocated_vehicle() {
    let Some(context) = TestContext::new().await else {
        return;
    };
    let admin_id = insert_user(&context.pool, "13950000004", "enterprise", "企业管理员四").await;
    let enterprise_id: String = sqlx::query_scalar(
        r#"
        INSERT INTO enterprises (name, type, admin_id, status)
        VALUES ('唐山终端配送', 'dairy', $1, 'active')
        RETURNING id
        "#,
    )
    .bind(&admin_id)
    .fetch_one(&context.pool)
    .await
    .expect("enterprise should be inserted");

    sqlx::query(
        r#"
        INSERT INTO vehicles (
            id, owner_id, enterprise_id, vehicle_code, vehicle_type,
            load_capacity, volume, status, trip_status, usage_mode
        )
        VALUES ('release-v1', $1, $2, 'RELEASE-V1', '无人配送车', 500, 10, 'active', 'idle', 'internal')
        "#,
    )
    .bind(&admin_id)
    .bind(&enterprise_id)
    .execute(&context.pool)
    .await
    .expect("internal vehicle should be inserted");

    let (create_status, create_body) = post_json(
        &context.app,
        "/api/demand",
        json!({
            "enterpriseId": enterprise_id,
            "pickupPointType": "warehouse",
            "pickupPointInfo": { "name": "中心仓", "address": "唐山配送中心" },
            "deliveryPoints": [
                { "stationId": "terminal-1", "name": "终端A", "address": "终端A地址", "status": "pending" }
            ],
            "cargoInfo": { "type": "鲜奶", "quantity": 80, "businessMode": "enterprise_terminal" },
            "timeWindow": { "start": "08:00", "end": "10:00" },
            "vehicleSource": "internal"
        }),
    )
    .await;
    assert_eq!(create_status, StatusCode::OK);
    let demand_id = create_body["data"]["id"].as_str().unwrap().to_string();

    let (allocate_status, _) = put_json(
        &context.app,
        &format!("/api/demand/{demand_id}/allocate"),
        json!({ "vehicle_allocation": { "vehicle_ids": ["release-v1"] } }),
    )
    .await;
    assert_eq!(allocate_status, StatusCode::OK);

    let (point_status, point_body) = put_json(
        &context.app,
        &format!("/api/demand/{demand_id}/delivery-points"),
        json!({ "action": "update_status", "stationId": "terminal-1", "status": "completed" }),
    )
    .await;
    assert_eq!(point_status, StatusCode::OK);
    assert_eq!(point_body["data"]["status"], "completed");

    let vehicle_status: String =
        sqlx::query_scalar("SELECT trip_status FROM vehicles WHERE id = 'release-v1'")
            .fetch_one(&context.pool)
            .await
            .expect("vehicle status should fetch");
    assert_eq!(vehicle_status, "idle");

    context.cleanup().await;
}
