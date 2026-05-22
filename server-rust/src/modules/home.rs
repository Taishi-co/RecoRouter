use axum::{
    extract::{DefaultBodyLimit, Multipart, State},
    routing::{get, post},
    Json, Router,
};
use chrono::{DateTime, Utc};
use rand::{distributions::Alphanumeric, Rng};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::FromRow;

use crate::{
    app::AppState,
    error::{ApiError, ApiResult},
    response::{ok, ApiEnvelope},
    storage::Storage,
};

const MAX_FILE_SIZE: usize = 5 * 1024 * 1024;
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
        .route("/api/home/statistics", get(statistics::<S>))
        .route("/api/home/latest-info", get(latest_info::<S>))
        .route("/api/home/analyze-cargo", post(analyze_cargo::<S>))
        .route("/api/home/upload", post(upload))
        .route_layer(DefaultBodyLimit::disable())
}

#[derive(Debug, Serialize)]
struct UploadResponse {
    #[serde(rename = "fileKey")]
    file_key: String,
    url: String,
}

#[derive(Debug, Deserialize)]
struct AnalyzeCargoRequest {
    photos: Option<Vec<String>>,
}

#[derive(Debug, FromRow)]
struct LatestDemandRow {
    id: String,
    cargo_name: Option<String>,
    cargo_type: Option<String>,
    pickup_address: Option<String>,
    delivery_address: Option<String>,
    merchant_phone: Option<String>,
    created_at: Option<DateTime<Utc>>,
}

#[derive(Debug, FromRow)]
struct AvailableVehicleRow {
    id: String,
    vehicle_type: Option<String>,
    license_plate: Option<String>,
    owner_phone: Option<String>,
    created_at: Option<DateTime<Utc>>,
}

#[derive(Debug, FromRow)]
struct CompletedOrderRow {
    id: String,
    cargo_name: Option<String>,
    owner_phone: Option<String>,
    fare_price: Option<f64>,
    actual_complete_time: Option<DateTime<Utc>>,
}

async fn upload<S>(
    State(state): State<AppState<S>>,
    mut multipart: Multipart,
) -> ApiResult<Json<ApiEnvelope<UploadResponse>>>
where
    S: Storage,
{
    let mut ignored_field_bytes = 0usize;

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|err| ApiError::BadRequest(err.to_string()))?
    {
        if field.name() != Some("file") {
            consume_ignored_field(field, &mut ignored_field_bytes).await?;
            continue;
        }

        let content_type = field.content_type().map(str::to_string);
        if !content_type
            .as_deref()
            .is_some_and(|value| ALLOWED_IMAGE_TYPES.contains(&value))
        {
            return Err(ApiError::BadRequest(
                "不支持的文件类型，请上传图片文件".to_string(),
            ));
        }

        let extension = extension_for_content_type(content_type.as_deref())
            .ok_or_else(|| ApiError::BadRequest("不支持的文件类型，请上传图片文件".to_string()))?;
        let bytes = read_file_bytes(field).await?;

        if bytes.is_empty() {
            return Err(ApiError::BadRequest("文件不能为空".to_string()));
        }

        if bytes.len() > MAX_FILE_SIZE {
            return Err(ApiError::BadRequest("文件大小不能超过5MB".to_string()));
        }

        let file_name = format!(
            "cargo-photos/{}-{}.{}",
            Utc::now().timestamp_millis(),
            random_id(),
            extension
        );
        let file_key = state
            .storage
            .put(bytes.to_vec(), &file_name, content_type.as_deref())
            .await?;
        let url = state.storage.public_url(&file_key).await?;

        return Ok(ok("上传成功", UploadResponse { file_key, url }));
    }

    Err(ApiError::BadRequest("文件不能为空".to_string()))
}

