use axum::{extract::Path, routing::get, Json, Router};
use rand::Rng;
use serde_json::{json, Value};

use crate::{app::AppState, response::ApiEnvelope, storage::Storage};

pub fn router<S>() -> Router<AppState<S>>
where
    S: Storage,
{
    Router::new()
        .route("/api/mock/neolix/all", get(all_neolix::<S>))
        .route("/api/mock/neolix/:vehicle_id", get(neolix::<S>))
        .route("/api/mock/ninebot/all", get(all_ninebot::<S>))
        .route("/api/mock/ninebot/:vehicle_sn", get(ninebot::<S>))
        .route("/api/mock/vehicles/all", get(all_vehicles::<S>))
        .route(
            "/api/mock/vehicles/trajectories",
            get(all_trajectories::<S>),
        )
}

async fn neolix<S>(Path(vehicle_id): Path<String>) -> Json<ApiEnvelope<Value>>
where
    S: Storage,
{
    success(neolix_location(&vehicle_id).unwrap_or(Value::Null))
}

async fn all_neolix<S>() -> Json<ApiEnvelope<Value>>
where
    S: Storage,
{
    success(Value::Array(
        ["NL-TS-001"]
            .iter()
            .filter_map(|id| neolix_location(id))
            .collect(),
    ))
}

async fn ninebot<S>(Path(vehicle_sn): Path<String>) -> Json<ApiEnvelope<Value>>
where
    S: Storage,
{
    success(ninebot_location(&vehicle_sn).unwrap_or(Value::Null))
}

async fn all_ninebot<S>() -> Json<ApiEnvelope<Value>>
where
    S: Storage,
{
    success(Value::Array(
        ["NB-TS-001"]
            .iter()
            .filter_map(|id| ninebot_location(id))
            .collect(),
    ))
}

async fn all_vehicles<S>() -> Json<ApiEnvelope<Value>>
where
    S: Storage,
{
    let mut vehicles = Vec::new();
    for item in ["NL-TS-001"].iter().filter_map(|id| neolix_location(id)) {
        vehicles.push(json!({
            "id": item["vehicle_id"],
            "manufacturer": "neolix",
            "latitude": item["latitude"],
            "longitude": item["longitude"],
            "speed": item["speed"],
            "heading": item["heading"],
            "status": item["status"],
            "battery": item["battery_level"],
            "mileage": item["mileage"],
            "timestamp": item["timestamp"]
        }));
    }
    for item in ["NB-TS-001"].iter().filter_map(|id| ninebot_location(id)) {
        vehicles.push(json!({
            "id": item["vehicle_sn"],
            "manufacturer": "ninebot",
            "latitude": item["gps"]["lat"],
            "longitude": item["gps"]["lng"],
            "speed": item["motion"]["speed"],
            "heading": item["motion"]["direction"],
            "status": item["status"].as_str().unwrap_or("").to_lowercase(),
            "battery": item["battery"],
            "mileage": item["mileage"],
            "timestamp": chrono::Utc::now().to_rfc3339()
        }));
    }
    success(Value::Array(vehicles))
}

async fn all_trajectories<S>() -> Json<ApiEnvelope<Value>>
where
    S: Storage,
{
    let now = chrono::Utc::now().timestamp_millis();
    success(json!({
        "NL-TS-001": [
            { "latitude": 39.6304, "longitude": 118.1802, "time": now - 5000 },
            { "latitude": 39.6310, "longitude": 118.1810, "time": now }
        ],
        "NB-TS-001": [
            { "latitude": 39.6500, "longitude": 118.2000, "time": now - 5000 },
            { "latitude": 39.6510, "longitude": 118.2010, "time": now }
        ]
    }))
}

fn neolix_location(vehicle_id: &str) -> Option<Value> {
    if vehicle_id != "NL-TS-001" {
        return None;
    }
    let mut rng = rand::thread_rng();
    Some(json!({
        "vehicle_id": "NL-TS-001",
        "latitude": 39.6304 + rng.gen_range(-0.01..0.01),
        "longitude": 118.1802 + rng.gen_range(-0.01..0.01),
        "altitude": 45.0 + rng.gen_range(0.0..10.0),
        "speed": 90.0 + rng.gen_range(0.0..90.0),
        "heading": rng.gen_range(0..360),
        "timestamp": chrono::Utc::now().to_rfc3339(),
        "battery_level": rng.gen_range(60..100),
        "status": "running",
        "mileage": 1000 + rng.gen_range(0..500)
    }))
}

fn ninebot_location(vehicle_sn: &str) -> Option<Value> {
    if vehicle_sn != "NB-TS-001" {
        return None;
    }
    let mut rng = rand::thread_rng();
    Some(json!({
        "vehicle_sn": "NB-TS-001",
        "gps": {
            "lat": 39.6500 + rng.gen_range(-0.01..0.01),
            "lng": 118.2000 + rng.gen_range(-0.01..0.01),
            "accuracy": 5 + rng.gen_range(0..10)
        },
        "motion": {
            "speed": 90.0 + rng.gen_range(0.0..90.0),
            "direction": rng.gen_range(0..360)
        },
        "status": "DELIVERING",
        "battery": rng.gen_range(50..100),
        "mileage": 800 + rng.gen_range(0..400),
        "updated_at": chrono::Utc::now().timestamp()
    }))
}

fn success<T: serde::Serialize>(data: T) -> Json<ApiEnvelope<T>> {
    Json(ApiEnvelope {
        code: 200,
        message: "success".to_string(),
        data,
    })
}
