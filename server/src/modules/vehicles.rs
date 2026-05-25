use axum::{
    extract::{Multipart, Path, Query, State},
    response::{IntoResponse, Response},
    routing::{get, post, put},
    Json, Router,
};
use chrono::Utc;
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::FromRow;

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
            "/api/vehicles",
            get(list_vehicles::<S>).post(create_vehicle::<S>),
        )
        .route("/api/vehicles/upload-photo", post(upload_photo::<S>))
        .route(
            "/api/vehicles/:id",
            get(get_vehicle::<S>).put(update_vehicle::<S>),
        )
        .route("/api/vehicles/:id/status", put(update_status::<S>))
        .route("/api/vehicles/:id/review", post(review_vehicle::<S>))
        .route("/api/vehicles/:id/resubmit", post(resubmit_vehicle::<S>))
        .route(
            "/api/vehicles/:id/availability",
            put(update_availability::<S>),
        )
        .route(
            "/api/vehicles/:id/rental-settings",
            get(get_rental_settings::<S>).put(update_rental_settings::<S>),
        )
}

#[derive(Debug, Deserialize)]
struct VehicleQuery {
    owner_id: Option<String>,
    user_id: Option<String>,
}

#[derive(Debug, Deserialize)]
struct StatusRequest {
    status: String,
}

#[derive(Debug, Deserialize)]
struct ReviewRequest {
    action: String,
    reason: Option<String>,
}

#[derive(Debug, Deserialize)]
struct AvailabilityRequest {
    is_available: bool,
    user_id: Option<String>,
}

#[derive(Debug, Deserialize)]
struct RentalSettingsRequest {
    is_available_for_rent: Option<bool>,
    rent_monthly_price: Option<f64>,
    rent_yearly_price: Option<f64>,
    rent_deposit: Option<f64>,
    contact_phone: Option<String>,
    contact_wechat: Option<String>,
    notes: Option<String>,
}

#[derive(Debug, FromRow)]
struct VehiclePermissionRow {
    owner_id: Option<String>,
    current_renter_id: Option<String>,
    status: Option<String>,
    trip_status: Option<String>,
}

async fn upload_photo<S>(
    State(state): State<AppState<S>>,
    mut multipart: Multipart,
) -> ApiResult<Response>
where
    S: Storage,
{
    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|err| ApiError::BadRequest(err.to_string()))?
    {
        if field.name() != Some("photo") {
            continue;
        }

        let filename = field.file_name().unwrap_or("photo").to_string();
        let content_type = field.content_type().map(str::to_string);
        let bytes = field
            .bytes()
            .await
            .map_err(|err| ApiError::BadRequest(err.to_string()))?;
        let file_name = format!("vehicles/{}_{}", Utc::now().timestamp_millis(), filename);
        let file_key = match state
            .storage
            .put(bytes.to_vec(), &file_name, content_type.as_deref())
            .await
        {
            Ok(file_key) => file_key,
            Err(err) => return Ok(vehicle_upload_error(err).into_response()),
        };
        let url = match state
            .storage
            .public_url_with_expiry(&file_key, 2_592_000)
            .await
        {
            Ok(url) => url,
            Err(err) => return Ok(vehicle_upload_error(err).into_response()),
        };

        return Ok(ok(
            "上传成功",
            json!({
                "fileKey": file_key,
                "url": url
            }),
        )
        .into_response());
    }

    Ok(Json(json!({
        "code": 400,
        "message": "未选择照片"
    }))
    .into_response())
}

