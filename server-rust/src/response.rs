use axum::Json;
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct ApiEnvelope<T> {
    pub code: u16,
    pub message: String,
    pub data: T,
}

pub fn ok<T>(message: impl Into<String>, data: T) -> Json<ApiEnvelope<T>>
where
    T: Serialize,
{
    Json(ApiEnvelope {
        code: 200,
        message: message.into(),
        data,
    })
}

#[derive(Debug, Serialize)]
pub struct StatusSuccess<T> {
    pub status: &'static str,
    pub data: T,
}

pub fn status_success<T>(data: T) -> Json<StatusSuccess<T>>
where
    T: Serialize,
{
    Json(StatusSuccess {
        status: "success",
        data,
    })
}

#[derive(Debug, Serialize)]
pub struct EmptyMessage {
    pub code: u16,
    pub message: String,
}

pub fn empty_message(message: impl Into<String>) -> Json<EmptyMessage> {
    Json(EmptyMessage {
        code: 200,
        message: message.into(),
    })
}
