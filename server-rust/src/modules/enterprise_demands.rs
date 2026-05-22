use axum::{
    extract::{Path, Query, State},
    routing::{get, post, put},
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
            "/api/demand",
            post(create_demand::<S>).get(list_demands::<S>),
        )
        .route(
            "/api/demand/pending/:enterprise_id",
            get(pending_demands::<S>),
        )
        .route("/api/demand/stats/enterprise", get(stats::<S>))
        .route("/api/demand/external/pending", get(pending_external::<S>))
        .route(
            "/api/demand/external/:id/accept",
            post(accept_external::<S>),
        )
        .route(
            "/api/demand/:id/delivery-points",
            put(update_delivery_points::<S>),
        )
        .route("/api/demand/:id/cancel", put(cancel_demand::<S>))
        .route("/api/demand/:id/allocate", put(allocate::<S>))
        .route(
            "/api/demand/:id",
            get(get_demand::<S>).put(update_demand::<S>),
        )
}

#[derive(Debug, Deserialize)]
struct CreateDemandBody {
    #[serde(rename = "enterpriseId")]
    enterprise_id: String,
    #[serde(rename = "pickupPointType")]
    pickup_point_type: String,
    #[serde(rename = "pickupPointInfo")]
    pickup_point_info: Value,
    #[serde(rename = "deliveryPoints")]
    delivery_points: Value,
    #[serde(rename = "cargoInfo")]
    cargo_info: Value,
    #[serde(rename = "timeWindow")]
    time_window: Value,
    #[serde(rename = "vehicleSource")]
    vehicle_source: String,
    remark: Option<String>,
}

#[derive(Debug, Deserialize)]
struct DemandQuery {
    #[serde(rename = "enterpriseId")]
    enterprise_id: String,
    status: Option<String>,
    page: Option<i64>,
    #[serde(rename = "pageSize")]
    page_size: Option<i64>,
}

#[derive(Debug, Deserialize)]
struct StatsQuery {
    enterprise_id: String,
}

#[derive(Debug, Deserialize)]
struct UpdateDemandBody {
    #[serde(rename = "vehicleAllocation", alias = "vehicle_allocation")]
    vehicle_allocation: Option<Value>,
    #[serde(rename = "optimizedRoutes", alias = "optimized_routes")]
    optimized_routes: Option<Value>,
    status: Option<String>,
}

#[derive(Debug, Deserialize)]
struct AllocateBody {
    vehicle_allocation: Value,
}

#[derive(Debug, Deserialize)]
struct AcceptExternalBody {
    enterprise_id: String,
    vehicle_ids: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct DeliveryPointBody {
    action: String,
    #[serde(rename = "stationId")]
    station_id: Option<String>,
    status: Option<String>,
}

async fn create_demand<S>(
    State(state): State<AppState<S>>,
    Json(body): Json<CreateDemandBody>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let demand_id = format!("demand-{}", &uuid::Uuid::new_v4().simple().to_string()[..8]);
    let demand = sqlx::query_scalar::<_, Value>(
        r#"
        INSERT INTO enterprise_demands (
            id, enterprise_id, pickup_point_type, pickup_point_info,
            delivery_points, cargo_info, time_window, vehicle_source,
            remark, status
        )
        VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb, $8, $9, 'pending')
        RETURNING row_to_json(enterprise_demands)
        "#,
    )
    .bind(&demand_id)
    .bind(&body.enterprise_id)
    .bind(&body.pickup_point_type)
    .bind(&body.pickup_point_info)
    .bind(&body.delivery_points)
    .bind(&body.cargo_info)
    .bind(&body.time_window)
    .bind(&body.vehicle_source)
    .bind(&body.remark)
    .fetch_one(&state.db)
    .await?;

    if body.vehicle_source == "external" {
        publish_external_demand(&state.db, &body).await?;
    }

    Ok(success(demand))
}