async fn create_vehicle<S>(
    State(state): State<AppState<S>>,
    Json(body): Json<Value>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let owner_id = required_string(&body, "owner_id", "车主ID不能为空")?;
    let role: Option<String> = sqlx::query_scalar("SELECT role FROM users WHERE id = $1")
        .bind(&owner_id)
        .fetch_optional(&state.db)
        .await?
        .flatten();
    let role = role.ok_or_else(|| ApiError::BadRequest("用户不存在".to_string()))?;
    if role != "owner" {
        return Err(ApiError::BadRequest("只有车主可以注册车辆".to_string()));
    }

    let vehicle_type = required_string(&body, "vehicle_type", "车型不能为空")?;
    let license_plate = required_string(&body, "license_plate", "车牌号不能为空")?;
    let load_capacity = required_number(&body, "load_capacity", "载重不能为空")?;
    let volume = required_number(&body, "volume", "体积不能为空")?;
    let battery_life = required_number(&body, "battery_life", "续航不能为空")?;
    let has_cold_chain = boolish_field(&body, "has_cold_chain").unwrap_or(false);
    let operation_area = json_field(&body, "operation_area")?;
    let available_hours = json_field(&body, "available_hours")?;
    let photos = photos_value(photo_urls_field(&body));
    let base_price = number_field(&body, "base_price")?.unwrap_or(20.0);
    let base_distance = number_field(&body, "base_distance")?.unwrap_or(3.0);
    let price_per_km = number_field(&body, "price_per_km")?.unwrap_or(2.0);

    let vehicle = sqlx::query_scalar::<_, Value>(
        r#"
        INSERT INTO vehicles (
            owner_id, vehicle_type, license_plate,
            load_capacity, volume, battery_life,
            has_cold_chain, operation_area, available_hours,
            status, photos, base_price, base_distance, price_per_km,
            price_updated_at
        )
        VALUES (
            $1, $2, $3,
            $4::numeric, $5::numeric, $6::numeric,
            $7, $8::jsonb, $9::jsonb,
            'pending', $10::jsonb, $11::numeric, $12::numeric, $13::numeric,
            now()
        )
        RETURNING row_to_json(vehicles)
        "#,
    )
    .bind(owner_id)
    .bind(vehicle_type)
    .bind(license_plate)
    .bind(load_capacity)
    .bind(volume)
    .bind(battery_life)
    .bind(has_cold_chain)
    .bind(operation_area)
    .bind(available_hours)
    .bind(photos)
    .bind(base_price)
    .bind(base_distance)
    .bind(price_per_km)
    .fetch_one(&state.db)
    .await
    .map_err(|err| ApiError::BadRequest(format!("创建车辆失败: {err}")))?;

    Ok(ok("车辆注册成功，等待后台审核", vehicle))
}

async fn list_vehicles<S>(
    State(state): State<AppState<S>>,
    Query(query): Query<VehicleQuery>,
) -> ApiResult<Json<ApiEnvelope<Vec<Value>>>>
where
    S: Storage,
{
    let mut vehicles: Vec<(Value, Option<&'static str>)> = Vec::new();

    if let Some(owner_id) = non_empty(query.owner_id.clone()) {
        let owned = sqlx::query_scalar::<_, Value>(
            r#"
            SELECT row_to_json(vehicle_row)
            FROM (
                SELECT *
                FROM vehicles
                WHERE owner_id = $1
                ORDER BY created_at DESC
            ) vehicle_row
            "#,
        )
        .bind(&owner_id)
        .fetch_all(&state.db)
        .await
        .map_err(|err| ApiError::BadRequest(format!("查询失败: {err}")))?;
        vehicles.extend(owned.into_iter().map(|vehicle| (vehicle, Some("owned"))));

        let rented = sqlx::query_scalar::<_, Value>(
            r#"
            SELECT row_to_json(vehicle_row)
            FROM (
                SELECT v.*
                FROM vehicles v
                INNER JOIN vehicle_rentals r ON r.vehicle_id = v.id
                WHERE r.renter_id = $1
                  AND r.status = 'active'
                ORDER BY v.created_at DESC
            ) vehicle_row
            "#,
        )
        .bind(&owner_id)
        .fetch_all(&state.db)
        .await
        .map_err(|err| ApiError::BadRequest(format!("查询租赁记录失败: {err}")))?;
        for vehicle in rented {
            let rented_id = vehicle_id(&vehicle);
            if !vehicles
                .iter()
                .any(|(existing, _)| vehicle_id(existing) == rented_id)
            {
                vehicles.push((vehicle, Some("rented")));
            }
        }
    } else {
        let all = sqlx::query_scalar::<_, Value>(
            r#"
            SELECT row_to_json(vehicle_row)
            FROM (
                SELECT *
                FROM vehicles
                ORDER BY created_at DESC
            ) vehicle_row
            "#,
        )
        .fetch_all(&state.db)
        .await
        .map_err(|err| ApiError::BadRequest(format!("查询失败: {err}")))?;
        vehicles.extend(all.into_iter().map(|vehicle| (vehicle, None)));
    }

    let mut enriched = Vec::with_capacity(vehicles.len());
    for (mut vehicle, ownership_type) in vehicles {
        enrich_vehicle(
            &state.db,
            &mut vehicle,
            query.user_id.as_deref(),
            ownership_type,
        )
        .await?;
        enriched.push(vehicle);
    }

    Ok(ok("查询成功", enriched))
}

async fn get_vehicle<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    Ok(ok("查询成功", fetch_vehicle(&state.db, &id).await?))
}

