use axum::{
    extract::{Path, Query, State},
    routing::{delete, get, post, put},
    Json, Router,
};
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::FromRow;

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
        .route("/api/trips", get(list_trips::<S>).post(create_trip::<S>))
        .route(
            "/api/trips/undispatched-orders",
            get(undispatched_orders::<S>),
        )
        .route(
            "/api/trips/all-orders",
            get(all_orders::<S>),
        )
        .route(
            "/api/trips/available-vehicles",
            get(available_vehicles::<S>),
        )
        .route(
            "/api/trips/:id",
            get(get_trip::<S>)
                .put(update_trip::<S>)
                .delete(delete_trip::<S>),
        )
        .route("/api/trips/:id/lock", post(lock_trip::<S>))
        .route("/api/trips/:id/unlock", post(unlock_trip::<S>))
        .route("/api/trips/:id/start", post(start_trip::<S>))
        .route("/api/trips/:id/complete", post(complete_trip::<S>))
        .route("/api/trips/:id/cancel", post(cancel_trip::<S>))
        .route("/api/trips/:id/stops", post(add_stop::<S>))
        .route(
            "/api/trips/:id/stops/:stop_id",
            put(update_stop::<S>).delete(remove_stop::<S>),
        )
        .route(
            "/api/trips/:id/stops/:stop_id/complete",
            post(complete_stop::<S>),
        )
}

pub fn admin_router<S>() -> Router<AppState<S>>
where
    S: Storage,
{
    Router::new()
        .route(
            "/api/admin/trips",
            get(admin_list_trips::<S>).post(admin_create_trip::<S>),
        )
        .route("/api/admin/trips/:id", get(admin_get_trip::<S>))
        .route(
            "/api/admin/trips/:id/assign-orders",
            post(admin_assign_orders::<S>),
        )
        .route(
            "/api/admin/trips/:id/remove-order/:order_id",
            delete(admin_remove_order::<S>),
        )
        .route(
            "/api/admin/trips/:id/reorder-stops",
            put(admin_reorder_stops::<S>),
        )
        .route("/api/admin/trips/:id/lock", post(admin_lock_trip::<S>))
        .route("/api/admin/trips/:id/unlock", post(admin_unlock_trip::<S>))
        .route("/api/admin/trips/:id/start", post(admin_start_trip::<S>))
        .route(
            "/api/admin/trips/:id/complete",
            post(admin_complete_trip::<S>),
        )
        // 调度运营报表
        .route(
            "/api/admin/dispatch/vehicle-utilization",
            get(dispatch_vehicle_utilization::<S>),
        )
        .route(
            "/api/admin/dispatch/trip-efficiency",
            get(dispatch_trip_efficiency::<S>),
        )
        .route(
            "/api/admin/dispatch/delivery-performance",
            get(dispatch_delivery_performance::<S>),
        )
        .route("/api/admin/dispatch/overview", get(dispatch_overview::<S>))
        // 自动调度
        .route(
            "/api/admin/dispatch/auto-assign",
            post(dispatch_auto_assign::<S>),
        )
}

#[derive(Debug, Deserialize)]
struct TripQuery {
    vehicle_id: Option<String>,
    status: Option<String>,
    page: Option<i64>,
    #[serde(rename = "pageSize", alias = "page_size", alias = "limit")]
    page_size: Option<i64>,
}

#[derive(Debug, Deserialize)]
struct CreateTripRequest {
    #[serde(rename = "vehicleId", alias = "vehicle_id")]
    vehicle_id: String,
    #[serde(rename = "driverId", alias = "driver_id")]
    driver_id: Option<String>,
    #[serde(rename = "plannedDepartureTime", alias = "planned_departure_time")]
    planned_departure_time: Option<String>,
    #[serde(rename = "deliveryDate", alias = "delivery_date")]
    delivery_date: Option<String>,
    #[serde(rename = "deliveryTimeSlot", alias = "delivery_time_slot")]
    delivery_time_slot: Option<String>,
    notes: Option<String>,
    #[serde(rename = "orderIds", alias = "order_ids")]
    order_ids: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
struct UpdateTripRequest {
    #[serde(rename = "vehicleId", alias = "vehicle_id")]
    vehicle_id: Option<String>,
    #[serde(rename = "plannedDepartureTime", alias = "planned_departure_time")]
    planned_departure_time: Option<String>,
    notes: Option<String>,
}

#[derive(Debug, Deserialize)]
struct AddStopRequest {
    #[serde(rename = "mallOrderId", alias = "mall_order_id")]
    mall_order_id: Option<String>,
    #[serde(rename = "stopType", alias = "stop_type")]
    stop_type: Option<String>,
    #[serde(rename = "stopSequence", alias = "stop_sequence")]
    stop_sequence: Option<i32>,
    address: Option<String>,
    latitude: Option<f64>,
    longitude: Option<f64>,
    #[serde(rename = "contactName", alias = "contact_name")]
    contact_name: Option<String>,
    #[serde(rename = "contactPhone", alias = "contact_phone")]
    contact_phone: Option<String>,
    #[serde(rename = "cargoInfo", alias = "cargo_info")]
    cargo_info: Option<String>,
    notes: Option<String>,
}

#[derive(Debug, Deserialize)]
struct UpdateStopRequest {
    #[serde(rename = "stopSequence", alias = "stop_sequence")]
    stop_sequence: Option<i32>,
    address: Option<String>,
    latitude: Option<f64>,
    longitude: Option<f64>,
    #[serde(rename = "contactName", alias = "contact_name")]
    contact_name: Option<String>,
    #[serde(rename = "contactPhone", alias = "contact_phone")]
    contact_phone: Option<String>,
    #[serde(rename = "cargoInfo", alias = "cargo_info")]
    cargo_info: Option<String>,
    status: Option<String>,
    notes: Option<String>,
}

#[derive(Debug, Deserialize)]
struct AssignOrdersRequest {
    #[serde(rename = "orderIds", alias = "order_ids")]
    order_ids: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct ReorderStopsRequest {
    #[serde(rename = "stopIds", alias = "stop_ids")]
    stop_ids: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct CancelTripRequest {
    reason: Option<String>,
}

#[derive(Debug, FromRow)]
struct _TripRow {
    id: Option<String>,
    vehicle_id: Option<String>,
    status: Option<String>,
}

// ── Public API ──

async fn list_trips<S>(
    State(state): State<AppState<S>>,
    Query(query): Query<TripQuery>,
) -> ApiResult<Json<ApiEnvelope<Vec<Value>>>>
where
    S: Storage,
{
    let pagination = Pagination::from_query(query.page, query.page_size);
    let mut conditions = vec!["1=1".to_string()];
    if let Some(vehicle_id) = &query.vehicle_id {
        conditions.push(format!("t.vehicle_id = '{vehicle_id}'"));
    }
    if let Some(status) = &query.status {
        conditions.push(format!("t.status = '{status}'"));
    }
    conditions.push("(EXISTS (SELECT 1 FROM trip_stops WHERE trip_id = t.id) OR t.status = 'cancelled')".to_string());
    let where_clause = conditions.join(" AND ");

    let trips = sqlx::query_scalar::<_, Value>(&format!(
        r#"
            SELECT row_to_json(trip_row)
            FROM (
                SELECT t.*,
                    COALESCE(t.vehicle_code, v.vehicle_code) as vehicle_code,
                    COALESCE(t.license_plate, v.license_plate) as license_plate,
                    COALESCE(t.vehicle_type, v.vehicle_type) as vehicle_type,
                    COALESCE(
                        json_agg(
                            json_build_object(
                                'id', s.id,
                                'stopType', s.stop_type,
                                'stopSequence', s.stop_sequence,
                                'address', s.address,
                                'contactName', s.contact_name,
                                'contactPhone', s.contact_phone,
                                'cargoInfo', s.cargo_info,
                                'status', s.status,
                                'mallOrderId', s.mall_order_id,
                                'completedAt', s.completed_at,
                                'deliveryTimeSlot', o.delivery_time_slot,
                                'deliveryDate', o.delivery_date
                            ) ORDER BY s.stop_sequence
                        ) FILTER (WHERE s.id IS NOT NULL),
                        '[]'
                    ) as stops
                FROM vehicle_trips t
                LEFT JOIN vehicles v ON v.id = t.vehicle_id
                LEFT JOIN trip_stops s ON s.trip_id = t.id
                LEFT JOIN mall_orders o ON o.id = s.mall_order_id
                WHERE {where_clause}
                GROUP BY t.id, v.vehicle_code, v.license_plate, v.vehicle_type
                ORDER BY t.planned_departure_time DESC NULLS LAST, t.created_at DESC
                LIMIT {limit} OFFSET {offset}
            ) trip_row
            "#,
        where_clause = where_clause,
        limit = pagination.limit,
        offset = pagination.offset,
    ))
    .fetch_all(&state.db)
    .await
    .map_err(|err| ApiError::BadRequest(format!("查询行程失败: {err}")))?;

    Ok(ok("查询成功", trips))
}

async fn get_trip<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    Ok(ok("查询成功", fetch_trip_detail(&state.db, &id).await?))
}

async fn create_trip<S>(
    State(state): State<AppState<S>>,
    Json(body): Json<CreateTripRequest>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    Ok(ok("创建成功", do_create_trip(&state.db, &body).await?))
}

async fn update_trip<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
    Json(body): Json<UpdateTripRequest>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let trip = sqlx::query_scalar::<_, Value>(
        r#"
        UPDATE vehicle_trips
        SET vehicle_id = COALESCE($2, vehicle_id),
            planned_departure_time = CASE WHEN $3::boolean THEN $4::timestamptz ELSE planned_departure_time END,
            notes = COALESCE($5, notes),
            updated_at = now()
        WHERE id = $1
        RETURNING row_to_json(vehicle_trips)
        "#,
    )
    .bind(&id)
    .bind(&body.vehicle_id)
    .bind(body.planned_departure_time.is_some())
    .bind(body.planned_departure_time.as_deref())
    .bind(&body.notes)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| ApiError::NotFound("行程不存在".to_string()))?;

