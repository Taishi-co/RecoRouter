use std::collections::HashSet;

use axum::{
    extract::{Path, Query, State},
    routing::{get, post, put},
    Json, Router,
};
use serde::Deserialize;
use serde_json::{json, Map, Value};
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
    let vehicle_source = normalize_vehicle_source(&body.vehicle_source)?;
    let business_mode = normalize_business_mode(
        body.cargo_info
            .get("businessMode")
            .and_then(Value::as_str)
            .unwrap_or("enterprise_terminal"),
    )?;
    let cargo_info = normalize_create_cargo_info(&body.cargo_info, &business_mode)?;
    let delivery_points = normalize_create_delivery_points(&body.delivery_points, &business_mode)?;
    let time_window = normalize_time_window(&body.time_window)?;

    if body.enterprise_id.trim().is_empty() {
        return Err(crate::error::ApiError::BadRequest(
            "enterpriseId 不能为空".to_string(),
        ));
    }

    let mut demand = sqlx::query_scalar::<_, Value>(
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
    .bind(&delivery_points)
    .bind(&cargo_info)
    .bind(&time_window)
    .bind(&vehicle_source)
    .bind(&body.remark)
    .fetch_one(&state.db)
    .await?;

    if vehicle_source == "external" {
        let external_demand_id = publish_external_demand(
            &state.db,
            &body,
            &delivery_points,
            &cargo_info,
            &time_window,
        )
        .await?;
        demand = sqlx::query_scalar::<_, Value>(
            r#"
            UPDATE enterprise_demands
            SET external_demand_id = $2, updated_at = now()
            WHERE id = $1
            RETURNING row_to_json(enterprise_demands)
            "#,
        )
        .bind(&demand_id)
        .bind(external_demand_id)
        .fetch_one(&state.db)
        .await?;
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
    if matches!(body.status.as_deref(), Some("completed") | Some("cancelled")) {
        return Ok(envelope(
            500,
            "不能通过通用接口修改为终态，请使用配送点完成或取消接口",
            Value::Null,
        ));
    }

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
    let existing = fetch_enterprise_demand(&state.db, &id)
        .await?
        .ok_or_else(|| crate::error::ApiError::BadRequest("配送需求不存在".to_string()))?;
    if existing.get("status").and_then(Value::as_str) != Some("pending") {
        return Err(crate::error::ApiError::BadRequest(
            "只有待调度状态的需求可以分配车辆".to_string(),
        ));
    }

    let vehicle_source = normalize_vehicle_source(
        existing
            .get("vehicle_source")
            .and_then(Value::as_str)
            .unwrap_or(""),
    )?;
    if vehicle_source == "external" {
        return Err(crate::error::ApiError::BadRequest(
            "外部运力需求无需分配自有车辆".to_string(),
        ));
    }

    let vehicle_ids = vehicle_ids_from_allocation(&body.vehicle_allocation);
    if vehicle_ids.is_empty() {
        return Err(crate::error::ApiError::BadRequest("请选择车辆".to_string()));
    }
    let enterprise_id = existing
        .get("enterprise_id")
        .and_then(Value::as_str)
        .ok_or_else(|| crate::error::ApiError::BadRequest("企业ID缺失".to_string()))?;
    let usage_modes = if vehicle_source == "mixed" {
        vec!["internal".to_string(), "external".to_string()]
    } else {
        vec!["internal".to_string()]
    };
    validate_enterprise_vehicle_ids(&state.db, enterprise_id, &vehicle_ids, &usage_modes).await?;

    let vehicle_allocation = normalized_vehicle_allocation(body.vehicle_allocation, &vehicle_ids);
    let mut tx = state.db.begin().await?;
    let demand = sqlx::query_scalar::<_, Value>(
        r#"
        UPDATE enterprise_demands
        SET vehicle_allocation = $2::jsonb, status = 'in_transit', updated_at = now()
        WHERE id = $1
        RETURNING row_to_json(enterprise_demands)
        "#,
    )
    .bind(&id)
    .bind(&vehicle_allocation)
    .fetch_one(&mut *tx)
    .await?;

    sqlx::query(
        "UPDATE vehicles SET trip_status = 'in_transit', updated_at = now() WHERE id = ANY($1)",
    )
    .bind(&vehicle_ids)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
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
    let vehicle_ids = normalize_unique_ids(&body.vehicle_ids);
    if vehicle_ids.is_empty() {
        return Err(crate::error::ApiError::BadRequest("请选择车辆".to_string()));
    }

    let external =
        sqlx::query_scalar::<_, Value>("SELECT row_to_json(demands) FROM demands WHERE id = $1")
            .bind(&id)
            .fetch_optional(&state.db)
            .await?
            .ok_or_else(|| crate::error::ApiError::BadRequest("外部需求不存在".to_string()))?;

    if external.get("status").and_then(Value::as_str) != Some("pending") {
        return Err(crate::error::ApiError::BadRequest(
            "只有待接单的外部需求可以接单".to_string(),
        ));
    }

    let usage_modes = vec!["external".to_string()];
    validate_enterprise_vehicle_ids(&state.db, &body.enterprise_id, &vehicle_ids, &usage_modes)
        .await?;

    let enterprise_admin_id: Option<String> =
        sqlx::query_scalar("SELECT admin_id FROM enterprises WHERE id = $1")
            .bind(&body.enterprise_id)
            .fetch_optional(&state.db)
            .await?
            .flatten();
    let pickup_point_info = pickup_point_from_external(&external);
    let delivery_points = delivery_points_from_external(&external, &id);
    let cargo_info = cargo_info_from_external(&external);
    let time_window = time_window_from_external(&external);
    let vehicle_allocation = json!({
        "vehicle_ids": vehicle_ids.clone(),
        "allocated_at": UtcIso::now()
    });

    let mut tx = state.db.begin().await?;
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
    .bind(pickup_point_info)
    .bind(delivery_points)
    .bind(cargo_info)
    .bind(time_window)
    .bind(&vehicle_allocation)
    .bind(&id)
    .fetch_one(&mut *tx)
    .await?;

    sqlx::query(
        "UPDATE demands SET status = 'accepted', owner_id = $2, updated_at = now() WHERE id = $1",
    )
    .bind(&id)
    .bind(enterprise_admin_id)
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        "UPDATE vehicles SET trip_status = 'in_transit', updated_at = now() WHERE id = ANY($1)",
    )
    .bind(&vehicle_ids)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(success(enterprise_demand))
}

