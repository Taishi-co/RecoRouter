use axum::{
    extract::{Path, Query, State},
    routing::{get, put},
    Json, Router,
};
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::{Postgres, QueryBuilder};

use crate::{app::AppState, error::ApiResult, response::ApiEnvelope, storage::Storage};

pub fn router<S>() -> Router<AppState<S>>
where
    S: Storage,
{
    Router::new()
        .route(
            "/api/enterprise-vehicles",
            get(list_vehicles::<S>).post(create_vehicle::<S>),
        )
        .route("/api/enterprise-vehicles/stats", get(stats::<S>))
        .route(
            "/api/enterprise-vehicles/:id/usage-mode",
            put(update_usage_mode::<S>),
        )
        .route(
            "/api/enterprise-vehicles/:id/today-stats",
            put(update_today_stats::<S>),
        )
        .route(
            "/api/enterprise-vehicles/:id/status",
            put(update_status::<S>),
        )
        .route(
            "/api/enterprise-vehicles/:id",
            get(get_vehicle::<S>).delete(delete_vehicle::<S>),
        )
}

#[derive(Debug, Deserialize)]
struct VehicleQuery {
    enterprise_id: Option<String>,
    usage_mode: Option<String>,
}

#[derive(Debug, Deserialize)]
struct CreateVehicleBody {
    enterprise_id: String,
    vehicle_id: Option<String>,
    vehicle_code: String,
    vehicle_type: String,
    load_capacity: f64,
    volume: f64,
    length: Option<f64>,
    width: Option<f64>,
    height: Option<f64>,
    has_cold_chain: bool,
    usage_mode: Option<String>,
}

#[derive(Debug, Deserialize)]
struct UsageModeBody {
    usage_mode: String,
}

#[derive(Debug, Deserialize)]
struct TodayStatsBody {
    internal_orders: Option<i64>,
    external_orders: Option<i64>,
    distance: Option<f64>,
}

#[derive(Debug, Deserialize)]
struct TripStatusBody {
    trip_status: String,
}

async fn list_vehicles<S>(
    State(state): State<AppState<S>>,
    Query(query): Query<VehicleQuery>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let Some(enterprise_id) = query.enterprise_id else {
        return Ok(envelope(400, "缺少企业ID", Value::Null));
    };
    let usage_mode = match query.usage_mode {
        Some(usage_mode) => match normalize_usage_mode(&usage_mode) {
            Some(usage_mode) => Some(usage_mode),
            None => return Ok(envelope(500, "usage_mode 不合法", Value::Null)),
        },
        None => None,
    };
    let mut builder = QueryBuilder::<Postgres>::new(
        "SELECT row_to_json(vehicles) FROM vehicles WHERE enterprise_id = ",
    );
    builder.push_bind(enterprise_id);
    if let Some(usage_mode) = usage_mode {
        builder.push(" AND usage_mode = ");
        builder.push_bind(usage_mode);
    }
    builder.push(" ORDER BY created_at DESC");
    let vehicles = builder
        .build_query_scalar::<Value>()
        .fetch_all(&state.db)
        .await?;
    Ok(success(Value::Array(vehicles)))
}

async fn create_vehicle<S>(
    State(state): State<AppState<S>>,
    Json(body): Json<CreateVehicleBody>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let admin_id: Option<String> =
        sqlx::query_scalar("SELECT admin_id FROM enterprises WHERE id = $1")
            .bind(&body.enterprise_id)
            .fetch_optional(&state.db)
            .await?
            .flatten();
    let Some(admin_id) = admin_id else {
        return Ok(envelope(500, "企业不存在", Value::Null));
    };
    if admin_id.trim().is_empty() {
        return Ok(envelope(500, "企业管理员未设置", Value::Null));
    }
    let Some(usage_mode) = normalize_usage_mode(body.usage_mode.as_deref().unwrap_or("internal"))
    else {
        return Ok(envelope(500, "usage_mode 不合法", Value::Null));
    };

    let vehicle = sqlx::query_scalar::<_, Value>(
        r#"
        INSERT INTO vehicles (
            id, owner_id, enterprise_id, vehicle_code, vehicle_type, license_plate,
            load_capacity, volume, length, width, height, has_cold_chain,
            current_location, usage_mode, trip_status, status, battery_life,
            base_price, base_distance, price_per_km,
            today_internal_orders, today_external_orders, today_distance
        )
        VALUES (
            COALESCE($1, gen_random_uuid()::text), $2, $3, $4, $5, $4,
            $6::numeric, $7::numeric, $8::numeric, $9::numeric, $10::numeric, $11,
            '唐山配送中心', COALESCE($12, 'internal'), 'idle', 'active', 100,
            20, 3, 2, 0, 0, 0
        )
        RETURNING row_to_json(vehicles)
        "#,
    )
    .bind(body.vehicle_id)
    .bind(admin_id)
    .bind(body.enterprise_id)
    .bind(body.vehicle_code)
    .bind(body.vehicle_type)
    .bind(body.load_capacity)
    .bind(body.volume)
    .bind(body.length)
    .bind(body.width)
    .bind(body.height)
    .bind(body.has_cold_chain)
    .bind(usage_mode)
    .fetch_one(&state.db)
    .await
    .map_err(|err| crate::error::ApiError::BadRequest(format!("创建车辆失败: {err}")))?;

    Ok(success(vehicle))
}

