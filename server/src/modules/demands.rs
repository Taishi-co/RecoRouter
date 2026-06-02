use axum::{
    extract::{Path, Query, State},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use serde_json::{json, Map, Value};
use sqlx::{FromRow, Postgres, QueryBuilder};

use crate::{
    app::AppState,
    error::{ApiError, ApiResult},
    pagination::Pagination,
    response::{ok, ApiEnvelope},
    storage::Storage,
};

pub fn router<S>() -> Router<AppState<S>>
where
    S: Storage,
{
    Router::new()
        .route(
            "/api/demands",
            get(list_demands::<S>).post(create_demand::<S>),
        )
        .route(
            "/api/demands/calculate-distance",
            post(calculate_distance::<S>),
        )
        .route("/api/demands/stats/merchant", get(merchant_stats::<S>))
        .route(
            "/api/demands/:id",
            get(get_demand::<S>).put(update_demand::<S>),
        )
        .route("/api/demands/:id/cancel", post(cancel_demand::<S>))
        .route("/api/demands/:id/accept", post(accept_demand::<S>))
        .route(
            "/api/demands/:id/save-as-template",
            post(save_as_template::<S>),
        )
}

#[derive(Debug, Deserialize)]
struct DemandQuery {
    merchant_id: Option<String>,
    status: Option<String>,
    page: Option<i64>,
    #[serde(rename = "pageSize", alias = "page_size", alias = "limit")]
    page_size: Option<i64>,
}

#[derive(Debug, Deserialize)]
struct MerchantStatsQuery {
    merchant_id: String,
}

#[derive(Debug, Deserialize)]
struct CalculateDistanceRequest {
    pickup_lat: Option<f64>,
    pickup_lng: Option<f64>,
    delivery_lat: Option<f64>,
    delivery_lng: Option<f64>,
}

#[derive(Debug, Deserialize)]
struct AcceptDemandRequest {
    #[serde(rename = "ownerId", alias = "owner_id")]
    owner_id: String,
    #[serde(rename = "vehicleId", alias = "vehicle_id")]
    vehicle_id: String,
    #[serde(rename = "farePrice", alias = "fare_price")]
    fare_price: Option<f64>,
    note: Option<String>,
}

#[derive(Debug, Deserialize)]
struct SaveAsTemplateRequest {
    template_name: String,
}

#[derive(Debug, FromRow)]
struct DemandAcceptRow {
    merchant_id: Option<String>,
    enterprise_id: Option<String>,
    enterprise_demand_id: Option<String>,
    demand_source: Option<String>,
    cargo_name: Option<String>,
    status: Option<String>,
    pickup_time: Option<chrono::DateTime<chrono::Utc>>,
    pickup_address: Option<String>,
    delivery_address: Option<String>,
    pickup_lat: Option<f64>,
    pickup_lng: Option<f64>,
    delivery_lat: Option<f64>,
    delivery_lng: Option<f64>,
    estimated_distance: Option<f64>,
}

#[derive(Debug, FromRow)]
struct VehicleAcceptRow {
    owner_id: Option<String>,
    current_renter_id: Option<String>,
    status: Option<String>,
    trip_status: Option<String>,
    base_price: Option<f64>,
    base_distance: Option<f64>,
    price_per_km: Option<f64>,
}

#[derive(Debug, FromRow)]
struct ActiveRentalRow {
    renter_id: Option<String>,
    rent_end_date: Option<String>,
}

#[derive(Debug)]
struct FareCalculation {
    fare_price: f64,
    calculation_detail: Option<Value>,
    is_custom_fare: bool,
}

async fn calculate_distance<S>(
    Json(body): Json<CalculateDistanceRequest>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let (Some(pickup_lat), Some(pickup_lng), Some(delivery_lat), Some(delivery_lng)) = (
        body.pickup_lat,
        body.pickup_lng,
        body.delivery_lat,
        body.delivery_lng,
    ) else {
        return Err(ApiError::BadRequest("请提供完整的经纬度坐标".to_string()));
    };

    let distance = haversine_km(pickup_lat, pickup_lng, delivery_lat, delivery_lng) * 1.5;
    let duration_minutes = (distance / 22.5 * 60.0).floor();

    Ok(ok(
        "计算成功（基于估算）",
        json!({
            "distance": distance,
            "distance_text": format!("{distance:.2}公里"),
            "estimated_fare": distance,
            "route_type": "estimated",
            "route_duration": duration_minutes,
            "duration_text": format!("约{}分钟", duration_minutes as i64),
            "polyline": [
                { "latitude": pickup_lat, "longitude": pickup_lng },
                { "latitude": delivery_lat, "longitude": delivery_lng }
            ],
            "is_estimate": true
        }),
    ))
}

async fn create_demand<S>(
    State(state): State<AppState<S>>,
    Json(body): Json<Value>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let merchant_id = required_string(&body, "merchant_id", "需求方ID不能为空")?;
    let role: Option<String> = sqlx::query_scalar("SELECT role FROM users WHERE id = $1")
        .bind(&merchant_id)
        .fetch_optional(&state.db)
        .await?
        .flatten();
    let role = role.ok_or_else(|| ApiError::BadRequest("用户不存在".to_string()))?;
    if role != "merchant" {
        return Err(ApiError::BadRequest("只有需求方可以发布需求".to_string()));
    }

    let cargo_name = required_string(&body, "cargo_name", "货品名称不能为空")?;
    let cargo_type = required_string(&body, "cargo_type", "货品类型不能为空")?;
    validate_create_cargo_type(&cargo_type)?;
    let weight = required_number(&body, "weight", "重量不能为空")?;
    let volume = required_number(&body, "volume", "体积不能为空")?;
    let pickup_time = required_string(&body, "pickup_time", "取货时间不能为空")?;
    let pickup_address = required_string(&body, "pickup_address", "取货地址不能为空")?;
    let delivery_address = required_string(&body, "delivery_address", "送货地址不能为空")?;
    let pickup_location = json_field(&body, "pickup_location")?;
    let delivery_location = json_field(&body, "delivery_location")?;
    let remarks = string_field(&body, "remarks");
    let pickup_lat = number_field(&body, "pickup_lat")?;
    let pickup_lng = number_field(&body, "pickup_lng")?;
    let delivery_lat = number_field(&body, "delivery_lat")?;
    let delivery_lng = number_field(&body, "delivery_lng")?;
    let estimated_distance = number_field(&body, "estimated_distance")?;
    let estimated_fare = number_field(&body, "estimated_fare")?;
    let route_type = estimated_distance.map(|_| "non_highway");
    let cargo_photos = array_field(&body, "cargo_photos").unwrap_or_else(|| json!([]));

    let demand = sqlx::query_scalar::<_, Value>(
        r#"
        INSERT INTO demands (
            merchant_id, demand_source, cargo_name, cargo_type, weight, volume,
            pickup_time, pickup_address, pickup_location,
            delivery_address, delivery_location,
            remarks, pickup_lat, pickup_lng, delivery_lat, delivery_lng,
            estimated_distance, estimated_fare, route_type, cargo_photos, status
        )
        VALUES (
            $1, 'merchant', $2, $3, $4::numeric, $5::numeric,
            $6::timestamptz, $7, $8::jsonb,
            $9, $10::jsonb,
            $11, $12::numeric, $13::numeric, $14::numeric, $15::numeric,
            $16::numeric, $17::numeric, $18, $19::jsonb, 'pending'
        )
        RETURNING row_to_json(demands)
        "#,
    )
    .bind(merchant_id)
    .bind(cargo_name)
    .bind(cargo_type)
    .bind(weight)
    .bind(volume)
    .bind(pickup_time)
    .bind(pickup_address)
    .bind(pickup_location)
    .bind(delivery_address)
    .bind(delivery_location)
    .bind(remarks)
    .bind(pickup_lat)
    .bind(pickup_lng)
    .bind(delivery_lat)
    .bind(delivery_lng)
    .bind(estimated_distance)
    .bind(estimated_fare)
    .bind(route_type)
    .bind(cargo_photos)
    .fetch_one(&state.db)
    .await
    .map_err(|err| ApiError::BadRequest(format!("创建需求失败: {err}")))?;

    Ok(ok("需求发布成功", demand))
}

async fn list_demands<S>(
    State(state): State<AppState<S>>,
    Query(query): Query<DemandQuery>,
) -> ApiResult<Json<ApiEnvelope<Vec<Value>>>>
where
    S: Storage,
{
    let mut builder = QueryBuilder::<Postgres>::new(
        r#"
        SELECT row_to_json(demand_row)
        FROM (
            SELECT *
            FROM demands
        "#,
    );
    let mut has_where = false;
    if query.status.as_deref() == Some("pending") {
        push_where(&mut builder, &mut has_where);
        builder.push("status = 'pending'");
    } else if let Some(merchant_id) = non_empty(query.merchant_id) {
        push_where(&mut builder, &mut has_where);
        builder.push("merchant_id = ");
        builder.push_bind(merchant_id);
    }

    let pagination = Pagination::from_query(query.page, query.page_size);
    builder.push(" ORDER BY created_at DESC, id DESC LIMIT ");
    builder.push_bind(pagination.limit);
    builder.push(" OFFSET ");
    builder.push_bind(pagination.offset);
    builder.push(") demand_row");

    let demands = builder
        .build_query_scalar::<Value>()
        .fetch_all(&state.db)
        .await
        .map_err(|err| ApiError::BadRequest(format!("查询失败: {err}")))?;

    Ok(ok("查询成功", demands))
}

async fn get_demand<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    Ok(ok("查询成功", fetch_demand(&state.db, &id).await?))
}

async fn update_demand<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
    Json(body): Json<Value>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let cargo_name = string_field(&body, "cargo_name");
    if has_field(&body, "cargo_name")
        && cargo_name
            .as_deref()
            .is_none_or(|value| value.trim().is_empty())
    {
        return Err(ApiError::BadRequest("货品名称不能为空".to_string()));
    }
    let cargo_type = string_field(&body, "cargo_type");
    let weight = number_field(&body, "weight")?;
    let volume = number_field(&body, "volume")?;
    let pickup_time = string_field(&body, "pickup_time");
    let pickup_address = string_field(&body, "pickup_address");
    let pickup_location = json_field(&body, "pickup_location")?;
    let delivery_address = string_field(&body, "delivery_address");
    let delivery_location = json_field(&body, "delivery_location")?;
    let remarks = string_field(&body, "remarks");
    let pickup_lat = number_field(&body, "pickup_lat")?;
    let pickup_lng = number_field(&body, "pickup_lng")?;
    let delivery_lat = number_field(&body, "delivery_lat")?;
    let delivery_lng = number_field(&body, "delivery_lng")?;
    let estimated_distance = number_field(&body, "estimated_distance")?;
    let estimated_fare = number_field(&body, "estimated_fare")?;
    let cargo_photos = array_field(&body, "cargo_photos");

    let demand = sqlx::query_scalar::<_, Value>(
        r#"
        UPDATE demands
        SET cargo_name = CASE WHEN $2 THEN $3 ELSE cargo_name END,
            cargo_type = CASE WHEN $4 THEN $5 ELSE cargo_type END,
            weight = CASE WHEN $6 THEN $7::numeric ELSE weight END,
            volume = CASE WHEN $8 THEN $9::numeric ELSE volume END,
            pickup_time = CASE WHEN $10 THEN $11::timestamptz ELSE pickup_time END,
            pickup_address = CASE WHEN $12 THEN $13 ELSE pickup_address END,
            pickup_location = CASE WHEN $14 THEN $15::jsonb ELSE pickup_location END,
            delivery_address = CASE WHEN $16 THEN $17 ELSE delivery_address END,
            delivery_location = CASE WHEN $18 THEN $19::jsonb ELSE delivery_location END,
            remarks = CASE WHEN $20 THEN $21 ELSE remarks END,
            pickup_lat = CASE WHEN $22 THEN $23::numeric ELSE pickup_lat END,
            pickup_lng = CASE WHEN $24 THEN $25::numeric ELSE pickup_lng END,
            delivery_lat = CASE WHEN $26 THEN $27::numeric ELSE delivery_lat END,
            delivery_lng = CASE WHEN $28 THEN $29::numeric ELSE delivery_lng END,
            estimated_distance = CASE WHEN $30 THEN $31::numeric ELSE estimated_distance END,
            estimated_fare = CASE WHEN $32 THEN $33::numeric ELSE estimated_fare END,
            cargo_photos = CASE WHEN $34 THEN $35::jsonb ELSE cargo_photos END,
            updated_at = now()
        WHERE id = $1
        RETURNING row_to_json(demands)
        "#,
    )
    .bind(&id)
    .bind(has_field(&body, "cargo_name"))
    .bind(cargo_name)
    .bind(has_field(&body, "cargo_type"))
    .bind(cargo_type)
    .bind(has_field(&body, "weight"))
    .bind(weight)
    .bind(has_field(&body, "volume"))
    .bind(volume)
    .bind(has_field(&body, "pickup_time"))
    .bind(pickup_time)
    .bind(has_field(&body, "pickup_address"))
    .bind(pickup_address)
    .bind(has_field(&body, "pickup_location"))
    .bind(pickup_location)
    .bind(has_field(&body, "delivery_address"))
    .bind(delivery_address)
    .bind(has_field(&body, "delivery_location"))
    .bind(delivery_location)
    .bind(has_field(&body, "remarks"))
    .bind(remarks)
    .bind(has_field(&body, "pickup_lat"))
    .bind(pickup_lat)
    .bind(has_field(&body, "pickup_lng"))
    .bind(pickup_lng)
    .bind(has_field(&body, "delivery_lat"))
    .bind(delivery_lat)
    .bind(has_field(&body, "delivery_lng"))
    .bind(delivery_lng)
    .bind(has_field(&body, "estimated_distance"))
    .bind(estimated_distance)
    .bind(has_field(&body, "estimated_fare"))
    .bind(estimated_fare)
    .bind(has_field(&body, "cargo_photos"))
    .bind(cargo_photos)
    .fetch_optional(&state.db)
    .await
    .map_err(|err| ApiError::BadRequest(format!("更新失败: {err}")))?
    .ok_or_else(|| ApiError::NotFound("需求不存在".to_string()))?;

    Ok(ok("更新成功", demand))
}