    Ok(ok("更新成功", trip))
}

async fn delete_trip<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let status: Option<String> =
        sqlx::query_scalar("SELECT status FROM vehicle_trips WHERE id = $1")
            .bind(&id)
            .fetch_optional(&state.db)
            .await?
            .flatten();

    let status = status.ok_or_else(|| ApiError::NotFound("行程不存在".to_string()))?;
    if status == "in_progress" || status == "locked" {
        return Err(ApiError::BadRequest(
            "进行中或已锁定的行程不能删除".to_string(),
        ));
    }

    // Return assignable mall orders to the public dispatch pool.
    sqlx::query(
        "UPDATE mall_orders SET trip_id = NULL, status = 'dispatching', dispatched_at = NULL, updated_at = now() WHERE trip_id = $1 AND status IN ('paid', 'ready_for_pickup', 'dispatching')",
    )
        .bind(&id)
        .execute(&state.db)
        .await?;

    // Reset vehicle trip_status if it was linked
    let vehicle_id: Option<String> =
        sqlx::query_scalar("SELECT vehicle_id FROM vehicle_trips WHERE id = $1")
            .bind(&id)
            .fetch_optional(&state.db)
            .await?
            .flatten();
    if let Some(vid) = vehicle_id {
        let _ = sqlx::query(
            "UPDATE vehicles SET trip_status = 'idle' WHERE id = $1 AND trip_status = 'in_transit'",
        )
        .bind(&vid)
        .execute(&state.db)
        .await;
    }

    sqlx::query("DELETE FROM vehicle_trips WHERE id = $1")
        .bind(&id)
        .execute(&state.db)
        .await?;

    Ok(ok("删除成功", json!({ "id": id })))
}

async fn start_trip<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    do_start_trip(&state.db, &id).await
}

async fn lock_trip<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    do_lock_trip(&state.db, &id).await
}

async fn unlock_trip<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    do_unlock_trip(&state.db, &id).await
}

async fn complete_trip<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    do_complete_trip(&state.db, &id).await
}

async fn cancel_trip<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
    Json(body): Json<CancelTripRequest>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let result = do_cancel_trip(&state.db, &id, body.reason.as_deref()).await?;
    Ok(ok("行程已取消，关联订单已退回订单池", result))
}

async fn add_stop<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
    Json(body): Json<AddStopRequest>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    do_add_stop(&state.db, &id, &body).await
}

async fn update_stop<S>(
    State(state): State<AppState<S>>,
    Path((trip_id, stop_id)): Path<(String, String)>,
    Json(body): Json<UpdateStopRequest>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    ensure_trip_editable(&state.db, &trip_id).await?;
    let stop = sqlx::query_scalar::<_, Value>(
        r#"
        UPDATE trip_stops
        SET stop_sequence = COALESCE($2, stop_sequence),
            address = COALESCE($3, address),
            latitude = CASE WHEN $4::boolean THEN $5::numeric ELSE latitude END,
            longitude = CASE WHEN $6::boolean THEN $7::numeric ELSE longitude END,
            contact_name = COALESCE($8, contact_name),
            contact_phone = COALESCE($9, contact_phone),
            cargo_info = COALESCE($10, cargo_info),
            status = COALESCE($11, status),
            notes = COALESCE($12, notes)
        WHERE id = $1 AND trip_id = $13
        RETURNING row_to_json(trip_stops)
        "#,
    )
    .bind(&stop_id)
    .bind(body.stop_sequence)
    .bind(&body.address)
    .bind(body.latitude.is_some())
    .bind(body.latitude)
    .bind(body.longitude.is_some())
    .bind(body.longitude)
    .bind(&body.contact_name)
    .bind(&body.contact_phone)
    .bind(&body.cargo_info)
    .bind(&body.status)
    .bind(&body.notes)
    .bind(&trip_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| ApiError::NotFound("站点不存在".to_string()))?;

    Ok(ok("更新成功", stop))
}

async fn remove_stop<S>(
    State(state): State<AppState<S>>,
    Path((trip_id, stop_id)): Path<(String, String)>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    ensure_trip_editable(&state.db, &trip_id).await?;
    let mut tx = state.db.begin().await?;
    let mall_order_id: Option<String> = sqlx::query_scalar(
        "DELETE FROM trip_stops WHERE id = $1 AND trip_id = $2 RETURNING mall_order_id",
    )
    .bind(&stop_id)
    .bind(&trip_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| ApiError::NotFound("站点不存在".to_string()))?;

    if let Some(order_id) = &mall_order_id {
        sqlx::query(
            "UPDATE mall_orders SET trip_id = NULL, status = 'dispatching', dispatched_at = NULL, updated_at = now() WHERE id = $1 AND trip_id = $2",
        )
            .bind(order_id)
            .bind(&trip_id)
            .execute(&mut *tx)
            .await?;
    }

    let has_remaining_stops: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM trip_stops WHERE trip_id = $1)",
    )
    .bind(&trip_id)
    .fetch_one(&mut *tx)
    .await?;

    if !has_remaining_stops {
        sqlx::query("DELETE FROM vehicle_trips WHERE id = $1")
            .bind(&trip_id)
            .execute(&mut *tx)
            .await?;
        tx.commit().await?;
        return Ok(ok("行程已删除（最后一个站点已移除）", json!({"deleted": true})));
    }

    sync_trip_counts(&mut tx, &trip_id).await?;
    tx.commit().await?;

    Ok(ok("删除成功", json!({ "id": stop_id })))
}

async fn complete_stop<S>(
    State(state): State<AppState<S>>,
    Path((trip_id, stop_id)): Path<(String, String)>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let trip_status: Option<String> =
        sqlx::query_scalar("SELECT status FROM vehicle_trips WHERE id = $1")
            .bind(&trip_id)
            .fetch_optional(&state.db)
            .await?
            .flatten();
    if trip_status.as_deref() != Some("in_progress") {
        return Err(ApiError::BadRequest(
            "只有进行中的行程可以完成站点".to_string(),
        ));
    }

    let mut tx = state.db.begin().await?;
    let stop = sqlx::query_scalar::<_, Value>(
        r#"
        UPDATE trip_stops
        SET status = 'completed', completed_at = now()
        WHERE id = $1 AND trip_id = $2
        RETURNING row_to_json(trip_stops)
        "#,
    )
    .bind(&stop_id)
    .bind(&trip_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| ApiError::NotFound("站点不存在".to_string()))?;

    if stop.get("stop_type").and_then(Value::as_str) == Some("delivery") {
        let mall_order_id = stop.get("mall_order_id").and_then(Value::as_str);
        if let Some(order_id) = mall_order_id {
            sqlx::query(
                "UPDATE mall_orders SET status = 'completed', completed_at = now(), updated_at = now() WHERE id = $1 AND trip_id = $2 AND status IN ('paid', 'ready_for_pickup', 'dispatching')",
            )
            .bind(order_id)
            .bind(&trip_id)
            .execute(&mut *tx)
            .await?;
        }
    }

    sync_trip_counts(&mut tx, &trip_id).await?;
    tx.commit().await?;

    Ok(ok("站点已完成", stop))
}

async fn undispatched_orders<S>(
    State(state): State<AppState<S>>,
) -> ApiResult<Json<ApiEnvelope<Vec<Value>>>>
where
    S: Storage,
{
    let orders = sqlx::query_scalar::<_, Value>(
        r#"
        SELECT row_to_json(order_row)
        FROM (
            SELECT o.*,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'id', oi.id,
                            'productId', oi.product_id,
                            'productName', oi.product_name,
                            'variantName', oi.variant_name,
                            'sku', oi.sku,
                            'quantity', oi.quantity,
                            'unitPriceCents', oi.unit_price_cents,
                            'lineTotalCents', oi.line_total_cents,
                            'imageUrl', oi.image_url,
                            'weightUnit', oi.weight_unit_label,
                            'pricingMode', oi.pricing_mode
                        )
                    ) FILTER (WHERE oi.id IS NOT NULL),
                    '[]'
                ) as items
            FROM mall_orders o
            LEFT JOIN mall_order_items oi ON oi.order_id = o.id
            WHERE o.trip_id IS NULL AND o.status IN ('paid', 'ready_for_pickup', 'dispatching')
            GROUP BY o.id
            ORDER BY o.created_at ASC
        ) order_row
        "#,
    )
    .fetch_all(&state.db)
    .await
    .map_err(|err| ApiError::BadRequest(format!("查询未分配订单失败: {err}")))?;

    Ok(ok("查询成功", orders))
}