async fn list_demands<S>(
    State(state): State<AppState<S>>,
    Query(query): Query<DemandQuery>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let page = query.page.unwrap_or(1).max(1);
    let page_size = query.page_size.unwrap_or(20).max(1);
    let offset = (page - 1) * page_size;

    let total = if let Some(status) = query.status.as_deref() {
        sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM enterprise_demands WHERE enterprise_id = $1 AND status = $2",
        )
        .bind(&query.enterprise_id)
        .bind(status)
        .fetch_one(&state.db)
        .await?
    } else {
        sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM enterprise_demands WHERE enterprise_id = $1",
        )
        .bind(&query.enterprise_id)
        .fetch_one(&state.db)
        .await?
    };

    let mut builder = QueryBuilder::<Postgres>::new(
        "SELECT row_to_json(enterprise_demands) FROM enterprise_demands WHERE enterprise_id = ",
    );
    builder.push_bind(&query.enterprise_id);
    if let Some(status) = query.status {
        builder.push(" AND status = ");
        builder.push_bind(status);
    }
    builder.push(" ORDER BY created_at DESC LIMIT ");
    builder.push_bind(page_size);
    builder.push(" OFFSET ");
    builder.push_bind(offset);
    let list = builder
        .build_query_scalar::<Value>()
        .fetch_all(&state.db)
        .await?;

    Ok(success(
        json!({ "list": list, "total": total, "page": page, "pageSize": page_size }),
    ))
}

async fn get_demand<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let demand = fetch_enterprise_demand(&state.db, &id).await?;
    Ok(match demand {
        Some(demand) => success(demand),
        None => envelope(404, "配送需求不存在", Value::Null),
    })
}

async fn update_demand<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
    Json(body): Json<UpdateDemandBody>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let demand = sqlx::query_scalar::<_, Value>(
        r#"
        UPDATE enterprise_demands
        SET vehicle_allocation = COALESCE($2::jsonb, vehicle_allocation),
            optimized_routes = COALESCE($3::jsonb, optimized_routes),
            status = COALESCE($4, status),
            updated_at = now()
        WHERE id = $1
        RETURNING row_to_json(enterprise_demands)
        "#,
    )
    .bind(id)
    .bind(body.vehicle_allocation)
    .bind(body.optimized_routes)
    .bind(body.status)
    .fetch_one(&state.db)
    .await?;
    Ok(success(demand))
}

async fn pending_demands<S>(
    State(state): State<AppState<S>>,
    Path(enterprise_id): Path<String>,
) -> ApiResult<Json<ApiEnvelope<Vec<Value>>>>
where
    S: Storage,
{
    let rows = sqlx::query_scalar::<_, Value>(
        r#"
        SELECT row_to_json(enterprise_demands)
        FROM enterprise_demands
        WHERE enterprise_id = $1 AND status = 'pending'
        ORDER BY created_at ASC
        "#,
    )
    .bind(enterprise_id)
    .fetch_all(&state.db)
    .await?;
    Ok(success(rows))
}

async fn stats<S>(
    State(state): State<AppState<S>>,
    Query(query): Query<StatsQuery>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let statuses: Vec<Option<String>> =
        sqlx::query_scalar("SELECT status FROM enterprise_demands WHERE enterprise_id = $1")
            .bind(query.enterprise_id)
            .fetch_all(&state.db)
            .await?;
    Ok(success(json!({
        "pending": statuses.iter().filter(|status| status.as_deref() == Some("pending")).count(),
        "in_transit": statuses.iter().filter(|status| status.as_deref() == Some("in_transit")).count(),
        "completed": statuses.iter().filter(|status| status.as_deref() == Some("completed")).count(),
        "cancelled": statuses.iter().filter(|status| status.as_deref() == Some("cancelled")).count(),
        "total": statuses.len()
    })))
}

async fn allocate<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
    Json(body): Json<AllocateBody>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let demand = sqlx::query_scalar::<_, Value>(
        r#"
        UPDATE enterprise_demands
        SET vehicle_allocation = $2::jsonb, status = 'in_transit', updated_at = now()
        WHERE id = $1
        RETURNING row_to_json(enterprise_demands)
        "#,
    )
    .bind(id)
    .bind(body.vehicle_allocation)
    .fetch_one(&state.db)
    .await?;
    Ok(success(demand))
}

async fn pending_external<S>(
    State(state): State<AppState<S>>,
) -> ApiResult<Json<ApiEnvelope<Vec<Value>>>>
where
    S: Storage,
{
    let demands = sqlx::query_scalar::<_, Value>(
        r#"
        SELECT row_to_json(demands)
        FROM demands
        WHERE status = 'pending'
        ORDER BY created_at DESC
        LIMIT 20
        "#,
    )
    .fetch_all(&state.db)
    .await?;
    Ok(success(demands))
}

