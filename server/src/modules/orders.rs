use axum::{
    extract::{Path, Query, State},
    routing::{get, post, put},
    Json, Router,
};
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::{FromRow, PgPool, Postgres, QueryBuilder};

use crate::{
    app::AppState,
    error::{ApiError, ApiResult},
    response::{ok, ApiEnvelope},
    storage::Storage,
};

pub fn router<S>() -> Router<AppState<S>>
where
    S: Storage,
{
    Router::new()
        .route("/api/orders", post(create_order::<S>).get(list_orders::<S>))
        .route(
            "/api/orders/owner-revenue/:owner_id",
            get(owner_revenue::<S>),
        )
        .route(
            "/api/orders/commission-summary",
            get(commission_summary::<S>),
        )
        .route(
            "/api/orders/commission-pending",
            get(commission_pending::<S>),
        )
        .route("/api/orders/:id", get(get_order::<S>))
        .route("/api/orders/:id/cancel", post(cancel_order::<S>))
        .route(
            "/api/orders/:id/owner-cancel",
            post(owner_cancel_order::<S>),
        )
        .route(
            "/api/orders/:id/start-transport",
            post(start_transport::<S>),
        )
        .route("/api/orders/:id/complete", put(complete_order::<S>))
        .route("/api/orders/:id/confirm-fare", post(confirm_fare::<S>))
        .route("/api/orders/:id/payment-marked", put(mark_payment::<S>))
        .route("/api/orders/:id/payment-confirm", put(confirm_payment::<S>))
        .route("/api/orders/:id/payment-info", get(payment_info::<S>))
        .route(
            "/api/orders/:id/commission-payment-marked",
            put(mark_commission_payment::<S>),
        )
        .route("/api/orders/:id/commission-info", get(commission_info::<S>))
        .route(
            "/api/orders/:id/commission-confirm",
            put(confirm_commission::<S>),
        )
}

#[derive(Debug, Deserialize)]
struct CreateOrderRequest {
    demand_id: String,
    vehicle_id: String,
    owner_id: String,
}

#[derive(Debug, Deserialize)]
struct OrderQuery {
    owner_id: Option<String>,
    merchant_id: Option<String>,
    status: Option<String>,
}

#[derive(Debug, Deserialize)]
struct MerchantCancelRequest {
    reason: Option<String>,
    merchant_id: Option<String>,
}

#[derive(Debug, Deserialize)]
struct OwnerCancelRequest {
    reason: Option<String>,
    owner_id: Option<String>,
}

#[derive(Debug, Deserialize, Default)]
struct CompleteRequest {
    pickup_photo_key: Option<String>,
    delivery_photo_key: Option<String>,
}

#[derive(Debug, Deserialize, Default)]
struct CommissionPaymentRequest {
    payment_proof: Option<String>,
}

#[derive(Debug, FromRow)]
struct DemandRow {
    id: String,
    merchant_id: Option<String>,
    enterprise_id: Option<String>,
    enterprise_demand_id: Option<String>,
    demand_source: Option<String>,
    cargo_name: Option<String>,
    status: Option<String>,
}

#[derive(Debug, FromRow)]
struct VehicleRow {
    owner_id: Option<String>,
    current_renter_id: Option<String>,
    status: Option<String>,
}

#[derive(Debug, FromRow)]
struct ActiveRentalRow {
    renter_id: Option<String>,
    rent_end_date: Option<String>,
}

#[derive(Debug, FromRow)]
struct OrderRow {
    id: String,
    demand_id: Option<String>,
    vehicle_id: Option<String>,
    merchant_id: Option<String>,
    enterprise_id: Option<String>,
    order_source: Option<String>,
    owner_id: Option<String>,
    status: Option<String>,
    remarks: Option<String>,
    fare_price: Option<f64>,
    commission_amount: Option<f64>,
    payment_status: Option<String>,
    commission_payment_status: Option<String>,
    merchant_confirmed: Option<bool>,
}

#[derive(Debug, FromRow)]
struct PaymentInfoRow {
    order_id: String,
    fare_price: Option<f64>,
    commission_amount: Option<f64>,
    payment_status: Option<String>,
    status: Option<String>,
    owner_name: Option<String>,
    owner_phone: Option<String>,
    owner_payment_qr: Option<String>,
    pickup_address: Option<String>,
    delivery_address: Option<String>,
    cargo_name: Option<String>,
}

#[derive(Debug, FromRow)]
struct CommissionInfoRow {
    order_id: String,
    fare_price: Option<f64>,
    commission_amount: Option<f64>,
    commission_payment_status: Option<String>,
    status: Option<String>,
}

#[derive(Debug, FromRow)]
struct RevenueRow {
    id: String,
    cargo_name: Option<String>,
    fare_price: Option<f64>,
    commission_amount: Option<f64>,
    payment_status: Option<String>,
    commission_payment_status: Option<String>,
    actual_complete_time: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, FromRow)]
