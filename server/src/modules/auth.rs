use std::{
    collections::HashMap,
    sync::{Arc, Mutex, OnceLock},
};

use axum::{
    body::Body,
    extract::{DefaultBodyLimit, Multipart, Query, State},
    http::{HeaderMap, Request},
    middleware::Next,
    response::Response,
    routing::{get, post},
    Json, Router,
};
use bcrypt::{hash, verify};
use chrono::{DateTime, Duration, Utc};
use percent_encoding::{utf8_percent_encode, NON_ALPHANUMERIC};
use rand::{Rng, RngCore};
use regex::Regex;
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

use crate::{
    app::AppState,
    error::{ApiError, ApiResult},
    response::{empty_message, ok, ApiEnvelope, EmptyMessage},
    storage::Storage,
    wechat_pay::{
        exchange_miniapp_login_session, exchange_miniapp_phone_number, WechatMiniappConfig,
    },
};

const BCRYPT_COST: u32 = 10;
const MAX_FILE_SIZE: usize = 5 * 1024 * 1024;
const MAX_TEXT_FIELD_SIZE: usize = 1024;
const MAX_MULTIPART_BYTES: usize = MAX_FILE_SIZE + 16 * 1024;
const CAPTCHA_TTL_MINUTES: i64 = 5;
const CAPTCHA_CHARS: &[u8] = b"ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

#[derive(Clone, Default)]
pub struct CaptchaStore {
    entries: Arc<Mutex<HashMap<String, CaptchaEntry>>>,
}

struct CaptchaEntry {
    answer: String,
    expires_at: DateTime<Utc>,
}

impl CaptchaStore {
    fn issue(&self, answer: String) -> String {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now();
        let mut entries = self.entries.lock().unwrap_or_else(|err| err.into_inner());

        entries.retain(|_, entry| entry.expires_at > now);
        entries.insert(
            id.clone(),
            CaptchaEntry {
                answer,
                expires_at: now + Duration::minutes(CAPTCHA_TTL_MINUTES),
            },
        );

        id
    }

    fn verify(&self, id: &str, answer: &str) -> bool {
        let id = id.trim();
        let answer = answer.trim();
        if id.is_empty() || answer.is_empty() {
            return false;
        }

        let now = Utc::now();
        let mut entries = self.entries.lock().unwrap_or_else(|err| err.into_inner());
        entries.retain(|_, entry| entry.expires_at > now);

        entries
            .remove(id)
            .is_some_and(|entry| entry.answer.eq_ignore_ascii_case(answer))
    }
}

pub fn router<S>() -> Router<AppState<S>>
where
    S: Storage,
{
    let payment_qr_router = Router::new()
        .route("/api/auth/update-payment-qr", post(update_payment_qr::<S>))
        .route_layer(DefaultBodyLimit::disable());

    Router::new()
        .route("/api/auth/captcha", get(captcha::<S>))
        .route("/api/auth/register", post(register::<S>))
        .route("/api/auth/login", post(login::<S>))
        .route("/api/auth/wechat-login", post(wechat_login::<S>))
        .route("/api/auth/logout", post(logout::<S>))
        .route("/api/auth/user-info", get(user_info::<S>))
        .merge(payment_qr_router)
}

pub fn mall_router<S>() -> Router<AppState<S>>
where
    S: Storage,
{
    Router::new()
        .route("/api/mall/auth/captcha", get(captcha::<S>))
        .route("/api/mall/auth/register", post(register::<S>))
        .route("/api/mall/auth/login", post(login::<S>))
        .route("/api/mall/auth/wechat-login", post(wechat_login::<S>))
        .route("/api/mall/auth/logout", post(logout::<S>))
        .route("/api/mall/auth/user-info", get(user_info::<S>))
}

#[derive(Debug, Deserialize)]
struct RegisterRequest {
    phone: String,
    password: String,
    #[serde(rename = "confirmPassword", alias = "confirm_password")]
    confirm_password: Option<String>,
    #[serde(
        rename = "verificationCode",
        alias = "verification_code",
        alias = "captchaCode",
        alias = "captcha_code"
    )]
    verification_code: String,
    #[serde(rename = "captchaId", alias = "captcha_id")]
    captcha_id: String,
    name: String,
    role: String,
}

