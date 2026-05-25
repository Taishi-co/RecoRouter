use axum::{
    extract::{Path, Query, State},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use serde_json::{json, Map, Value};

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
    estimated_distance: Option<f64>,
    estimated_fare: Option<f64>,
}

#[derive(Debug, Deserialize)]
struct UpdateRouteRequest {
    #[serde(flatten)]
    fields: Map<String, Value>,
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
            estimated_distance, estimated_fare, use_count
        )
        VALUES (
            $1, $2, $3, $4,
            $5::numeric, $6::numeric, 0
        )
        RETURNING id
        "#,
    )
    .bind(&body.user_id)
    .bind(&body.route_name)
    .bind(&pickup_address_id)
    .bind(&delivery_address_id)
    .bind(body.estimated_distance)
    .bind(body.estimated_fare)
    .fetch_one(&state.db)
    .await?;

    let route = fetch_enriched_route(&state.db, &route_id).await?;

    Ok(ok("线路创建成功", route).into_response())
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
        SELECT jsonb_set(
                jsonb_set(
                    to_jsonb(fr),
                    '{pickup_address}',
                    COALESCE(
                        (
                            SELECT jsonb_build_object(
                                'id', pickup.id,
                                'address_name', pickup.address_name,
                                'address', pickup.address,
                                'latitude', pickup.latitude,
                                'longitude', pickup.longitude
                            )
                        ),
                        'null'::jsonb
                    )
                ),
                '{delivery_address}',
                COALESCE(
                    (
                        SELECT jsonb_build_object(
                            'id', delivery.id,
                            'address_name', delivery.address_name,
                            'address', delivery.address,
                            'latitude', delivery.latitude,
                            'longitude', delivery.longitude
                        )
                    ),
                    'null'::jsonb
                )
            )
        FROM favorite_routes fr
        LEFT JOIN address_books pickup ON pickup.id = fr.pickup_address_id
        LEFT JOIN address_books delivery ON delivery.id = fr.delivery_address_id
        WHERE fr.user_id = $1
        ORDER BY fr.use_count DESC, fr.created_at DESC
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

    let route_name = text_field(&body.fields, "route_name")?;
    let pickup_address_id = text_field(&body.fields, "pickup_address_id")?;
    let delivery_address_id = text_field(&body.fields, "delivery_address_id")?;
    let pickup_address_name = text_field(&body.fields, "pickup_address_name")?;
    let pickup_address = text_field(&body.fields, "pickup_address")?;
    let pickup_lat = number_field(&body.fields, "pickup_lat")?;
    let pickup_lng = number_field(&body.fields, "pickup_lng")?;
    let delivery_address_name = text_field(&body.fields, "delivery_address_name")?;
    let delivery_address = text_field(&body.fields, "delivery_address")?;
    let delivery_lat = number_field(&body.fields, "delivery_lat")?;
    let delivery_lng = number_field(&body.fields, "delivery_lng")?;
    let estimated_distance = number_field(&body.fields, "estimated_distance")?;
    let estimated_fare = number_field(&body.fields, "estimated_fare")?;
    let has_route_name = body.fields.contains_key("route_name");
    let has_pickup_address_id = body.fields.contains_key("pickup_address_id");
    let has_delivery_address_id = body.fields.contains_key("delivery_address_id");
    let has_pickup_address_name = body.fields.contains_key("pickup_address_name");
    let has_pickup_address = body.fields.contains_key("pickup_address");
    let has_pickup_lat = body.fields.contains_key("pickup_lat");
    let has_pickup_lng = body.fields.contains_key("pickup_lng");
    let has_delivery_address_name = body.fields.contains_key("delivery_address_name");
    let has_delivery_address = body.fields.contains_key("delivery_address");
    let has_delivery_lat = body.fields.contains_key("delivery_lat");
    let has_delivery_lng = body.fields.contains_key("delivery_lng");
    let has_estimated_distance = body.fields.contains_key("estimated_distance");
    let has_estimated_fare = body.fields.contains_key("estimated_fare");

    let route_id: Option<String> = sqlx::query_scalar(
        r#"
        UPDATE favorite_routes
        SET route_name = CASE WHEN $2 THEN $3 ELSE route_name END,
            pickup_address_id = CASE WHEN $4 THEN $5 ELSE pickup_address_id END,
            delivery_address_id = CASE WHEN $6 THEN $7 ELSE delivery_address_id END,
            pickup_address_name = CASE WHEN $8 THEN $9 ELSE pickup_address_name END,
            pickup_address = CASE WHEN $10 THEN $11 ELSE pickup_address END,
            pickup_lat = CASE WHEN $12 THEN $13::numeric ELSE pickup_lat END,
            pickup_lng = CASE WHEN $14 THEN $15::numeric ELSE pickup_lng END,
            delivery_address_name = CASE WHEN $16 THEN $17 ELSE delivery_address_name END,
            delivery_address = CASE WHEN $18 THEN $19 ELSE delivery_address END,
            delivery_lat = CASE WHEN $20 THEN $21::numeric ELSE delivery_lat END,
            delivery_lng = CASE WHEN $22 THEN $23::numeric ELSE delivery_lng END,
            estimated_distance = CASE WHEN $24 THEN $25::numeric ELSE estimated_distance END,
            estimated_fare = CASE WHEN $26 THEN $27::numeric ELSE estimated_fare END,
            updated_at = now()
        WHERE id = $1
        RETURNING id
        "#,
    )
    .bind(&id)
    .bind(has_route_name)
    .bind(route_name)
    .bind(has_pickup_address_id)
    .bind(pickup_address_id)
    .bind(has_delivery_address_id)
    .bind(delivery_address_id)
    .bind(has_pickup_address_name)
    .bind(pickup_address_name)
    .bind(has_pickup_address)
    .bind(pickup_address)
    .bind(has_pickup_lat)
    .bind(pickup_lat)
    .bind(has_pickup_lng)
    .bind(pickup_lng)
    .bind(has_delivery_address_name)
    .bind(delivery_address_name)
    .bind(has_delivery_address)
    .bind(delivery_address)
    .bind(has_delivery_lat)
    .bind(delivery_lat)
    .bind(has_delivery_lng)
    .bind(delivery_lng)
    .bind(has_estimated_distance)
    .bind(estimated_distance)
    .bind(has_estimated_fare)
    .bind(estimated_fare)
    .fetch_optional(&state.db)
    .await?;

    let route_id = route_id.ok_or_else(|| ApiError::NotFound("线路不存在".to_string()))?;
    let route = fetch_enriched_route(&state.db, &route_id).await?;

    Ok(ok("线路更新成功", route).into_response())
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

    Ok(ok("线路删除成功", Value::Null).into_response())
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

    Ok(ok("更新成功", route).into_response())
}

