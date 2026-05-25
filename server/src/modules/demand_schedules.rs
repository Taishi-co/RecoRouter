use axum::{
    extract::{Path, Query, State},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use chrono::{DateTime, Duration, Months, NaiveDate, NaiveDateTime, NaiveTime, Utc};
use serde::Deserialize;
use serde_json::{json, Map, Value};
use sqlx::FromRow;

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
            "/api/demand-schedules",
            get(list_schedules::<S>).post(create_schedule::<S>),
        )
        .route(
            "/api/demand-schedules/:id",
            get(get_schedule::<S>)
                .put(update_schedule::<S>)
                .delete(delete_schedule::<S>),
        )
        .route("/api/demand-schedules/:id/pause", post(pause_schedule::<S>))
        .route(
            "/api/demand-schedules/:id/resume",
            post(resume_schedule::<S>),
        )
        .route(
            "/api/demand-schedules/:id/publish-now",
            post(publish_now::<S>),
        )
        .route("/api/demand-schedules/:id/logs", get(get_logs::<S>))
}

#[derive(Debug, Deserialize)]
struct UserIdQuery {
    user_id: Option<String>,
}

#[derive(Debug, Deserialize)]
struct CreateScheduleRequest {
    user_id: String,
    template_id: String,
    schedule_name: String,
    schedule_type: String,
    interval_days: Option<i32>,
    base_date: String,
    base_time: String,
    pickup_time_offset: Option<String>,
    max_publish_count: Option<i32>,
    end_time: Option<String>,
}

#[derive(Debug, Deserialize)]
struct UpdateScheduleRequest {
    #[serde(flatten)]
    fields: Map<String, Value>,
}

#[derive(Debug, Deserialize)]
struct PublishNowRequest {
    user_id: Option<String>,
}

#[derive(Debug, FromRow)]
struct ExistingScheduleRow {
    base_date: Option<NaiveDate>,
    base_time: Option<String>,
    schedule_type: Option<String>,
    interval_days: Option<i32>,
}

#[derive(Debug, FromRow)]
struct SchedulePublishRow {
    id: String,
    user_id: Option<String>,
    template_id: Option<String>,
    pickup_time_offset: Option<String>,
    status: Option<String>,
}

#[derive(Debug, FromRow)]
struct TemplatePublishRow {
    id: String,
    cargo_name: Option<String>,
    cargo_type: Option<String>,
    weight: Option<rust_decimal::Decimal>,
    volume: Option<rust_decimal::Decimal>,
    pickup_address: Option<String>,
    pickup_lat: Option<rust_decimal::Decimal>,
    pickup_lng: Option<rust_decimal::Decimal>,
    delivery_address: Option<String>,
    delivery_lat: Option<rust_decimal::Decimal>,
    delivery_lng: Option<rust_decimal::Decimal>,
    remarks: Option<String>,
}

