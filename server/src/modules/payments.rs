use std::{
    fmt, fs,
    str::FromStr,
    time::{SystemTime, UNIX_EPOCH},
};

use aes_gcm::{
    aead::{Aead, Payload},
    Aes256Gcm, KeyInit, Nonce,
};
use axum::{
    extract::{Path, State},
    routing::post,
    Json, Router,
};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use rand::{distributions::Alphanumeric, rngs::OsRng, Rng};
use rsa::{
    pkcs1::DecodeRsaPrivateKey,
    pkcs1v15::SigningKey,
    pkcs8::DecodePrivateKey,
    signature::{RandomizedSigner, SignatureEncoding},
    RsaPrivateKey,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::Sha256;
use sqlx::{FromRow, PgPool};

use crate::{
    app::AppState,
    config::read_trimmed,
    error::{ApiError, ApiResult},
    response::{ok, ApiEnvelope},
    storage::Storage,
};

const DEFAULT_WECHAT_MCH_ID: &str = "1746295681";
const WECHAT_JSAPI_URL: &str = "https://api.mch.weixin.qq.com/v3/pay/transactions/jsapi";
const WECHAT_QUERY_URL_PREFIX: &str =
    "https://api.mch.weixin.qq.com/v3/pay/transactions/out-trade-no";
const WECHAT_CODE2SESSION_URL: &str = "https://api.weixin.qq.com/sns/jscode2session";
const WECHAT_USER_AGENT: &str = "RecoRouter/1.0";

pub fn router<S>() -> Router<AppState<S>>
where
    S: Storage,
{
    Router::new()
        .route("/api/payments/prepay", post(create_prepay::<S>))
        .route("/api/payments/:id/sync", post(sync_payment::<S>))
        .route("/api/payments/wechat/notify", post(wechat_notify::<S>))
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
enum PaymentMode {
    Live,
    Sandbox,
}

impl PaymentMode {
    fn as_str(self) -> &'static str {
        match self {
            Self::Live => "live",
            Self::Sandbox => "sandbox",
        }
    }
}

impl FromStr for PaymentMode {
    type Err = ApiError;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value.trim().to_ascii_lowercase().as_str() {
            "" | "live" | "production" | "prod" => Ok(Self::Live),
            "sandbox" | "mock" | "test" => Ok(Self::Sandbox),
            _ => Err(ApiError::BadRequest(
                "不支持的微信支付模式，必须为 live 或 sandbox".to_string(),
            )),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum PaymentBusinessType {
    OrderFare,
    OrderCommission,
}

impl PaymentBusinessType {
    fn as_str(self) -> &'static str {
        match self {
            Self::OrderFare => "order_fare",
            Self::OrderCommission => "order_commission",
        }
    }
}

impl FromStr for PaymentBusinessType {
    type Err = ApiError;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value.trim().to_ascii_lowercase().as_str() {
            "" | "order_fare" | "fare" => Ok(Self::OrderFare),
            "order_commission" | "commission" => Ok(Self::OrderCommission),
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
    payment_mode: String,
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
    status: Option<String>,
    payment_status: Option<String>,
    commission_payment_status: Option<String>,
    fare_price: Option<f64>,
    commission_amount: Option<f64>,
    cargo_name: Option<String>,
}

#[derive(Debug, FromRow)]
struct PaymentRow {
    id: String,
    provider: String,
    business_type: String,
    business_id: String,
    out_trade_no: String,
    provider_prepay_id: Option<String>,
    status: String,
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
struct Code2SessionResponse {
    openid: Option<String>,
    errcode: Option<i64>,
    errmsg: Option<String>,
}

#[derive(Debug, Deserialize)]
struct WechatNotifyBody {
    resource: WechatNotifyResource,
}

#[derive(Debug, Deserialize)]
struct WechatNotifyResource {
    algorithm: String,
    ciphertext: String,
    associated_data: Option<String>,
    nonce: String,
}

#[derive(Debug, Deserialize)]
struct WechatNotifyTransaction {
    out_trade_no: String,
    trade_state: String,
    transaction_id: Option<String>,
}

struct WechatPayConfig {
    mode: PaymentMode,
    app_id: String,
    mch_id: String,
    mch_serial_no: Option<String>,
    private_key: Option<RsaPrivateKey>,
    notify_url: String,
    miniapp_secret: Option<String>,
}

async fn create_prepay<S>(
    State(state): State<AppState<S>>,
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
    let order = fetch_payable_order(&state.db, &body.order_id).await?;
    let amount_cents = payable_amount_cents(&order, business_type)?;

    validate_payable_order(&order, business_type)?;

    let out_trade_no = new_out_trade_no();
    let payment_id = insert_payment(
        &state.db,
        InsertPayment {
            business_type,
            order_id: &order.id,
            payer_id: body.payer_id.as_deref(),
            provider,
            out_trade_no: &out_trade_no,
            amount_cents,
        },
    )
    .await?;

    let payment_mode: PaymentMode;
    let client_payload = match provider {
        PaymentProvider::Wechat => {
            let config = WechatPayConfig::from_env()?;
            payment_mode = config.mode;
            if config.mode == PaymentMode::Sandbox {
                let prepay_id = sandbox_prepay_id(&out_trade_no);
                let payload_value =
                    build_sandbox_client_payload(&payment_id, &out_trade_no, amount_cents);
                update_payment_prepay(&state.db, &payment_id, &prepay_id, &payload_value).await?;
                payload_value
            } else {
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
                update_payment_prepay(&state.db, &payment_id, &prepay_id, &payload_value).await?;
                payload_value
            }
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
            payment_mode: payment_mode.as_str().to_string(),
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
    Path(id): Path<String>,
) -> ApiResult<Json<ApiEnvelope<SyncPaymentResponse>>>
where
    S: Storage,
{
    let payment = fetch_payment(&state.db, &id).await?;
    let provider = payment.provider.parse::<PaymentProvider>()?;
    let business_type = payment.business_type.parse::<PaymentBusinessType>()?;

    match provider {
        PaymentProvider::Wechat => {
            if is_sandbox_payment(&payment) {
                let transaction_id = sandbox_transaction_id(&payment.out_trade_no);
                mark_payment_success(&state.db, &payment, business_type, Some(&transaction_id))
                    .await?;
            } else {
                let config = WechatPayConfig::from_env()?;
                let state_result = wechat_query_order(&config, &payment.out_trade_no).await?;
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
        }
        PaymentProvider::Alipay | PaymentProvider::Douyin => {
            return Err(ApiError::BadRequest(
                "该支付渠道尚未实现主动查单".to_string(),
            ));
        }
    }

    let refreshed = fetch_payment(&state.db, &id).await?;
    let order = fetch_payable_order(&state.db, &refreshed.business_id).await?;
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
    Json(body): Json<WechatNotifyBody>,
) -> ApiResult<Json<Value>>
where
    S: Storage,
{
    let transaction = decrypt_wechat_notification(&body.resource)?;
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

struct InsertPayment<'a> {
    business_type: PaymentBusinessType,
    order_id: &'a str,
    payer_id: Option<&'a str>,
    provider: PaymentProvider,
    out_trade_no: &'a str,
    amount_cents: i64,
}

async fn insert_payment(pool: &PgPool, payment: InsertPayment<'_>) -> ApiResult<String> {
    let id: String = sqlx::query_scalar(
        r#"
        INSERT INTO payments (
            business_type, business_id, payer_id, provider, out_trade_no,
            amount_cents, currency, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'CNY', 'pending')
        RETURNING id
        "#,
    )
    .bind(payment.business_type.as_str())
    .bind(payment.order_id)
    .bind(payment.payer_id)
    .bind(payment.provider.as_str())
    .bind(payment.out_trade_no)
    .bind(payment.amount_cents)
    .fetch_one(pool)
    .await?;

    Ok(id)
}

async fn update_payment_prepay(
    pool: &PgPool,
    payment_id: &str,
    prepay_id: &str,
    payload: &Value,
) -> ApiResult<()> {
    sqlx::query(
        r#"
        UPDATE payments
        SET provider_prepay_id = $2,
            client_payload = $3,
            updated_at = now()
        WHERE id = $1
        "#,
    )
    .bind(payment_id)
    .bind(prepay_id)
    .bind(payload)
    .execute(pool)
    .await?;

    Ok(())
}

async fn fetch_payable_order(pool: &PgPool, order_id: &str) -> ApiResult<PayableOrderRow> {
    sqlx::query_as::<_, PayableOrderRow>(
        r#"
        SELECT
            o.id,
            o.status,
            o.payment_status,
            o.commission_payment_status,
            o.fare_price::float8 AS fare_price,
            o.commission_amount::float8 AS commission_amount,
            d.cargo_name
        FROM orders o
        LEFT JOIN demands d ON d.id = o.demand_id
        WHERE o.id = $1
        "#,
    )
    .bind(order_id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| ApiError::NotFound("订单不存在".to_string()))
}

async fn fetch_payment(pool: &PgPool, payment_id: &str) -> ApiResult<PaymentRow> {
    sqlx::query_as::<_, PaymentRow>(
        r#"
        SELECT id, provider, business_type, business_id, out_trade_no, provider_prepay_id, status
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
        SELECT id, provider, business_type, business_id, out_trade_no, provider_prepay_id, status
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
            paid_at = now(),
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
            sqlx::query(
                r#"
                UPDATE orders
                SET payment_status = 'paid',
                    payment_time = now(),
                    updated_at = now()
                WHERE id = $1
                "#,
            )
            .bind(&payment.business_id)
            .execute(pool)
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
    }

    Ok(())
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
    let secret = config
        .miniapp_secret
        .as_deref()
        .ok_or_else(|| ApiError::BadRequest("缺少 WECHAT_MINIAPP_SECRET 配置".to_string()))?;
    let url = format!(
        "{WECHAT_CODE2SESSION_URL}?appid={}&secret={}&js_code={}&grant_type=authorization_code",
        config.app_id, secret, login_code
    );
    let text = reqwest::get(url)
        .await
        .map_err(|err| ApiError::BadRequest(format!("微信登录凭证换取失败: {err}")))?
        .text()
        .await
        .map_err(|err| ApiError::BadRequest(format!("微信登录响应读取失败: {err}")))?;
    let response: Code2SessionResponse = serde_json::from_str(&text)
        .map_err(|err| ApiError::BadRequest(format!("微信登录响应解析失败: {err}")))?;
    response.openid.ok_or_else(|| {
        ApiError::BadRequest(format!(
            "微信登录凭证无效: {}",
            response
                .errmsg
                .unwrap_or_else(|| response.errcode.unwrap_or_default().to_string())
        ))
    })
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
    };
    let description = truncate_chars(&description, 127);
    let body = json!({
        "appid": config.app_id,
        "mchid": config.mch_id,
        "description": description,
        "out_trade_no": out_trade_no,
        "notify_url": config.notify_url,
        "amount": {
            "total": amount_cents,
            "currency": "CNY"
        },
        "payer": {
            "openid": openid
        }
    })
    .to_string();
    let authorization = wechat_authorization(config, "POST", "/v3/pay/transactions/jsapi", &body)?;
    let response = with_wechat_json_headers(
        reqwest::Client::new().post(WECHAT_JSAPI_URL),
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
    out_trade_no: &str,
) -> ApiResult<WechatQueryResponse> {
    let path = format!(
        "/v3/pay/transactions/out-trade-no/{out_trade_no}?mchid={}",
        config.mch_id
    );
    let authorization = wechat_authorization(config, "GET", &path, "")?;
    let url = format!(
        "{WECHAT_QUERY_URL_PREFIX}/{out_trade_no}?mchid={}",
        config.mch_id
    );
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

fn with_wechat_headers(
    builder: reqwest::RequestBuilder,
    authorization: &str,
) -> reqwest::RequestBuilder {
    builder
        .header("Authorization", authorization)
        .header("Accept", "application/json")
        .header("User-Agent", WECHAT_USER_AGENT)
}

fn with_wechat_json_headers(
    builder: reqwest::RequestBuilder,
    authorization: &str,
) -> reqwest::RequestBuilder {
    with_wechat_headers(builder, authorization).header("Content-Type", "application/json")
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
        config.app_id, time_stamp, nonce_str, package
    );
    let pay_sign = sign_message(config.private_key()?, &message)?;

    Ok(WechatJsapiClientPayload::new(
        config.app_id.clone(),
        time_stamp,
        nonce_str,
        package,
        pay_sign,
    ))
}

fn wechat_authorization(
    config: &WechatPayConfig,
    method: &str,
    path_and_query: &str,
    body: &str,
) -> ApiResult<String> {
    let timestamp = unix_timestamp().to_string();
    let nonce_str = random_token(24);
    let message = format!("{method}\n{path_and_query}\n{timestamp}\n{nonce_str}\n{body}\n");
    let signature = sign_message(config.private_key()?, &message)?;

    Ok(format!(
        "WECHATPAY2-SHA256-RSA2048 mchid=\"{}\",nonce_str=\"{}\",signature=\"{}\",timestamp=\"{}\",serial_no=\"{}\"",
        config.mch_id, nonce_str, signature, timestamp, config.mch_serial_no()?
    ))
}

fn build_sandbox_client_payload(payment_id: &str, out_trade_no: &str, amount_cents: i64) -> Value {
    json!({
        "mode": "sandbox",
        "sandbox": true,
        "paymentId": payment_id,
        "outTradeNo": out_trade_no,
        "amountCents": amount_cents,
        "message": "沙箱支付不会真实扣款，确认后仅模拟支付成功"
    })
}

fn sandbox_prepay_id(out_trade_no: &str) -> String {
    format!("sandbox_{out_trade_no}")
}

fn sandbox_transaction_id(out_trade_no: &str) -> String {
    format!("sandbox_txn_{out_trade_no}")
}

fn is_sandbox_payment(payment: &PaymentRow) -> bool {
    payment
        .provider_prepay_id
        .as_deref()
        .is_some_and(|prepay_id| prepay_id.starts_with("sandbox_"))
}

fn sign_message(private_key: &RsaPrivateKey, message: &str) -> ApiResult<String> {
    let signing_key = SigningKey::<Sha256>::new(private_key.clone());
    let signature = signing_key.sign_with_rng(&mut OsRng, message.as_bytes());
    Ok(BASE64.encode(signature.to_bytes()))
}

fn decrypt_wechat_notification(
    resource: &WechatNotifyResource,
) -> ApiResult<WechatNotifyTransaction> {
    if resource.algorithm != "AEAD_AES_256_GCM" {
        return Err(ApiError::BadRequest(
            "微信支付通知加密算法不支持".to_string(),
        ));
    }

    let api_v3_key = read_trimmed("WECHAT_PAY_API_V3_KEY")
        .ok_or_else(|| ApiError::BadRequest("缺少 WECHAT_PAY_API_V3_KEY 配置".to_string()))?;
    if api_v3_key.as_bytes().len() != 32 {
        return Err(ApiError::BadRequest(
            "WECHAT_PAY_API_V3_KEY 必须为32字节".to_string(),
        ));
    }
    if resource.nonce.as_bytes().len() != 12 {
        return Err(ApiError::BadRequest("微信支付通知 nonce 无效".to_string()));
    }

    let ciphertext = BASE64
        .decode(resource.ciphertext.as_bytes())
        .map_err(|err| ApiError::BadRequest(format!("微信支付通知密文解析失败: {err}")))?;
    let cipher = Aes256Gcm::new_from_slice(api_v3_key.as_bytes())
        .map_err(|err| ApiError::BadRequest(format!("微信支付通知密钥无效: {err}")))?;
    let plaintext = cipher
        .decrypt(
            Nonce::from_slice(resource.nonce.as_bytes()),
            Payload {
                msg: &ciphertext,
                aad: resource
                    .associated_data
                    .as_deref()
                    .unwrap_or_default()
                    .as_bytes(),
            },
        )
        .map_err(|_| ApiError::BadRequest("微信支付通知解密失败".to_string()))?;

    serde_json::from_slice(&plaintext)
        .map_err(|err| ApiError::BadRequest(format!("微信支付通知内容解析失败: {err}")))
}

fn new_out_trade_no() -> String {
    format!("RR{}{}", unix_timestamp_millis(), random_token(6))
}

fn random_token(len: usize) -> String {
    rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(len)
        .map(char::from)
        .collect()
}

fn unix_timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

fn unix_timestamp_millis() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
}

fn truncate_chars(value: &str, max_chars: usize) -> String {
    value.chars().take(max_chars).collect()
}

impl WechatPayConfig {
    fn from_env() -> ApiResult<Self> {
        let mode = read_trimmed("WECHAT_PAY_MODE")
            .or_else(|| read_trimmed("PAYMENT_MODE"))
            .unwrap_or_else(|| "live".to_string())
            .parse::<PaymentMode>()?;
        let app_id = read_trimmed("WECHAT_PAY_APPID")
            .or_else(|| read_trimmed("WECHAT_MINIAPP_APPID"))
            .or_else(|| (mode == PaymentMode::Sandbox).then(|| "sandbox-miniapp".to_string()))
            .ok_or_else(|| ApiError::BadRequest("缺少 WECHAT_PAY_APPID 配置".to_string()))?;
        let mch_id =
            read_trimmed("WECHAT_PAY_MCH_ID").unwrap_or_else(|| DEFAULT_WECHAT_MCH_ID.to_string());
        let mch_serial_no = read_trimmed("WECHAT_PAY_MCH_SERIAL_NO");
        let private_key = if mode == PaymentMode::Live {
            Some(load_wechat_private_key()?)
        } else {
            None
        };
        let notify_url = read_trimmed("WECHAT_PAY_NOTIFY_URL")
            .or_else(|| {
                read_trimmed("PUBLIC_BASE_URL").map(|base| {
                    format!("{}/api/payments/wechat/notify", base.trim_end_matches('/'))
                })
            })
            .or_else(|| {
                (mode == PaymentMode::Sandbox)
                    .then(|| "https://sandbox.local/api/payments/wechat/notify".to_string())
            })
            .ok_or_else(|| ApiError::BadRequest("缺少 WECHAT_PAY_NOTIFY_URL 配置".to_string()))?;
        if mode == PaymentMode::Live && mch_serial_no.is_none() {
            return Err(ApiError::BadRequest(
                "缺少 WECHAT_PAY_MCH_SERIAL_NO 配置".to_string(),
            ));
        }

        Ok(Self {
            mode,
            app_id,
            mch_id,
            mch_serial_no,
            private_key,
            notify_url,
            miniapp_secret: read_trimmed("WECHAT_MINIAPP_SECRET"),
        })
    }

    fn mch_serial_no(&self) -> ApiResult<&str> {
        self.mch_serial_no
            .as_deref()
            .ok_or_else(|| ApiError::BadRequest("缺少 WECHAT_PAY_MCH_SERIAL_NO 配置".to_string()))
    }

    fn private_key(&self) -> ApiResult<&RsaPrivateKey> {
        self.private_key
            .as_ref()
            .ok_or_else(|| ApiError::BadRequest("缺少微信支付私钥配置".to_string()))
    }
}

fn load_wechat_private_key() -> ApiResult<RsaPrivateKey> {
    let pem = if let Some(value) = read_trimmed("WECHAT_PAY_PRIVATE_KEY") {
        value.replace("\\n", "\n")
    } else if let Some(path) = read_trimmed("WECHAT_PAY_PRIVATE_KEY_PATH") {
        fs::read_to_string(path)
            .map_err(|err| ApiError::BadRequest(format!("读取微信支付私钥失败: {err}")))?
    } else {
        return Err(ApiError::BadRequest(
            "缺少 WECHAT_PAY_PRIVATE_KEY 或 WECHAT_PAY_PRIVATE_KEY_PATH 配置".to_string(),
        ));
    };

    RsaPrivateKey::from_pkcs8_pem(&pem)
        .or_else(|_| RsaPrivateKey::from_pkcs1_pem(&pem))
        .map_err(|err| ApiError::BadRequest(format!("微信支付私钥格式不正确: {err}")))
}

impl fmt::Display for PaymentProvider {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.as_str())
    }
}

#[cfg(test)]
mod tests {
    use super::{
        build_sandbox_client_payload, decrypt_wechat_notification, new_out_trade_no,
        with_wechat_json_headers, PaymentMode, PaymentProvider, WechatJsapiClientPayload,
        WechatNotifyResource, WECHAT_JSAPI_URL,
    };

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
    fn payment_mode_parser_supports_sandbox_without_real_pay() {
        assert_eq!("".parse::<PaymentMode>().unwrap(), PaymentMode::Live);
        assert_eq!("live".parse::<PaymentMode>().unwrap(), PaymentMode::Live);
        assert_eq!(
            "sandbox".parse::<PaymentMode>().unwrap(),
            PaymentMode::Sandbox
        );
        assert_eq!("mock".parse::<PaymentMode>().unwrap(), PaymentMode::Sandbox);
        assert!("prod-sandbox".parse::<PaymentMode>().is_err());
    }

    #[test]
    fn sandbox_client_payload_is_explicitly_non_wechat_payment() {
        let payload = build_sandbox_client_payload("pay-1", "RR123", 1);

        assert_eq!(payload["mode"], "sandbox");
        assert_eq!(payload["sandbox"], true);
        assert_eq!(payload["paymentId"], "pay-1");
        assert_eq!(payload["outTradeNo"], "RR123");
        assert_eq!(payload["amountCents"], 1);
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

        assert!(decrypt_wechat_notification(&resource).is_err());
    }
}