async fn accept_external<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
    Json(body): Json<AcceptExternalBody>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let external =
        sqlx::query_scalar::<_, Value>("SELECT row_to_json(demands) FROM demands WHERE id = $1")
            .bind(&id)
            .fetch_optional(&state.db)
            .await?
            .ok_or_else(|| crate::error::ApiError::BadRequest("外部需求不存在".to_string()))?;

    let enterprise_demand = sqlx::query_scalar::<_, Value>(
        r#"
        INSERT INTO enterprise_demands (
            enterprise_id, pickup_point_type, pickup_point_info,
            delivery_points, cargo_info, time_window, vehicle_source,
            status, vehicle_allocation, external_demand_id
        )
        VALUES (
            $1, 'warehouse', $2::jsonb, $3::jsonb, $4::jsonb, $5::jsonb,
            'internal', 'in_transit', $6::jsonb, $7
        )
        RETURNING row_to_json(enterprise_demands)
        "#,
    )
    .bind(&body.enterprise_id)
    .bind(json!({
        "name": external.pointer("/pickup_point/name").and_then(Value::as_str).unwrap_or("起点"),
        "address": external.get("pickup_address").and_then(Value::as_str).unwrap_or("")
    }))
    .bind(
        external
            .get("delivery_points")
            .cloned()
            .unwrap_or_else(|| json!([])),
    )
    .bind(
        external
            .get("cargo_info")
            .cloned()
            .unwrap_or_else(|| json!({})),
    )
    .bind(json!({
        "start": external.get("pickup_time_start").cloned().unwrap_or(Value::Null),
        "end": external.get("pickup_time_end").cloned().unwrap_or(Value::Null)
    }))
    .bind(json!({ "vehicle_ids": body.vehicle_ids, "allocated_at": UtcIso::now() }))
    .bind(&id)
    .fetch_one(&state.db)
    .await?;

    sqlx::query("UPDATE demands SET status = 'accepted', updated_at = now() WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await?;

    Ok(success(enterprise_demand))
}

async fn update_delivery_points<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
    Json(body): Json<DeliveryPointBody>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let demand = fetch_enterprise_demand(&state.db, &id)
        .await?
        .ok_or_else(|| crate::error::ApiError::BadRequest("配送需求不存在".to_string()))?;
    let status = demand.get("status").and_then(Value::as_str).unwrap_or("");
    let mut delivery_points = demand
        .get("delivery_points")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();

    match body.action.as_str() {
        "remove" => {
            if status != "pending" {
                return Ok(envelope(
                    500,
                    "只有待调度的配送需求才能移除配送点",
                    Value::Null,
                ));
            }
            let station_id = body.station_id.unwrap_or_default();
            let original_count = delivery_points.len();
            delivery_points.retain(|point| {
                point.get("stationId").and_then(Value::as_str) != Some(station_id.as_str())
            });
            if delivery_points.len() == original_count {
                return Ok(envelope(500, "未找到指定的配送点", Value::Null));
            }
            if delivery_points.is_empty() {
                return Ok(envelope(500, "不能移除所有配送点", Value::Null));
            }
        }
        "update_status" => {
            let station_id = body.station_id.unwrap_or_default();
            let new_status = body.status.unwrap_or_default();
            let mut found = false;
            for point in &mut delivery_points {
                if point.get("stationId").and_then(Value::as_str) == Some(station_id.as_str()) {
                    if let Some(object) = point.as_object_mut() {
                        object.insert("status".to_string(), json!(new_status));
                    }
                    found = true;
                }
            }
            if !found {
                return Ok(envelope(500, "未找到指定的配送点", Value::Null));
            }
            if delivery_points
                .iter()
                .all(|point| point.get("status").and_then(Value::as_str) == Some("completed"))
            {
                sqlx::query("UPDATE enterprise_demands SET status = 'completed' WHERE id = $1")
                    .bind(&id)
                    .execute(&state.db)
                    .await?;
            }
        }
        _ => return Ok(envelope(500, "操作失败", Value::Null)),
    }

    let updated = sqlx::query_scalar::<_, Value>(
        r#"
        UPDATE enterprise_demands
        SET delivery_points = $2::jsonb, updated_at = now()
        WHERE id = $1
        RETURNING row_to_json(enterprise_demands)
        "#,
    )
    .bind(id)
    .bind(Value::Array(delivery_points))
    .fetch_one(&state.db)
    .await?;
    Ok(success(updated))
}

