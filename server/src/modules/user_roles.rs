use axum::{
    extract::{Query, State},
    routing::{get, post},
    Json, Router,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, Postgres, Transaction};

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
        .route("/api/user-roles/my-roles", get(get_my_roles::<S>))
        .route("/api/user-roles/active", get(get_active_role::<S>))
        .route("/api/user-roles/create", post(create_role::<S>))
        .route("/api/user-roles/switch", post(switch_role::<S>))
}

#[derive(Debug, Deserialize)]
struct UserIdQuery {
    #[serde(rename = "userId")]
    user_id: Option<String>,
    #[serde(rename = "user_id")]
    user_id_snake: Option<String>,
}

#[derive(Debug, Deserialize)]
struct CreateRoleRequest {
    #[serde(rename = "userId")]
    user_id: String,
    role: String,
}

#[derive(Debug, Deserialize)]
struct SwitchRoleRequest {
    #[serde(rename = "userId")]
    user_id: String,
    #[serde(rename = "roleId")]
    role_id: String,
}

#[derive(Debug, FromRow, Serialize)]
struct UserRoleRow {
    id: String,
    user_id: Option<String>,
    role: Option<String>,
    is_active: Option<bool>,
    status: Option<String>,
    created_at: Option<DateTime<Utc>>,
    updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, FromRow)]
struct SwitchUserRow {
    id: String,
    username: Option<String>,
    phone: Option<String>,
    name: Option<String>,
    avatar_url: Option<String>,
    wechat_payment_qr: Option<String>,
    credit_score: Option<i32>,
    created_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize)]
struct SwitchRoleResponse {
    id: String,
    username: Option<String>,
    phone: Option<String>,
    name: Option<String>,
    role: Option<String>,
    avatar_url: Option<String>,
    wechat_payment_qr: Option<String>,
    credit_score: Option<i32>,
    created_at: Option<DateTime<Utc>>,
    roles: Vec<String>,
    #[serde(rename = "switchTime")]
    switch_time: DateTime<Utc>,
}

async fn get_my_roles<S>(
    State(state): State<AppState<S>>,
    Query(query): Query<UserIdQuery>,
) -> ApiResult<Json<ApiEnvelope<Vec<UserRoleRow>>>>
where
    S: Storage,
{
    let user_id = require_user_id(query.user_id.or(query.user_id_snake))?;
    let mut roles = fetch_active_roles(&state.db, &user_id).await?;

    if roles.is_empty() {
        roles.push(create_default_role(&state.db, &user_id).await?);
    }

    Ok(ok("查询成功", roles))
}

async fn get_active_role<S>(
    State(state): State<AppState<S>>,
    Query(query): Query<UserIdQuery>,
) -> ApiResult<Json<ApiEnvelope<UserRoleRow>>>
where
    S: Storage,
{
    let user_id = require_user_id(query.user_id.or(query.user_id_snake))?;

    let active_role = sqlx::query_as::<_, UserRoleRow>(
        r#"
        SELECT id, user_id, role, is_active, status, created_at, updated_at
        FROM user_roles
        WHERE user_id = $1
          AND is_active = true
          AND status = 'active'
        ORDER BY created_at DESC
        LIMIT 1
        "#,
    )
    .bind(&user_id)
    .fetch_optional(&state.db)
    .await?;

    let role = match active_role {
        Some(role) => role,
        None => ensure_default_active_role(&state.db, &user_id).await?,
    };

    Ok(ok("查询成功", role))
}

