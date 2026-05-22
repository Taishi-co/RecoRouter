use axum::{
    extract::{Path, Query, State},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::{Postgres, QueryBuilder};

use crate::{app::AppState, error::ApiResult, response::ApiEnvelope, storage::Storage};

pub fn router<S>() -> Router<AppState<S>>
where
    S: Storage,
{
    Router::new()
        .route(
            "/api/station",
            post(create_station::<S>).get(list_stations::<S>),
        )
        .route(
            "/api/station/:id",
            get(get_station::<S>)
                .put(update_station::<S>)
                .delete(delete_station::<S>),
        )
}

#[derive(Debug, Deserialize)]
struct CreateStationBody {
    #[serde(rename = "enterpriseId")]
    enterprise_id: String,
    name: String,
    address: String,
    location: Option<Value>,
    phone: Option<String>,
    customer_type: Option<String>,
    status: Option<String>,
}

#[derive(Debug, Deserialize)]
struct UpdateStationBody {
    name: Option<String>,
    address: Option<String>,
    location: Option<Value>,
    phone: Option<String>,
    status: Option<String>,
}

#[derive(Debug, Deserialize)]
struct StationQuery {
    #[serde(rename = "enterpriseId")]
    enterprise_id: String,
    page: Option<i64>,
    #[serde(rename = "pageSize")]
    page_size: Option<i64>,
    keyword: Option<String>,
}

async fn create_station<S>(
    State(state): State<AppState<S>>,
    Json(body): Json<CreateStationBody>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let station_id = format!(
        "station-{}",
        &uuid::Uuid::new_v4().simple().to_string()[..8]
    );
    let station = sqlx::query_scalar::<_, Value>(
        r#"
        INSERT INTO dairy_stations (
            id, enterprise_id, name, address, location, phone, customer_type, status
        )
        VALUES ($1, $2, $3, $4, $5::jsonb, $6, COALESCE($7, 'owned'), COALESCE($8, 'active'))
        RETURNING row_to_json(dairy_stations)
        "#,
    )
    .bind(station_id)
    .bind(body.enterprise_id)
    .bind(body.name)
    .bind(body.address)
    .bind(body.location)
    .bind(body.phone)
    .bind(body.customer_type)
    .bind(body.status)
    .fetch_one(&state.db)
    .await?;

    Ok(success(station))
}

async fn list_stations<S>(
    State(state): State<AppState<S>>,
    Query(query): Query<StationQuery>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let page = query.page.unwrap_or(1).max(1);
    let page_size = query.page_size.unwrap_or(20).max(1);
    let offset = (page - 1) * page_size;
    let keyword = query
        .keyword
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());

    let total = if let Some(keyword) = keyword.as_deref() {
        sqlx::query_scalar::<_, i64>(
            r#"
            SELECT COUNT(*)
            FROM dairy_stations
            WHERE enterprise_id = $1
              AND (name ILIKE $2 OR address ILIKE $2)
            "#,
        )
        .bind(&query.enterprise_id)
        .bind(format!("%{keyword}%"))
        .fetch_one(&state.db)
        .await?
    } else {
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM dairy_stations WHERE enterprise_id = $1")
            .bind(&query.enterprise_id)
            .fetch_one(&state.db)
            .await?
    };

    let mut builder = QueryBuilder::<Postgres>::new(
        "SELECT row_to_json(dairy_stations) FROM dairy_stations WHERE enterprise_id = ",
    );
    builder.push_bind(&query.enterprise_id);
    if let Some(keyword) = keyword {
        builder.push(" AND (name ILIKE ");
        builder.push_bind(format!("%{keyword}%"));
        builder.push(" OR address ILIKE ");
        builder.push_bind(format!("%{keyword}%"));
        builder.push(")");
    }
    builder.push(" ORDER BY created_at DESC LIMIT ");
    builder.push_bind(page_size);
    builder.push(" OFFSET ");
    builder.push_bind(offset);
    let list = builder
        .build_query_scalar::<Value>()
        .fetch_all(&state.db)
        .await?;

    Ok(success(json!({
        "list": list,
        "total": total,
        "page": page,
        "pageSize": page_size
    })))
}

async fn get_station<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let station = sqlx::query_scalar::<_, Value>(
        "SELECT row_to_json(dairy_stations) FROM dairy_stations WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?;

    Ok(match station {
        Some(station) => success(station),
        None => envelope(404, "奶站不存在", Value::Null),
    })
}

async fn update_station<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
    Json(body): Json<UpdateStationBody>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let station = sqlx::query_scalar::<_, Value>(
        r#"
        UPDATE dairy_stations
        SET name = COALESCE($2, name),
            address = COALESCE($3, address),
            location = COALESCE($4::jsonb, location),
            phone = COALESCE($5, phone),
            status = COALESCE($6, status),
            updated_at = now()
        WHERE id = $1
        RETURNING row_to_json(dairy_stations)
        "#,
    )
    .bind(id)
    .bind(body.name)
    .bind(body.address)
    .bind(body.location)
    .bind(body.phone)
    .bind(body.status)
    .fetch_optional(&state.db)
    .await?;

    Ok(match station {
        Some(station) => success(station),
        None => envelope(404, "奶站不存在", Value::Null),
    })
}

async fn delete_station<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    sqlx::query("DELETE FROM dairy_stations WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await?;
    Ok(success(json!({ "message": "删除成功" })))
}

fn success<T: serde::Serialize>(data: T) -> Json<ApiEnvelope<T>> {
    Json(ApiEnvelope {
        code: 200,
        message: "success".to_string(),
        data,
    })
}

fn envelope(code: u16, message: &str, data: Value) -> Json<ApiEnvelope<Value>> {
    Json(ApiEnvelope {
        code,
        message: message.to_string(),
        data,
    })
}