async fn create_schedule<S>(
    State(state): State<AppState<S>>,
    Json(body): Json<CreateScheduleRequest>,
) -> ApiResult<Response>
where
    S: Storage,
{
    validate_required(&body.user_id, "用户ID不能为空")?;
    validate_required(&body.template_id, "模板ID不能为空")?;
    validate_required(&body.schedule_name, "计划名称不能为空")?;
    validate_schedule_type(&body.schedule_type)?;
    validate_required(&body.base_date, "基准日期不能为空")?;
    validate_required(&body.base_time, "基准时间不能为空")?;
    if body.schedule_type == "interval" && body.interval_days.unwrap_or(0) <= 0 {
        return Err(ApiError::BadRequest(
            "interval_days 参数不能为空".to_string(),
        ));
    }
    let interval_days = body.interval_days;
    if interval_days.is_some_and(|value| value <= 0) {
        return Err(ApiError::BadRequest(
            "interval_days 参数不能为空".to_string(),
        ));
    }
    if body.max_publish_count.is_some_and(|value| value <= 0) {
        return Err(ApiError::BadRequest(
            "max_publish_count 参数不正确".to_string(),
        ));
    }

    let end_time = parse_optional_timestamp(body.end_time.as_deref())?;
    let next_publish_time =
        calculate_first_publish_time(&body.base_date, &body.base_time, "day", 1)?;
    let pickup_time_offset = normalize_optional_text(body.pickup_time_offset);

    let mut tx = state.db.begin().await?;
    let template_user_id: Option<String> =
        sqlx::query_scalar("SELECT user_id FROM demand_templates WHERE id = $1")
            .bind(&body.template_id)
            .fetch_optional(&mut *tx)
            .await?
            .flatten();
    let template_user_id =
        template_user_id.ok_or_else(|| ApiError::NotFound("模板不存在".to_string()))?;
    if template_user_id != body.user_id {
        return Err(ApiError::BadRequest("无权使用该模板".to_string()));
    }

    let schedule = sqlx::query_scalar::<_, Value>(
        r#"
        INSERT INTO demand_schedules (
            user_id, template_id, schedule_name, schedule_type,
            interval_days, base_date, base_time, pickup_time_offset,
            max_publish_count, end_time, published_count, status,
            next_publish_time, last_published_at
        )
        VALUES (
            $1, $2, $3, $4,
            $5, $6::date, $7, $8,
            $9, $10, 0, 'active',
            $11, null
        )
        RETURNING row_to_json(demand_schedules)
        "#,
    )
    .bind(&body.user_id)
    .bind(&body.template_id)
    .bind(&body.schedule_name)
    .bind(&body.schedule_type)
    .bind(interval_days)
    .bind(&body.base_date)
    .bind(&body.base_time)
    .bind(pickup_time_offset)
    .bind(body.max_publish_count)
    .bind(end_time)
    .bind(next_publish_time)
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(ok("计划创建成功", schedule).into_response())
}

async fn list_schedules<S>(
    State(state): State<AppState<S>>,
    Query(query): Query<UserIdQuery>,
) -> ApiResult<Response>
where
    S: Storage,
{
    let Some(user_id) = non_empty(query.user_id) else {
        return Ok(code_400_body("用户ID不能为空"));
    };

    let schedules = sqlx::query_scalar::<_, Value>(
        r#"
        SELECT jsonb_set(
            to_jsonb(ds),
            '{template}',
            COALESCE(
                jsonb_build_object(
                    'template_name', dt.template_name,
                    'cargo_name', dt.cargo_name,
                    'pickup_address', dt.pickup_address,
                    'delivery_address', dt.delivery_address
                ),
                'null'::jsonb
            )
        )
        FROM demand_schedules ds
        LEFT JOIN demand_templates dt ON dt.id = ds.template_id
        WHERE ds.user_id = $1
        ORDER BY ds.next_publish_time ASC NULLS LAST, ds.created_at DESC
        "#,
    )
    .bind(user_id)
    .fetch_all(&state.db)
    .await?;

    Ok(ok("查询成功", schedules).into_response())
}

async fn get_schedule<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
) -> ApiResult<Response>
where
    S: Storage,
{
    let schedule = fetch_schedule(&state.db, &id).await?;

    Ok(ok("查询成功", schedule).into_response())
}

