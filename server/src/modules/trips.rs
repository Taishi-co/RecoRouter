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
        .route(
            "/api/trips/undispatched-orders",
            get(undispatched_orders::<S>),
        )
        .route(
            "/api/trips/available-vehicles",
            get(available_vehicles::<S>),
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
                                'completedAt', s.completed_at
                            ) ORDER BY s.stop_sequence
                        ) FILTER (WHERE s.id IS NOT NULL),
                        '[]'
                    ) as stops
                FROM vehicle_trips t
                LEFT JOIN vehicles v ON v.id = t.vehicle_id
                LEFT JOIN trip_stops s ON s.trip_id = t.id
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

    // Unlink mall orders from this trip
    sqlx::query("UPDATE mall_orders SET trip_id = NULL WHERE trip_id = $1")
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
    Path((_trip_id, stop_id)): Path<(String, String)>,
    Json(body): Json<UpdateStopRequest>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
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
        WHERE id = $1
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
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| ApiError::NotFound("站点不存在".to_string()))?;

    Ok(ok("更新成功", stop))
}

async fn remove_stop<S>(
    State(state): State<AppState<S>>,
    Path((_trip_id, stop_id)): Path<(String, String)>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let mall_order_id: Option<String> =
        sqlx::query_scalar("SELECT mall_order_id FROM trip_stops WHERE id = $1")
            .bind(&stop_id)
            .fetch_optional(&state.db)
            .await?
            .flatten();

    if let Some(order_id) = &mall_order_id {
        sqlx::query("UPDATE mall_orders SET trip_id = NULL, status = 'dispatching' WHERE id = $1")
            .bind(order_id)
            .execute(&state.db)
            .await?;
    }

    sqlx::query("DELETE FROM trip_stops WHERE id = $1")
        .bind(&stop_id)
        .execute(&state.db)
        .await?;

    Ok(ok("删除成功", json!({ "id": stop_id })))
}

