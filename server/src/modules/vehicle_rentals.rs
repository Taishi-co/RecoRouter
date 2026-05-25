use axum::{
    extract::{Path, Query, State},
    routing::{get, post},
    Json, Router,
};
use chrono::{DateTime, Utc};
use serde::Deserialize;
use serde_json::{json, Value};

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
        .route(
            "/api/rentals/available-vehicles",
            get(available_vehicles::<S>),
        )
        .route(
            "/api/rentals/pending-for-owner",
            get(pending_for_owner::<S>),
        )
        .route(
            "/api/rentals/vehicle/:vehicle_id/info",
            get(vehicle_info::<S>),
        )
        .route("/api/rentals", post(create_rental::<S>))
        .route("/api/rentals/my", get(my_rentals::<S>))
        .route("/api/rentals/:id", get(rental_by_id::<S>))
        .route("/api/rentals/:id/confirm-owner", post(confirm_owner::<S>))
        .route("/api/rentals/:id/confirm-return", post(confirm_return::<S>))
}

#[derive(Debug, Deserialize)]
struct UserQuery {
    user_id: Option<String>,
}

#[derive(Debug, Deserialize)]
struct OwnerQuery {
    owner_id: String,
}

#[derive(Debug, Deserialize)]
struct CreateRentalBody {
    vehicle_id: String,
    owner_id: String,
    rent_type: String,
    rent_start_date: String,
    rent_end_date: String,
    contract_signed: Option<bool>,
    rent_paid: Option<bool>,
    deposit_paid: Option<bool>,
    deposit_amount: Option<f64>,
    notes: Option<String>,
    renter_id: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ConfirmOwnerBody {
    confirm: bool,
    notes: Option<String>,
    owner_id: String,
}

#[derive(Debug, Deserialize)]
struct ConfirmReturnBody {
    notes: Option<String>,
    owner_id: String,
}

async fn available_vehicles<S>(
    State(state): State<AppState<S>>,
    Query(query): Query<UserQuery>,
) -> ApiResult<Json<ApiEnvelope<Vec<Value>>>>
where
    S: Storage,
{
    let vehicles = sqlx::query_scalar::<_, Value>(
        r#"
        SELECT jsonb_build_object(
            'id', v.id,
            'owner_id', v.owner_id,
            'enterprise_id', v.enterprise_id,
            'vehicle_type', v.vehicle_type,
            'license_plate', v.license_plate,
            'load_capacity', v.load_capacity,
            'volume', v.volume,
            'battery_life', v.battery_life,
            'has_cold_chain', v.has_cold_chain,
            'photos', v.photos,
            'status', v.status,
            'trip_status', v.trip_status,
            'is_available_for_rent', v.is_available_for_rent,
            'rent_monthly_price', v.rent_monthly_price,
            'rent_yearly_price', v.rent_yearly_price,
            'rent_deposit', v.rent_deposit,
            'contact_phone', v.contact_phone,
            'contact_wechat', v.contact_wechat,
            'current_renter_id', v.current_renter_id,
            'rent_start_date', v.rent_start_date,
            'rent_end_date', v.rent_end_date,
            'rent_type', v.rent_type,
            'created_at', v.created_at,
            'updated_at', v.updated_at,
            'owners', (
                SELECT to_jsonb(owner_row)
                FROM (
                    SELECT id, name, phone, avatar_url
                    FROM users
                    WHERE id = v.owner_id
                ) owner_row
            ),
            'has_applied', CASE WHEN $1::text IS NULL THEN false ELSE EXISTS (
                SELECT 1 FROM vehicle_rentals vr
                WHERE vr.vehicle_id = v.id
                  AND vr.renter_id = $1
                  AND vr.status IN ('pending', 'active')
            ) END,
            'application_status', CASE WHEN $1::text IS NULL THEN NULL ELSE (
                SELECT status FROM vehicle_rentals vr
                WHERE vr.vehicle_id = v.id
                  AND vr.renter_id = $1
                  AND vr.status IN ('pending', 'active')
                LIMIT 1
            ) END
        )
        FROM vehicles v
        WHERE v.is_available_for_rent = true
          AND v.current_renter_id IS NULL
          AND v.status = 'active'
        ORDER BY v.created_at DESC
        "#,
    )
    .bind(query.user_id)
    .fetch_all(&state.db)
    .await
    .map_err(|err| ApiError::BadRequest(format!("查询失败: {err}")))?;

    Ok(ok("查询成功", vehicles))
}

async fn create_rental<S>(
    State(state): State<AppState<S>>,
    Json(body): Json<CreateRentalBody>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let vehicle = fetch_vehicle(&state.db, &body.vehicle_id).await?;
    if vehicle
        .get("is_available_for_rent")
        .and_then(Value::as_bool)
        != Some(true)
    {
        return Err(ApiError::BadRequest("该车辆不可租赁".to_string()));
    }
    if !vehicle
        .get("current_renter_id")
        .unwrap_or(&Value::Null)
        .is_null()
    {
        return Err(ApiError::BadRequest("该车辆已被租赁".to_string()));
    }
    if vehicle.get("owner_id").and_then(Value::as_str) != Some(body.owner_id.as_str()) {
        return Err(ApiError::BadRequest("车主ID不匹配".to_string()));
    }
    let Some(renter_id) = body.renter_id.as_deref().filter(|value| !value.is_empty()) else {
        return Err(ApiError::BadRequest("租户ID不能为空".to_string()));
    };
    let start = parse_time(&body.rent_start_date, "开始日期格式不正确")?;
    let end = parse_time(&body.rent_end_date, "结束日期格式不正确")?;
    if end <= start {
        return Err(ApiError::BadRequest("结束日期必须晚于开始日期".to_string()));
    }

    let existing_status: Option<String> = sqlx::query_scalar(
        r#"
        SELECT status
        FROM vehicle_rentals
        WHERE vehicle_id = $1
          AND renter_id = $2
          AND status IN ('pending', 'active')
        LIMIT 1
        "#,
    )
    .bind(&body.vehicle_id)
    .bind(renter_id)
    .fetch_optional(&state.db)
    .await?
    .flatten();
    match existing_status.as_deref() {
        Some("pending") => {
            return Err(ApiError::BadRequest(
                "您已经申请过该车辆，请等待车主确认".to_string(),
            ))
        }
        Some("active") => {
            return Err(ApiError::BadRequest(
                "您已经租赁了该车辆，无法重复申请".to_string(),
            ))
        }
        _ => {}
    }

    let rental = sqlx::query_scalar::<_, Value>(
        r#"
        INSERT INTO vehicle_rentals (
            vehicle_id, owner_id, renter_id, rent_type, rent_start_date, rent_end_date,
            contract_signed, rent_paid, deposit_paid, deposit_amount,
            status, confirmed_by_owner, confirmed_by_renter, confirmed_at, notes
        )
        VALUES (
            $1, $2, $3, $4, $5::timestamptz, $6::timestamptz,
            $7, $8, $9, $10::numeric,
            'pending', false, true, now(), $11
        )
        RETURNING row_to_json(vehicle_rentals)
        "#,
    )
    .bind(&body.vehicle_id)
    .bind(&body.owner_id)
    .bind(renter_id)
    .bind(&body.rent_type)
    .bind(&body.rent_start_date)
    .bind(&body.rent_end_date)
    .bind(body.contract_signed.unwrap_or(false))
    .bind(body.rent_paid.unwrap_or(false))
    .bind(body.deposit_paid.unwrap_or(false))
    .bind(body.deposit_amount.unwrap_or(0.0))
    .bind(body.notes)
    .fetch_one(&state.db)
    .await
    .map_err(|err| ApiError::BadRequest(format!("创建租赁关系失败: {err}")))?;

    Ok(ok("租赁关系已创建，请等待车主确认", rental))
}

async fn my_rentals<S>(
    State(state): State<AppState<S>>,
    Query(query): Query<UserQuery>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let user_id = query.user_id.unwrap_or_default();
    let as_renter = rentals_with_details(&state.db, "renter_id", &user_id).await?;
    let as_owner = rentals_with_details(&state.db, "owner_id", &user_id).await?;
    Ok(ok(
        "查询成功",
        json!({ "as_renter": as_renter, "as_owner": as_owner }),
    ))
}

async fn rental_by_id<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let rental = rental_detail(&state.db, &id)
        .await?
        .ok_or_else(|| ApiError::NotFound("租赁关系不存在".to_string()))?;
    Ok(ok("查询成功", rental))
}