async fn all_orders<S>(
    State(state): State<AppState<S>>,
    Query(query): Query<TripQuery>,
) -> ApiResult<Json<ApiEnvelope<Vec<Value>>>>
where
    S: Storage,
{
    let limit = query.page_size.unwrap_or(200).min(500);
    let orders = sqlx::query_scalar::<_, Value>(
        r#"
        SELECT row_to_json(order_row)
        FROM (
            SELECT o.*,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'id', oi.id,
                            'productId', oi.product_id,
                            'productName', oi.product_name,
                            'variantName', oi.variant_name,
                            'sku', oi.sku,
                            'quantity', oi.quantity,
                            'unitPriceCents', oi.unit_price_cents,
                            'lineTotalCents', oi.line_total_cents,
                            'imageUrl', oi.image_url,
                            'weightUnit', oi.weight_unit_label,
                            'pricingMode', oi.pricing_mode
                        )
                    ) FILTER (WHERE oi.id IS NOT NULL),
                    '[]'
                ) as items,
                t.id as trip_id,
                t.status as trip_status,
                COALESCE(t.vehicle_code, v.vehicle_code) as vehicle_code,
                COALESCE(t.license_plate, v.license_plate) as license_plate,
                COALESCE(t.vehicle_type, v.vehicle_type) as vehicle_type
            FROM mall_orders o
            LEFT JOIN mall_order_items oi ON oi.order_id = o.id
            LEFT JOIN vehicle_trips t ON t.id = o.trip_id
            LEFT JOIN vehicles v ON v.id = t.vehicle_id
            WHERE o.status IN ('paid', 'ready_for_pickup', 'dispatching', 'completed')
            GROUP BY o.id, t.id, v.vehicle_code, v.license_plate, v.vehicle_type
            ORDER BY o.created_at DESC
            LIMIT $1
        ) order_row
        "#,
    )
    .bind(limit)
    .fetch_all(&state.db)
    .await
    .map_err(|err| ApiError::BadRequest(format!("查询订单失败: {err}")))?;

    Ok(ok("查询成功", orders))
}

async fn available_vehicles<S>(
    State(state): State<AppState<S>>,
) -> ApiResult<Json<ApiEnvelope<Vec<Value>>>>
where
    S: Storage,
{
    // In legacy mode, vehicles table is in the same database.
    // In split mode, this would need to call the vehicle API instead.
    let vehicles = sqlx::query_scalar::<_, Value>(
        r#"
        SELECT row_to_json(v)
        FROM (
            SELECT id, vehicle_code, license_plate, vehicle_type,
                load_capacity, volume, status, trip_status,
                current_location, operation_area
            FROM vehicles
            WHERE status = 'active' AND (trip_status IS NULL OR trip_status = 'idle')
            ORDER BY vehicle_code
        ) v
        "#,
    )
    .fetch_all(&state.db)
    .await;

    match vehicles {
        Ok(v) => Ok(ok("查询成功", v)),
        Err(_) => {
            // vehicles table not in this database - return empty
            Ok(ok("查询成功", Vec::<Value>::new()))
        }
    }
}

// ── Admin API ──

async fn admin_list_trips<S>(
    State(state): State<AppState<S>>,
    Query(query): Query<TripQuery>,
) -> ApiResult<Json<ApiEnvelope<Vec<Value>>>>
where
    S: Storage,
{
    list_trips(State(state), Query(query)).await
}

async fn admin_get_trip<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    get_trip(State(state), Path(id)).await
}

async fn admin_create_trip<S>(
    State(state): State<AppState<S>>,
    Json(body): Json<CreateTripRequest>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    Ok(ok("创建成功", do_create_trip(&state.db, &body).await?))
}

async fn admin_assign_orders<S>(
    State(state): State<AppState<S>>,
    Path(trip_id): Path<String>,
    Json(body): Json<AssignOrdersRequest>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    if body.order_ids.is_empty() {
        return Err(ApiError::BadRequest("请选择要分配的订单".to_string()));
    }

    let trip_status: Option<String> =
        sqlx::query_scalar("SELECT status FROM vehicle_trips WHERE id = $1")
            .bind(&trip_id)
            .fetch_optional(&state.db)
            .await?
            .flatten();

    let trip_status = trip_status.ok_or_else(|| ApiError::NotFound("行程不存在".to_string()))?;
    if trip_status != "planned" && trip_status != "locked" {
        return Err(ApiError::BadRequest(
            "只有未锁定或已锁定的行程可以添加订单".to_string(),
        ));
    }

    let mut tx = state.db.begin().await?;
    let mut added_count = 0i64;

    // 获取行程当前的时间段
    let trip_info: Option<(Option<String>, Option<String>)> = sqlx::query_as(
        "SELECT delivery_date::text, delivery_time_slot FROM vehicle_trips WHERE id = $1",
    )
    .bind(&trip_id)
    .fetch_optional(&mut *tx)
    .await?;

    let (mut trip_delivery_date, mut trip_time_slot) = trip_info.unwrap_or((None, None));
    let mut need_update_trip_slot = false;

    // Get current max stop sequence
    let max_seq: Option<i32> = sqlx::query_scalar(
        "SELECT COALESCE(MAX(stop_sequence), 0) FROM trip_stops WHERE trip_id = $1",
    )
    .bind(&trip_id)
    .fetch_one(&mut *tx)
    .await?;

    for (idx, order_id) in body.order_ids.iter().enumerate() {
        let order: Option<Value> = sqlx::query_scalar(
            r#"
            UPDATE mall_orders
            SET trip_id = $2,
                status = 'dispatching',
                dispatched_at = COALESCE(dispatched_at, now()),
                updated_at = now()
            WHERE id = $1
              AND trip_id IS NULL
              AND status IN ('paid', 'ready_for_pickup', 'dispatching')
            RETURNING jsonb_build_object('id', id, 'status', status,
                'addressText', address_text, 'latitude', latitude, 'longitude', longitude,
                'recipientName', recipient_name, 'recipientPhone', recipient_phone,
                'waypoints', COALESCE(waypoints, '[]'::jsonb),
                'originLatitude', origin_latitude, 'originLongitude', origin_longitude,
                'originAddress', origin_address,
                'deliveryDate', delivery_date::text, 'deliveryTimeSlot', delivery_time_slot)
            "#,
        )
        .bind(order_id)
        .bind(&trip_id)
        .fetch_optional(&mut *tx)
        .await?;

        let Some(order) = order else { continue };

        // 如果行程没有时间段，从订单同步
        if !need_update_trip_slot {
            let order_date = order.get("deliveryDate").and_then(Value::as_str).map(String::from);
            let order_slot = order.get("deliveryTimeSlot").and_then(Value::as_str).map(String::from);
            if (trip_delivery_date.is_none() && order_date.is_some())
                || (trip_time_slot.is_none() && order_slot.is_some())
            {
                trip_delivery_date = trip_delivery_date.or(order_date);
                trip_time_slot = trip_time_slot.or(order_slot);
                need_update_trip_slot = true;
            }
        }

        let seq = max_seq.unwrap_or(0) + (idx as i32 * 10) + 1;
        let mut current_seq = seq;

        // If there are waypoints, create stops for each waypoint first
        if let Some(waypoints) = order.get("waypoints").and_then(Value::as_array) {
            for (_wp_idx, wp) in waypoints.iter().enumerate() {
                let wp_lat = wp
                    .get("latitude")
                    .and_then(|v| v.as_str())
                    .and_then(|s| s.parse::<f64>().ok());
                let wp_lng = wp
                    .get("longitude")
                    .and_then(|v| v.as_str())
                    .and_then(|s| s.parse::<f64>().ok());
                let wp_address = wp.get("address").and_then(Value::as_str);
                let wp_name = wp.get("name").and_then(Value::as_str);

                if wp_lat.is_some() && wp_lng.is_some() {
                    sqlx::query(
                        r#"
                        INSERT INTO trip_stops (trip_id, mall_order_id, stop_type, stop_sequence,
                            address, latitude, longitude, contact_name, contact_phone, cargo_info, status)
                        VALUES ($1, $2, 'waypoint', $3, $4, $5, $6, $7, $8, $9, 'pending')
                        "#,
                    )
                    .bind(&trip_id)
                    .bind(order_id)
                    .bind(current_seq)
                    .bind(wp_address)
                    .bind(wp_lat)
                    .bind(wp_lng)
                    .bind(wp_name)
                    .bind(None::<&str>)
                    .bind(order.get("id").and_then(Value::as_str))
                    .execute(&mut *tx)
                    .await?;

                    current_seq += 1;
                }
            }
        }

        // Create delivery stop for this order (final destination)
        sqlx::query(
            r#"
            INSERT INTO trip_stops (trip_id, mall_order_id, stop_type, stop_sequence,
                address, latitude, longitude, contact_name, contact_phone, cargo_info, status)
            VALUES ($1, $2, 'delivery', $3, $4, $5, $6, $7, $8, $9, 'pending')
            "#,
        )
        .bind(&trip_id)
        .bind(order_id)
        .bind(current_seq)
        .bind(order.get("addressText").and_then(Value::as_str))
        .bind(order.get("latitude").and_then(|v| v.as_f64()))
        .bind(order.get("longitude").and_then(|v| v.as_f64()))
        .bind(order.get("recipientName").and_then(Value::as_str))
        .bind(order.get("recipientPhone").and_then(Value::as_str))
        .bind(order.get("id").and_then(Value::as_str))
        .execute(&mut *tx)
        .await?;

        added_count += 1;
    }

    if added_count == 0 {
        return Err(ApiError::BadRequest(
            "所选订单均已被分配或当前状态不可分配".to_string(),
        ));
    }

    // 更新行程时间段
    if need_update_trip_slot && (trip_delivery_date.is_some() || trip_time_slot.is_some()) {
        sqlx::query(
            "UPDATE vehicle_trips SET delivery_date = $1::date, delivery_time_slot = $2, updated_at = now() WHERE id = $3",
        )
        .bind(trip_delivery_date.as_deref())
        .bind(&trip_time_slot)
        .bind(&trip_id)
        .execute(&mut *tx)
        .await?;
    }

    sync_trip_counts(&mut tx, &trip_id).await?;

    tx.commit().await?;

    let trip = fetch_trip_detail(&state.db, &trip_id).await?;
    Ok(ok(format!("已分配{added_count}个订单"), trip))
}