async fn create_role<S>(
    State(state): State<AppState<S>>,
    Json(body): Json<CreateRoleRequest>,
) -> ApiResult<Json<ApiEnvelope<UserRoleRow>>>
where
    S: Storage,
{
    let user_id = require_user_id(Some(body.user_id))?;
    validate_role(&body.role)?;

    let mut tx = state.db.begin().await?;
    ensure_user_exists(&mut tx, &user_id).await?;

    let existing_role: Option<String> = sqlx::query_scalar(
        r#"
        SELECT id
        FROM user_roles
        WHERE user_id = $1
          AND role = $2
          AND status = 'active'
        LIMIT 1
        "#,
    )
    .bind(&user_id)
    .bind(&body.role)
    .fetch_optional(&mut *tx)
    .await?;

    if existing_role.is_some() {
        return Err(ApiError::Conflict(
            "您已经拥有该角色，无需重复创建".to_string(),
        ));
    }

    let role_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM user_roles WHERE user_id = $1 AND status = 'active'",
    )
    .bind(&user_id)
    .fetch_one(&mut *tx)
    .await?;
    let is_first_role = role_count == 0;

    let new_role = insert_role(&mut tx, &user_id, Some(&body.role), is_first_role).await?;

    if is_first_role {
        sqlx::query("UPDATE users SET role = $1, updated_at = now() WHERE id = $2")
            .bind(&body.role)
            .bind(&user_id)
            .execute(&mut *tx)
            .await?;
    }

    tx.commit().await?;

    Ok(ok("角色创建成功", new_role))
}

