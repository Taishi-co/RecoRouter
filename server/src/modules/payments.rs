use std::{fmt, str::FromStr};

use axum::{
    body::Bytes,
    extract::{Extension, Path, State},
    http::HeaderMap,
    routing::post,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::{FromRow, PgPool};

use crate::{
    app::AppState,
    config::read_trimmed,
    error::{ApiError, ApiResult},
    modules::auth::{require_mall_privacy_consent, require_self_or_admin, AuthenticatedUser},
    response::{ok, ApiEnvelope},
    storage::Storage,
    wechat_pay::{
        decrypt_wechat_notification, encrypt_wechat_sensitive, exchange_miniapp_login_code,
        load_wechat_public_key, random_token, sign_message, truncate_chars, unix_timestamp,
        unix_timestamp_millis, verify_wechat_signature, wechat_authorization, with_wechat_headers,
        with_wechat_json_headers, WechatNotifyBody, WechatPayMerchantConfig,
    },
};

const WECHAT_JSAPI_URL: &str = "https://api.mch.weixin.qq.com/v3/pay/transactions/jsapi";
const WECHAT_QUERY_URL_PREFIX: &str =
    "https://api.mch.weixin.qq.com/v3/pay/transactions/out-trade-no";
const WECHAT_PARTNER_JSAPI_PATH: &str = "/v3/pay/partner/transactions/jsapi";
const WECHAT_PARTNER_QUERY_PATH_PREFIX: &str = "/v3/pay/partner/transactions/out-trade-no";
const WECHAT_ECOMMERCE_PROFIT_SHARING_PATH: &str = "/v3/ecommerce/profitsharing/orders";

pub fn ensure_mall_profit_sharing_runtime_ready() -> ApiResult<()> {
    let _ = WechatPayConfig::from_env_for_service(crate::config::ApiService::Mall)?;
    let _ = read_trimmed("WECHAT_PAY_PUBLIC_KEY_ID")
        .ok_or_else(|| ApiError::BadRequest("缺少 WECHAT_PAY_PUBLIC_KEY_ID 配置".to_string()))?;
    let _ = read_trimmed("WECHAT_PAY_PLATFORM_LEGAL_NAME").ok_or_else(|| {
        ApiError::BadRequest("缺少 WECHAT_PAY_PLATFORM_LEGAL_NAME 配置".to_string())
    })?;
    let _ = load_wechat_public_key()?;
    Ok(())
}

pub fn router<S>() -> Router<AppState<S>>
where
    S: Storage,
{
    Router::new()
        .route("/api/payments/wechat/notify", post(wechat_notify::<S>))
        .route(
            "/api/payments/wechat/complaints/notify",
            post(wechat_complaint_notify::<S>),
        )
}

pub fn customer_router<S>() -> Router<AppState<S>>
where
    S: Storage,
{
    Router::new()
        .route("/api/payments/prepay", post(create_prepay::<S>))
        .route("/api/payments/:id/sync", post(sync_payment::<S>))
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum PaymentProvider {
    Wechat,
    Alipay,
    Douyin,
}

impl PaymentProvider {
    fn as_str(self) -> &'static str {
        match self {
            Self::Wechat => "wechat",
            Self::Alipay => "alipay",
            Self::Douyin => "douyin",
        }
    }
}

impl FromStr for PaymentProvider {
    type Err = ApiError;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value.trim().to_ascii_lowercase().as_str() {
            "" | "wechat" => Ok(Self::Wechat),
            "alipay" => Ok(Self::Alipay),
            "douyin" | "tt" => Ok(Self::Douyin),
            _ => Err(ApiError::BadRequest("不支持的支付渠道".to_string())),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum PaymentBusinessType {
    OrderFare,
    OrderCommission,
    MallOrder,
    MallGroupBuyDeposit,
    MallGroupBuyBalance,
}

impl PaymentBusinessType {
    fn as_str(self) -> &'static str {
        match self {
            Self::OrderFare => "order_fare",
            Self::OrderCommission => "order_commission",
            Self::MallOrder => "mall_order",
            Self::MallGroupBuyDeposit => "mall_group_buy_deposit",
            Self::MallGroupBuyBalance => "mall_group_buy_balance",
        }
    }

    fn is_mall(self) -> bool {
        matches!(
            self,
            Self::MallOrder | Self::MallGroupBuyDeposit | Self::MallGroupBuyBalance
        )
    }
}

impl FromStr for PaymentBusinessType {
    type Err = ApiError;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value.trim().to_ascii_lowercase().as_str() {
            "" | "order_fare" | "fare" => Ok(Self::OrderFare),
            "order_commission" | "commission" => Ok(Self::OrderCommission),
            "mall_order" | "mall" => Ok(Self::MallOrder),
            "mall_group_buy_deposit" | "group_buy_deposit" => Ok(Self::MallGroupBuyDeposit),
            "mall_group_buy_balance" | "group_buy_balance" => Ok(Self::MallGroupBuyBalance),
            _ => Err(ApiError::BadRequest("不支持的支付业务类型".to_string())),
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PrepayRequest {
    order_id: String,
    provider: Option<String>,
    business_type: Option<String>,
    payer_id: Option<String>,
    payer_openid: Option<String>,
    login_code: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct PrepayResponse {
    payment_id: String,
    provider: PaymentProvider,
    business_type: String,
    order_id: String,
    out_trade_no: String,
    amount_cents: i64,
    status: String,
    client_payload: Value,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SyncPaymentResponse {
    payment_id: String,
    provider: PaymentProvider,
    business_type: String,
    order_id: String,
    status: String,
    order_status: Option<String>,
    payment_status: Option<String>,
    commission_payment_status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WechatJsapiClientPayload {
    #[serde(rename = "appId")]
    pub app_id: String,
    #[serde(rename = "timeStamp")]
    pub time_stamp: String,
    #[serde(rename = "nonceStr")]
    pub nonce_str: String,
    pub package: String,
    #[serde(rename = "signType")]
    pub sign_type: String,
    #[serde(rename = "paySign")]
    pub pay_sign: String,
}

impl WechatJsapiClientPayload {
    pub fn new(
        app_id: String,
        time_stamp: String,
        nonce_str: String,
        package: String,
        pay_sign: String,
    ) -> Self {
        Self {
            app_id,
            time_stamp,
            nonce_str,
            package,
            sign_type: "RSA".to_string(),
            pay_sign,
        }
    }
}

#[derive(Debug, FromRow)]
struct PayableOrderRow {
    id: String,
    owner_user_id: Option<String>,
    status: Option<String>,
    payment_status: Option<String>,
    commission_payment_status: Option<String>,
    fare_price: Option<f64>,
    commission_amount: Option<f64>,
    payable_cents: Option<i64>,
    cargo_name: Option<String>,
    group_buy_pay_window_open: Option<bool>,
    wechat_sub_mchid: Option<String>,
    platform_service_fee_cents: Option<i64>,
    merchant_receivable_cents: Option<i64>,
    profit_sharing_status: Option<String>,
}

#[derive(Debug, FromRow)]
struct PaymentRow {
    id: String,
    provider: String,
    business_type: String,
    business_id: String,
    out_trade_no: String,
    status: String,
    payment_mode: String,
    wechat_sub_mchid: Option<String>,
}

#[derive(Debug, Deserialize)]
struct WechatPrepayResponse {
    prepay_id: String,
}

#[derive(Debug, Deserialize)]
struct WechatQueryResponse {
    trade_state: String,
    transaction_id: Option<String>,
}

#[derive(Debug, Deserialize)]
struct WechatNotifyTransaction {
    out_trade_no: String,
    trade_state: String,
    transaction_id: Option<String>,
}

#[derive(Debug, FromRow)]
struct MallProfitSharingRow {
    payment_id: String,
    business_id: String,
    out_trade_no: String,
    provider_transaction_id: String,
    sub_mchid: String,
    payment_status: String,
    order_status: String,
    profit_sharing_status: String,
    platform_service_fee_cents: i64,
    merchant_receivable_cents: i64,
}

struct WechatPayConfig {
    merchant: WechatPayMerchantConfig,
    notify_url: String,
}

async fn create_prepay<S>(
    State(state): State<AppState<S>>,
    Extension(user): Extension<AuthenticatedUser>,
    Json(body): Json<PrepayRequest>,
) -> ApiResult<Json<ApiEnvelope<PrepayResponse>>>
where
    S: Storage,
{
    let provider = body
        .provider
        .as_deref()
        .unwrap_or("wechat")
        .parse::<PaymentProvider>()?;
    let business_type = body
        .business_type
        .as_deref()
        .unwrap_or("order_fare")
        .parse::<PaymentBusinessType>()?;
    if business_type.is_mall() {
        require_mall_privacy_consent(&state.db, &user).await?;
    }
    let order = fetch_payable_order(&state.db, &body.order_id, business_type).await?;
    require_self_or_admin(&user, order.owner_user_id.as_deref().unwrap_or_default())?;
    let amount_cents = payable_amount_cents(&order, business_type)?;

    validate_payable_order(&order, business_type)?;

    let out_trade_no = new_out_trade_no();
    let payment_id = insert_payment(
        &state.db,
        InsertPayment {
            business_type,
            order_id: &order.id,
            payer_id: Some(&user.id),
            provider,
            out_trade_no: &out_trade_no,
            amount_cents,
            payment_mode: payment_mode_for_order(&order),
            wechat_sub_mchid: order.wechat_sub_mchid.as_deref(),
        },
    )
    .await?;

    let client_payload = match provider {
        PaymentProvider::Wechat => {
            let config = WechatPayConfig::from_env_for_business(state.service, business_type)?;
            let openid = resolve_wechat_openid(&config, &body).await?;
            let prepay_id = wechat_create_jsapi_prepay(
                &config,
                &order,
                business_type,
                amount_cents,
                &out_trade_no,
                &openid,
            )
            .await?;
            let payload = build_wechat_client_payload(&config, &prepay_id)?;
            let payload_value = serde_json::to_value(&payload)
                .map_err(|err| ApiError::BadRequest(err.to_string()))?;
            sqlx::query(
                r#"
                UPDATE payments
                SET provider_prepay_id = $2,
                    client_payload = $3,
                    updated_at = now()
                WHERE id = $1
                "#,
            )
            .bind(&payment_id)
            .bind(prepay_id)
            .bind(&payload_value)
            .execute(&state.db)
            .await?;
            payload_value
        }
        PaymentProvider::Alipay => {
            return Err(ApiError::BadRequest(
                "支付宝支付渠道已预留，尚未配置商户参数".to_string(),
            ));
        }
        PaymentProvider::Douyin => {
            return Err(ApiError::BadRequest(
                "抖音支付渠道已预留，尚未配置担保支付参数".to_string(),
            ));
        }
    };

    Ok(ok(
        "预支付创建成功",
        PrepayResponse {
            payment_id,
            provider,
            business_type: business_type.as_str().to_string(),
            order_id: order.id,
            out_trade_no,
            amount_cents,
            status: "pending".to_string(),
            client_payload,
        },
    ))
}

async fn sync_payment<S>(
    State(state): State<AppState<S>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path(id): Path<String>,
) -> ApiResult<Json<ApiEnvelope<SyncPaymentResponse>>>
where
    S: Storage,
{
    let payment = fetch_payment(&state.db, &id).await?;
    let provider = payment.provider.parse::<PaymentProvider>()?;
    let business_type = payment.business_type.parse::<PaymentBusinessType>()?;
    let owned_order = fetch_payable_order(&state.db, &payment.business_id, business_type).await?;
    require_self_or_admin(
        &user,
        owned_order.owner_user_id.as_deref().unwrap_or_default(),
    )?;

    match provider {
        PaymentProvider::Wechat => {
            let config = WechatPayConfig::from_env_for_business(state.service, business_type)?;
            let state_result = wechat_query_order(&config, &payment).await?;
            if state_result.trade_state == "SUCCESS" {
                mark_payment_success(
                    &state.db,
                    &payment,
                    business_type,
                    state_result.transaction_id.as_deref(),
                )
                .await?;
            }
        }
        PaymentProvider::Alipay | PaymentProvider::Douyin => {
            return Err(ApiError::BadRequest(
                "该支付渠道尚未实现主动查单".to_string(),
            ));
        }
    }

    let refreshed = fetch_payment(&state.db, &id).await?;
    let order = fetch_payable_order(&state.db, &refreshed.business_id, business_type).await?;
    Ok(ok(
        "支付状态已同步",
        SyncPaymentResponse {
            payment_id: refreshed.id,
            provider,
            business_type: business_type.as_str().to_string(),
            order_id: order.id,
            status: refreshed.status,
            order_status: order.status,
            payment_status: order.payment_status,
            commission_payment_status: order.commission_payment_status,
        },
    ))
}

async fn wechat_notify<S>(
    State(state): State<AppState<S>>,
    headers: HeaderMap,
    body: Bytes,
) -> ApiResult<Json<Value>>
where
    S: Storage,
{
    let body_text = std::str::from_utf8(&body)
        .map_err(|_| ApiError::BadRequest("微信支付通知正文格式无效".to_string()))?;
    verify_wechat_notify_if_configured(&headers, body_text)?;
    let body = serde_json::from_slice::<WechatNotifyBody>(&body)
        .map_err(|err| ApiError::BadRequest(format!("微信支付通知格式无效: {err}")))?;
    let transaction = decrypt_wechat_notification::<WechatNotifyTransaction>(&body.resource)?;
    if transaction.trade_state == "SUCCESS" {
        let payment = fetch_payment_by_out_trade_no(&state.db, &transaction.out_trade_no).await?;
        let business_type = payment.business_type.parse::<PaymentBusinessType>()?;
        mark_payment_success(
            &state.db,
            &payment,
            business_type,
            transaction.transaction_id.as_deref(),
        )
        .await?;
    }

    Ok(Json(json!({ "code": "SUCCESS", "message": "成功" })))
}

async fn wechat_complaint_notify<S>(
    State(state): State<AppState<S>>,
    headers: HeaderMap,
    body: Bytes,
) -> ApiResult<Json<Value>>
where
    S: Storage,
{
    let body_text = std::str::from_utf8(&body)
        .map_err(|_| ApiError::BadRequest("微信投诉通知正文格式无效".to_string()))?;
    verify_wechat_notify_if_configured(&headers, body_text)?;
    let notify = serde_json::from_slice::<WechatNotifyBody>(&body)
        .map_err(|err| ApiError::BadRequest(format!("微信投诉通知格式无效: {err}")))?;
    let complaint = decrypt_wechat_notification::<Value>(&notify.resource)?;
    let complaint_id = complaint
        .get("complaint_id")
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| ApiError::BadRequest("微信投诉通知缺少 complaint_id".to_string()))?;
    let complaint_state = complaint
        .get("complaint_state")
        .and_then(Value::as_str)
        .unwrap_or("pending");
    sqlx::query(
        r#"
        INSERT INTO mall_wechat_complaints (
          complaint_id, order_no, transaction_id, user_complaint_times,
          complaint_detail, complaint_state, payer_phone,
          complaint_media, provider_payload
        )
        VALUES ($1, $2, $3, COALESCE($4, 1), $5, $6, $7, COALESCE($8, '[]'::jsonb), $9)
        ON CONFLICT (complaint_id) DO UPDATE SET
          order_no = COALESCE(EXCLUDED.order_no, mall_wechat_complaints.order_no),
          transaction_id = COALESCE(EXCLUDED.transaction_id, mall_wechat_complaints.transaction_id),
          user_complaint_times = EXCLUDED.user_complaint_times,
          complaint_detail = COALESCE(EXCLUDED.complaint_detail, mall_wechat_complaints.complaint_detail),
          complaint_state = EXCLUDED.complaint_state,
          payer_phone = COALESCE(EXCLUDED.payer_phone, mall_wechat_complaints.payer_phone),
          complaint_media = EXCLUDED.complaint_media,
          provider_payload = EXCLUDED.provider_payload,
          updated_at = now()
        "#,
    )
    .bind(complaint_id)
    .bind(complaint.get("out_trade_no").and_then(Value::as_str))
    .bind(complaint.get("transaction_id").and_then(Value::as_str))
    .bind(
        complaint
            .get("user_complaint_times")
            .and_then(Value::as_i64)
            .and_then(|value| i32::try_from(value).ok()),
    )
    .bind(complaint.get("complaint_detail").and_then(Value::as_str))
    .bind(complaint_state)
    .bind(complaint.get("payer_phone").and_then(Value::as_str))
    .bind(complaint.get("complaint_media_list"))
    .bind(&complaint)
    .execute(&state.db)
    .await?;
    sqlx::query(
        r#"
        INSERT INTO mall_operations_alerts (
          dedupe_key, alert_type, source, business_id, severity, title, description, metadata
        )
        VALUES ($1, 'wechat_consumer_complaint', 'wechat_pay', $2, 'critical',
          '收到微信支付消费者投诉', $3, $4)
        ON CONFLICT (dedupe_key) DO UPDATE SET
          status = CASE WHEN $5 IN ('204', 'COMPLETED', 'completed') THEN 'resolved' ELSE 'open' END,
          description = EXCLUDED.description, metadata = EXCLUDED.metadata,
          occurrence_count = mall_operations_alerts.occurrence_count + 1,
          last_occurred_at = now(), updated_at = now()
        "#,
    )
    .bind(format!("wechat-complaint:{complaint_id}"))
    .bind(complaint_id)
    .bind(
        complaint
            .get("complaint_detail")
            .and_then(Value::as_str)
            .unwrap_or("请及时登录商户平台处理消费者投诉"),
    )
    .bind(json!({ "complaintState": complaint_state }))
    .bind(complaint_state)
    .execute(&state.db)
    .await?;
    Ok(Json(json!({ "code": "SUCCESS", "message": "成功" })))
}

fn verify_wechat_notify_if_configured(headers: &HeaderMap, body: &str) -> ApiResult<()> {
    let has_public_key = read_trimmed("WECHAT_PAY_PUBLIC_KEY").is_some()
        || read_trimmed("WECHAT_PAY_PUBLIC_KEY_PATH").is_some();
    if !has_public_key {
        return Ok(());
    }
    let header = |name: &'static str| {
        headers
            .get(name)
            .and_then(|value| value.to_str().ok())
            .filter(|value| !value.trim().is_empty())
            .ok_or_else(|| ApiError::BadRequest(format!("微信支付通知缺少 {name}")))
    };
    let serial = header("Wechatpay-Serial")?;
    if let Some(expected) = read_trimmed("WECHAT_PAY_PUBLIC_KEY_ID") {
        if serial != expected {
            return Err(ApiError::BadRequest(
                "微信支付通知公钥ID与配置不一致".to_string(),
            ));
        }
    }
    verify_wechat_signature(
        &load_wechat_public_key()?,
        header("Wechatpay-Timestamp")?,
        header("Wechatpay-Nonce")?,
        body,
        header("Wechatpay-Signature")?,
    )
}

struct InsertPayment<'a> {
    business_type: PaymentBusinessType,
    order_id: &'a str,
    payer_id: Option<&'a str>,
    provider: PaymentProvider,
    out_trade_no: &'a str,
    amount_cents: i64,
    payment_mode: &'a str,
    wechat_sub_mchid: Option<&'a str>,
}

async fn insert_payment(pool: &PgPool, payment: InsertPayment<'_>) -> ApiResult<String> {
    let id: String = sqlx::query_scalar(
        r#"
        INSERT INTO payments (
            business_type, business_id, payer_id, provider, out_trade_no,
            amount_cents, currency, status, payment_mode, wechat_sub_mchid,
            profit_sharing_required
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'CNY', 'pending', $7, $8, $7 = 'platform_partner')
        RETURNING id
        "#,
    )
    .bind(payment.business_type.as_str())
    .bind(payment.order_id)
    .bind(payment.payer_id)
    .bind(payment.provider.as_str())
    .bind(payment.out_trade_no)
    .bind(payment.amount_cents)
    .bind(payment.payment_mode)
    .bind(payment.wechat_sub_mchid)
    .fetch_one(pool)
    .await?;

    Ok(id)
}

async fn fetch_payable_order(
    pool: &PgPool,
    order_id: &str,
    business_type: PaymentBusinessType,
) -> ApiResult<PayableOrderRow> {
    if business_type == PaymentBusinessType::MallOrder {
        crate::modules::mall::expire_unpaid_mall_orders(pool).await?;
    }

    match business_type {
        PaymentBusinessType::OrderFare | PaymentBusinessType::OrderCommission => {
            sqlx::query_as::<_, PayableOrderRow>(
                r#"
                SELECT
                    o.id,
                    CASE WHEN $2 = 'order_commission' THEN o.owner_id ELSE o.merchant_id END AS owner_user_id,
                    o.status,
                    o.payment_status,
                    o.commission_payment_status,
                    o.fare_price::float8 AS fare_price,
                    o.commission_amount::float8 AS commission_amount,
                    NULL::bigint AS payable_cents,
                    d.cargo_name,
                    NULL::boolean AS group_buy_pay_window_open,
                    NULL::text AS wechat_sub_mchid,
                    NULL::bigint AS platform_service_fee_cents,
                    NULL::bigint AS merchant_receivable_cents,
                    NULL::text AS profit_sharing_status
                FROM orders o
                LEFT JOIN demands d ON d.id = o.demand_id
                WHERE o.id = $1
                "#,
            )
            .bind(order_id)
            .bind(business_type.as_str())
            .fetch_optional(pool)
            .await?
            .ok_or_else(|| ApiError::NotFound("订单不存在".to_string()))
        }
        PaymentBusinessType::MallOrder => sqlx::query_as::<_, PayableOrderRow>(
            r#"
            SELECT
                id,
                user_id AS owner_user_id,
                status,
                payment_status,
                NULL::text AS commission_payment_status,
                NULL::float8 AS fare_price,
                NULL::float8 AS commission_amount,
                payable_cents,
                'RecoRouter Fresh'::text AS cargo_name,
                NULL::boolean AS group_buy_pay_window_open,
                wechat_sub_mchid,
                platform_service_fee_cents,
                merchant_receivable_cents,
                profit_sharing_status
            FROM mall_orders
            WHERE id = $1
            "#,
        )
        .bind(order_id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::NotFound("商城订单不存在".to_string())),
        PaymentBusinessType::MallGroupBuyDeposit => sqlx::query_as::<_, PayableOrderRow>(
            r#"
            SELECT
                subscription.id,
                subscription.user_id AS owner_user_id,
                subscription.status,
                CASE
                    WHEN subscription.deposit_paid_at IS NULL THEN 'pending'
                    ELSE 'paid'
                END::text AS payment_status,
                NULL::text AS commission_payment_status,
                NULL::float8 AS fare_price,
                NULL::float8 AS commission_amount,
                subscription.deposit_cents AS payable_cents,
                activity.name AS cargo_name,
                (
                    activity.status IN ('published', 'enrolling')
                    AND activity.starts_at <= now()
                    AND activity.ends_at > now()
                ) AS group_buy_pay_window_open,
                NULL::text AS wechat_sub_mchid,
                NULL::bigint AS platform_service_fee_cents,
                NULL::bigint AS merchant_receivable_cents,
                NULL::text AS profit_sharing_status
            FROM mall_group_buy_subscriptions subscription
            JOIN mall_group_buy_activities activity ON activity.id = subscription.activity_id
            WHERE subscription.id = $1
            "#,
        )
        .bind(order_id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::NotFound("集采认购单不存在".to_string())),
        PaymentBusinessType::MallGroupBuyBalance => sqlx::query_as::<_, PayableOrderRow>(
            r#"
            SELECT
                subscription.id,
                subscription.user_id AS owner_user_id,
                subscription.status,
                CASE
                    WHEN subscription.balance_paid_at IS NULL THEN 'pending'
                    ELSE 'paid'
                END::text AS payment_status,
                NULL::text AS commission_payment_status,
                NULL::float8 AS fare_price,
                NULL::float8 AS commission_amount,
                subscription.balance_cents AS payable_cents,
                activity.name AS cargo_name,
                NULL::boolean AS group_buy_pay_window_open,
                NULL::text AS wechat_sub_mchid,
                NULL::bigint AS platform_service_fee_cents,
                NULL::bigint AS merchant_receivable_cents,
                NULL::text AS profit_sharing_status
            FROM mall_group_buy_subscriptions subscription
            JOIN mall_group_buy_activities activity ON activity.id = subscription.activity_id
            WHERE subscription.id = $1
            "#,
        )
        .bind(order_id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::NotFound("集采认购单不存在".to_string())),
    }
}

async fn fetch_payment(pool: &PgPool, payment_id: &str) -> ApiResult<PaymentRow> {
    sqlx::query_as::<_, PaymentRow>(
        r#"
        SELECT id, provider, business_type, business_id, out_trade_no, status,
               payment_mode, wechat_sub_mchid
        FROM payments
        WHERE id = $1
        "#,
    )
    .bind(payment_id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| ApiError::NotFound("支付单不存在".to_string()))
}

async fn fetch_payment_by_out_trade_no(pool: &PgPool, out_trade_no: &str) -> ApiResult<PaymentRow> {
    sqlx::query_as::<_, PaymentRow>(
        r#"
        SELECT id, provider, business_type, business_id, out_trade_no, status,
               payment_mode, wechat_sub_mchid
        FROM payments
        WHERE out_trade_no = $1
        "#,
    )
    .bind(out_trade_no)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| ApiError::NotFound("支付单不存在".to_string()))
}

fn validate_payable_order(
    order: &PayableOrderRow,
    business_type: PaymentBusinessType,
) -> ApiResult<()> {
    match business_type {
        PaymentBusinessType::OrderFare => {
            if order.status.as_deref() != Some("transport_completed") {
                return Err(ApiError::BadRequest(
                    "只有运输完成的订单可以支付运费".to_string(),
                ));
            }
            if order.payment_status.as_deref() == Some("paid") {
                return Err(ApiError::BadRequest("订单运费已支付".to_string()));
            }
        }
        PaymentBusinessType::OrderCommission => {
            if order.status.as_deref() != Some("payment_confirmed") {
                return Err(ApiError::BadRequest("请先确认运费收款".to_string()));
            }
            if order.commission_payment_status.as_deref() == Some("paid") {
                return Err(ApiError::BadRequest("订单佣金已支付".to_string()));
            }
        }
        PaymentBusinessType::MallOrder => {
            if !matches!(
                order.status.as_deref(),
                Some("pending_payment") | Some("paid")
            ) {
                return Err(ApiError::BadRequest("当前商城订单不可支付".to_string()));
            }
            if order.payment_status.as_deref() == Some("paid") {
                return Err(ApiError::BadRequest("商城订单已支付".to_string()));
            }
            if order.wechat_sub_mchid.is_some() {
                let platform_fee = order.platform_service_fee_cents.unwrap_or_default();
                let merchant_receivable = order.merchant_receivable_cents.unwrap_or_default();
                if platform_fee <= 0
                    || merchant_receivable <= 0
                    || platform_fee + merchant_receivable != order.payable_cents.unwrap_or_default()
                {
                    return Err(ApiError::BadRequest(
                        "合作商家订单分账金额无效，请联系平台处理".to_string(),
                    ));
                }
                if order.profit_sharing_status.as_deref() != Some("pending") {
                    return Err(ApiError::BadRequest(
                        "合作商家订单分账状态无效，请联系平台处理".to_string(),
                    ));
                }
            }
        }
        PaymentBusinessType::MallGroupBuyDeposit => {
            if order.status.as_deref() != Some("pending_deposit") {
                return Err(ApiError::BadRequest("当前认购单不可支付定金".to_string()));
            }
            if order.group_buy_pay_window_open == Some(false) {
                return Err(ApiError::BadRequest(
                    "认购已结束，不能继续支付订金".to_string(),
                ));
            }
            if order.payment_status.as_deref() == Some("paid") {
                return Err(ApiError::BadRequest("定金已支付".to_string()));
            }
        }
        PaymentBusinessType::MallGroupBuyBalance => {
            if order.status.as_deref() != Some("pending_balance") {
                return Err(ApiError::BadRequest("当前认购单不可支付尾款".to_string()));
            }
            if order.payment_status.as_deref() == Some("paid") {
                return Err(ApiError::BadRequest("尾款已支付".to_string()));
            }
        }
    }
    Ok(())
}

fn payable_amount_cents(
    order: &PayableOrderRow,
    business_type: PaymentBusinessType,
) -> ApiResult<i64> {
    let amount = match business_type {
        PaymentBusinessType::OrderFare => order.fare_price.unwrap_or(0.0),
        PaymentBusinessType::OrderCommission => order.commission_amount.unwrap_or(0.0),
        PaymentBusinessType::MallOrder
        | PaymentBusinessType::MallGroupBuyDeposit
        | PaymentBusinessType::MallGroupBuyBalance => {
            let cents = order.payable_cents.unwrap_or_default();
            if cents <= 0 {
                return Err(ApiError::BadRequest("支付金额必须大于0".to_string()));
            }
            return Ok(cents);
        }
    };
    let cents = (amount * 100.0).round() as i64;
    if cents <= 0 {
        return Err(ApiError::BadRequest("支付金额必须大于0".to_string()));
    }
    Ok(cents)
}

async fn mark_payment_success(
    pool: &PgPool,
    payment: &PaymentRow,
    business_type: PaymentBusinessType,
    transaction_id: Option<&str>,
) -> ApiResult<()> {
    sqlx::query(
        r#"
        UPDATE payments
        SET status = 'paid',
            provider_transaction_id = COALESCE($2, provider_transaction_id),
            paid_at = COALESCE(paid_at, now()),
            updated_at = now()
        WHERE id = $1
        "#,
    )
    .bind(&payment.id)
    .bind(transaction_id)
    .execute(pool)
    .await?;

    match business_type {
        PaymentBusinessType::OrderFare => {
            crate::modules::orders::settle_order_fare_payment_success(pool, &payment.business_id)
                .await?;
        }
        PaymentBusinessType::OrderCommission => {
            sqlx::query(
                r#"
                UPDATE orders
                SET commission_payment_status = 'paid',
                    commission_payment_time = now(),
                    status = 'commission_pending',
                    updated_at = now()
                WHERE id = $1
                "#,
            )
            .bind(&payment.business_id)
            .execute(pool)
            .await?;
        }
        PaymentBusinessType::MallOrder => {
            crate::modules::mall::settle_mall_order_payment_success(pool, &payment.business_id)
                .await?;
        }
        PaymentBusinessType::MallGroupBuyDeposit => {
            crate::modules::mall::settle_group_buy_deposit_payment_success(
                pool,
                &payment.business_id,
            )
            .await?;
        }
        PaymentBusinessType::MallGroupBuyBalance => {
            crate::modules::mall::settle_group_buy_balance_payment_success(
                pool,
                &payment.business_id,
            )
            .await?;
        }
    }

    Ok(())
}

pub async fn trigger_mall_profit_sharing(pool: &PgPool, order_id: &str) -> ApiResult<Value> {
    let row = sqlx::query_as::<_, MallProfitSharingRow>(
        r#"
        SELECT
          payment.id AS payment_id,
          payment.business_id,
          payment.out_trade_no,
          payment.provider_transaction_id,
          payment.wechat_sub_mchid AS sub_mchid,
          payment.status AS payment_status,
          mall_order.status AS order_status,
          mall_order.profit_sharing_status,
          mall_order.platform_service_fee_cents,
          mall_order.merchant_receivable_cents
        FROM payments payment
        JOIN mall_orders mall_order ON mall_order.id = payment.business_id
        WHERE payment.business_type = 'mall_order'
          AND payment.business_id = $1
          AND payment.payment_mode = 'platform_partner'
          AND payment.profit_sharing_required = true
          AND payment.provider_transaction_id IS NOT NULL
        ORDER BY payment.paid_at DESC NULLS LAST, payment.created_at DESC
        LIMIT 1
        "#,
    )
    .bind(order_id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| ApiError::BadRequest("订单没有可分账的平台收付通支付记录".to_string()))?;

    if row.payment_status != "paid" {
        return Err(ApiError::BadRequest("支付成功后才能分账".to_string()));
    }
    if row.order_status != "completed" {
        return Err(ApiError::BadRequest("确认履约完成后才能分账".to_string()));
    }
    if row.platform_service_fee_cents <= 0 || row.merchant_receivable_cents <= 0 {
        return Err(ApiError::BadRequest("订单分账金额配置无效".to_string()));
    }
    if row.profit_sharing_status == "succeeded" {
        return sqlx::query_scalar::<_, Value>(
            "SELECT to_jsonb(platform_profit_sharing_orders) FROM platform_profit_sharing_orders WHERE payment_id = $1",
        )
        .bind(&row.payment_id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::BadRequest("分账记录不存在".to_string()));
    }

    let out_order_no = format!("PS{}", row.out_trade_no);
    let config = WechatPayConfig::from_env_for_service(crate::config::ApiService::Mall)?;
    if let Some(existing) = sqlx::query_scalar::<_, Value>(
        "SELECT to_jsonb(platform_profit_sharing_orders) FROM platform_profit_sharing_orders WHERE payment_id = $1",
    )
    .bind(&row.payment_id)
    .fetch_optional(pool)
    .await?
    {
        match existing.get("status").and_then(Value::as_str) {
            Some("succeeded") => return Ok(existing),
            Some("processing") => {
                if let Some(provider_payload) = query_profit_sharing_order(
                    &config,
                    &row.sub_mchid,
                    &row.provider_transaction_id,
                    &out_order_no,
                )
                .await?
                {
                    return persist_profit_sharing_result(
                        pool,
                        order_id,
                        &row.payment_id,
                        &provider_payload,
                    )
                    .await;
                }
            }
            _ => {}
        }
    }
    let split = sqlx::query_scalar::<_, Value>(
        r#"
        INSERT INTO platform_profit_sharing_orders (
          payment_id, business_type, business_id, sub_mchid, transaction_id,
          out_order_no, platform_service_fee_cents, merchant_receivable_cents,
          status, attempts
        )
        VALUES ($1, 'mall_order', $2, $3, $4, $5, $6, $7, 'processing', 1)
        ON CONFLICT (payment_id)
        DO UPDATE SET attempts = platform_profit_sharing_orders.attempts + 1,
                      status = CASE
                        WHEN platform_profit_sharing_orders.status = 'succeeded' THEN 'succeeded'
                        ELSE 'processing'
                      END,
                      last_error = NULL,
                      updated_at = now()
        RETURNING to_jsonb(platform_profit_sharing_orders)
        "#,
    )
    .bind(&row.payment_id)
    .bind(&row.business_id)
    .bind(&row.sub_mchid)
    .bind(&row.provider_transaction_id)
    .bind(&out_order_no)
    .bind(row.platform_service_fee_cents)
    .bind(row.merchant_receivable_cents)
    .fetch_one(pool)
    .await?;

    if split.get("status").and_then(Value::as_str) == Some("succeeded") {
        return Ok(split);
    }

    sqlx::query(
        r#"
        UPDATE mall_orders
        SET profit_sharing_status = 'processing',
            profit_sharing_out_order_no = $2,
            profit_sharing_last_error = NULL,
            updated_at = now()
        WHERE id = $1
        "#,
    )
    .bind(order_id)
    .bind(&out_order_no)
    .execute(pool)
    .await?;

    let public_key_id = read_trimmed("WECHAT_PAY_PUBLIC_KEY_ID")
        .ok_or_else(|| ApiError::BadRequest("缺少 WECHAT_PAY_PUBLIC_KEY_ID 配置".to_string()))?;
    let platform_legal_name = read_trimmed("WECHAT_PAY_PLATFORM_LEGAL_NAME").ok_or_else(|| {
        ApiError::BadRequest("缺少 WECHAT_PAY_PLATFORM_LEGAL_NAME 配置".to_string())
    })?;
    let encrypted_legal_name =
        encrypt_wechat_sensitive(&load_wechat_public_key()?, &platform_legal_name)?;
    let request_body = json!({
        "appid": config.merchant.app_id,
        "sub_mchid": row.sub_mchid,
        "transaction_id": row.provider_transaction_id,
        "out_order_no": out_order_no,
        "receivers": [{
            "type": "MERCHANT_ID",
            "receiver_account": config.merchant.mch_id,
            "amount": row.platform_service_fee_cents,
            "description": "平台技术与运营服务费",
            "receiver_name": encrypted_legal_name
        }],
        "finish": true
    });
    let body_text = request_body.to_string();
    let authorization = wechat_authorization(
        &config.merchant,
        "POST",
        WECHAT_ECOMMERCE_PROFIT_SHARING_PATH,
        &body_text,
    )?;
    let response = with_wechat_json_headers(
        reqwest::Client::new().post(format!(
            "https://api.mch.weixin.qq.com{WECHAT_ECOMMERCE_PROFIT_SHARING_PATH}"
        )),
        &authorization,
    )
    .header("Wechatpay-Serial", public_key_id)
    .body(body_text)
    .send()
    .await
    .map_err(|err| ApiError::BadRequest(format!("微信分账请求失败: {err}")))?;
    let status_code = response.status();
    let response_text = response
        .text()
        .await
        .map_err(|err| ApiError::BadRequest(format!("微信分账响应读取失败: {err}")))?;
    let provider_payload = serde_json::from_str::<Value>(&response_text)
        .unwrap_or_else(|_| json!({ "raw": response_text }));

    if !status_code.is_success() {
        let message = provider_payload
            .get("message")
            .and_then(Value::as_str)
            .or_else(|| provider_payload.get("code").and_then(Value::as_str))
            .unwrap_or("请稍后重试")
            .to_string();
        mark_profit_sharing_failed(pool, order_id, &row.payment_id, &provider_payload, &message)
            .await?;
        return Err(ApiError::BadRequest(format!("微信分账申请失败: {message}")));
    }

    persist_profit_sharing_result(pool, order_id, &row.payment_id, &provider_payload).await
}

async fn query_profit_sharing_order(
    config: &WechatPayConfig,
    sub_mchid: &str,
    transaction_id: &str,
    out_order_no: &str,
) -> ApiResult<Option<Value>> {
    let path = format!(
        "{WECHAT_ECOMMERCE_PROFIT_SHARING_PATH}?sub_mchid={sub_mchid}&transaction_id={transaction_id}&out_order_no={out_order_no}"
    );
    let authorization = wechat_authorization(&config.merchant, "GET", &path, "")?;
    let response = with_wechat_headers(
        reqwest::Client::new().get(format!("https://api.mch.weixin.qq.com{path}")),
        &authorization,
    )
    .send()
    .await
    .map_err(|err| ApiError::BadRequest(format!("微信分账结果查询失败: {err}")))?;
    let status_code = response.status();
    let response_text = response
        .text()
        .await
        .map_err(|err| ApiError::BadRequest(format!("微信分账查询响应读取失败: {err}")))?;
    let payload = serde_json::from_str::<Value>(&response_text)
        .unwrap_or_else(|_| json!({ "raw": response_text }));
    if status_code == reqwest::StatusCode::NOT_FOUND {
        return Ok(None);
    }
    if !status_code.is_success() {
        return Err(ApiError::BadRequest(format!(
            "微信分账结果查询失败: {}",
            payload
                .get("message")
                .and_then(Value::as_str)
                .or_else(|| payload.get("code").and_then(Value::as_str))
                .unwrap_or("请稍后重试")
        )));
    }
    Ok(Some(payload))
}

async fn persist_profit_sharing_result(
    pool: &PgPool,
    order_id: &str,
    payment_id: &str,
    provider_payload: &Value,
) -> ApiResult<Value> {
    let provider_status = provider_payload
        .get("status")
        .and_then(Value::as_str)
        .unwrap_or("PROCESSING");
    let receiver_failed = provider_payload
        .get("receivers")
        .and_then(Value::as_array)
        .is_some_and(|receivers| {
            receivers.iter().any(|receiver| {
                receiver
                    .get("result")
                    .and_then(Value::as_str)
                    .is_some_and(|result| result != "SUCCESS")
            })
        });
    let status = match (provider_status, receiver_failed) {
        ("FINISHED", false) => "succeeded",
        ("FINISHED", true) => "failed",
        _ => "processing",
    };
    let provider_order_id = provider_payload
        .get("order_id")
        .and_then(Value::as_str)
        .map(str::to_string);
    let last_error = (status == "failed").then(|| "微信分账接收方处理失败".to_string());
    let updated = sqlx::query_scalar::<_, Value>(
        r#"
        UPDATE platform_profit_sharing_orders
        SET status = $2,
            provider_order_id = COALESCE($3, provider_order_id),
            provider_payload = $4,
            last_error = $5,
            completed_at = CASE WHEN $2 = 'succeeded' THEN now() ELSE completed_at END,
            updated_at = now()
        WHERE payment_id = $1
        RETURNING to_jsonb(platform_profit_sharing_orders)
        "#,
    )
    .bind(payment_id)
    .bind(status)
    .bind(provider_order_id)
    .bind(provider_payload)
    .bind(last_error.as_deref())
    .fetch_one(pool)
    .await?;
    sqlx::query(
        r#"
        UPDATE mall_orders
        SET profit_sharing_status = $2,
            profit_sharing_completed_at = CASE WHEN $2 = 'succeeded' THEN now() ELSE profit_sharing_completed_at END,
            profit_sharing_last_error = $3,
            updated_at = now()
        WHERE id = $1
        "#,
    )
    .bind(order_id)
    .bind(status)
    .bind(last_error.as_deref())
    .execute(pool)
    .await?;

    if let Some(message) = last_error {
        return Err(ApiError::BadRequest(message));
    }
    Ok(updated)
}

async fn mark_profit_sharing_failed(
    pool: &PgPool,
    order_id: &str,
    payment_id: &str,
    provider_payload: &Value,
    message: &str,
) -> ApiResult<()> {
    sqlx::query(
        r#"
        UPDATE platform_profit_sharing_orders
        SET status = 'failed', provider_payload = $2, last_error = $3, updated_at = now()
        WHERE payment_id = $1
        "#,
    )
    .bind(payment_id)
    .bind(provider_payload)
    .bind(message)
    .execute(pool)
    .await?;
    sqlx::query(
        r#"
        UPDATE mall_orders
        SET profit_sharing_status = 'failed', profit_sharing_last_error = $2, updated_at = now()
        WHERE id = $1
        "#,
    )
    .bind(order_id)
    .bind(message)
    .execute(pool)
    .await?;
    Ok(())
}

fn payment_mode_for_order(order: &PayableOrderRow) -> &'static str {
    if order.wechat_sub_mchid.is_some() {
        "platform_partner"
    } else {
        "direct"
    }
}

async fn resolve_wechat_openid(
    config: &WechatPayConfig,
    request: &PrepayRequest,
) -> ApiResult<String> {
    if let Some(openid) = request
        .payer_openid
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        return Ok(openid.to_string());
    }
    let login_code = request
        .login_code
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| ApiError::BadRequest("缺少微信登录凭证".to_string()))?;
    exchange_miniapp_login_code(&config.merchant, login_code).await
}