fn pickup_point_from_external(external: &Value) -> Value {
    if external
        .get("pickup_point")
        .and_then(Value::as_object)
        .is_some_and(|point| !point.is_empty())
    {
        return external.get("pickup_point").cloned().unwrap_or(Value::Null);
    }

    json!({
        "name": "起点",
        "address": external.get("pickup_address").and_then(Value::as_str).unwrap_or(""),
        "latitude": external.get("pickup_lat").cloned().unwrap_or(Value::Null),
        "longitude": external.get("pickup_lng").cloned().unwrap_or(Value::Null)
    })
}

fn delivery_points_from_external(external: &Value, demand_id: &str) -> Value {
    let business_mode = business_mode_from_external(external);
    let point_type = if business_mode == "community_group_buy" {
        "community_leader"
    } else {
        "terminal"
    };

    if let Some(points) = external.get("delivery_points").and_then(Value::as_array) {
        if !points.is_empty() {
            let normalized = points
                .iter()
                .enumerate()
                .map(|(index, point)| {
                    let mut object = point.as_object().cloned().unwrap_or_default();
                    let default_name = object
                        .get("address")
                        .cloned()
                        .unwrap_or_else(|| json!("收货点"));
                    object
                        .entry("stationId".to_string())
                        .or_insert_with(|| json!(format!("external-{demand_id}-{}", index + 1)));
                    object.entry("name".to_string()).or_insert(default_name);
                    object
                        .entry("pointType".to_string())
                        .or_insert_with(|| json!(point_type));
                    object
                        .entry("businessMode".to_string())
                        .or_insert_with(|| json!(business_mode.clone()));
                    object
                        .entry("status".to_string())
                        .or_insert_with(|| json!("pending"));
                    Value::Object(object)
                })
                .collect::<Vec<_>>();
            return Value::Array(normalized);
        }
    }

    json!([{
        "stationId": format!("external-{demand_id}"),
        "name": external.get("delivery_address").and_then(Value::as_str).unwrap_or("收货点"),
        "address": external.get("delivery_address").and_then(Value::as_str).unwrap_or(""),
        "latitude": external.get("delivery_lat").cloned().unwrap_or(Value::Null),
        "longitude": external.get("delivery_lng").cloned().unwrap_or(Value::Null),
        "pointType": point_type,
        "businessMode": business_mode,
        "status": "pending"
    }])
}

