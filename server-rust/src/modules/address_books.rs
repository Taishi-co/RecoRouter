use axum::{
    extract::{Path, Query, State},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use serde_json::{json, Value};

use crate::{
    app::AppState,
    error::{ApiError, ApiResult},
    response::ok,
    storage::Storage,
};

pub fn router<S>() -> Router<AppState<S>>
where
    S: Storage,
{
    Router::new()
        .route(
            "/api/address-books",
            get(list_addresses::<S>).post(create_address::<S>),
        )
        .route(
            "/api/address-books/:id",
            get(get_address::<S>)
                .put(update_address::<S>)
                .delete(delete_address::<S>),
        )
        .route(
            "/api/address-books/:id/set-default",
            post(set_default_address::<S>),
        )
}

#[derive(Debug, Deserialize)]
struct UserIdQuery {
    user_id: Option<String>,
}

#[derive(Debug, Deserialize)]
struct CreateAddressRequest {
    user_id: String,
    address_name: String,
    address: String,
    latitude: f64,
    longitude: f64,
    address_type: Option<String>,
    is_default: Option<bool>,
}

#[derive(Debug, Deserialize)]
struct UpdateAddressRequest {
    address_name: Option<String>,
    address: Option<String>,
    latitude: Option<f64>,
    longitude: Option<f64>,
    address_type: Option<String>,
    is_default: Option<bool>,
}

async fn create_address<S>(
    State(state): State<AppState<S>>,
    Json(body): Json<CreateAddressRequest>,
) -> ApiResult<Response>
where
    S: Storage,
{
    validate_required(&body.user_id, "用户ID不能为空")?;
    validate_required(&body.address_name, "地址名称不能为空")?;
    validate_required(&body.address, "详细地址不能为空")?;
    if let Some(address_type) = body.address_type.as_deref() {
        validate_address_type(address_type)?;
    }

    let is_default = body.is_default.unwrap_or(false);
    let address_type = body.address_type.unwrap_or_else(|| "other".to_string());
    let mut tx = state.db.begin().await?;

    if is_default {
        sqlx::query("UPDATE address_books SET is_default = false WHERE user_id = $1")
            .bind(&body.user_id)
            .execute(&mut *tx)
            .await?;
    }

    let address = sqlx::query_scalar::<_, Value>(
        r#"
        INSERT INTO address_books (
            user_id, address_name, address, latitude, longitude, address_type, is_default
        )
        VALUES ($1, $2, $3, $4::numeric, $5::numeric, $6, $7)
        RETURNING row_to_json(address_books)
        "#,
    )
    .bind(&body.user_id)
    .bind(&body.address_name)
    .bind(&body.address)
    .bind(body.latitude)
    .bind(body.longitude)
    .bind(address_type)
    .bind(is_default)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(ok("地址创建成功", address).into_response())
}

async fn list_addresses<S>(
    State(state): State<AppState<S>>,
    Query(query): Query<UserIdQuery>,
) -> ApiResult<Response>
where
    S: Storage,
{
    let Some(user_id) = non_empty(query.user_id) else {
        return Ok(code_400_body("用户ID不能为空"));
    };

    let addresses = sqlx::query_scalar::<_, Value>(
        r#"
        SELECT row_to_json(address_row)
        FROM (
            SELECT *
            FROM address_books
            WHERE user_id = $1
            ORDER BY is_default DESC, created_at DESC
        ) address_row
        "#,
    )
    .bind(user_id)
    .fetch_all(&state.db)
    .await?;

    Ok(ok("查询成功", addresses).into_response())
}

async fn get_address<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
) -> ApiResult<Response>
where
    S: Storage,
{
    let address = fetch_address(&state.db, &id).await?;

    Ok(ok("查询成功", address).into_response())
}

