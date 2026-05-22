use std::env;

use axum::{
    body::{to_bytes, Body},
    http::{Request, StatusCode},
    Router,
};
use chrono::{Duration, Utc};
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
            eprintln!("skipping rental endpoint test because TEST_DATABASE_URL is not set");
            return None;
        };
        let admin_database_url = rewrite_database_url(&database_url, "postgres");
        let admin_pool = PgPoolOptions::new()
            .max_connections(1)
            .connect(&admin_database_url)
            .await
            .expect("admin test database should be reachable");
        let database_name = format!("recorouter_rental_test_{}", uuid::Uuid::new_v4().simple());
        sqlx::query(&format!(r#"CREATE DATABASE "{database_name}""#))
            .execute(&admin_pool)
            .await
            .expect("disposable rental test database should be created");
        let database_url = rewrite_database_url(&database_url, &database_name);
        let pool = PgPoolOptions::new()
            .max_connections(5)
            .connect(&database_url)
            .await
            .expect("disposable rental test database should be reachable");
        recorouter_api::db::run_migrations(&pool)
            .await
            .expect("rental test migrations should run");
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
            .expect("disposable rental test database should be dropped");
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

async fn insert_rentable_vehicle(pool: &PgPool, owner_id: &str, plate: &str) -> String {
    sqlx::query_scalar(
        r#"
        INSERT INTO vehicles (
            owner_id, vehicle_type, license_plate, status, trip_status,
            is_available_for_rent, rent_monthly_price, rent_yearly_price, rent_deposit,
            contact_phone, contact_wechat, photos
        )
        VALUES ($1, '冷链车', $2, 'active', 'idle', true, 3000, 30000, 5000, '13900000000', 'wx-car', '["v/a.jpg"]'::jsonb)
        RETURNING id
        "#,
    )
    .bind(owner_id)
    .bind(plate)
    .fetch_one(pool)
    .await
    .expect("vehicle should be inserted")
}

#[tokio::test]
async fn rental_lifecycle_and_lists_match_legacy_shapes() {
    let Some(context) = TestContext::new().await else {
        return;
    };
    let owner_id = insert_user(&context.pool, "13960000001", "owner", "车主一").await;
    let renter_id = insert_user(&context.pool, "13960000002", "merchant", "租户一").await;
    let vehicle_id = insert_rentable_vehicle(&context.pool, &owner_id, "沪R12345").await;
    let start = Utc::now() + Duration::days(1);
    let end = Utc::now() + Duration::days(31);

    let (available_status, available_body) = get_json(
        &context.app,
        &format!("/api/rentals/available-vehicles?user_id={renter_id}"),
    )
    .await;
    assert_eq!(available_status, StatusCode::OK);
    assert_eq!(available_body["message"], "查询成功");
    assert_eq!(available_body["data"][0]["id"], vehicle_id);
    assert_eq!(available_body["data"][0]["has_applied"], false);
    assert_eq!(available_body["data"][0]["owners"]["name"], "车主一");

    let (info_status, info_body) = get_json(
        &context.app,
        &format!("/api/rentals/vehicle/{vehicle_id}/info"),
    )
    .await;
    assert_eq!(info_status, StatusCode::OK);
    assert_eq!(info_body["data"]["owner"]["name"], "车主一");
    assert_eq!(info_body["data"]["rent_monthly_price"], 3000.0);

    let (create_status, create_body) = post_json(
        &context.app,
        "/api/rentals",
        json!({
            "vehicle_id": vehicle_id,
            "owner_id": owner_id,
            "renter_id": renter_id,
            "rent_type": "monthly",
            "rent_start_date": start.to_rfc3339(),
            "rent_end_date": end.to_rfc3339(),
            "contract_signed": true,
            "rent_paid": true,
            "deposit_paid": true,
            "deposit_amount": 5000,
            "notes": "测试租赁"
        }),
    )
    .await;
    assert_eq!(create_status, StatusCode::OK);
    assert_eq!(create_body["message"], "租赁关系已创建，请等待车主确认");
    assert_eq!(create_body["data"]["status"], "pending");
    assert_eq!(create_body["data"]["confirmed_by_renter"], true);
    let rental_id = create_body["data"]["id"].as_str().unwrap().to_string();

    let (duplicate_status, duplicate_body) = post_json(
        &context.app,
        "/api/rentals",
        json!({
            "vehicle_id": vehicle_id,
            "owner_id": owner_id,
            "renter_id": renter_id,
            "rent_type": "monthly",
            "rent_start_date": start.to_rfc3339(),
            "rent_end_date": end.to_rfc3339()
        }),
    )
    .await;
    assert_eq!(duplicate_status, StatusCode::BAD_REQUEST);
    assert_eq!(
        duplicate_body["message"],
        "您已经申请过该车辆，请等待车主确认"
    );

    let (my_status, my_body) = get_json(
        &context.app,
        &format!("/api/rentals/my?user_id={renter_id}"),
    )
    .await;
    assert_eq!(my_status, StatusCode::OK);
    assert_eq!(
        my_body["data"]["as_renter"][0]["vehicles"]["id"],
        vehicle_id
    );
    assert_eq!(my_body["data"]["as_renter"][0]["owners"]["name"], "车主一");

    let (pending_status, pending_body) = get_json(
        &context.app,
        &format!("/api/rentals/pending-for-owner?owner_id={owner_id}"),
    )
    .await;
    assert_eq!(pending_status, StatusCode::OK);
    assert_eq!(pending_body["data"][0]["id"], rental_id);
    assert_eq!(pending_body["data"][0]["renters"]["name"], "租户一");

    let (confirm_status, confirm_body) = post_json(
        &context.app,
        &format!("/api/rentals/{rental_id}/confirm-owner"),
        json!({ "confirm": true, "notes": "同意", "owner_id": owner_id }),
    )
    .await;
    assert_eq!(confirm_status, StatusCode::OK);
    assert_eq!(confirm_body["message"], "租赁关系已确认");
    assert_eq!(confirm_body["data"]["status"], "active");

    let vehicle_after_confirm: (Option<String>, bool) =
        sqlx::query_as("SELECT current_renter_id, is_available FROM vehicles WHERE id = $1")
            .bind(&vehicle_id)
            .fetch_one(&context.pool)
            .await
            .expect("vehicle should fetch");
    assert_eq!(vehicle_after_confirm.0.as_deref(), Some(renter_id.as_str()));
    assert!(!vehicle_after_confirm.1);

    let (return_status, return_body) = post_json(
        &context.app,
        &format!("/api/rentals/{rental_id}/confirm-return"),
        json!({ "notes": "已归还", "owner_id": owner_id }),
    )
    .await;
    assert_eq!(return_status, StatusCode::OK);
    assert_eq!(return_body["message"], "车辆已确认归还");
    assert_eq!(return_body["data"]["status"], "expired");
    let vehicle_after_return: (Option<String>, bool) =
        sqlx::query_as("SELECT current_renter_id, is_available FROM vehicles WHERE id = $1")
            .bind(&vehicle_id)
            .fetch_one(&context.pool)
            .await
            .expect("vehicle should fetch");
    assert_eq!(vehicle_after_return.0, None);
    assert!(vehicle_after_return.1);

    context.cleanup().await;
}

#[tokio::test]
async fn rental_reminders_check_expiry_logs_notifications_and_statistics_shape() {
    let Some(context) = TestContext::new().await else {
        return;
    };
    let owner_id = insert_user(&context.pool, "13960000003", "owner", "车主二").await;
    let renter_id = insert_user(&context.pool, "13960000004", "merchant", "租户二").await;
    let vehicle_id = insert_rentable_vehicle(&context.pool, &owner_id, "沪R67890").await;
    let rental_id: String = sqlx::query_scalar(
        r#"
        INSERT INTO vehicle_rentals (
            vehicle_id, owner_id, renter_id, rent_type, rent_start_date, rent_end_date, status
        )
        VALUES ($1, $2, $3, 'monthly', now(), $4::timestamptz, 'active')
        RETURNING id
        "#,
    )
    .bind(&vehicle_id)
    .bind(&owner_id)
    .bind(&renter_id)
    .bind((Utc::now() + Duration::days(1)).to_rfc3339())
    .fetch_one(&context.pool)
    .await
    .expect("rental should be inserted");

    let (check_status, check_body) =
        get_json(&context.app, "/api/rental-reminders/check-expiry").await;
    assert_eq!(check_status, StatusCode::OK);
    assert_eq!(check_body["message"], "检查完成");
    assert_eq!(check_body["data"]["totalRentals"], 1);
    assert_eq!(check_body["data"]["remindersSent"], 1);

    let notification_count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM notifications WHERE related_id = $1")
            .bind(&rental_id)
            .fetch_one(&context.pool)
            .await
            .expect("notification count should fetch");
    assert_eq!(notification_count, 2);
    let reminder_count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM rental_reminders WHERE rental_id = $1")
            .bind(&rental_id)
            .fetch_one(&context.pool)
            .await
            .expect("reminder count should fetch");
    assert_eq!(reminder_count, 1);

    let (second_status, second_body) =
        get_json(&context.app, "/api/rental-reminders/check-expiry").await;
    assert_eq!(second_status, StatusCode::OK);
    assert_eq!(second_body["data"]["remindersSent"], 0);

    let (statistics_status, statistics_body) =
        get_json(&context.app, "/api/rental-reminders/statistics").await;
    assert_eq!(statistics_status, StatusCode::OK);
    assert_eq!(statistics_body["message"], "统计功能开发中");
    assert_eq!(statistics_body["data"], json!({}));

    context.cleanup().await;
}