struct CommissionOrderRow {
    id: String,
    status: Option<String>,
    cargo_name: Option<String>,
    fare_price: Option<f64>,
    commission_amount: Option<f64>,
    payment_status: Option<String>,
    commission_payment_status: Option<String>,
    commission_payment_time: Option<chrono::DateTime<chrono::Utc>>,
    actual_complete_time: Option<chrono::DateTime<chrono::Utc>>,
    owner_name: Option<String>,
}

async fn create_order<S>(
    State(state): State<AppState<S>>,
    Json(body): Json<CreateOrderRequest>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let demand = fetch_demand(&state.db, &body.demand_id).await?;
    if demand.status.as_deref() != Some("pending") {
        return Err(ApiError::BadRequest("该需求已被接单或取消".to_string()));
    }

    let vehicle = fetch_vehicle(&state.db, &body.vehicle_id).await?;
    if vehicle.status.as_deref() != Some("active") {
        return Err(ApiError::BadRequest("车辆不可用".to_string()));
    }
    validate_vehicle_rental_permission(&state.db, &body.owner_id, &body.vehicle_id, &vehicle)
        .await?;

    let order_source = demand.demand_source.as_deref().unwrap_or("merchant");
    let requester_id = resolve_demand_requester_id(
        &state.db,
        order_source,
        demand.merchant_id.as_deref(),
        demand.enterprise_id.as_deref(),
    )
    .await?;

    let order = sqlx::query_scalar::<_, Value>(
        r#"
        INSERT INTO orders (
            demand_id, vehicle_id, merchant_id, enterprise_id, enterprise_demand_id,
            order_source, owner_id, status, accept_time
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'accepted', now())
        RETURNING row_to_json(orders)
        "#,
    )
    .bind(&body.demand_id)
    .bind(&body.vehicle_id)
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
    .fetch_one(&state.db)
    .await
    .map_err(|err| ApiError::BadRequest(format!("创建订单失败: {err}")))?;

    sqlx::query("UPDATE demands SET status = 'accepted' WHERE id = $1")
        .bind(&demand.id)
        .execute(&state.db)
        .await?;

    let order_id = order.get("id").and_then(Value::as_str);
    create_notification(
        &state.db,
        requester_id.as_deref(),
        "order_accepted",
        "您的需求已被接单",
        &format!(
            "您发布的\"{}\"需求已被接单，请关注订单状态",
            demand.cargo_name.as_deref().unwrap_or("")
        ),
        order_id,
        Some(&demand.id),
    )
    .await;

    Ok(ok("接单成功", order))
}

async fn list_orders<S>(
    State(state): State<AppState<S>>,
    Query(query): Query<OrderQuery>,
) -> ApiResult<Json<ApiEnvelope<Vec<Value>>>>
where
    S: Storage,
{
    let mut builder = QueryBuilder::<Postgres>::new(
        r#"
        SELECT order_payload
        FROM (
            SELECT
                to_jsonb(o) || jsonb_build_object(
                    'demand', CASE
                        WHEN d.id IS NULL THEN NULL
                        ELSE to_jsonb(d)
                    END,
                    'vehicle', CASE
                        WHEN v.id IS NULL THEN NULL
                        ELSE to_jsonb(v) || jsonb_build_object(
                            'brand', COALESCE(v.vehicle_type, ''),
                            'model', COALESCE(v.vehicle_code, v.vehicle_type, ''),
                            'plate_number', v.license_plate
                        )
                    END,
                    'owner', CASE
                        WHEN owner_user.id IS NULL THEN NULL
                        ELSE jsonb_build_object(
                            'id', owner_user.id,
                            'name', owner_user.name,
                            'phone', owner_user.phone
                        )
                    END,
                    'merchant', CASE
                        WHEN merchant_user.id IS NULL THEN NULL
                        ELSE jsonb_build_object(
                            'id', merchant_user.id,
                            'name', merchant_user.name,
                            'phone', merchant_user.phone
                        )
                    END,
                    'cancellation_status', latest_cancel.status
                ) AS order_payload
            FROM orders o
            LEFT JOIN demands d ON d.id = o.demand_id
            LEFT JOIN vehicles v ON v.id = o.vehicle_id
            LEFT JOIN users owner_user ON owner_user.id = o.owner_id
            LEFT JOIN users merchant_user ON merchant_user.id = o.merchant_id
            LEFT JOIN LATERAL (
                SELECT cr.status
                FROM cancellation_requests cr
                WHERE cr.order_id = o.id
                ORDER BY cr.created_at DESC
                LIMIT 1
            ) latest_cancel ON true
        "#,
    );
    let mut has_where = false;
    if let Some(owner_id) = non_empty(query.owner_id) {
        push_where(&mut builder, &mut has_where);
        builder.push("o.owner_id = ");
        builder.push_bind(owner_id);
    }
    if let Some(merchant_id) = non_empty(query.merchant_id) {
        push_where(&mut builder, &mut has_where);
        builder.push("o.merchant_id = ");
        builder.push_bind(merchant_id);
    }
    if let Some(status) = non_empty(query.status) {
        push_where(&mut builder, &mut has_where);
        builder.push("o.status = ");
        builder.push_bind(status);
    }
    builder.push(" ORDER BY o.created_at DESC, o.id DESC) order_row");

    let orders = builder
        .build_query_scalar::<Value>()
        .fetch_all(&state.db)
        .await
        .map_err(|err| ApiError::BadRequest(format!("查询失败: {err}")))?;

    Ok(ok("查询成功", orders))
}

async fn get_order<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    Ok(ok("查询成功", fetch_order_value(&state.db, &id).await?))
}