async fn cancel_demand<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let status: Option<String> = sqlx::query_scalar("SELECT status FROM demands WHERE id = $1")
        .bind(&id)
        .fetch_optional(&state.db)
        .await?
        .flatten();
    let status = status.ok_or_else(|| ApiError::NotFound("需求不存在".to_string()))?;
    if status != "pending" {
        return Err(ApiError::BadRequest("只有待接单的需求可以取消".to_string()));
    }

    sqlx::query("DELETE FROM demands WHERE id = $1")
        .bind(&id)
        .execute(&state.db)
        .await
        .map_err(|err| ApiError::BadRequest(format!("删除失败: {err}")))?;

    Ok(ok("需求已删除", json!({ "id": id })))
}

async fn accept_demand<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
    Json(body): Json<AcceptDemandRequest>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let owner_role: Option<String> = sqlx::query_scalar("SELECT role FROM users WHERE id = $1")
        .bind(&body.owner_id)
        .fetch_optional(&state.db)
        .await?
        .flatten();
    let owner_role = owner_role.ok_or_else(|| ApiError::BadRequest("车主不存在".to_string()))?;
    if owner_role != "owner" {
        return Err(ApiError::BadRequest("只有车主可以接单".to_string()));
    }

    let demand = fetch_demand_accept_row(&state.db, &id).await?;
    if demand.status.as_deref() != Some("pending") {
        return Err(ApiError::BadRequest("只有待接单的需求可以接单".to_string()));
    }
    let vehicle = fetch_vehicle_accept_row(&state.db, &body.vehicle_id).await?;
    if vehicle.status.as_deref() != Some("active") {
        return Err(ApiError::BadRequest("所选车辆不存在或不可用".to_string()));
    }
    validate_vehicle_permission(&state.db, &body.owner_id, &body.vehicle_id, &vehicle).await?;
    if vehicle.trip_status.as_deref() == Some("in_transit") {
        return Err(ApiError::BadRequest(
            "该车辆正在运输中，无法接单".to_string(),
        ));
    }

    let total_distance = demand_distance(&demand);
    let fare = resolve_fare(body.fare_price, total_distance, &vehicle);
    let order_source = demand.demand_source.as_deref().unwrap_or("merchant");
    let requester_id = resolve_demand_requester_id(
        &state.db,
        order_source,
        demand.merchant_id.as_deref(),
        demand.enterprise_id.as_deref(),
    )
    .await?
    .ok_or_else(|| ApiError::BadRequest("需求发布方不存在".to_string()))?;

    let mut tx = state.db.begin().await?;
    let updated_demand = sqlx::query_scalar::<_, Value>(
        r#"
        UPDATE demands
        SET status = 'accepted',
            owner_id = $2,
            updated_at = now()
        WHERE id = $1
        RETURNING row_to_json(demands)
        "#,
    )
    .bind(&id)
    .bind(&body.owner_id)
    .fetch_one(&mut *tx)
    .await
    .map_err(|err| ApiError::BadRequest(format!("接单失败: {err}")))?;

    let order = sqlx::query_scalar::<_, Value>(
        r#"
        INSERT INTO orders (
            demand_id, merchant_id, enterprise_id, enterprise_demand_id, order_source,
            owner_id, vehicle_id, status,
            fare_price, calculated_fare, fare_calculation_detail, is_custom_fare,
            merchant_confirmed, pickup_time, pickup_address, delivery_address, remarks
        )
        VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, 'accepted',
            $8::numeric, $9::numeric, $10::jsonb, $11,
            false, $12, $13, $14, $15
        )
        RETURNING row_to_json(orders)
        "#,
    )
    .bind(&id)
    .bind(if order_source == "merchant" {
        demand.merchant_id.as_deref()
    } else {
        None
    })
    .bind(if order_source == "enterprise" {
        demand.enterprise_id.as_deref()
    } else {
        None
    })
    .bind(if order_source == "enterprise" {
        demand.enterprise_demand_id.as_deref()
    } else {
        None
    })
    .bind(order_source)
    .bind(&body.owner_id)
    .bind(&body.vehicle_id)
    .bind(fare.fare_price)
    .bind(fare.fare_price)
    .bind(fare.calculation_detail.clone())
    .bind(fare.is_custom_fare)
    .bind(demand.pickup_time)
    .bind(demand.pickup_address.as_deref())
    .bind(demand.delivery_address.as_deref())
    .bind(normalize_optional_text(body.note))
    .fetch_one(&mut *tx)
    .await
    .map_err(|err| ApiError::BadRequest(format!("创建订单失败: {err}")))?;

    sqlx::query("UPDATE vehicles SET trip_status = 'in_transit' WHERE id = $1")
        .bind(&body.vehicle_id)
        .execute(&mut *tx)
        .await?;

    let order_id = order.get("id").and_then(Value::as_str);
    if let Some(order_id) = order_id {
        let _ = sqlx::query(
            r#"
            INSERT INTO notifications (
                user_id, type, title, content, related_order_id, related_demand_id, is_read
            )
            VALUES ($1, 'order_accepted', '您的需求已被接单', $2, $3, $4, false)
            "#,
        )
        .bind(&requester_id)
        .bind(format!(
            "您发布的\"{}\"需求已被接单，运费：¥{:.2}，请确认运费后车主将开始运输",
            demand.cargo_name.as_deref().unwrap_or(""),
            fare.fare_price
        ))
        .bind(order_id)
        .bind(&id)
        .execute(&mut *tx)
        .await;
    }

    tx.commit().await?;

    Ok(ok(
        "接单成功",
        json!({
            "demand": updated_demand,
            "order": order
        }),
    ))
}