async fn vehicle_info<S>(
    State(state): State<AppState<S>>,
    Path(vehicle_id): Path<String>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let info = sqlx::query_scalar::<_, Value>(
        r#"
        SELECT jsonb_build_object(
            'id', v.id,
            'vehicle_type', v.vehicle_type,
            'license_plate', v.license_plate,
            'load_capacity', v.load_capacity,
            'volume', v.volume,
            'battery_life', v.battery_life,
            'has_cold_chain', v.has_cold_chain,
            'photos', v.photos,
            'owner', (
                SELECT to_jsonb(owner_row)
                FROM (
                    SELECT id, name, phone, avatar_url
                    FROM users
                    WHERE id = v.owner_id
                ) owner_row
            ),
            'is_available_for_rent', v.is_available_for_rent,
            'rent_monthly_price', v.rent_monthly_price,
            'rent_yearly_price', v.rent_yearly_price,
            'rent_deposit', v.rent_deposit,
            'contact_phone', v.contact_phone,
            'contact_wechat', v.contact_wechat,
            'current_renter_id', v.current_renter_id,
            'rent_start_date', v.rent_start_date,
            'rent_end_date', v.rent_end_date,
            'rent_type', v.rent_type
        )
        FROM vehicles v
        WHERE v.id = $1
        "#,
    )
    .bind(vehicle_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| ApiError::NotFound("车辆不存在".to_string()))?;

    Ok(ok("查询成功", info))
}

