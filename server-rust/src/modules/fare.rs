use axum::{extract::State, routing::post, Json, Router};
use serde::{Deserialize, Serialize};
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
        .route("/api/fare/calculate", post(calculate::<S>))
        .route(
            "/api/fare/calculate-multiple",
            post(calculate_multiple::<S>),
        )
        .route("/api/fare/validate-pricing", post(validate_pricing::<S>))
}

#[derive(Debug, Deserialize)]
struct CalculateRequest {
    vehicle_id: String,
    total_distance: f64,
}

#[derive(Debug, Deserialize)]
struct CalculateMultipleRequest {
    vehicle_ids: Vec<String>,
    pickup_lat: f64,
    pickup_lng: f64,
    delivery_lat: f64,
    delivery_lng: f64,
}

#[derive(Debug, Deserialize)]
struct ValidatePricingRequest {
    base_price: f64,
    base_distance: f64,
    price_per_km: f64,
}

#[derive(Debug, FromRow)]
struct VehiclePricingRow {
    id: String,
    vehicle_type: Option<String>,
    base_price: Option<f64>,
    base_distance: Option<f64>,
    price_per_km: Option<f64>,
}

#[derive(Debug, Serialize, Clone)]
struct FareCalculationDetail {
    base_price: f64,
    base_distance: f64,
    price_per_km: f64,
    total_distance: f64,
    extra_distance: f64,
    extra_fare: f64,
    total_fare: f64,
}

#[derive(Debug, Serialize, Clone)]
struct FareCalculationResult {
    vehicle_id: String,
    vehicle_type: Option<String>,
    base_price: f64,
    base_distance: f64,
    price_per_km: f64,
    total_distance: f64,
    extra_distance: f64,
    extra_fare: f64,
    total_fare: f64,
    calculation_detail: FareCalculationDetail,
    route_type: String,
    is_estimate: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    route_duration: Option<f64>,
}

#[derive(Debug, Serialize)]
struct ValidatePricingResult {
    valid: bool,
    errors: Vec<String>,
}

#[derive(Debug, Serialize)]
struct RouteInfo {
    route_type: String,
    is_estimate: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    route_duration: Option<f64>,
}

#[derive(Debug, Serialize)]
struct FareRange {
    min: f64,
    max: f64,
    text: String,
}

#[derive(Debug, Serialize)]
struct CalculateMultipleResponse {
    vehicles: Vec<FareCalculationResult>,
    route_info: Option<RouteInfo>,
    fare_range: FareRange,
}

async fn calculate<S>(
    State(state): State<AppState<S>>,
    Json(body): Json<CalculateRequest>,
) -> ApiResult<Json<ApiEnvelope<FareCalculationResult>>>
where
    S: Storage,
{
    let result = calculate_fare(&state.db, &body.vehicle_id, body.total_distance).await?;

    Ok(ok("计算成功", result))
}

async fn calculate_multiple<S>(
    State(state): State<AppState<S>>,
    Json(body): Json<CalculateMultipleRequest>,
) -> ApiResult<Json<ApiEnvelope<CalculateMultipleResponse>>>
where
    S: Storage,
{
    let distance = haversine_km(
        body.pickup_lat,
        body.pickup_lng,
        body.delivery_lat,
        body.delivery_lng,
    );
    let route_duration = (distance / 40.0 * 60.0).ceil();
    let route_duration = if route_duration.is_finite() && route_duration > 0.0 {
        Some(route_duration)
    } else {
        None
    };
    let mut vehicles = Vec::new();

    for vehicle_id in body.vehicle_ids {
        if let Ok(mut fare) = calculate_fare(&state.db, &vehicle_id, distance).await {
            fare.route_type = "estimated".to_string();
            fare.is_estimate = true;
            fare.route_duration = route_duration;
            vehicles.push(fare);
        }
    }

    if vehicles.is_empty() {
        return Err(ApiError::BadRequest("所有车辆运费计算失败".to_string()));
    }

    let min = vehicles
        .iter()
        .map(|vehicle| vehicle.total_fare)
        .fold(f64::INFINITY, f64::min);
    let max = vehicles
        .iter()
        .map(|vehicle| vehicle.total_fare)
        .fold(f64::NEG_INFINITY, f64::max);
    let first = vehicles.first();
    let route_info = first.map(|vehicle| RouteInfo {
        route_type: vehicle.route_type.clone(),
        is_estimate: vehicle.is_estimate,
        route_duration: vehicle.route_duration,
    });

    Ok(ok(
        "计算成功",
        CalculateMultipleResponse {
            vehicles,
            route_info,
            fare_range: FareRange {
                min,
                max,
                text: format!("¥{min:.2} - ¥{max:.2}"),
            },
        },
    ))
}