async fn wechat_create_jsapi_prepay(
    config: &WechatPayConfig,
    order: &PayableOrderRow,
    business_type: PaymentBusinessType,
    amount_cents: i64,
    out_trade_no: &str,
    openid: &str,
) -> ApiResult<String> {
    let description = match business_type {
        PaymentBusinessType::OrderFare => format!(
            "RecoRouter运费-{}",
            order.cargo_name.as_deref().unwrap_or("运输订单")
        ),
        PaymentBusinessType::OrderCommission => format!("RecoRouter佣金-{}", order.id),
        PaymentBusinessType::MallOrder => format!(
            "RecoRouter商城-{}",
            order.cargo_name.as_deref().unwrap_or("本地鲜选")
        ),
        PaymentBusinessType::MallGroupBuyDeposit => format!(
            "叁友甄选集采定金-{}",
            order.cargo_name.as_deref().unwrap_or("集采")
        ),
        PaymentBusinessType::MallGroupBuyBalance => format!(
            "叁友甄选集采尾款-{}",
            order.cargo_name.as_deref().unwrap_or("集采")
        ),
    };
    let description = truncate_chars(&description, 127);
    let (path, body) = if let Some(sub_mchid) = order.wechat_sub_mchid.as_deref() {
        let request = json!({
            "sp_appid": config.merchant.app_id,
            "sp_mchid": config.merchant.mch_id,
            "sub_mchid": sub_mchid,
            "description": description,
            "out_trade_no": out_trade_no,
            "notify_url": config.notify_url,
            "settle_info": { "profit_sharing": true },
            "amount": { "total": amount_cents, "currency": "CNY" },
            "payer": { "sp_openid": openid }
        });
        (WECHAT_PARTNER_JSAPI_PATH, request.to_string())
    } else {
        (
            "/v3/pay/transactions/jsapi",
            json!({
                "appid": config.merchant.app_id,
                "mchid": config.merchant.mch_id,
                "description": description,
                "out_trade_no": out_trade_no,
                "notify_url": config.notify_url,
                "amount": { "total": amount_cents, "currency": "CNY" },
                "payer": { "openid": openid }
            })
            .to_string(),
        )
    };
    let authorization = wechat_authorization(&config.merchant, "POST", path, &body)?;
    let response = with_wechat_json_headers(
        reqwest::Client::new().post(if path == WECHAT_PARTNER_JSAPI_PATH {
            format!("https://api.mch.weixin.qq.com{WECHAT_PARTNER_JSAPI_PATH}")
        } else {
            WECHAT_JSAPI_URL.to_string()
        }),
        &authorization,
    )
    .body(body)
    .send()
    .await
    .map_err(|err| ApiError::BadRequest(format!("微信预下单请求失败: {err}")))?;
    let status = response.status();
    let response_text = response
        .text()
        .await
        .map_err(|err| ApiError::BadRequest(format!("微信预下单响应读取失败: {err}")))?;
    if !status.is_success() {
        return Err(ApiError::BadRequest(format!(
            "微信预下单失败: {response_text}"
        )));
    }
    let response: WechatPrepayResponse = serde_json::from_str(&response_text)
        .map_err(|err| ApiError::BadRequest(format!("微信预下单失败: {response_text}; {err}")))?;
    Ok(response.prepay_id)
}