fn cargo_info_from_external(external: &Value) -> Value {
    let mut cargo_info = external
        .get("cargo_info")
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_else(Map::new);
    let business_mode = business_mode_from_external(external);

    cargo_info.entry("type".to_string()).or_insert_with(|| {
        external
            .get("cargo_name")
            .cloned()
            .unwrap_or_else(|| json!("货物"))
    });
    cargo_info
        .entry("cargoType".to_string())
        .or_insert_with(|| external.get("cargo_type").cloned().unwrap_or(Value::Null));
    cargo_info
        .entry("weight".to_string())
        .or_insert_with(|| external.get("weight").cloned().unwrap_or(Value::Null));
    cargo_info
        .entry("volume".to_string())
        .or_insert_with(|| external.get("volume").cloned().unwrap_or(Value::Null));
    cargo_info
        .entry("businessMode".to_string())
        .or_insert_with(|| json!(business_mode.clone()));
    cargo_info
        .entry("businessModeLabel".to_string())
        .or_insert_with(|| {
            if business_mode == "community_group_buy" {
                json!("社区团购")
            } else {
                json!("终端配送")
            }
        });

    Value::Object(cargo_info)
}

fn time_window_from_external(external: &Value) -> Value {
    if external
        .get("time_window")
        .and_then(Value::as_object)
        .is_some_and(|time_window| !time_window.is_empty())
    {
        return external.get("time_window").cloned().unwrap_or(Value::Null);
    }

    json!({
        "start": external
            .get("pickup_time_start")
            .or_else(|| external.get("pickup_time"))
            .cloned()
            .unwrap_or(Value::Null),
        "end": external
            .get("pickup_time_end")
            .or_else(|| external.get("pickup_time"))
            .cloned()
            .unwrap_or(Value::Null)
    })
}

fn business_mode_from_external(external: &Value) -> String {
    external
        .pointer("/cargo_info/businessMode")
        .and_then(Value::as_str)
        .unwrap_or("enterprise_terminal")
        .to_string()
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
            if status != "in_transit" {
                return Ok(envelope(
                    500,
                    "只有进行中的配送需求才能更新配送点状态",
                    Value::Null,
                ));
            }

            let station_id = body.station_id.unwrap_or_default();
            let new_status = body.status.unwrap_or_default();
            if station_id.is_empty() || new_status.is_empty() {
                return Ok(envelope(500, "stationId 和 status 不能为空", Value::Null));
            }
            if !matches!(new_status.as_str(), "pending" | "in_transit" | "completed") {
                return Ok(envelope(500, "配送点状态不合法", Value::Null));
            }

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
                release_allocated_vehicles(&state.db, &demand).await?;
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
    if !matches!(
        demand.get("status").and_then(Value::as_str),
        Some("pending") | Some("in_transit")
    ) {
        return Ok(envelope(
            500,
            "只能取消待调度或进行中状态的需求",
            Value::Null,
        ));
    }
    sqlx::query(
        "UPDATE enterprise_demands SET status = 'cancelled', updated_at = now() WHERE id = $1",
    )
    .bind(&id)
    .execute(&state.db)
    .await?;

    release_allocated_vehicles(&state.db, &demand).await?;

    if demand.get("vehicle_source").and_then(Value::as_str) == Some("external") {
        let external_demand_ids = linked_external_demand_ids(&state.db, &demand).await?;
        if !external_demand_ids.is_empty() {
            sqlx::query(
                "UPDATE demands SET status = 'cancelled', updated_at = now() WHERE id = ANY($1) AND status = 'pending'",
            )
            .bind(&external_demand_ids)
            .execute(&state.db)
            .await?;
        }
    }

    Ok(success(json!({ "success": true })))
}