#[derive(Debug, Deserialize)]
struct LoginRequest {
    phone: String,
    password: String,
    #[serde(
        rename = "captchaCode",
        alias = "captcha_code",
        alias = "verificationCode",
        alias = "verification_code"
    )]
    captcha_code: Option<String>,
    #[serde(rename = "captchaId", alias = "captcha_id")]
    captcha_id: Option<String>,
}

#[derive(Debug, Deserialize)]
struct WechatLoginRequest {
    #[serde(rename = "loginCode", alias = "login_code")]
    login_code: String,
    #[serde(rename = "phoneCode", alias = "phone_code")]
    phone_code: Option<String>,
    role: Option<String>,
    name: Option<String>,
    avatar: Option<String>,
}

#[derive(Debug, Deserialize)]
struct UserInfoQuery {
    #[serde(rename = "userId")]
    user_id: String,
}

#[derive(Debug, Serialize)]
struct AuthResponse {
    id: String,
    phone: String,
    name: String,
    role: String,
    token: String,
}

#[derive(Debug, Serialize)]
struct CaptchaResponse {
    #[serde(rename = "captchaId")]
    captcha_id: String,
    image: String,
}

#[derive(Debug, Serialize)]
struct UserInfoResponse {
    id: String,
    phone: Option<String>,
    name: Option<String>,
    role: Option<String>,
    avatar: Option<String>,
    wechat_payment_qr: Option<String>,
    created_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize)]
struct PaymentQrResponse {
    id: String,
    phone: Option<String>,
    name: Option<String>,
    role: Option<String>,
    wechat_payment_qr: String,
}

#[derive(Debug, FromRow)]
struct AuthUserRow {
    id: String,
    phone: Option<String>,
    password: Option<String>,
    name: Option<String>,
    role: Option<String>,
    status: Option<String>,
}

#[derive(Debug, FromRow)]
struct WechatBindingUserRow {
    id: String,
    name: Option<String>,
    wechat_openid: Option<String>,
    wechat_appid: Option<String>,
}

#[derive(Debug, FromRow)]
struct SessionUserRow {
    id: String,
    role: Option<String>,
    status: Option<String>,
}

#[derive(Clone, Debug)]
pub struct AdminPrincipal {
    pub id: String,
}

#[derive(Debug, FromRow)]
struct UserInfoRow {
    id: String,
    phone: Option<String>,
    name: Option<String>,
    role: Option<String>,
    avatar: Option<String>,
    wechat_payment_qr: Option<String>,
    created_at: Option<DateTime<Utc>>,
}

#[derive(Debug, FromRow)]
struct PaymentQrUserRow {
    id: String,
    phone: Option<String>,
    name: Option<String>,
    role: Option<String>,
}

struct UploadedPaymentQr {
    original_name: String,
    content_type: Option<String>,
    bytes: Vec<u8>,
}

async fn register<S>(
    State(state): State<AppState<S>>,
    Json(body): Json<RegisterRequest>,
) -> ApiResult<Json<ApiEnvelope<AuthResponse>>>
where
    S: Storage,
{
    validate_register_request(&body)?;

    if !state
        .captcha_store
        .verify(&body.captcha_id, &body.verification_code)
    {
        return Err(ApiError::BadRequest("图形验证码错误或已过期".to_string()));
    }

    let existing_id: Option<String> = sqlx::query_scalar("SELECT id FROM users WHERE phone = $1")
        .bind(&body.phone)
        .fetch_optional(&state.db)
        .await?;

    if existing_id.is_some() {
        return Err(ApiError::Conflict("该手机号已注册".to_string()));
    }

    let user_id = Uuid::new_v4().to_string();
    let password_hash =
        hash(&body.password, BCRYPT_COST).map_err(|err| ApiError::BadRequest(err.to_string()))?;
    let name = body.name.trim();
    let insert_result = sqlx::query_as::<_, AuthUserRow>(
        r#"
        INSERT INTO users (id, phone, password, role, name, status)
        VALUES ($1, $2, $3, $4, $5, 'active')
        RETURNING id, phone, password, name, role, status
        "#,
    )
    .bind(&user_id)
    .bind(&body.phone)
    .bind(password_hash)
    .bind(&body.role)
    .bind(name)
    .fetch_one(&state.db)
    .await;

    let row = match insert_result {
        Ok(row) => row,
        Err(sqlx::Error::Database(err)) if err.constraint() == Some("users_phone_key") => {
            return Err(ApiError::Conflict("该手机号已注册".to_string()));
        }
        Err(err) => return Err(err.into()),
    };

    let token = create_session_token(&state.db, &row.id).await?;

    Ok(ok("注册成功", auth_response_from_row(row, token)))
}