async fn cancel_order<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
    Json(body): Json<MerchantCancelRequest>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let order = fetch_order(&state.db, &id).await?;
    validate_direct_cancel(&order, "运费已确认，不能直接取消，请联系车主协商取消")?;
    if body.merchant_id.as_deref() != order.merchant_id.as_deref() {
        return Err(ApiError::BadRequest("无权取消此订单".to_string()));
    }

    let updated = cancel_order_record(&state.db, &order, body.reason.as_deref()).await?;
    create_notification(
        &state.db,
        order.owner_id.as_deref(),
        "order_cancelled",
        "订单已被取消",
        &format!(
            "您接的订单\"{}\"已被需求方取消，取消原因：{}",
            order.remarks.as_deref().unwrap_or("订单"),
            body.reason.as_deref().unwrap_or("")
        ),
        Some(&order.id),
        order.demand_id.as_deref(),
    )
    .await;

    Ok(ok("订单已取消，需求已恢复待接单状态", updated))
}

async fn owner_cancel_order<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
    Json(body): Json<OwnerCancelRequest>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let order = fetch_order(&state.db, &id).await?;
    validate_direct_cancel(&order, "运费已确认，不能直接取消，请联系需求方协商取消")?;
    if body.owner_id.as_deref() != order.owner_id.as_deref() {
        return Err(ApiError::BadRequest("无权取消此订单".to_string()));
    }

    let updated = cancel_order_record(&state.db, &order, body.reason.as_deref()).await?;
    create_notification(
        &state.db,
        order.merchant_id.as_deref(),
        "order_cancelled",
        "订单已被车主取消",
        &format!(
            "您的订单\"{}\"已被车主取消，取消原因：{}",
            order.remarks.as_deref().unwrap_or("订单"),
            body.reason.as_deref().unwrap_or("")
        ),
        Some(&order.id),
        order.demand_id.as_deref(),
    )
    .await;

    Ok(ok("订单已取消，需求已恢复待接单状态", updated))
}

async fn start_transport<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let order = fetch_order(&state.db, &id).await?;
    if order.status.as_deref() != Some("accepted") {
        return Err(ApiError::BadRequest(
            "只有已接单的订单可以开始运输".to_string(),
        ));
    }
    if !order.merchant_confirmed.unwrap_or(false) {
        return Err(ApiError::BadRequest(
            "需求方尚未确认运费，无法开始运输".to_string(),
        ));
    }

    let updated = sqlx::query_scalar::<_, Value>(
        r#"
        UPDATE orders
        SET status = 'in_transit', pickup_time = now(), updated_at = now()
        WHERE id = $1
        RETURNING row_to_json(orders)
        "#,
    )
    .bind(&id)
    .fetch_one(&state.db)
    .await
    .map_err(|err| ApiError::BadRequest(format!("开始运输失败: {err}")))?;

    update_demand_status(&state.db, order.demand_id.as_deref(), "in_transit").await?;

    Ok(ok("已开始运输", updated))
}

async fn complete_order<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
    body: Option<Json<CompleteRequest>>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let body = body.map(|Json(body)| body).unwrap_or_default();
    let order = fetch_order(&state.db, &id).await?;
    if order.status.as_deref() != Some("in_transit") {
        return Err(ApiError::BadRequest("只有运输中的订单可以完成".to_string()));
    }

    let commission_rate: Option<f64> = sqlx::query_scalar(
        "SELECT commission_rate::float8 FROM platform_settings WHERE id = 'default'",
    )
    .fetch_optional(&state.db)
    .await?
    .flatten();
    let commission_amount =
        order.fare_price.unwrap_or(0.0) * commission_rate.unwrap_or(0.0) / 100.0;
    let commission_payment_status = if has_payable_commission(Some(commission_amount)) {
        "unpaid"
    } else {
        "not_required"
    };
    let pickup_photo_key = non_empty(body.pickup_photo_key);
    let delivery_photo_key = non_empty(body.delivery_photo_key);

    let updated = sqlx::query_scalar::<_, Value>(
        r#"
        UPDATE orders
        SET status = 'transport_completed',
            payment_status = 'unpaid',
            commission_payment_status = $5,
            commission_amount = $2::numeric,
            transport_completed_time = now(),
            complete_time = now(),
            pickup_photo_key = COALESCE($3, pickup_photo_key),
            delivery_photo_key = COALESCE($4, delivery_photo_key),
            updated_at = now()
        WHERE id = $1
        RETURNING row_to_json(orders)
        "#,
    )
    .bind(&id)
    .bind(commission_amount)
    .bind(pickup_photo_key)
    .bind(delivery_photo_key)
    .bind(commission_payment_status)
    .fetch_one(&state.db)
    .await
    .map_err(|err| ApiError::BadRequest(format!("完成运输失败: {err}")))?;

    update_demand_status(&state.db, order.demand_id.as_deref(), "transport_completed").await?;

    Ok(ok("运输已完成，等待需求方付款", updated))
}

