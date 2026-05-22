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
            "/api/favorite-routes",
            get(list_routes::<S>).post(create_route::<S>),
        )
        .route(
            "/api/favorite-routes/:id",
            get(get_route::<S>)
                .put(update_route::<S>)
                .delete(delete_route::<S>),
        )
        .route(
            "/api/favorite-routes/:id/increment-use-count",
            post(increment_use_count::<S>),
        )
}

#[derive(Debug, Deserialize)]
struct UserIdQuery {
    user_id: Option<String>,
}

#[derive(Debug, Deserialize)]
struct CreateRouteRequest {
    user_id: String,
    route_name: String,
    pickup_address_id: Option<String>,
    delivery_address_id: Option<String>,
    pickup_address_name: Option<String>,
    pickup_address: Option<String>,
    pickup_lat: Option<f64>,
    pickup_lng: Option<f64>,
    delivery_address_name: Option<String>,
    delivery_address: Option<String>,
    delivery_lat: Option<f64>,
    delivery_lng: Option<f64>,
    estimated_distance: Option<f64>,
    estimated_fare: Option<f64>,
}

#[derive(Debug, Deserialize)]
struct UpdateRouteRequest {
    route_name: Option<String>,
    pickup_address_id: Option<String>,
    delivery_address_id: Option<String>,
    pickup_address_name: Option<String>,
    pickup_address: Option<String>,
    pickup_lat: Option<f64>,
    pickup_lng: Option<f64>,
    delivery_address_name: Option<String>,
    delivery_address: Option<String>,
    delivery_lat: Option<f64>,
    delivery_lng: Option<f64>,
    estimated_distance: Option<f64>,
    estimated_fare: Option<f64>,
}

async fn create_route<S>(
    State(state): State<AppState<S>>,
    Json(body): Json<CreateRouteRequest>,
) -> ApiResult<Response>
where
    S: Storage,
{
    validate_required(&body.user_id, "用户ID不能为空")?;
    validate_required(&body.route_name, "线路名称不能为空")?;

    let pickup_address_id = normalize_optional_text(body.pickup_address_id);
    let delivery_address_id = normalize_optional_text(body.delivery_address_id);
    validate_address_id(&state.db, pickup_address_id.as_deref(), "取货地址不存在").await?;
    validate_address_id(&state.db, delivery_address_id.as_deref(), "收货地址不存在").await?;

    let route_id: String = sqlx::query_scalar(
        r#"
        INSERT INTO favorite_routes (
            user_id, route_name, pickup_address_id, delivery_address_id,
            pickup_address_name, pickup_address, pickup_lat, pickup_lng,
            delivery_address_name, delivery_address, delivery_lat, delivery_lng,
            estimated_distance, estimated_fare, use_count
        )
        VALUES (
            $1, $2, $3, $4,
            $5, $6, $7::numeric, $8::numeric,
            $9, $10, $11::numeric, $12::numeric,
            $13::numeric, $14::numeric, 0
        )
        RETURNING id
        "#,
    )
    .bind(&body.user_id)
    .bind(&body.route_name)
    .bind(&pickup_address_id)
    .bind(&delivery_address_id)
    .bind(body.pickup_address_name)
    .bind(body.pickup_address)
    .bind(body.pickup_lat)
    .bind(body.pickup_lng)
    .bind(body.delivery_address_name)
    .bind(body.delivery_address)
    .bind(body.delivery_lat)
    .bind(body.delivery_lng)
    .bind(body.estimated_distance)
    .bind(body.estimated_fare)
    .fetch_one(&state.db)
    .await?;

    let route = fetch_enriched_route(&state.db, &route_id).await?;

    Ok(ok("常用线路创建成功", route).into_response())
}

async fn list_routes<S>(
    State(state): State<AppState<S>>,
    Query(query): Query<UserIdQuery>,
) -> ApiResult<Response>
where
    S: Storage,
{
    let Some(user_id) = non_empty(query.user_id) else {
        return Ok(code_400_body("用户ID不能为空"));
    };

    let routes = sqlx::query_scalar::<_, Value>(
        r#"
        SELECT row_to_json(route_row)
        FROM (
            SELECT
                fr.*,
                CASE
                    WHEN pickup.id IS NULL THEN NULL
                    ELSE json_build_object(
                        'id', pickup.id,
                        'address_name', pickup.address_name,
                        'address', pickup.address,
                        'latitude', pickup.latitude,
                        'longitude', pickup.longitude
                    )
                END AS pickup_address,
                CASE
                    WHEN delivery.id IS NULL THEN NULL
                    ELSE json_build_object(
                        'id', delivery.id,
                        'address_name', delivery.address_name,
                        'address', delivery.address,
                        'latitude', delivery.latitude,
                        'longitude', delivery.longitude
                    )
                END AS delivery_address
            FROM favorite_routes fr
            LEFT JOIN address_books pickup ON pickup.id = fr.pickup_address_id
            LEFT JOIN address_books delivery ON delivery.id = fr.delivery_address_id
            WHERE fr.user_id = $1
            ORDER BY fr.use_count DESC, fr.created_at DESC
        ) route_row
        "#,
    )
    .bind(user_id)
    .fetch_all(&state.db)
    .await?;

    Ok(ok("查询成功", routes).into_response())
}

async fn get_route<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
) -> ApiResult<Response>
where
    S: Storage,
{
    let route = fetch_enriched_route(&state.db, &id).await?;

    Ok(ok("查询成功", route).into_response())
}