async fn wechat_query_order(
    config: &WechatPayConfig,
    payment: &PaymentRow,
) -> ApiResult<WechatQueryResponse> {
    let path = if payment.payment_mode == "platform_partner" {
        let sub_mchid = payment
            .wechat_sub_mchid
            .as_deref()
            .ok_or_else(|| ApiError::BadRequest("平台收付通支付单缺少二级商户号".to_string()))?;
        format!(
            "{WECHAT_PARTNER_QUERY_PATH_PREFIX}/{}?sp_mchid={}&sub_mchid={}",
            payment.out_trade_no, config.merchant.mch_id, sub_mchid
        )
    } else {
        format!(
            "/v3/pay/transactions/out-trade-no/{}?mchid={}",
            payment.out_trade_no, config.merchant.mch_id
        )
    };
    let authorization = wechat_authorization(&config.merchant, "GET", &path, "")?;
    let url = if payment.payment_mode == "platform_partner" {
        format!("https://api.mch.weixin.qq.com{path}")
    } else {
        format!(
            "{WECHAT_QUERY_URL_PREFIX}/{}?mchid={}",
            payment.out_trade_no, config.merchant.mch_id
        )
    };
    let response = with_wechat_headers(reqwest::Client::new().get(url), &authorization)
        .send()
        .await
        .map_err(|err| ApiError::BadRequest(format!("微信查单请求失败: {err}")))?;
    let status = response.status();
    let response_text = response
        .text()
        .await
        .map_err(|err| ApiError::BadRequest(format!("微信查单响应读取失败: {err}")))?;
    if !status.is_success() {
        return Err(ApiError::BadRequest(format!(
            "微信查单失败: {response_text}"
        )));
    }
    serde_json::from_str(&response_text)
        .map_err(|err| ApiError::BadRequest(format!("微信查单失败: {response_text}; {err}")))
}