async fn switch_role<S>(
    State(state): State<AppState<S>>,
    Json(body): Json<SwitchRoleRequest>,
) -> ApiResult<Json<ApiEnvelope<SwitchRoleResponse>>>
where
    S: Storage,
{
    let user_id = require_user_id(Some(body.user_id))?;
    let role_id = body.role_id.trim().to_string();
    if role_id.is_empty() {
        return Err(ApiError::BadRequest("角色ID不能为空".to_string()));
    }

    let mut tx = state.db.begin().await?;

    let target_role = sqlx::query_as::<_, UserRoleRow>(
        r#"
        SELECT id, user_id, role, is_active, status, created_at, updated_at
        FROM user_roles
        WHERE id = $1
          AND user_id = $2
          AND status = 'active'
        FOR UPDATE
        "#,
    )
    .bind(&role_id)
    .bind(&user_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| ApiError::NotFound("角色不存在或已被禁用".to_string()))?;

    sqlx::query(
        "UPDATE user_roles SET is_active = false, updated_at = now() WHERE user_id = $1 AND status = 'active'",
    )
    .bind(&user_id)
    .execute(&mut *tx)
    .await?;

    sqlx::query("UPDATE user_roles SET is_active = true, updated_at = now() WHERE id = $1")
        .bind(&role_id)
        .execute(&mut *tx)
        .await?;

    sqlx::query("UPDATE users SET role = $1, updated_at = now() WHERE id = $2")
        .bind(&target_role.role)
        .bind(&user_id)
        .execute(&mut *tx)
        .await?;

    let user = sqlx::query_as::<_, SwitchUserRow>(
        r#"
        SELECT id, username, phone, name, avatar_url, wechat_payment_qr, credit_score, created_at
        FROM users
        WHERE id = $1
        "#,
    )
    .bind(&user_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| ApiError::BadRequest("用户不存在".to_string()))?;

    let roles: Vec<Option<String>> = sqlx::query_scalar(
        r#"
        SELECT role
        FROM user_roles
        WHERE user_id = $1
          AND status = 'active'
        ORDER BY created_at ASC
        "#,
    )
    .bind(&user_id)
    .fetch_all(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(ok(
        "角色切换成功",
        SwitchRoleResponse {
            id: user.id,
            username: user.username,
            phone: user.phone,
            name: user.name,
            role: target_role.role,
            avatar_url: user.avatar_url,
            wechat_payment_qr: user.wechat_payment_qr,
            credit_score: user.credit_score,
            created_at: user.created_at,
            roles: roles.into_iter().flatten().collect(),
            switch_time: Utc::now(),
        },
    ))
}

async fn fetch_active_roles(db: &sqlx::PgPool, user_id: &str) -> ApiResult<Vec<UserRoleRow>> {
    Ok(sqlx::query_as::<_, UserRoleRow>(
        r#"
        SELECT id, user_id, role, is_active, status, created_at, updated_at
        FROM user_roles
        WHERE user_id = $1
          AND status = 'active'
        ORDER BY created_at DESC
        "#,
    )
    .bind(user_id)
    .fetch_all(db)
    .await?)
}

async fn ensure_default_active_role(db: &sqlx::PgPool, user_id: &str) -> ApiResult<UserRoleRow> {
    let default_role = fetch_user_default_role(db, user_id).await?;
    let existing_role = sqlx::query_as::<_, UserRoleRow>(
        r#"
        SELECT id, user_id, role, is_active, status, created_at, updated_at
        FROM user_roles
        WHERE user_id = $1
          AND role IS NOT DISTINCT FROM $2
          AND status = 'active'
        LIMIT 1
        "#,
    )
    .bind(user_id)
    .bind(&default_role)
    .fetch_optional(db)
    .await?;

    match existing_role {
        Some(role) => {
            sqlx::query("UPDATE user_roles SET is_active = true, updated_at = now() WHERE id = $1")
                .bind(&role.id)
                .execute(db)
                .await?;

            Ok(UserRoleRow {
                is_active: Some(true),
                ..role
            })
        }
        None => insert_role_pool(db, user_id, default_role.as_deref(), true).await,
    }
}

async fn create_default_role(db: &sqlx::PgPool, user_id: &str) -> ApiResult<UserRoleRow> {
    let default_role = fetch_user_default_role(db, user_id).await?;
    insert_role_pool(db, user_id, default_role.as_deref(), true).await
}

async fn fetch_user_default_role(db: &sqlx::PgPool, user_id: &str) -> ApiResult<Option<String>> {
    let role: Option<Option<String>> = sqlx::query_scalar("SELECT role FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_optional(db)
        .await?;

    role.ok_or_else(|| ApiError::NotFound("用户不存在".to_string()))
}

async fn insert_role(
    tx: &mut Transaction<'_, Postgres>,
    user_id: &str,
    role: Option<&str>,
    is_active: bool,
) -> ApiResult<UserRoleRow> {
    Ok(sqlx::query_as::<_, UserRoleRow>(
        r#"
        INSERT INTO user_roles (user_id, role, is_active, status)
        VALUES ($1, $2, $3, 'active')
        RETURNING id, user_id, role, is_active, status, created_at, updated_at
        "#,
    )
    .bind(user_id)
    .bind(role)
    .bind(is_active)
    .fetch_one(&mut **tx)
    .await?)
}

async fn insert_role_pool(
    db: &sqlx::PgPool,
    user_id: &str,
    role: Option<&str>,
    is_active: bool,
) -> ApiResult<UserRoleRow> {
    Ok(sqlx::query_as::<_, UserRoleRow>(
        r#"
        INSERT INTO user_roles (user_id, role, is_active, status)
        VALUES ($1, $2, $3, 'active')
        RETURNING id, user_id, role, is_active, status, created_at, updated_at
        "#,
    )
    .bind(user_id)
    .bind(role)
    .bind(is_active)
    .fetch_one(db)
    .await?)
}

async fn ensure_user_exists(tx: &mut Transaction<'_, Postgres>, user_id: &str) -> ApiResult<()> {
    let exists: bool = sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM users WHERE id = $1)")
        .bind(user_id)
        .fetch_one(&mut **tx)
        .await?;

    if exists {
        Ok(())
    } else {
        Err(ApiError::NotFound("用户不存在".to_string()))
    }
}

fn require_user_id(user_id: Option<String>) -> ApiResult<String> {
    user_id
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .ok_or_else(|| ApiError::BadRequest("用户ID不能为空".to_string()))
}

fn validate_role(role: &str) -> ApiResult<()> {
    if matches!(role, "owner" | "merchant" | "enterprise") {
        Ok(())
    } else {
        Err(ApiError::BadRequest(
            "角色必须为 owner、merchant 或 enterprise".to_string(),
        ))
    }
}