async fn publish_external_demand(
    pool: &sqlx::PgPool,
    body: &CreateDemandBody,
    delivery_points: &Value,
    cargo_info: &Value,
    time_window: &Value,
) -> ApiResult<String> {
    let merchant_id: Option<String> =
        sqlx::query_scalar("SELECT admin_id FROM enterprises WHERE id = $1")
            .bind(&body.enterprise_id)
            .fetch_optional(pool)
            .await?
            .flatten();
    let merchant_id = merchant_id.unwrap_or_else(|| body.enterprise_id.clone());
    let first_delivery = delivery_points
        .as_array()
        .and_then(|points| points.first())
        .cloned()
        .unwrap_or_else(|| json!({}));
    let cargo_name = cargo_info
        .get("type")
        .and_then(Value::as_str)
        .unwrap_or("货物");
    let total_weight = cargo_info
        .get("quantity")
        .and_then(Value::as_f64)
        .unwrap_or(0.0);
    let total_volume = total_weight * 0.001;
    let public_demand_id = format!("pub-{}", &uuid::Uuid::new_v4().simple().to_string()[..8]);
    let public_id = sqlx::query_scalar::<_, String>(
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
        RETURNING id
        "#,
    )
    .bind(&public_demand_id)
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
    .bind(time_window)
    .bind(delivery_points)
    .bind(cargo_info)
    .fetch_one(pool)
    .await?;
    Ok(public_id)
}

fn normalize_unique_ids(ids: &[String]) -> Vec<String> {
    let mut seen = HashSet::new();
    ids.iter()
        .filter_map(|id| {
            let id = id.trim();
            if id.is_empty() || !seen.insert(id.to_string()) {
                None
            } else {
                Some(id.to_string())
            }
        })
        .collect()
}

fn normalize_vehicle_source(source: &str) -> ApiResult<String> {
    match source {
        "own" | "internal" => Ok("internal".to_string()),
        "external" => Ok("external".to_string()),
        "mixed" => Ok("mixed".to_string()),
        _ => Err(crate::error::ApiError::BadRequest(
            "vehicleSource 不合法".to_string(),
        )),
    }
}

fn normalize_business_mode(mode: &str) -> ApiResult<String> {
    match mode {
        "enterprise_terminal" | "community_group_buy" => Ok(mode.to_string()),
        _ => Err(crate::error::ApiError::BadRequest(
            "businessMode 不合法".to_string(),
        )),
    }
}

fn normalize_time_window(time_window: &Value) -> ApiResult<Value> {
    let has_start = time_window
        .get("start")
        .and_then(Value::as_str)
        .is_some_and(|value| !value.trim().is_empty());
    let has_end = time_window
        .get("end")
        .and_then(Value::as_str)
        .is_some_and(|value| !value.trim().is_empty());
    if !has_start || !has_end {
        return Err(crate::error::ApiError::BadRequest(
            "timeWindow.start 和 timeWindow.end 不能为空".to_string(),
        ));
    }
    Ok(time_window.clone())
}

fn normalize_create_cargo_info(cargo_info: &Value, business_mode: &str) -> ApiResult<Value> {
    let mut object = cargo_info
        .as_object()
        .cloned()
        .ok_or_else(|| crate::error::ApiError::BadRequest("cargoInfo 必须是对象".to_string()))?;
    let cargo_type = object
        .get("type")
        .and_then(Value::as_str)
        .unwrap_or("")
        .trim();
    if cargo_type.is_empty() {
        return Err(crate::error::ApiError::BadRequest(
            "cargoInfo.type 不能为空".to_string(),
        ));
    }
    object.insert("businessMode".to_string(), json!(business_mode));
    object.insert(
        "businessModeLabel".to_string(),
        json!(if business_mode == "community_group_buy" {
            "社区团购"
        } else {
            "终端配送"
        }),
    );
    Ok(Value::Object(object))
}

fn normalize_create_delivery_points(points: &Value, business_mode: &str) -> ApiResult<Value> {
    let point_type = if business_mode == "community_group_buy" {
        "community_leader"
    } else {
        "terminal"
    };
    let points = points.as_array().ok_or_else(|| {
        crate::error::ApiError::BadRequest("deliveryPoints 必须是数组".to_string())
    })?;

    let normalized = points
        .iter()
        .enumerate()
        .filter_map(|(index, point)| {
            let mut object = point.as_object().cloned().unwrap_or_default();
            let has_identity = object
                .get("stationId")
                .or_else(|| object.get("id"))
                .or_else(|| object.get("address"))
                .or_else(|| object.get("name"))
                .is_some();
            if !has_identity {
                return None;
            }
            object
                .entry("stationId".to_string())
                .or_insert_with(|| json!(format!("point-{}", index + 1)));
            object
                .entry("pointType".to_string())
                .or_insert_with(|| json!(point_type));
            object
                .entry("businessMode".to_string())
                .or_insert_with(|| json!(business_mode));
            object
                .entry("status".to_string())
                .or_insert_with(|| json!("pending"));
            Some(Value::Object(object))
        })
        .collect::<Vec<_>>();

    if normalized.is_empty() {
        return Err(crate::error::ApiError::BadRequest(
            "至少需要一个配送点".to_string(),
        ));
    }

    Ok(Value::Array(normalized))
}