fn build_wechat_client_payload(
    config: &WechatPayConfig,
    prepay_id: &str,
) -> ApiResult<WechatJsapiClientPayload> {
    let time_stamp = unix_timestamp().to_string();
    let nonce_str = random_token(24);
    let package = format!("prepay_id={prepay_id}");
    let message = format!(
        "{}\n{}\n{}\n{}\n",
        config.merchant.app_id, time_stamp, nonce_str, package
    );
    let pay_sign = sign_message(&config.merchant.private_key, &message)?;

    Ok(WechatJsapiClientPayload::new(
        config.merchant.app_id.clone(),
        time_stamp,
        nonce_str,
        package,
        pay_sign,
    ))
}

fn new_out_trade_no() -> String {
    format!("RR{}{}", unix_timestamp_millis(), random_token(6))
}

impl WechatPayConfig {
    fn from_env_for_business(
        service: crate::config::ApiService,
        business_type: PaymentBusinessType,
    ) -> ApiResult<Self> {
        let config_service = match business_type {
            PaymentBusinessType::MallOrder => crate::config::ApiService::Mall,
            PaymentBusinessType::MallGroupBuyDeposit | PaymentBusinessType::MallGroupBuyBalance => {
                crate::config::ApiService::Mall
            }
            PaymentBusinessType::OrderFare | PaymentBusinessType::OrderCommission => service,
        };
        Self::from_env_for_service(config_service)
    }