async fn fetch_enriched_route(pool: &sqlx::PgPool, id: &str) -> ApiResult<Value> {
    sqlx::query_scalar::<_, Value>(
        r#"
        SELECT jsonb_set(
                jsonb_set(
                    to_jsonb(fr),
                    '{pickup_address}',
                    COALESCE(
                        (
                            SELECT jsonb_build_object(
                                'id', pickup.id,
                                'address_name', pickup.address_name,
                                'address', pickup.address,
                                'latitude', pickup.latitude,
                                'longitude', pickup.longitude
                            )
                        ),
                        'null'::jsonb
                    )
                ),
                '{delivery_address}',
                COALESCE(
                    (
                        SELECT jsonb_build_object(
                            'id', delivery.id,
                            'address_name', delivery.address_name,
                            'address', delivery.address,
                            'latitude', delivery.latitude,
                            'longitude', delivery.longitude
                        )
                    ),
                    'null'::jsonb
                )
            )
        FROM favorite_routes fr
        LEFT JOIN address_books pickup ON pickup.id = fr.pickup_address_id
        LEFT JOIN address_books delivery ON delivery.id = fr.delivery_address_id
        WHERE fr.id = $1
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

fn text_field(fields: &Map<String, Value>, key: &str) -> ApiResult<Option<String>> {
    match fields.get(key) {
        Some(Value::Null) | None => Ok(None),
        Some(Value::String(value)) => Ok(Some(value.clone())),
        Some(_) => Err(ApiError::BadRequest(format!("{key} 参数不正确"))),
    }
}

fn number_field(fields: &Map<String, Value>, key: &str) -> ApiResult<Option<f64>> {
    match fields.get(key) {
        Some(Value::Null) | None => Ok(None),
        Some(Value::Number(value)) => value
            .as_f64()
            .map(Some)
            .ok_or_else(|| ApiError::BadRequest(format!("{key} 参数不正确"))),
        Some(_) => Err(ApiError::BadRequest(format!("{key} 参数不正确"))),
    }
}