async fn update_schedule<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
    Json(body): Json<UpdateScheduleRequest>,
) -> ApiResult<Response>
where
    S: Storage,
{
    let schedule_name = text_field(&body.fields, "schedule_name")?;
    let schedule_type = text_field(&body.fields, "schedule_type")?;
    if let Some(schedule_type) = schedule_type.as_deref() {
        validate_schedule_type(schedule_type)?;
    }
    let interval_days = int_field(&body.fields, "interval_days")?;
    if interval_days.is_some_and(|value| value <= 0) {
        return Err(ApiError::BadRequest(
            "interval_days 参数不能为空".to_string(),
        ));
    }
    let base_date = text_field(&body.fields, "base_date")?;
    let base_time = text_field(&body.fields, "base_time")?;
    let pickup_time_offset = text_field(&body.fields, "pickup_time_offset")?;
    let max_publish_count = int_field(&body.fields, "max_publish_count")?;
    if max_publish_count.is_some_and(|value| value <= 0) {
        return Err(ApiError::BadRequest(
            "max_publish_count 参数不正确".to_string(),
        ));
    }
    let status = text_field(&body.fields, "status")?;
    if let Some(status) = status.as_deref() {
        validate_status(status)?;
    }
    let end_time_text = text_field(&body.fields, "end_time")?;
    let end_time = parse_optional_timestamp(end_time_text.as_deref())?;

    let has_schedule_name = body.fields.contains_key("schedule_name");
    let has_schedule_type = body.fields.contains_key("schedule_type");
    let has_interval_days = body.fields.contains_key("interval_days");
    let has_base_date = body.fields.contains_key("base_date");
    let has_base_time = body.fields.contains_key("base_time");
    let has_pickup_time_offset = body.fields.contains_key("pickup_time_offset");
    let has_max_publish_count = body.fields.contains_key("max_publish_count");
    let has_status = body.fields.contains_key("status");
    let has_end_time = body.fields.contains_key("end_time");
    let should_recalculate =
        has_base_date || has_base_time || has_schedule_type || has_interval_days;

    let mut tx = state.db.begin().await?;
    let existing = sqlx::query_as::<_, ExistingScheduleRow>(
        r#"
        SELECT base_date, base_time, schedule_type, interval_days
        FROM demand_schedules
        WHERE id = $1
        FOR UPDATE
        "#,
    )
    .bind(&id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| ApiError::NotFound("计划不存在".to_string()))?;

    let next_publish_time = if should_recalculate {
        let base_date = base_date
            .clone()
            .or_else(|| existing.base_date.map(|value| value.to_string()))
            .ok_or_else(|| ApiError::BadRequest("基准日期不能为空".to_string()))?;
        let base_time = base_time
            .clone()
            .or(existing.base_time)
            .ok_or_else(|| ApiError::BadRequest("基准时间不能为空".to_string()))?;
        let schedule_type = schedule_type
            .clone()
            .or(existing.schedule_type)
            .unwrap_or_else(|| "day".to_string());
        let interval_days = interval_days.or(existing.interval_days).unwrap_or(1);
        if schedule_type == "interval" && interval_days <= 0 {
            return Err(ApiError::BadRequest(
                "interval_days 参数不能为空".to_string(),
            ));
        }
        Some(calculate_first_publish_time(
            &base_date,
            &base_time,
            &schedule_type,
            interval_days,
        )?)
    } else {
        None
    };

    let schedule = sqlx::query_scalar::<_, Value>(
        r#"
        UPDATE demand_schedules
        SET schedule_name = CASE WHEN $2 THEN $3 ELSE schedule_name END,
            schedule_type = CASE WHEN $4 THEN $5 ELSE schedule_type END,
            interval_days = CASE WHEN $6 THEN $7 ELSE interval_days END,
            base_date = CASE WHEN $8 THEN $9::date ELSE base_date END,
            base_time = CASE WHEN $10 THEN $11 ELSE base_time END,
            pickup_time_offset = CASE WHEN $12 THEN $13 ELSE pickup_time_offset END,
            max_publish_count = CASE WHEN $14 THEN $15 ELSE max_publish_count END,
            status = CASE WHEN $16 THEN $17 ELSE status END,
            end_time = CASE WHEN $18 THEN $19 ELSE end_time END,
            next_publish_time = CASE WHEN $20 THEN $21 ELSE next_publish_time END,
            updated_at = now()
        WHERE id = $1
        RETURNING row_to_json(demand_schedules)
        "#,
    )
    .bind(&id)
    .bind(has_schedule_name)
    .bind(&schedule_name)
    .bind(has_schedule_type)
    .bind(&schedule_type)
    .bind(has_interval_days)
    .bind(interval_days)
    .bind(has_base_date)
    .bind(&base_date)
    .bind(has_base_time)
    .bind(&base_time)
    .bind(has_pickup_time_offset)
    .bind(&pickup_time_offset)
    .bind(has_max_publish_count)
    .bind(max_publish_count)
    .bind(has_status)
    .bind(&status)
    .bind(has_end_time)
    .bind(end_time)
    .bind(should_recalculate)
    .bind(next_publish_time)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| ApiError::NotFound("计划不存在".to_string()))?;

    tx.commit().await?;

    Ok(ok("计划更新成功", schedule).into_response())
}

