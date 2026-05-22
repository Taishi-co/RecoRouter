use axum::{
    extract::{Path, Query, State},
    routing::get,
    Json, Router,
};
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::{Postgres, QueryBuilder};

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
        .route("/api/admin/users", get(get_users::<S>))
        .route(
            "/api/admin/users/:id/status",
            axum::routing::put(update_user_status::<S>),
        )
        .route("/api/admin/orders", get(get_orders::<S>))
        .route("/api/admin/statistics", get(get_statistics::<S>))
}

#[derive(Debug, Deserialize)]
struct UserFilters {
    role: Option<String>,
    status: Option<String>,
}

#[derive(Debug, Deserialize)]
struct OrderFilters {
    status: Option<String>,
}

#[derive(Debug, Deserialize)]
struct UpdateStatusRequest {
    status: String,
}

async fn get_users<S>(
    State(state): State<AppState<S>>,
    Query(filters): Query<UserFilters>,
) -> ApiResult<Json<ApiEnvelope<Vec<Value>>>>
where
    S: Storage,
{
    let mut builder =
        QueryBuilder::<Postgres>::new("SELECT to_jsonb(users) - 'password' FROM users");
    let mut has_where = false;

    if let Some(role) = non_empty(filters.role) {
        push_where(&mut builder, &mut has_where);
        builder.push("role = ");
        builder.push_bind(role);
    }
    if let Some(status) = non_empty(filters.status) {
        push_where(&mut builder, &mut has_where);
        builder.push("status = ");
        builder.push_bind(status);
    }

    builder.push(" ORDER BY created_at DESC");
    let users = builder
        .build_query_scalar::<Value>()
        .fetch_all(&state.db)
        .await?;

    Ok(ok("查询成功", users))
}

async fn update_user_status<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
    Json(body): Json<UpdateStatusRequest>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let exists: bool = sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM users WHERE id = $1)")
        .bind(&id)
        .fetch_one(&state.db)
        .await?;

    if !exists {
        return Err(ApiError::NotFound("用户不存在".to_string()));
    }

    let user = sqlx::query_scalar::<_, Value>(
        r#"
        UPDATE users
        SET status = $2, updated_at = now()
        WHERE id = $1
        RETURNING to_jsonb(users) - 'password'
        "#,
    )
    .bind(&id)
    .bind(&body.status)
    .fetch_one(&state.db)
    .await?;

    Ok(ok("更新成功", user))
}