async fn update_vehicle<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
    Json(body): Json<Value>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    ensure_vehicle_exists(&state.db, &id).await?;

    let vehicle_type = string_field(&body, "vehicle_type");
    let license_plate = string_field(&body, "license_plate");
    let load_capacity = number_field(&body, "load_capacity")?;
    let volume = number_field(&body, "volume")?;
    let battery_life = number_field(&body, "battery_life")?;
    let has_cold_chain = boolish_field(&body, "has_cold_chain");
    let operation_area = json_field(&body, "operation_area")?;
    let available_hours = json_field(&body, "available_hours")?;
    let photos = photos_value(photo_urls_field(&body));
    let base_price = number_field(&body, "base_price")?;
    let base_distance = number_field(&body, "base_distance")?;
    let price_per_km = number_field(&body, "price_per_km")?;
    let has_price_update =
        base_price.is_some() || base_distance.is_some() || price_per_km.is_some();

    let vehicle = sqlx::query_scalar::<_, Value>(
        r#"
        UPDATE vehicles
        SET vehicle_type = CASE WHEN $2 THEN $3 ELSE vehicle_type END,
            license_plate = CASE WHEN $4 THEN $5 ELSE license_plate END,
            load_capacity = CASE WHEN $6 THEN $7::numeric ELSE load_capacity END,
            volume = CASE WHEN $8 THEN $9::numeric ELSE volume END,
            battery_life = CASE WHEN $10 THEN $11::numeric ELSE battery_life END,
            has_cold_chain = CASE WHEN $12 THEN $13 ELSE has_cold_chain END,
            operation_area = CASE WHEN $14 THEN $15::jsonb ELSE operation_area END,
            available_hours = CASE WHEN $16 THEN $17::jsonb ELSE available_hours END,
            photos = CASE WHEN $18 THEN $19::jsonb ELSE photos END,
            base_price = CASE WHEN $20 THEN $21::numeric ELSE base_price END,
            base_distance = CASE WHEN $22 THEN $23::numeric ELSE base_distance END,
            price_per_km = CASE WHEN $24 THEN $25::numeric ELSE price_per_km END,
            price_updated_at = CASE WHEN $26 THEN now() ELSE price_updated_at END,
            updated_at = now()
        WHERE id = $1
        RETURNING row_to_json(vehicles)
        "#,
    )
    .bind(&id)
    .bind(vehicle_type.is_some())
    .bind(vehicle_type)
    .bind(license_plate.is_some())
    .bind(license_plate)
    .bind(load_capacity.is_some())
    .bind(load_capacity)
    .bind(volume.is_some())
    .bind(volume)
    .bind(battery_life.is_some())
    .bind(battery_life)
    .bind(has_cold_chain.is_some())
    .bind(has_cold_chain)
    .bind(operation_area.is_some())
    .bind(operation_area)
    .bind(available_hours.is_some())
    .bind(available_hours)
    .bind(photos.is_some())
    .bind(photos)
    .bind(base_price.is_some())
    .bind(base_price)
    .bind(base_distance.is_some())
    .bind(base_distance)
    .bind(price_per_km.is_some())
    .bind(price_per_km)
    .bind(has_price_update)
    .fetch_one(&state.db)
    .await
    .map_err(|err| ApiError::BadRequest(format!("更新失败: {err}")))?;

    Ok(ok("更新成功", vehicle))
}

async fn update_status<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
    Json(body): Json<StatusRequest>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    ensure_vehicle_exists(&state.db, &id).await?;
    if !matches!(
        body.status.as_str(),
        "pending" | "active" | "rejected" | "inactive"
    ) {
        return Err(ApiError::BadRequest("无效的状态值".to_string()));
    }

    let vehicle = sqlx::query_scalar::<_, Value>(
        r#"
        UPDATE vehicles
        SET status = $2
        WHERE id = $1
        RETURNING row_to_json(vehicles)
        "#,
    )
    .bind(id)
    .bind(body.status)
    .fetch_one(&state.db)
    .await
    .map_err(|err| ApiError::BadRequest(format!("更新状态失败: {err}")))?;

    Ok(ok("状态更新成功", vehicle))
}