async fn merchant_stats<S>(
    State(state): State<AppState<S>>,
    Query(query): Query<MerchantStatsQuery>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let demands = sqlx::query_scalar::<_, Value>(
        r#"
        SELECT row_to_json(demand_row)
        FROM (
            SELECT *
            FROM demands
            WHERE merchant_id = $1
            ORDER BY created_at DESC
        ) demand_row
        "#,
    )
    .bind(&query.merchant_id)
    .fetch_all(&state.db)
    .await
    .map_err(|err| ApiError::BadRequest(format!("查询失败: {err}")))?;

    let mut status_counts = json!({
        "pending": 0,
        "accepted": 0,
        "in_transit": 0,
        "completed": 0,
        "cancelled": 0
    });
    let mut cargo_type_counts = json!({
        "normal": 0,
        "fresh": 0,
        "fragile": 0
    });
    let mut total_weight = 0.0;
    let mut total_volume = 0.0;

    for demand in &demands {
        if let Some(status) = demand.get("status").and_then(Value::as_str) {
            increment_json_count(&mut status_counts, status);
            if status == "completed" {
                total_weight += demand.get("weight").and_then(Value::as_f64).unwrap_or(0.0);
                total_volume += demand.get("volume").and_then(Value::as_f64).unwrap_or(0.0);
            }
        }
        if let Some(cargo_type) = demand.get("cargo_type").and_then(Value::as_str) {
            increment_json_count(&mut cargo_type_counts, cargo_type);
        }
    }

    let recent_demands = demands.iter().take(5).cloned().collect::<Vec<_>>();

    Ok(ok(
        "查询成功",
        json!({
            "total_demands": demands.len(),
            "status_counts": status_counts,
            "cargo_type_counts": cargo_type_counts,
            "total_weight": total_weight,
            "total_volume": total_volume,
            "recent_demands": recent_demands
        }),
    ))
}