async fn captcha<S>(
    State(state): State<AppState<S>>,
) -> ApiResult<Json<ApiEnvelope<CaptchaResponse>>>
where
    S: Storage,
{
    let code = generate_captcha_code();
    let captcha_id = state.captcha_store.issue(code.clone());
    let image = captcha_svg_data_url(&code);

    Ok(ok("验证码生成成功", CaptchaResponse { captcha_id, image }))
}

async fn login<S>(
    State(state): State<AppState<S>>,
    Json(body): Json<LoginRequest>,
) -> ApiResult<Json<ApiEnvelope<AuthResponse>>>
where
    S: Storage,
{
    validate_phone(&body.phone)?;
    if body.password.len() < 6 {
        return Err(ApiError::BadRequest("密码至少6位".to_string()));
    }

    let row = sqlx::query_as::<_, AuthUserRow>(
        "SELECT id, phone, password, name, role, status FROM users WHERE phone = $1",
    )
    .bind(&body.phone)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| ApiError::Unauthorized("用户不存在".to_string()))?;

    if row.role.as_deref() == Some("admin") {
        let captcha_id = body.captcha_id.as_deref().unwrap_or_default();
        let captcha_code = body.captcha_code.as_deref().unwrap_or_default();
        if captcha_id.trim().is_empty() || captcha_code.trim().is_empty() {
            return Err(ApiError::BadRequest("请输入图形验证码".to_string()));
        }
        if !state.captcha_store.verify(captcha_id, captcha_code) {
            return Err(ApiError::BadRequest("图形验证码错误或已过期".to_string()));
        }
    }

    let password_hash = row.password.as_deref().unwrap_or_default();
    let password_matches = verify(&body.password, password_hash)
        .map_err(|err| ApiError::BadRequest(err.to_string()))?;

    if !password_matches {
        return Err(ApiError::Unauthorized("密码错误".to_string()));
    }

    if row.status.as_deref() == Some("disabled") {
        return Err(ApiError::Unauthorized("账号已被禁用".to_string()));
    }

    let token = create_session_token(&state.db, &row.id).await?;

    Ok(ok("登录成功", auth_response_from_row(row, token)))
}

