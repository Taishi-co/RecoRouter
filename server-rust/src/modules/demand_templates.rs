use axum::{
    extract::{Path, Query, State},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use serde_json::{json, Map, Value};

use crate::{
    app::AppState,
    error::{ApiError, ApiResult},
    response::ok,
    storage::Storage,
};

pub fn router<S>() -> Router<AppState<S>>
where
    S: Storage,
{
    Router::new()
        .route(
            "/api/demand-templates",
            get(list_templates::<S>).post(create_template::<S>),
        )
        .route(
            "/api/demand-templates/:id",
            get(get_template::<S>)
                .put(update_template::<S>)
                .delete(delete_template::<S>),
        )
        .route(
            "/api/demand-templates/:id/set-default",
            post(set_default_template::<S>),
        )
}

#[derive(Debug, Deserialize)]
struct UserIdQuery {
    user_id: Option<String>,
}

#[derive(Debug, Deserialize)]
struct CreateTemplateRequest {
    user_id: String,
    template_name: String,
    cargo_name: String,
    cargo_type: Option<String>,
    weight: f64,
    volume: f64,
    pickup_address: String,
    pickup_lat: f64,
    pickup_lng: f64,
    delivery_address: String,
    delivery_lat: f64,
    delivery_lng: f64,
    remarks: Option<String>,
    estimated_distance: Option<f64>,
    estimated_fare: Option<f64>,
    is_default: Option<bool>,
}

#[derive(Debug, Deserialize)]
struct UpdateTemplateRequest {
    #[serde(flatten)]
    fields: Map<String, Value>,
}

async fn create_template<S>(
    State(state): State<AppState<S>>,
    Json(body): Json<CreateTemplateRequest>,
) -> ApiResult<Response>
where
    S: Storage,
{
    validate_required(&body.user_id, "用户ID不能为空")?;
    validate_required(&body.template_name, "模板名称不能为空")?;
    validate_required(&body.cargo_name, "货品名称不能为空")?;
    validate_required(&body.pickup_address, "取货地址不能为空")?;
    validate_required(&body.delivery_address, "送货地址不能为空")?;

    let cargo_type =
        normalize_optional_text(body.cargo_type).unwrap_or_else(|| "normal".to_string());
    validate_cargo_type(&cargo_type)?;
    let remarks = normalize_optional_text(body.remarks);
    let is_default = body.is_default.unwrap_or(false);

    let mut tx = state.db.begin().await?;
    if is_default {
        lock_default_scope(&mut tx, &body.user_id).await?;
        sqlx::query("UPDATE demand_templates SET is_default = false WHERE user_id = $1")
            .bind(&body.user_id)
            .execute(&mut *tx)
            .await?;
    }

    let template = sqlx::query_scalar::<_, Value>(
        r#"
        INSERT INTO demand_templates (
            user_id, template_name, cargo_name, cargo_type,
            weight, volume,
            pickup_address, pickup_lat, pickup_lng,
            delivery_address, delivery_lat, delivery_lng,
            remarks, estimated_distance, estimated_fare,
            use_count, is_default
        )
        VALUES (
            $1, $2, $3, $4,
            $5::numeric, $6::numeric,
            $7, $8::numeric, $9::numeric,
            $10, $11::numeric, $12::numeric,
            $13, $14::numeric, $15::numeric,
            0, $16
        )
        RETURNING row_to_json(demand_templates)
        "#,
    )
    .bind(&body.user_id)
    .bind(&body.template_name)
    .bind(&body.cargo_name)
    .bind(cargo_type)
    .bind(body.weight)
    .bind(body.volume)
    .bind(&body.pickup_address)
    .bind(body.pickup_lat)
    .bind(body.pickup_lng)
    .bind(&body.delivery_address)
    .bind(body.delivery_lat)
    .bind(body.delivery_lng)
    .bind(remarks)
    .bind(body.estimated_distance)
    .bind(body.estimated_fare)
    .bind(is_default)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(ok("模板创建成功", template).into_response())
}

async fn list_templates<S>(
    State(state): State<AppState<S>>,
    Query(query): Query<UserIdQuery>,
) -> ApiResult<Response>
where
    S: Storage,
{
    let Some(user_id) = non_empty(query.user_id) else {
        return Ok(code_400_body("用户ID不能为空"));
    };

    let templates = sqlx::query_scalar::<_, Value>(
        r#"
        SELECT row_to_json(template_row)
        FROM (
            SELECT *
            FROM demand_templates
            WHERE user_id = $1
            ORDER BY is_default DESC, use_count DESC, created_at DESC
        ) template_row
        "#,
    )
    .bind(user_id)
    .fetch_all(&state.db)
    .await?;

    Ok(ok("查询成功", templates).into_response())
}

async fn get_template<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
) -> ApiResult<Response>
where
    S: Storage,
{
    let template = fetch_template(&state.db, &id).await?;

    Ok(ok("查询成功", template).into_response())
}

