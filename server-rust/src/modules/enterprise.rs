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

    let (pending, in_transit, completed, cancelled, total): (i64, i64, i64, i64, i64) =
        sqlx::query_as(
            r#"
            SELECT
              COUNT(*) FILTER (WHERE status = 'pending'),
              COUNT(*) FILTER (WHERE status = 'in_transit'),
              COUNT(*) FILTER (WHERE status = 'completed'),
              COUNT(*) FILTER (WHERE status = 'cancelled'),
              COUNT(*)
            FROM enterprise_demands
            WHERE enterprise_id = $1
            "#,
        )
        .bind(enterprise_id)
        .fetch_one(pool)
        .await?;
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
    let (total_vehicles, active_vehicles, available_vehicles): (i64, i64, i64) = sqlx::query_as(
        r#"
            SELECT
              COUNT(*),
              COUNT(*) FILTER (WHERE trip_status = 'in_transit'),
              COUNT(*) FILTER (WHERE status = 'active' AND COALESCE(trip_status, 'idle') = 'idle')
            FROM vehicles
            WHERE enterprise_id = $1
            "#,
    )
    .bind(enterprise_id)
    .fetch_one(pool)
    .await?;
    let external_opportunities: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM demands WHERE status = 'pending'")
            .fetch_one(pool)
            .await?;
    let avg_delivery_time: i64 = sqlx::query_scalar(
        r#"
        SELECT COALESCE(
          ROUND(AVG(GREATEST(EXTRACT(EPOCH FROM (updated_at - created_at)) / 60.0, 0)))::bigint,
          0
        )
        FROM enterprise_demands
        WHERE enterprise_id = $1
          AND status = 'completed'
          AND created_at >= $2
          AND updated_at IS NOT NULL
        "#,
    )
    .bind(enterprise_id)
    .bind(month_start)
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
                'pointType', COALESCE(station.point_type, 'terminal'),
                'pointTypeLabel', CASE
                    WHEN COALESCE(station.point_type, 'terminal') = 'community_leader' THEN '社区团长'
                    ELSE '终端点'
                END,
                'orderCount', (
                    SELECT COUNT(*)
                    FROM enterprise_demands demand
                    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(demand.delivery_points, '[]'::jsonb)) point
                    WHERE demand.enterprise_id = $1
                      AND demand.created_at >= $2
                      AND (
                        point->>'stationId' = station.id
                        OR point->>'id' = station.id
                        OR point->>'name' = station.name
                      )
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
    let (terminal_points, community_leader_points): (i64, i64) = sqlx::query_as(
        r#"
        SELECT
          COUNT(*) FILTER (WHERE COALESCE(point_type, 'terminal') = 'terminal'),
          COUNT(*) FILTER (WHERE COALESCE(point_type, 'terminal') = 'community_leader')
        FROM dairy_stations
        WHERE enterprise_id = $1
        "#,
    )
    .bind(enterprise_id)
    .fetch_one(pool)
    .await?;
    let (terminal_orders, community_group_buy_orders): (i64, i64) = sqlx::query_as(
        r#"
        SELECT
          COUNT(*) FILTER (
            WHERE COALESCE(cargo_info->>'businessMode', delivery_points->0->>'businessMode', 'enterprise_terminal') = 'enterprise_terminal'
          ),
          COUNT(*) FILTER (
            WHERE COALESCE(cargo_info->>'businessMode', delivery_points->0->>'businessMode', 'enterprise_terminal') = 'community_group_buy'
          )
        FROM enterprise_demands
        WHERE enterprise_id = $1
        "#,
    )
    .bind(enterprise_id)
    .fetch_one(pool)
    .await?;
    let usage_rate = if total_vehicles > 0 {
        ((active_vehicles as f64 / total_vehicles as f64) * 100.0).round() as i64
    } else {
        0
    };

    Ok(json!({
        "pending": pending,
        "in_transit": in_transit,
        "completed": completed,
        "cancelled": cancelled,
        "total": total,
        "todayOrders": today_orders,
        "monthOrders": month_orders,
        "totalDistance": total_distance.unwrap_or(0.0),
        "avgDeliveryTime": avg_delivery_time,
        "vehicleUsageRate": usage_rate,
        "activeVehicles": active_vehicles,
        "availableVehicles": available_vehicles,
        "totalVehicles": total_vehicles,
        "externalOpportunities": external_opportunities,
        "terminalPoints": terminal_points,
        "communityLeaderPoints": community_leader_points,
        "terminalOrders": terminal_orders,
        "communityGroupBuyOrders": community_group_buy_orders,
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