async fn pending_for_owner<S>(
    State(state): State<AppState<S>>,
    Query(query): Query<OwnerQuery>,
) -> ApiResult<Json<ApiEnvelope<Vec<Value>>>>
where
    S: Storage,
{
    let rentals = rentals_with_details(&state.db, "owner_id", &query.owner_id)
        .await?
        .into_iter()
        .filter(|rental| rental.get("status").and_then(Value::as_str) == Some("pending"))
        .collect();
    Ok(ok("查询成功", rentals))
}

async fn confirm_owner<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
    Json(body): Json<ConfirmOwnerBody>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let rental = fetch_rental(&state.db, &id).await?;
    if rental.get("owner_id").and_then(Value::as_str) != Some(body.owner_id.as_str()) {
        return Err(ApiError::BadRequest("无权确认此租赁关系".to_string()));
    }
    if rental.get("status").and_then(Value::as_str) != Some("pending") {
        return Err(ApiError::BadRequest(
            "只有待确认的租赁关系可以确认".to_string(),
        ));
    }

    if !body.confirm {
        let updated = sqlx::query_scalar::<_, Value>(
            r#"
            UPDATE vehicle_rentals
            SET status = 'terminated', confirmed_by_owner = true,
                notes = COALESCE($2, '车主拒绝租赁'), updated_at = now()
            WHERE id = $1
            RETURNING row_to_json(vehicle_rentals)
            "#,
        )
        .bind(id)
        .bind(body.notes)
        .fetch_one(&state.db)
        .await
        .map_err(|err| ApiError::BadRequest(format!("更新失败: {err}")))?;
        return Ok(ok("已拒绝该租赁关系", updated));
    }

    let updated = sqlx::query_scalar::<_, Value>(
        r#"
        UPDATE vehicle_rentals
        SET status = 'active', confirmed_by_owner = true,
            confirmed_at = now(), notes = COALESCE($2, ''), updated_at = now()
        WHERE id = $1
        RETURNING row_to_json(vehicle_rentals)
        "#,
    )
    .bind(&id)
    .bind(body.notes)
    .fetch_one(&state.db)
    .await
    .map_err(|err| ApiError::BadRequest(format!("更新失败: {err}")))?;

    sqlx::query(
        r#"
        UPDATE vehicles
        SET current_renter_id = $2,
            rent_start_date = $3::timestamptz,
            rent_end_date = $4::timestamptz,
            rent_type = $5,
            is_available = false,
            updated_at = now()
        WHERE id = $1
        "#,
    )
    .bind(rental.get("vehicle_id").and_then(Value::as_str))
    .bind(rental.get("renter_id").and_then(Value::as_str))
    .bind(rental.get("rent_start_date").and_then(Value::as_str))
    .bind(rental.get("rent_end_date").and_then(Value::as_str))
    .bind(rental.get("rent_type").and_then(Value::as_str))
    .execute(&state.db)
    .await
    .map_err(|err| ApiError::BadRequest(format!("更新车辆状态失败: {err}")))?;

    Ok(ok("租赁关系已确认", updated))
}

async fn confirm_return<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
    Json(body): Json<ConfirmReturnBody>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let rental = fetch_rental(&state.db, &id).await?;
    if rental.get("owner_id").and_then(Value::as_str) != Some(body.owner_id.as_str()) {
        return Err(ApiError::BadRequest("无权确认此租赁关系".to_string()));
    }
    if rental.get("status").and_then(Value::as_str) != Some("active") {
        return Err(ApiError::BadRequest(
            "只有激活的租赁关系可以确认归还".to_string(),
        ));
    }

    let updated = sqlx::query_scalar::<_, Value>(
        r#"
        UPDATE vehicle_rentals
        SET status = 'expired', notes = COALESCE($2, '车辆已归还'), updated_at = now()
        WHERE id = $1
        RETURNING row_to_json(vehicle_rentals)
        "#,
    )
    .bind(&id)
    .bind(body.notes)
    .fetch_one(&state.db)
    .await
    .map_err(|err| ApiError::BadRequest(format!("更新失败: {err}")))?;

    sqlx::query(
        r#"
        UPDATE vehicles
        SET current_renter_id = null,
            rent_start_date = null,
            rent_end_date = null,
            rent_type = null,
            is_available = true,
            updated_at = now()
        WHERE id = $1
        "#,
    )
    .bind(rental.get("vehicle_id").and_then(Value::as_str))
    .execute(&state.db)
    .await
    .map_err(|err| ApiError::BadRequest(format!("更新车辆状态失败: {err}")))?;

    Ok(ok("车辆已确认归还", updated))
}