async fn wechat_login<S>(
    State(state): State<AppState<S>>,
    Json(body): Json<WechatLoginRequest>,
) -> ApiResult<Json<ApiEnvelope<AuthResponse>>>
where
    S: Storage,
{
    let role = normalize_mall_auth_role(body.role.as_deref())?;
    let phone_code = body
        .phone_code
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| ApiError::BadRequest("请授权手机号完成快捷登录".to_string()))?;
    let miniapp_config = WechatMiniappConfig::from_env_for_service(state.service)?;
    let session = exchange_miniapp_login_session(&miniapp_config, &body.login_code).await?;
    let phone = exchange_miniapp_phone_number(&miniapp_config, phone_code)
        .await?
        .phone_number;
    validate_phone(&phone)?;
    let avatar = body
        .avatar
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| value.chars().take(512).collect::<String>());

    let existing_wechat_user = sqlx::query_as::<_, WechatBindingUserRow>(
        r#"
        SELECT id, name, wechat_openid, wechat_appid
        FROM users
        WHERE wechat_appid = $1
          AND wechat_openid = $2
        "#,
    )
    .bind(&miniapp_config.app_id)
    .bind(&session.openid)
    .fetch_optional(&state.db)
    .await?;
    let phone_user = sqlx::query_as::<_, WechatBindingUserRow>(
        r#"
        SELECT id, name, wechat_openid, wechat_appid
        FROM users
        WHERE phone = $1
        "#,
    )
    .bind(&phone)
    .fetch_optional(&state.db)
    .await?;

    let row = if let Some(target) = resolve_wechat_binding_target(
        existing_wechat_user.as_ref(),
        phone_user.as_ref(),
        &miniapp_config.app_id,
        &session.openid,
    )? {
        let display_name =
            resolve_wechat_display_name(&body, &role, &target.id, target.name.as_deref());
        sqlx::query_as::<_, AuthUserRow>(
            r#"
            UPDATE users
            SET phone = COALESCE(users.phone, $1),
                role = COALESCE(users.role, $2),
                name = CASE
                  WHEN $3 THEN $4
                  ELSE users.name
                END,
                avatar = COALESCE($5, users.avatar),
                wechat_openid = COALESCE(users.wechat_openid, $6),
                wechat_unionid = COALESCE(users.wechat_unionid, $7),
                wechat_appid = COALESCE(users.wechat_appid, $8),
                wechat_bound_at = COALESCE(users.wechat_bound_at, now()),
                status = COALESCE(users.status, 'active'),
                updated_at = now()
            WHERE id = $9
            RETURNING id, phone, password, name, role, status
            "#,
        )
        .bind(&phone)
        .bind(&role)
        .bind(should_replace_wechat_name(target.name.as_deref()))
        .bind(display_name)
        .bind(avatar)
        .bind(&session.openid)
        .bind(&session.unionid)
        .bind(&miniapp_config.app_id)
        .bind(&target.id)
        .fetch_one(&state.db)
        .await?
    } else {
        let user_id = Uuid::new_v4().to_string();
        let display_name = resolve_wechat_display_name(&body, &role, &user_id, None);
        let insert_result = sqlx::query_as::<_, AuthUserRow>(
            r#"
            INSERT INTO users (
              id, phone, password, role, name, avatar, status,
              wechat_openid, wechat_unionid, wechat_appid, wechat_bound_at, updated_at
            )
            VALUES ($1, $2, NULL, $3, $4, $5, 'active', $6, $7, $8, now(), now())
            RETURNING id, phone, password, name, role, status
            "#,
        )
        .bind(&user_id)
        .bind(&phone)
        .bind(&role)
        .bind(display_name)
        .bind(avatar)
        .bind(&session.openid)
        .bind(&session.unionid)
        .bind(&miniapp_config.app_id)
        .fetch_one(&state.db)
        .await;

        match insert_result {
            Ok(row) => row,
            Err(sqlx::Error::Database(err))
                if err.constraint() == Some("users_phone_key")
                    || err.constraint() == Some("users_wechat_appid_openid_uidx") =>
            {
                return Err(ApiError::Conflict("该手机号已绑定其他账号".to_string()));
            }
            Err(err) => return Err(err.into()),
        }
    };

    if row.status.as_deref() == Some("disabled") {
        return Err(ApiError::Unauthorized("账号已被禁用".to_string()));
    }

    let token = create_session_token(&state.db, &row.id).await?;

    Ok(ok("微信登录成功", auth_response_from_row(row, token)))
}

async fn logout<S>(
    State(state): State<AppState<S>>,
    headers: HeaderMap,
) -> ApiResult<Json<EmptyMessage>>
where
    S: Storage,
{
    let token = bearer_token(&headers)?;
    let result = sqlx::query(
        r#"
        UPDATE admin_sessions
        SET revoked_at = now()
        WHERE token = $1
          AND revoked_at IS NULL
        "#,
    )
    .bind(token)
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(ApiError::Unauthorized("登录已失效".to_string()));
    }

    Ok(empty_message("退出登录成功"))
}

async fn user_info<S>(
    State(state): State<AppState<S>>,
    Query(query): Query<UserInfoQuery>,
) -> ApiResult<Json<ApiEnvelope<UserInfoResponse>>>
where
    S: Storage,
{
    let row = sqlx::query_as::<_, UserInfoRow>(
        r#"
        SELECT id, phone, name, role, avatar, wechat_payment_qr, created_at
        FROM users
        WHERE id = $1
        "#,
    )
    .bind(&query.user_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| ApiError::NotFound("用户不存在".to_string()))?;

    let payment_url = match &row.wechat_payment_qr {
        Some(key) => state.storage.public_url(key).await.ok(),
        None => None,
    };

    Ok(ok(
        "查询成功",
        UserInfoResponse {
            id: row.id,
            phone: row.phone,
            name: row.name,
            role: row.role,
            avatar: row.avatar,
            wechat_payment_qr: payment_url,
            created_at: row.created_at,
        },
    ))
}