async fn admin_remove_order<S>(
    State(state): State<AppState<S>>,
    Path((trip_id, order_id)): Path<(String, String)>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    ensure_trip_editable(&state.db, &trip_id).await?;
    let mut tx = state.db.begin().await?;

    let returned_order_id: Option<String> = sqlx::query_scalar(
        r#"
        UPDATE mall_orders
        SET trip_id = NULL,
            status = 'dispatching',
            dispatched_at = NULL,
            updated_at = now()
        WHERE id = $1
          AND trip_id = $2
          AND status IN ('paid', 'ready_for_pickup', 'dispatching')
        RETURNING id
        "#,
    )
    .bind(&order_id)
    .bind(&trip_id)
    .fetch_optional(&mut *tx)
    .await?;

    if returned_order_id.is_none() {
        return Err(ApiError::BadRequest(
            "订单不属于该行程或当前状态不可移除".to_string(),
        ));
    }

    sqlx::query("DELETE FROM trip_stops WHERE trip_id = $1 AND mall_order_id = $2")
        .bind(&trip_id)
        .bind(&order_id)
        .execute(&mut *tx)
        .await?;

    let has_remaining_stops: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM trip_stops WHERE trip_id = $1)",
    )
    .bind(&trip_id)
    .fetch_one(&mut *tx)
    .await?;

    if !has_remaining_stops {
        sqlx::query("DELETE FROM vehicle_trips WHERE id = $1")
            .bind(&trip_id)
            .execute(&mut *tx)
            .await?;
        tx.commit().await?;
        return Ok(ok("行程已删除（最后一个订单已移除）", json!({"deleted": true})));
    }

    sync_trip_counts(&mut tx, &trip_id).await?;

    tx.commit().await?;

    let trip = fetch_trip_detail(&state.db, &trip_id).await?;
    Ok(ok("订单已移除", trip))
}

async fn admin_reorder_stops<S>(
    State(state): State<AppState<S>>,
    Path(trip_id): Path<String>,
    Json(body): Json<ReorderStopsRequest>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    ensure_trip_editable(&state.db, &trip_id).await?;
    let unique_stop_ids = body
        .stop_ids
        .iter()
        .collect::<std::collections::HashSet<_>>();
    if unique_stop_ids.len() != body.stop_ids.len() {
        return Err(ApiError::BadRequest("站点列表不能包含重复项".to_string()));
    }

    let existing_stop_count: i64 =
        sqlx::query_scalar("SELECT count(*) FROM trip_stops WHERE trip_id = $1")
            .bind(&trip_id)
            .fetch_one(&state.db)
            .await?;
    if existing_stop_count != body.stop_ids.len() as i64 {
        return Err(ApiError::BadRequest(
            "请提交该行程的完整站点列表".to_string(),
        ));
    }

    let mut tx = state.db.begin().await?;
    for (idx, stop_id) in body.stop_ids.iter().enumerate() {
        let result =
            sqlx::query("UPDATE trip_stops SET stop_sequence = $1 WHERE id = $2 AND trip_id = $3")
                .bind((idx + 1) as i32)
                .bind(stop_id)
                .bind(&trip_id)
                .execute(&mut *tx)
                .await?;
        if result.rows_affected() != 1 {
            return Err(ApiError::BadRequest(
                "站点列表包含不属于该行程的站点".to_string(),
            ));
        }
    }
    tx.commit().await?;

    let trip = fetch_trip_detail(&state.db, &trip_id).await?;
    Ok(ok("站点顺序已更新", trip))
}

async fn admin_start_trip<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    do_start_trip(&state.db, &id).await
}

async fn admin_complete_trip<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    do_complete_trip(&state.db, &id).await
}

async fn admin_lock_trip<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    do_lock_trip(&state.db, &id).await
}

async fn admin_unlock_trip<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    do_unlock_trip(&state.db, &id).await
}

// ── Shared logic ──

async fn do_create_trip(pool: &sqlx::PgPool, body: &CreateTripRequest) -> ApiResult<Value> {
    // Try to verify vehicle exists and get info (may not be available in split-service mode)
    let vehicle: Option<Value> = sqlx::query_scalar(
        r#"SELECT jsonb_build_object('id', id, 'status', status, 'tripStatus', trip_status, 'vehicleCode', vehicle_code, 'licensePlate', license_plate, 'vehicleType', vehicle_type) FROM vehicles WHERE id = $1"#,
    )
    .bind(&body.vehicle_id)
    .fetch_optional(pool)
    .await?
    .flatten();

    if let Some(ref v) = vehicle {
        if v.get("status").and_then(Value::as_str) != Some("active") {
            return Err(ApiError::BadRequest("所选车辆不可用".to_string()));
        }
    }

    let vehicle_code = vehicle
        .as_ref()
        .and_then(|v| v.get("vehicleCode"))
        .and_then(Value::as_str)
        .map(String::from);
    let license_plate = vehicle
        .as_ref()
        .and_then(|v| v.get("licensePlate"))
        .and_then(Value::as_str)
        .map(String::from);
    let vehicle_type = vehicle
        .as_ref()
        .and_then(|v| v.get("vehicleType"))
        .and_then(Value::as_str)
        .map(String::from);

    // 确定配送日期：优先用传入的，没有默认今天
    let delivery_date = body.delivery_date.clone().or_else(|| {
        chrono::Local::now().format("%Y-%m-%d").to_string().into()
    });

    // 校验：同一天同一辆车只能有一个进行中的行程
    let existing_trip: Option<Value> = sqlx::query_scalar(
        r#"
        SELECT row_to_json(vehicle_trips)
        FROM vehicle_trips
        WHERE vehicle_id = $1
          AND delivery_date = $2::date
          AND status IN ('planned', 'locked', 'in_progress')
        LIMIT 1
        "#,
    )
    .bind(&body.vehicle_id)
    .bind(delivery_date.as_deref())
    .fetch_optional(pool)
    .await?;

    if let Some(existing) = existing_trip {
        let existing_no = existing.get("trip_no").and_then(Value::as_i64).unwrap_or(0);
        return Err(ApiError::BadRequest(format!(
            "该车辆今日已有行程（编号 #{existing_no}），请直接追加订单"
        )));
    }

    let mut tx = pool.begin().await?;
    let trip: Value = sqlx::query_scalar(
        r#"
        INSERT INTO vehicle_trips (vehicle_id, vehicle_code, license_plate, vehicle_type, driver_id, planned_departure_time, delivery_date, delivery_time_slot, notes, status, created_by)
        VALUES ($1, $2, $3, $4, $5, $6::timestamptz, $7::date, $8, $9, 'planned', $10)
        RETURNING row_to_json(vehicle_trips)
        "#,
    )
    .bind(&body.vehicle_id)
    .bind(&vehicle_code)
    .bind(&license_plate)
    .bind(&vehicle_type)
    .bind(&body.driver_id)
    .bind(body.planned_departure_time.as_deref())
    .bind(delivery_date.as_deref())
    .bind(&body.delivery_time_slot)
    .bind(&body.notes)
    .bind(&body.driver_id)
    .fetch_one(&mut *tx)
    .await
    .map_err(|err| ApiError::BadRequest(format!("创建行程失败: {err}")))?;

    let trip_id = trip.get("id").and_then(Value::as_str).unwrap_or("");
    let mut assigned_count = 0;
    if let Some(order_ids) = &body.order_ids {
        for order_id in order_ids {
            let order: Option<Value> = sqlx::query_scalar(
                r#"
                UPDATE mall_orders
                SET trip_id = $1,
                    status = 'dispatching',
                    dispatched_at = COALESCE(dispatched_at, now()),
                    updated_at = now()
                WHERE id = $2
                  AND trip_id IS NULL
                  AND status IN ('paid', 'ready_for_pickup', 'dispatching')
                RETURNING jsonb_build_object(
                    'id', id, 'addressText', address_text, 'latitude', latitude,
                    'longitude', longitude, 'recipientName', recipient_name,
                    'recipientPhone', recipient_phone
                )
                "#,
            )
            .bind(trip_id)
            .bind(order_id)
            .fetch_optional(&mut *tx)
            .await?;

            let Some(order) = order else { continue };
            assigned_count += 1;
            sqlx::query(
                r#"
                INSERT INTO trip_stops (trip_id, mall_order_id, stop_type, stop_sequence,
                    address, latitude, longitude, contact_name, contact_phone, cargo_info, status)
                VALUES ($1, $2, 'delivery', $3, $4, $5, $6, $7, $8, $9, 'pending')
                "#,
            )
            .bind(trip_id)
            .bind(order_id)
            .bind(assigned_count)
            .bind(order.get("addressText").and_then(Value::as_str))
            .bind(order.get("latitude").and_then(Value::as_f64))
            .bind(order.get("longitude").and_then(Value::as_f64))
            .bind(order.get("recipientName").and_then(Value::as_str))
            .bind(order.get("recipientPhone").and_then(Value::as_str))
            .bind(order_id)
            .execute(&mut *tx)
            .await?;
        }

        if !order_ids.is_empty() && assigned_count == 0 {
            // 没有订单被分配，删除空行程
            sqlx::query("DELETE FROM vehicle_trips WHERE id = $1")
                .bind(trip_id)
                .execute(&mut *tx)
                .await?;
            tx.commit().await?;
            return Err(ApiError::BadRequest(
                "所选订单已被分配或当前状态不可分配".to_string(),
            ));
        }
    }

    // 如果没有订单需要分配，删除空行程
    if assigned_count == 0 {
        sqlx::query("DELETE FROM vehicle_trips WHERE id = $1")
            .bind(trip_id)
            .execute(&mut *tx)
            .await?;
        tx.commit().await?;
        return Err(ApiError::BadRequest("请选择要分配的订单".to_string()));
    }

    sync_trip_counts(&mut tx, trip_id).await?;
    tx.commit().await?;
    fetch_trip_detail(pool, trip_id).await
}