    fn from_env_for_service(service: crate::config::ApiService) -> ApiResult<Self> {
        let merchant = WechatPayMerchantConfig::from_env_for_service(service)?;
        let notify_url = read_trimmed("WECHAT_PAY_NOTIFY_URL")
            .or_else(|| {
                read_trimmed("PUBLIC_BASE_URL").map(|base| {
                    format!("{}/api/payments/wechat/notify", base.trim_end_matches('/'))
                })
            })
            .ok_or_else(|| ApiError::BadRequest("缺少 WECHAT_PAY_NOTIFY_URL 配置".to_string()))?;

        Ok(Self {
            merchant,
            notify_url,
        })
    }
}

impl fmt::Display for PaymentProvider {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.as_str())
    }
}

#[cfg(test)]
mod tests {
    use super::{
        decrypt_wechat_notification, new_out_trade_no, validate_payable_order,
        with_wechat_json_headers, PayableOrderRow, PaymentBusinessType, PaymentProvider,
        WechatJsapiClientPayload, WECHAT_JSAPI_URL,
    };
    use crate::wechat_pay::WechatNotifyResource;

    #[test]
    fn provider_parser_reserves_future_channels() {
        assert_eq!(
            "wechat".parse::<PaymentProvider>().unwrap(),
            PaymentProvider::Wechat
        );
        assert_eq!(
            "alipay".parse::<PaymentProvider>().unwrap(),
            PaymentProvider::Alipay
        );
        assert_eq!(
            "douyin".parse::<PaymentProvider>().unwrap(),
            PaymentProvider::Douyin
        );
        assert!("bank".parse::<PaymentProvider>().is_err());
    }