async fn complete_stop<S>(
    State(state): State<AppState<S>>,
    Path((trip_id, stop_id)): Path<(String, String)>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let stop = sqlx::query_scalar::<_, Value>(
        r#"
        UPDATE trip_stops
        SET status = 'completed', completed_at = now()
        WHERE id = $1
        RETURNING row_to_json(trip_stops)
        "#,
    )
    .bind(&stop_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| ApiError::NotFound("站点不存在".to_string()))?;

    // Update completed_orders count on trip
    sqlx::query(
        "UPDATE vehicle_trips SET completed_orders = (SELECT count(*) FROM trip_stops WHERE trip_id = $1 AND stop_type = 'delivery' AND status = 'completed'), updated_at = now() WHERE id = $1",
    )
    .bind(&trip_id)
    .execute(&state.db)
    .await?;

    // If this stop has a mall_order_id and it's a delivery stop, mark the order as completed
    let mall_order_id: Option<String> =
        sqlx::query_scalar("SELECT mall_order_id FROM trip_stops WHERE id = $1")
            .bind(&stop_id)
            .fetch_optional(&state.db)
            .await?
            .flatten();

    if let Some(order_id) = &mall_order_id {
        let _ = sqlx::query(
            "UPDATE mall_orders SET status = 'completed', completed_at = now(), updated_at = now() WHERE id = $1",
        )
        .bind(order_id)
        .execute(&state.db)
        .await;
    }

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
                            'productName', oi.product_name,
                            'quantity', oi.quantity,
                            'lineTotalCents', oi.line_total_cents,
                            'imageUrl', oi.image_url
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

    // Get current max stop sequence
    let max_seq: Option<i32> = sqlx::query_scalar(
        "SELECT COALESCE(MAX(stop_sequence), 0) FROM trip_stops WHERE trip_id = $1",
    )
    .bind(&trip_id)
    .fetch_one(&mut *tx)
    .await?;

    for (idx, order_id) in body.order_ids.iter().enumerate() {
        // Verify order exists and is assignable
        let order: Option<Value> = sqlx::query_scalar(
            r#"
            SELECT jsonb_build_object('id', id, 'status', status, 'tripId', trip_id,
                'addressText', address_text, 'latitude', latitude, 'longitude', longitude,
                'recipientName', recipient_name, 'recipientPhone', recipient_phone)
            FROM mall_orders
            WHERE id = $1 AND status IN ('paid', 'ready_for_pickup', 'dispatching')
            "#,
        )
        .bind(order_id)
        .fetch_optional(&mut *tx)
        .await?;

        let Some(order) = order else { continue };

        // Skip if already assigned to a trip
        if order.get("tripId").and_then(Value::as_str).is_some() {
            continue;
        }

        let seq = max_seq.unwrap_or(0) + (idx as i32 * 2) + 1;

        // Create delivery stop for this order
        sqlx::query(
            r#"
            INSERT INTO trip_stops (trip_id, mall_order_id, stop_type, stop_sequence,
                address, latitude, longitude, contact_name, contact_phone, cargo_info, status)
            VALUES ($1, $2, 'delivery', $3, $4, $5, $6, $7, $8, $9, 'pending')
            "#,
        )
        .bind(&trip_id)
        .bind(order_id)
        .bind(seq + 1)
        .bind(order.get("addressText").and_then(Value::as_str))
        .bind(order.get("latitude").and_then(|v| v.as_f64()))
        .bind(order.get("longitude").and_then(|v| v.as_f64()))
        .bind(order.get("recipientName").and_then(Value::as_str))
        .bind(order.get("recipientPhone").and_then(Value::as_str))
        .bind(order.get("id").and_then(Value::as_str))
        .execute(&mut *tx)
        .await?;

        // Link order to trip
        sqlx::query("UPDATE mall_orders SET trip_id = $1, status = 'dispatching', dispatched_at = COALESCE(dispatched_at, now()), updated_at = now() WHERE id = $2")
            .bind(&trip_id)
            .bind(order_id)
            .execute(&mut *tx)
            .await?;

        added_count += 1;
    }

    // Update total_orders count
    sqlx::query(
        "UPDATE vehicle_trips SET total_orders = (SELECT count(DISTINCT mall_order_id) FROM trip_stops WHERE trip_id = $1 AND mall_order_id IS NOT NULL), updated_at = now() WHERE id = $1",
    )
    .bind(&trip_id)
    .execute(&mut *tx)
    .await?;

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
    // Remove stops for this order
    sqlx::query("DELETE FROM trip_stops WHERE trip_id = $1 AND mall_order_id = $2")
        .bind(&trip_id)
        .bind(&order_id)
        .execute(&state.db)
        .await?;

    // Unlink order from trip
    sqlx::query("UPDATE mall_orders SET trip_id = NULL, status = 'dispatching', updated_at = now() WHERE id = $1 AND trip_id = $2")
        .bind(&order_id)
        .bind(&trip_id)
        .execute(&state.db)
        .await?;

    // Update total_orders count
    sqlx::query(
        "UPDATE vehicle_trips SET total_orders = (SELECT count(DISTINCT mall_order_id) FROM trip_stops WHERE trip_id = $1 AND mall_order_id IS NOT NULL), updated_at = now() WHERE id = $1",
    )
    .bind(&trip_id)
    .execute(&state.db)
    .await?;

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
    let mut tx = state.db.begin().await?;
    for (idx, stop_id) in body.stop_ids.iter().enumerate() {
        sqlx::query("UPDATE trip_stops SET stop_sequence = $1 WHERE id = $2 AND trip_id = $3")
            .bind((idx + 1) as i32)
            .bind(stop_id)
            .bind(&trip_id)
            .execute(&mut *tx)
            .await?;
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

    let trip: Value = sqlx::query_scalar(
        r#"
        INSERT INTO vehicle_trips (vehicle_id, vehicle_code, license_plate, vehicle_type, driver_id, planned_departure_time, notes, status, created_by)
        VALUES ($1, $2, $3, $4, $5, $6::timestamptz, $7, 'planned', $8)
        RETURNING row_to_json(vehicle_trips)
        "#,
    )
    .bind(&body.vehicle_id)
    .bind(&vehicle_code)
    .bind(&license_plate)
    .bind(&vehicle_type)
    .bind(&body.driver_id)
    .bind(body.planned_departure_time.as_deref())
    .bind(&body.notes)
    .bind(&body.driver_id)
    .fetch_one(pool)
    .await
    .map_err(|err| ApiError::BadRequest(format!("创建行程失败: {err}")))?;

    // If order_ids provided, assign them
    if let Some(order_ids) = &body.order_ids {
        if !order_ids.is_empty() {
            let trip_id = trip.get("id").and_then(Value::as_str).unwrap_or("");
            let mut seq: i32 = 0;
            for order_id in order_ids {
                let order: Option<Value> = sqlx::query_scalar(
                    r#"
                    SELECT jsonb_build_object('id', id, 'status', status, 'tripId', trip_id,
                        'addressText', address_text, 'latitude', latitude, 'longitude', longitude,
                        'recipientName', recipient_name, 'recipientPhone', recipient_phone)
                    FROM mall_orders
                    WHERE id = $1 AND status IN ('paid', 'ready_for_pickup', 'dispatching') AND trip_id IS NULL
                    "#,
                )
                .bind(order_id)
                .fetch_optional(pool)
                .await?;

                let Some(order) = order else { continue };

                seq += 1;
                sqlx::query(
                    r#"
                    INSERT INTO trip_stops (trip_id, mall_order_id, stop_type, stop_sequence,
                        address, latitude, longitude, contact_name, contact_phone, cargo_info, status)
                    VALUES ($1, $2, 'delivery', $3, $4, $5, $6, $7, $8, $9, 'pending')
                    "#,
                )
                .bind(trip_id)
                .bind(order_id)
                .bind(seq)
                .bind(order.get("addressText").and_then(Value::as_str))
                .bind(order.get("latitude").and_then(|v| v.as_f64()))
                .bind(order.get("longitude").and_then(|v| v.as_f64()))
                .bind(order.get("recipientName").and_then(Value::as_str))
                .bind(order.get("recipientPhone").and_then(Value::as_str))
                .bind(order.get("id").and_then(Value::as_str))
                .execute(pool)
                .await?;

                sqlx::query("UPDATE mall_orders SET trip_id = $1, status = 'dispatching', dispatched_at = COALESCE(dispatched_at, now()), updated_at = now() WHERE id = $2")
                    .bind(trip_id)
                    .bind(order_id)
                    .execute(pool)
                    .await?;
            }

            sqlx::query(
                "UPDATE vehicle_trips SET total_orders = (SELECT count(DISTINCT mall_order_id) FROM trip_stops WHERE trip_id = $1 AND mall_order_id IS NOT NULL) WHERE id = $1",
            )
            .bind(trip_id)
            .execute(pool)
            .await?;
        }
    }

    let trip_id = trip.get("id").and_then(Value::as_str).unwrap_or("");
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

    sqlx::query("UPDATE vehicle_trips SET status = 'completed', completed_time = now(), updated_at = now() WHERE id = $1")
        .bind(id)
        .execute(&mut *tx)
        .await?;

    // Complete all pending stops
    sqlx::query("UPDATE trip_stops SET status = 'completed', completed_at = now() WHERE trip_id = $1 AND status != 'completed'")
        .bind(id)
        .execute(&mut *tx)
        .await?;

    // Complete all mall orders in this trip
    sqlx::query("UPDATE mall_orders SET status = 'completed', completed_at = now(), updated_at = now() WHERE trip_id = $1 AND status != 'completed'")
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
    let status: Option<String> = sqlx::query_scalar(
        "SELECT status FROM vehicle_trips WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(pool)
    .await?
    .flatten();

    let status = status.ok_or_else(|| ApiError::NotFound("行程不存在".to_string()))?;
    if status == "completed" || status == "cancelled" {
        return Err(ApiError::BadRequest("已完成或已取消的行程无法取消".to_string()));
    }

    let vehicle_id: Option<String> = sqlx::query_scalar(
        "SELECT vehicle_id FROM vehicle_trips WHERE id = $1",
    )
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
        "UPDATE mall_orders SET trip_id = NULL, status = 'dispatching', updated_at = now() WHERE trip_id = $1",
    )
    .bind(id)
    .execute(&mut *tx)
    .await?;

    sqlx::query("DELETE FROM trip_stops WHERE trip_id = $1")
        .bind(id)
        .execute(&mut *tx)
        .await?;

    if let Some(vid) = vehicle_id {
        let _ = sqlx::query("UPDATE vehicles SET trip_status = 'idle', updated_at = now() WHERE id = $1")
            .bind(&vid)
            .execute(&mut *tx)
            .await;
    }

    tx.commit().await?;

    let trip = sqlx::query_scalar::<_, Value>("SELECT row_to_json(vehicle_trips) FROM vehicle_trips WHERE id = $1")
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
    let stop_type = body.stop_type.as_deref().unwrap_or("delivery");
    let sequence = body.stop_sequence.unwrap_or_else(|| {
        // Default to end of list
        999
    });

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
    .fetch_one(pool)
    .await
    .map_err(|err| ApiError::BadRequest(format!("添加站点失败: {err}")))?;

    // If linked to a mall order, update it
    if let Some(order_id) = &body.mall_order_id {
        sqlx::query("UPDATE mall_orders SET trip_id = $1, status = 'dispatching', dispatched_at = COALESCE(dispatched_at, now()), updated_at = now() WHERE id = $2")
            .bind(trip_id)
            .bind(order_id)
            .execute(pool)
            .await?;
    }

    // Update total_orders
    sqlx::query(
        "UPDATE vehicle_trips SET total_orders = (SELECT count(DISTINCT mall_order_id) FROM trip_stops WHERE trip_id = $1 AND mall_order_id IS NOT NULL), updated_at = now() WHERE id = $1",
    )
    .bind(trip_id)
    .execute(pool)
    .await?;

    Ok(ok("站点已添加", stop))
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
