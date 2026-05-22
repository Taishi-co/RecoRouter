use axum::{
    extract::{Path, Query, State},
    routing::{get, post, put},
    Json, Router,
};
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::{FromRow, PgPool};

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
        .route("/api/cancellations/request", post(request_cancel::<S>))
        .route(
            "/api/cancellations/credit-score",
            get(get_credit_score::<S>),
        )
        .route("/api/cancellations/pending", get(pending_requests::<S>))
        .route("/api/cancellations/:id/handle", put(handle_request::<S>))
}

#[derive(Debug, Deserialize)]
struct RequestCancelBody {
    order_id: String,
    reason: Option<String>,
    merchant_id: String,
}

#[derive(Debug, Deserialize)]
struct HandleRequestBody {
    action: String,
    response_reason: Option<String>,
    owner_id: String,
}

#[derive(Debug, Deserialize)]
struct PendingQuery {
    owner_id: String,
}

#[derive(Debug, Deserialize)]
struct CreditScoreQuery {
    user_id: String,
}

#[derive(Debug, FromRow)]
struct OrderRow {
    id: String,
    demand_id: Option<String>,
    vehicle_id: Option<String>,
    merchant_id: Option<String>,
    owner_id: Option<String>,
    status: Option<String>,
    merchant_confirmed: Option<bool>,
}

#[derive(Debug, FromRow)]
struct CancellationRequestRow {
    order_id: Option<String>,
    requestor_id: Option<String>,
    responder_id: Option<String>,
    reason: Option<String>,
    status: Option<String>,
}

async fn request_cancel<S>(
    State(state): State<AppState<S>>,
    Json(body): Json<RequestCancelBody>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let order = fetch_order(&state.db, &body.order_id).await?;
    if order.merchant_id.as_deref() != Some(body.merchant_id.as_str()) {
        return Err(ApiError::BadRequest("无权操作此订单".to_string()));
    }
    if !order.merchant_confirmed.unwrap_or(false) {
        return Err(ApiError::BadRequest(
            "运费未确认，无需申请取消，可以直接取消".to_string(),
        ));
    }
    if order.status.as_deref() != Some("accepted") {
        return Err(ApiError::BadRequest(
            "只有已接单且运费已确认的订单可以申请取消".to_string(),
        ));
    }

    let existing: bool = sqlx::query_scalar(
        r#"
        SELECT EXISTS (
            SELECT 1 FROM cancellation_requests
            WHERE order_id = $1 AND status = 'pending'
        )
        "#,
    )
    .bind(&body.order_id)
    .fetch_one(&state.db)
    .await?;
    if existing {
        return Err(ApiError::BadRequest("已有待处理的取消申请".to_string()));
    }

    let request = sqlx::query_scalar::<_, Value>(
        r#"
        INSERT INTO cancellation_requests (
            order_id, requestor_id, responder_id, reason, status
        )
        VALUES ($1, $2, $3, $4, 'pending')
        RETURNING row_to_json(cancellation_requests)
        "#,
    )
    .bind(&body.order_id)
    .bind(&body.merchant_id)
    .bind(&order.owner_id)
    .bind(&body.reason)
    .fetch_one(&state.db)
    .await
    .map_err(|err| ApiError::BadRequest(format!("创建取消申请失败: {err}")))?;

    create_notification(
        &state.db,
        order.owner_id.as_deref(),
        "cancellation_requested",
        "订单取消申请",
        &format!(
            "需求方申请取消订单，原因：{}",
            body.reason.as_deref().unwrap_or("")
        ),
        Some(&order.id),
        order.demand_id.as_deref(),
    )
    .await;

    Ok(ok("取消申请已提交，等待车主处理", request))
}

async fn handle_request<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
    Json(body): Json<HandleRequestBody>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let request = fetch_request(&state.db, &id).await?;
    if request.responder_id.as_deref() != Some(body.owner_id.as_str()) {
        return Err(ApiError::BadRequest("无权处理此申请".to_string()));
    }
    if request.status.as_deref() != Some("pending") {
        return Err(ApiError::BadRequest("该申请已被处理".to_string()));
    }
    let order_id = request.order_id.as_deref().unwrap_or_default();
    let order = fetch_order(&state.db, order_id).await?;

    match body.action.as_str() {
        "approve" => approve_request(&state.db, &id, &request, &order, body.response_reason).await,
        "reject" => reject_request(&state.db, &id, &request, &order, body.response_reason).await,
        _ => Err(ApiError::BadRequest("操作类型不正确".to_string())),
    }
}

async fn pending_requests<S>(
    State(state): State<AppState<S>>,
    Query(query): Query<PendingQuery>,
) -> ApiResult<Json<ApiEnvelope<Vec<Value>>>>
where
    S: Storage,
{
    let requests = sqlx::query_scalar::<_, Value>(
        r#"
        SELECT jsonb_build_object(
            'id', cr.id,
            'order_id', cr.order_id,
            'requestor_id', cr.requestor_id,
            'responder_id', cr.responder_id,
            'reason', cr.reason,
            'status', cr.status,
            'response_reason', cr.response_reason,
            'responded_at', cr.responded_at,
            'created_at', cr.created_at,
            'orders', COALESCE(
                jsonb_build_object(
                    'id', o.id,
                    'demand_id', o.demand_id,
                    'fare_price', o.fare_price,
                    'merchant_confirmed', o.merchant_confirmed
                ),
                '{}'::jsonb
            ),
            'demands', COALESCE(
                jsonb_build_object(
                    'id', d.id,
                    'cargo_name', d.cargo_name,
                    'pickup_address', d.pickup_address,
                    'delivery_address', d.delivery_address
                ),
                '{}'::jsonb
            )
        )
        FROM cancellation_requests cr
        LEFT JOIN orders o ON o.id = cr.order_id
        LEFT JOIN demands d ON d.id = o.demand_id
        WHERE cr.responder_id = $1 AND cr.status = 'pending'
        ORDER BY cr.created_at DESC
        "#,
    )
    .bind(query.owner_id)
    .fetch_all(&state.db)
    .await
    .map_err(|err| ApiError::BadRequest(format!("查询失败: {err}")))?;

    Ok(ok("查询成功", requests))
}