async fn save_as_template<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
    Json(body): Json<SaveAsTemplateRequest>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let demand = fetch_demand(&state.db, &id).await?;
    let pickup_location = demand
        .get("pickup_location")
        .cloned()
        .unwrap_or(Value::Null);
    let delivery_location = demand
        .get("delivery_location")
        .cloned()
        .unwrap_or(Value::Null);
    let pickup_lat = location_number(&pickup_location, "latitude")
        .or_else(|| demand.get("pickup_lat").and_then(Value::as_f64));
    let pickup_lng = location_number(&pickup_location, "longitude")
        .or_else(|| demand.get("pickup_lng").and_then(Value::as_f64));
    let delivery_lat = location_number(&delivery_location, "latitude")
        .or_else(|| demand.get("delivery_lat").and_then(Value::as_f64));
    let delivery_lng = location_number(&delivery_location, "longitude")
        .or_else(|| demand.get("delivery_lng").and_then(Value::as_f64));

    let template = sqlx::query_scalar::<_, Value>(
        r#"
        INSERT INTO demand_templates (
            user_id, template_name, cargo_name, cargo_type,
            weight, volume,
            pickup_address, pickup_lat, pickup_lng,
            delivery_address, delivery_lat, delivery_lng,
            remarks, estimated_distance, estimated_fare,
            use_count, is_default
        )
        VALUES (
            $1, $2, $3, $4,
            $5::numeric, $6::numeric,
            $7, $8::numeric, $9::numeric,
            $10, $11::numeric, $12::numeric,
            $13, $14::numeric, $15::numeric,
            0, false
        )
        RETURNING row_to_json(demand_templates)
        "#,
    )
    .bind(demand.get("merchant_id").and_then(Value::as_str))
    .bind(body.template_name)
    .bind(demand.get("cargo_name").and_then(Value::as_str))
    .bind(demand.get("cargo_type").and_then(Value::as_str))
    .bind(demand.get("weight").and_then(Value::as_f64))
    .bind(demand.get("volume").and_then(Value::as_f64))
    .bind(demand.get("pickup_address").and_then(Value::as_str))
    .bind(pickup_lat)
    .bind(pickup_lng)
    .bind(demand.get("delivery_address").and_then(Value::as_str))
    .bind(delivery_lat)
    .bind(delivery_lng)
    .bind(demand.get("remarks").and_then(Value::as_str))
    .bind(demand.get("estimated_distance").and_then(Value::as_f64))
    .bind(demand.get("estimated_fare").and_then(Value::as_f64))
    .fetch_one(&state.db)
    .await?;

    Ok(ok("模板创建成功", template))
}