async fn cancel_demand<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let demand = fetch_enterprise_demand(&state.db, &id)
        .await?
        .ok_or_else(|| crate::error::ApiError::BadRequest("配送需求不存在".to_string()))?;
    if demand.get("status").and_then(Value::as_str) != Some("pending") {
        return Ok(envelope(500, "只能取消待调度状态的需求", Value::Null));
    }
    sqlx::query(
        "UPDATE enterprise_demands SET status = 'cancelled', updated_at = now() WHERE id = $1",
    )
    .bind(id)
    .execute(&state.db)
    .await?;
    Ok(success(json!({ "success": true })))
}

async fn publish_external_demand(pool: &sqlx::PgPool, body: &CreateDemandBody) -> ApiResult<()> {
    let merchant_id: Option<String> =
        sqlx::query_scalar("SELECT admin_id FROM enterprises WHERE id = $1")
            .bind(&body.enterprise_id)
            .fetch_optional(pool)
            .await?
            .flatten();
    let merchant_id = merchant_id.unwrap_or_else(|| body.enterprise_id.clone());
    let first_delivery = body
        .delivery_points
        .as_array()
        .and_then(|points| points.first())
        .cloned()
        .unwrap_or_else(|| json!({}));
    let cargo_name = body
        .cargo_info
        .get("type")
        .and_then(Value::as_str)
        .unwrap_or("货物");
    let total_weight = body
        .cargo_info
        .get("quantity")
        .and_then(Value::as_f64)
        .unwrap_or(0.0);
    let total_volume = total_weight * 0.001;
    let public_demand_id = format!("pub-{}", &uuid::Uuid::new_v4().simple().to_string()[..8]);
    sqlx::query(
        r#"
        INSERT INTO demands (
            id, merchant_id, cargo_name, cargo_type, weight, volume,
            pickup_time, pickup_address, pickup_lat, pickup_lng,
            delivery_address, delivery_lat, delivery_lng,
            time_window, delivery_points, cargo_info, status, remarks,
            created_at, updated_at
        )
        VALUES (
            $1, $2, $3, 'normal', $4::numeric, $5::numeric,
            now(), $6, $7::numeric, $8::numeric,
            $9, $10::numeric, $11::numeric,
            $12::jsonb, $13::jsonb, $14::jsonb, 'pending', '企业外部需求',
            now(), now()
        )
        "#,
    )
    .bind(public_demand_id)
    .bind(merchant_id)
    .bind(cargo_name)
    .bind(total_weight)
    .bind(total_volume)
    .bind(
        body.pickup_point_info
            .get("address")
            .and_then(Value::as_str)
            .unwrap_or("配送中心"),
    )
    .bind(
        body.pickup_point_info
            .get("latitude")
            .and_then(Value::as_f64),
    )
    .bind(
        body.pickup_point_info
            .get("longitude")
            .and_then(Value::as_f64),
    )
    .bind(
        first_delivery
            .get("address")
            .and_then(Value::as_str)
            .unwrap_or("未指定"),
    )
    .bind(first_delivery.get("latitude").and_then(Value::as_f64))
    .bind(first_delivery.get("longitude").and_then(Value::as_f64))
    .bind(&body.time_window)
    .bind(&body.delivery_points)
    .bind(&body.cargo_info)
    .execute(pool)
    .await?;
    Ok(())
}

async fn fetch_enterprise_demand(pool: &sqlx::PgPool, id: &str) -> ApiResult<Option<Value>> {
    sqlx::query_scalar::<_, Value>(
        "SELECT row_to_json(enterprise_demands) FROM enterprise_demands WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(pool)
    .await
    .map_err(Into::into)
}

struct UtcIso;

impl UtcIso {
    fn now() -> String {
        chrono::Utc::now().to_rfc3339()
    }
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