async fn pause_schedule<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
) -> ApiResult<Response>
where
    S: Storage,
{
    let schedule = update_schedule_status(&state.db, &id, "paused", "计划不存在").await?;

    Ok(ok("计划已暂停", schedule).into_response())
}

async fn resume_schedule<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
) -> ApiResult<Response>
where
    S: Storage,
{
    let schedule = update_schedule_status(&state.db, &id, "active", "计划不存在").await?;

    Ok(ok("计划已恢复", schedule).into_response())
}

async fn delete_schedule<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
) -> ApiResult<Response>
where
    S: Storage,
{
    let mut tx = state.db.begin().await?;
    let status: Option<String> =
        sqlx::query_scalar("SELECT status FROM demand_schedules WHERE id = $1 FOR UPDATE")
            .bind(&id)
            .fetch_optional(&mut *tx)
            .await?
            .flatten();
    let status = status.ok_or_else(|| ApiError::NotFound("计划不存在".to_string()))?;

    if status == "active" {
        return Err(ApiError::BadRequest(
            "正在运行的计划不能删除，请先暂停或取消".to_string(),
        ));
    }

    sqlx::query("DELETE FROM demand_schedules WHERE id = $1")
        .bind(&id)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;

    Ok(ok("计划删除成功", Value::Null).into_response())
}