async fn confirm_fare<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let order = fetch_order(&state.db, &id).await?;
    if order.status.as_deref() != Some("accepted") {
        return Err(ApiError::BadRequest(
            "只有已接单的订单可以确认运费".to_string(),
        ));
    }
    if order.merchant_confirmed.unwrap_or(false) {
        return Err(ApiError::BadRequest("订单已确认运费".to_string()));
    }

    let updated = sqlx::query_scalar::<_, Value>(
        r#"
        UPDATE orders
        SET merchant_confirmed = true, confirm_time = now(), updated_at = now()
        WHERE id = $1
        RETURNING row_to_json(orders)
        "#,
    )
    .bind(&id)
    .fetch_one(&state.db)
    .await
    .map_err(|err| ApiError::BadRequest(format!("确认运费失败: {err}")))?;

    create_notification(
        &state.db,
        order.owner_id.as_deref(),
        "fare_confirmed",
        "运费已确认",
        &format!(
            "需求方已确认运费¥{:.2}，请开始运输",
            order.fare_price.unwrap_or(0.0)
        ),
        Some(&order.id),
        order.demand_id.as_deref(),
    )
    .await;

    Ok(ok("运费已确认", updated))
}

async fn mark_payment<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let order = fetch_order(&state.db, &id).await?;
    if order.status.as_deref() != Some("transport_completed") {
        return Err(ApiError::BadRequest("订单状态不正确".to_string()));
    }
    if order.payment_status.as_deref() == Some("paid") {
        return Err(ApiError::BadRequest("已标记为已付款".to_string()));
    }

    let updated = sqlx::query_scalar::<_, Value>(
        r#"
        UPDATE orders
        SET payment_status = 'paid', payment_time = now(), updated_at = now()
        WHERE id = $1
        RETURNING row_to_json(orders)
        "#,
    )
    .bind(&id)
    .fetch_one(&state.db)
    .await
    .map_err(|err| ApiError::BadRequest(format!("标记付款失败: {err}")))?;

    Ok(ok("已标记为已付款，等待运力方确认", updated))
}

async fn confirm_payment<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let order = fetch_order(&state.db, &id).await?;
    if order.status.as_deref() != Some("transport_completed") {
        return Err(ApiError::BadRequest("订单状态不正确".to_string()));
    }
    if order.payment_status.as_deref() != Some("paid") {
        return Err(ApiError::BadRequest("需求方尚未付款".to_string()));
    }

    if !has_payable_commission(order.commission_amount) {
        let updated = sqlx::query_scalar::<_, Value>(
            r#"
            UPDATE orders
            SET status = 'completed',
                commission_amount = COALESCE(commission_amount, 0),
                commission_payment_status = 'not_required',
                payment_confirm_time = now(),
                actual_complete_time = now(),
                updated_at = now()
            WHERE id = $1
            RETURNING row_to_json(orders)
            "#,
        )
        .bind(&id)
        .fetch_one(&state.db)
        .await
        .map_err(|err| ApiError::BadRequest(format!("确认收款失败: {err}")))?;

        finalize_completed_order(
            &state.db,
            &order,
            "order_completed",
            "订单已完成",
            "需求方付款已确认，订单已完成，车辆已恢复空闲状态。信用积分 +2",
        )
        .await?;

        return Ok(ok("收款已确认，订单已完成", updated));
    }

    let updated = sqlx::query_scalar::<_, Value>(
        r#"
        UPDATE orders
        SET status = 'payment_confirmed', payment_confirm_time = now(), updated_at = now()
        WHERE id = $1
        RETURNING row_to_json(orders)
        "#,
    )
    .bind(&id)
    .fetch_one(&state.db)
    .await
    .map_err(|err| ApiError::BadRequest(format!("确认收款失败: {err}")))?;

    update_demand_status(&state.db, order.demand_id.as_deref(), "payment_confirmed").await?;
    create_notification(
        &state.db,
        order.merchant_id.as_deref(),
        "payment_received",
        "车主已确认收款",
        &format!(
            "车主已确认收到运费¥{:.2}，订单运输已完成",
            order.fare_price.unwrap_or(0.0)
        ),
        Some(&order.id),
        order.demand_id.as_deref(),
    )
    .await;

    Ok(ok("收款已确认，请向平台支付撮合佣金", updated))
}

