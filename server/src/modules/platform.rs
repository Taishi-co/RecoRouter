use axum::{
    extract::{Path, Query, State},
    routing::get,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::{Postgres, QueryBuilder};

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
            "/api/platform/settings",
            get(get_settings::<S>).put(update_settings::<S>),
        )
        .route("/api/platform/payment-qr", get(get_payment_qr::<S>))
        .route(
            "/api/platform/app-configs",
            get(list_app_configs::<S>).post(create_app_config::<S>),
        )
        .route(
            "/api/platform/payment-orders",
            get(list_payment_orders::<S>).post(create_payment_order::<S>),
        )
        .route(
            "/api/platform/refund-orders",
            get(list_refund_orders::<S>).post(create_refund_order::<S>),
        )
        .route(
            "/api/platform/transfer-orders",
            get(list_transfer_orders::<S>).post(create_transfer_order::<S>),
        )
        .route(
            "/api/platform/split-plans",
            get(list_split_plans::<S>).post(create_split_plan::<S>),
        )
        .route("/api/platform/split-plans/:id", get(get_split_plan::<S>))
        .route("/api/platform/audit-logs", get(list_audit_logs::<S>))
        .route(
            "/api/platform/event-deliveries",
            get(list_event_deliveries::<S>).post(create_event_delivery::<S>),
        )
        .route(
            "/api/platform/cos-uploads",
            get(list_cos_uploads::<S>).post(create_cos_upload::<S>),
        )
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PlatformListQuery {
    page: Option<i64>,
    page_size: Option<i64>,
    #[serde(alias = "business_type")]
    business_type: Option<String>,
    #[serde(alias = "business_id")]
    business_id: Option<String>,
    #[serde(alias = "service_name")]
    service_name: Option<String>,
    status: Option<String>,
}

#[derive(Debug, Deserialize)]
struct UpdateSettingsRequest {
    #[serde(rename = "commissionRate")]
    commission_rate: Option<f64>,
    #[serde(rename = "commissionPaymentQr")]
    commission_payment_qr: Option<String>,
}