async fn publish_now<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
    Json(body): Json<PublishNowRequest>,
) -> ApiResult<Response>
where
    S: Storage,
{
    let current_user_id = non_empty(body.user_id)
        .ok_or_else(|| ApiError::BadRequest("用户ID不能为空".to_string()))?;
    let mut tx = state.db.begin().await?;

    let schedule = sqlx::query_as::<_, SchedulePublishRow>(
        r#"
        SELECT id, user_id, template_id, pickup_time_offset, status
        FROM demand_schedules
        WHERE id = $1
        FOR UPDATE
        "#,
    )
    .bind(&id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| ApiError::NotFound("定时计划不存在".to_string()))?;

    let schedule_user_id = schedule
        .user_id
        .as_deref()
        .ok_or_else(|| ApiError::BadRequest("无权操作该定时计划".to_string()))?;
    if schedule_user_id != current_user_id {
        return Err(ApiError::BadRequest("无权操作该定时计划".to_string()));
    }
    if schedule.status.as_deref() == Some("cancelled") {
        return Err(ApiError::BadRequest("该计划已取消，无法发布".to_string()));
    }

    let template_id = schedule
        .template_id
        .as_deref()
        .ok_or_else(|| ApiError::BadRequest("关联的模板不存在或已被删除".to_string()))?;
    let template = sqlx::query_as::<_, TemplatePublishRow>(
        r#"
        SELECT
            id, cargo_name, cargo_type, weight, volume,
            pickup_address, pickup_lat, pickup_lng,
            delivery_address, delivery_lat, delivery_lng,
            remarks
        FROM demand_templates
        WHERE id = $1
        FOR UPDATE
        "#,
    )
    .bind(template_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| ApiError::BadRequest("关联的模板不存在或已被删除".to_string()))?;

    let publish_time = Utc::now();
    let pickup_time =
        publish_time + parse_offset_to_duration(schedule.pickup_time_offset.as_deref());

    let demand = sqlx::query_scalar::<_, Value>(
        r#"
        INSERT INTO demands (
            merchant_id, owner_id, template_id, schedule_id,
            cargo_name, cargo_type, weight, volume,
            pickup_address, pickup_lat, pickup_lng, pickup_time,
            delivery_address, delivery_lat, delivery_lng,
            remarks, status, is_from_schedule,
            created_at, updated_at
        )
        VALUES (
            $1, $2, $3, $4,
            $5, $6, $7, $8,
            $9, $10, $11, $12,
            $13, $14, $15,
            $16, 'pending', true,
            $17, $17
        )
        RETURNING jsonb_build_object(
            'id', id,
            'cargo_name', cargo_name,
            'pickup_address', pickup_address,
            'delivery_address', delivery_address,
            'pickup_time', pickup_time
        )
        "#,
    )
    .bind(schedule_user_id)
    .bind(schedule_user_id)
    .bind(&template.id)
    .bind(&schedule.id)
    .bind(&template.cargo_name)
    .bind(&template.cargo_type)
    .bind(template.weight)
    .bind(template.volume)
    .bind(&template.pickup_address)
    .bind(template.pickup_lat)
    .bind(template.pickup_lng)
    .bind(pickup_time)
    .bind(&template.delivery_address)
    .bind(template.delivery_lat)
    .bind(template.delivery_lng)
    .bind(&template.remarks)
    .bind(publish_time)
    .fetch_one(&mut *tx)
    .await?;
    let demand_id = demand["id"]
        .as_str()
        .ok_or_else(|| ApiError::BadRequest("创建需求失败".to_string()))?
        .to_string();

    sqlx::query(
        r#"
        UPDATE demand_templates
        SET use_count = COALESCE(use_count, 0) + 1,
            updated_at = now()
        WHERE id = $1
        "#,
    )
    .bind(&template.id)
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        r#"
        UPDATE demand_schedules
        SET published_count = COALESCE(published_count, 0) + 1,
            last_published_at = $2,
            updated_at = $2
        WHERE id = $1
        "#,
    )
    .bind(&schedule.id)
    .bind(publish_time)
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        r#"
        INSERT INTO demand_publish_logs (
            schedule_id, demand_id, publish_time, publish_type, status, created_at
        )
        VALUES ($1, $2, $3, 'manual', 'success', $3)
        "#,
    )
    .bind(&schedule.id)
    .bind(&demand_id)
    .bind(publish_time)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(ok(
        "需求发布成功",
        json!({
            "demand_id": demand_id,
            "schedule_id": schedule.id,
            "published_at": publish_time,
            "demand_info": {
                "cargo_name": demand["cargo_name"],
                "pickup_address": demand["pickup_address"],
                "delivery_address": demand["delivery_address"],
                "pickup_time": demand["pickup_time"]
            }
        }),
    )
    .into_response())
}

async fn get_logs<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
) -> ApiResult<Response>
where
    S: Storage,
{
    let logs = sqlx::query_scalar::<_, Value>(
        r#"
        SELECT row_to_json(log_row)
        FROM (
            SELECT *
            FROM demand_publish_logs
            WHERE schedule_id = $1
            ORDER BY publish_time DESC
        ) log_row
        "#,
    )
    .bind(id)
    .fetch_all(&state.db)
    .await?;

    Ok(ok("查询成功", logs).into_response())
}

async fn fetch_schedule(pool: &sqlx::PgPool, id: &str) -> ApiResult<Value> {
    sqlx::query_scalar::<_, Value>(
        "SELECT row_to_json(demand_schedules) FROM demand_schedules WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| ApiError::NotFound("计划不存在".to_string()))
}

async fn update_schedule_status(
    pool: &sqlx::PgPool,
    id: &str,
    status: &str,
    missing_message: &str,
) -> ApiResult<Value> {
    sqlx::query_scalar::<_, Value>(
        r#"
        UPDATE demand_schedules
        SET status = $2,
            updated_at = now()
        WHERE id = $1
        RETURNING row_to_json(demand_schedules)
        "#,
    )
    .bind(id)
    .bind(status)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| ApiError::NotFound(missing_message.to_string()))
}