async fn payment_info<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let row = sqlx::query_as::<_, PaymentInfoRow>(
        r#"
        SELECT
            o.id AS order_id,
            o.fare_price::float8 AS fare_price,
            o.commission_amount::float8 AS commission_amount,
            o.payment_status,
            o.status,
            owner.name AS owner_name,
            owner.phone AS owner_phone,
            owner.wechat_payment_qr AS owner_payment_qr,
            d.pickup_address,
            d.delivery_address,
            d.cargo_name
        FROM orders o
        LEFT JOIN users owner ON owner.id = o.owner_id
        LEFT JOIN demands d ON d.id = o.demand_id
        WHERE o.id = $1
        "#,
    )
    .bind(&id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| ApiError::NotFound("订单不存在".to_string()))?;

    let payment_qr =
        public_url_with_expiry_or_none(&state.storage, row.owner_payment_qr.as_deref()).await;

    Ok(ok(
        "查询成功",
        json!({
            "orderId": row.order_id,
            "farePrice": row.fare_price,
            "commissionAmount": row.commission_amount,
            "ownerName": row.owner_name,
            "ownerPhone": row.owner_phone,
            "paymentQr": payment_qr,
            "paymentStatus": row.payment_status,
            "status": row.status,
            "pickupAddress": row.pickup_address,
            "deliveryAddress": row.delivery_address,
            "cargoName": row.cargo_name
        }),
    ))
}

async fn mark_commission_payment<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
    body: Option<Json<CommissionPaymentRequest>>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let body = body.map(|Json(body)| body).unwrap_or_default();
    let _payment_proof = body.payment_proof;
    let order = fetch_order(&state.db, &id).await?;
    if order.status.as_deref() != Some("payment_confirmed") {
        return Err(ApiError::BadRequest("请先确认收款".to_string()));
    }
    if !has_payable_commission(order.commission_amount) {
        return Err(ApiError::BadRequest("该订单无需支付佣金".to_string()));
    }
    if order.commission_payment_status.as_deref() == Some("paid") {
        return Err(ApiError::BadRequest("已标记为已支付佣金".to_string()));
    }

    let updated = sqlx::query_scalar::<_, Value>(
        r#"
        UPDATE orders
        SET commission_payment_status = 'paid',
            commission_payment_time = now(),
            status = 'commission_pending',
            updated_at = now()
        WHERE id = $1
        RETURNING row_to_json(orders)
        "#,
    )
    .bind(&id)
    .fetch_one(&state.db)
    .await
    .map_err(|err| ApiError::BadRequest(format!("标记支付佣金失败: {err}")))?;

    Ok(ok("已提交佣金支付，等待平台审核", updated))
}

async fn commission_info<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let row = sqlx::query_as::<_, CommissionInfoRow>(
        r#"
        SELECT
            id AS order_id,
            fare_price::float8 AS fare_price,
            commission_amount::float8 AS commission_amount,
            commission_payment_status,
            status
        FROM orders
        WHERE id = $1
        "#,
    )
    .bind(&id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| ApiError::NotFound("订单不存在".to_string()))?;

    let platform_key: Option<String> = sqlx::query_scalar(
        "SELECT commission_payment_qr FROM platform_settings WHERE id = 'default'",
    )
    .fetch_optional(&state.db)
    .await?
    .flatten();
    let platform_payment_qr =
        public_url_with_expiry_or_none(&state.storage, platform_key.as_deref()).await;

    Ok(ok(
        "查询成功",
        json!({
            "orderId": row.order_id,
            "farePrice": row.fare_price,
            "commissionAmount": row.commission_amount,
            "platformPaymentQr": platform_payment_qr,
            "commissionPaymentStatus": row.commission_payment_status,
            "status": row.status
        }),
    ))
}

async fn confirm_commission<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let order = fetch_order(&state.db, &id).await?;
    if order.status.as_deref() != Some("commission_pending") {
        return Err(ApiError::BadRequest("订单状态不正确".to_string()));
    }
    if order.commission_payment_status.as_deref() != Some("paid") {
        return Err(ApiError::BadRequest("运力方尚未支付佣金".to_string()));
    }

    let updated = sqlx::query_scalar::<_, Value>(
        r#"
        UPDATE orders
        SET status = 'completed',
            commission_confirm_time = now(),
            actual_complete_time = now(),
            updated_at = now()
        WHERE id = $1
        RETURNING row_to_json(orders)
        "#,
    )
    .bind(&id)
    .fetch_one(&state.db)
    .await
    .map_err(|err| ApiError::BadRequest(format!("确认佣金失败: {err}")))?;

    finalize_completed_order(
        &state.db,
        &order,
        "commission_confirmed",
        "佣金已审核通过",
        &format!(
            "您支付的佣金¥{:.2}已审核通过，订单已完成，车辆已恢复空闲状态。信用积分 +2",
            order.commission_amount.unwrap_or(0.0)
        ),
    )
    .await?;

    Ok(ok("佣金已确认，订单完成", updated))
}