async fn fetch_demand(pool: &sqlx::PgPool, id: &str) -> ApiResult<Value> {
    sqlx::query_scalar::<_, Value>("SELECT row_to_json(demands) FROM demands WHERE id = $1")
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::NotFound("需求不存在".to_string()))
}

async fn fetch_demand_accept_row(pool: &sqlx::PgPool, id: &str) -> ApiResult<DemandAcceptRow> {
    sqlx::query_as::<_, DemandAcceptRow>(
        r#"
        SELECT
            merchant_id,
            enterprise_id,
            enterprise_demand_id,
            demand_source,
            cargo_name,
            status,
            pickup_time,
            pickup_address,
            delivery_address,
            pickup_lat::float8 AS pickup_lat,
            pickup_lng::float8 AS pickup_lng,
            delivery_lat::float8 AS delivery_lat,
            delivery_lng::float8 AS delivery_lng,
            estimated_distance::float8 AS estimated_distance
        FROM demands
        WHERE id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| ApiError::NotFound("需求不存在".to_string()))
}

async fn resolve_demand_requester_id(
    pool: &sqlx::PgPool,
    source: &str,
    merchant_id: Option<&str>,
    enterprise_id: Option<&str>,
) -> ApiResult<Option<String>> {
    if source != "enterprise" {
        return Ok(merchant_id.map(ToOwned::to_owned));
    }

    let Some(enterprise_id) = enterprise_id else {
        return Ok(None);
    };

    let admin_id: Option<String> =
        sqlx::query_scalar("SELECT admin_id FROM enterprises WHERE id = $1")
            .bind(enterprise_id)
            .fetch_optional(pool)
            .await?
            .flatten();

    Ok(Some(admin_id.unwrap_or_else(|| enterprise_id.to_string())))
}

