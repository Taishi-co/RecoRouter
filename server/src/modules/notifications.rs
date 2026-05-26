use axum::{
    extract::{Path, Query, State},
    routing::{get, post, put},
    Json, Router,
};
use serde::Deserialize;
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
            "/api/notifications",
            post(create_notification::<S>).get(list_notifications::<S>),
        )
        .route("/api/notifications/unread-count", get(unread_count::<S>))
        .route("/api/notifications/mark-all-read", put(mark_all_read::<S>))
        .route("/api/notifications/:id/mark-read", put(mark_read::<S>))
}

#[derive(Debug, Deserialize)]
struct CreateNotificationRequest {
    #[serde(rename = "userId", alias = "user_id")]
    user_id: String,
    #[serde(rename = "type")]
    notification_type: String,
    title: String,
    content: String,
    #[serde(rename = "relatedOrderId", alias = "related_order_id")]
    related_order_id: Option<String>,
    #[serde(rename = "relatedDemandId", alias = "related_demand_id")]
    related_demand_id: Option<String>,
}

#[derive(Debug, Deserialize)]
struct NotificationQuery {
    user_id: String,
    unread_only: Option<String>,
    page: Option<i64>,
    limit: Option<i64>,
}

#[derive(Debug, Deserialize)]
struct UserBody {
    user_id: String,
}

async fn create_notification<S>(
    State(state): State<AppState<S>>,
    Json(body): Json<CreateNotificationRequest>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let user_exists: bool = sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM users WHERE id = $1)")
        .bind(&body.user_id)
        .fetch_one(&state.db)
        .await?;

    if !user_exists {
        return Err(ApiError::BadRequest("用户不存在".to_string()));
    }

    let notification = sqlx::query_scalar::<_, Value>(
        r#"
        INSERT INTO notifications (
            user_id, type, title, content, related_order_id, related_demand_id, is_read
        )
        VALUES ($1, $2, $3, $4, $5, $6, false)
        RETURNING row_to_json(notifications)
        "#,
    )
    .bind(&body.user_id)
    .bind(&body.notification_type)
    .bind(&body.title)
    .bind(&body.content)
    .bind(&body.related_order_id)
    .bind(&body.related_demand_id)
    .fetch_one(&state.db)
    .await
    .map_err(|err| ApiError::BadRequest(format!("创建通知失败: {err}")))?;

    Ok(ok("通知创建成功", notification))
}

async fn list_notifications<S>(
    State(state): State<AppState<S>>,
    Query(query): Query<NotificationQuery>,
) -> ApiResult<Json<ApiEnvelope<Vec<Value>>>>
where
    S: Storage,
{
    let unread_only = query.unread_only.as_deref() == Some("true");
    let page = query.page.unwrap_or(1).max(1);
    let limit = query.limit.unwrap_or(20).clamp(1, 50);
    let offset = (page - 1) * limit;
    let notifications = sqlx::query_scalar::<_, Value>(
        r#"
        SELECT row_to_json(notification_row)
        FROM (
            SELECT *
            FROM notifications
            WHERE user_id = $1
              AND ($2::boolean = false OR is_read = false)
            ORDER BY created_at DESC, id DESC
            LIMIT $3 OFFSET $4
        ) notification_row
        "#,
    )
    .bind(&query.user_id)
    .bind(unread_only)
    .bind(limit)
    .bind(offset)
    .fetch_all(&state.db)
    .await
    .map_err(|err| ApiError::BadRequest(format!("查询通知失败: {err}")))?;

    Ok(ok("查询成功", notifications))
}

async fn unread_count<S>(
    State(state): State<AppState<S>>,
    Query(query): Query<NotificationQuery>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false",
    )
    .bind(&query.user_id)
    .fetch_one(&state.db)
    .await
    .map_err(|err| ApiError::BadRequest(format!("查询失败: {err}")))?;

    Ok(ok(
        "查询成功",
        serde_json::json!({
            "unreadCount": count
        }),
    ))
}

async fn mark_read<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
    Json(body): Json<UserBody>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let exists: bool = sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM notifications WHERE id = $1 AND user_id = $2)",
    )
    .bind(&id)
    .bind(&body.user_id)
    .fetch_one(&state.db)
    .await?;

    if !exists {
        return Err(ApiError::NotFound("通知不存在".to_string()));
    }

    let notification = sqlx::query_scalar::<_, Value>(
        r#"
        UPDATE notifications
        SET is_read = true
        WHERE id = $1
        RETURNING row_to_json(notifications)
        "#,
    )
    .bind(&id)
    .fetch_one(&state.db)
    .await
    .map_err(|err| ApiError::BadRequest(format!("更新失败: {err}")))?;

    Ok(ok("已标记为已读", notification))
}

async fn mark_all_read<S>(
    State(state): State<AppState<S>>,
    Json(body): Json<UserBody>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    sqlx::query("UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false")
        .bind(&body.user_id)
        .execute(&state.db)
        .await
        .map_err(|err| ApiError::BadRequest(format!("批量标记失败: {err}")))?;

    Ok(ok("已全部标记为已读", Value::Null))
}
