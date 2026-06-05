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