fn calculate_first_publish_time(
    base_date: &str,
    base_time: &str,
    schedule_type: &str,
    interval_days: i32,
) -> ApiResult<DateTime<Utc>> {
    let mut base = parse_base_datetime(base_date, base_time)?;

    if base <= Utc::now() {
        base = match schedule_type {
            "half_day" => base + Duration::hours(12),
            "day" => base + Duration::days(1),
            "week" => base + Duration::days(7),
            "month" => base
                .checked_add_months(Months::new(1))
                .unwrap_or_else(|| base + Duration::days(30)),
            "interval" => base + Duration::days(interval_days as i64),
            _ => return Err(ApiError::BadRequest("计划类型不正确".to_string())),
        };
    }

    Ok(base)
}

fn parse_base_datetime(base_date: &str, base_time: &str) -> ApiResult<DateTime<Utc>> {
    let date = NaiveDate::parse_from_str(base_date, "%Y-%m-%d")
        .map_err(|_| ApiError::BadRequest("无效的日期时间格式".to_string()))?;
    let time = NaiveTime::parse_from_str(base_time, "%H:%M:%S")
        .or_else(|_| NaiveTime::parse_from_str(base_time, "%H:%M"))
        .map_err(|_| ApiError::BadRequest("无效的日期时间格式".to_string()))?;

    Ok(DateTime::<Utc>::from_naive_utc_and_offset(
        date.and_time(time),
        Utc,
    ))
}

fn parse_optional_timestamp(value: Option<&str>) -> ApiResult<Option<DateTime<Utc>>> {
    let Some(value) = value.map(str::trim).filter(|value| !value.is_empty()) else {
        return Ok(None);
    };

    if let Ok(value) = DateTime::parse_from_rfc3339(value) {
        return Ok(Some(value.with_timezone(&Utc)));
    }

    if let Ok(parsed) = NaiveDateTime::parse_from_str(value, "%Y-%m-%d %H:%M:%S") {
        return Ok(Some(DateTime::<Utc>::from_naive_utc_and_offset(
            parsed, Utc,
        )));
    }

    let parsed_date = NaiveDate::parse_from_str(value, "%Y-%m-%d")
        .map_err(|_| ApiError::BadRequest("无效的日期时间格式".to_string()))?;
    let parsed = parsed_date
        .and_hms_opt(0, 0, 0)
        .ok_or_else(|| ApiError::BadRequest("无效的日期时间格式".to_string()))?;
    Ok(Some(DateTime::<Utc>::from_naive_utc_and_offset(
        parsed, Utc,
    )))
}

fn parse_offset_to_duration(value: Option<&str>) -> Duration {
    let Some(value) = value.map(str::trim).filter(|value| !value.is_empty()) else {
        return Duration::zero();
    };
    if let Some(hours) = value
        .strip_suffix('h')
        .and_then(|value| value.parse::<i64>().ok())
    {
        return Duration::hours(hours);
    }
    if let Some(minutes) = value
        .strip_suffix('m')
        .and_then(|value| value.parse::<i64>().ok())
    {
        return Duration::minutes(minutes);
    }

    Duration::zero()
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

fn validate_schedule_type(value: &str) -> ApiResult<()> {
    if matches!(value, "half_day" | "day" | "week" | "month" | "interval") {
        Ok(())
    } else {
        Err(ApiError::BadRequest("计划类型不正确".to_string()))
    }
}

fn validate_status(value: &str) -> ApiResult<()> {
    if matches!(value, "active" | "paused" | "completed" | "cancelled") {
        Ok(())
    } else {
        Err(ApiError::BadRequest("计划状态不正确".to_string()))
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

fn int_field(fields: &Map<String, Value>, key: &str) -> ApiResult<Option<i32>> {
    match fields.get(key) {
        Some(Value::Null) | None => Ok(None),
        Some(Value::Number(value)) => value
            .as_i64()
            .and_then(|value| i32::try_from(value).ok())
            .map(Some)
            .ok_or_else(|| ApiError::BadRequest(format!("{key} 参数不正确"))),
        Some(_) => Err(ApiError::BadRequest(format!("{key} 参数不正确"))),
    }
}