#[derive(Debug, Serialize)]
struct PaymentQrResponse {
    #[serde(rename = "paymentQr")]
    payment_qr: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateAppConfigRequest {
    #[serde(alias = "service_name")]
    service_name: String,
    #[serde(alias = "app_type")]
    app_type: String,
    appid: String,
    #[serde(alias = "mch_id")]
    mch_id: Option<String>,
    #[serde(alias = "notify_url")]
    notify_url: Option<String>,
    status: Option<String>,
    metadata: Option<Value>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreatePaymentOrderRequest {
    #[serde(alias = "business_type")]
    business_type: String,
    #[serde(alias = "business_id")]
    business_id: String,
    appid: Option<String>,
    #[serde(alias = "payer_id")]
    payer_id: Option<String>,
    #[serde(alias = "payer_openid")]
    payer_openid: Option<String>,
    provider: Option<String>,
    #[serde(alias = "out_trade_no")]
    out_trade_no: Option<String>,
    #[serde(alias = "amount_cents")]
    amount_cents: i64,
    currency: Option<String>,
    #[serde(alias = "idempotency_key")]
    idempotency_key: Option<String>,
    metadata: Option<Value>,
    #[serde(alias = "actor_id")]
    actor_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateRefundOrderRequest {
    #[serde(alias = "business_type")]
    business_type: String,
    #[serde(alias = "business_id")]
    business_id: String,
    #[serde(alias = "payment_order_id")]
    payment_order_id: Option<String>,
    provider: Option<String>,
    #[serde(alias = "out_refund_no")]
    out_refund_no: Option<String>,
    #[serde(alias = "amount_cents")]
    amount_cents: i64,
    currency: Option<String>,
    reason: Option<String>,
    #[serde(alias = "requested_by")]
    requested_by: Option<String>,
    #[serde(alias = "idempotency_key")]
    idempotency_key: Option<String>,
    metadata: Option<Value>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateTransferOrderRequest {
    #[serde(alias = "business_type")]
    business_type: String,
    #[serde(alias = "business_id")]
    business_id: String,
    #[serde(alias = "receiver_id")]
    receiver_id: String,
    #[serde(alias = "receiver_name")]
    receiver_name: Option<String>,
    provider: Option<String>,
    #[serde(alias = "out_bill_no")]
    out_bill_no: Option<String>,
    #[serde(alias = "amount_cents")]
    amount_cents: i64,
    currency: Option<String>,
    reason: Option<String>,
    #[serde(alias = "requested_by")]
    requested_by: Option<String>,
    #[serde(alias = "idempotency_key")]
    idempotency_key: Option<String>,
    metadata: Option<Value>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateSplitPlanRequest {
    #[serde(alias = "business_type")]
    business_type: String,
    #[serde(alias = "business_id")]
    business_id: String,
    #[serde(alias = "payment_id")]
    payment_id: Option<String>,
    #[serde(alias = "plan_stage")]
    plan_stage: Option<String>,
    #[serde(alias = "total_amount_cents")]
    total_amount_cents: i64,
    #[serde(alias = "submitted_by")]
    submitted_by: Option<String>,
    metadata: Option<Value>,
    items: Vec<CreateSplitItemRequest>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateSplitItemRequest {
    #[serde(alias = "receiver_id")]
    receiver_id: String,
    #[serde(alias = "receiver_type")]
    receiver_type: Option<String>,
    #[serde(alias = "amount_cents")]
    amount_cents: i64,
    reason: String,
    metadata: Option<Value>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateEventDeliveryRequest {
    #[serde(alias = "event_type")]
    event_type: String,
    #[serde(alias = "business_type")]
    business_type: String,
    #[serde(alias = "business_id")]
    business_id: String,
    #[serde(alias = "platform_record_id")]
    platform_record_id: Option<String>,
    #[serde(alias = "target_service")]
    target_service: String,
    #[serde(alias = "callback_url")]
    callback_url: Option<String>,
    payload: Option<Value>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateCosUploadRequest {
    #[serde(alias = "service_name")]
    service_name: String,
    #[serde(alias = "business_type")]
    business_type: Option<String>,
    #[serde(alias = "business_id")]
    business_id: Option<String>,
    key: String,
    #[serde(alias = "original_file_name")]
    original_file_name: Option<String>,
    #[serde(alias = "content_type")]
    content_type: Option<String>,
    #[serde(alias = "size_bytes")]
    size_bytes: Option<i64>,
    #[serde(alias = "uploaded_by")]
    uploaded_by: Option<String>,
    metadata: Option<Value>,
}

async fn get_settings<S>(
    State(state): State<AppState<S>>,
) -> ApiResult<Json<ApiEnvelope<Option<Value>>>>
where
    S: Storage,
{
    let settings = sqlx::query_scalar::<_, Value>(
        r#"
        SELECT row_to_json(settings)
        FROM (
            SELECT id, commission_rate, commission_payment_qr, updated_at, created_at
            FROM platform_settings
            WHERE id = 'default'
        ) settings
        "#,
    )
    .fetch_optional(&state.db)
    .await?;

    Ok(ok("查询成功", settings))
}

async fn update_settings<S>(
    State(state): State<AppState<S>>,
    Json(body): Json<UpdateSettingsRequest>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let exists: bool =
        sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM platform_settings WHERE id = 'default')")
            .fetch_one(&state.db)
            .await?;

    if !exists {
        return Err(ApiError::NotFound("平台配置不存在".to_string()));
    }

    let settings = sqlx::query_scalar::<_, Value>(
        r#"
        UPDATE platform_settings
        SET commission_rate = COALESCE($1::numeric, commission_rate),
            commission_payment_qr = COALESCE($2, commission_payment_qr),
            updated_at = now()
        WHERE id = 'default'
        RETURNING row_to_json(platform_settings)
        "#,
    )
    .bind(body.commission_rate)
    .bind(body.commission_payment_qr)
    .fetch_one(&state.db)
    .await?;

    Ok(ok("更新成功", settings))
}

async fn get_payment_qr<S>(
    State(state): State<AppState<S>>,
) -> ApiResult<Json<ApiEnvelope<PaymentQrResponse>>>
where
    S: Storage,
{
    let key: Option<String> = sqlx::query_scalar(
        "SELECT commission_payment_qr FROM platform_settings WHERE id = 'default'",
    )
    .fetch_optional(&state.db)
    .await?
    .flatten();

    let key = key
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .ok_or_else(|| ApiError::NotFound("平台收款码未设置".to_string()))?;
    let payment_qr = state.storage.public_url(&key).await?;

    Ok(ok("查询成功", PaymentQrResponse { payment_qr }))
}

async fn list_app_configs<S>(
    State(state): State<AppState<S>>,
    Query(query): Query<PlatformListQuery>,
) -> ApiResult<Json<ApiEnvelope<Vec<Value>>>>
where
    S: Storage,
{
    list_records(
        &state.db,
        PlatformTable::AppConfigs,
        query,
        &[PlatformFilter::ServiceName, PlatformFilter::Status],
    )
    .await
}

async fn create_app_config<S>(
    State(state): State<AppState<S>>,
    Json(body): Json<CreateAppConfigRequest>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let service_name = require_non_empty(Some(body.service_name), "服务名不能为空")?;
    let app_type = require_non_empty(Some(body.app_type), "应用类型不能为空")?;
    let appid = require_non_empty(Some(body.appid), "appid不能为空")?;
    let metadata = body.metadata.unwrap_or_else(|| json!({}));
    let config = sqlx::query_scalar::<_, Value>(
        r#"
        INSERT INTO platform_app_configs (
            service_name, app_type, appid, mch_id, notify_url, status, metadata
        )
        VALUES ($1, $2, $3, $4, $5, COALESCE($6, 'active'), $7)
        ON CONFLICT (service_name, app_type, appid)
        DO UPDATE SET
            mch_id = EXCLUDED.mch_id,
            notify_url = EXCLUDED.notify_url,
            status = EXCLUDED.status,
            metadata = EXCLUDED.metadata,
            updated_at = now()
        RETURNING to_jsonb(platform_app_configs)
        "#,
    )
    .bind(&service_name)
    .bind(&app_type)
    .bind(&appid)
    .bind(trim_opt(body.mch_id))
    .bind(trim_opt(body.notify_url))
    .bind(trim_opt(body.status))
    .bind(metadata)
    .fetch_one(&state.db)
    .await?;

    insert_audit_log(
        &state.db,
        "platform-api",
        None,
        "app_config.upserted",
        "platform_app_config",
        config["id"].as_str(),
        None,
        None,
        json!({ "serviceName": service_name, "appType": app_type, "appid": appid }),
    )
    .await?;

    Ok(ok("保存成功", config))
}

async fn list_payment_orders<S>(
    State(state): State<AppState<S>>,
    Query(query): Query<PlatformListQuery>,
) -> ApiResult<Json<ApiEnvelope<Vec<Value>>>>
where
    S: Storage,
{
    list_records(
        &state.db,
        PlatformTable::PaymentOrders,
        query,
        &[
            PlatformFilter::BusinessType,
            PlatformFilter::BusinessId,
            PlatformFilter::Status,
        ],
    )
    .await
}

async fn create_payment_order<S>(
    State(state): State<AppState<S>>,
    Json(body): Json<CreatePaymentOrderRequest>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    validate_amount(body.amount_cents)?;
    let business_type = require_non_empty(Some(body.business_type), "业务类型不能为空")?;
    let business_id = require_non_empty(Some(body.business_id), "业务ID不能为空")?;
    let out_trade_no = optional_non_empty(body.out_trade_no)
        .unwrap_or_else(|| format!("pay_{}", uuid::Uuid::new_v4().simple()));
    let metadata = body.metadata.unwrap_or_else(|| json!({}));

    let order = sqlx::query_scalar::<_, Value>(
        r#"
        INSERT INTO platform_payment_orders (
            business_type, business_id, appid, payer_id, payer_openid, provider,
            out_trade_no, amount_cents, currency, idempotency_key, metadata
        )
        VALUES ($1, $2, $3, $4, $5, COALESCE($6, 'wechat'), $7, $8,
                COALESCE($9, 'CNY'), $10, $11)
        RETURNING to_jsonb(platform_payment_orders)
        "#,
    )
    .bind(&business_type)
    .bind(&business_id)
    .bind(trim_opt(body.appid))
    .bind(trim_opt(body.payer_id))
    .bind(trim_opt(body.payer_openid))
    .bind(trim_opt(body.provider))
    .bind(&out_trade_no)
    .bind(body.amount_cents)
    .bind(trim_opt(body.currency))
    .bind(trim_opt(body.idempotency_key))
    .bind(metadata)
    .fetch_one(&state.db)
    .await?;

    insert_audit_log(
        &state.db,
        "platform-api",
        trim_opt(body.actor_id).as_deref(),
        "payment_order.created",
        "platform_payment_order",
        order["id"].as_str(),
        Some(&business_type),
        Some(&business_id),
        json!({ "outTradeNo": out_trade_no, "amountCents": body.amount_cents }),
    )
    .await?;

    Ok(ok("创建成功", order))
}

async fn list_refund_orders<S>(
    State(state): State<AppState<S>>,
    Query(query): Query<PlatformListQuery>,
) -> ApiResult<Json<ApiEnvelope<Vec<Value>>>>
where
    S: Storage,
{
    list_records(
        &state.db,
        PlatformTable::RefundOrders,
        query,
        &[
            PlatformFilter::BusinessType,
            PlatformFilter::BusinessId,
            PlatformFilter::Status,
        ],
    )
    .await
}

async fn create_refund_order<S>(
    State(state): State<AppState<S>>,
    Json(body): Json<CreateRefundOrderRequest>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    validate_amount(body.amount_cents)?;
    let business_type = require_non_empty(Some(body.business_type), "业务类型不能为空")?;
    let business_id = require_non_empty(Some(body.business_id), "业务ID不能为空")?;
    let out_refund_no = optional_non_empty(body.out_refund_no)
        .unwrap_or_else(|| format!("refund_{}", uuid::Uuid::new_v4().simple()));
    let requested_by = trim_opt(body.requested_by);
    let metadata = body.metadata.unwrap_or_else(|| json!({}));

    let order = sqlx::query_scalar::<_, Value>(
        r#"
        INSERT INTO platform_refund_orders (
            business_type, business_id, payment_order_id, provider, out_refund_no,
            amount_cents, currency, reason, requested_by, idempotency_key, metadata
        )
        VALUES ($1, $2, $3, COALESCE($4, 'wechat'), $5, $6, COALESCE($7, 'CNY'),
                $8, $9, $10, $11)
        RETURNING to_jsonb(platform_refund_orders)
        "#,
    )
    .bind(&business_type)
    .bind(&business_id)
    .bind(trim_opt(body.payment_order_id))
    .bind(trim_opt(body.provider))
    .bind(&out_refund_no)
    .bind(body.amount_cents)
    .bind(trim_opt(body.currency))
    .bind(trim_opt(body.reason))
    .bind(&requested_by)
    .bind(trim_opt(body.idempotency_key))
    .bind(metadata)
    .fetch_one(&state.db)
    .await?;

    insert_audit_log(
        &state.db,
        "platform-api",
        requested_by.as_deref(),
        "refund_order.created",
        "platform_refund_order",
        order["id"].as_str(),
        Some(&business_type),
        Some(&business_id),
        json!({ "outRefundNo": out_refund_no, "amountCents": body.amount_cents }),
    )
    .await?;

    Ok(ok("创建成功", order))
}

async fn list_transfer_orders<S>(
    State(state): State<AppState<S>>,
    Query(query): Query<PlatformListQuery>,
) -> ApiResult<Json<ApiEnvelope<Vec<Value>>>>
where
    S: Storage,
{
    list_records(
        &state.db,
        PlatformTable::TransferOrders,
        query,
        &[
            PlatformFilter::BusinessType,
            PlatformFilter::BusinessId,
            PlatformFilter::Status,
        ],
    )
    .await
}

async fn create_transfer_order<S>(
    State(state): State<AppState<S>>,
    Json(body): Json<CreateTransferOrderRequest>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    validate_amount(body.amount_cents)?;
    let business_type = require_non_empty(Some(body.business_type), "业务类型不能为空")?;
    let business_id = require_non_empty(Some(body.business_id), "业务ID不能为空")?;
    let receiver_id = require_non_empty(Some(body.receiver_id), "收款方不能为空")?;
    let out_bill_no = optional_non_empty(body.out_bill_no)
        .unwrap_or_else(|| format!("transfer_{}", uuid::Uuid::new_v4().simple()));
    let requested_by = trim_opt(body.requested_by);
    let metadata = body.metadata.unwrap_or_else(|| json!({}));

    let order = sqlx::query_scalar::<_, Value>(
        r#"
        INSERT INTO platform_transfer_orders (
            business_type, business_id, receiver_id, receiver_name, provider,
            out_bill_no, amount_cents, currency, reason, requested_by,
            idempotency_key, metadata
        )
        VALUES ($1, $2, $3, $4, COALESCE($5, 'wechat'), $6, $7,
                COALESCE($8, 'CNY'), $9, $10, $11, $12)
        RETURNING to_jsonb(platform_transfer_orders)
        "#,
    )
    .bind(&business_type)
    .bind(&business_id)
    .bind(&receiver_id)
    .bind(trim_opt(body.receiver_name))
    .bind(trim_opt(body.provider))
    .bind(&out_bill_no)
    .bind(body.amount_cents)
    .bind(trim_opt(body.currency))
    .bind(trim_opt(body.reason))
    .bind(&requested_by)
    .bind(trim_opt(body.idempotency_key))
    .bind(metadata)
    .fetch_one(&state.db)
    .await?;

    insert_audit_log(
        &state.db,
        "platform-api",
        requested_by.as_deref(),
        "transfer_order.created",
        "platform_transfer_order",
        order["id"].as_str(),
        Some(&business_type),
        Some(&business_id),
        json!({ "outBillNo": out_bill_no, "amountCents": body.amount_cents, "receiverId": receiver_id }),
    )
    .await?;

    Ok(ok("创建成功", order))
}

async fn list_split_plans<S>(
    State(state): State<AppState<S>>,
    Query(query): Query<PlatformListQuery>,
) -> ApiResult<Json<ApiEnvelope<Vec<Value>>>>
where
    S: Storage,
{
    list_records(
        &state.db,
        PlatformTable::SplitPlans,
        query,
        &[
            PlatformFilter::BusinessType,
            PlatformFilter::BusinessId,
            PlatformFilter::Status,
        ],
    )
    .await
}

async fn get_split_plan<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let plan = sqlx::query_scalar::<_, Value>(
        r#"
        SELECT jsonb_build_object(
          'id', p.id,
          'businessType', p.business_type,
          'businessId', p.business_id,
          'paymentId', p.payment_id,
          'planStage', p.plan_stage,
          'totalAmountCents', p.total_amount_cents,
          'status', p.status,
          'submittedBy', p.submitted_by,
          'metadata', p.metadata,
          'createdAt', p.created_at,
          'updatedAt', p.updated_at,
          'executedAt', p.executed_at,
          'items', COALESCE((
            SELECT jsonb_agg(to_jsonb(i) ORDER BY i.created_at ASC)
            FROM platform_split_items i
            WHERE i.plan_id = p.id
          ), '[]'::jsonb)
        )
        FROM platform_split_plans p
        WHERE p.id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| ApiError::NotFound("分账计划不存在".to_string()))?;

    Ok(ok("查询成功", plan))
}

async fn create_split_plan<S>(
    State(state): State<AppState<S>>,
    Json(body): Json<CreateSplitPlanRequest>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    validate_amount(body.total_amount_cents)?;
    if body.items.is_empty() {
        return Err(ApiError::BadRequest("分账明细不能为空".to_string()));
    }
    let item_total = body.items.iter().try_fold(0_i64, |acc, item| {
        validate_amount(item.amount_cents)?;
        let receiver_id = item.receiver_id.trim();
        if receiver_id.is_empty() {
            return Err(ApiError::BadRequest("分账接收方不能为空".to_string()));
        }
        if item.reason.trim().is_empty() {
            return Err(ApiError::BadRequest("分账原因不能为空".to_string()));
        }
        Ok(acc + item.amount_cents)
    })?;
    if item_total > body.total_amount_cents {
        return Err(ApiError::BadRequest(
            "分账明细金额不能超过可分账金额".to_string(),
        ));
    }

    let business_type = require_non_empty(Some(body.business_type), "业务类型不能为空")?;
    let business_id = require_non_empty(Some(body.business_id), "业务ID不能为空")?;
    let plan_stage = optional_non_empty(body.plan_stage).unwrap_or_else(|| "default".to_string());
    let submitted_by = trim_opt(body.submitted_by);
    let metadata = body.metadata.unwrap_or_else(|| json!({}));
    let mut transaction = state.db.begin().await?;

    let plan_id: String = sqlx::query_scalar(
        r#"
        INSERT INTO platform_split_plans (
            business_type, business_id, payment_id, plan_stage,
            total_amount_cents, submitted_by, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
        "#,
    )
    .bind(&business_type)
    .bind(&business_id)
    .bind(trim_opt(body.payment_id))
    .bind(&plan_stage)
    .bind(body.total_amount_cents)
    .bind(&submitted_by)
    .bind(metadata)
    .fetch_one(&mut *transaction)
    .await?;

    for item in body.items {
        sqlx::query(
            r#"
            INSERT INTO platform_split_items (
                plan_id, receiver_id, receiver_type, amount_cents, reason, metadata
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            "#,
        )
        .bind(&plan_id)
        .bind(item.receiver_id.trim())
        .bind(trim_opt(item.receiver_type))
        .bind(item.amount_cents)
        .bind(item.reason.trim())
        .bind(item.metadata.unwrap_or_else(|| json!({})))
        .execute(&mut *transaction)
        .await?;
    }

    transaction.commit().await?;

    insert_audit_log(
        &state.db,
        "platform-api",
        submitted_by.as_deref(),
        "split_plan.created",
        "platform_split_plan",
        Some(&plan_id),
        Some(&business_type),
        Some(&business_id),
        json!({ "planStage": plan_stage, "totalAmountCents": body.total_amount_cents, "itemTotalAmountCents": item_total }),
    )
    .await?;

    let plan = get_split_plan_by_id(&state.db, &plan_id).await?;
    Ok(ok("创建成功", plan))
}

async fn list_audit_logs<S>(
    State(state): State<AppState<S>>,
    Query(query): Query<PlatformListQuery>,
) -> ApiResult<Json<ApiEnvelope<Vec<Value>>>>
where
    S: Storage,
{
    list_records(
        &state.db,
        PlatformTable::AuditLogs,
        query,
        &[
            PlatformFilter::ServiceName,
            PlatformFilter::BusinessType,
            PlatformFilter::BusinessId,
        ],
    )
    .await
}

async fn list_event_deliveries<S>(
    State(state): State<AppState<S>>,
    Query(query): Query<PlatformListQuery>,
) -> ApiResult<Json<ApiEnvelope<Vec<Value>>>>
where
    S: Storage,
{
    list_records(
        &state.db,
        PlatformTable::EventDeliveries,
        query,
        &[
            PlatformFilter::BusinessType,
            PlatformFilter::BusinessId,
            PlatformFilter::Status,
        ],
    )
    .await
}

async fn create_event_delivery<S>(
    State(state): State<AppState<S>>,
    Json(body): Json<CreateEventDeliveryRequest>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let event_type = require_non_empty(Some(body.event_type), "事件类型不能为空")?;
    let business_type = require_non_empty(Some(body.business_type), "业务类型不能为空")?;
    let business_id = require_non_empty(Some(body.business_id), "业务ID不能为空")?;
    let target_service = require_non_empty(Some(body.target_service), "目标服务不能为空")?;
    let payload = body.payload.unwrap_or_else(|| json!({}));

    let event = sqlx::query_scalar::<_, Value>(
        r#"
        INSERT INTO platform_event_deliveries (
            event_type, business_type, business_id, platform_record_id,
            target_service, callback_url, payload
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING to_jsonb(platform_event_deliveries)
        "#,
    )
    .bind(&event_type)
    .bind(&business_type)
    .bind(&business_id)
    .bind(trim_opt(body.platform_record_id))
    .bind(&target_service)
    .bind(trim_opt(body.callback_url))
    .bind(payload)
    .fetch_one(&state.db)
    .await?;

    insert_audit_log(
        &state.db,
        "platform-api",
        None,
        "event_delivery.created",
        "platform_event_delivery",
        event["id"].as_str(),
        Some(&business_type),
        Some(&business_id),
        json!({ "eventType": event_type, "targetService": target_service }),
    )
    .await?;

    Ok(ok("创建成功", event))
}

async fn list_cos_uploads<S>(
    State(state): State<AppState<S>>,
    Query(query): Query<PlatformListQuery>,
) -> ApiResult<Json<ApiEnvelope<Vec<Value>>>>
where
    S: Storage,
{
    list_records(
        &state.db,
        PlatformTable::CosUploads,
        query,
        &[
            PlatformFilter::ServiceName,
            PlatformFilter::BusinessType,
            PlatformFilter::BusinessId,
            PlatformFilter::Status,
        ],
    )
    .await
}

async fn create_cos_upload<S>(
    State(state): State<AppState<S>>,
    Json(body): Json<CreateCosUploadRequest>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let service_name = require_non_empty(Some(body.service_name), "服务名不能为空")?;
    let key = require_non_empty(Some(body.key), "COS key不能为空")?;
    validate_storage_prefix(&service_name, &key)?;
    let metadata = body.metadata.unwrap_or_else(|| json!({}));
    let business_type = trim_opt(body.business_type);
    let business_id = trim_opt(body.business_id);
    let uploaded_by = trim_opt(body.uploaded_by);

    let upload = sqlx::query_scalar::<_, Value>(
        r#"
        INSERT INTO platform_cos_uploads (
            service_name, business_type, business_id, key, original_file_name,
            content_type, size_bytes, uploaded_by, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING to_jsonb(platform_cos_uploads)
        "#,
    )
    .bind(&service_name)
    .bind(&business_type)
    .bind(&business_id)
    .bind(&key)
    .bind(trim_opt(body.original_file_name))
    .bind(trim_opt(body.content_type))
    .bind(body.size_bytes)
    .bind(&uploaded_by)
    .bind(metadata)
    .fetch_one(&state.db)
    .await?;

    insert_audit_log(
        &state.db,
        "platform-api",
        uploaded_by.as_deref(),
        "cos_upload.recorded",
        "platform_cos_upload",
        upload["id"].as_str(),
        business_type.as_deref(),
        business_id.as_deref(),
        json!({ "serviceName": service_name, "key": key }),
    )
    .await?;

    Ok(ok("创建成功", upload))
}

#[derive(Clone, Copy)]
enum PlatformTable {
    AppConfigs,
    PaymentOrders,
    RefundOrders,
    TransferOrders,
    SplitPlans,
    AuditLogs,
    EventDeliveries,
    CosUploads,
}

impl PlatformTable {
    fn table_name(self) -> &'static str {
        match self {
            Self::AppConfigs => "platform_app_configs",
            Self::PaymentOrders => "platform_payment_orders",
            Self::RefundOrders => "platform_refund_orders",
            Self::TransferOrders => "platform_transfer_orders",
            Self::SplitPlans => "platform_split_plans",
            Self::AuditLogs => "platform_audit_logs",
            Self::EventDeliveries => "platform_event_deliveries",
            Self::CosUploads => "platform_cos_uploads",
        }
    }
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum PlatformFilter {
    BusinessType,
    BusinessId,
    ServiceName,
    Status,
}

async fn list_records(
    pool: &sqlx::PgPool,
    table: PlatformTable,
    query: PlatformListQuery,
    allowed_filters: &[PlatformFilter],
) -> ApiResult<Json<ApiEnvelope<Vec<Value>>>> {
    let pagination = Pagination::from_query(query.page, query.page_size);
    let mut builder = QueryBuilder::<Postgres>::new("SELECT to_jsonb(records) FROM ");
    builder.push(table.table_name()).push(" records");

    let mut has_where = false;
    push_optional_filter(
        &mut builder,
        &mut has_where,
        allowed_filters,
        PlatformFilter::BusinessType,
        "business_type",
        query.business_type,
    );
    push_optional_filter(
        &mut builder,
        &mut has_where,
        allowed_filters,
        PlatformFilter::BusinessId,
        "business_id",
        query.business_id,
    );
    push_optional_filter(
        &mut builder,
        &mut has_where,
        allowed_filters,
        PlatformFilter::ServiceName,
        "service_name",
        query.service_name,
    );
    push_optional_filter(
        &mut builder,
        &mut has_where,
        allowed_filters,
        PlatformFilter::Status,
        "status",
        query.status,
    );
    builder
        .push(" ORDER BY created_at DESC LIMIT ")
        .push_bind(pagination.limit)
        .push(" OFFSET ")
        .push_bind(pagination.offset);

    let rows = builder
        .build_query_scalar::<Value>()
        .fetch_all(pool)
        .await?;
    Ok(ok("查询成功", rows))
}

fn push_optional_filter(
    builder: &mut QueryBuilder<'_, Postgres>,
    has_where: &mut bool,
    allowed_filters: &[PlatformFilter],
    filter: PlatformFilter,
    column: &'static str,
    value: Option<String>,
) {
    if !allowed_filters.contains(&filter) {
        return;
    }
    let Some(value) = optional_non_empty(value) else {
        return;
    };
    if *has_where {
        builder.push(" AND ");
    } else {
        builder.push(" WHERE ");
        *has_where = true;
    }
    builder.push(column).push(" = ").push_bind(value);
}

async fn get_split_plan_by_id(pool: &sqlx::PgPool, id: &str) -> ApiResult<Value> {
    sqlx::query_scalar::<_, Value>(
        r#"
        SELECT jsonb_build_object(
          'id', p.id,
          'businessType', p.business_type,
          'businessId', p.business_id,
          'paymentId', p.payment_id,
          'planStage', p.plan_stage,
          'totalAmountCents', p.total_amount_cents,
          'status', p.status,
          'submittedBy', p.submitted_by,
          'metadata', p.metadata,
          'createdAt', p.created_at,
          'updatedAt', p.updated_at,
          'executedAt', p.executed_at,
          'items', COALESCE((
            SELECT jsonb_agg(to_jsonb(i) ORDER BY i.created_at ASC)
            FROM platform_split_items i
            WHERE i.plan_id = p.id
          ), '[]'::jsonb)
        )
        FROM platform_split_plans p
        WHERE p.id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| ApiError::NotFound("分账计划不存在".to_string()))
}

async fn insert_audit_log(
    pool: &sqlx::PgPool,
    service_name: &str,
    actor_id: Option<&str>,
    action: &str,
    resource_type: &str,
    resource_id: Option<&str>,
    business_type: Option<&str>,
    business_id: Option<&str>,
    metadata: Value,
) -> ApiResult<()> {
    sqlx::query(
        r#"
        INSERT INTO platform_audit_logs (
            service_name, actor_id, actor_type, action, resource_type,
            resource_id, business_type, business_id, metadata
        )
        VALUES ($1, $2, 'service_or_admin', $3, $4, $5, $6, $7, $8)
        "#,
    )
    .bind(service_name)
    .bind(actor_id)
    .bind(action)
    .bind(resource_type)
    .bind(resource_id)
    .bind(business_type)
    .bind(business_id)
    .bind(metadata)
    .execute(pool)
    .await?;

    Ok(())
}

fn require_non_empty(value: Option<String>, message: &str) -> ApiResult<String> {
    optional_non_empty(value).ok_or_else(|| ApiError::BadRequest(message.to_string()))
}

fn optional_non_empty(value: Option<String>) -> Option<String> {
    value
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn trim_opt(value: Option<String>) -> Option<String> {
    optional_non_empty(value)
}

fn validate_amount(amount_cents: i64) -> ApiResult<()> {
    if amount_cents <= 0 {
        return Err(ApiError::BadRequest("金额必须大于0".to_string()));
    }
    Ok(())
}

fn validate_storage_prefix(service_name: &str, key: &str) -> ApiResult<()> {
    let expected_prefix = match service_name {
        "vehicle-api" | "vehicle" => "vehicle/",
        "mall-api" | "mall" => "mall/",
        "platform-api" | "platform" => "platform/",
        _ => {
            return Err(ApiError::BadRequest(
                "服务名必须是 vehicle-api、mall-api 或 platform-api".to_string(),
            ));
        }
    };
    if !key.starts_with(expected_prefix) {
        return Err(ApiError::BadRequest(format!(
            "COS key必须使用 {expected_prefix} 前缀"
        )));
    }
    Ok(())
}