async fn fetch_vehicle_accept_row(
    pool: &sqlx::PgPool,
    vehicle_id: &str,
) -> ApiResult<VehicleAcceptRow> {
    sqlx::query_as::<_, VehicleAcceptRow>(
        r#"
        SELECT
            owner_id,
            current_renter_id,
            status,
            trip_status,
            base_price::float8 AS base_price,
            base_distance::float8 AS base_distance,
            price_per_km::float8 AS price_per_km
        FROM vehicles
        WHERE id = $1
        "#,
    )
    .bind(vehicle_id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| ApiError::BadRequest("所选车辆不存在或不可用".to_string()))
}

async fn validate_vehicle_permission(
    pool: &sqlx::PgPool,
    owner_id: &str,
    vehicle_id: &str,
    vehicle: &VehicleAcceptRow,
) -> ApiResult<()> {
    if vehicle.current_renter_id.is_some() {
        let active_rental = sqlx::query_as::<_, ActiveRentalRow>(
            r#"
            SELECT renter_id, rent_end_date::text AS rent_end_date
            FROM vehicle_rentals
            WHERE vehicle_id = $1
              AND status = 'active'
            ORDER BY created_at DESC
            LIMIT 1
            "#,
        )
        .bind(vehicle_id)
        .fetch_optional(pool)
        .await?;

        if let Some(active_rental) = active_rental {
            if active_rental.renter_id.as_deref() == Some(owner_id) {
                return Ok(());
            }
            if vehicle.owner_id.as_deref() == Some(owner_id) {
                let rent_end_date = active_rental
                    .rent_end_date
                    .as_deref()
                    .and_then(|value| value.split_once(' ').map(|(date, _)| date))
                    .unwrap_or("");
                return Err(ApiError::BadRequest(format!(
                    "该车辆已租给租户，租赁到期时间为 {rent_end_date}，无法接单"
                )));
            }
            return Err(ApiError::BadRequest(
                "该车辆已租给其他用户，您无权使用该车辆".to_string(),
            ));
        }

        sqlx::query("UPDATE vehicles SET current_renter_id = null WHERE id = $1")
            .bind(vehicle_id)
            .execute(pool)
            .await?;
        return Ok(());
    }

    if vehicle.owner_id.as_deref() != Some(owner_id) {
        return Err(ApiError::BadRequest("所选车辆不存在或不可用".to_string()));
    }

    Ok(())
}