    #[test]
    fn parses_group_buy_payment_business_types() {
        let deposit = "mall_group_buy_deposit"
            .parse::<PaymentBusinessType>()
            .unwrap();
        assert_eq!(deposit, PaymentBusinessType::MallGroupBuyDeposit);
        assert_eq!(deposit.as_str(), "mall_group_buy_deposit");

        let balance = "mall_group_buy_balance"
            .parse::<PaymentBusinessType>()
            .unwrap();
        assert_eq!(balance, PaymentBusinessType::MallGroupBuyBalance);
        assert_eq!(balance.as_str(), "mall_group_buy_balance");
    }

    #[test]
    fn group_buy_deposit_prepay_requires_open_activity_window() {
        let order = PayableOrderRow {
            id: "subscription-expired".to_string(),
            owner_user_id: Some("customer-1".to_string()),
            status: Some("pending_deposit".to_string()),
            payment_status: Some("pending".to_string()),
            commission_payment_status: None,
            fare_price: None,
            commission_amount: None,
            payable_cents: Some(500),
            cargo_name: Some("集采苹果".to_string()),
            group_buy_pay_window_open: Some(false),
            wechat_sub_mchid: None,
            platform_service_fee_cents: None,
            merchant_receivable_cents: None,
            profit_sharing_status: None,
        };

        let error = validate_payable_order(&order, PaymentBusinessType::MallGroupBuyDeposit)
            .expect_err("expired activity should not accept deposit prepay");

        assert!(format!("{error}").contains("认购已结束"));
    }