async fn do_start_trip(pool: &sqlx::PgPool, id: &str) -> ApiResult<Json<ApiEnvelope<Value>>> {
    let status: Option<String> =
        sqlx::query_scalar("SELECT status FROM vehicle_trips WHERE id = $1")
            .bind(id)
            .fetch_optional(pool)
            .await?
            .flatten();

    let status = status.ok_or_else(|| ApiError::NotFound("行程不存在".to_string()))?;
    if status != "locked" {
        return Err(ApiError::BadRequest("只有已锁定的行程可以出发".to_string()));
    }
    ensure_trip_has_orders(pool, id).await?;

    let vehicle_id: Option<String> =
        sqlx::query_scalar("SELECT vehicle_id FROM vehicle_trips WHERE id = $1")
            .bind(id)
            .fetch_optional(pool)
            .await?
            .flatten();

    let mut tx = pool.begin().await?;

    sqlx::query("UPDATE vehicle_trips SET status = 'in_progress', actual_departure_time = now(), updated_at = now() WHERE id = $1")
        .bind(id)
        .execute(&mut *tx)
        .await?;

    if let Some(vid) = vehicle_id {
        // Best-effort: update vehicle trip_status (may not exist in this database)
        let _ = sqlx::query("UPDATE vehicles SET trip_status = 'in_transit' WHERE id = $1")
            .bind(&vid)
            .execute(&mut *tx)
            .await;
    }

    tx.commit().await?;

    let trip = fetch_trip_detail(pool, id).await?;
    Ok(ok("行程已开始", trip))
}

async fn do_complete_trip(pool: &sqlx::PgPool, id: &str) -> ApiResult<Json<ApiEnvelope<Value>>> {
    let status: Option<String> =
        sqlx::query_scalar("SELECT status FROM vehicle_trips WHERE id = $1")
            .bind(id)
            .fetch_optional(pool)
            .await?
            .flatten();

    let status = status.ok_or_else(|| ApiError::NotFound("行程不存在".to_string()))?;
    if status != "in_progress" {
        return Err(ApiError::BadRequest("只有进行中的行程可以完成".to_string()));
    }

    let vehicle_id: Option<String> =
        sqlx::query_scalar("SELECT vehicle_id FROM vehicle_trips WHERE id = $1")
            .bind(id)
            .fetch_optional(pool)
            .await?
            .flatten();

    let mut tx = pool.begin().await?;

    sqlx::query("UPDATE vehicle_trips SET status = 'completed', completed_time = now(), completed_orders = total_orders, updated_at = now() WHERE id = $1")
        .bind(id)
        .execute(&mut *tx)
        .await?;

    // Complete all pending stops
    sqlx::query("UPDATE trip_stops SET status = 'completed', completed_at = now() WHERE trip_id = $1 AND status != 'completed'")
        .bind(id)
        .execute(&mut *tx)
        .await?;

    // Complete all mall orders in this trip
    sqlx::query("UPDATE mall_orders SET status = 'completed', completed_at = now(), updated_at = now() WHERE trip_id = $1 AND status IN ('paid', 'ready_for_pickup', 'dispatching')")
        .bind(id)
        .execute(&mut *tx)
        .await?;

    if let Some(vid) = vehicle_id {
        // Best-effort: update vehicle trip_status (may not exist in this database)
        let _ = sqlx::query("UPDATE vehicles SET trip_status = 'idle' WHERE id = $1")
            .bind(&vid)
            .execute(&mut *tx)
            .await;
    }

    tx.commit().await?;

    let trip = fetch_trip_detail(pool, id).await?;
    Ok(ok("行程已完成", trip))
}