async fn review_vehicle<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
    Json(body): Json<ReviewRequest>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    ensure_vehicle_exists(&state.db, &id).await?;
    if !matches!(body.action.as_str(), "approve" | "reject") {
        return Err(ApiError::BadRequest("无效的审核动作".to_string()));
    }
    let status = if body.action == "approve" {
        "active"
    } else {
        "rejected"
    };
    let vehicle = sqlx::query_scalar::<_, Value>(
        r#"
        UPDATE vehicles
        SET status = $2,
            remarks = CASE WHEN $3 THEN $4 ELSE remarks END
        WHERE id = $1
        RETURNING row_to_json(vehicles)
        "#,
    )
    .bind(id)
    .bind(status)
    .bind(body.action == "reject" && body.reason.is_some())
    .bind(body.reason)
    .fetch_one(&state.db)
    .await
    .map_err(|err| ApiError::BadRequest(format!("审核失败: {err}")))?;
    let message = if status == "active" {
        "车辆审核通过"
    } else {
        "车辆已拒绝"
    };

    Ok(ok(message, vehicle))
}

async fn resubmit_vehicle<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let status: Option<String> = sqlx::query_scalar("SELECT status FROM vehicles WHERE id = $1")
        .bind(&id)
        .fetch_optional(&state.db)
        .await?
        .flatten();
    let status = status.ok_or_else(|| ApiError::NotFound("车辆不存在".to_string()))?;
    if status != "rejected" {
        return Err(ApiError::BadRequest(
            "只有被拒绝的车辆可以重新提交".to_string(),
        ));
    }

    let vehicle = sqlx::query_scalar::<_, Value>(
        r#"
        UPDATE vehicles
        SET status = 'pending',
            remarks = null
        WHERE id = $1
        RETURNING row_to_json(vehicles)
        "#,
    )
    .bind(id)
    .fetch_one(&state.db)
    .await
    .map_err(|err| ApiError::BadRequest(format!("重新提交失败: {err}")))?;

    Ok(ok("已重新提交审核", vehicle))
}

async fn update_availability<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
    Json(body): Json<AvailabilityRequest>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let vehicle = fetch_permission_row(&state.db, &id).await?;
    let user_id = non_empty(body.user_id)
        .ok_or_else(|| ApiError::BadRequest("用户ID不能为空".to_string()))?;
    let is_owner = vehicle.owner_id.as_deref() == Some(user_id.as_str());
    let is_renter = vehicle.current_renter_id.as_deref() == Some(user_id.as_str());

    if !is_owner && !is_renter {
        return Err(ApiError::Forbidden("您无权操作该车辆".to_string()));
    }
    if vehicle.current_renter_id.is_some() {
        if is_owner {
            return Err(ApiError::BadRequest(
                "车辆已租出，无法设置出车状态".to_string(),
            ));
        }
    } else if is_renter {
        return Err(ApiError::BadRequest(
            "租赁已到期，无法设置出车状态".to_string(),
        ));
    }
    if vehicle.status.as_deref() != Some("active") {
        return Err(ApiError::BadRequest(
            "只有审核通过的车辆可以切换运营状态".to_string(),
        ));
    }
    if vehicle.trip_status.as_deref() == Some("in_transit") && !body.is_available {
        return Err(ApiError::BadRequest(
            "车辆正在运输中，无法设置为不出车状态".to_string(),
        ));
    }

    let updated = sqlx::query_scalar::<_, Value>(
        r#"
        UPDATE vehicles
        SET is_available = $2
        WHERE id = $1
        RETURNING row_to_json(vehicles)
        "#,
    )
    .bind(id)
    .bind(body.is_available)
    .fetch_one(&state.db)
    .await
    .map_err(|err| ApiError::BadRequest(format!("更新运营状态失败: {err}")))?;
    let message = if body.is_available {
        "车辆已设置为出车"
    } else {
        "车辆已设置为不出车"
    };

    Ok(ok(message, updated))
}

async fn get_rental_settings<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    ensure_vehicle_exists(&state.db, &id).await?;
    let settings = rental_settings_value(&state.db, &id).await?;

    Ok(ok("查询成功", settings))
}