async fn update_template<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
    Json(body): Json<UpdateTemplateRequest>,
) -> ApiResult<Response>
where
    S: Storage,
{
    let template_name = text_field(&body.fields, "template_name")?;
    let cargo_name = text_field(&body.fields, "cargo_name")?;
    let cargo_type = text_field(&body.fields, "cargo_type")?;
    if let Some(cargo_type) = cargo_type.as_deref() {
        validate_cargo_type(cargo_type)?;
    }
    let weight = number_field(&body.fields, "weight")?;
    let volume = number_field(&body.fields, "volume")?;
    let pickup_address = text_field(&body.fields, "pickup_address")?;
    let pickup_lat = number_field(&body.fields, "pickup_lat")?;
    let pickup_lng = number_field(&body.fields, "pickup_lng")?;
    let delivery_address = text_field(&body.fields, "delivery_address")?;
    let delivery_lat = number_field(&body.fields, "delivery_lat")?;
    let delivery_lng = number_field(&body.fields, "delivery_lng")?;
    let remarks = text_field(&body.fields, "remarks")?;
    let estimated_distance = number_field(&body.fields, "estimated_distance")?;
    let estimated_fare = number_field(&body.fields, "estimated_fare")?;
    let is_default = bool_field(&body.fields, "is_default")?;

    let has_template_name = body.fields.contains_key("template_name");
    let has_cargo_name = body.fields.contains_key("cargo_name");
    let has_cargo_type = body.fields.contains_key("cargo_type");
    let has_weight = body.fields.contains_key("weight");
    let has_volume = body.fields.contains_key("volume");
    let has_pickup_address = body.fields.contains_key("pickup_address");
    let has_pickup_lat = body.fields.contains_key("pickup_lat");
    let has_pickup_lng = body.fields.contains_key("pickup_lng");
    let has_delivery_address = body.fields.contains_key("delivery_address");
    let has_delivery_lat = body.fields.contains_key("delivery_lat");
    let has_delivery_lng = body.fields.contains_key("delivery_lng");
    let has_remarks = body.fields.contains_key("remarks");
    let has_estimated_distance = body.fields.contains_key("estimated_distance");
    let has_estimated_fare = body.fields.contains_key("estimated_fare");
    let has_is_default = body.fields.contains_key("is_default");

    let mut tx = state.db.begin().await?;
    let existing: Option<(Option<String>, Option<String>)> = sqlx::query_as(
        "SELECT user_id, template_name FROM demand_templates WHERE id = $1 FOR UPDATE",
    )
    .bind(&id)
    .fetch_optional(&mut *tx)
    .await?;
    let (user_id, old_template_name) =
        existing.ok_or_else(|| ApiError::NotFound("模板不存在".to_string()))?;

    if is_default == Some(true) {
        if let Some(user_id) = user_id.as_deref() {
            lock_default_scope(&mut tx, user_id).await?;
            sqlx::query(
                "UPDATE demand_templates SET is_default = false WHERE user_id = $1 AND id <> $2",
            )
            .bind(user_id)
            .bind(&id)
            .execute(&mut *tx)
            .await?;
        }
    }

    let template = sqlx::query_scalar::<_, Value>(
        r#"
        UPDATE demand_templates
        SET template_name = CASE WHEN $2 THEN $3 ELSE template_name END,
            cargo_name = CASE WHEN $4 THEN $5 ELSE cargo_name END,
            cargo_type = CASE WHEN $6 THEN $7 ELSE cargo_type END,
            weight = CASE WHEN $8 THEN $9::numeric ELSE weight END,
            volume = CASE WHEN $10 THEN $11::numeric ELSE volume END,
            pickup_address = CASE WHEN $12 THEN $13 ELSE pickup_address END,
            pickup_lat = CASE WHEN $14 THEN $15::numeric ELSE pickup_lat END,
            pickup_lng = CASE WHEN $16 THEN $17::numeric ELSE pickup_lng END,
            delivery_address = CASE WHEN $18 THEN $19 ELSE delivery_address END,
            delivery_lat = CASE WHEN $20 THEN $21::numeric ELSE delivery_lat END,
            delivery_lng = CASE WHEN $22 THEN $23::numeric ELSE delivery_lng END,
            remarks = CASE WHEN $24 THEN $25 ELSE remarks END,
            estimated_distance = CASE WHEN $26 THEN $27::numeric ELSE estimated_distance END,
            estimated_fare = CASE WHEN $28 THEN $29::numeric ELSE estimated_fare END,
            is_default = CASE WHEN $30 THEN $31 ELSE is_default END,
            updated_at = now()
        WHERE id = $1
        RETURNING row_to_json(demand_templates)
        "#,
    )
    .bind(&id)
    .bind(has_template_name)
    .bind(&template_name)
    .bind(has_cargo_name)
    .bind(&cargo_name)
    .bind(has_cargo_type)
    .bind(&cargo_type)
    .bind(has_weight)
    .bind(weight)
    .bind(has_volume)
    .bind(volume)
    .bind(has_pickup_address)
    .bind(&pickup_address)
    .bind(has_pickup_lat)
    .bind(pickup_lat)
    .bind(has_pickup_lng)
    .bind(pickup_lng)
    .bind(has_delivery_address)
    .bind(&delivery_address)
    .bind(has_delivery_lat)
    .bind(delivery_lat)
    .bind(has_delivery_lng)
    .bind(delivery_lng)
    .bind(has_remarks)
    .bind(&remarks)
    .bind(has_estimated_distance)
    .bind(estimated_distance)
    .bind(has_estimated_fare)
    .bind(estimated_fare)
    .bind(has_is_default)
    .bind(is_default)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| ApiError::NotFound("模板不存在".to_string()))?;

    if let (Some(old_name), Some(new_name)) =
        (old_template_name.as_deref(), template_name.as_deref())
    {
        if old_name != new_name {
            sqlx::query(
                r#"
                UPDATE demand_schedules
                SET schedule_name = $2,
                    updated_at = now()
                WHERE template_id = $1
                  AND schedule_name = $3
                "#,
            )
            .bind(&id)
            .bind(new_name)
            .bind(old_name)
            .execute(&mut *tx)
            .await?;
        }
    }

    tx.commit().await?;

    Ok(ok("模板更新成功", template).into_response())
}