async fn do_lock_trip(pool: &sqlx::PgPool, id: &str) -> ApiResult<Json<ApiEnvelope<Value>>> {
    let status: Option<String> =
        sqlx::query_scalar("SELECT status FROM vehicle_trips WHERE id = $1")
            .bind(id)
            .fetch_optional(pool)
            .await?
            .flatten();

    let status = status.ok_or_else(|| ApiError::NotFound("行程不存在".to_string()))?;
    if status != "planned" {
        return Err(ApiError::BadRequest("只有未锁定的行程可以锁定".to_string()));
    }
    ensure_trip_has_orders(pool, id).await?;

    sqlx::query("UPDATE vehicle_trips SET status = 'locked', updated_at = now() WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await?;

    let trip = fetch_trip_detail(pool, id).await?;
    Ok(ok("行程已锁定", trip))
}

async fn do_unlock_trip(pool: &sqlx::PgPool, id: &str) -> ApiResult<Json<ApiEnvelope<Value>>> {
    let status: Option<String> =
        sqlx::query_scalar("SELECT status FROM vehicle_trips WHERE id = $1")
            .bind(id)
            .fetch_optional(pool)
            .await?
            .flatten();

    let status = status.ok_or_else(|| ApiError::NotFound("行程不存在".to_string()))?;
    if status != "locked" {
        return Err(ApiError::BadRequest("只有已锁定的行程可以解锁".to_string()));
    }

    sqlx::query("UPDATE vehicle_trips SET status = 'planned', updated_at = now() WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await?;

    let trip = fetch_trip_detail(pool, id).await?;
    Ok(ok("行程已解锁", trip))
}

async fn do_cancel_trip(pool: &sqlx::PgPool, id: &str, reason: Option<&str>) -> ApiResult<Value> {
    let status: Option<String> =
        sqlx::query_scalar("SELECT status FROM vehicle_trips WHERE id = $1")
            .bind(id)
            .fetch_optional(pool)
            .await?
            .flatten();

    let status = status.ok_or_else(|| ApiError::NotFound("行程不存在".to_string()))?;
    if status == "completed" || status == "cancelled" {
        return Err(ApiError::BadRequest(
            "已完成或已取消的行程无法取消".to_string(),
        ));
    }

    let vehicle_id: Option<String> =
        sqlx::query_scalar("SELECT vehicle_id FROM vehicle_trips WHERE id = $1")
            .bind(id)
            .fetch_optional(pool)
            .await?
            .flatten();

    let mut tx = pool.begin().await?;

    sqlx::query(
        r#"
        UPDATE vehicle_trips
        SET status = 'cancelled',
            cancel_reason = $2,
            cancelled_at = now(),
            updated_at = now()
        WHERE id = $1
        "#,
    )
    .bind(id)
    .bind(reason)
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        "UPDATE mall_orders SET trip_id = NULL, status = 'dispatching', dispatched_at = NULL, updated_at = now() WHERE trip_id = $1 AND status IN ('paid', 'ready_for_pickup', 'dispatching')",
    )
    .bind(id)
    .execute(&mut *tx)
    .await?;

    sqlx::query("DELETE FROM trip_stops WHERE trip_id = $1")
        .bind(id)
        .execute(&mut *tx)
        .await?;

    if let Some(vid) = vehicle_id {
        let _ = sqlx::query(
            "UPDATE vehicles SET trip_status = 'idle', updated_at = now() WHERE id = $1",
        )
        .bind(&vid)
        .execute(&mut *tx)
        .await;
    }

    tx.commit().await?;

    let trip = sqlx::query_scalar::<_, Value>(
        "SELECT row_to_json(vehicle_trips) FROM vehicle_trips WHERE id = $1",
    )
    .bind(id)
    .fetch_one(pool)
    .await?;

    Ok(trip)
}

async fn do_add_stop(
    pool: &sqlx::PgPool,
    trip_id: &str,
    body: &AddStopRequest,
) -> ApiResult<Json<ApiEnvelope<Value>>> {
    ensure_trip_editable(pool, trip_id).await?;
    let stop_type = body.stop_type.as_deref().unwrap_or("delivery");
    if !matches!(stop_type, "pickup" | "delivery") {
        return Err(ApiError::BadRequest("站点类型不合法".to_string()));
    }

    let mut tx = pool.begin().await?;
    if let Some(order_id) = &body.mall_order_id {
        let assigned_order: Option<String> = sqlx::query_scalar(
            r#"
            UPDATE mall_orders
            SET trip_id = $1,
                status = 'dispatching',
                dispatched_at = COALESCE(dispatched_at, now()),
                updated_at = now()
            WHERE id = $2
              AND trip_id IS NULL
              AND status IN ('paid', 'ready_for_pickup', 'dispatching')
            RETURNING id
            "#,
        )
        .bind(trip_id)
        .bind(order_id)
        .fetch_optional(&mut *tx)
        .await?;
        if assigned_order.is_none() {
            return Err(ApiError::BadRequest(
                "订单不存在、已被分配或当前状态不可分配".to_string(),
            ));
        }
    }

    let sequence = match body.stop_sequence {
        Some(sequence) => sequence,
        None => {
            sqlx::query_scalar::<_, i32>(
                "SELECT COALESCE(MAX(stop_sequence), 0) + 1 FROM trip_stops WHERE trip_id = $1",
            )
            .bind(trip_id)
            .fetch_one(&mut *tx)
            .await?
        }
    };
    let stop = sqlx::query_scalar::<_, Value>(
        r#"
        INSERT INTO trip_stops (trip_id, mall_order_id, stop_type, stop_sequence,
            address, latitude, longitude, contact_name, contact_phone, cargo_info, status, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending', $11)
        RETURNING row_to_json(trip_stops)
        "#,
    )
    .bind(trip_id)
    .bind(&body.mall_order_id)
    .bind(stop_type)
    .bind(sequence)
    .bind(&body.address)
    .bind(body.latitude)
    .bind(body.longitude)
    .bind(&body.contact_name)
    .bind(&body.contact_phone)
    .bind(&body.cargo_info)
    .bind(&body.notes)
    .fetch_one(&mut *tx)
    .await
    .map_err(|err| ApiError::BadRequest(format!("添加站点失败: {err}")))?;

    sync_trip_counts(&mut tx, trip_id).await?;
    tx.commit().await?;

    Ok(ok("站点已添加", stop))
}

async fn ensure_trip_editable(pool: &sqlx::PgPool, trip_id: &str) -> ApiResult<()> {
    let status: Option<String> =
        sqlx::query_scalar("SELECT status FROM vehicle_trips WHERE id = $1")
            .bind(trip_id)
            .fetch_optional(pool)
            .await?
            .flatten();

    match status.as_deref() {
        Some("planned" | "locked") => Ok(()),
        Some(_) => Err(ApiError::BadRequest(
            "只有未锁定或已锁定的行程可以调整订单和站点".to_string(),
        )),
        None => Err(ApiError::NotFound("行程不存在".to_string())),
    }
}

async fn ensure_trip_has_orders(pool: &sqlx::PgPool, trip_id: &str) -> ApiResult<()> {
    let order_count: i64 = sqlx::query_scalar(
        "SELECT count(DISTINCT mall_order_id) FROM trip_stops WHERE trip_id = $1 AND mall_order_id IS NOT NULL",
    )
    .bind(trip_id)
    .fetch_one(pool)
    .await?;
    if order_count == 0 {
        return Err(ApiError::BadRequest("空行程不能锁定或发车".to_string()));
    }
    Ok(())
}

async fn sync_trip_counts(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    trip_id: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        UPDATE vehicle_trips
        SET total_orders = (
                SELECT count(DISTINCT mall_order_id)
                FROM trip_stops
                WHERE trip_id = $1 AND mall_order_id IS NOT NULL
            ),
            completed_orders = (
                SELECT count(DISTINCT mall_order_id)
                FROM trip_stops
                WHERE trip_id = $1
                  AND mall_order_id IS NOT NULL
                  AND stop_type = 'delivery'
                  AND status = 'completed'
            ),
            updated_at = now()
        WHERE id = $1
        "#,
    )
    .bind(trip_id)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

async fn fetch_trip_detail(pool: &sqlx::PgPool, id: &str) -> ApiResult<Value> {
    let trip = sqlx::query_scalar::<_, Value>(
        r#"
        SELECT row_to_json(trip_detail)
        FROM (
            SELECT t.*,
                COALESCE(t.vehicle_code, v.vehicle_code) as vehicle_code,
                COALESCE(t.license_plate, v.license_plate) as license_plate,
                COALESCE(t.vehicle_type, v.vehicle_type) as vehicle_type,
                v.load_capacity, v.volume,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'id', s.id,
                            'stopType', s.stop_type,
                            'stopSequence', s.stop_sequence,
                            'address', s.address,
                            'latitude', s.latitude,
                            'longitude', s.longitude,
                            'contactName', s.contact_name,
                            'contactPhone', s.contact_phone,
                            'cargoInfo', s.cargo_info,
                            'status', s.status,
                            'mallOrderId', s.mall_order_id,
                            'deliveryTimeSlot', (SELECT delivery_time_slot FROM mall_orders WHERE id = s.mall_order_id),
                            'deliveryDate', (SELECT delivery_date::text FROM mall_orders WHERE id = s.mall_order_id),
                            'arrivedAt', s.arrived_at,
                            'completedAt', s.completed_at,
                            'notes', s.notes,
                            'orderItems', (
                                SELECT COALESCE(json_agg(
                                    json_build_object(
                                        'productName', oi.product_name,
                                        'quantity', oi.quantity,
                                        'imageUrl', oi.image_url
                                    )
                                ), '[]')
                                FROM mall_order_items oi
                                WHERE oi.order_id = s.mall_order_id
                            )
                        ) ORDER BY s.stop_sequence
                    ) FILTER (WHERE s.id IS NOT NULL),
                    '[]'
                ) as stops
            FROM vehicle_trips t
            LEFT JOIN vehicles v ON v.id = t.vehicle_id
            LEFT JOIN trip_stops s ON s.trip_id = t.id
            WHERE t.id = $1
            GROUP BY t.id, v.vehicle_code, v.license_plate, v.vehicle_type, v.load_capacity, v.volume
        ) trip_detail
        "#,
    )
    .bind(id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| ApiError::NotFound("行程不存在".to_string()))?;

    Ok(trip)
}

// ==================== 调度运营报表 ====================

/// 调度概览 - 今日关键指标
async fn dispatch_overview<S>(
    State(state): State<AppState<S>>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let overview = sqlx::query_scalar::<_, Value>(
        r#"
        SELECT json_build_object(
            'todayTrips', (SELECT count(*) FROM vehicle_trips WHERE date(created_at) = current_date),
            'activeTrips', (SELECT count(*) FROM vehicle_trips WHERE status IN ('locked', 'in_progress')),
            'todayOrders', (SELECT count(*) FROM mall_orders WHERE date(created_at) = current_date),
            'pendingOrders', (SELECT count(*) FROM mall_orders WHERE trip_id IS NULL AND status IN ('paid', 'ready_for_pickup', 'dispatching')),
            'availableVehicles', (SELECT count(*) FROM vehicles WHERE status = 'active' AND trip_status = 'idle'),
            'todayCompletedOrders', (SELECT count(*) FROM mall_orders WHERE date(completed_at) = current_date),
            'todayCancelledTrips', (SELECT count(*) FROM vehicle_trips WHERE date(cancelled_at) = current_date)
        )
        "#,
    )
    .fetch_one(&state.db)
    .await
    .map_err(|err| ApiError::BadRequest(format!("查询调度概览失败: {err}")))?;

    Ok(ok("查询成功", overview))
}

