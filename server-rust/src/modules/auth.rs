use std::sync::OnceLock;

use axum::{
    extract::{DefaultBodyLimit, Multipart, Query, State},
    routing::{get, post},
    Json, Router,
};
use bcrypt::{hash, verify};
use chrono::{DateTime, Utc};
use regex::Regex;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use crate::{
    app::AppState,
    error::{ApiError, ApiResult},
    response::{ok, ApiEnvelope},
    storage::Storage,
};

const BCRYPT_COST: u32 = 10;
const MAX_FILE_SIZE: usize = 5 * 1024 * 1024;
const MAX_TEXT_FIELD_SIZE: usize = 1024;
const MAX_IGNORED_FIELD_BYTES: usize = MAX_FILE_SIZE + 1024 * 1024;
const ALLOWED_IMAGE_TYPES: [&str; 5] = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
];

pub fn router<S>() -> Router<AppState<S>>
where
    S: Storage,
{
    Router::new()
        .route("/api/auth/register", post(register::<S>))
        .route("/api/auth/login", post(login::<S>))
        .route("/api/auth/user-info", get(user_info::<S>))
        .route("/api/auth/update-payment-qr", post(update_payment_qr::<S>))
        .route_layer(DefaultBodyLimit::disable())
}

#[derive(Debug, Deserialize)]
struct RegisterRequest {
    phone: String,
    password: String,
    name: String,
    role: String,
}

#[derive(Debug, Deserialize)]
struct LoginRequest {
    phone: String,
    password: String,
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

    Ok(ok("注册成功", auth_response_from_row(row)))
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

    let password_hash = row.password.as_deref().unwrap_or_default();
    let password_matches = verify(&body.password, password_hash)
        .map_err(|err| ApiError::BadRequest(err.to_string()))?;

    if !password_matches {
        return Err(ApiError::Unauthorized("密码错误".to_string()));
    }

    if row.status.as_deref() == Some("disabled") {
        return Err(ApiError::Unauthorized("账号已被禁用".to_string()));
    }

    Ok(ok("登录成功", auth_response_from_row(row)))
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
    let mut ignored_field_bytes = 0usize;

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|err| ApiError::BadRequest(err.to_string()))?
    {
        let field_name = field.name().map(str::to_string);
        match field_name.as_deref() {
            Some("userId") => {
                user_id = Some(read_text_field(field).await?);
            }
            Some("file") => {
                let original_name = field
                    .file_name()
                    .map(sanitize_original_file_name)
                    .filter(|name| !name.is_empty())
                    .unwrap_or_else(|| "payment.png".to_string());
                let content_type = field.content_type().map(str::to_string);

                if !content_type
                    .as_deref()
                    .is_some_and(|value| ALLOWED_IMAGE_TYPES.contains(&value))
                {
                    return Err(ApiError::BadRequest("请上传收款码图片".to_string()));
                }

                let bytes = read_file_bytes(field).await?;
                if bytes.is_empty() {
                    return Err(ApiError::BadRequest("请上传收款码图片".to_string()));
                }

                file = Some(UploadedPaymentQr {
                    original_name,
                    content_type,
                    bytes,
                });
            }
            _ => consume_ignored_field(field, &mut ignored_field_bytes).await?,
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

    if body.name.trim().is_empty() {
        return Err(ApiError::BadRequest("姓名不能为空".to_string()));
    }

    if !matches!(body.role.as_str(), "owner" | "merchant") {
        return Err(ApiError::BadRequest(
            "角色必须为 owner 或 merchant".to_string(),
        ));
    }

    Ok(())
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

fn auth_response_from_row(row: AuthUserRow) -> AuthResponse {
    let id = row.id;

    AuthResponse {
        token: id.clone(),
        id,
        phone: row.phone.unwrap_or_default(),
        name: row.name.unwrap_or_default(),
        role: row.role.unwrap_or_default(),
    }
}

async fn read_text_field(mut field: axum::extract::multipart::Field<'_>) -> ApiResult<String> {
    let mut bytes = Vec::new();

    while let Some(chunk) = field
        .chunk()
        .await
        .map_err(|err| ApiError::BadRequest(err.to_string()))?
    {
        if bytes.len() + chunk.len() > MAX_TEXT_FIELD_SIZE {
            return Err(ApiError::BadRequest("请求体过大".to_string()));
        }

        bytes.extend_from_slice(&chunk);
    }

    String::from_utf8(bytes).map_err(|_| ApiError::BadRequest("请求体过大".to_string()))
}

async fn read_file_bytes(mut field: axum::extract::multipart::Field<'_>) -> ApiResult<Vec<u8>> {
    let mut bytes = Vec::new();

    while let Some(chunk) = field
        .chunk()
        .await
        .map_err(|err| ApiError::BadRequest(err.to_string()))?
    {
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
        if *total > MAX_IGNORED_FIELD_BYTES {
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