async fn get_credit_score<S>(
    State(state): State<AppState<S>>,
    Query(query): Query<CreditScoreQuery>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let credit_score: Option<i32> =
        sqlx::query_scalar("SELECT credit_score FROM users WHERE id = $1")
            .bind(query.user_id)
            .fetch_optional(&state.db)
            .await?
            .ok_or_else(|| ApiError::NotFound("用户不存在".to_string()))?;

    Ok(ok(
        "查询成功",
        json!({ "credit_score": credit_score.unwrap_or(100) }),
    ))
}

async fn approve_request(
    pool: &PgPool,
    request_id: &str,
    request: &CancellationRequestRow,
    order: &OrderRow,
    response_reason: Option<String>,
) -> ApiResult<Json<ApiEnvelope<Value>>> {
    if let Some(requestor_id) = request.requestor_id.as_deref() {
        sqlx::query(
            r#"
            UPDATE users
            SET credit_score = GREATEST(0, COALESCE(credit_score, 100) - 10),
                updated_at = now()
            WHERE id = $1
            "#,
        )
        .bind(requestor_id)
        .execute(pool)
        .await?;
    }

    sqlx::query(
        r#"
        UPDATE cancellation_requests
        SET status = 'approved', response_reason = $2, responded_at = now()
        WHERE id = $1
        "#,
    )
    .bind(request_id)
    .bind(&response_reason)
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        UPDATE orders
        SET status = 'cancelled',
            cancel_reason = $2,
            cancel_time = now(),
            updated_at = now()
        WHERE id = $1
        "#,
    )
    .bind(&order.id)
    .bind(format!(
        "双方协商取消：{}",
        request.reason.as_deref().unwrap_or("")
    ))
    .execute(pool)
    .await?;

    if let Some(demand_id) = order.demand_id.as_deref() {
        sqlx::query(
            "UPDATE demands SET status = 'pending', owner_id = null, updated_at = now() WHERE id = $1",
        )
        .bind(demand_id)
        .execute(pool)
        .await?;
    }
    if let Some(vehicle_id) = order.vehicle_id.as_deref() {
        sqlx::query("UPDATE vehicles SET trip_status = 'idle', updated_at = now() WHERE id = $1")
            .bind(vehicle_id)
            .execute(pool)
            .await?;
    }

    create_notification(
        pool,
        request.requestor_id.as_deref(),
        "cancellation_approved",
        "取消申请已同意",
        "车主同意了您的取消申请，已扣除10分信用积分",
        Some(&order.id),
        order.demand_id.as_deref(),
    )
    .await;

    Ok(ok("已同意取消，需求方信用积分已扣除10分", Value::Null))
}

async fn reject_request(
    pool: &PgPool,
    request_id: &str,
    request: &CancellationRequestRow,
    order: &OrderRow,
    response_reason: Option<String>,
) -> ApiResult<Json<ApiEnvelope<Value>>> {
    sqlx::query(
        r#"
        UPDATE cancellation_requests
        SET status = 'rejected', response_reason = $2, responded_at = now()
        WHERE id = $1
        "#,
    )
    .bind(request_id)
    .bind(&response_reason)
    .execute(pool)
    .await?;

    create_notification(
        pool,
        request.requestor_id.as_deref(),
        "cancellation_rejected",
        "取消申请已拒绝",
        &format!(
            "车主拒绝了您的取消申请，原因：{}",
            response_reason.as_deref().unwrap_or("")
        ),
        Some(&order.id),
        order.demand_id.as_deref(),
    )
    .await;

    Ok(ok("已拒绝取消申请", Value::Null))
}

async fn fetch_order(pool: &PgPool, order_id: &str) -> ApiResult<OrderRow> {
    sqlx::query_as::<_, OrderRow>(
        r#"
        SELECT
            id,
            demand_id,
            vehicle_id,
            merchant_id,
            owner_id,
            status,
            merchant_confirmed
        FROM orders
        WHERE id = $1
        "#,
    )
    .bind(order_id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| ApiError::NotFound("订单不存在".to_string()))
}

async fn fetch_request(pool: &PgPool, request_id: &str) -> ApiResult<CancellationRequestRow> {
    sqlx::query_as::<_, CancellationRequestRow>(
        r#"
        SELECT order_id, requestor_id, responder_id, reason, status
        FROM cancellation_requests
        WHERE id = $1
        "#,
    )
    .bind(request_id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| ApiError::NotFound("取消申请不存在".to_string()))
}

async fn create_notification(
    pool: &PgPool,
    user_id: Option<&str>,
    notification_type: &str,
    title: &str,
    content: &str,
    related_order_id: Option<&str>,
    related_demand_id: Option<&str>,
) {
    let Some(user_id) = user_id else {
        return;
    };
    let _ = sqlx::query(
        r#"
        INSERT INTO notifications (
            user_id, type, title, content, related_order_id, related_demand_id, is_read
        )
        VALUES ($1, $2, $3, $4, $5, $6, false)
        "#,
    )
    .bind(user_id)
    .bind(notification_type)
    .bind(title)
    .bind(content)
    .bind(related_order_id)
    .bind(related_demand_id)
    .execute(pool)
    .await;
}