async fn latest_info<S>(State(state): State<AppState<S>>) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let latest_demands = sqlx::query_as::<_, LatestDemandRow>(
        r#"
        SELECT
            demand.id,
            demand.cargo_name,
            demand.cargo_type,
            demand.pickup_address,
            demand.delivery_address,
            user_row.phone AS merchant_phone,
            demand.created_at
        FROM demands demand
        LEFT JOIN users user_row ON user_row.id = demand.merchant_id
        WHERE demand.status = 'pending'
        ORDER BY demand.created_at DESC
        LIMIT 10
        "#,
    )
    .fetch_all(&state.db)
    .await
    .map_err(|err| {
        tracing::error!(error = ?err, "home latest demands query failed");
        ApiError::Database(err)
    })?;
    let latest_demands: Vec<Value> = latest_demands
        .into_iter()
        .map(|demand| {
            json!({
                "id": demand.id,
                "cargoName": demand.cargo_name,
                "cargoType": demand.cargo_type,
                "pickupAddress": mask_address(demand.pickup_address.as_deref()),
                "deliveryAddress": mask_address(demand.delivery_address.as_deref()),
                "merchantPhone": mask_phone(demand.merchant_phone.as_deref()),
                "createdAt": demand.created_at
            })
        })
        .collect();

    let available_vehicles = sqlx::query_as::<_, AvailableVehicleRow>(
        r#"
        SELECT
            vehicle.id,
            vehicle.vehicle_type,
            vehicle.license_plate,
            user_row.phone AS owner_phone,
            vehicle.created_at
        FROM vehicles vehicle
        LEFT JOIN users user_row ON user_row.id = vehicle.owner_id
        WHERE vehicle.status = 'active'
        ORDER BY vehicle.created_at DESC
        LIMIT 5
        "#,
    )
    .fetch_all(&state.db)
    .await
    .map_err(|err| {
        tracing::error!(error = ?err, "home available vehicles query failed");
        ApiError::Database(err)
    })?;
    let available_vehicles: Vec<Value> = available_vehicles
        .into_iter()
        .map(|vehicle| {
            json!({
                "id": vehicle.id,
                "vehicleType": vehicle.vehicle_type,
                "licensePlate": mask_license_plate(vehicle.license_plate.as_deref()),
                "ownerPhone": mask_phone(vehicle.owner_phone.as_deref()),
                "status": "active",
                "createdAt": vehicle.created_at
            })
        })
        .collect();

    let completed_orders = sqlx::query_as::<_, CompletedOrderRow>(
        r#"
        SELECT
            order_row.id,
            demand.cargo_name,
            user_row.phone AS owner_phone,
            order_row.fare_price::float8 AS fare_price,
            order_row.actual_complete_time
        FROM orders order_row
        LEFT JOIN demands demand ON demand.id = order_row.demand_id
        LEFT JOIN users user_row ON user_row.id = order_row.owner_id
        WHERE order_row.status = 'completed'
        ORDER BY order_row.actual_complete_time DESC NULLS LAST
        LIMIT 5
        "#,
    )
    .fetch_all(&state.db)
    .await
    .map_err(|err| {
        tracing::error!(error = ?err, "home completed orders query failed");
        ApiError::Database(err)
    })?;
    let completed_orders: Vec<Value> = completed_orders
        .into_iter()
        .map(|order| {
            json!({
                "id": order.id,
                "cargoName": order.cargo_name.unwrap_or_default(),
                "ownerPhone": mask_phone(order.owner_phone.as_deref()),
                "farePrice": order.fare_price,
                "completedTime": order.actual_complete_time
            })
        })
        .collect();

    Ok(ok(
        "查询成功",
        json!({
            "latestDemands": latest_demands,
            "availableVehicles": available_vehicles,
            "completedOrders": completed_orders
        }),
    ))
}

fn mask_phone(phone: Option<&str>) -> String {
    let Some(phone) = phone else {
        return String::new();
    };
    let chars: Vec<char> = phone.chars().collect();
    if chars.len() < 11 {
        return phone.to_string();
    }

    let prefix: String = chars.iter().take(3).collect();
    let suffix: String = chars.iter().skip(7).collect();
    format!("{prefix}****{suffix}")
}