    #[test]
    fn out_trade_no_matches_wechat_length_limit() {
        let out_trade_no = new_out_trade_no();

        assert!(out_trade_no.len() >= 6);
        assert!(out_trade_no.len() <= 32);
        assert!(out_trade_no
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || "_-|*".contains(ch)));
    }

    #[test]
    fn wechat_client_payload_uses_jsapi_contract() {
        let payload = WechatJsapiClientPayload::new(
            "wx-test-app".to_string(),
            "1710000000".to_string(),
            "abc123".to_string(),
            "prepay_id=wx-prepay".to_string(),
            "signed-value".to_string(),
        );

        assert_eq!(payload.app_id, "wx-test-app");
        assert_eq!(payload.time_stamp, "1710000000");
        assert_eq!(payload.nonce_str, "abc123");
        assert_eq!(payload.package, "prepay_id=wx-prepay");
        assert_eq!(payload.sign_type, "RSA");
        assert_eq!(payload.pay_sign, "signed-value");
    }

    #[test]
    fn wechat_payment_requests_include_required_http_headers() {
        let request = with_wechat_json_headers(
            reqwest::Client::new().post(WECHAT_JSAPI_URL),
            "WECHATPAY2-SHA256-RSA2048 test",
        )
        .build()
        .unwrap();
        let headers = request.headers();

        assert_eq!(
            headers.get("authorization").unwrap().to_str().unwrap(),
            "WECHATPAY2-SHA256-RSA2048 test"
        );
        assert_eq!(
            headers.get("accept").unwrap().to_str().unwrap(),
            "application/json"
        );
        assert_eq!(
            headers.get("content-type").unwrap().to_str().unwrap(),
            "application/json"
        );
        assert!(headers
            .get("user-agent")
            .unwrap()
            .to_str()
            .unwrap()
            .contains("RecoRouter"));
    }

    #[test]
    fn wechat_notify_requires_aes_256_gcm_algorithm() {
        let resource = WechatNotifyResource {
            algorithm: "PLAINTEXT".to_string(),
            ciphertext: "ignored".to_string(),
            associated_data: None,
            nonce: "ignored".to_string(),
        };

        assert!(decrypt_wechat_notification::<serde_json::Value>(&resource).is_err());
    }
}