async fn update_rental_settings<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
    Json(body): Json<RentalSettingsRequest>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let vehicle = fetch_permission_row(&state.db, &id).await?;
    if vehicle.status.as_deref() != Some("active") {
        return Err(ApiError::BadRequest(
            "只有审核通过的车辆可以设置租赁".to_string(),
        ));
    }
    if body.is_available_for_rent == Some(true) && vehicle.current_renter_id.is_some() {
        return Err(ApiError::BadRequest(
            "租赁车辆不能设置为可租赁状态，请先归还车辆".to_string(),
        ));
    }

    sqlx::query(
        r#"
        UPDATE vehicles
        SET is_available_for_rent = CASE WHEN $2 THEN $3 ELSE is_available_for_rent END,
            rent_monthly_price = CASE WHEN $4 THEN $5::numeric ELSE rent_monthly_price END,
            rent_yearly_price = CASE WHEN $6 THEN $7::numeric ELSE rent_yearly_price END,
            rent_deposit = CASE WHEN $8 THEN $9::numeric ELSE rent_deposit END,
            contact_phone = CASE WHEN $10 THEN $11 ELSE contact_phone END,
            contact_wechat = CASE WHEN $12 THEN $13 ELSE contact_wechat END,
            rental_notes = CASE WHEN $14 THEN $15 ELSE rental_notes END,
            updated_at = now()
        WHERE id = $1
        "#,
    )
    .bind(&id)
    .bind(body.is_available_for_rent.is_some())
    .bind(body.is_available_for_rent)
    .bind(body.rent_monthly_price.is_some())
    .bind(body.rent_monthly_price)
    .bind(body.rent_yearly_price.is_some())
    .bind(body.rent_yearly_price)
    .bind(body.rent_deposit.is_some())
    .bind(body.rent_deposit)
    .bind(body.contact_phone.is_some())
    .bind(body.contact_phone)
    .bind(body.contact_wechat.is_some())
    .bind(body.contact_wechat)
    .bind(body.notes.is_some())
    .bind(body.notes)
    .execute(&state.db)
    .await
    .map_err(|err| ApiError::BadRequest(format!("更新租赁设置失败: {err}")))?;
    let settings = rental_settings_value(&state.db, &id).await?;

    Ok(ok("租赁设置已更新", settings))
}

async fn enrich_vehicle(
    pool: &sqlx::PgPool,
    vehicle: &mut Value,
    user_id: Option<&str>,
    ownership_type: Option<&'static str>,
) -> ApiResult<()> {
    let owner_id = vehicle
        .get("owner_id")
        .and_then(Value::as_str)
        .map(str::to_string);
    let current_renter_id = vehicle
        .get("current_renter_id")
        .and_then(Value::as_str)
        .map(str::to_string);
    let owner = if let Some(owner_id) = owner_id.as_deref() {
        sqlx::query_scalar::<_, Value>(
            r#"
            SELECT jsonb_build_object(
                'id', id,
                'phone', phone,
                'role', role,
                'name', name
            )
            FROM users
            WHERE id = $1
            "#,
        )
        .bind(owner_id)
        .fetch_optional(pool)
        .await?
        .unwrap_or(Value::Null)
    } else {
        Value::Null
    };

    let (can_toggle, reason) =
        availability_control(owner_id.as_deref(), current_renter_id.as_deref(), user_id);

    if let Value::Object(map) = vehicle {
        if let Some(ownership_type) = ownership_type {
            map.insert("ownership_type".to_string(), json!(ownership_type));
        }
        map.insert("owner".to_string(), owner);
        map.insert("can_toggle_availability".to_string(), json!(can_toggle));
        map.insert(
            "availability_control_reason".to_string(),
            reason.map_or(Value::Null, Value::String),
        );
    }

    Ok(())
}

fn availability_control(
    owner_id: Option<&str>,
    current_renter_id: Option<&str>,
    user_id: Option<&str>,
) -> (bool, Option<String>) {
    let Some(user_id) = user_id else {
        return (true, None);
    };
    let is_owner = owner_id == Some(user_id);
    let is_renter = current_renter_id == Some(user_id);

    if current_renter_id.is_some() {
        if is_owner {
            (false, Some("车辆已租出，无法设置出车状态".to_string()))
        } else if is_renter {
            (true, None)
        } else {
            (false, Some("您无权操作该车辆".to_string()))
        }
    } else if is_owner {
        (true, None)
    } else if is_renter {
        (false, Some("租赁已到期，无法设置出车状态".to_string()))
    } else {
        (false, Some("您无权操作该车辆".to_string()))
    }
}

async fn fetch_vehicle(pool: &sqlx::PgPool, id: &str) -> ApiResult<Value> {
    sqlx::query_scalar::<_, Value>("SELECT row_to_json(vehicles) FROM vehicles WHERE id = $1")
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::NotFound("车辆不存在".to_string()))
}

async fn ensure_vehicle_exists(pool: &sqlx::PgPool, id: &str) -> ApiResult<()> {
    let exists: bool = sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM vehicles WHERE id = $1)")
        .bind(id)
        .fetch_one(pool)
        .await?;
    if exists {
        Ok(())
    } else {
        Err(ApiError::NotFound("车辆不存在".to_string()))
    }
}