fn demand_distance(demand: &DemandAcceptRow) -> f64 {
    if let Some(distance) = demand.estimated_distance {
        return distance;
    }
    if let (Some(pickup_lat), Some(pickup_lng), Some(delivery_lat), Some(delivery_lng)) = (
        demand.pickup_lat,
        demand.pickup_lng,
        demand.delivery_lat,
        demand.delivery_lng,
    ) {
        return haversine_km(pickup_lat, pickup_lng, delivery_lat, delivery_lng);
    }

    0.0
}

fn resolve_fare(
    fare_price: Option<f64>,
    total_distance: f64,
    vehicle: &VehicleAcceptRow,
) -> FareCalculation {
    if let Some(fare_price) = fare_price {
        return FareCalculation {
            fare_price,
            calculation_detail: None,
            is_custom_fare: true,
        };
    }

    let Some(base_price) = vehicle.base_price else {
        return fallback_fare(total_distance);
    };
    let Some(base_distance) = vehicle.base_distance else {
        return fallback_fare(total_distance);
    };
    let Some(price_per_km) = vehicle.price_per_km else {
        return fallback_fare(total_distance);
    };
    let extra_distance = (total_distance - base_distance).max(0.0);
    let extra_fare = extra_distance * price_per_km;
    let total_fare = base_price + extra_fare;
    let detail = json!({
        "base_price": base_price,
        "base_distance": base_distance,
        "price_per_km": price_per_km,
        "total_distance": total_distance,
        "extra_distance": extra_distance,
        "extra_fare": extra_fare,
        "total_fare": total_fare
    });

    FareCalculation {
        fare_price: total_fare,
        calculation_detail: Some(detail),
        is_custom_fare: false,
    }
}