async fn update_route<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
    Json(body): Json<UpdateRouteRequest>,
) -> ApiResult<Response>
where
    S: Storage,
{
    ensure_route_exists(&state.db, &id).await?;

    let pickup_address_id = normalize_optional_text(body.pickup_address_id);
    let delivery_address_id = normalize_optional_text(body.delivery_address_id);
    validate_address_id(&state.db, pickup_address_id.as_deref(), "取货地址不存在").await?;
    validate_address_id(&state.db, delivery_address_id.as_deref(), "收货地址不存在").await?;

    let route_id: Option<String> = sqlx::query_scalar(
        r#"
        UPDATE favorite_routes
        SET route_name = COALESCE($2, route_name),
            pickup_address_id = COALESCE($3, pickup_address_id),
            delivery_address_id = COALESCE($4, delivery_address_id),
            pickup_address_name = COALESCE($5, pickup_address_name),
            pickup_address = COALESCE($6, pickup_address),
            pickup_lat = COALESCE($7::numeric, pickup_lat),
            pickup_lng = COALESCE($8::numeric, pickup_lng),
            delivery_address_name = COALESCE($9, delivery_address_name),
            delivery_address = COALESCE($10, delivery_address),
            delivery_lat = COALESCE($11::numeric, delivery_lat),
            delivery_lng = COALESCE($12::numeric, delivery_lng),
            estimated_distance = COALESCE($13::numeric, estimated_distance),
            estimated_fare = COALESCE($14::numeric, estimated_fare),
            updated_at = now()
        WHERE id = $1
        RETURNING id
        "#,
    )
    .bind(&id)
    .bind(body.route_name)
    .bind(&pickup_address_id)
    .bind(&delivery_address_id)
    .bind(body.pickup_address_name)
    .bind(body.pickup_address)
    .bind(body.pickup_lat)
    .bind(body.pickup_lng)
    .bind(body.delivery_address_name)
    .bind(body.delivery_address)
    .bind(body.delivery_lat)
    .bind(body.delivery_lng)
    .bind(body.estimated_distance)
    .bind(body.estimated_fare)
    .fetch_optional(&state.db)
    .await?;

    let route_id = route_id.ok_or_else(|| ApiError::NotFound("线路不存在".to_string()))?;
    let route = fetch_enriched_route(&state.db, &route_id).await?;

    Ok(ok("常用线路更新成功", route).into_response())
}

async fn delete_route<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
) -> ApiResult<Response>
where
    S: Storage,
{
    let deleted: Option<String> =
        sqlx::query_scalar("DELETE FROM favorite_routes WHERE id = $1 RETURNING id")
            .bind(&id)
            .fetch_optional(&state.db)
            .await?;

    if deleted.is_none() {
        return Err(ApiError::NotFound("线路不存在".to_string()));
    }

    Ok(ok("常用线路删除成功", Value::Null).into_response())
}

async fn increment_use_count<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
) -> ApiResult<Response>
where
    S: Storage,
{
    let route_id: Option<String> = sqlx::query_scalar(
        r#"
        UPDATE favorite_routes
        SET use_count = COALESCE(use_count, 0) + 1,
            updated_at = now()
        WHERE id = $1
        RETURNING id
        "#,
    )
    .bind(&id)
    .fetch_optional(&state.db)
    .await?;

    let route_id = route_id.ok_or_else(|| ApiError::NotFound("线路不存在".to_string()))?;
    let route = fetch_enriched_route(&state.db, &route_id).await?;

    Ok(ok("使用次数更新成功", route).into_response())
}

async fn fetch_enriched_route(pool: &sqlx::PgPool, id: &str) -> ApiResult<Value> {
    sqlx::query_scalar::<_, Value>(
        r#"
        SELECT row_to_json(route_row)
        FROM (
            SELECT
                fr.*,
                CASE
                    WHEN pickup.id IS NULL THEN NULL
                    ELSE json_build_object(
                        'id', pickup.id,
                        'address_name', pickup.address_name,
                        'address', pickup.address,
                        'latitude', pickup.latitude,
                        'longitude', pickup.longitude
                    )
                END AS pickup_address,
                CASE
                    WHEN delivery.id IS NULL THEN NULL
                    ELSE json_build_object(
                        'id', delivery.id,
                        'address_name', delivery.address_name,
                        'address', delivery.address,
                        'latitude', delivery.latitude,
                        'longitude', delivery.longitude
                    )
                END AS delivery_address
            FROM favorite_routes fr
            LEFT JOIN address_books pickup ON pickup.id = fr.pickup_address_id
            LEFT JOIN address_books delivery ON delivery.id = fr.delivery_address_id
            WHERE fr.id = $1
        ) route_row
        "#,
    )
    .bind(id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| ApiError::NotFound("线路不存在".to_string()))
}

async fn ensure_route_exists(pool: &sqlx::PgPool, id: &str) -> ApiResult<()> {
    let exists: bool =
        sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM favorite_routes WHERE id = $1)")
            .bind(id)
            .fetch_one(pool)
            .await?;

    if exists {
        Ok(())
    } else {
        Err(ApiError::NotFound("线路不存在".to_string()))
    }
}

async fn validate_address_id(
    pool: &sqlx::PgPool,
    id: Option<&str>,
    message: &str,
) -> ApiResult<()> {
    let Some(id) = id else {
        return Ok(());
    };

    let exists: bool =
        sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM address_books WHERE id = $1)")
            .bind(id)
            .fetch_one(pool)
            .await?;

    if exists {
        Ok(())
    } else {
        Err(ApiError::NotFound(message.to_string()))
    }
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

fn normalize_optional_text(value: Option<String>) -> Option<String> {
    value.and_then(|value| {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    })
}

fn non_empty(value: Option<String>) -> Option<String> {
    normalize_optional_text(value)
}