async fn delete_template<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
) -> ApiResult<Response>
where
    S: Storage,
{
    let mut tx = state.db.begin().await?;
    let exists: Option<String> =
        sqlx::query_scalar("SELECT id FROM demand_templates WHERE id = $1 FOR UPDATE")
            .bind(&id)
            .fetch_optional(&mut *tx)
            .await?;

    if exists.is_none() {
        return Err(ApiError::NotFound("模板不存在".to_string()));
    }

    let linked_schedule_count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM demand_schedules WHERE template_id = $1")
            .bind(&id)
            .fetch_one(&mut *tx)
            .await?;

    if linked_schedule_count > 0 {
        sqlx::query(
            r#"
            UPDATE demand_schedules
            SET status = 'cancelled',
                updated_at = now()
            WHERE template_id = $1
              AND status = 'active'
            "#,
        )
        .bind(&id)
        .execute(&mut *tx)
        .await?;

        sqlx::query("DELETE FROM demand_schedules WHERE template_id = $1")
            .bind(&id)
            .execute(&mut *tx)
            .await?;
    }

    sqlx::query("DELETE FROM demand_templates WHERE id = $1")
        .bind(&id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;

    let message = if linked_schedule_count > 0 {
        format!("模板删除成功，同时删除了 {linked_schedule_count} 个定时计划")
    } else {
        "模板删除成功".to_string()
    };

    Ok(ok(message, Value::Null).into_response())
}

async fn set_default_template<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
) -> ApiResult<Response>
where
    S: Storage,
{
    let mut tx = state.db.begin().await?;
    let user_id: Option<String> =
        sqlx::query_scalar("SELECT user_id FROM demand_templates WHERE id = $1 FOR UPDATE")
            .bind(&id)
            .fetch_optional(&mut *tx)
            .await?
            .flatten();
    let user_id = user_id.ok_or_else(|| ApiError::NotFound("模板不存在".to_string()))?;

    lock_default_scope(&mut tx, &user_id).await?;
    sqlx::query("UPDATE demand_templates SET is_default = false WHERE user_id = $1 AND id <> $2")
        .bind(&user_id)
        .bind(&id)
        .execute(&mut *tx)
        .await?;

    let template = sqlx::query_scalar::<_, Value>(
        r#"
        UPDATE demand_templates
        SET is_default = true,
            updated_at = now()
        WHERE id = $1
        RETURNING row_to_json(demand_templates)
        "#,
    )
    .bind(&id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| ApiError::NotFound("模板不存在".to_string()))?;

    tx.commit().await?;

    Ok(ok("设置成功", template).into_response())
}

