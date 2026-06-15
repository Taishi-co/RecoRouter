use axum::{
    body::{to_bytes, Body},
    http::{Request, StatusCode},
    Router,
};
use sqlx::postgres::PgPoolOptions;
use tower::ServiceExt;

use recorouter_api::{config::Config, storage::LocalStorage};

fn test_config() -> Config {
    let upload_dir = tempfile::tempdir()
        .expect("temp upload dir should be created")
        .keep();

    Config {
        database_url: "postgres://postgres:postgres@localhost:5432/recocar_test".to_string(),
        server_port: 34532,
        public_base_url: Some("https://car.shcxyz.site".to_string()),
        local_upload_dir: upload_dir,
        cos_secret_id: None,
        cos_secret_key: None,
        cos_bucket: None,
        cos_region: None,
    }
}

fn router_with_config(kind: ServiceRouterKind) -> Router {
    let config = test_config();
    let db = PgPoolOptions::new()
        .connect_lazy(&config.database_url)
        .expect("lazy db pool should be created");
    let storage = LocalStorage::new(
        config.local_upload_dir.clone(),
        config.public_base_url.clone(),
    );

    match kind {
        ServiceRouterKind::Vehicle => recorouter_api::app::vehicle_router(config, db, storage),
        ServiceRouterKind::Mall => recorouter_api::app::mall_router(config, db, storage),
        ServiceRouterKind::Platform => recorouter_api::app::platform_router(config, db, storage),
    }
}

enum ServiceRouterKind {
    Vehicle,
    Mall,
    Platform,
}

async fn options_status(app: Router, uri: &str) -> StatusCode {
    app.oneshot(
        Request::builder()
            .method("OPTIONS")
            .uri(uri)
            .body(Body::empty())
            .expect("request should build"),
    )
    .await
    .expect("request should complete")
    .status()
}

async fn get_status(app: Router, uri: &str) -> StatusCode {
    let response = app
        .oneshot(
            Request::builder()
                .method("GET")
                .uri(uri)
                .body(Body::empty())
                .expect("request should build"),
        )
        .await
        .expect("request should complete");

    let status = response.status();
    let _ = to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("response body should read");
    status
}

#[tokio::test]
async fn vehicle_router_exposes_vehicle_routes_without_mall_or_platform_business_routes() {
    let app = router_with_config(ServiceRouterKind::Vehicle);

    assert_eq!(get_status(app.clone(), "/api/health").await, StatusCode::OK);
    assert_ne!(
        options_status(app.clone(), "/api/auth/login").await,
        StatusCode::NOT_FOUND
    );
    assert_ne!(
        options_status(app.clone(), "/api/orders").await,
        StatusCode::NOT_FOUND
    );
    assert_eq!(
        options_status(app.clone(), "/api/mall/products").await,
        StatusCode::NOT_FOUND
    );
    assert_eq!(
        options_status(app, "/api/platform/settings").await,
        StatusCode::NOT_FOUND
    );
}

#[tokio::test]
async fn mall_router_exposes_mall_routes_without_vehicle_or_platform_business_routes() {
    let app = router_with_config(ServiceRouterKind::Mall);

    assert_eq!(get_status(app.clone(), "/api/health").await, StatusCode::OK);
    assert_ne!(
        options_status(app.clone(), "/api/mall/auth/login").await,
        StatusCode::NOT_FOUND
    );
    assert_ne!(
        options_status(app.clone(), "/api/mall/auth/wechat-login").await,
        StatusCode::NOT_FOUND
    );
    assert_eq!(
        options_status(app.clone(), "/api/auth/login").await,
        StatusCode::NOT_FOUND
    );
    assert_ne!(
        options_status(app.clone(), "/api/mall/products").await,
        StatusCode::NOT_FOUND
    );
    assert_eq!(
        options_status(app.clone(), "/api/orders").await,
        StatusCode::NOT_FOUND
    );
    assert_eq!(
        options_status(app.clone(), "/api/payments/prepay").await,
        StatusCode::NOT_FOUND
    );
    assert_eq!(
        options_status(app, "/api/platform/settings").await,
        StatusCode::NOT_FOUND
    );
}

#[tokio::test]
async fn platform_router_exposes_platform_routes_without_business_routes() {
    let app = router_with_config(ServiceRouterKind::Platform);

    assert_eq!(get_status(app.clone(), "/api/health").await, StatusCode::OK);
    assert_ne!(
        options_status(app.clone(), "/api/platform/settings").await,
        StatusCode::NOT_FOUND
    );
    assert_ne!(
        options_status(app.clone(), "/api/platform/payment-orders").await,
        StatusCode::NOT_FOUND
    );
    assert_ne!(
        options_status(app.clone(), "/api/platform/refund-orders").await,
        StatusCode::NOT_FOUND
    );
    assert_ne!(
        options_status(app.clone(), "/api/platform/transfer-orders").await,
        StatusCode::NOT_FOUND
    );
    assert_ne!(
        options_status(app.clone(), "/api/platform/split-plans").await,
        StatusCode::NOT_FOUND
    );
    assert_ne!(
        options_status(app.clone(), "/api/platform/audit-logs").await,
        StatusCode::NOT_FOUND
    );
    assert_ne!(
        options_status(app.clone(), "/api/payments/prepay").await,
        StatusCode::NOT_FOUND
    );
    assert_eq!(
        options_status(app.clone(), "/api/orders").await,
        StatusCode::NOT_FOUND
    );
    assert_eq!(
        options_status(app, "/api/mall/products").await,
        StatusCode::NOT_FOUND
    );
}