async fn owner_revenue<S>(
    State(state): State<AppState<S>>,
    Path(owner_id): Path<String>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let rows = sqlx::query_as::<_, RevenueRow>(
        r#"
        SELECT
            o.id,
            d.cargo_name,
            o.fare_price::float8 AS fare_price,
            o.commission_amount::float8 AS commission_amount,
            o.payment_status,
            o.commission_payment_status,
            o.actual_complete_time
        FROM orders o
        LEFT JOIN demands d ON d.id = o.demand_id
        WHERE o.owner_id = $1 AND o.status = 'completed'
        ORDER BY o.actual_complete_time DESC NULLS LAST
        "#,
    )
    .bind(&owner_id)
    .fetch_all(&state.db)
    .await
    .map_err(|err| ApiError::BadRequest(format!("查询订单失败: {err}")))?;

    let total_fare: f64 = rows
        .iter()
        .filter(|row| row.payment_status.as_deref() == Some("paid"))
        .map(|row| row.fare_price.unwrap_or(0.0))
        .sum();
    let total_commission: f64 = rows
        .iter()
        .filter(|row| row.commission_payment_status.as_deref() == Some("paid"))
        .map(|row| row.commission_amount.unwrap_or(0.0))
        .sum();
    let revenue_list: Vec<Value> = rows
        .iter()
        .map(|row| {
            let has_received_fare = row.payment_status.as_deref() == Some("paid");
            let has_paid_commission = row.commission_payment_status.as_deref() == Some("paid");
            let fare = row.fare_price.unwrap_or(0.0);
            let commission = row.commission_amount.unwrap_or(0.0);
            json!({
                "id": row.id,
                "cargoName": row.cargo_name.clone().unwrap_or_default(),
                "farePrice": row.fare_price,
                "commissionAmount": row.commission_amount,
                "receivedFare": if has_received_fare { fare } else { 0.0 },
                "paidCommission": if has_paid_commission { commission } else { 0.0 },
                "netIncome": if has_received_fare { fare - if has_paid_commission { commission } else { 0.0 } } else { 0.0 },
                "completedTime": row.actual_complete_time,
                "paymentStatus": row.payment_status,
                "commissionPaymentStatus": row.commission_payment_status
            })
        })
        .collect();

    Ok(ok(
        "查询成功",
        json!({
            "summary": {
                "totalFare": total_fare,
                "totalCommission": total_commission,
                "netRevenue": total_fare - total_commission,
                "totalOrders": rows.len(),
                "paidOrders": rows.iter().filter(|row| row.payment_status.as_deref() == Some("paid")).count(),
                "pendingPaymentOrders": rows.iter().filter(|row| row.payment_status.as_deref() == Some("unpaid")).count()
            },
            "revenueList": revenue_list
        }),
    ))
}

async fn commission_summary<S>(
    State(state): State<AppState<S>>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let rows = fetch_commission_rows(&state.db, None).await?;
    let mut total_commission = 0.0;
    let mut confirmed_commission = 0.0;
    let mut pending_commission = 0.0;
    let commission_orders: Vec<Value> = rows
        .iter()
        .map(|row| {
            if row.commission_payment_status.as_deref() == Some("paid")
                && row.status.as_deref() == Some("completed")
            {
                let amount = row.commission_amount.unwrap_or(0.0);
                confirmed_commission += amount;
                total_commission += amount;
            } else if row.commission_payment_status.as_deref() == Some("paid")
                && row.status.as_deref() == Some("commission_pending")
            {
                let amount = row.commission_amount.unwrap_or(0.0);
                pending_commission += amount;
                total_commission += amount;
            }

            json!({
                "id": row.id,
                "cargoName": row.cargo_name.clone().unwrap_or_default(),
                "farePrice": row.fare_price,
                "commissionAmount": row.commission_amount,
                "commissionStatus": row.commission_payment_status,
                "fareStatus": row.payment_status,
                "completedTime": row.actual_complete_time,
                "paymentTime": row.commission_payment_time,
                "ownerName": row.owner_name.clone().unwrap_or_else(|| "未知".to_string()),
                "status": row.status
            })
        })
        .collect();

    Ok(ok(
        "查询成功",
        json!({
            "summary": {
                "totalCommission": total_commission,
                "confirmedCommission": confirmed_commission,
                "pendingCommission": pending_commission,
                "totalOrders": rows.len()
            },
            "commissionOrders": commission_orders
        }),
    ))
}

async fn commission_pending<S>(
    State(state): State<AppState<S>>,
) -> ApiResult<Json<ApiEnvelope<Vec<Value>>>>
where
    S: Storage,
{
    let rows = fetch_commission_rows(&state.db, Some("commission_pending")).await?;
    let pending_orders = rows
        .into_iter()
        .map(|row| {
            json!({
                "id": row.id,
                "cargoName": row.cargo_name.unwrap_or_else(|| "未知货物".to_string()),
                "farePrice": row.fare_price,
                "commissionAmount": row.commission_amount,
                "commissionStatus": row.commission_payment_status,
                "paymentTime": row.commission_payment_time,
                "ownerName": row.owner_name.unwrap_or_else(|| "未知车主".to_string())
            })
        })
        .collect();

    Ok(ok("查询成功", pending_orders))
}