async fn fetch_template(pool: &sqlx::PgPool, id: &str) -> ApiResult<Value> {
    sqlx::query_scalar::<_, Value>(
        "SELECT row_to_json(demand_templates) FROM demand_templates WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| ApiError::NotFound("模板不存在".to_string()))
}

fn code_400_body(message: &str) -> Response {
    Json(json!({
        "code": 400,
        "message": message,
        "data": Value::Null
    }))
    .into_response()
}

fn validate_required(value: &str, message: &str) -> ApiResult<()> {
    if value.trim().is_empty() {
        return Err(ApiError::BadRequest(message.to_string()));
    }

    Ok(())
}

fn validate_cargo_type(value: &str) -> ApiResult<()> {
    if matches!(value, "normal" | "fresh" | "fragile") {
        Ok(())
    } else {
        Err(ApiError::BadRequest("货物类型不正确".to_string()))
    }
}

fn normalize_optional_text(value: Option<String>) -> Option<String> {
    value.and_then(|value| {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    })
}

fn non_empty(value: Option<String>) -> Option<String> {
    normalize_optional_text(value)
}

fn text_field(fields: &Map<String, Value>, key: &str) -> ApiResult<Option<String>> {
    match fields.get(key) {
        Some(Value::Null) | None => Ok(None),
        Some(Value::String(value)) => Ok(Some(value.clone())),
        Some(_) => Err(ApiError::BadRequest(format!("{key} 参数不正确"))),
    }
}

fn number_field(fields: &Map<String, Value>, key: &str) -> ApiResult<Option<f64>> {
    match fields.get(key) {
        Some(Value::Null) | None => Ok(None),
        Some(Value::Number(value)) => value
            .as_f64()
            .map(Some)
            .ok_or_else(|| ApiError::BadRequest(format!("{key} 参数不正确"))),
        Some(_) => Err(ApiError::BadRequest(format!("{key} 参数不正确"))),
    }
}

fn bool_field(fields: &Map<String, Value>, key: &str) -> ApiResult<Option<bool>> {
    match fields.get(key) {
        Some(Value::Null) | None => Ok(None),
        Some(Value::Bool(value)) => Ok(Some(*value)),
        Some(_) => Err(ApiError::BadRequest(format!("{key} 参数不正确"))),
    }
}

async fn lock_default_scope(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    user_id: &str,
) -> ApiResult<()> {
    sqlx::query("SELECT pg_advisory_xact_lock(hashtext($1))")
        .bind(format!("demand_templates_default:{user_id}"))
        .execute(&mut **tx)
        .await?;

    Ok(())
}
