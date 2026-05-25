use std::sync::OnceLock;

use axum::{
    extract::State,
    routing::{get, post},
    Json, Router,
};
use bcrypt::{hash, verify};
use chrono::{DateTime, NaiveDate, Utc};
use rand::Rng;
use regex::Regex;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use crate::{
    app::AppState,
    error::{ApiError, ApiResult},
    response::{empty_message, ok, ApiEnvelope, EmptyMessage},
    storage::Storage,
};

const BCRYPT_COST: u32 = 10;
const DEFAULT_USER_ID: &str = "7428999e-92fa-4fec-9f75-09087edbf244";

pub fn router<S>() -> Router<AppState<S>>
where
    S: Storage,
{
    Router::new()
        .route(
            "/api/account-settings/profile",
            get(get_profile::<S>).put(update_profile::<S>),
        )
        .route(
            "/api/account-settings/send-sms-code",
            post(send_sms_code::<S>),
        )
        .route(
            "/api/account-settings/change-phone",
            post(change_phone::<S>),
        )
        .route(
            "/api/account-settings/change-password",
            post(change_password::<S>),
        )
        .route("/api/account-settings/logout", post(logout::<S>))
}

#[derive(Debug, Deserialize)]
struct UpdateProfileRequest {
    user_id: Option<String>,
    #[serde(rename = "userId")]
    user_id_camel: Option<String>,
    avatar_url: Option<String>,
    nickname: Option<String>,
    gender: Option<String>,
    birthday: Option<String>,
}

#[derive(Debug, Deserialize)]
struct SendSmsCodeRequest {
    phone: String,
    #[serde(rename = "type")]
    code_type: String,
}

#[derive(Debug, Deserialize)]
struct ChangePhoneRequest {
    user_id: Option<String>,
    #[serde(rename = "userId")]
    user_id_camel: Option<String>,
    code: String,
    #[serde(rename = "newPhone")]
    new_phone: String,
}

#[derive(Debug, Deserialize)]
struct ChangePasswordRequest {
    user_id: Option<String>,
    #[serde(rename = "userId")]
    user_id_camel: Option<String>,
    #[serde(rename = "oldPassword")]
    old_password: String,
    #[serde(rename = "newPassword")]
    new_password: String,
}

#[derive(Debug, Serialize)]
struct SmsCodeResponse {
    code: String,
}

#[derive(Debug, FromRow, Serialize)]
struct ProfileRow {
    id: String,
    phone: Option<String>,
    nickname: Option<String>,
    avatar_url: Option<String>,
    gender: Option<String>,
    birthday: Option<NaiveDate>,
    role: Option<String>,
    name: Option<String>,
    created_at: Option<DateTime<Utc>>,
}

#[derive(Debug, FromRow)]
struct PasswordRow {
    password: Option<String>,
}

#[derive(Debug, FromRow)]
struct SmsCodeRow {
    id: String,
}

async fn get_profile<S>(
    State(state): State<AppState<S>>,
) -> ApiResult<Json<ApiEnvelope<ProfileRow>>>
where
    S: Storage,
{
    let profile = fetch_profile(&state.db, DEFAULT_USER_ID).await?;

    Ok(ok("获取成功", profile))
}

async fn update_profile<S>(
    State(state): State<AppState<S>>,
    Json(body): Json<UpdateProfileRequest>,
) -> ApiResult<Json<ApiEnvelope<serde_json::Value>>>
where
    S: Storage,
{
    if body.avatar_url.is_none()
        && body.nickname.is_none()
        && body.gender.is_none()
        && body.birthday.is_none()
    {
        return Err(ApiError::BadRequest("没有需要更新的字段".to_string()));
    }

    if let Some(gender) = body.gender.as_deref() {
        if !matches!(gender, "male" | "female" | "secret") {
            return Err(ApiError::BadRequest("性别参数不正确".to_string()));
        }
    }

    let birthday = body.birthday.as_deref().map(parse_birthday).transpose()?;
    let user_id = resolve_user_id(body.user_id, body.user_id_camel);
    let profile = sqlx::query_scalar::<_, serde_json::Value>(
        r#"
        UPDATE users
        SET avatar_url = COALESCE($2, avatar_url),
            nickname = COALESCE($3, nickname),
            gender = COALESCE($4, gender),
            birthday = COALESCE($5, birthday),
            updated_at = now()
        WHERE id = $1
        RETURNING row_to_json(users)
        "#,
    )
    .bind(&user_id)
    .bind(body.avatar_url)
    .bind(body.nickname)
    .bind(body.gender)
    .bind(birthday)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| ApiError::BadRequest("用户不存在".to_string()))?;

    Ok(ok("更新成功", profile))
}