fn mask_address(address: Option<&str>) -> Option<String> {
    let address = address?;
    let chars: Vec<char> = address.chars().collect();
    if chars.len() <= 6 {
        return Some("***".to_string());
    }

    let prefix: String = chars.iter().take(6).collect();
    Some(format!("{prefix}***"))
}

fn mask_license_plate(plate: Option<&str>) -> Option<String> {
    let plate = plate?;
    let chars: Vec<char> = plate.chars().collect();
    if chars.len() < 7 {
        return Some(plate.to_string());
    }

    let prefix: String = chars.iter().take(2).collect();
    Some(format!("{prefix}****"))
}

async fn statistics<S>(State(state): State<AppState<S>>) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let order_statuses: Vec<Option<String>> = sqlx::query_scalar("SELECT status FROM orders")
        .fetch_all(&state.db)
        .await
        .unwrap_or_default();
    let vehicle_statuses: Vec<Option<String>> = sqlx::query_scalar("SELECT status FROM vehicles")
        .fetch_all(&state.db)
        .await
        .unwrap_or_default();
    let demand_statuses: Vec<Option<String>> = sqlx::query_scalar("SELECT status FROM demands")
        .fetch_all(&state.db)
        .await
        .unwrap_or_default();
    let recent_orders: Value = sqlx::query_scalar(
        r#"
        SELECT COALESCE(jsonb_agg(
            jsonb_build_object(
                'id', order_row.id,
                'cargoName', COALESCE(demand.cargo_name, ''),
                'ownerName', COALESCE(user_row.name, ''),
                'farePrice', order_row.fare_price,
                'completeTime', order_row.actual_complete_time
            )
            ORDER BY order_row.actual_complete_time DESC
        ), '[]'::jsonb)
        FROM (
            SELECT id, demand_id, owner_id, fare_price, commission_amount, actual_complete_time
            FROM orders
            WHERE status = 'completed'
              AND actual_complete_time IS NOT NULL
            ORDER BY actual_complete_time DESC
            LIMIT 5
        ) order_row
        LEFT JOIN demands demand ON demand.id = order_row.demand_id
        LEFT JOIN users user_row ON user_row.id = order_row.owner_id
        "#,
    )
    .fetch_one(&state.db)
    .await
    .unwrap_or_else(|_| json!([]));

    Ok(ok(
        "查询成功",
        json!({
            "orders": {
                "total": order_statuses.len(),
                "completed": count_status(&order_statuses, "completed"),
                "in_transit": count_status(&order_statuses, "in_transit")
            },
            "vehicles": {
                "total": vehicle_statuses.len(),
                "active": count_status(&vehicle_statuses, "active")
            },
            "demands": {
                "total": demand_statuses.len(),
                "pending": count_status(&demand_statuses, "pending")
            },
            "recentOrders": recent_orders
        }),
    ))
}

async fn analyze_cargo<S>(
    Json(body): Json<AnalyzeCargoRequest>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let photos = body.photos.unwrap_or_default();
    if photos.is_empty() {
        return Err(ApiError::BadRequest("请上传至少一张货品照片".to_string()));
    }

    // Placeholder until the production Rust LLM client replaces the NestJS
    // coze-coding-dev-sdk integration.
    Ok(ok(
        "分析成功",
        json!({
            "cargo_name": "",
            "cargo_type": "",
            "weight": "",
            "volume": ""
        }),
    ))
}

fn extension_for_content_type(content_type: Option<&str>) -> Option<&'static str> {
    match content_type {
        Some("image/jpeg") | Some("image/jpg") => Some("jpg"),
        Some("image/png") => Some("png"),
        Some("image/gif") => Some("gif"),
        Some("image/webp") => Some("webp"),
        _ => None,
    }
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

fn random_id() -> String {
    rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(8)
        .map(char::from)
        .collect()
}

fn count_status(statuses: &[Option<String>], expected: &str) -> usize {
    statuses
        .iter()
        .filter(|status| status.as_deref() == Some(expected))
        .count()
}