async fn fetch_demand(pool: &PgPool, demand_id: &str) -> ApiResult<DemandRow> {
    sqlx::query_as::<_, DemandRow>(
        r#"
        SELECT id, merchant_id, enterprise_id, enterprise_demand_id, demand_source, cargo_name, status
        FROM demands
        WHERE id = $1
        "#,
    )
    .bind(demand_id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| ApiError::NotFound("需求不存在".to_string()))
}

async fn resolve_demand_requester_id(
    pool: &PgPool,
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

async fn resolve_order_requester_id(pool: &PgPool, order: &OrderRow) -> ApiResult<Option<String>> {
    let source = order.order_source.as_deref().unwrap_or("merchant");
    resolve_demand_requester_id(
        pool,
        source,
        order.merchant_id.as_deref(),
        order.enterprise_id.as_deref(),
    )
    .await
}

async fn fetch_vehicle(pool: &PgPool, vehicle_id: &str) -> ApiResult<VehicleRow> {
    sqlx::query_as::<_, VehicleRow>(
        "SELECT owner_id, current_renter_id, status FROM vehicles WHERE id = $1",
    )
    .bind(vehicle_id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| ApiError::NotFound("车辆不存在".to_string()))
}

async fn fetch_order(pool: &PgPool, id: &str) -> ApiResult<OrderRow> {
    sqlx::query_as::<_, OrderRow>(
        r#"
        SELECT
            id,
            demand_id,
            vehicle_id,
            merchant_id,
            enterprise_id,
            order_source,
            owner_id,
            status,
            remarks,
            fare_price::float8 AS fare_price,
            commission_amount::float8 AS commission_amount,
            payment_status,
            commission_payment_status,
            merchant_confirmed
        FROM orders
        WHERE id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| ApiError::NotFound("订单不存在".to_string()))
}

async fn fetch_order_value(pool: &PgPool, id: &str) -> ApiResult<Value> {
    sqlx::query_scalar::<_, Value>("SELECT row_to_json(orders) FROM orders WHERE id = $1")
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::NotFound("订单不存在".to_string()))
}

