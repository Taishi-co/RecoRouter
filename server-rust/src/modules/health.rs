use axum::{routing::get, Json, Router};
use chrono::Utc;

use crate::response::{status_success, StatusSuccess};

const HELLO_MESSAGE: &str = "Hello, welcome to coze coding mini-program server!";

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
{
    Router::new()
        .route("/api/hello", get(hello))
        .route("/api/health", get(health))
}

async fn hello() -> Json<StatusSuccess<&'static str>> {
    status_success(HELLO_MESSAGE)
}

async fn health() -> Json<StatusSuccess<String>> {
    status_success(Utc::now().to_rfc3339())
}