async fn update_payment_qr<S>(
    State(state): State<AppState<S>>,
    mut multipart: Multipart,
) -> ApiResult<Json<ApiEnvelope<PaymentQrResponse>>>
where
    S: Storage,
{
    let mut user_id = None;
    let mut file = None;
    let mut total_multipart_bytes = 0usize;

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|err| ApiError::BadRequest(err.to_string()))?
    {
        let field_name = field.name().map(str::to_string);
        match field_name.as_deref() {
            Some("userId") => {
                user_id = Some(read_text_field(field, &mut total_multipart_bytes).await?);
            }
            Some("file") => {
                let original_name = field
                    .file_name()
                    .map(sanitize_original_file_name)
                    .filter(|name| !name.is_empty())
                    .unwrap_or_else(|| "payment.png".to_string());
                let content_type = field.content_type().map(str::to_string);
                let bytes = read_file_bytes(field, &mut total_multipart_bytes).await?;

                file = Some(UploadedPaymentQr {
                    original_name,
                    content_type,
                    bytes,
                });
            }
            _ => consume_ignored_field(field, &mut total_multipart_bytes).await?,
        }
    }

    let user_id = user_id
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .ok_or_else(|| ApiError::BadRequest("用户ID不能为空".to_string()))?;

    let user = sqlx::query_as::<_, PaymentQrUserRow>(
        "SELECT id, phone, name, role FROM users WHERE id = $1",
    )
    .bind(&user_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| ApiError::NotFound("用户不存在".to_string()))?;

    if user.role.as_deref() != Some("owner") {
        return Err(ApiError::BadRequest("只有车主可以上传收款码".to_string()));
    }

    let file = file.ok_or_else(|| ApiError::BadRequest("请上传收款码图片".to_string()))?;
    let storage_name = format!(
        "payment_qr/{}_{}_{}",
        user_id,
        Utc::now().timestamp_millis(),
        file.original_name
    );
    let key = state
        .storage
        .put(file.bytes, &storage_name, file.content_type.as_deref())
        .await?;

    sqlx::query("UPDATE users SET wechat_payment_qr = $1 WHERE id = $2")
        .bind(&key)
        .bind(&user_id)
        .execute(&state.db)
        .await?;

    let url = state.storage.public_url(&key).await?;

    Ok(ok(
        "收款码上传成功",
        PaymentQrResponse {
            id: user.id,
            phone: user.phone,
            name: user.name,
            role: user.role,
            wechat_payment_qr: url,
        },
    ))
}

fn validate_register_request(body: &RegisterRequest) -> ApiResult<()> {
    validate_phone(&body.phone)?;

    if body.password.len() < 6 {
        return Err(ApiError::BadRequest("密码至少6位".to_string()));
    }

    if let Some(confirm_password) = &body.confirm_password {
        if confirm_password != &body.password {
            return Err(ApiError::BadRequest("两次输入的密码不一致".to_string()));
        }
    }

    if body.captcha_id.trim().is_empty() || body.verification_code.trim().is_empty() {
        return Err(ApiError::BadRequest("请输入图形验证码".to_string()));
    }

    if body.name.trim().is_empty() {
        return Err(ApiError::BadRequest("姓名不能为空".to_string()));
    }

    if !matches!(
        body.role.as_str(),
        "owner" | "merchant" | "enterprise" | "customer" | "group_leader"
    ) {
        return Err(ApiError::BadRequest(
            "角色必须为 owner、merchant、enterprise、customer 或 group_leader".to_string(),
        ));
    }

    Ok(())
}

fn normalize_mall_auth_role(role: Option<&str>) -> ApiResult<String> {
    match role.map(str::trim).filter(|value| !value.is_empty()) {
        None | Some("customer") => Ok("customer".to_string()),
        Some("group_leader") => Ok("group_leader".to_string()),
        Some(_) => Err(ApiError::BadRequest(
            "商城微信身份必须为 customer 或 group_leader".to_string(),
        )),
    }
}

fn resolve_wechat_binding_target<'a>(
    wechat_user: Option<&'a WechatBindingUserRow>,
    phone_user: Option<&'a WechatBindingUserRow>,
    app_id: &str,
    openid: &str,
) -> ApiResult<Option<&'a WechatBindingUserRow>> {
    match (wechat_user, phone_user) {
        (Some(wechat), Some(phone)) if wechat.id != phone.id => {
            Err(ApiError::Conflict("该手机号已绑定其他账号".to_string()))
        }
        (Some(wechat), _) => Ok(Some(wechat)),
        (None, Some(phone)) => {
            let phone_wechat_openid = phone.wechat_openid.as_deref().unwrap_or_default();
            let phone_wechat_appid = phone.wechat_appid.as_deref().unwrap_or_default();
            if !phone_wechat_openid.is_empty()
                && (phone_wechat_openid != openid || phone_wechat_appid != app_id)
            {
                return Err(ApiError::Conflict("该手机号已绑定其他微信账号".to_string()));
            }
            Ok(Some(phone))
        }
        (None, None) => Ok(None),
    }
}