async fn fetch_permission_row(pool: &sqlx::PgPool, id: &str) -> ApiResult<VehiclePermissionRow> {
    sqlx::query_as::<_, VehiclePermissionRow>(
        r#"
        SELECT owner_id, current_renter_id, status, trip_status
        FROM vehicles
        WHERE id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| ApiError::NotFound("车辆不存在".to_string()))
}

async fn rental_settings_value(pool: &sqlx::PgPool, id: &str) -> ApiResult<Value> {
    sqlx::query_scalar::<_, Value>(
        r#"
        SELECT jsonb_build_object(
            'id', id,
            'is_available_for_rent', COALESCE(is_available_for_rent, false),
            'rent_monthly_price', COALESCE(rent_monthly_price, 0),
            'rent_yearly_price', COALESCE(rent_yearly_price, 0),
            'rent_deposit', COALESCE(rent_deposit, 0),
            'contact_phone', contact_phone,
            'contact_wechat', contact_wechat,
            'current_renter_id', current_renter_id,
            'rent_start_date', rent_start_date,
            'rent_end_date', rent_end_date,
            'rent_type', rent_type,
            'rental_notes', rental_notes
        )
        FROM vehicles
        WHERE id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| ApiError::NotFound("车辆不存在".to_string()))
}

fn vehicle_id(vehicle: &Value) -> Option<&str> {
    vehicle.get("id").and_then(Value::as_str)
}

fn vehicle_upload_error(error: ApiError) -> Json<Value> {
    Json(json!({
        "code": 500,
        "message": format!("上传失败: {error}")
    }))
}

fn required_string(body: &Value, key: &str, missing_message: &str) -> ApiResult<String> {
    string_field(body, key).ok_or_else(|| ApiError::BadRequest(missing_message.to_string()))
}

fn string_field(body: &Value, key: &str) -> Option<String> {
    body.get(key)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

fn required_number(body: &Value, key: &str, missing_message: &str) -> ApiResult<f64> {
    number_field(body, key)?.ok_or_else(|| ApiError::BadRequest(missing_message.to_string()))
}

fn number_field(body: &Value, key: &str) -> ApiResult<Option<f64>> {
    match body.get(key) {
        None | Some(Value::Null) => Ok(None),
        Some(Value::Number(value)) => value
            .as_f64()
            .map(Some)
            .ok_or_else(|| ApiError::BadRequest(format!("{key} 参数不正确"))),
        Some(Value::String(value)) => value
            .trim()
            .parse::<f64>()
            .map(Some)
            .map_err(|_| ApiError::BadRequest(format!("{key} 参数不正确"))),
        Some(_) => Err(ApiError::BadRequest(format!("{key} 参数不正确"))),
    }
}

fn boolish_field(body: &Value, key: &str) -> Option<bool> {
    match body.get(key) {
        Some(Value::Bool(value)) => Some(*value),
        Some(Value::String(value)) => Some(value == "true"),
        _ => None,
    }
}

fn json_field(body: &Value, key: &str) -> ApiResult<Option<Value>> {
    match body.get(key) {
        None | Some(Value::Null) => Ok(None),
        Some(Value::String(value)) if value.trim().is_empty() => Ok(None),
        Some(Value::String(value)) => serde_json::from_str::<Value>(value)
            .map(Some)
            .map_err(|_| ApiError::BadRequest(format!("{key} 参数不正确"))),
        Some(value @ (Value::Array(_) | Value::Object(_))) => Ok(Some(value.clone())),
        Some(_) => Err(ApiError::BadRequest(format!("{key} 参数不正确"))),
    }
}

fn photo_urls_field(body: &Value) -> Vec<String> {
    match body.get("photoUrls") {
        Some(Value::Array(values)) => values
            .iter()
            .filter_map(Value::as_str)
            .map(str::to_string)
            .collect(),
        Some(Value::String(value)) => {
            serde_json::from_str::<Vec<String>>(value).unwrap_or_default()
        }
        _ => Vec::new(),
    }
}

fn photos_value(photo_urls: Vec<String>) -> Option<Value> {
    if photo_urls.is_empty() {
        None
    } else {
        Some(Value::String(
            serde_json::to_string(&photo_urls).unwrap_or_else(|_| "[]".to_string()),
        ))
    }
}

fn non_empty(value: Option<String>) -> Option<String> {
    value
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}
