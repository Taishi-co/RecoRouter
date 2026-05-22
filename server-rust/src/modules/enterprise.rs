use axum::{
    extract::{Path, Query, State},
    routing::{get, post},
    Json, Router,
};
use chrono::{Datelike, Utc};
use serde::Deserialize;
use serde_json::{json, Value};

use crate::{app::AppState, error::ApiResult, response::ApiEnvelope, storage::Storage};

pub fn router<S>() -> Router<AppState<S>>
where
    S: Storage,
{
    Router::new()
        .route("/api/enterprise", post(create_enterprise::<S>))
        .route("/api/enterprise/stats", get(stats_by_query::<S>))
        .route("/api/enterprise/admin/:admin_id", get(by_admin::<S>))
        .route(
            "/api/enterprise/:id",
            get(by_id::<S>).put(update_enterprise::<S>),
        )
        .route("/api/enterprise/:id/stats", get(stats_by_id::<S>))
}

#[derive(Debug, Deserialize)]
struct CreateEnterpriseBody {
    name: String,
    #[serde(rename = "type")]
    enterprise_type: String,
    #[serde(rename = "adminId")]
    admin_id: String,
}

#[derive(Debug, Deserialize)]
struct UpdateEnterpriseBody {
    name: Option<String>,
    #[serde(rename = "type")]
    enterprise_type: Option<String>,
    #[serde(rename = "adminId")]
    admin_id: Option<String>,
    status: Option<String>,
}

#[derive(Debug, Deserialize)]
struct EnterpriseQuery {
    enterprise_id: String,
}

async fn create_enterprise<S>(
    State(state): State<AppState<S>>,
    Json(body): Json<CreateEnterpriseBody>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let enterprise = sqlx::query_scalar::<_, Value>(
        r#"
        INSERT INTO enterprises (name, type, admin_id, status)
        VALUES ($1, $2, $3, 'active')
        RETURNING row_to_json(enterprises)
        "#,
    )
    .bind(body.name)
    .bind(body.enterprise_type)
    .bind(body.admin_id)
    .fetch_one(&state.db)
    .await?;

    Ok(success(enterprise))
}

async fn by_id<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let enterprise = sqlx::query_scalar::<_, Value>(
        "SELECT row_to_json(enterprises) FROM enterprises WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?;

    match enterprise {
        Some(enterprise) => Ok(success(enterprise)),
        None => Ok(envelope(404, "企业不存在", Value::Null)),
    }
}

async fn by_admin<S>(
    State(state): State<AppState<S>>,
    Path(admin_id): Path<String>,
) -> ApiResult<Json<ApiEnvelope<Option<Value>>>>
where
    S: Storage,
{
    let enterprise = sqlx::query_scalar::<_, Value>(
        "SELECT row_to_json(enterprises) FROM enterprises WHERE admin_id = $1 LIMIT 1",
    )
    .bind(admin_id)
    .fetch_optional(&state.db)
    .await?;

    Ok(Json(ApiEnvelope {
        code: 200,
        message: "success".to_string(),
        data: enterprise,
    }))
}

async fn update_enterprise<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
    Json(body): Json<UpdateEnterpriseBody>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let enterprise = sqlx::query_scalar::<_, Value>(
        r#"
        UPDATE enterprises
        SET name = COALESCE($2, name),
            type = COALESCE($3, type),
            admin_id = COALESCE($4, admin_id),
            status = COALESCE($5, status),
            updated_at = now()
        WHERE id = $1
        RETURNING row_to_json(enterprises)
        "#,
    )
    .bind(id)
    .bind(body.name)
    .bind(body.enterprise_type)
    .bind(body.admin_id)
    .bind(body.status)
    .fetch_one(&state.db)
    .await?;

    Ok(success(enterprise))
}

async fn stats_by_query<S>(
    State(state): State<AppState<S>>,
    Query(query): Query<EnterpriseQuery>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    Ok(success(
        enterprise_stats(&state.db, &query.enterprise_id).await?,
    ))
}

async fn stats_by_id<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    Ok(success(enterprise_stats(&state.db, &id).await?))
}

async fn enterprise_stats(pool: &sqlx::PgPool, enterprise_id: &str) -> ApiResult<Value> {
    let today = Utc::now().date_naive();
    let month_start = today
        .with_day(1)
        .expect("current month should have a first day");

    let today_orders: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM enterprise_demands WHERE enterprise_id = $1 AND created_at >= $2",
    )
    .bind(enterprise_id)
    .bind(today)
    .fetch_one(pool)
    .await?;
    let month_orders: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM enterprise_demands WHERE enterprise_id = $1 AND created_at >= $2",
    )
    .bind(enterprise_id)
    .bind(month_start)
    .fetch_one(pool)
    .await?;
    let total_vehicles: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM vehicles WHERE enterprise_id = $1")
            .bind(enterprise_id)
            .fetch_one(pool)
            .await?;
    let active_vehicles: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM vehicles WHERE enterprise_id = $1 AND trip_status = 'in_transit'",
    )
    .bind(enterprise_id)
    .fetch_one(pool)
    .await?;
    let total_distance: Option<f64> = sqlx::query_scalar(
        "SELECT SUM(today_distance)::float8 FROM vehicles WHERE enterprise_id = $1",
    )
    .bind(enterprise_id)
    .fetch_one(pool)
    .await?;
    let station_rows = sqlx::query_scalar::<_, Value>(
        r#"
        SELECT COALESCE(jsonb_agg(
            jsonb_build_object(
                'stationName', station.name,
                'orderCount', (
                    SELECT COUNT(*)
                    FROM enterprise_demands demand
                    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(demand.delivery_points, '[]'::jsonb)) point
                    WHERE demand.enterprise_id = $1
                      AND demand.created_at >= $2
                      AND point->>'name' = station.name
                )
            )
            ORDER BY station.created_at DESC
        ), '[]'::jsonb)
        FROM dairy_stations station
        WHERE station.enterprise_id = $1
        "#,
    )
    .bind(enterprise_id)
    .bind(today)
    .fetch_one(pool)
    .await?;
    let usage_rate = if total_vehicles > 0 {
        ((active_vehicles as f64 / total_vehicles as f64) * 100.0).round() as i64
    } else {
        0
    };

    Ok(json!({
        "todayOrders": today_orders,
        "monthOrders": month_orders,
        "totalDistance": total_distance.unwrap_or(0.0),
        "avgDeliveryTime": 45,
        "vehicleUsageRate": usage_rate,
        "activeVehicles": active_vehicles,
        "totalVehicles": total_vehicles,
        "stationStats": station_rows
    }))
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