/// 车辆利用率统计
async fn dispatch_vehicle_utilization<S>(
    State(state): State<AppState<S>>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let stats = sqlx::query_scalar::<_, Value>(
        r#"
        SELECT json_build_object(
            'totalVehicles', (SELECT count(*) FROM vehicles WHERE status = 'active'),
            'idleVehicles', (SELECT count(*) FROM vehicles WHERE status = 'active' AND trip_status = 'idle'),
            'inTransitVehicles', (SELECT count(*) FROM vehicles WHERE status = 'active' AND trip_status = 'in_transit'),
            'utilizationRate', (
                SELECT CASE WHEN count(*) = 0 THEN 0
                    ELSE round(100.0 * count(*) FILTER (WHERE trip_status = 'in_transit') / count(*), 2)
                END
                FROM vehicles WHERE status = 'active'
            ),
            'vehicleDetails', (
                SELECT COALESCE(json_agg(json_build_object(
                    'vehicleCode', v.vehicle_code,
                    'licensePlate', v.license_plate,
                    'tripStatus', v.trip_status,
                    'todayTrips', (SELECT count(*) FROM vehicle_trips WHERE vehicle_id = v.id AND date(created_at) = current_date),
                    'todayOrders', (
                        SELECT count(DISTINCT ts.mall_order_id)
                        FROM vehicle_trips vt
                        JOIN trip_stops ts ON ts.trip_id = vt.id
                        WHERE vt.vehicle_id = v.id AND date(vt.created_at) = current_date
                    )
                )), '[]')
                FROM vehicles v
                WHERE v.status = 'active'
                ORDER BY v.vehicle_code
            )
        )
        "#,
    )
    .fetch_one(&state.db)
    .await
    .map_err(|err| ApiError::BadRequest(format!("查询车辆利用率失败: {err}")))?;

    Ok(ok("查询成功", stats))
}

/// 行程效率统计
async fn dispatch_trip_efficiency<S>(
    State(state): State<AppState<S>>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let stats = sqlx::query_scalar::<_, Value>(
        r#"
        SELECT json_build_object(
            'todayTrips', (SELECT count(*) FROM vehicle_trips WHERE date(created_at) = current_date),
            'completedTrips', (SELECT count(*) FROM vehicle_trips WHERE date(created_at) = current_date AND status = 'completed'),
            'cancelledTrips', (SELECT count(*) FROM vehicle_trips WHERE date(cancelled_at) = current_date),
            'inProgressTrips', (SELECT count(*) FROM vehicle_trips WHERE status IN ('locked', 'in_progress')),
            'completionRate', (
                SELECT CASE WHEN count(*) = 0 THEN 0
                    ELSE round(100.0 * count(*) FILTER (WHERE status = 'completed') / count(*), 2)
                END
                FROM vehicle_trips WHERE date(created_at) = current_date
            ),
            'avgOrdersPerTrip', (
                SELECT COALESCE(round(avg(total_orders)::numeric, 2), 0)
                FROM vehicle_trips WHERE date(created_at) = current_date AND status = 'completed'
            ),
            'tripDetails', (
                SELECT COALESCE(json_agg(json_build_object(
                    'tripId', t.id,
                    'vehicleCode', v.vehicle_code,
                    'status', t.status,
                    'totalOrders', t.total_orders,
                    'completedStops', (SELECT count(*) FROM trip_stops WHERE trip_id = t.id AND status = 'completed'),
                    'totalStops', (SELECT count(*) FROM trip_stops WHERE trip_id = t.id),
                    'createdAt', t.created_at,
                    'completedAt', t.completed_at
                )), '[]')
                FROM vehicle_trips t
                LEFT JOIN vehicles v ON v.id = t.vehicle_id
                WHERE date(t.created_at) = current_date
                ORDER BY t.created_at DESC
            )
        )
        "#,
    )
    .fetch_one(&state.db)
    .await
    .map_err(|err| ApiError::BadRequest(format!("查询行程效率失败: {err}")))?;

    Ok(ok("查询成功", stats))
}

/// 配送时效统计
async fn dispatch_delivery_performance<S>(
    State(state): State<AppState<S>>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let stats = sqlx::query_scalar::<_, Value>(
        r#"
        SELECT json_build_object(
            'todayDelivered', (SELECT count(*) FROM mall_orders WHERE date(completed_at) = current_date),
            'avgDeliveryTime', (
                SELECT COALESCE(round(avg(extract(epoch from (completed_at - created_at)) / 3600)::numeric, 2), 0)
                FROM mall_orders
                WHERE date(completed_at) = current_date
            ),
            'onTimeRate', (
                SELECT CASE WHEN count(*) = 0 THEN 0
                    ELSE round(100.0 * count(*) FILTER (
                        WHERE expected_delivery_window IS NULL
                        OR completed_at::time < (substring(expected_delivery_window from '(\d{2}:\d{2})-\d{2}:\d{2}') || ':00')::time
                    ) / count(*), 2)
                END
                FROM mall_orders
                WHERE date(completed_at) = current_date
            ),
            'timeSlotDistribution', (
                SELECT COALESCE(json_agg(json_build_object(
                    'timeSlot', delivery_time_slot,
                    'orderCount', count(*)
                )), '[]')
                FROM mall_orders
                WHERE date(created_at) = current_date AND delivery_time_slot IS NOT NULL
                GROUP BY delivery_time_slot
                ORDER BY delivery_time_slot
            ),
            'pendingOrders', (
                SELECT json_build_object(
                    'total', count(*),
                    'withTimeSlot', count(*) FILTER (WHERE delivery_time_slot IS NOT NULL),
                    'byTimeSlot', (
                        SELECT COALESCE(json_agg(json_build_object(
                            'timeSlot', delivery_time_slot,
                            'count', count(*)
                        )), '[]')
                        FROM mall_orders
                        WHERE trip_id IS NULL AND status IN ('paid', 'ready_for_pickup', 'dispatching') AND delivery_time_slot IS NOT NULL
                        GROUP BY delivery_time_slot
                        ORDER BY delivery_time_slot
                    )
                )
                FROM mall_orders
                WHERE trip_id IS NULL AND status IN ('paid', 'ready_for_pickup', 'dispatching')
            )
        )
        "#,
    )
    .fetch_one(&state.db)
    .await
    .map_err(|err| ApiError::BadRequest(format!("查询配送时效失败: {err}")))?;

    Ok(ok("查询成功", stats))
}

// ==================== 自动调度策略 ====================

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AutoAssignRequest {
    /// 要分配的订单ID列表（可选，不传则分配所有待分配订单）
    order_ids: Option<Vec<String>>,
    /// 每辆车每个时间段最大订单数（默认 1，即同一时段一辆车只接一单）
    max_orders_per_slot: Option<i32>,
    /// 是否只预览不执行（默认 false）
    dry_run: Option<bool>,
}

