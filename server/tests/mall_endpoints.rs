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
            eprintln!("skipping mall endpoint test because TEST_DATABASE_URL is not set");
            return None;
        };

        let admin_database_url = rewrite_database_url(&database_url, "postgres");
        let admin_pool = PgPoolOptions::new()
            .max_connections(1)
            .connect(&admin_database_url)
            .await
            .expect("admin test database should be reachable");
        let database_name = format!("recorouter_mall_test_{}", uuid::Uuid::new_v4().simple());
        sqlx::query(&format!(r#"CREATE DATABASE "{database_name}""#))
            .execute(&admin_pool)
            .await
            .expect("disposable mall test database should be created");

        let database_url = rewrite_database_url(&database_url, &database_name);
        let pool = PgPoolOptions::new()
            .max_connections(5)
            .connect(&database_url)
            .await
            .expect("disposable mall test database should be reachable");

        recorouter_api::db::run_migrations(&pool)
            .await
            .expect("mall test migrations should run");

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
            .expect("disposable mall test database should be dropped");

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

async fn request_json_with_auth(
    app: &Router,
    method: &str,
    uri: &str,
    bearer: &str,
    body: Option<Value>,
) -> (StatusCode, Value) {
    let mut builder = Request::builder()
        .method(method)
        .uri(uri)
        .header("authorization", format!("Bearer {bearer}"));
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
                .expect("authenticated request should build"),
        )
        .await
        .expect("authenticated request should complete");
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

async fn get_json(app: &Router, uri: &str) -> (StatusCode, Value) {
    request_json(app, "GET", uri, None).await
}

async fn get_json_with_auth(app: &Router, uri: &str, bearer: &str) -> (StatusCode, Value) {
    request_json_with_auth(app, "GET", uri, bearer, None).await
}

async fn post_json(app: &Router, uri: &str, body: Value) -> (StatusCode, Value) {
    request_json(app, "POST", uri, Some(body)).await
}

async fn put_json(app: &Router, uri: &str, body: Value) -> (StatusCode, Value) {
    request_json(app, "PUT", uri, Some(body)).await
}

async fn delete_json(app: &Router, uri: &str) -> (StatusCode, Value) {
    request_json(app, "DELETE", uri, None).await
}

async fn post_json_with_auth(
    app: &Router,
    uri: &str,
    bearer: &str,
    body: Value,
) -> (StatusCode, Value) {
    request_json_with_auth(app, "POST", uri, bearer, Some(body)).await
}

async fn put_json_with_auth(
    app: &Router,
    uri: &str,
    bearer: &str,
    body: Value,
) -> (StatusCode, Value) {
    request_json_with_auth(app, "PUT", uri, bearer, Some(body)).await
}

fn assert_accessible_mall_image_url(value: &Value, key: &str) {
    let image_url = value.as_str().expect("imageUrl should be a string");
    let legacy_asset_path = format!("/assets/{key}");
    let local_storage_path = format!("/api/uploads/{key}");
    let is_local_storage_url =
        image_url == local_storage_path || image_url.ends_with(&local_storage_path);
    let is_signed_cos_url = (image_url.starts_with("http://") || image_url.starts_with("https://"))
        && image_url.contains(key)
        && image_url.contains("q-sign-");

    assert_ne!(
        image_url, legacy_asset_path,
        "mall imageUrl should not expose old local static asset paths"
    );
    assert!(
        is_local_storage_url || is_signed_cos_url,
        "mall imageUrl should resolve storage key {key} to an accessible URL, got {image_url}"
    );
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

async fn insert_session(pool: &PgPool, user_id: &str, token: &str) -> String {
    sqlx::query(
        r#"
        INSERT INTO admin_sessions (token, user_id)
        VALUES ($1, $2)
        "#,
    )
    .bind(token)
    .bind(user_id)
    .execute(pool)
    .await
    .expect("session should be inserted");

    token.to_string()
}

async fn grant_current_privacy_consent(app: &Router, token: &str) {
    let (status, body) = post_json_with_auth(
        app,
        "/api/mall/privacy/consent",
        token,
        json!({
            "policyVersion": "2026.07",
            "action": "granted",
            "consentItems": ["account", "order_fulfillment", "customer_service", "security"]
        }),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["data"]["action"], "granted");
}

#[tokio::test]
async fn mall_privacy_withdrawal_blocks_business_routes_but_keeps_compliance_routes_open() {
    let Some(context) = TestContext::new().await else {
        return;
    };

    let user_id = insert_user(&context.pool, "13950004901", "customer", "隐私测试用户").await;
    let token = insert_session(&context.pool, &user_id, "mall-privacy-session-1").await;

    let (blocked_status, blocked_body) =
        get_json_with_auth(&context.app, "/api/mall/cart", &token).await;
    assert_eq!(blocked_status, StatusCode::FORBIDDEN);
    assert_eq!(blocked_body["message"], "请先阅读并同意当前隐私政策");

    let (consent_status, consent_body) =
        get_json_with_auth(&context.app, "/api/mall/privacy/consent", &token).await;
    assert_eq!(consent_status, StatusCode::OK);
    assert_eq!(consent_body["data"]["action"], "not_recorded");

    grant_current_privacy_consent(&context.app, &token).await;
    let (cart_status, _) = get_json_with_auth(&context.app, "/api/mall/cart", &token).await;
    assert_eq!(cart_status, StatusCode::OK);

    let (withdraw_status, withdraw_body) = post_json_with_auth(
        &context.app,
        "/api/mall/privacy/consent",
        &token,
        json!({
            "policyVersion": "2026.07",
            "action": "withdrawn",
            "consentItems": []
        }),
    )
    .await;
    assert_eq!(withdraw_status, StatusCode::OK);
    assert_eq!(withdraw_body["data"]["action"], "withdrawn");

    let (withdrawn_cart_status, withdrawn_cart_body) =
        get_json_with_auth(&context.app, "/api/mall/cart", &token).await;
    assert_eq!(withdrawn_cart_status, StatusCode::FORBIDDEN);
    assert_eq!(withdrawn_cart_body["message"], "请先阅读并同意当前隐私政策");

    let (deletion_status, deletion_body) =
        get_json_with_auth(&context.app, "/api/mall/account/deletion", &token).await;
    assert_eq!(deletion_status, StatusCode::OK);
    assert_eq!(deletion_body["data"]["status"], "not_requested");

    context.cleanup().await;
}

#[tokio::test]
async fn waiting_account_deletion_completes_after_blockers_are_cleared() {
    let Some(context) = TestContext::new().await else {
        return;
    };

    let user_id = insert_user(&context.pool, "13950004902", "customer", "注销测试用户").await;
    let token = insert_session(&context.pool, &user_id, "mall-deletion-session-1").await;
    grant_current_privacy_consent(&context.app, &token).await;

    sqlx::query(
        r#"
        INSERT INTO mall_orders (id, order_no, user_id, address_text, status, payable_cents)
        VALUES ('deletion-blocker-order-1', 'MALL-DELETION-BLOCKER-1', $1, '测试地址', 'paid', 1990)
        "#,
    )
    .bind(&user_id)
    .execute(&context.pool)
    .await
    .expect("active order should be inserted");

    let (request_status, request_body) = post_json_with_auth(
        &context.app,
        "/api/mall/account/deletion",
        &token,
        json!({ "reason": "自动完成回归测试" }),
    )
    .await;
    assert_eq!(request_status, StatusCode::OK);
    assert_eq!(request_body["data"]["status"], "waiting");
    assert_eq!(
        request_body["data"]["blockers"].as_array().map(Vec::len),
        Some(1)
    );

    sqlx::query("UPDATE mall_orders SET status = 'cancelled' WHERE id = $1")
        .bind("deletion-blocker-order-1")
        .execute(&context.pool)
        .await
        .expect("blocking order should be cancelled");

    let (reconciled_status, reconciled_body) =
        get_json_with_auth(&context.app, "/api/mall/account/deletion", &token).await;
    assert_eq!(reconciled_status, StatusCode::OK);
    assert_eq!(reconciled_body["data"]["status"], "completed");
    assert_eq!(
        reconciled_body["data"]["blockers"].as_array().map(Vec::len),
        Some(0)
    );

    let user_status: String = sqlx::query_scalar("SELECT status FROM users WHERE id = $1")
        .bind(&user_id)
        .fetch_one(&context.pool)
        .await
        .expect("anonymized user should remain for retained transaction records");
    assert_eq!(user_status, "deleted");

    let session_revoked: bool =
        sqlx::query_scalar("SELECT revoked_at IS NOT NULL FROM admin_sessions WHERE token = $1")
            .bind(&token)
            .fetch_one(&context.pool)
            .await
            .expect("session should remain as a revoked audit record");
    assert!(session_revoked);

    let anonymized_order: (String, Option<String>, String) = sqlx::query_as(
        "SELECT user_id, recipient_phone, address_text FROM mall_orders WHERE id = $1",
    )
    .bind("deletion-blocker-order-1")
    .fetch_one(&context.pool)
    .await
    .expect("retained order should be anonymized");
    assert!(anonymized_order.0.starts_with("deleted:"));
    assert!(anonymized_order.1.is_none());
    assert_eq!(anonymized_order.2, "已匿名化");

    context.cleanup().await;
}

#[tokio::test]
async fn mall_profile_update_saves_nickname_and_validates_phone() {
    let Some(context) = TestContext::new().await else {
        return;
    };

    let user_id = insert_user(&context.pool, "13950004101", "customer", "微信用户旧名").await;
    let other_id = insert_user(&context.pool, "13950004102", "customer", "其他用户").await;

    let (status, body) = put_json(
        &context.app,
        "/api/mall/me/profile",
        json!({
            "userId": user_id,
            "nickname": "叁友会员A",
            "phone": "13950004103"
        }),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["data"]["id"], user_id);
    assert_eq!(body["data"]["nickname"], "叁友会员A");
    assert_eq!(body["data"]["name"], "叁友会员A");
    assert_eq!(body["data"]["phone"], "13950004103");

    let (profile_status, profile_body) = get_json(
        &context.app,
        &format!("/api/mall/me/profile?userId={user_id}"),
    )
    .await;
    assert_eq!(profile_status, StatusCode::OK);
    assert_eq!(profile_body["data"]["member"]["nickname"], "叁友会员A");
    assert_eq!(profile_body["data"]["member"]["phone"], "13950004103");

    let (duplicate_status, duplicate_body) = put_json(
        &context.app,
        "/api/mall/me/profile",
        json!({
            "userId": other_id,
            "phone": "13950004103"
        }),
    )
    .await;
    assert_eq!(duplicate_status, StatusCode::BAD_REQUEST);
    assert_eq!(duplicate_body["message"], "手机号已被其他账号绑定");

    let (invalid_status, invalid_body) = put_json(
        &context.app,
        "/api/mall/me/profile",
        json!({
            "userId": user_id,
            "phone": "12345"
        }),
    )
    .await;
    assert_eq!(invalid_status, StatusCode::BAD_REQUEST);
    assert_eq!(invalid_body["message"], "手机号格式不正确");

    context.cleanup().await;
}

#[tokio::test]
async fn mall_coupon_wallet_and_points_mall_are_customer_endpoints() {
    let Some(context) = TestContext::new().await else {
        return;
    };

    let user_id = insert_user(&context.pool, "13950004201", "customer", "券包用户").await;

    let active_coupon_id: String = sqlx::query_scalar(
        r#"
        INSERT INTO mall_coupons (
          name, code, coupon_type, threshold_cents, discount_cents,
          total_quantity, per_user_limit, description, rules, status, starts_at, ends_at
        )
        VALUES (
          '测试待领取满49减6', 'TEST-WALLET-49-6', 'full_reduction', 4900, 600,
          100, 2, '测试待领取优惠券', jsonb_build_object('pointsCost', 120), 'active',
          now() - interval '1 day', now() + interval '3 days'
        )
        RETURNING id
        "#,
    )
    .fetch_one(&context.pool)
    .await
    .expect("active coupon should be inserted");

    let (wallet_status, wallet_body) =
        get_json(&context.app, &format!("/api/mall/coupons?userId={user_id}")).await;
    assert_eq!(wallet_status, StatusCode::OK);
    assert_eq!(wallet_body["data"]["summary"]["claimableCount"], 1);
    assert_eq!(wallet_body["data"]["claimable"][0]["id"], active_coupon_id);
    assert_eq!(
        wallet_body["data"]["claimable"][0]["walletStatus"],
        "claimable"
    );
    assert_eq!(wallet_body["data"]["expiring"][0]["id"], active_coupon_id);

    let (claim_status, claim_body) = post_json(
        &context.app,
        &format!("/api/mall/coupons/{active_coupon_id}/claim"),
        json!({ "userId": user_id }),
    )
    .await;
    assert_eq!(claim_status, StatusCode::OK);
    assert_eq!(claim_body["data"]["walletStatus"], "claimed");

    let (claimed_status, claimed_body) =
        get_json(&context.app, &format!("/api/mall/coupons?userId={user_id}")).await;
    assert_eq!(claimed_status, StatusCode::OK);
    assert_eq!(claimed_body["data"]["summary"]["claimedCount"], 1);
    assert_eq!(claimed_body["data"]["claimed"][0]["id"], active_coupon_id);

    sqlx::query(
        r#"
        UPDATE mall_user_coupons
        SET status = 'used', used_at = now()
        WHERE user_id = $1 AND coupon_id = $2
        "#,
    )
    .bind(&user_id)
    .bind(&active_coupon_id)
    .execute(&context.pool)
    .await
    .expect("claimed coupon should be markable as used");

    let (used_status, used_body) =
        get_json(&context.app, &format!("/api/mall/coupons?userId={user_id}")).await;
    assert_eq!(used_status, StatusCode::OK);
    assert_eq!(used_body["data"]["summary"]["usedCount"], 1);
    assert_eq!(used_body["data"]["used"][0]["id"], active_coupon_id);

    sqlx::query(
        r#"
        INSERT INTO mall_points_ledger (user_id, entry_type, points, description)
        VALUES ($1, 'adjust', 300, '测试积分')
        "#,
    )
    .bind(&user_id)
    .execute(&context.pool)
    .await
    .expect("points should be inserted");

    let (points_status, points_body) = get_json(
        &context.app,
        &format!("/api/mall/points-mall?userId={user_id}"),
    )
    .await;
    assert_eq!(points_status, StatusCode::OK);
    assert_eq!(points_body["data"]["member"]["points"], 300);
    assert_eq!(points_body["data"]["rules"]["pointsPerYuan"], 1);
    assert_eq!(points_body["data"]["rules"]["redeemRatePoints"], 100);
    assert!(
        points_body["data"]["couponRewards"]
            .as_array()
            .expect("coupon rewards should be an array")
            .iter()
            .any(|coupon| coupon["id"] == active_coupon_id),
        "points mall should include redeemable coupons"
    );

    context.cleanup().await;
}

#[tokio::test]
async fn undispatched_orders_returns_mall_orders_without_demand_linkage() {
    let Some(context) = TestContext::new().await else {
        return;
    };

    sqlx::query(
        r#"
        INSERT INTO mall_orders (id, order_no, user_id, address_text, status, payable_cents)
        VALUES ('undispatched-order-1', 'MALL-UNDISPATCHED-1', 'mall-user-1', '测试配送地址', 'paid', 1990)
        "#,
    )
    .execute(&context.pool)
    .await
    .expect("undispatched mall order should be inserted");
    sqlx::query(
        r#"
        INSERT INTO mall_order_items (
            id, order_id, product_id, sku, product_name, unit_price_cents, quantity, line_total_cents
        )
        VALUES (
            'undispatched-item-1', 'undispatched-order-1', 'product-1', 'SKU-1', '测试商品', 1990, 1, 1990
        )
        "#,
    )
    .execute(&context.pool)
    .await
    .expect("undispatched mall order item should be inserted");

    let (status, body) = get_json(&context.app, "/api/trips/undispatched-orders").await;
    assert_eq!(status, StatusCode::OK);
    let orders = body["data"]
        .as_array()
        .expect("undispatched order data should be an array");
    assert_eq!(orders.len(), 1);
    assert_eq!(orders[0]["id"], "undispatched-order-1");
    assert_eq!(orders[0]["items"][0]["productName"], "测试商品");

    sqlx::query(
        "INSERT INTO vehicle_trips (id, vehicle_id, total_orders) VALUES ('trip-with-order-1', 'vehicle-1', 1)",
    )
    .execute(&context.pool)
    .await
    .expect("trip should be inserted");
    sqlx::query(
        "UPDATE mall_orders SET trip_id = 'trip-with-order-1', status = 'dispatching', dispatched_at = now() WHERE id = 'undispatched-order-1'",
    )
    .execute(&context.pool)
    .await
    .expect("mall order should be assigned to a trip");
    sqlx::query(
        "INSERT INTO trip_stops (id, trip_id, mall_order_id, stop_sequence) VALUES ('trip-stop-1', 'trip-with-order-1', 'undispatched-order-1', 1)",
    )
    .execute(&context.pool)
    .await
    .expect("trip stop should be inserted");

    let (assigned_status, assigned_body) =
        get_json(&context.app, "/api/trips/undispatched-orders").await;
    assert_eq!(assigned_status, StatusCode::OK);
    assert_eq!(assigned_body["data"].as_array().unwrap().len(), 0);

    sqlx::query("INSERT INTO vehicle_trips (id, vehicle_id) VALUES ('other-trip-1', 'vehicle-2')")
        .execute(&context.pool)
        .await
        .expect("other trip should be inserted");
    let (wrong_trip_status, _) =
        delete_json(&context.app, "/api/trips/other-trip-1/stops/trip-stop-1").await;
    assert_eq!(wrong_trip_status, StatusCode::NOT_FOUND);

    sqlx::query("UPDATE vehicle_trips SET status = 'in_progress' WHERE id = 'trip-with-order-1'")
        .execute(&context.pool)
        .await
        .expect("trip should become in progress");
    let (in_progress_status, _) = delete_json(
        &context.app,
        "/api/admin/trips/trip-with-order-1/remove-order/undispatched-order-1",
    )
    .await;
    assert_eq!(in_progress_status, StatusCode::BAD_REQUEST);
    sqlx::query("UPDATE vehicle_trips SET status = 'planned' WHERE id = 'trip-with-order-1'")
        .execute(&context.pool)
        .await
        .expect("trip should become editable again");

    let (remove_status, remove_body) = delete_json(
        &context.app,
        "/api/admin/trips/trip-with-order-1/remove-order/undispatched-order-1",
    )
    .await;
    assert_eq!(remove_status, StatusCode::OK);
    assert_eq!(remove_body["message"], "订单已移除");

    let (returned_status, returned_body) =
        get_json(&context.app, "/api/trips/undispatched-orders").await;
    assert_eq!(returned_status, StatusCode::OK);
    let returned_orders = returned_body["data"].as_array().unwrap();
    assert_eq!(returned_orders.len(), 1);
    assert_eq!(returned_orders[0]["id"], "undispatched-order-1");

    let order_trip_id: Option<String> =
        sqlx::query_scalar("SELECT trip_id FROM mall_orders WHERE id = 'undispatched-order-1'")
            .fetch_one(&context.pool)
            .await
            .expect("mall order should still exist");
    assert!(order_trip_id.is_none());
    let stop_count: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM trip_stops WHERE mall_order_id = 'undispatched-order-1'",
    )
    .fetch_one(&context.pool)
    .await
    .expect("trip stop count should load");
    assert_eq!(stop_count, 0);
    let trip_order_count: i32 =
        sqlx::query_scalar("SELECT total_orders FROM vehicle_trips WHERE id = 'trip-with-order-1'")
            .fetch_one(&context.pool)
            .await
            .expect("trip order count should load");
    assert_eq!(trip_order_count, 0);

    context.cleanup().await;
}

#[tokio::test]
async fn mall_cart_checkout_and_tracking_are_real_endpoints() {
    let Some(context) = TestContext::new().await else {
        return;
    };

    let user_id = insert_user(&context.pool, "13950001001", "merchant", "商城用户").await;

    let (products_status, products_body) = get_json(&context.app, "/api/mall/products").await;
    assert_eq!(products_status, StatusCode::OK);
    let products = products_body["data"]
        .as_array()
        .expect("products data should be an array");
    let kiwi = products
        .iter()
        .find(|product| product["sku"] == "TEST-FRUIT-KIWI-6")
        .expect("seeded kiwi product should be listed");
    assert_accessible_mall_image_url(&kiwi["imageUrl"], "mall-products/kiwi.jpeg");
    let product_id = kiwi["id"].as_str().expect("product id should exist");
    let admin_id = insert_user(&context.pool, "13950001002", "admin", "商城管理员").await;
    let admin_token = insert_session(&context.pool, &admin_id, "mall-admin-session-1").await;
    let user_token = insert_session(&context.pool, &user_id, "mall-user-session-1").await;

    let (product_detail_status, product_detail_body) =
        get_json(&context.app, &format!("/api/mall/products/{product_id}")).await;
    assert_eq!(product_detail_status, StatusCode::OK);
    assert_accessible_mall_image_url(
        &product_detail_body["data"]["imageUrl"],
        "mall-products/kiwi.jpeg",
    );

    let (admin_products_unauthorized_status, _) =
        get_json(&context.app, "/api/admin/mall/products").await;
    assert_eq!(admin_products_unauthorized_status, StatusCode::UNAUTHORIZED);

    let (admin_products_forbidden_status, _) =
        get_json_with_auth(&context.app, "/api/admin/mall/products", &user_token).await;
    assert_eq!(admin_products_forbidden_status, StatusCode::FORBIDDEN);

    let (admin_products_status, admin_products_body) =
        get_json_with_auth(&context.app, "/api/admin/mall/products", &admin_token).await;
    assert_eq!(admin_products_status, StatusCode::OK);
    let admin_kiwi = admin_products_body["data"]
        .as_array()
        .expect("admin products data should be an array")
        .iter()
        .find(|product| product["sku"] == "TEST-FRUIT-KIWI-6")
        .expect("seeded kiwi product should be listed for admin");
    assert_accessible_mall_image_url(&admin_kiwi["imageUrl"], "mall-products/kiwi.jpeg");

    let (admin_product_detail_status, _) = get_json(
        &context.app,
        &format!("/api/admin/mall/products/{product_id}"),
    )
    .await;
    assert_eq!(admin_product_detail_status, StatusCode::UNAUTHORIZED);

    let (admin_product_detail_status, admin_product_detail_body) = get_json_with_auth(
        &context.app,
        &format!("/api/admin/mall/products/{product_id}"),
        &admin_token,
    )
    .await;
    assert_eq!(admin_product_detail_status, StatusCode::OK);
    assert_accessible_mall_image_url(
        &admin_product_detail_body["data"]["imageUrl"],
        "mall-products/kiwi.jpeg",
    );

    let (cart_status, cart_body) = post_json(
        &context.app,
        "/api/mall/cart/items",
        json!({
            "userId": user_id,
            "productId": product_id,
            "quantity": 2
        }),
    )
    .await;
    assert_eq!(cart_status, StatusCode::OK);
    assert_eq!(cart_body["data"]["quantity"], 2);

    let (cart_payload_status, cart_payload_body) =
        get_json(&context.app, &format!("/api/mall/cart?userId={user_id}")).await;
    assert_eq!(cart_payload_status, StatusCode::OK);
    assert_accessible_mall_image_url(
        &cart_payload_body["data"]["items"][0]["product"]["imageUrl"],
        "mall-products/kiwi.jpeg",
    );

    let (address_status, address_body) = post_json(
        &context.app,
        "/api/address-books",
        json!({
            "user_id": user_id,
            "address_name": "Haymarket 88号 12F",
            "address": "Haymarket 88号 12F",
            "latitude": -33.8796,
            "longitude": 151.2056,
            "address_type": "home",
            "is_default": true
        }),
    )
    .await;
    assert_eq!(address_status, StatusCode::OK);
    let address_id = address_body["data"]["id"]
        .as_str()
        .expect("address id should exist");

    let (order_status, order_body) = post_json(
        &context.app,
        "/api/mall/orders",
        json!({
            "userId": user_id,
            "addressId": address_id,
            "expectedDeliveryWindow": "今天 18:30-19:00",
            "deliveryMethod": "无人车冷链直送",
            "pickupMethod": "短信码开舱",
            "couponCents": 1000
        }),
    )
    .await;
    assert_eq!(order_status, StatusCode::OK);
    let order = &order_body["data"];
    assert_eq!(order["status"], "pending_payment");
    assert_eq!(order["paymentStatus"], "unpaid");
    assert_eq!(order["items"].as_array().map(Vec::len), Some(1));
    assert_accessible_mall_image_url(&order["items"][0]["imageUrl"], "mall-products/kiwi.jpeg");
    let order_id = order["id"].as_str().expect("order id should exist");

    let (orders_status, orders_body) =
        get_json(&context.app, &format!("/api/mall/orders?userId={user_id}")).await;
    assert_eq!(orders_status, StatusCode::OK);
    assert_accessible_mall_image_url(
        &orders_body["data"][0]["items"][0]["imageUrl"],
        "mall-products/kiwi.jpeg",
    );

    let (order_detail_status, order_detail_body) =
        get_json(&context.app, &format!("/api/mall/orders/{order_id}")).await;
    assert_eq!(order_detail_status, StatusCode::OK);
    assert_accessible_mall_image_url(
        &order_detail_body["data"]["items"][0]["imageUrl"],
        "mall-products/kiwi.jpeg",
    );

    let (admin_orders_status, admin_orders_body) =
        get_json_with_auth(&context.app, "/api/admin/mall/orders", &admin_token).await;
    assert_eq!(admin_orders_status, StatusCode::OK);
    assert_accessible_mall_image_url(
        &admin_orders_body["data"][0]["items"][0]["imageUrl"],
        "mall-products/kiwi.jpeg",
    );

    let (admin_order_detail_status, admin_order_detail_body) = get_json_with_auth(
        &context.app,
        &format!("/api/admin/mall/orders/{order_id}"),
        &admin_token,
    )
    .await;
    assert_eq!(admin_order_detail_status, StatusCode::OK);
    assert_accessible_mall_image_url(
        &admin_order_detail_body["data"]["items"][0]["imageUrl"],
        "mall-products/kiwi.jpeg",
    );

    let (tracking_status, tracking_body) = get_json(
        &context.app,
        &format!("/api/mall/orders/{order_id}/tracking"),
    )
    .await;
    assert_eq!(tracking_status, StatusCode::OK);
    assert_accessible_mall_image_url(
        &tracking_body["data"]["order"]["items"][0]["imageUrl"],
        "mall-products/kiwi.jpeg",
    );
    assert!(tracking_body["data"]["events"]
        .as_array()
        .expect("tracking events should be an array")
        .iter()
        .any(|event| event["stage"] == "order_created"));

    context.cleanup().await;
}

#[tokio::test]
async fn mall_member_group_leader_community_and_after_sale_flows_are_backed_by_api() {
    let Some(context) = TestContext::new().await else {
        return;
    };

    let user_id = insert_user(&context.pool, "13950004001", "merchant", "邻里用户").await;
    let leader_id = insert_user(&context.pool, "13950003001", "merchant", "林团长").await;

    let (products_status, products_body) = get_json(&context.app, "/api/mall/products").await;
    assert_eq!(products_status, StatusCode::OK);
    let product_id = products_body["data"][0]["id"]
        .as_str()
        .expect("seed product id should exist");

    let (cart_status, _) = post_json(
        &context.app,
        "/api/mall/cart/items",
        json!({
            "userId": user_id,
            "productId": product_id,
            "quantity": 1
        }),
    )
    .await;
    assert_eq!(cart_status, StatusCode::OK);

    let pickup_point_id = "pickup-sanyou-central";
    let (order_status, order_body) = post_json(
        &context.app,
        "/api/mall/orders",
        json!({
            "userId": user_id,
            "pickupPointId": pickup_point_id,
            "expectedDeliveryWindow": "今天 18:30-19:00"
        }),
    )
    .await;
    assert_eq!(order_status, StatusCode::OK);
    let order_id = order_body["data"]["id"]
        .as_str()
        .expect("order id should exist");

    recorouter_api::modules::mall::settle_mall_order_payment_success(&context.pool, order_id)
        .await
        .expect("payment settlement should generate fulfillment code");

    let code: String = sqlx::query_scalar(
        "SELECT code FROM mall_fulfillment_codes WHERE order_id = $1 AND status = 'ready'",
    )
    .bind(order_id)
    .fetch_one(&context.pool)
    .await
    .expect("ready fulfillment code should exist");

    let (profile_status, profile_body) = get_json(
        &context.app,
        &format!("/api/mall/me/profile?userId={leader_id}"),
    )
    .await;
    assert_eq!(profile_status, StatusCode::OK);
    assert_eq!(profile_body["data"]["member"]["id"], leader_id);
    assert_eq!(
        profile_body["data"]["groupLeader"]["pickupPoint"]["id"],
        pickup_point_id
    );
    assert!(
        profile_body["data"]["orderCounts"]["readyForPickup"]
            .as_i64()
            .unwrap_or_default()
            >= 0
    );

    let (workbench_status, workbench_body) = get_json(
        &context.app,
        &format!("/api/mall/group-leader/workbench?userId={leader_id}"),
    )
    .await;
    assert_eq!(workbench_status, StatusCode::OK);
    assert_eq!(workbench_body["data"]["pickupPoint"]["id"], pickup_point_id);
    assert_eq!(workbench_body["data"]["today"]["pendingPickup"], 1);
    assert_eq!(workbench_body["data"]["pendingOrders"][0]["id"], order_id);

    let (verify_status, verify_body) = post_json(
        &context.app,
        "/api/mall/group-leader/verify-fulfillment",
        json!({
            "userId": leader_id,
            "orderId": order_id,
            "code": code
        }),
    )
    .await;
    assert_eq!(verify_status, StatusCode::OK);
    assert_eq!(verify_body["data"]["status"], "verified");
    assert_eq!(verify_body["data"]["verifiedBy"], leader_id);

    let (post_status, post_body) = post_json(
        &context.app,
        "/api/mall/community-posts",
        json!({
            "userId": user_id,
            "title": "今晚自提点拼团",
            "summary": "蓝莓到点后一起取",
            "content": "邻居可直接跟团。",
            "pickupPointId": pickup_point_id,
            "images": ["mall-community/blueberry.jpeg"]
        }),
    )
    .await;
    assert_eq!(post_status, StatusCode::OK);
    assert_eq!(post_body["data"]["authorUserId"], user_id);
    assert_eq!(post_body["data"]["likeCount"], 0);
    let post_id = post_body["data"]["id"]
        .as_str()
        .expect("community post id should exist");

    for _ in 0..2 {
        let (interaction_status, interaction_body) = post_json(
            &context.app,
            &format!("/api/mall/community-posts/{post_id}/interactions"),
            json!({
                "userId": user_id,
                "interactionType": "like"
            }),
        )
        .await;
        assert_eq!(interaction_status, StatusCode::OK);
        assert_eq!(interaction_body["data"]["counts"]["like"], 1);
    }

    let (after_sale_status, after_sale_body) = post_json(
        &context.app,
        &format!("/api/mall/orders/{order_id}/after-sales"),
        json!({
            "userId": user_id,
            "afterSaleType": "return_refund",
            "reason": "包装破损",
            "description": "瓶身有裂纹，需要退货退款",
            "selectedItems": [{
                "orderItemId": order_body["data"]["items"][0]["id"],
                "quantity": 1
            }],
            "requestedAmountCents": order_body["data"]["payableCents"],
            "evidenceImages": ["mall-after-sales/broken-1.jpeg", "mall-after-sales/broken-2.jpeg"]
        }),
    )
    .await;
    assert_eq!(after_sale_status, StatusCode::OK);
    assert_eq!(after_sale_body["data"]["afterSaleType"], "return_refund");
    assert_eq!(after_sale_body["data"]["status"], "submitted");
    assert_eq!(after_sale_body["data"]["solutionType"], "return_refund");
    assert_eq!(after_sale_body["data"]["negotiationStatus"], "pending");
    assert!(
        after_sale_body["data"]["supportSessionId"]
            .as_str()
            .expect("after-sale should create a support session")
            .len()
            > 0
    );
    assert_eq!(
        after_sale_body["data"]["selectedItems"]
            .as_array()
            .expect("selectedItems should be an array")
            .len(),
        1
    );
    assert_eq!(
        after_sale_body["data"]["evidenceImages"]
            .as_array()
            .expect("evidenceImages should be an array")
            .len(),
        2
    );
    let after_sale_id = after_sale_body["data"]["id"]
        .as_str()
        .expect("after-sale id should exist");
    let after_sale_admin_id = insert_user(&context.pool, "13950004003", "admin", "售后客服").await;
    let after_sale_admin_token =
        insert_session(&context.pool, &after_sale_admin_id, "mall-after-sale-admin").await;

    let (admin_status, admin_body) = get_json_with_auth(
        &context.app,
        "/api/admin/mall/after-sales",
        &after_sale_admin_token,
    )
    .await;
    assert_eq!(admin_status, StatusCode::OK);
    assert!(admin_body["data"]
        .as_array()
        .expect("admin after-sales should be an array")
        .iter()
        .any(|sale| sale["afterSaleType"] == "return_refund"));

    let (progress_status, progress_body) = put_json_with_auth(
        &context.app,
        &format!("/api/admin/mall/after-sales/{after_sale_id}"),
        &after_sale_admin_token,
        json!({
            "status": "returning",
            "handlingMethod": "退货退款",
            "solutionType": "return_refund",
            "negotiationStatus": "agreed",
            "approvedAmountCents": order_body["data"]["payableCents"],
            "resolution": "双方协商一致，等待用户退货"
        }),
    )
    .await;
    assert_eq!(progress_status, StatusCode::OK);
    assert_eq!(progress_body["data"]["status"], "returning");
    assert_eq!(progress_body["data"]["negotiationStatus"], "agreed");

    context.cleanup().await;
}

#[tokio::test]
async fn admin_mall_product_order_campaign_and_settings_endpoints_work() {
    let Some(context) = TestContext::new().await else {
        return;
    };

    let admin_id = insert_user(&context.pool, "13950003001", "admin", "后台运营").await;
    let admin_token = insert_session(&context.pool, &admin_id, "mall-admin-session-2").await;

    let (unauthorized_status, _) = post_json(
        &context.app,
        "/api/admin/mall/products",
        json!({
            "name": "未授权商品",
            "sku": "TEST-NOAUTH-001",
            "categoryCode": "milk",
            "priceCents": 1880
        }),
    )
    .await;
    assert_eq!(unauthorized_status, StatusCode::UNAUTHORIZED);

    let (product_status, product_body) = post_json_with_auth(
        &context.app,
        "/api/admin/mall/products",
        &admin_token,
        json!({
            "name": "测试鲜奶",
            "sku": "TEST-MILK-001",
            "categoryCode": "milk",
            "description": "低温鲜奶",
            "imageUrl": "mall-products/fresh-milk.jpeg",
            "priceCents": 1880,
            "stock": 12,
            "status": "on_sale",
            "tags": ["冷链", "鲜奶"],
            "deliveryMinutes": 18
        }),
    )
    .await;
    assert_eq!(product_status, StatusCode::OK);
    assert_eq!(product_body["code"], 200);
    assert_accessible_mall_image_url(
        &product_body["data"]["imageUrl"],
        "mall-products/fresh-milk.jpeg",
    );
    let product_id = product_body["data"]["id"]
        .as_str()
        .expect("product id should exist");

    let (update_status, update_body) = put_json_with_auth(
        &context.app,
        &format!("/api/admin/mall/products/{product_id}"),
        &admin_token,
        json!({
            "priceCents": 1680,
            "stock": 30,
            "status": "on_sale"
        }),
    )
    .await;
    assert_eq!(update_status, StatusCode::OK);
    assert_eq!(update_body["data"]["priceCents"], 1680);
    assert_eq!(update_body["data"]["stock"], 30);
    assert_accessible_mall_image_url(
        &update_body["data"]["imageUrl"],
        "mall-products/fresh-milk.jpeg",
    );

    let (campaign_status, campaign_body) = post_json_with_auth(
        &context.app,
        "/api/admin/mall/campaigns",
        &admin_token,
        json!({
            "name": "满99免配送",
            "campaignType": "delivery_discount",
            "budgetCents": 500000,
            "rules": {"thresholdCents": 9900, "discountCents": 600},
            "status": "draft"
        }),
    )
    .await;
    assert_eq!(campaign_status, StatusCode::OK);
    assert_eq!(campaign_body["data"]["name"], "满99免配送");

    let (settings_status, settings_body) = put_json_with_auth(
        &context.app,
        "/api/admin/mall/settings",
        &admin_token,
        json!({
            "freeDeliveryThresholdCents": 9900,
            "defaultDeliveryFeeCents": 600,
            "deliveryPromiseMinutes": 18,
            "coldChainEnabled": true,
            "refundReviewMinutes": 10
        }),
    )
    .await;
    assert_eq!(settings_status, StatusCode::OK);
    assert_eq!(settings_body["data"]["deliveryPromiseMinutes"], 18);

    context.cleanup().await;
}

#[tokio::test]
async fn support_sessions_tickets_knowledge_and_metrics_are_backed_by_api() {
    let Some(context) = TestContext::new().await else {
        return;
    };

    let user_id = insert_user(&context.pool, "13950002001", "merchant", "客服用户").await;
    let agent_id = insert_user(&context.pool, "13950002002", "admin", "客服坐席").await;

    let (session_status, session_body) = post_json(
        &context.app,
        "/api/support/sessions",
        json!({
            "userId": user_id,
            "channel": "mall_after_sales",
            "topic": "鲜奶包装破损"
        }),
    )
    .await;
    assert_eq!(session_status, StatusCode::OK);
    let session_id = session_body["data"]["id"]
        .as_str()
        .expect("session id should exist");

    let (message_status, message_body) = post_json(
        &context.app,
        &format!("/api/support/sessions/{session_id}/messages"),
        json!({
            "senderId": agent_id,
            "senderRole": "agent",
            "content": "车辆已接近目的地，若温控异常将自动触发退款或补送。"
        }),
    )
    .await;
    assert_eq!(message_status, StatusCode::OK);
    assert_eq!(message_body["data"]["senderRole"], "agent");

    let (ticket_status, ticket_body) = post_json(
        &context.app,
        "/api/support/tickets",
        json!({
            "userId": user_id,
            "sessionId": session_id,
            "category": "refund",
            "priority": "high",
            "title": "鲜奶包装破损",
            "description": "上传破损照片与说明"
        }),
    )
    .await;
    assert_eq!(ticket_status, StatusCode::OK);
    assert_eq!(ticket_body["data"]["status"], "open");

    let (_, user_sessions_body) = get_json(
        &context.app,
        &format!("/api/support/sessions?userId={user_id}"),
    )
    .await;
    assert_eq!(user_sessions_body["data"][0]["userId"], user_id);

    let (_, user_tickets_body) = get_json(
        &context.app,
        &format!("/api/support/tickets?userId={user_id}"),
    )
    .await;
    assert_eq!(user_tickets_body["data"][0]["userId"], user_id);

    let (knowledge_status, knowledge_body) = post_json(
        &context.app,
        "/api/support/knowledge",
        json!({
            "title": "冷链破损极速退款",
            "category": "after_sales",
            "content": "核验配送与冷链记录后原路退款。",
            "status": "published"
        }),
    )
    .await;
    assert_eq!(knowledge_status, StatusCode::OK);
    assert_eq!(knowledge_body["data"]["title"], "冷链破损极速退款");

    let (metrics_status, metrics_body) = get_json(&context.app, "/api/support/metrics").await;
    assert_eq!(metrics_status, StatusCode::OK);
    assert!(
        metrics_body["data"]["openTickets"]
            .as_i64()
            .unwrap_or_default()
            >= 1
    );

    context.cleanup().await;
}