async fn get_orders<S>(
    State(state): State<AppState<S>>,
    Query(filters): Query<OrderFilters>,
) -> ApiResult<Json<ApiEnvelope<Vec<Value>>>>
where
    S: Storage,
{
    let orders = if let Some(status) = non_empty(filters.status) {
        sqlx::query_scalar::<_, Value>(
            r#"
            SELECT jsonb_build_object(
                'id', o.id,
                'demand_id', o.demand_id,
                'vehicle_id', o.vehicle_id,
                'merchant_id', o.merchant_id,
                'owner_id', o.owner_id,
                'status', o.status,
                'pickup_photo_key', o.pickup_photo_key,
                'delivery_photo_key', o.delivery_photo_key,
                'delivery_proof_key', o.delivery_proof_key,
                'cancel_reason', o.cancel_reason,
                'cancel_time', o.cancel_time,
                'accept_time', o.accept_time,
                'complete_time', o.complete_time,
                'pickup_time', o.pickup_time,
                'pickup_address', o.pickup_address,
                'delivery_address', o.delivery_address,
                'remarks', o.remarks,
                'fare_price', o.fare_price,
                'merchant_confirmed', o.merchant_confirmed,
                'confirm_time', o.confirm_time,
                'payment_status', o.payment_status,
                'commission_amount', o.commission_amount,
                'commission_payment_status', o.commission_payment_status,
                'transport_completed_time', o.transport_completed_time,
                'payment_time', o.payment_time,
                'payment_confirm_time', o.payment_confirm_time,
                'commission_payment_time', o.commission_payment_time,
                'commission_confirm_time', o.commission_confirm_time,
                'actual_complete_time', o.actual_complete_time,
                'created_at', o.created_at,
                'updated_at', o.updated_at,
                'demand', (
                    SELECT to_jsonb(d)
                    FROM (
                        SELECT id, cargo_name, cargo_type, weight, volume,
                               pickup_address, delivery_address, pickup_time
                        FROM demands
                        WHERE id = o.demand_id
                    ) d
                ),
                'vehicle', (
                    SELECT to_jsonb(v)
                    FROM (
                        SELECT id, vehicle_type, license_plate
                        FROM vehicles
                        WHERE id = o.vehicle_id
                    ) v
                ),
                'owner', (
                    SELECT to_jsonb(u)
                    FROM (
                        SELECT id, username, phone
                        FROM users
                        WHERE id = o.owner_id
                    ) u
                ),
                'merchant', (
                    SELECT to_jsonb(u)
                    FROM (
                        SELECT id, username, phone
                        FROM users
                        WHERE id = o.merchant_id
                    ) u
                )
            )
            FROM orders o
            WHERE o.status = $1
            ORDER BY o.created_at DESC
            "#,
        )
        .bind(status)
        .fetch_all(&state.db)
        .await?
    } else {
        sqlx::query_scalar::<_, Value>(
            r#"
            SELECT jsonb_build_object(
                'id', o.id,
                'demand_id', o.demand_id,
                'vehicle_id', o.vehicle_id,
                'merchant_id', o.merchant_id,
                'owner_id', o.owner_id,
                'status', o.status,
                'pickup_photo_key', o.pickup_photo_key,
                'delivery_photo_key', o.delivery_photo_key,
                'delivery_proof_key', o.delivery_proof_key,
                'cancel_reason', o.cancel_reason,
                'cancel_time', o.cancel_time,
                'accept_time', o.accept_time,
                'complete_time', o.complete_time,
                'pickup_time', o.pickup_time,
                'pickup_address', o.pickup_address,
                'delivery_address', o.delivery_address,
                'remarks', o.remarks,
                'fare_price', o.fare_price,
                'merchant_confirmed', o.merchant_confirmed,
                'confirm_time', o.confirm_time,
                'payment_status', o.payment_status,
                'commission_amount', o.commission_amount,
                'commission_payment_status', o.commission_payment_status,
                'transport_completed_time', o.transport_completed_time,
                'payment_time', o.payment_time,
                'payment_confirm_time', o.payment_confirm_time,
                'commission_payment_time', o.commission_payment_time,
                'commission_confirm_time', o.commission_confirm_time,
                'actual_complete_time', o.actual_complete_time,
                'created_at', o.created_at,
                'updated_at', o.updated_at,
                'demand', (
                    SELECT to_jsonb(d)
                    FROM (
                        SELECT id, cargo_name, cargo_type, weight, volume,
                               pickup_address, delivery_address, pickup_time
                        FROM demands
                        WHERE id = o.demand_id
                    ) d
                ),
                'vehicle', (
                    SELECT to_jsonb(v)
                    FROM (
                        SELECT id, vehicle_type, license_plate
                        FROM vehicles
                        WHERE id = o.vehicle_id
                    ) v
                ),
                'owner', (
                    SELECT to_jsonb(u)
                    FROM (
                        SELECT id, username, phone
                        FROM users
                        WHERE id = o.owner_id
                    ) u
                ),
                'merchant', (
                    SELECT to_jsonb(u)
                    FROM (
                        SELECT id, username, phone
                        FROM users
                        WHERE id = o.merchant_id
                    ) u
                )
            )
            FROM orders o
            ORDER BY o.created_at DESC
            "#,
        )
        .fetch_all(&state.db)
        .await?
    };

    Ok(ok("查询成功", orders))
}

async fn get_statistics<S>(State(state): State<AppState<S>>) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let user_rows: Vec<(Option<String>, Option<String>)> =
        sqlx::query_as("SELECT role, status FROM users WHERE role IS DISTINCT FROM 'admin'")
            .fetch_all(&state.db)
            .await?;
    let order_statuses: Vec<Option<String>> = sqlx::query_scalar("SELECT status FROM orders")
        .fetch_all(&state.db)
        .await?;
    let vehicle_statuses: Vec<Option<String>> = sqlx::query_scalar("SELECT status FROM vehicles")
        .fetch_all(&state.db)
        .await?;
    let demand_statuses: Vec<Option<String>> = sqlx::query_scalar("SELECT status FROM demands")
        .fetch_all(&state.db)
        .await?;

    Ok(ok(
        "查询成功",
        json!({
            "users": {
                "total": user_rows.len(),
                "owner": user_rows.iter().filter(|(role, _)| role.as_deref() == Some("owner")).count(),
                "merchant": user_rows.iter().filter(|(role, _)| role.as_deref() == Some("merchant")).count(),
                "active": user_rows.iter().filter(|(_, status)| status.as_deref() == Some("active")).count(),
                "disabled": user_rows.iter().filter(|(_, status)| status.as_deref() == Some("disabled")).count()
            },
            "orders": status_group(&order_statuses, &["pending", "accepted", "in_transit", "completed", "cancelled"]),
            "vehicles": status_group(&vehicle_statuses, &["pending", "active", "inactive"]),
            "demands": status_group(&demand_statuses, &["pending", "accepted", "in_transit", "completed", "cancelled"])
        }),
    ))
}

fn status_group(statuses: &[Option<String>], keys: &[&str]) -> Value {
    let mut object = serde_json::Map::new();
    object.insert("total".to_string(), json!(statuses.len()));
    for key in keys {
        object.insert(
            (*key).to_string(),
            json!(statuses
                .iter()
                .filter(|status| status.as_deref() == Some(*key))
                .count()),
        );
    }
    Value::Object(object)
}

fn push_where(builder: &mut QueryBuilder<'_, Postgres>, has_where: &mut bool) {
    if *has_where {
        builder.push(" AND ");
    } else {
        builder.push(" WHERE ");
        *has_where = true;
    }
}

fn non_empty(value: Option<String>) -> Option<String> {
    value
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}