fn vehicle_ids_from_allocation(allocation: &Value) -> Vec<String> {
    allocation
        .get("vehicle_ids")
        .and_then(Value::as_array)
        .map(|values| {
            let ids = values
                .iter()
                .filter_map(Value::as_str)
                .map(ToString::to_string)
                .collect::<Vec<_>>();
            normalize_unique_ids(&ids)
        })
        .unwrap_or_default()
}

fn normalized_vehicle_allocation(mut allocation: Value, vehicle_ids: &[String]) -> Value {
    if let Some(object) = allocation.as_object_mut() {
        object.insert("vehicle_ids".to_string(), json!(vehicle_ids));
        object
            .entry("allocated_at".to_string())
            .or_insert_with(|| json!(UtcIso::now()));
        allocation
    } else {
        json!({
            "vehicle_ids": vehicle_ids,
            "allocated_at": UtcIso::now()
        })
    }
}

async fn validate_enterprise_vehicle_ids(
    pool: &sqlx::PgPool,
    enterprise_id: &str,
    vehicle_ids: &[String],
    usage_modes: &[String],
) -> ApiResult<()> {
    let valid_count: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*)
        FROM vehicles
        WHERE enterprise_id = $1
          AND id = ANY($2)
          AND usage_mode = ANY($3)
          AND status = 'active'
          AND COALESCE(trip_status, 'idle') = 'idle'
        "#,
    )
    .bind(enterprise_id)
    .bind(vehicle_ids)
    .bind(usage_modes)
    .fetch_one(pool)
    .await?;

    if valid_count != vehicle_ids.len() as i64 {
        return Err(crate::error::ApiError::BadRequest(
            "所选车辆不可用或不属于该企业".to_string(),
        ));
    }

    Ok(())
}

async fn release_allocated_vehicles(pool: &sqlx::PgPool, demand: &Value) -> ApiResult<()> {
    let vehicle_ids = demand
        .get("vehicle_allocation")
        .map(vehicle_ids_from_allocation)
        .unwrap_or_default();
    if vehicle_ids.is_empty() {
        return Ok(());
    }

    sqlx::query(
        "UPDATE vehicles SET trip_status = 'idle', updated_at = now() WHERE id = ANY($1) AND trip_status = 'in_transit'",
    )
    .bind(&vehicle_ids)
    .execute(pool)
    .await?;

    Ok(())
}

async fn linked_external_demand_ids(pool: &sqlx::PgPool, demand: &Value) -> ApiResult<Vec<String>> {
    if let Some(external_demand_id) = demand
        .get("external_demand_id")
        .and_then(Value::as_str)
        .filter(|external_demand_id| !external_demand_id.is_empty())
    {
        return Ok(vec![external_demand_id.to_string()]);
    }

    let Some(enterprise_id) = demand.get("enterprise_id").and_then(Value::as_str) else {
        return Ok(Vec::new());
    };
    let Some(created_at) = demand.get("created_at").and_then(Value::as_str) else {
        return Ok(Vec::new());
    };

    let admin_id: Option<String> =
        sqlx::query_scalar("SELECT admin_id FROM enterprises WHERE id = $1")
            .bind(enterprise_id)
            .fetch_optional(pool)
            .await?
            .flatten();
    let mut merchant_ids = Vec::new();
    if let Some(admin_id) = admin_id {
        merchant_ids.push(admin_id);
    }
    merchant_ids.push(enterprise_id.to_string());
    merchant_ids = normalize_unique_ids(&merchant_ids);

    let external_demand_ids = sqlx::query_scalar::<_, String>(
        r#"
        SELECT id
        FROM demands
        WHERE merchant_id = ANY($1)
          AND remarks = '企业外部需求'
          AND created_at >= $2::timestamptz
          AND created_at < ($2::timestamptz + interval '10 seconds')
          AND status = 'pending'
        "#,
    )
    .bind(&merchant_ids)
    .bind(created_at)
    .fetch_all(pool)
    .await?;

    Ok(external_demand_ids)
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
