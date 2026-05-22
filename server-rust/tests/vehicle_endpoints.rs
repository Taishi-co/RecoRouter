use std::env;

use axum::{
    body::{to_bytes, Body},
    http::{Request, StatusCode},
    Router,
};
use serde_json::{json, Value};
use sqlx::{postgres::PgPoolOptions, PgPool};
use tower::ServiceExt;

use recorouter_api::storage::{LocalStorage, Storage};

struct TestContext {
    app: Router,
    storage: LocalStorage,
    pool: PgPool,
    admin_pool: PgPool,
    database_name: String,
    _upload_dir: tempfile::TempDir,
}

impl TestContext {
    async fn new() -> Option<Self> {
        let Ok(database_url) = env::var("TEST_DATABASE_URL") else {
            eprintln!("skipping vehicle endpoint test because TEST_DATABASE_URL is not set");
            return None;
        };

        let admin_database_url = rewrite_database_url(&database_url, "postgres");
        let admin_pool = PgPoolOptions::new()
            .max_connections(1)
            .connect(&admin_database_url)
            .await
            .expect("admin test database should be reachable");
        let database_name = format!("recorouter_vehicle_test_{}", uuid::Uuid::new_v4().simple());
        sqlx::query(&format!(r#"CREATE DATABASE "{database_name}""#))
            .execute(&admin_pool)
            .await
            .expect("disposable vehicle test database should be created");

        let database_url = rewrite_database_url(&database_url, &database_name);
        let pool = PgPoolOptions::new()
            .max_connections(5)
            .connect(&database_url)
            .await
            .expect("disposable vehicle test database should be reachable");

        recorouter_api::db::run_migrations(&pool)
            .await
            .expect("vehicle test migrations should run");

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

        Some(Self {
            app,
            storage,
            pool,
            admin_pool,
            database_name,
            _upload_dir: upload_dir,
        })
    }

    async fn cleanup(self) {
        let Self {
            app,
            storage: _,
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
            .expect("disposable vehicle test database should be dropped");

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

async fn multipart_request(
    app: &Router,
    uri: &str,
    boundary: &str,
    body: Vec<u8>,
) -> (StatusCode, Value) {
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(uri)
                .header(
                    "content-type",
                    format!("multipart/form-data; boundary={boundary}"),
                )
                .body(Body::from(body))
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

fn multipart_file_body(
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

fn multipart_text_body(boundary: &str, field_name: &str, value: &str) -> Vec<u8> {
    let mut body = Vec::new();
    body.extend_from_slice(format!("--{boundary}\r\n").as_bytes());
    body.extend_from_slice(
        format!("Content-Disposition: form-data; name=\"{field_name}\"\r\n\r\n").as_bytes(),
    );
    body.extend_from_slice(value.as_bytes());
    body.extend_from_slice(format!("\r\n--{boundary}--\r\n").as_bytes());
    body
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

fn create_vehicle_body(owner_id: &str) -> Value {
    json!({
        "owner_id": owner_id,
        "vehicle_type": "冷链车",
        "license_plate": "沪A12345",
        "load_capacity": "12.5",
        "volume": "38.2",
        "battery_life": "430",
        "has_cold_chain": "true",
        "operation_area": "[\"上海\",\"苏州\"]",
        "available_hours": "{\"start\":\"08:00\",\"end\":\"18:00\"}",
        "photoUrls": ["vehicles/existing-a.png", "vehicles/existing-b.png"]
    })
}

#[tokio::test]
async fn vehicle_create_validates_owner_role_and_lists_enriched_owned_and_rented_vehicles() {
    let Some(context) = TestContext::new().await else {
        return;
    };
    let owner_id = insert_user(&context.pool, "13910001001", "owner", "车主一").await;
    let renter_id = insert_user(&context.pool, "13910001002", "owner", "租户一").await;
    let merchant_id = insert_user(&context.pool, "13910001003", "merchant", "货主一").await;
    let second_owner_id = insert_user(&context.pool, "13910001004", "owner", "车主二").await;

    let (invalid_status, invalid_body) = post_json(
        &context.app,
        "/api/vehicles",
        create_vehicle_body(&merchant_id),
    )
    .await;
    assert_eq!(invalid_status, StatusCode::BAD_REQUEST);
    assert_eq!(invalid_body["message"], "只有车主可以注册车辆");

    let (create_status, create_body) = post_json(
        &context.app,
        "/api/vehicles",
        create_vehicle_body(&owner_id),
    )
    .await;
    assert_eq!(create_status, StatusCode::OK);
    assert_eq!(create_body["code"], 200);
    assert_eq!(create_body["message"], "车辆注册成功，等待后台审核");
    assert_eq!(create_body["data"]["owner_id"], owner_id);
    assert_eq!(create_body["data"]["status"], "pending");
    assert_eq!(create_body["data"]["has_cold_chain"], true);
    assert_eq!(create_body["data"]["base_price"], 20.0);
    assert_eq!(create_body["data"]["base_distance"], 3.0);
    assert_eq!(create_body["data"]["price_per_km"], 2.0);
    assert_eq!(create_body["data"]["photos"][0], "vehicles/existing-a.png");
    let owned_vehicle_id = create_body["data"]["id"].as_str().unwrap();

    let rented_vehicle_id: String = sqlx::query_scalar(
        r#"
        INSERT INTO vehicles (
            owner_id, vehicle_type, license_plate, status, current_renter_id
        )
        VALUES ($1, '厢式货车', '沪B54321', 'active', $2)
        RETURNING id
        "#,
    )
    .bind(&second_owner_id)
    .bind(&renter_id)
    .fetch_one(&context.pool)
    .await
    .expect("rented vehicle should be inserted");
    sqlx::query(
        r#"
        INSERT INTO vehicle_rentals (vehicle_id, owner_id, renter_id, status)
        VALUES ($1, $2, $3, 'active')
        "#,
    )
    .bind(&rented_vehicle_id)
    .bind(&second_owner_id)
    .bind(&renter_id)
    .execute(&context.pool)
    .await
    .expect("active rental should be inserted");

    let (owned_list_status, owned_list_body) = get_json(
        &context.app,
        &format!("/api/vehicles?owner_id={owner_id}&user_id={owner_id}"),
    )
    .await;
    assert_eq!(owned_list_status, StatusCode::OK);
    assert_eq!(owned_list_body["message"], "查询成功");
    assert_eq!(owned_list_body["data"].as_array().unwrap().len(), 1);
    assert_eq!(owned_list_body["data"][0]["id"], owned_vehicle_id);
    assert_eq!(owned_list_body["data"][0]["owner"]["phone"], "13910001001");
    assert_eq!(owned_list_body["data"][0]["owner"]["role"], "owner");
    assert_eq!(owned_list_body["data"][0]["ownership_type"], "owned");
    assert_eq!(owned_list_body["data"][0]["can_toggle_availability"], true);
    assert!(owned_list_body["data"][0]["availability_control_reason"].is_null());

    let (rented_list_status, rented_list_body) = get_json(
        &context.app,
        &format!("/api/vehicles?owner_id={renter_id}&user_id={renter_id}"),
    )
    .await;
    assert_eq!(rented_list_status, StatusCode::OK);
    let rented_row = rented_list_body["data"]
        .as_array()
        .unwrap()
        .iter()
        .find(|row| row["id"] == rented_vehicle_id)
        .expect("rented vehicle should be listed");
    assert_eq!(rented_row["ownership_type"], "rented");
    assert_eq!(rented_row["can_toggle_availability"], true);
    assert!(rented_row["availability_control_reason"].is_null());

    let (all_status, all_body) = get_json(&context.app, "/api/vehicles").await;
    assert_eq!(all_status, StatusCode::OK);
    assert!(all_body["data"].as_array().unwrap().len() >= 2);

    context.cleanup().await;
}

#[tokio::test]
async fn vehicle_review_resubmit_update_availability_and_rental_settings_match_legacy_messages() {
    let Some(context) = TestContext::new().await else {
        return;
    };
    let owner_id = insert_user(&context.pool, "13910002001", "owner", "车主一").await;
    let renter_id = insert_user(&context.pool, "13910002002", "owner", "租户一").await;

    let (create_status, create_body) = post_json(
        &context.app,
        "/api/vehicles",
        create_vehicle_body(&owner_id),
    )
    .await;
    assert_eq!(create_status, StatusCode::OK);
    let vehicle_id = create_body["data"]["id"].as_str().unwrap();

    let (get_status, get_body) =
        get_json(&context.app, &format!("/api/vehicles/{vehicle_id}")).await;
    assert_eq!(get_status, StatusCode::OK);
    assert_eq!(get_body["message"], "查询成功");
    assert_eq!(get_body["data"]["id"], vehicle_id);

    let (reject_status, reject_body) = post_json(
        &context.app,
        &format!("/api/vehicles/{vehicle_id}/review"),
        json!({ "action": "reject", "reason": "资料不清晰" }),
    )
    .await;
    assert_eq!(reject_status, StatusCode::OK);
    assert_eq!(reject_body["message"], "车辆已拒绝");
    assert_eq!(reject_body["data"]["status"], "rejected");
    assert_eq!(reject_body["data"]["remarks"], "资料不清晰");

    let (resubmit_status, resubmit_body) = post_json(
        &context.app,
        &format!("/api/vehicles/{vehicle_id}/resubmit"),
        json!({}),
    )
    .await;
    assert_eq!(resubmit_status, StatusCode::OK);
    assert_eq!(resubmit_body["message"], "已重新提交审核");
    assert_eq!(resubmit_body["data"]["status"], "pending");
    assert!(resubmit_body["data"]["remarks"].is_null());

    let (approve_status, approve_body) = post_json(
        &context.app,
        &format!("/api/vehicles/{vehicle_id}/review"),
        json!({ "action": "approve" }),
    )
    .await;
    assert_eq!(approve_status, StatusCode::OK);
    assert_eq!(approve_body["message"], "车辆审核通过");
    assert_eq!(approve_body["data"]["status"], "active");

    let (availability_status, availability_body) = put_json(
        &context.app,
        &format!("/api/vehicles/{vehicle_id}/availability"),
        json!({ "is_available": false, "user_id": owner_id }),
    )
    .await;
    assert_eq!(availability_status, StatusCode::OK);
    assert_eq!(availability_body["message"], "车辆已设置为不出车");
    assert_eq!(availability_body["data"]["is_available"], false);

    let (settings_status, settings_body) = get_json(
        &context.app,
        &format!("/api/vehicles/{vehicle_id}/rental-settings"),
    )
    .await;
    assert_eq!(settings_status, StatusCode::OK);
    assert_eq!(settings_body["message"], "查询成功");
    assert_eq!(settings_body["data"]["is_available_for_rent"], false);
    assert_eq!(settings_body["data"]["rent_monthly_price"], 0.0);
    assert_eq!(settings_body["data"]["rent_yearly_price"], 0.0);
    assert_eq!(settings_body["data"]["rent_deposit"], 0.0);

    let (update_settings_status, update_settings_body) = put_json(
        &context.app,
        &format!("/api/vehicles/{vehicle_id}/rental-settings"),
        json!({
            "is_available_for_rent": true,
            "rent_monthly_price": 3200,
            "rent_yearly_price": 32000,
            "rent_deposit": 5000,
            "contact_phone": "13910002001",
            "contact_wechat": "owner-wechat",
            "notes": "仅限同城"
        }),
    )
    .await;
    assert_eq!(update_settings_status, StatusCode::OK);
    assert_eq!(update_settings_body["message"], "租赁设置已更新");
    assert_eq!(update_settings_body["data"]["rent_monthly_price"], 3200.0);
    assert_eq!(update_settings_body["data"]["rental_notes"], "仅限同城");

    let (update_status, update_body) = put_json(
        &context.app,
        &format!("/api/vehicles/{vehicle_id}"),
        json!({
            "license_plate": "沪A99999",
            "photoUrls": ["vehicles/new.png"],
            "base_price": 35,
            "base_distance": 4,
            "price_per_km": 3.5
        }),
    )
    .await;
    assert_eq!(update_status, StatusCode::OK);
    assert_eq!(update_body["message"], "更新成功");
    assert_eq!(update_body["data"]["license_plate"], "沪A99999");
    assert_eq!(update_body["data"]["vehicle_type"], "冷链车");
    assert_eq!(update_body["data"]["photos"][0], "vehicles/new.png");
    assert_eq!(update_body["data"]["base_price"], 35.0);
    assert!(update_body["data"]["price_updated_at"].is_string());

    sqlx::query("UPDATE vehicles SET current_renter_id = $1 WHERE id = $2")
        .bind(&renter_id)
        .bind(vehicle_id)
        .execute(&context.pool)
        .await
        .expect("vehicle renter should be set");
    let (rented_settings_status, rented_settings_body) = put_json(
        &context.app,
        &format!("/api/vehicles/{vehicle_id}/rental-settings"),
        json!({ "is_available_for_rent": true }),
    )
    .await;
    assert_eq!(rented_settings_status, StatusCode::BAD_REQUEST);
    assert_eq!(
        rented_settings_body["message"],
        "租赁车辆不能设置为可租赁状态，请先归还车辆"
    );

    let (missing_status, missing_body) = get_json(&context.app, "/api/vehicles/missing").await;
    assert_eq!(missing_status, StatusCode::NOT_FOUND);
    assert_eq!(missing_body["message"], "车辆不存在");

    context.cleanup().await;
}

#[tokio::test]
async fn vehicle_upload_photo_uses_legacy_envelope_for_missing_and_success() {
    let Some(context) = TestContext::new().await else {
        return;
    };

    let missing_boundary = "recocar-missing-photo";
    let (missing_status, missing_body) = multipart_request(
        &context.app,
        "/api/vehicles/upload-photo",
        missing_boundary,
        multipart_text_body(missing_boundary, "description", "no photo here"),
    )
    .await;
    assert_eq!(missing_status, StatusCode::OK);
    assert_eq!(missing_body["code"], 400);
    assert_eq!(missing_body["message"], "未选择照片");

    let boundary = "recocar-photo";
    let (status, body) = multipart_request(
        &context.app,
        "/api/vehicles/upload-photo",
        boundary,
        multipart_file_body(
            boundary,
            "photo",
            "truck.png",
            "image/png",
            b"\x89PNG\r\n\x1a\n",
        ),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["code"], 200);
    assert_eq!(body["message"], "上传成功");

    let file_key = body["data"]["fileKey"].as_str().unwrap();
    let file_key_pattern = regex::Regex::new(r"^vehicles/\d{13}_truck_[0-9a-f]{8}\.png$").unwrap();
    assert!(
        file_key_pattern.is_match(file_key),
        "expected vehicle upload key, got {file_key}"
    );
    assert_eq!(
        body["data"]["url"],
        format!("https://car.shcxyz.site/api/uploads/{file_key}")
    );
    assert!(context.storage.exists(file_key).await.unwrap());

    context.cleanup().await;
}
