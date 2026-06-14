use std::collections::HashMap;

use axum::{
    extract::{Path, Query, State},
    routing::{get, post},
    Json, Router,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::{FromRow, PgPool, Postgres, QueryBuilder};

use crate::{
    app::AppState,
    config::read_trimmed,
    error::{ApiError, ApiResult},
    response::{ok, ApiEnvelope},
    storage::Storage,
    wechat_pay::{
        decrypt_wechat_notification, exchange_miniapp_login_code, random_token, truncate_chars,
        unix_timestamp_millis, wechat_authorization, with_wechat_headers, with_wechat_json_headers,
        WechatNotifyBody, WechatPayMerchantConfig,
    },
};

const WECHAT_TRANSFER_BILLS_URL: &str =
    "https://api.mch.weixin.qq.com/v3/fund-app/mch-transfer/transfer-bills";
const WECHAT_TRANSFER_QUERY_URL_PREFIX: &str =
    "https://api.mch.weixin.qq.com/v3/fund-app/mch-transfer/transfer-bills/out-bill-no";

pub fn router<S>() -> Router<AppState<S>>
where
    S: Storage,
{
    Router::new()
        .route("/api/owner-wallet/:owner_id", get(owner_wallet::<S>))
        .route("/api/owner-wallet/bind-wechat", post(bind_wechat::<S>))
        .route(
            "/api/owner-wallet/withdrawals",
            post(create_withdrawal::<S>),
        )
        .route(
            "/api/owner-wallet/withdrawals/:id/sync",
            post(sync_withdrawal::<S>),
        )
        .route(
            "/api/owner-wallet/wechat-transfer/notify",
            post(wechat_transfer_notify::<S>),
        )
}

pub fn admin_router<S>() -> Router<AppState<S>>
where
    S: Storage,
{
    Router::new()
        .route("/api/admin/owner-withdrawals", get(admin_withdrawals::<S>))
        .route(
            "/api/admin/owner-withdrawals/:id/manual-complete",
            post(admin_manual_complete::<S>),
        )
        .route(
            "/api/admin/owner-withdrawals/:id/manual-fail",
            post(admin_manual_fail::<S>),
        )
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct OwnerWalletResponse {
    owner_id: String,
    summary: WalletSummary,
    wechat_account: WechatAccountSummary,
    transfer_availability: TransferAvailability,
    ledger_entries: Vec<LedgerEntry>,
    withdrawals: Vec<WithdrawalRow>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct WalletSummary {
    available_balance_cents: i64,
    withdrawing_balance_cents: i64,
    withdrawn_balance_cents: i64,
    lifetime_income_cents: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct WechatAccountSummary {
    bound: bool,
    appid: Option<String>,
    status: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct TransferAvailability {
    enabled: bool,
    ready: bool,
    mode: String,
    reason: Option<String>,
    appid: Option<String>,
    mch_id: Option<String>,
    min_amount_cents: i64,
    max_amount_cents: i64,
}

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
struct LedgerEntry {
    id: String,
    owner_id: String,
    order_id: Option<String>,
    withdrawal_id: Option<String>,
    entry_type: String,
    amount_cents: i64,
    status: String,
    description: Option<String>,
    metadata: Value,
    created_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, FromRow, Clone)]
#[serde(rename_all = "camelCase")]
struct WithdrawalRow {
    id: String,
    owner_id: String,
    provider: String,
    amount_cents: i64,
    status: String,
    out_bill_no: String,
    transfer_bill_no: Option<String>,
    package_info: Option<String>,
    wechat_state: Option<String>,
    fail_reason: Option<String>,
    manual_note: Option<String>,
    provider_payload: Value,
    created_at: Option<DateTime<Utc>>,
    updated_at: Option<DateTime<Utc>>,
    completed_at: Option<DateTime<Utc>>,
}

#[derive(Debug, FromRow)]
struct WechatAccountRow {
    appid: String,
    openid: String,
    status: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BindWechatRequest {
    owner_id: String,
    login_code: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateWithdrawalRequest {
    owner_id: String,
    amount_cents: i64,
    provider: Option<String>,
}

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct ManualWithdrawalRequest {
    note: Option<String>,
    reason: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct WithdrawalActionResponse {
    withdrawal: WithdrawalRow,
    summary: WalletSummary,
    transfer_payload: Option<MerchantTransferPayload>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct MerchantTransferPayload {
    mch_id: String,
    app_id: String,
    package: String,
}

struct WechatTransferConfig {
    merchant: WechatPayMerchantConfig,
    scene_id: String,
    notify_url: String,
    recv_perception: String,
    scene_report_infos: Vec<TransferSceneReportInfo>,
    min_amount_cents: i64,
    max_amount_cents: i64,
}

#[derive(Debug, Serialize)]
struct TransferSceneReportInfo {
    info_type: String,
    info_content: String,
}

#[derive(Debug, Deserialize)]
struct WechatTransferResponse {
    #[serde(rename = "out_bill_no")]
    _out_bill_no: String,
    transfer_bill_no: Option<String>,
    state: String,
    package_info: Option<String>,
}

#[derive(Debug, Deserialize)]
struct WechatTransferNotification {
    out_bill_no: String,
    transfer_bill_no: Option<String>,
    state: String,
    fail_reason: Option<String>,
}

enum TransferStartResult {
    Started(WechatTransferResponse),
    ManualFallback(String),
    PendingRetry(String),
    PendingSync(String),
}

async fn owner_wallet<S>(
    State(state): State<AppState<S>>,
    Path(owner_id): Path<String>,
) -> ApiResult<Json<ApiEnvelope<OwnerWalletResponse>>>
where
    S: Storage,
{
    Ok(ok("查询成功", load_wallet(&state.db, &owner_id).await?))
}

async fn bind_wechat<S>(
    State(state): State<AppState<S>>,
    Json(body): Json<BindWechatRequest>,
) -> ApiResult<Json<ApiEnvelope<OwnerWalletResponse>>>
where
    S: Storage,
{
    let merchant = WechatPayMerchantConfig::from_env_for_service(state.service)?;
    let openid = exchange_miniapp_login_code(&merchant, &body.login_code).await?;

    sqlx::query(
        r#"
        INSERT INTO owner_wallet_accounts (owner_id, provider, appid, openid, status, updated_at)
        VALUES ($1, 'wechat', $2, $3, 'active', now())
        ON CONFLICT (owner_id, provider, appid) WHERE status = 'active'
        DO UPDATE SET openid = EXCLUDED.openid, updated_at = now()
        "#,
    )
    .bind(&body.owner_id)
    .bind(&merchant.app_id)
    .bind(openid)
    .execute(&state.db)
    .await?;

    Ok(ok(
        "微信收款账号已绑定",
        load_wallet(&state.db, &body.owner_id).await?,
    ))
}

async fn create_withdrawal<S>(
    State(state): State<AppState<S>>,
    Json(body): Json<CreateWithdrawalRequest>,
) -> ApiResult<Json<ApiEnvelope<WithdrawalActionResponse>>>
where
    S: Storage,
{
    let owner_id = body.owner_id.trim().to_string();
    if owner_id.is_empty() {
        return Err(ApiError::BadRequest("缺少运力方账号".to_string()));
    }
    if body.amount_cents <= 0 {
        return Err(ApiError::BadRequest("提现金额必须大于0".to_string()));
    }

    let transfer_config = WechatTransferConfig::from_env();
    let force_manual = body.provider.as_deref() == Some("manual");
    let auto_ready = transfer_config.is_ok() && !force_manual;
    let limits = transfer_limits()?;
    let config_ref = transfer_config.as_ref().ok();
    let min_amount_cents = config_ref
        .map(|config| config.min_amount_cents)
        .unwrap_or(limits.0);
    let max_amount_cents = config_ref
        .map(|config| config.max_amount_cents)
        .unwrap_or(limits.1);

    if body.amount_cents < min_amount_cents {
        return Err(ApiError::BadRequest(format!(
            "单笔提现不能低于¥{:.2}",
            min_amount_cents as f64 / 100.0
        )));
    }
    if body.amount_cents > max_amount_cents {
        return Err(ApiError::BadRequest(format!(
            "单笔提现不能超过¥{:.2}",
            max_amount_cents as f64 / 100.0
        )));
    }
    if body.amount_cents >= 200_000 {
        return Err(ApiError::BadRequest(
            "单笔达到2000元需接入微信实名校验加密后再提现".to_string(),
        ));
    }

    let account = if let Some(config) = config_ref.filter(|_| auto_ready) {
        fetch_active_wechat_account(&state.db, &owner_id, &config.merchant.app_id).await?
    } else {
        None
    };
    if auto_ready && account.is_none() {
        return Err(ApiError::BadRequest("请先绑定微信收款账号".to_string()));
    }

    let provider = if auto_ready { "wechat" } else { "manual" };
    let status = if auto_ready {
        "transferring"
    } else {
        "pending_manual"
    };
    let out_bill_no = new_out_bill_no();
    let fail_reason = if auto_ready {
        None
    } else {
        Some(manual_fallback_reason(transfer_config.as_ref().err()))
    };

    let withdrawal_id = reserve_withdrawal(
        &state.db,
        &owner_id,
        provider,
        status,
        &out_bill_no,
        body.amount_cents,
        fail_reason.as_deref(),
    )
    .await?;

    if let (Some(config), Some(account)) = (config_ref, account.as_ref()) {
        match wechat_create_transfer_bill(
            config,
            &withdrawal_id,
            &out_bill_no,
            body.amount_cents,
            account,
        )
        .await?
        {
            TransferStartResult::Started(response) => {
                apply_wechat_transfer_state(
                    &state.db,
                    &out_bill_no,
                    &response.state,
                    response.transfer_bill_no.as_deref(),
                    response.package_info.as_deref(),
                    None,
                )
                .await?;
            }
            TransferStartResult::ManualFallback(reason) => {
                mark_withdrawal_manual_fallback(&state.db, &withdrawal_id, &reason).await?;
            }
            TransferStartResult::PendingRetry(reason) => {
                mark_withdrawal_pending_retry(&state.db, &withdrawal_id, &reason).await?;
            }
            TransferStartResult::PendingSync(reason) => {
                update_withdrawal_failure_note(&state.db, &withdrawal_id, &reason).await?;
            }
        }
    }

    Ok(ok(
        "提现申请已提交",
        withdrawal_action_response(&state.db, &owner_id, &withdrawal_id).await?,
    ))
}

async fn sync_withdrawal<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
) -> ApiResult<Json<ApiEnvelope<WithdrawalActionResponse>>>
where
    S: Storage,
{
    let withdrawal = fetch_withdrawal(&state.db, &id).await?;
    if withdrawal.provider == "wechat" && !is_local_terminal_status(&withdrawal.status) {
        if let Ok(config) = WechatTransferConfig::from_env() {
            if should_retry_transfer_create(&withdrawal) {
                retry_wechat_transfer_bill(&state.db, &config, &withdrawal).await?;
            } else {
                if let Ok(response) =
                    wechat_query_transfer_bill(&config, &withdrawal.out_bill_no).await
                {
                    apply_wechat_transfer_state(
                        &state.db,
                        &withdrawal.out_bill_no,
                        &response.state,
                        response.transfer_bill_no.as_deref(),
                        response.package_info.as_deref(),
                        None,
                    )
                    .await?;
                }
            }
        }
    }

    Ok(ok(
        "提现状态已同步",
        withdrawal_action_response(&state.db, &withdrawal.owner_id, &id).await?,
    ))
}

async fn wechat_transfer_notify<S>(
    State(state): State<AppState<S>>,
    Json(body): Json<WechatNotifyBody>,
) -> ApiResult<Json<Value>>
where
    S: Storage,
{
    let notification = decrypt_wechat_notification::<WechatTransferNotification>(&body.resource)?;
    apply_wechat_transfer_state(
        &state.db,
        &notification.out_bill_no,
        &notification.state,
        notification.transfer_bill_no.as_deref(),
        None,
        notification.fail_reason.as_deref(),
    )
    .await?;

    Ok(Json(json!({ "code": "SUCCESS", "message": "成功" })))
}

async fn admin_withdrawals<S>(
    State(state): State<AppState<S>>,
    Query(params): Query<HashMap<String, String>>,
) -> ApiResult<Json<ApiEnvelope<Vec<WithdrawalRow>>>>
where
    S: Storage,
{
    let mut builder = QueryBuilder::<Postgres>::new(
        r#"
        SELECT id, owner_id, provider, amount_cents, status, out_bill_no,
               transfer_bill_no, package_info, wechat_state, fail_reason, manual_note,
               provider_payload, created_at, updated_at, completed_at
        FROM owner_withdrawals
        "#,
    );
    let mut has_where = false;
    if let Some(status) = non_empty_param(&params, "status") {
        push_where(&mut builder, &mut has_where);
        builder.push("status = ");
        builder.push_bind(status);
    }
    if let Some(owner_id) = non_empty_param(&params, "owner_id") {
        push_where(&mut builder, &mut has_where);
        builder.push("owner_id = ");
        builder.push_bind(owner_id);
    }
    builder.push(" ORDER BY created_at DESC LIMIT 100");

    let rows = builder
        .build_query_as::<WithdrawalRow>()
        .fetch_all(&state.db)
        .await?;
    Ok(ok("查询成功", rows))
}

async fn admin_manual_complete<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
    body: Option<Json<ManualWithdrawalRequest>>,
) -> ApiResult<Json<ApiEnvelope<WithdrawalActionResponse>>>
where
    S: Storage,
{
    let body = body.map(|Json(body)| body).unwrap_or_default();
    let withdrawal = fetch_withdrawal(&state.db, &id).await?;
    if withdrawal.status != "pending_manual" {
        return Err(ApiError::BadRequest(
            "只有人工处理中提现可以标记已打款".to_string(),
        ));
    }

    sqlx::query(
        r#"
        UPDATE owner_withdrawals
        SET status = 'success',
            manual_note = COALESCE($2, manual_note),
            completed_at = now(),
            updated_at = now()
        WHERE id = $1
        "#,
    )
    .bind(&id)
    .bind(body.note)
    .execute(&state.db)
    .await?;

    Ok(ok(
        "已标记人工打款成功",
        withdrawal_action_response(&state.db, &withdrawal.owner_id, &id).await?,
    ))
}

async fn admin_manual_fail<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
    body: Option<Json<ManualWithdrawalRequest>>,
) -> ApiResult<Json<ApiEnvelope<WithdrawalActionResponse>>>
where
    S: Storage,
{
    let body = body.map(|Json(body)| body).unwrap_or_default();
    let withdrawal = fetch_withdrawal(&state.db, &id).await?;
    if !["pending_manual", "transferring", "waiting_user_confirm"]
        .contains(&withdrawal.status.as_str())
    {
        return Err(ApiError::BadRequest("当前提现状态不能标记失败".to_string()));
    }

    sqlx::query(
        r#"
        UPDATE owner_withdrawals
        SET status = 'failed',
            fail_reason = COALESCE($2, fail_reason),
            manual_note = COALESCE($3, manual_note),
            completed_at = now(),
            updated_at = now()
        WHERE id = $1
        "#,
    )
    .bind(&id)
    .bind(body.reason)
    .bind(body.note)
    .execute(&state.db)
    .await?;
    release_withdrawal_hold(&state.db, &withdrawal).await?;

    Ok(ok(
        "已标记提现失败并释放余额",
        withdrawal_action_response(&state.db, &withdrawal.owner_id, &id).await?,
    ))
}

pub async fn credit_completed_order_income(pool: &PgPool, order_id: &str) -> ApiResult<()> {
    let row = sqlx::query_as::<_, CompletedOrderIncomeRow>(
        r#"
        SELECT o.id,
               o.owner_id,
               o.status,
               o.payment_status,
               o.fare_price::float8 AS fare_price,
               d.cargo_name
        FROM orders o
        LEFT JOIN demands d ON d.id = o.demand_id
        WHERE o.id = $1
        "#,
    )
    .bind(order_id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| ApiError::NotFound("订单不存在".to_string()))?;

    if row.status.as_deref() != Some("completed")
        || row.payment_status.as_deref() != Some("paid")
        || row
            .owner_id
            .as_deref()
            .unwrap_or_default()
            .trim()
            .is_empty()
    {
        return Ok(());
    }
    let amount_cents = money_to_cents(row.fare_price);
    if amount_cents <= 0 {
        return Ok(());
    }

    sqlx::query(
        r#"
        INSERT INTO owner_wallet_ledger_entries (
            owner_id, order_id, entry_type, amount_cents, status, description, metadata
        )
        VALUES ($1, $2, 'fare_credit', $3, 'posted', $4, $5)
        ON CONFLICT DO NOTHING
        "#,
    )
    .bind(row.owner_id.unwrap_or_default())
    .bind(row.id)
    .bind(amount_cents)
    .bind("订单运费收入")
    .bind(json!({ "cargoName": row.cargo_name }))
    .execute(pool)
    .await?;

    Ok(())
}

#[derive(Debug, FromRow)]
struct CompletedOrderIncomeRow {
    id: String,
    owner_id: Option<String>,
    status: Option<String>,
    payment_status: Option<String>,
    fare_price: Option<f64>,
    cargo_name: Option<String>,
}

async fn load_wallet(pool: &PgPool, owner_id: &str) -> ApiResult<OwnerWalletResponse> {
    let summary = load_wallet_summary(pool, owner_id).await?;
    let account = fetch_any_wechat_account(pool, owner_id).await?;
    let ledger_entries = fetch_ledger_entries(pool, owner_id).await?;
    let withdrawals = fetch_owner_withdrawals(pool, owner_id).await?;
    let transfer_availability = transfer_availability();

    Ok(OwnerWalletResponse {
        owner_id: owner_id.to_string(),
        summary,
        wechat_account: WechatAccountSummary {
            bound: account.is_some(),
            appid: account.as_ref().map(|row| row.appid.clone()),
            status: account.map(|row| row.status),
        },
        transfer_availability,
        ledger_entries,
        withdrawals,
    })
}

async fn load_wallet_summary(pool: &PgPool, owner_id: &str) -> ApiResult<WalletSummary> {
    let available_balance_cents: i64 = sqlx::query_scalar(
        r#"
        SELECT COALESCE(SUM(amount_cents), 0)::bigint
        FROM owner_wallet_ledger_entries
        WHERE owner_id = $1 AND status = 'posted'
        "#,
    )
    .bind(owner_id)
    .fetch_one(pool)
    .await?;
    let withdrawing_balance_cents: i64 = sqlx::query_scalar(
        r#"
        SELECT COALESCE(SUM(amount_cents), 0)::bigint
        FROM owner_withdrawals
        WHERE owner_id = $1
          AND status IN ('pending_manual', 'pending_retry', 'waiting_user_confirm', 'transferring')
        "#,
    )
    .bind(owner_id)
    .fetch_one(pool)
    .await?;
    let withdrawn_balance_cents: i64 = sqlx::query_scalar(
        r#"
        SELECT COALESCE(SUM(amount_cents), 0)::bigint
        FROM owner_withdrawals
        WHERE owner_id = $1 AND status = 'success'
        "#,
    )
    .bind(owner_id)
    .fetch_one(pool)
    .await?;
    let lifetime_income_cents: i64 = sqlx::query_scalar(
        r#"
        SELECT COALESCE(SUM(amount_cents), 0)::bigint
        FROM owner_wallet_ledger_entries
        WHERE owner_id = $1 AND entry_type = 'fare_credit' AND status = 'posted'
        "#,
    )
    .bind(owner_id)
    .fetch_one(pool)
    .await?;

    Ok(WalletSummary {
        available_balance_cents,
        withdrawing_balance_cents,
        withdrawn_balance_cents,
        lifetime_income_cents,
    })
}

async fn fetch_any_wechat_account(
    pool: &PgPool,
    owner_id: &str,
) -> ApiResult<Option<WechatAccountRow>> {
    sqlx::query_as::<_, WechatAccountRow>(
        r#"
        SELECT appid, openid, status
        FROM owner_wallet_accounts
        WHERE owner_id = $1 AND provider = 'wechat' AND status = 'active'
        ORDER BY updated_at DESC NULLS LAST, created_at DESC
        LIMIT 1
        "#,
    )
    .bind(owner_id)
    .fetch_optional(pool)
    .await
    .map_err(Into::into)
}

async fn fetch_active_wechat_account(
    pool: &PgPool,
    owner_id: &str,
    appid: &str,
) -> ApiResult<Option<WechatAccountRow>> {
    sqlx::query_as::<_, WechatAccountRow>(
        r#"
        SELECT appid, openid, status
        FROM owner_wallet_accounts
        WHERE owner_id = $1 AND provider = 'wechat' AND appid = $2 AND status = 'active'
        ORDER BY updated_at DESC NULLS LAST, created_at DESC
        LIMIT 1
        "#,
    )
    .bind(owner_id)
    .bind(appid)
    .fetch_optional(pool)
    .await
    .map_err(Into::into)
}

async fn fetch_ledger_entries(pool: &PgPool, owner_id: &str) -> ApiResult<Vec<LedgerEntry>> {
    sqlx::query_as::<_, LedgerEntry>(
        r#"
        SELECT id, owner_id, order_id, withdrawal_id, entry_type, amount_cents,
               status, description, metadata, created_at
        FROM owner_wallet_ledger_entries
        WHERE owner_id = $1
        ORDER BY created_at DESC
        LIMIT 50
        "#,
    )
    .bind(owner_id)
    .fetch_all(pool)
    .await
    .map_err(Into::into)
}

async fn fetch_owner_withdrawals(pool: &PgPool, owner_id: &str) -> ApiResult<Vec<WithdrawalRow>> {
    sqlx::query_as::<_, WithdrawalRow>(
        r#"
        SELECT id, owner_id, provider, amount_cents, status, out_bill_no,
               transfer_bill_no, package_info, wechat_state, fail_reason, manual_note,
               provider_payload, created_at, updated_at, completed_at
        FROM owner_withdrawals
        WHERE owner_id = $1
        ORDER BY created_at DESC
        LIMIT 50
        "#,
    )
    .bind(owner_id)
    .fetch_all(pool)
    .await
    .map_err(Into::into)
}

async fn fetch_withdrawal(pool: &PgPool, id: &str) -> ApiResult<WithdrawalRow> {
    sqlx::query_as::<_, WithdrawalRow>(
        r#"
        SELECT id, owner_id, provider, amount_cents, status, out_bill_no,
               transfer_bill_no, package_info, wechat_state, fail_reason, manual_note,
               provider_payload, created_at, updated_at, completed_at
        FROM owner_withdrawals
        WHERE id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| ApiError::NotFound("提现单不存在".to_string()))
}

async fn reserve_withdrawal(
    pool: &PgPool,
    owner_id: &str,
    provider: &str,
    status: &str,
    out_bill_no: &str,
    amount_cents: i64,
    fail_reason: Option<&str>,
) -> ApiResult<String> {
    let mut tx = pool.begin().await?;
    sqlx::query("SELECT pg_advisory_xact_lock(hashtext($1))")
        .bind(owner_id)
        .execute(&mut *tx)
        .await?;
    let available: i64 = sqlx::query_scalar(
        r#"
        SELECT COALESCE(SUM(amount_cents), 0)::bigint
        FROM owner_wallet_ledger_entries
        WHERE owner_id = $1 AND status = 'posted'
        "#,
    )
    .bind(owner_id)
    .fetch_one(&mut *tx)
    .await?;
    if available < amount_cents {
        return Err(ApiError::BadRequest(format!(
            "可提现余额不足，当前可提现¥{:.2}",
            available as f64 / 100.0
        )));
    }

    let withdrawal_id: String = sqlx::query_scalar(
        r#"
        INSERT INTO owner_withdrawals (
            owner_id, provider, amount_cents, status, out_bill_no, fail_reason, provider_payload, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, '{}'::jsonb, now())
        RETURNING id
        "#,
    )
    .bind(owner_id)
    .bind(provider)
    .bind(amount_cents)
    .bind(status)
    .bind(out_bill_no)
    .bind(fail_reason)
    .fetch_one(&mut *tx)
    .await?;
    sqlx::query(
        r#"
        INSERT INTO owner_wallet_ledger_entries (
            owner_id, withdrawal_id, entry_type, amount_cents, status, description, metadata
        )
        VALUES ($1, $2, 'withdrawal_hold', $3, 'posted', '提现余额冻结', $4)
        "#,
    )
    .bind(owner_id)
    .bind(&withdrawal_id)
    .bind(-amount_cents)
    .bind(json!({ "outBillNo": out_bill_no, "provider": provider }))
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;

    Ok(withdrawal_id)
}

async fn withdrawal_action_response(
    pool: &PgPool,
    owner_id: &str,
    withdrawal_id: &str,
) -> ApiResult<WithdrawalActionResponse> {
    let withdrawal = fetch_withdrawal(pool, withdrawal_id).await?;
    let summary = load_wallet_summary(pool, owner_id).await?;
    let transfer_payload = if withdrawal.status == "waiting_user_confirm" {
        if let (Some(package), Ok(config)) = (
            withdrawal.package_info.as_ref(),
            WechatTransferConfig::from_env(),
        ) {
            Some(MerchantTransferPayload {
                mch_id: config.merchant.mch_id,
                app_id: config.merchant.app_id,
                package: package.clone(),
            })
        } else {
            None
        }
    } else {
        None
    };

    Ok(WithdrawalActionResponse {
        withdrawal,
        summary,
        transfer_payload,
    })
}

async fn wechat_create_transfer_bill(
    config: &WechatTransferConfig,
    withdrawal_id: &str,
    out_bill_no: &str,
    amount_cents: i64,
    account: &WechatAccountRow,
) -> ApiResult<TransferStartResult> {
    let remark = truncate_chars(&format!("RecoRouter运费提现-{withdrawal_id}"), 32);
    let body = json!({
        "appid": config.merchant.app_id,
        "out_bill_no": out_bill_no,
        "transfer_scene_id": config.scene_id,
        "openid": account.openid,
        "transfer_amount": amount_cents,
        "transfer_remark": remark,
        "notify_url": config.notify_url,
        "user_recv_perception": config.recv_perception,
        "transfer_scene_report_infos": config.scene_report_infos,
        "user_recv_style": {
            "type": "CONFIRM_PAGE"
        }
    })
    .to_string();
    let authorization = wechat_authorization(
        &config.merchant,
        "POST",
        "/v3/fund-app/mch-transfer/transfer-bills",
        &body,
    )?;
    let response = with_wechat_json_headers(
        reqwest::Client::new().post(WECHAT_TRANSFER_BILLS_URL),
        &authorization,
    )
    .body(body)
    .send()
    .await;
    let response = match response {
        Ok(response) => response,
        Err(err) => {
            return Ok(TransferStartResult::PendingSync(format!(
                "微信转账请求状态不明确: {err}"
            )));
        }
    };
    let status = response.status();
    let response_text = response
        .text()
        .await
        .map_err(|err| ApiError::BadRequest(format!("微信转账响应读取失败: {err}")))?;
    if !status.is_success() {
        return Ok(classify_transfer_error_response(
            status.as_u16(),
            &response_text,
        ));
    }

    let response: WechatTransferResponse = serde_json::from_str(&response_text).map_err(|err| {
        ApiError::BadRequest(format!("微信转账响应解析失败: {response_text}; {err}"))
    })?;
    Ok(TransferStartResult::Started(response))
}

async fn retry_wechat_transfer_bill(
    pool: &PgPool,
    config: &WechatTransferConfig,
    withdrawal: &WithdrawalRow,
) -> ApiResult<()> {
    let account = fetch_active_wechat_account(pool, &withdrawal.owner_id, &config.merchant.app_id)
        .await?
        .ok_or_else(|| ApiError::BadRequest("请先绑定微信收款账号".to_string()))?;

    match wechat_create_transfer_bill(
        config,
        &withdrawal.id,
        &withdrawal.out_bill_no,
        withdrawal.amount_cents,
        &account,
    )
    .await?
    {
        TransferStartResult::Started(response) => {
            apply_wechat_transfer_state(
                pool,
                &withdrawal.out_bill_no,
                &response.state,
                response.transfer_bill_no.as_deref(),
                response.package_info.as_deref(),
                None,
            )
            .await?;
        }
        TransferStartResult::ManualFallback(reason) => {
            mark_withdrawal_manual_fallback(pool, &withdrawal.id, &reason).await?;
        }
        TransferStartResult::PendingRetry(reason) => {
            mark_withdrawal_pending_retry(pool, &withdrawal.id, &reason).await?;
        }
        TransferStartResult::PendingSync(reason) => {
            update_withdrawal_failure_note(pool, &withdrawal.id, &reason).await?;
        }
    }

    Ok(())
}

fn classify_transfer_error_response(status: u16, response_text: &str) -> TransferStartResult {
    let (code, message) = parse_wechat_error(response_text);
    let display = match (&code, &message) {
        (Some(code), Some(message)) => format!("{code}: {message}"),
        (Some(code), None) => code.clone(),
        (None, Some(message)) => message.clone(),
        (None, None) => response_text.to_string(),
    };

    if code
        .as_deref()
        .map(is_retryable_transfer_error_code)
        .unwrap_or(false)
        || status == 429
        || status >= 500
    {
        return TransferStartResult::PendingRetry(format!(
            "微信自动提现待原单号重试: {display}。充值或稍后可用原单号重试，请勿更换商户单号"
        ));
    }

    if status == 400 || status == 403 {
        return TransferStartResult::ManualFallback(format!("微信自动提现不可用: {display}"));
    }

    TransferStartResult::PendingSync(format!("微信转账状态待确认: {display}"))
}

fn parse_wechat_error(response_text: &str) -> (Option<String>, Option<String>) {
    let Ok(value) = serde_json::from_str::<Value>(response_text) else {
        return (None, None);
    };
    let code = value
        .get("code")
        .and_then(Value::as_str)
        .map(ToOwned::to_owned);
    let message = value
        .get("message")
        .and_then(Value::as_str)
        .map(ToOwned::to_owned);
    (code, message)
}

fn is_retryable_transfer_error_code(code: &str) -> bool {
    matches!(
        code,
        "NOT_ENOUGH"
            | "SYSTEM_ERROR"
            | "FREQUENCY_LIMIT"
            | "FREQUENCY_LIMITED"
            | "FREQUENCY_LIMIT_EXCEED"
            | "RATELIMIT_EXCEEDED"
    )
}

fn should_retry_transfer_create(withdrawal: &WithdrawalRow) -> bool {
    withdrawal.status == "pending_retry"
        || (withdrawal.status == "pending_manual"
            && withdrawal
                .fail_reason
                .as_deref()
                .map(contains_retryable_transfer_error_code)
                .unwrap_or(false))
}

fn contains_retryable_transfer_error_code(reason: &str) -> bool {
    [
        "NOT_ENOUGH",
        "SYSTEM_ERROR",
        "FREQUENCY_LIMIT",
        "FREQUENCY_LIMITED",
        "FREQUENCY_LIMIT_EXCEED",
        "RATELIMIT_EXCEEDED",
    ]
    .iter()
    .any(|code| reason.contains(code))
}

async fn wechat_query_transfer_bill(
    config: &WechatTransferConfig,
    out_bill_no: &str,
) -> ApiResult<WechatTransferResponse> {
    let path = format!("/v3/fund-app/mch-transfer/transfer-bills/out-bill-no/{out_bill_no}");
    let authorization = wechat_authorization(&config.merchant, "GET", &path, "")?;
    let url = format!("{WECHAT_TRANSFER_QUERY_URL_PREFIX}/{out_bill_no}");
    let response = with_wechat_headers(reqwest::Client::new().get(url), &authorization)
        .send()
        .await
        .map_err(|err| ApiError::BadRequest(format!("微信转账查单失败: {err}")))?;
    let status = response.status();
    let response_text = response
        .text()
        .await
        .map_err(|err| ApiError::BadRequest(format!("微信转账查单响应读取失败: {err}")))?;
    if !status.is_success() {
        return Err(ApiError::BadRequest(format!(
            "微信转账查单失败: {response_text}"
        )));
    }

    serde_json::from_str(&response_text).map_err(|err| {
        ApiError::BadRequest(format!("微信转账查单解析失败: {response_text}; {err}"))
    })
}

async fn apply_wechat_transfer_state(
    pool: &PgPool,
    out_bill_no: &str,
    wechat_state: &str,
    transfer_bill_no: Option<&str>,
    package_info: Option<&str>,
    fail_reason: Option<&str>,
) -> ApiResult<()> {
    let status = map_wechat_state_to_withdrawal_status(wechat_state);
    let completed_sql = if is_local_terminal_status(status) {
        "now()"
    } else {
        "completed_at"
    };
    let sql = format!(
        r#"
        UPDATE owner_withdrawals
        SET status = $2,
            wechat_state = $3,
            transfer_bill_no = COALESCE($4, transfer_bill_no),
            package_info = COALESCE($5, package_info),
            fail_reason = COALESCE($6, fail_reason),
            completed_at = {completed_sql},
            updated_at = now()
        WHERE out_bill_no = $1
        "#
    );
    sqlx::query(&sql)
        .bind(out_bill_no)
        .bind(status)
        .bind(wechat_state)
        .bind(transfer_bill_no)
        .bind(package_info)
        .bind(fail_reason)
        .execute(pool)
        .await?;

    if status == "failed" || status == "closed" {
        let withdrawal = fetch_withdrawal_by_out_bill_no(pool, out_bill_no).await?;
        release_withdrawal_hold(pool, &withdrawal).await?;
    }

    Ok(())
}

async fn fetch_withdrawal_by_out_bill_no(
    pool: &PgPool,
    out_bill_no: &str,
) -> ApiResult<WithdrawalRow> {
    sqlx::query_as::<_, WithdrawalRow>(
        r#"
        SELECT id, owner_id, provider, amount_cents, status, out_bill_no,
               transfer_bill_no, package_info, wechat_state, fail_reason, manual_note,
               provider_payload, created_at, updated_at, completed_at
        FROM owner_withdrawals
        WHERE out_bill_no = $1
        "#,
    )
    .bind(out_bill_no)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| ApiError::NotFound("提现单不存在".to_string()))
}

async fn mark_withdrawal_manual_fallback(
    pool: &PgPool,
    withdrawal_id: &str,
    reason: &str,
) -> ApiResult<()> {
    sqlx::query(
        r#"
        UPDATE owner_withdrawals
        SET provider = 'manual',
            status = 'pending_manual',
            fail_reason = $2,
            updated_at = now()
        WHERE id = $1
        "#,
    )
    .bind(withdrawal_id)
    .bind(reason)
    .execute(pool)
    .await?;
    Ok(())
}

async fn mark_withdrawal_pending_retry(
    pool: &PgPool,
    withdrawal_id: &str,
    reason: &str,
) -> ApiResult<()> {
    sqlx::query(
        r#"
        UPDATE owner_withdrawals
        SET status = 'pending_retry',
            fail_reason = $2,
            updated_at = now()
        WHERE id = $1
        "#,
    )
    .bind(withdrawal_id)
    .bind(reason)
    .execute(pool)
    .await?;

    Ok(())
}

async fn update_withdrawal_failure_note(
    pool: &PgPool,
    withdrawal_id: &str,
    reason: &str,
) -> ApiResult<()> {
    sqlx::query(
        r#"
        UPDATE owner_withdrawals
        SET fail_reason = $2,
            updated_at = now()
        WHERE id = $1
        "#,
    )
    .bind(withdrawal_id)
    .bind(reason)
    .execute(pool)
    .await?;
    Ok(())
}

async fn release_withdrawal_hold(pool: &PgPool, withdrawal: &WithdrawalRow) -> ApiResult<()> {
    sqlx::query(
        r#"
        INSERT INTO owner_wallet_ledger_entries (
            owner_id, withdrawal_id, entry_type, amount_cents, status, description, metadata
        )
        VALUES ($1, $2, 'withdrawal_release', $3, 'posted', '提现失败释放余额', $4)
        ON CONFLICT DO NOTHING
        "#,
    )
    .bind(&withdrawal.owner_id)
    .bind(&withdrawal.id)
    .bind(withdrawal.amount_cents)
    .bind(json!({ "outBillNo": withdrawal.out_bill_no }))
    .execute(pool)
    .await?;
    Ok(())
}

fn transfer_availability() -> TransferAvailability {
    let (min_amount_cents, max_amount_cents) = transfer_limits().unwrap_or((100, 199_999));
    if !read_bool_env("WECHAT_TRANSFER_ENABLED") {
        return TransferAvailability {
            enabled: false,
            ready: false,
            mode: "manual".to_string(),
            reason: Some("自动提现未启用，提现将进入人工处理".to_string()),
            appid: None,
            mch_id: None,
            min_amount_cents,
            max_amount_cents,
        };
    }

    match WechatTransferConfig::from_env() {
        Ok(config) => TransferAvailability {
            enabled: true,
            ready: true,
            mode: "wechat".to_string(),
            reason: None,
            appid: Some(config.merchant.app_id),
            mch_id: Some(config.merchant.mch_id),
            min_amount_cents: config.min_amount_cents,
            max_amount_cents: config.max_amount_cents,
        },
        Err(err) => TransferAvailability {
            enabled: true,
            ready: false,
            mode: "manual".to_string(),
            reason: Some(format!("自动提现配置未完成: {err}")),
            appid: None,
            mch_id: None,
            min_amount_cents,
            max_amount_cents,
        },
    }
}

impl WechatTransferConfig {
    fn from_env() -> ApiResult<Self> {
        if !read_bool_env("WECHAT_TRANSFER_ENABLED") {
            return Err(ApiError::BadRequest(
                "WECHAT_TRANSFER_ENABLED 未启用".to_string(),
            ));
        }
        let merchant = WechatPayMerchantConfig::from_env()?;
        let scene_id =
            read_trimmed("WECHAT_TRANSFER_SCENE_ID").unwrap_or_else(default_transfer_scene_id);
        let notify_url = read_trimmed("WECHAT_TRANSFER_NOTIFY_URL")
            .or_else(|| {
                read_trimmed("PUBLIC_BASE_URL").map(|base| {
                    format!(
                        "{}/api/owner-wallet/wechat-transfer/notify",
                        base.trim_end_matches('/')
                    )
                })
            })
            .ok_or_else(|| {
                ApiError::BadRequest("缺少 WECHAT_TRANSFER_NOTIFY_URL 配置".to_string())
            })?;
        let (min_amount_cents, max_amount_cents) = transfer_limits()?;

        Ok(Self {
            merchant,
            recv_perception: transfer_user_recv_perception(
                &scene_id,
                read_trimmed("WECHAT_TRANSFER_RECV_PERCEPTION"),
            ),
            scene_report_infos: transfer_scene_report_infos(
                &scene_id,
                read_trimmed("WECHAT_TRANSFER_SCENE_INFO_TYPE_1"),
                read_trimmed("WECHAT_TRANSFER_SCENE_INFO_CONTENT_1"),
                read_trimmed("WECHAT_TRANSFER_SCENE_INFO_TYPE_2"),
                read_trimmed("WECHAT_TRANSFER_SCENE_INFO_CONTENT_2"),
            ),
            scene_id,
            notify_url,
            min_amount_cents,
            max_amount_cents,
        })
    }
}

fn transfer_limits() -> ApiResult<(i64, i64)> {
    let min = read_i64_env("WECHAT_TRANSFER_MIN_AMOUNT_CENTS", 1)?;
    let max = read_i64_env("WECHAT_TRANSFER_MAX_AMOUNT_CENTS", 199_999)?;
    if min <= 0 || max < min {
        return Err(ApiError::BadRequest(
            "微信转账提现限额配置不正确".to_string(),
        ));
    }
    Ok((min, max))
}

fn read_i64_env(key: &'static str, default_value: i64) -> ApiResult<i64> {
    match read_trimmed(key) {
        Some(value) => value
            .parse::<i64>()
            .map_err(|_| ApiError::BadRequest(format!("{key} 必须是整数"))),
        None => Ok(default_value),
    }
}

fn read_bool_env(key: &'static str) -> bool {
    read_trimmed(key)
        .map(|value| {
            matches!(
                value.to_ascii_lowercase().as_str(),
                "1" | "true" | "yes" | "on"
            )
        })
        .unwrap_or(false)
}

fn manual_fallback_reason(error: Option<&ApiError>) -> String {
    error
        .map(ToString::to_string)
        .unwrap_or_else(|| "自动提现未启用，进入人工处理".to_string())
}

fn default_transfer_scene_id() -> String {
    "1009".to_string()
}

fn transfer_user_recv_perception(scene_id: &str, configured: Option<String>) -> String {
    if let Some(value) = configured {
        return value;
    }

    match scene_id {
        "1009" => "货款".to_string(),
        _ => "劳务报酬".to_string(),
    }
}

fn transfer_scene_report_infos(
    scene_id: &str,
    type_1: Option<String>,
    content_1: Option<String>,
    type_2: Option<String>,
    content_2: Option<String>,
) -> Vec<TransferSceneReportInfo> {
    let default_type_1 = match scene_id {
        "1009" => "采购商品名称",
        _ => "岗位类型",
    };
    let default_content_1 = match scene_id {
        "1009" => "货运服务",
        _ => "货运司机",
    };

    let mut infos = vec![TransferSceneReportInfo {
        info_type: type_1.unwrap_or_else(|| default_type_1.to_string()),
        info_content: content_1.unwrap_or_else(|| default_content_1.to_string()),
    }];

    if let (Some(info_type), Some(info_content)) = (type_2, content_2) {
        infos.push(TransferSceneReportInfo {
            info_type,
            info_content,
        });
    } else if scene_id != "1009" {
        infos.push(TransferSceneReportInfo {
            info_type: "报酬说明".to_string(),
            info_content: "订单运费提现".to_string(),
        });
    }

    infos
}

fn map_wechat_state_to_withdrawal_status(state: &str) -> &'static str {
    match state {
        "WAIT_USER_CONFIRM" => "waiting_user_confirm",
        "ACCEPTED" | "PROCESSING" | "TRANSFERING" | "CANCELING" => "transferring",
        "SUCCESS" => "success",
        "FAIL" => "failed",
        "CANCELLED" => "closed",
        _ => "transferring",
    }
}

fn is_local_terminal_status(status: &str) -> bool {
    matches!(status, "success" | "failed" | "closed")
}

fn money_to_cents(amount: Option<f64>) -> i64 {
    (amount.unwrap_or(0.0) * 100.0).round() as i64
}

fn new_out_bill_no() -> String {
    format!("OW{}{}", unix_timestamp_millis(), random_token(4))
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric())
        .take(32)
        .collect()
}

fn non_empty_param(params: &HashMap<String, String>, key: &str) -> Option<String> {
    params
        .get(key)
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn push_where(builder: &mut QueryBuilder<Postgres>, has_where: &mut bool) {
    if *has_where {
        builder.push(" AND ");
    } else {
        builder.push(" WHERE ");
        *has_where = true;
    }
}

#[cfg(test)]
mod tests {
    use super::{
        classify_transfer_error_response, default_transfer_scene_id,
        map_wechat_state_to_withdrawal_status, money_to_cents, new_out_bill_no,
        transfer_scene_report_infos, transfer_user_recv_perception, TransferStartResult,
    };

    #[test]
    fn money_to_cents_rounds_to_integer_cents() {
        assert_eq!(money_to_cents(Some(88.88)), 8888);
        assert_eq!(money_to_cents(Some(0.005)), 1);
        assert_eq!(money_to_cents(None), 0);
    }

    #[test]
    fn wechat_states_map_to_local_withdrawal_status() {
        assert_eq!(
            map_wechat_state_to_withdrawal_status("WAIT_USER_CONFIRM"),
            "waiting_user_confirm",
        );
        assert_eq!(
            map_wechat_state_to_withdrawal_status("TRANSFERING"),
            "transferring",
        );
        assert_eq!(map_wechat_state_to_withdrawal_status("SUCCESS"), "success");
        assert_eq!(map_wechat_state_to_withdrawal_status("FAIL"), "failed");
        assert_eq!(map_wechat_state_to_withdrawal_status("CANCELLED"), "closed");
    }

    #[test]
    fn out_bill_no_matches_wechat_contract() {
        let value = new_out_bill_no();

        assert!(value.len() <= 32);
        assert!(value.chars().all(|ch| ch.is_ascii_alphanumeric()));
    }

    #[test]
    fn purchase_goods_scene_uses_single_required_report_info() {
        let infos = transfer_scene_report_infos("1009", None, None, None, None);

        assert_eq!(default_transfer_scene_id(), "1009");
        assert_eq!(transfer_user_recv_perception("1009", None), "货款");
        assert_eq!(infos.len(), 1);
        assert_eq!(infos[0].info_type, "采购商品名称");
        assert_eq!(infos[0].info_content, "货运服务");
    }

    #[test]
    fn custom_second_report_info_is_optional() {
        let infos = transfer_scene_report_infos(
            "1009",
            Some("采购商品名称".to_string()),
            Some("冷链运输服务".to_string()),
            Some("报酬说明".to_string()),
            None,
        );

        assert_eq!(infos.len(), 1);
        assert_eq!(infos[0].info_content, "冷链运输服务");
    }

    #[test]
    fn not_enough_transfer_error_keeps_original_bill_retryable() {
        let result = classify_transfer_error_response(
            403,
            r#"{"code":"NOT_ENOUGH","message":"商户运营账户资金不足，充值后可以原单号发起重试，请勿更换商户单号"}"#,
        );

        match result {
            TransferStartResult::PendingRetry(reason) => {
                assert!(reason.contains("NOT_ENOUGH"));
                assert!(reason.contains("原单号"));
            }
            _ => panic!("NOT_ENOUGH should keep the original out_bill_no retryable"),
        }
    }
}