async fn update_address<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
    Json(body): Json<UpdateAddressRequest>,
) -> ApiResult<Response>
where
    S: Storage,
{
    if let Some(address_type) = body.address_type.as_deref() {
        validate_address_type(address_type)?;
    }

    let user_id: String = sqlx::query_scalar("SELECT user_id FROM address_books WHERE id = $1")
        .bind(&id)
        .fetch_optional(&state.db)
        .await?
        .flatten()
        .ok_or_else(|| ApiError::NotFound("地址不存在".to_string()))?;

    let mut tx = state.db.begin().await?;
    if body.is_default == Some(true) {
        sqlx::query("UPDATE address_books SET is_default = false WHERE user_id = $1 AND id <> $2")
            .bind(&user_id)
            .bind(&id)
            .execute(&mut *tx)
            .await?;
    }

    let address = sqlx::query_scalar::<_, Value>(
        r#"
        UPDATE address_books
        SET address_name = COALESCE($2, address_name),
            address = COALESCE($3, address),
            latitude = COALESCE($4::numeric, latitude),
            longitude = COALESCE($5::numeric, longitude),
            address_type = COALESCE($6, address_type),
            is_default = COALESCE($7, is_default),
            updated_at = now()
        WHERE id = $1
        RETURNING row_to_json(address_books)
        "#,
    )
    .bind(&id)
    .bind(body.address_name)
    .bind(body.address)
    .bind(body.latitude)
    .bind(body.longitude)
    .bind(body.address_type)
    .bind(body.is_default)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| ApiError::NotFound("地址不存在".to_string()))?;

    tx.commit().await?;

    Ok(ok("地址更新成功", address).into_response())
}

async fn delete_address<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
) -> ApiResult<Response>
where
    S: Storage,
{
    let deleted: Option<String> =
        sqlx::query_scalar("DELETE FROM address_books WHERE id = $1 RETURNING id")
            .bind(&id)
            .fetch_optional(&state.db)
            .await?;

    if deleted.is_none() {
        return Err(ApiError::NotFound("地址不存在".to_string()));
    }

    Ok(ok("地址删除成功", Value::Null).into_response())
}

async fn set_default_address<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
) -> ApiResult<Response>
where
    S: Storage,
{
    let user_id: String = sqlx::query_scalar("SELECT user_id FROM address_books WHERE id = $1")
        .bind(&id)
        .fetch_optional(&state.db)
        .await?
        .flatten()
        .ok_or_else(|| ApiError::NotFound("地址不存在".to_string()))?;

    let mut tx = state.db.begin().await?;
    sqlx::query("UPDATE address_books SET is_default = false WHERE user_id = $1")
        .bind(&user_id)
        .execute(&mut *tx)
        .await?;

    let address = sqlx::query_scalar::<_, Value>(
        r#"
        UPDATE address_books
        SET is_default = true,
            updated_at = now()
        WHERE id = $1
        RETURNING row_to_json(address_books)
        "#,
    )
    .bind(&id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| ApiError::NotFound("地址不存在".to_string()))?;

    tx.commit().await?;

    Ok(ok("设置默认地址成功", address).into_response())
}

async fn fetch_address(pool: &sqlx::PgPool, id: &str) -> ApiResult<Value> {
    sqlx::query_scalar::<_, Value>(
        "SELECT row_to_json(address_books) FROM address_books WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| ApiError::NotFound("地址不存在".to_string()))
}

fn code_400_body(message: &str) -> Response {
    Json(json!({
        "code": 400,
        "message": message,
        "data": Value::Null
    }))
    .into_response()
}

fn validate_required(value: &str, message: &str) -> ApiResult<()> {
    if value.trim().is_empty() {
        return Err(ApiError::BadRequest(message.to_string()));
    }

    Ok(())
}

fn validate_address_type(value: &str) -> ApiResult<()> {
    if matches!(value, "home" | "work" | "other") {
        Ok(())
    } else {
        Err(ApiError::BadRequest("地址类型不正确".to_string()))
    }
}

fn non_empty(value: Option<String>) -> Option<String> {
    value.and_then(|value| {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    })
}