async fn fetch_vehicle(pool: &sqlx::PgPool, vehicle_id: &str) -> ApiResult<Value> {
    sqlx::query_scalar::<_, Value>("SELECT row_to_json(vehicles) FROM vehicles WHERE id = $1")
        .bind(vehicle_id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::BadRequest("车辆不存在".to_string()))
}

async fn fetch_rental(pool: &sqlx::PgPool, rental_id: &str) -> ApiResult<Value> {
    sqlx::query_scalar::<_, Value>(
        "SELECT row_to_json(vehicle_rentals) FROM vehicle_rentals WHERE id = $1",
    )
    .bind(rental_id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| ApiError::NotFound("租赁关系不存在".to_string()))
}

async fn rental_detail(pool: &sqlx::PgPool, rental_id: &str) -> ApiResult<Option<Value>> {
    sqlx::query_scalar::<_, Value>(
        r#"
        SELECT jsonb_build_object(
            'id', vr.id,
            'vehicle_id', vr.vehicle_id,
            'owner_id', vr.owner_id,
            'renter_id', vr.renter_id,
            'rent_type', vr.rent_type,
            'rent_start_date', vr.rent_start_date,
            'rent_end_date', vr.rent_end_date,
            'contract_signed', vr.contract_signed,
            'rent_paid', vr.rent_paid,
            'deposit_paid', vr.deposit_paid,
            'deposit_amount', vr.deposit_amount,
            'status', vr.status,
            'confirmed_by_owner', vr.confirmed_by_owner,
            'confirmed_by_renter', vr.confirmed_by_renter,
            'confirmed_at', vr.confirmed_at,
            'notes', vr.notes,
            'created_at', vr.created_at,
            'updated_at', vr.updated_at,
            'vehicles', (SELECT row_to_json(v) FROM vehicles v WHERE v.id = vr.vehicle_id),
            'owners', (SELECT to_jsonb(o) - 'password' FROM users o WHERE o.id = vr.owner_id),
            'renters', (SELECT to_jsonb(r) - 'password' FROM users r WHERE r.id = vr.renter_id)
        )
        FROM vehicle_rentals vr
        WHERE vr.id = $1
        "#,
    )
    .bind(rental_id)
    .fetch_optional(pool)
    .await
    .map_err(Into::into)
}

async fn rentals_with_details(
    pool: &sqlx::PgPool,
    field: &str,
    user_id: &str,
) -> ApiResult<Vec<Value>> {
    let sql = format!(
        r#"
        SELECT jsonb_build_object(
            'id', vr.id,
            'vehicle_id', vr.vehicle_id,
            'owner_id', vr.owner_id,
            'renter_id', vr.renter_id,
            'rent_type', vr.rent_type,
            'rent_start_date', vr.rent_start_date,
            'rent_end_date', vr.rent_end_date,
            'contract_signed', vr.contract_signed,
            'rent_paid', vr.rent_paid,
            'deposit_paid', vr.deposit_paid,
            'deposit_amount', vr.deposit_amount,
            'status', vr.status,
            'confirmed_by_owner', vr.confirmed_by_owner,
            'confirmed_by_renter', vr.confirmed_by_renter,
            'confirmed_at', vr.confirmed_at,
            'notes', vr.notes,
            'created_at', vr.created_at,
            'updated_at', vr.updated_at,
            'vehicles', (SELECT row_to_json(v) FROM vehicles v WHERE v.id = vr.vehicle_id),
            'owners', (SELECT jsonb_build_object('id', o.id, 'name', o.name, 'phone', o.phone, 'avatar_url', o.avatar_url) FROM users o WHERE o.id = vr.owner_id),
            'renters', (SELECT jsonb_build_object('id', r.id, 'name', r.name, 'phone', r.phone, 'avatar_url', r.avatar_url) FROM users r WHERE r.id = vr.renter_id)
        )
        FROM vehicle_rentals vr
        WHERE vr.{field} = $1
        ORDER BY vr.created_at DESC
        "#
    );
    sqlx::query_scalar::<_, Value>(&sql)
        .bind(user_id)
        .fetch_all(pool)
        .await
        .map_err(|err| ApiError::BadRequest(format!("查询失败: {err}")))
}

fn parse_time(value: &str, message: &str) -> ApiResult<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(value)
        .map(|value| value.with_timezone(&Utc))
        .map_err(|_| ApiError::BadRequest(message.to_string()))
}