fn fallback_fare(total_distance: f64) -> FareCalculation {
    FareCalculation {
        fare_price: total_distance,
        calculation_detail: None,
        is_custom_fare: false,
    }
}

fn haversine_km(lat1: f64, lon1: f64, lat2: f64, lon2: f64) -> f64 {
    let radius_km = 6371.0;
    let d_lat = (lat2 - lat1).to_radians();
    let d_lon = (lon2 - lon1).to_radians();
    let lat1 = lat1.to_radians();
    let lat2 = lat2.to_radians();
    let a = (d_lat / 2.0).sin().powi(2) + lat1.cos() * lat2.cos() * (d_lon / 2.0).sin().powi(2);
    let c = 2.0 * a.sqrt().atan2((1.0 - a).sqrt());

    radius_km * c
}

fn increment_json_count(counts: &mut Value, key: &str) {
    if let Some(value) = counts.get_mut(key) {
        let count = value.as_i64().unwrap_or(0) + 1;
        *value = json!(count);
    }
}

fn required_string(value: &Value, key: &str, message: &str) -> ApiResult<String> {
    string_field(value, key)
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| ApiError::BadRequest(message.to_string()))
}

fn required_number(value: &Value, key: &str, message: &str) -> ApiResult<f64> {
    number_field(value, key)?.ok_or_else(|| ApiError::BadRequest(message.to_string()))
}

fn validate_create_cargo_type(cargo_type: &str) -> ApiResult<()> {
    if matches!(cargo_type, "normal" | "fresh" | "fragile") {
        return Ok(());
    }

    Err(ApiError::BadRequest(
        "货品类型必须为 normal/fresh/fragile".to_string(),
    ))
}

fn string_field(value: &Value, key: &str) -> Option<String> {
    match value.get(key) {
        Some(Value::String(value)) => Some(value.clone()),
        Some(Value::Number(value)) => Some(value.to_string()),
        Some(Value::Bool(value)) => Some(value.to_string()),
        _ => None,
    }
}

fn number_field(value: &Value, key: &str) -> ApiResult<Option<f64>> {
    match value.get(key) {
        None | Some(Value::Null) => Ok(None),
        Some(Value::Number(value)) => value
            .as_f64()
            .map(Some)
            .ok_or_else(|| ApiError::BadRequest(format!("{key} 参数不正确"))),
        Some(Value::String(value)) => value
            .trim()
            .parse::<f64>()
            .map(Some)
            .map_err(|_| ApiError::BadRequest(format!("{key} 参数不正确"))),
        Some(_) => Err(ApiError::BadRequest(format!("{key} 参数不正确"))),
    }
}

fn json_field(value: &Value, key: &str) -> ApiResult<Option<Value>> {
    match value.get(key) {
        None | Some(Value::Null) => Ok(None),
        Some(Value::String(value)) => {
            if value.trim().is_empty() {
                Ok(None)
            } else {
                serde_json::from_str(value)
                    .map(Some)
                    .map_err(|_| ApiError::BadRequest(format!("{key} 参数不正确")))
            }
        }
        Some(Value::Object(_)) | Some(Value::Array(_)) => Ok(value.get(key).cloned()),
        Some(_) => Err(ApiError::BadRequest(format!("{key} 参数不正确"))),
    }
}

fn array_field(value: &Value, key: &str) -> Option<Value> {
    match value.get(key) {
        Some(Value::Array(_)) => value.get(key).cloned(),
        _ => None,
    }
}

fn has_field(value: &Value, key: &str) -> bool {
    value
        .as_object()
        .is_some_and(|object| object.contains_key(key))
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

fn push_where(builder: &mut QueryBuilder<'_, Postgres>, has_where: &mut bool) {
    if *has_where {
        builder.push(" AND ");
    } else {
        builder.push(" WHERE ");
        *has_where = true;
    }
}

fn location_number(location: &Value, key: &str) -> Option<f64> {
    match location {
        Value::Object(map) => map
            .get(key)
            .and_then(Value::as_f64)
            .or_else(|| number_alias(map, key)),
        Value::String(value) => serde_json::from_str::<Value>(value)
            .ok()
            .and_then(|parsed| location_number(&parsed, key)),
        _ => None,
    }
}

fn number_alias(map: &Map<String, Value>, key: &str) -> Option<f64> {
    match key {
        "latitude" => map.get("lat").and_then(Value::as_f64),
        "longitude" => map.get("lng").and_then(Value::as_f64),
        _ => None,
    }
}