async fn send_sms_code<S>(
    State(state): State<AppState<S>>,
    Json(body): Json<SendSmsCodeRequest>,
) -> ApiResult<Json<ApiEnvelope<SmsCodeResponse>>>
where
    S: Storage,
{
    validate_phone(&body.phone)?;
    if body.code_type.trim().is_empty() {
        return Err(ApiError::BadRequest("验证码类型不能为空".to_string()));
    }

    let recent_code: Option<String> = sqlx::query_scalar(
        r#"
        SELECT id
        FROM sms_codes
        WHERE phone = $1
          AND type = $2
          AND created_at > now() - interval '1 minute'
        LIMIT 1
        "#,
    )
    .bind(&body.phone)
    .bind(&body.code_type)
    .fetch_optional(&state.db)
    .await?;

    if recent_code.is_some() {
        return Err(ApiError::BadRequest("发送过于频繁，请稍后再试".to_string()));
    }

    let code = format!("{:06}", rand::thread_rng().gen_range(0..1_000_000));
    sqlx::query(
        r#"
        INSERT INTO sms_codes (phone, code, type, is_used, expires_at)
        VALUES ($1, $2, $3, false, now() + interval '5 minutes')
        "#,
    )
    .bind(&body.phone)
    .bind(&code)
    .bind(&body.code_type)
    .execute(&state.db)
    .await?;

    Ok(ok("验证码已发送", SmsCodeResponse { code }))
}

async fn change_phone<S>(
    State(state): State<AppState<S>>,
    Json(body): Json<ChangePhoneRequest>,
) -> ApiResult<Json<EmptyMessage>>
where
    S: Storage,
{
    validate_phone(&body.new_phone)?;
    let user_id = resolve_user_id(body.user_id, body.user_id_camel);

    let code = sqlx::query_as::<_, SmsCodeRow>(
        r#"
        SELECT id
        FROM sms_codes
        WHERE phone = $1
          AND code = $2
          AND is_used = false
          AND created_at > now() - interval '5 minutes'
          AND (expires_at IS NULL OR expires_at > now())
        ORDER BY created_at DESC
        LIMIT 1
        "#,
    )
    .bind(&body.new_phone)
    .bind(&body.code)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| ApiError::BadRequest("验证码无效或已过期".to_string()))?;

    let duplicate_user: Option<String> =
        sqlx::query_scalar("SELECT id FROM users WHERE phone = $1 AND id <> $2 LIMIT 1")
            .bind(&body.new_phone)
            .bind(&user_id)
            .fetch_optional(&state.db)
            .await?;

    if duplicate_user.is_some() {
        return Err(ApiError::BadRequest("该手机号已被使用".to_string()));
    }

    let result = sqlx::query("UPDATE users SET phone = $1, updated_at = now() WHERE id = $2")
        .bind(&body.new_phone)
        .bind(&user_id)
        .execute(&state.db)
        .await?;

    if result.rows_affected() == 0 {
        return Err(ApiError::BadRequest("用户不存在".to_string()));
    }

    sqlx::query("UPDATE sms_codes SET is_used = true WHERE id = $1")
        .bind(code.id)
        .execute(&state.db)
        .await?;

    Ok(empty_message("手机号修改成功"))
}

async fn change_password<S>(
    State(state): State<AppState<S>>,
    Json(body): Json<ChangePasswordRequest>,
) -> ApiResult<Json<EmptyMessage>>
where
    S: Storage,
{
    if body.new_password.len() < 6 {
        return Err(ApiError::BadRequest("密码至少6位".to_string()));
    }

    let user_id = resolve_user_id(body.user_id, body.user_id_camel);
    let user = sqlx::query_as::<_, PasswordRow>("SELECT password FROM users WHERE id = $1")
        .bind(&user_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| ApiError::BadRequest("用户不存在".to_string()))?;

    let password_hash = user.password.as_deref().unwrap_or_default();
    let password_matches = verify(&body.old_password, password_hash)
        .map_err(|err| ApiError::BadRequest(err.to_string()))?;

    if !password_matches {
        return Err(ApiError::BadRequest("原密码错误".to_string()));
    }

    let new_hash = hash(&body.new_password, BCRYPT_COST)
        .map_err(|err| ApiError::BadRequest(err.to_string()))?;

    sqlx::query("UPDATE users SET password = $1, updated_at = now() WHERE id = $2")
        .bind(new_hash)
        .bind(&user_id)
        .execute(&state.db)
        .await?;

    Ok(empty_message("密码修改成功，请重新登录"))
}

async fn logout<S>(State(_state): State<AppState<S>>) -> ApiResult<Json<EmptyMessage>>
where
    S: Storage,
{
    Ok(empty_message("退出成功"))
}

async fn fetch_profile(db: &sqlx::PgPool, user_id: &str) -> ApiResult<ProfileRow> {
    sqlx::query_as::<_, ProfileRow>(
        r#"
        SELECT id, phone, nickname, avatar_url, gender, birthday, role, name, created_at
        FROM users
        WHERE id = $1
        "#,
    )
    .bind(user_id)
    .fetch_optional(db)
    .await?
    .ok_or_else(|| ApiError::BadRequest("用户不存在".to_string()))
}

fn resolve_user_id(user_id: Option<String>, user_id_camel: Option<String>) -> String {
    user_id
        .or(user_id_camel)
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| DEFAULT_USER_ID.to_string())
}

fn parse_birthday(value: &str) -> ApiResult<NaiveDate> {
    NaiveDate::parse_from_str(value, "%Y-%m-%d")
        .map_err(|_| ApiError::BadRequest("生日格式不正确".to_string()))
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
