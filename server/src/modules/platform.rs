use axum::{extract::State, routing::get, Json, Router};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::{
    app::AppState,
    error::{ApiError, ApiResult},
    response::{ok, ApiEnvelope},
    storage::Storage,
};

pub fn router<S>() -> Router<AppState<S>>
where
    S: Storage,
{
    Router::new()
        .route(
            "/api/platform/settings",
            get(get_settings::<S>).put(update_settings::<S>),
        )
        .route("/api/platform/payment-qr", get(get_payment_qr::<S>))
}

#[derive(Debug, Deserialize)]
struct UpdateSettingsRequest {
    #[serde(rename = "commissionRate")]
    commission_rate: Option<f64>,
    #[serde(rename = "commissionPaymentQr")]
    commission_payment_qr: Option<String>,
}

#[derive(Debug, Serialize)]
struct PaymentQrResponse {
    #[serde(rename = "paymentQr")]
    payment_qr: String,
}

async fn get_settings<S>(
    State(state): State<AppState<S>>,
) -> ApiResult<Json<ApiEnvelope<Option<Value>>>>
where
    S: Storage,
{
    let settings = sqlx::query_scalar::<_, Value>(
        r#"
        SELECT row_to_json(settings)
        FROM (
            SELECT id, commission_rate, commission_payment_qr, updated_at, created_at
            FROM platform_settings
            WHERE id = 'default'
        ) settings
        "#,
    )
    .fetch_optional(&state.db)
    .await?;

    Ok(ok("查询成功", settings))
}

async fn update_settings<S>(
    State(state): State<AppState<S>>,
    Json(body): Json<UpdateSettingsRequest>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let exists: bool =
        sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM platform_settings WHERE id = 'default')")
            .fetch_one(&state.db)
            .await?;

    if !exists {
        return Err(ApiError::NotFound("平台配置不存在".to_string()));
    }

    let settings = sqlx::query_scalar::<_, Value>(
        r#"
        UPDATE platform_settings
        SET commission_rate = COALESCE($1::numeric, commission_rate),
            commission_payment_qr = COALESCE($2, commission_payment_qr),
            updated_at = now()
        WHERE id = 'default'
        RETURNING row_to_json(platform_settings)
        "#,
    )
    .bind(body.commission_rate)
    .bind(body.commission_payment_qr)
    .fetch_one(&state.db)
    .await?;

    Ok(ok("更新成功", settings))
}

async fn get_payment_qr<S>(
    State(state): State<AppState<S>>,
) -> ApiResult<Json<ApiEnvelope<PaymentQrResponse>>>
where
    S: Storage,
{
    let key: Option<String> = sqlx::query_scalar(
        "SELECT commission_payment_qr FROM platform_settings WHERE id = 'default'",
    )
    .fetch_optional(&state.db)
    .await?
    .flatten();

    let key = key
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .ok_or_else(|| ApiError::NotFound("平台收款码未设置".to_string()))?;
    let payment_qr = state.storage.public_url(&key).await?;

    Ok(ok("查询成功", PaymentQrResponse { payment_qr }))
}