async fn validate_vehicle_rental_permission(
    pool: &PgPool,
    owner_id: &str,
    vehicle_id: &str,
    vehicle: &VehicleRow,
) -> ApiResult<()> {
    if vehicle.current_renter_id.is_none() {
        return Ok(());
    }

    let active_rental = sqlx::query_as::<_, ActiveRentalRow>(
        r#"
        SELECT renter_id, rent_end_date::text AS rent_end_date
        FROM vehicle_rentals
        WHERE vehicle_id = $1 AND status = 'active'
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
    Ok(())
}

fn validate_direct_cancel(order: &OrderRow, confirmed_message: &str) -> ApiResult<()> {
    if order.status.as_deref() != Some("accepted") {
        return Err(ApiError::BadRequest("只有已接单的订单可以取消".to_string()));
    }
    if order.merchant_confirmed.unwrap_or(false) {
        return Err(ApiError::BadRequest(confirmed_message.to_string()));
    }
    Ok(())
}

async fn cancel_order_record(
    pool: &PgPool,
    order: &OrderRow,
    reason: Option<&str>,
) -> ApiResult<Value> {
    let updated = sqlx::query_scalar::<_, Value>(
        r#"
        UPDATE orders
        SET status = 'cancelled',
            cancel_reason = $2,
            cancel_time = now(),
            updated_at = now()
        WHERE id = $1
        RETURNING row_to_json(orders)
        "#,
    )
    .bind(&order.id)
    .bind(reason)
    .fetch_one(pool)
    .await
    .map_err(|err| ApiError::BadRequest(format!("取消订单失败: {err}")))?;

    if let Some(demand_id) = order.demand_id.as_deref() {
        sqlx::query("UPDATE demands SET status = 'pending', owner_id = null, updated_at = now() WHERE id = $1")
            .bind(demand_id)
            .execute(pool)
            .await?;
    }
    if let Some(vehicle_id) = order.vehicle_id.as_deref() {
        sqlx::query("UPDATE vehicles SET trip_status = 'idle', updated_at = now() WHERE id = $1")
            .bind(vehicle_id)
            .execute(pool)
            .await?;
    }

    Ok(updated)
}

async fn update_demand_status(
    pool: &PgPool,
    demand_id: Option<&str>,
    status: &str,
) -> ApiResult<()> {
    if let Some(demand_id) = demand_id {
        sqlx::query("UPDATE demands SET status = $2, updated_at = now() WHERE id = $1")
            .bind(demand_id)
            .bind(status)
            .execute(pool)
            .await?;
    }
    Ok(())
}

async fn increment_credit_score(pool: &PgPool, user_id: Option<&str>) -> ApiResult<()> {
    if let Some(user_id) = user_id {
        sqlx::query(
            "UPDATE users SET credit_score = COALESCE(credit_score, 100) + 2, updated_at = now() WHERE id = $1",
        )
        .bind(user_id)
        .execute(pool)
        .await?;
    }
    Ok(())
}

async fn finalize_completed_order(
    pool: &PgPool,
    order: &OrderRow,
    owner_notification_type: &str,
    owner_notification_title: &str,
    owner_notification_content: &str,
) -> ApiResult<()> {
    update_demand_status(pool, order.demand_id.as_deref(), "completed").await?;
    if let Some(vehicle_id) = order.vehicle_id.as_deref() {
        sqlx::query("UPDATE vehicles SET trip_status = 'idle', updated_at = now() WHERE id = $1")
            .bind(vehicle_id)
            .execute(pool)
            .await?;
    }

    increment_credit_score(pool, order.owner_id.as_deref()).await?;
    let requester_id = resolve_order_requester_id(pool, order).await?;
    increment_credit_score(pool, requester_id.as_deref()).await?;

    create_notification(
        pool,
        order.owner_id.as_deref(),
        owner_notification_type,
        owner_notification_title,
        owner_notification_content,
        Some(&order.id),
        order.demand_id.as_deref(),
    )
    .await;
    create_notification(
        pool,
        requester_id.as_deref(),
        "order_completed",
        "订单已完成",
        "您的订单已完成，感谢使用本平台。信用积分 +2",
        Some(&order.id),
        order.demand_id.as_deref(),
    )
    .await;

    Ok(())
}

async fn create_notification(
    pool: &PgPool,
    user_id: Option<&str>,
    notification_type: &str,
    title: &str,
    content: &str,
    related_order_id: Option<&str>,
    related_demand_id: Option<&str>,
) {
    let Some(user_id) = user_id else {
        return;
    };
    let _ = sqlx::query(
        r#"
        INSERT INTO notifications (
            user_id, type, title, content, related_order_id, related_demand_id, is_read
        )
        VALUES ($1, $2, $3, $4, $5, $6, false)
        "#,
    )
    .bind(user_id)
    .bind(notification_type)
    .bind(title)
    .bind(content)
    .bind(related_order_id)
    .bind(related_demand_id)
    .execute(pool)
    .await;
}

async fn public_url_with_expiry_or_none<S>(storage: &S, key: Option<&str>) -> Option<String>
where
    S: Storage,
{
    let key = key.map(str::trim).filter(|key| !key.is_empty())?;
    match storage.public_url_with_expiry(key, 86_400).await {
        Ok(url) => Some(url),
        Err(err) => {
            tracing::warn!(error = ?err, key, "order qr url generation failed");
            None
        }
    }
}

async fn fetch_commission_rows(
    pool: &PgPool,
    status_filter: Option<&str>,
) -> ApiResult<Vec<CommissionOrderRow>> {
    let mut builder = QueryBuilder::<Postgres>::new(
        r#"
        SELECT
            o.id,
            o.status,
            d.cargo_name,
            o.fare_price::float8 AS fare_price,
            o.commission_amount::float8 AS commission_amount,
            o.payment_status,
            o.commission_payment_status,
            o.commission_payment_time,
            o.actual_complete_time,
            owner.name AS owner_name
        FROM orders o
        LEFT JOIN demands d ON d.id = o.demand_id
        LEFT JOIN users owner ON owner.id = o.owner_id
        "#,
    );
    match status_filter {
        Some(status) => {
            builder.push(" WHERE o.status = ");
            builder.push_bind(status);
            builder.push(" AND COALESCE(o.commission_amount, 0) > 0");
            builder.push(" ORDER BY o.commission_payment_time DESC NULLS FIRST");
        }
        None => {
            builder.push(" WHERE o.status IN ('completed', 'commission_pending')");
            builder.push(" AND COALESCE(o.commission_amount, 0) > 0");
            builder.push(" ORDER BY o.actual_complete_time DESC NULLS LAST");
        }
    }

    builder
        .build_query_as::<CommissionOrderRow>()
        .fetch_all(pool)
        .await
        .map_err(|err| ApiError::BadRequest(format!("查询订单失败: {err}")))
}

fn push_where(builder: &mut QueryBuilder<Postgres>, has_where: &mut bool) {
    if *has_where {
        builder.push(" AND ");
    } else {
        builder.push(" WHERE ");
        *has_where = true;
    }
}

fn non_empty(value: Option<String>) -> Option<String> {
    value
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn has_payable_commission(amount: Option<f64>) -> bool {
    amount.unwrap_or(0.0) > 0.0
}

#[cfg(test)]
mod tests {
    use super::has_payable_commission;

    #[test]
    fn payable_commission_requires_a_positive_amount() {
        assert!(!has_payable_commission(None));
        assert!(!has_payable_commission(Some(0.0)));
        assert!(!has_payable_commission(Some(-1.0)));
        assert!(has_payable_commission(Some(0.01)));
    }
}