async fn stats<S>(
    State(state): State<AppState<S>>,
    Query(query): Query<VehicleQuery>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let Some(enterprise_id) = query.enterprise_id else {
        return Ok(envelope(400, "缺少企业ID", Value::Null));
    };
    let rows = sqlx::query_as::<_, (Option<String>, Option<String>)>(
        "SELECT usage_mode, trip_status FROM vehicles WHERE enterprise_id = $1",
    )
    .bind(enterprise_id)
    .fetch_all(&state.db)
    .await?;
    Ok(success(json!({
        "total": rows.len(),
        "in_transit": rows.iter().filter(|(_, trip)| trip.as_deref() == Some("in_transit")).count(),
        "idle": rows.iter().filter(|(_, trip)| trip.as_deref() == Some("idle")).count(),
        "internal": rows.iter().filter(|(mode, _)| mode.as_deref() == Some("internal")).count(),
        "external": rows.iter().filter(|(mode, _)| mode.as_deref() == Some("external")).count()
    })))
}

async fn get_vehicle<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let vehicle =
        sqlx::query_scalar::<_, Value>("SELECT row_to_json(vehicles) FROM vehicles WHERE id = $1")
            .bind(id)
            .fetch_optional(&state.db)
            .await?;
    Ok(match vehicle {
        Some(vehicle) => success(vehicle),
        None => envelope(404, "车辆不存在", Value::Null),
    })
}

async fn update_usage_mode<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
    Json(body): Json<UsageModeBody>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let Some(usage_mode) = normalize_usage_mode(&body.usage_mode) else {
        return Ok(envelope(500, "usage_mode 不合法", Value::Null));
    };
    update_vehicle_field(&state.db, &id, "usage_mode", &usage_mode).await
}

async fn update_status<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
    Json(body): Json<TripStatusBody>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let Some(trip_status) = normalize_trip_status(&body.trip_status) else {
        return Ok(envelope(500, "trip_status 不合法", Value::Null));
    };
    let vehicle = sqlx::query_scalar::<_, Value>(
        r#"
        UPDATE vehicles
        SET trip_status = $2, updated_at = now()
        WHERE id = $1
        RETURNING row_to_json(vehicles)
        "#,
    )
    .bind(id)
    .bind(trip_status)
    .fetch_optional(&state.db)
    .await?;
    Ok(match vehicle {
        Some(vehicle) => success(vehicle),
        None => envelope(404, "车辆不存在", Value::Null),
    })
}

async fn update_today_stats<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
    Json(body): Json<TodayStatsBody>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    sqlx::query(
        r#"
        UPDATE vehicles
        SET today_internal_orders = $2,
            today_external_orders = $3,
            today_distance = $4,
            updated_at = now()
        WHERE id = $1
        "#,
    )
    .bind(id)
    .bind(body.internal_orders)
    .bind(body.external_orders)
    .bind(body.distance)
    .execute(&state.db)
    .await?;
    Ok(success(json!({ "success": true })))
}

async fn delete_vehicle<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    sqlx::query("DELETE FROM vehicles WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await?;
    Ok(Json(ApiEnvelope {
        code: 200,
        message: "删除成功".to_string(),
        data: Value::Null,
    }))
}

async fn update_vehicle_field(
    pool: &sqlx::PgPool,
    id: &str,
    field: &str,
    value: &str,
) -> ApiResult<Json<ApiEnvelope<Value>>> {
    let sql = format!(
        "UPDATE vehicles SET {field} = $2, updated_at = now() WHERE id = $1 RETURNING row_to_json(vehicles)"
    );
    let vehicle = sqlx::query_scalar::<_, Value>(&sql)
        .bind(id)
        .bind(value)
        .fetch_one(pool)
        .await?;
    Ok(success(vehicle))
}

fn normalize_usage_mode(usage_mode: &str) -> Option<String> {
    if matches!(usage_mode, "internal" | "external") {
        return Some(usage_mode.to_string());
    }
    None
}

fn normalize_trip_status(trip_status: &str) -> Option<String> {
    if matches!(trip_status, "idle" | "in_transit" | "maintenance") {
        return Some(trip_status.to_string());
    }
    None
}

fn success<T: serde::Serialize>(data: T) -> Json<ApiEnvelope<T>> {
    Json(ApiEnvelope {
        code: 200,
        message: "success".to_string(),
        data,
    })
}

fn envelope(code: u16, message: &str, data: Value) -> Json<ApiEnvelope<Value>> {
    Json(ApiEnvelope {
        code,
        message: message.to_string(),
        data,
    })
}