/// 自动调度 - 最少车辆策略
///
/// 目标：尽可能少用车，同时避免同一辆车在同一时段承载多个订单
///
/// 策略逻辑：
/// 1. 按时间段分组订单
/// 2. 对于每个时间段，优先分配给已使用的车辆（如果该车在该时段空闲）
/// 3. 如果所有已使用车辆在该时段都有订单，才启用新车辆
/// 4. 这样可以最大化车辆利用率，减少使用的车辆数量
async fn dispatch_auto_assign<S>(
    State(state): State<AppState<S>>,
    Json(body): Json<AutoAssignRequest>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    // 默认每车每时段 1 单，避免拥挤
    let max_per_slot = body.max_orders_per_slot.unwrap_or(1);
    let dry_run = body.dry_run.unwrap_or(false);

    // 1. 获取待分配订单（指定订单或全部）
    let pending_orders = if let Some(ref order_ids) = body.order_ids {
        if order_ids.is_empty() {
            return Ok(ok("未选择订单", json!({"assigned": 0, "details": []})));
        }
        sqlx::query_as::<_, (String, Option<String>)>(
            r#"
            SELECT id, delivery_time_slot
            FROM mall_orders
            WHERE id = ANY($1) AND trip_id IS NULL AND status IN ('paid', 'ready_for_pickup', 'dispatching')
            ORDER BY delivery_time_slot NULLS LAST, created_at ASC
            "#,
        )
        .bind(order_ids)
        .fetch_all(&state.db)
        .await
        .map_err(|err| ApiError::BadRequest(format!("查询指定订单失败: {err}")))?
    } else {
        sqlx::query_as::<_, (String, Option<String>)>(
            r#"
            SELECT id, delivery_time_slot
            FROM mall_orders
            WHERE trip_id IS NULL AND status IN ('paid', 'ready_for_pickup', 'dispatching')
            ORDER BY delivery_time_slot NULLS LAST, created_at ASC
            "#,
        )
        .fetch_all(&state.db)
        .await
        .map_err(|err| ApiError::BadRequest(format!("查询待分配订单失败: {err}")))?
    };

    if pending_orders.is_empty() {
        return Ok(ok(
            "没有待分配的订单",
            json!({"assigned": 0, "details": []}),
        ));
    }

    // 2. 获取可用车辆
    let available_vehicles = sqlx::query_as::<_, (String, Option<String>)>(
        r#"
        SELECT id, vehicle_code
        FROM vehicles
        WHERE status = 'active' AND trip_status = 'idle'
        ORDER BY vehicle_code
        "#,
    )
    .fetch_all(&state.db)
    .await
    .map_err(|err| ApiError::BadRequest(format!("查询可用车辆失败: {err}")))?;

    if available_vehicles.is_empty() {
        return Ok(ok("没有可用车辆", json!({"assigned": 0, "details": []})));
    }

    // 3. 获取每辆车今天各时间段的订单数（包括已分配和待分配的）
    let vehicle_loads = sqlx::query_as::<_, (String, Option<String>, i64)>(
        r#"
        SELECT v.id as vehicle_id, o.delivery_time_slot, count(*) as order_count
        FROM vehicles v
        LEFT JOIN vehicle_trips t ON t.vehicle_id = v.id AND date(t.created_at) = current_date AND t.status != 'cancelled'
        LEFT JOIN trip_stops ts ON ts.trip_id = t.id
        LEFT JOIN mall_orders o ON o.id = ts.mall_order_id
        WHERE v.status = 'active'
        GROUP BY v.id, o.delivery_time_slot
        "#,
    )
    .fetch_all(&state.db)
    .await
    .map_err(|err| ApiError::BadRequest(format!("查询车辆负载失败: {err}")))?;

    // 构建车辆负载映射: (vehicle_id, time_slot) -> count
    let mut load_map: std::collections::HashMap<(String, Option<String>), i64> =
        std::collections::HashMap::new();
    for (vid, slot, count) in vehicle_loads {
        load_map.insert((vid, slot), count);
    }

    // 4. 按时间段分组订单
    let mut orders_by_slot: std::collections::HashMap<
        Option<String>,
        Vec<(String, Option<String>)>,
    > = std::collections::HashMap::new();
    for (order_id, time_slot) in pending_orders {
        orders_by_slot
            .entry(time_slot.clone())
            .or_default()
            .push((order_id, time_slot));
    }

    // 5. 分配订单 - 最少车辆策略
    // 跟踪已使用的车辆集合
    let mut used_vehicles: std::collections::HashSet<String> = std::collections::HashSet::new();
    let mut planned_assignments: Vec<(String, String, String, Option<String>)> = Vec::new();

    // 按时间段排序处理（有时间的优先，无时间的放最后）
    let mut slots: Vec<_> = orders_by_slot.iter().collect();
    slots.sort_by(|a, b| match (a.0, b.0) {
        (Some(a), Some(b)) => a.cmp(b),
        (Some(_), None) => std::cmp::Ordering::Less,
        (None, Some(_)) => std::cmp::Ordering::Greater,
        (None, None) => std::cmp::Ordering::Equal,
    });

    for (time_slot, orders) in slots {
        for (order_id, _) in orders {
            // 策略：优先使用已使用的车辆（如果在该时段空闲）
            let best_vehicle = if !used_vehicles.is_empty() {
                // 先尝试从已使用的车辆中找
                used_vehicles
                    .iter()
                    .filter_map(|vid| {
                        available_vehicles
                            .iter()
                            .find(|(id, _)| id == vid)
                            .and_then(|(id, code)| {
                                let current_load = load_map
                                    .get(&(id.clone(), time_slot.clone()))
                                    .copied()
                                    .unwrap_or(0);
                                if current_load < max_per_slot as i64 {
                                    Some((id.clone(), code.clone().unwrap_or_default(), current_load))
                                } else {
                                    None
                                }
                            })
                    })
                    .min_by_key(|(_, _, load)| *load)
                    .map(|(id, code, _)| (id, code))
            } else {
                None
            };

            // 如果已使用的车辆都在该时段有订单，则启用新车辆
            let best_vehicle = best_vehicle.or_else(|| {
                available_vehicles
                    .iter()
                    .filter(|(vid, _)| {
                        let current_load = load_map
                            .get(&(vid.clone(), time_slot.clone()))
                            .copied()
                            .unwrap_or(0);
                        current_load < max_per_slot as i64
                    })
                    .min_by_key(|(vid, _)| {
                        // 选择总体负载最少的车辆
                        load_map
                            .get(&(vid.clone(), time_slot.clone()))
                            .copied()
                            .unwrap_or(0)
                    })
                    .map(|(id, code)| (id.clone(), code.clone().unwrap_or_default()))
            });

            if let Some((vehicle_id, vehicle_code)) = best_vehicle {
                // 更新负载映射
                let key = (vehicle_id.clone(), time_slot.clone());
                *load_map.entry(key).or_insert(0) += 1;
                used_vehicles.insert(vehicle_id.clone());

                planned_assignments.push((
                    order_id.clone(),
                    vehicle_id,
                    vehicle_code,
                    time_slot.clone(),
                ));
            }
        }
    }

    let mut assignments: Vec<Value> = Vec::new();
    if dry_run {
        // 统计使用的车辆数
        let vehicle_count = planned_assignments
            .iter()
            .map(|(_, vid, _, _)| vid)
            .collect::<std::collections::HashSet<_>>()
            .len();
        assignments = planned_assignments
            .into_iter()
            .map(|(order_id, vehicle_id, vehicle_code, time_slot)| {
                json!({
                    "orderId": order_id,
                    "vehicleId": vehicle_id,
                    "vehicleCode": vehicle_code,
                    "timeSlot": time_slot
                })
            })
            .collect();
        return Ok(ok(
            "预览完成",
            json!({
                "assigned": assignments.len(),
                "vehiclesUsed": vehicle_count,
                "maxOrdersPerSlot": max_per_slot,
                "dryRun": true,
                "details": assignments
            }),
        ));
    }

    // 6. 执行分配
    let mut tx = state.db.begin().await?;
    let mut trip_ids = std::collections::HashMap::<String, String>::new();

    for (order_id, vehicle_id, vehicle_code, time_slot) in planned_assignments {
        let trip_id = if let Some(trip_id) = trip_ids.get(&vehicle_id) {
            trip_id.clone()
        } else {
            let trip_id: String = sqlx::query_scalar(
                r#"
                INSERT INTO vehicle_trips (vehicle_id, vehicle_code, status)
                VALUES ($1, $2, 'planned')
                RETURNING id
                "#,
            )
            .bind(&vehicle_id)
            .bind(&vehicle_code)
            .fetch_one(&mut *tx)
            .await
            .map_err(|err| ApiError::BadRequest(format!("创建行程失败: {err}")))?;
            trip_ids.insert(vehicle_id.clone(), trip_id.clone());
            trip_id
        };

        let order: Option<Value> = sqlx::query_scalar(
            r#"
            UPDATE mall_orders
            SET trip_id = $1,
                status = 'dispatching',
                dispatched_at = COALESCE(dispatched_at, now()),
                updated_at = now()
            WHERE id = $2
              AND trip_id IS NULL
              AND status IN ('paid', 'ready_for_pickup', 'dispatching')
            RETURNING jsonb_build_object(
                'address', address_text, 'latitude', latitude, 'longitude', longitude,
                'contactName', recipient_name, 'contactPhone', recipient_phone
            )
            "#,
        )
        .bind(&trip_id)
        .bind(&order_id)
        .fetch_optional(&mut *tx)
        .await?;

        let Some(order) = order else { continue };
        let sequence: i32 = sqlx::query_scalar(
            "SELECT COALESCE(MAX(stop_sequence), 0) + 1 FROM trip_stops WHERE trip_id = $1",
        )
        .bind(&trip_id)
        .fetch_one(&mut *tx)
        .await?;
        sqlx::query(
            r#"
            INSERT INTO trip_stops (
                trip_id, mall_order_id, stop_type, stop_sequence, address, latitude,
                longitude, contact_name, contact_phone, cargo_info, status
            )
            VALUES ($1, $2, 'delivery', $3, $4, $5, $6, $7, $8, $2, 'pending')
            "#,
        )
        .bind(&trip_id)
        .bind(&order_id)
        .bind(sequence)
        .bind(order.get("address").and_then(Value::as_str))
        .bind(order.get("latitude").and_then(Value::as_f64))
        .bind(order.get("longitude").and_then(Value::as_f64))
        .bind(order.get("contactName").and_then(Value::as_str))
        .bind(order.get("contactPhone").and_then(Value::as_str))
        .execute(&mut *tx)
        .await?;

        assignments.push(json!({
            "orderId": order_id,
            "vehicleId": vehicle_id,
            "vehicleCode": vehicle_code,
            "tripId": trip_id,
            "timeSlot": time_slot
        }));
    }

    for trip_id in trip_ids.values() {
        sync_trip_counts(&mut tx, trip_id).await?;
    }
    // 清理空行程
    sqlx::query(
        "DELETE FROM vehicle_trips WHERE id = ANY($1) AND NOT EXISTS (SELECT 1 FROM trip_stops WHERE trip_id = vehicle_trips.id)",
    )
    .bind(trip_ids.values().cloned().collect::<Vec<_>>())
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;

    let vehicle_count = trip_ids.len();
    let assigned_count = assignments.len();
    Ok(ok(
        "分配完成",
        json!({
            "assigned": assigned_count,
            "vehiclesUsed": vehicle_count,
            "maxOrdersPerSlot": max_per_slot,
            "dryRun": false,
            "details": assignments
        }),
    ))
}