fn resolve_wechat_display_name(
    body: &WechatLoginRequest,
    role: &str,
    user_id: &str,
    current_name: Option<&str>,
) -> String {
    if !should_replace_wechat_name(current_name) {
        return current_name.unwrap_or_default().to_string();
    }

    body.name
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| value.chars().take(32).collect::<String>())
        .unwrap_or_else(|| default_wechat_display_name(role, user_id))
}

fn should_replace_wechat_name(name: Option<&str>) -> bool {
    match name.map(str::trim).filter(|value| !value.is_empty()) {
        None => true,
        Some("微信用户") | Some("微信团长") => true,
        Some(_) => false,
    }
}

fn default_wechat_display_name(role: &str, user_id: &str) -> String {
    let suffix = user_id
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric())
        .rev()
        .take(6)
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .collect::<String>()
        .to_ascii_lowercase();
    let prefix = if role == "group_leader" {
        "微信团长"
    } else {
        "微信用户"
    };
    format!("{prefix}{suffix}")
}

fn validate_phone(phone: &str) -> ApiResult<()> {
    static PHONE_REGEX: OnceLock<Regex> = OnceLock::new();
    let regex = PHONE_REGEX.get_or_init(|| Regex::new(r"^1[3-9]\d{9}$").unwrap());

    if regex.is_match(phone) {
        Ok(())
    } else {
        Err(ApiError::BadRequest("手机号格式不正确".to_string()))
    }
}

fn auth_response_from_row(row: AuthUserRow, token: String) -> AuthResponse {
    let id = row.id;

    AuthResponse {
        token,
        id,
        phone: row.phone.unwrap_or_default(),
        name: row.name.unwrap_or_default(),
        role: row.role.unwrap_or_default(),
    }
}

pub async fn admin_guard<S>(
    State(state): State<AppState<S>>,
    headers: HeaderMap,
    mut request: Request<Body>,
    next: Next,
) -> ApiResult<Response>
where
    S: Storage,
{
    let token = bearer_token(&headers)?;
    let user = session_user(&state.db, token).await?;

    if user.status.as_deref() == Some("disabled") {
        return Err(ApiError::Unauthorized("账号已被禁用".to_string()));
    }

    if user.role.as_deref() != Some("admin") {
        return Err(ApiError::Forbidden("需要管理员权限".to_string()));
    }

    request
        .extensions_mut()
        .insert(AdminPrincipal { id: user.id });

    Ok(next.run(request).await)
}

fn bearer_token(headers: &HeaderMap) -> ApiResult<&str> {
    let authorization = headers
        .get("authorization")
        .and_then(|value| value.to_str().ok())
        .ok_or_else(|| ApiError::Unauthorized("缺少登录凭证".to_string()))?;

    authorization
        .strip_prefix("Bearer ")
        .map(str::trim)
        .filter(|token| !token.is_empty())
        .ok_or_else(|| ApiError::Unauthorized("缺少登录凭证".to_string()))
}

async fn session_user(pool: &PgPool, token: &str) -> ApiResult<SessionUserRow> {
    sqlx::query_as::<_, SessionUserRow>(
        r#"
        SELECT u.id, u.role, u.status
        FROM admin_sessions s
        JOIN users u ON u.id = s.user_id
        WHERE s.token = $1
          AND s.revoked_at IS NULL
        "#,
    )
    .bind(token)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| ApiError::Unauthorized("登录已失效".to_string()))
}

async fn create_session_token(pool: &PgPool, user_id: &str) -> ApiResult<String> {
    for _ in 0..3 {
        let token = random_session_token();
        let result = sqlx::query(
            r#"
            INSERT INTO admin_sessions (token, user_id)
            VALUES ($1, $2)
            ON CONFLICT (token) DO NOTHING
            "#,
        )
        .bind(&token)
        .bind(user_id)
        .execute(pool)
        .await?;

        if result.rows_affected() == 1 {
            return Ok(token);
        }
    }

    Err(ApiError::Storage("会话创建失败".to_string()))
}