async fn validate_pricing<S>(
    Json(body): Json<ValidatePricingRequest>,
) -> ApiResult<Json<ApiEnvelope<ValidatePricingResult>>>
where
    S: Storage,
{
    let result = validate_pricing_params(&body);
    let message = if result.valid {
        "定价参数合理"
    } else {
        "定价参数不合理"
    };

    Ok(ok(message, result))
}

async fn calculate_fare(
    pool: &sqlx::PgPool,
    vehicle_id: &str,
    total_distance: f64,
) -> ApiResult<FareCalculationResult> {
    let vehicle = sqlx::query_as::<_, VehiclePricingRow>(
        r#"
        SELECT
            id,
            vehicle_type,
            base_price::float8 AS base_price,
            base_distance::float8 AS base_distance,
            price_per_km::float8 AS price_per_km
        FROM vehicles
        WHERE id = $1
        "#,
    )
    .bind(vehicle_id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| ApiError::BadRequest("车辆不存在或定价信息不完整".to_string()))?;

    let base_price = vehicle
        .base_price
        .ok_or_else(|| ApiError::BadRequest("车辆定价信息不完整，请先设置定价".to_string()))?;
    let base_distance = vehicle
        .base_distance
        .ok_or_else(|| ApiError::BadRequest("车辆定价信息不完整，请先设置定价".to_string()))?;
    let price_per_km = vehicle
        .price_per_km
        .ok_or_else(|| ApiError::BadRequest("车辆定价信息不完整，请先设置定价".to_string()))?;
    let extra_distance = (total_distance - base_distance).max(0.0);
    let extra_fare = extra_distance * price_per_km;
    let total_fare = base_price + extra_fare;
    let calculation_detail = FareCalculationDetail {
        base_price,
        base_distance,
        price_per_km,
        total_distance,
        extra_distance,
        extra_fare,
        total_fare,
    };

    Ok(FareCalculationResult {
        vehicle_id: vehicle.id,
        vehicle_type: vehicle.vehicle_type,
        base_price,
        base_distance,
        price_per_km,
        total_distance,
        extra_distance,
        extra_fare,
        total_fare,
        calculation_detail,
        route_type: "non_highway".to_string(),
        is_estimate: false,
        route_duration: None,
    })
}

fn validate_pricing_params(params: &ValidatePricingRequest) -> ValidatePricingResult {
    let mut errors = Vec::new();

    if params.base_price < 10.0 || params.base_price > 500.0 {
        errors.push("起步价必须在 10-500 元之间".to_string());
    }
    if params.base_distance < 1.0 || params.base_distance > 10.0 {
        errors.push("起步公里数必须在 1-10 公里之间".to_string());
    }
    if params.price_per_km < 0.5 || params.price_per_km > 20.0 {
        errors.push("每公里运价必须在 0.5-20 元之间".to_string());
    }

    let unit_base_price = params.base_price / params.base_distance;
    if unit_base_price > 100.0 {
        errors.push("起步价与起步公里数的比例过高，请调整定价".to_string());
    }

    let base_fare = params.base_price * params.base_distance;
    if base_fare > 500.0 {
        errors.push("起步费过高，请调整定价".to_string());
    }

    ValidatePricingResult {
        valid: errors.is_empty(),
        errors,
    }
}

fn haversine_km(from_lat: f64, from_lng: f64, to_lat: f64, to_lng: f64) -> f64 {
    let earth_radius_km = 6_371.0;
    let d_lat = (to_lat - from_lat).to_radians();
    let d_lng = (to_lng - from_lng).to_radians();
    let from_lat = from_lat.to_radians();
    let to_lat = to_lat.to_radians();
    let a =
        (d_lat / 2.0).sin().powi(2) + from_lat.cos() * to_lat.cos() * (d_lng / 2.0).sin().powi(2);
    let c = 2.0 * a.sqrt().atan2((1.0 - a).sqrt());

    (earth_radius_km * c * 10.0).round() / 10.0
}