fn random_session_token() -> String {
    let mut bytes = [0_u8; 32];
    rand::thread_rng().fill_bytes(&mut bytes);
    hex::encode(bytes)
}

fn generate_captcha_code() -> String {
    let mut rng = rand::thread_rng();

    (0..4)
        .map(|_| {
            let index = rng.gen_range(0..CAPTCHA_CHARS.len());
            CAPTCHA_CHARS[index] as char
        })
        .collect()
}

fn captcha_svg_data_url(code: &str) -> String {
    let mut rng = rand::thread_rng();
    let mut noise = String::new();

    for _ in 0..6 {
        let x1 = rng.gen_range(4..116);
        let y1 = rng.gen_range(6..38);
        let x2 = rng.gen_range(4..116);
        let y2 = rng.gen_range(6..38);
        let opacity: f32 = rng.gen_range(0.18..0.38);
        noise.push_str(&format!(
            r##"<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="#2563EB" stroke-width="1.2" opacity="{opacity:.2}"/>"##
        ));
    }

    let mut letters = String::new();
    for (index, ch) in code.chars().enumerate() {
        let x = 18 + index * 24;
        let y = rng.gen_range(27..34);
        let rotate = rng.gen_range(-12..13);
        letters.push_str(&format!(
            r##"<text x="{x}" y="{y}" transform="rotate({rotate} {x} {y})" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="700" fill="#111827">{ch}</text>"##
        ));
    }

    let svg = format!(
        r##"<svg xmlns="http://www.w3.org/2000/svg" width="120" height="44" viewBox="0 0 120 44">
<rect width="120" height="44" rx="12" fill="#F8FAFC"/>
<path d="M0 32 C24 18 42 45 66 28 S98 18 120 30" fill="none" stroke="#DBEAFE" stroke-width="7"/>
{noise}
{letters}
</svg>"##
    );

    format!(
        "data:image/svg+xml;utf8,{}",
        utf8_percent_encode(&svg, NON_ALPHANUMERIC)
    )
}

async fn read_text_field(
    mut field: axum::extract::multipart::Field<'_>,
    total: &mut usize,
) -> ApiResult<String> {
    let mut bytes = Vec::new();

    while let Some(chunk) = field
        .chunk()
        .await
        .map_err(|err| ApiError::BadRequest(err.to_string()))?
    {
        *total += chunk.len();
        if *total > MAX_MULTIPART_BYTES {
            return Err(ApiError::BadRequest("请求体过大".to_string()));
        }

        if bytes.len() + chunk.len() > MAX_TEXT_FIELD_SIZE {
            return Err(ApiError::BadRequest("请求体过大".to_string()));
        }

        bytes.extend_from_slice(&chunk);
    }

    String::from_utf8(bytes).map_err(|_| ApiError::BadRequest("请求体过大".to_string()))
}

async fn read_file_bytes(
    mut field: axum::extract::multipart::Field<'_>,
    total: &mut usize,
) -> ApiResult<Vec<u8>> {
    let mut bytes = Vec::new();

    while let Some(chunk) = field
        .chunk()
        .await
        .map_err(|err| ApiError::BadRequest(err.to_string()))?
    {
        *total += chunk.len();
        if *total > MAX_MULTIPART_BYTES {
            return Err(ApiError::BadRequest("请求体过大".to_string()));
        }

        if bytes.len() + chunk.len() > MAX_FILE_SIZE {
            return Err(ApiError::BadRequest("文件大小不能超过5MB".to_string()));
        }

        bytes.extend_from_slice(&chunk);
    }

    Ok(bytes)
}

async fn consume_ignored_field(
    mut field: axum::extract::multipart::Field<'_>,
    total: &mut usize,
) -> ApiResult<()> {
    while let Some(chunk) = field
        .chunk()
        .await
        .map_err(|err| ApiError::BadRequest(err.to_string()))?
    {
        *total += chunk.len();
        if *total > MAX_MULTIPART_BYTES {
            return Err(ApiError::BadRequest("请求体过大".to_string()));
        }
    }

    Ok(())
}

fn sanitize_original_file_name(file_name: &str) -> String {
    file_name
        .chars()
        .filter_map(|ch| {
            if ch.is_ascii_alphanumeric() || matches!(ch, '.' | '-' | '_') {
                Some(ch)
            } else if ch.is_whitespace() {
                Some('_')
            } else {
                None
            }
        })
        .collect()
}
