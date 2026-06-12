use axum::{
    extract::{Multipart, Path, Query, State},
    routing::{get, post, put},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::{FromRow, PgPool, Postgres, QueryBuilder};

use crate::{
    app::AppState,
    error::{ApiError, ApiResult},
    response::{ok, ApiEnvelope},
    storage::Storage,
};

const MAX_MALL_PRODUCT_IMAGE_BYTES: usize = 5 * 1024 * 1024;
const ALLOWED_MALL_PRODUCT_IMAGE_TYPES: &[&str] =
    &["image/jpeg", "image/png", "image/webp", "image/gif"];

pub fn router<S>() -> Router<AppState<S>>
where
    S: Storage,
{
    Router::new()
        .route("/api/mall/categories", get(list_categories::<S>))
        .route("/api/mall/products", get(list_products::<S>))
        .route("/api/mall/products/:id", get(get_product::<S>))
        .route("/api/mall/cart", get(get_cart::<S>))
        .route("/api/mall/cart/items", post(upsert_cart_item::<S>))
        .route(
            "/api/mall/cart/items/:id",
            put(update_cart_item::<S>).delete(delete_cart_item::<S>),
        )
        .route("/api/mall/checkouts", post(create_mall_checkout::<S>))
        .route("/api/mall/checkouts/:id", get(get_mall_checkout::<S>))
        .route("/api/mall/me/profile", get(get_mall_profile::<S>))
        .route(
            "/api/mall/group-leader/workbench",
            get(get_group_leader_workbench::<S>),
        )
        .route(
            "/api/mall/group-leader/verify-fulfillment",
            post(group_leader_verify_fulfillment::<S>),
        )
        .route(
            "/api/mall/addresses",
            get(list_mall_addresses::<S>).post(create_mall_address::<S>),
        )
        .route("/api/mall/addresses/:id", put(update_mall_address::<S>))
        .route("/api/mall/pickup-points", get(list_pickup_points::<S>))
        .route(
            "/api/mall/community-posts",
            get(list_community_posts::<S>).post(create_community_post::<S>),
        )
        .route(
            "/api/mall/community-posts/:id/interactions",
            post(create_community_post_interaction::<S>),
        )
        .route(
            "/api/mall/notification-preferences",
            get(get_notification_preferences::<S>).put(update_notification_preferences::<S>),
        )
        .route(
            "/api/mall/orders",
            get(list_mall_orders::<S>).post(create_mall_order::<S>),
        )
        .route("/api/mall/orders/:id", get(get_mall_order::<S>))
        .route(
            "/api/mall/orders/:id/tracking",
            get(get_mall_order_tracking::<S>),
        )
        .route(
            "/api/mall/orders/:id/after-sales",
            get(list_after_sales::<S>).post(create_after_sale::<S>),
        )
        .route(
            "/api/support/sessions",
            get(list_support_sessions::<S>).post(create_support_session::<S>),
        )
        .route(
            "/api/support/sessions/:id/messages",
            get(list_support_messages::<S>).post(create_support_message::<S>),
        )
        .route(
            "/api/support/tickets",
            get(list_support_tickets::<S>).post(create_support_ticket::<S>),
        )
        .route("/api/support/tickets/:id", put(update_support_ticket::<S>))
        .route(
            "/api/support/knowledge",
            get(list_knowledge::<S>).post(create_knowledge::<S>),
        )
        .route("/api/support/knowledge/:id", put(update_knowledge::<S>))
        .route("/api/support/metrics", get(support_metrics::<S>))
}

pub fn admin_router<S>() -> Router<AppState<S>>
where
    S: Storage,
{
    Router::new()
        .route("/api/admin/mall/overview", get(admin_overview::<S>))
        .route(
            "/api/admin/mall/pickup-points",
            get(admin_list_pickup_points::<S>),
        )
        .route(
            "/api/admin/mall/categories",
            get(admin_list_categories::<S>).post(admin_create_category::<S>),
        )
        .route(
            "/api/admin/mall/categories/:id",
            put(admin_update_category::<S>).delete(admin_delete_category::<S>),
        )
        .route(
            "/api/admin/mall/inventory-alerts",
            get(admin_list_inventory_alerts::<S>),
        )
        .route(
            "/api/admin/mall/uploads/product-image",
            post(admin_upload_product_image::<S>),
        )
        .route(
            "/api/admin/mall/products",
            get(admin_list_products::<S>).post(admin_create_product::<S>),
        )
        .route(
            "/api/admin/mall/products/:id",
            get(admin_get_product::<S>).put(admin_update_product::<S>),
        )
        .route("/api/admin/mall/orders", get(admin_list_orders::<S>))
        .route("/api/admin/mall/orders/:id", get(admin_get_order::<S>))
        .route(
            "/api/admin/mall/orders/:id/dispatch",
            post(admin_dispatch_order::<S>),
        )
        .route(
            "/api/admin/mall/orders/:id/status",
            put(admin_update_order_status::<S>),
        )
        .route(
            "/api/admin/mall/orders/:id/refund",
            post(admin_refund_order::<S>),
        )
        .route(
            "/api/admin/mall/orders/:id/fulfillment-code",
            post(admin_generate_fulfillment_code::<S>),
        )
        .route(
            "/api/admin/mall/orders/:id/verify-fulfillment",
            post(admin_verify_fulfillment::<S>),
        )
        .route(
            "/api/admin/mall/campaigns",
            get(list_campaigns::<S>).post(create_campaign::<S>),
        )
        .route("/api/admin/mall/campaigns/:id", put(update_campaign::<S>))
        .route(
            "/api/admin/mall/settings",
            get(get_operation_settings::<S>).put(update_operation_settings::<S>),
        )
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProductQuery {
    category_code: Option<String>,
    category_id: Option<String>,
    keyword: Option<String>,
    status: Option<String>,
    #[serde(alias = "stock_status")]
    stock_status: Option<String>,
    page: Option<i64>,
    #[serde(alias = "page_size", alias = "limit")]
    page_size: Option<i64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CategoryQuery {
    keyword: Option<String>,
    status: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct InventoryAlertQuery {
    category_code: Option<String>,
    keyword: Option<String>,
    status: Option<String>,
    #[serde(alias = "stock_status")]
    stock_status: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct UserQuery {
    #[serde(alias = "user_id")]
    user_id: Option<String>,
    status: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AddressQuery {
    #[serde(alias = "user_id")]
    user_id: Option<String>,
    #[serde(alias = "address_type")]
    address_type: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PickupPointQuery {
    status: Option<String>,
    #[serde(alias = "community_name")]
    community_name: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CommunityPostQuery {
    #[serde(alias = "pickup_point_id")]
    pickup_point_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SupportListQuery {
    #[serde(alias = "user_id")]
    user_id: Option<String>,
    status: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct UpsertCartItemRequest {
    #[serde(alias = "user_id")]
    user_id: String,
    #[serde(alias = "product_id")]
    product_id: String,
    quantity: i32,
    selected: Option<bool>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct UpdateCartItemRequest {
    quantity: Option<i32>,
    selected: Option<bool>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct Waypoint {
    #[serde(alias = "latitude")]
    latitude: Option<String>,
    #[serde(alias = "longitude")]
    longitude: Option<String>,
    #[serde(alias = "address")]
    address: Option<String>,
    #[serde(alias = "name")]
    name: Option<String>,
    #[serde(alias = "sequence")]
    sequence: Option<i32>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateMallOrderRequest {
    #[serde(alias = "user_id")]
    user_id: String,
    #[serde(alias = "checkout_id")]
    checkout_id: Option<String>,
    #[serde(alias = "address_id")]
    address_id: Option<String>,
    #[serde(alias = "pickup_point_id")]
    pickup_point_id: Option<String>,
    #[serde(alias = "recipient_name", alias = "contact_name")]
    recipient_name: Option<String>,
    #[serde(alias = "recipient_phone", alias = "contact_phone")]
    recipient_phone: Option<String>,
    #[serde(alias = "expected_delivery_window")]
    expected_delivery_window: Option<String>,
    #[serde(alias = "delivery_method")]
    delivery_method: Option<String>,
    #[serde(alias = "pickup_method")]
    pickup_method: Option<String>,
    remark: Option<String>,
    #[serde(alias = "waypoints")]
    waypoints: Option<Vec<Waypoint>>,
    #[serde(alias = "origin_latitude")]
    origin_latitude: Option<String>,
    #[serde(alias = "origin_longitude")]
    origin_longitude: Option<String>,
    #[serde(alias = "origin_address")]
    origin_address: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateMallCheckoutRequest {
    #[serde(alias = "user_id")]
    user_id: String,
    source: Option<String>,
    #[serde(alias = "product_id")]
    product_id: Option<String>,
    quantity: Option<i32>,
    #[serde(alias = "address_id")]
    address_id: Option<String>,
    #[serde(alias = "pickup_point_id")]
    pickup_point_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AddressMutationRequest {
    #[serde(alias = "user_id")]
    user_id: Option<String>,
    #[serde(alias = "contact_name", alias = "name")]
    contact_name: Option<String>,
    #[serde(alias = "contact_phone", alias = "phone")]
    contact_phone: Option<String>,
    #[serde(alias = "address_label", alias = "address_name", alias = "label")]
    address_label: Option<String>,
    #[serde(alias = "address_text", alias = "address")]
    address_text: Option<String>,
    latitude: Option<f64>,
    longitude: Option<f64>,
    #[serde(alias = "address_type")]
    address_type: Option<String>,
    #[serde(alias = "is_default")]
    is_default: Option<bool>,
    #[serde(alias = "pickup_point_id")]
    pickup_point_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct NotificationPreferenceRequest {
    #[serde(alias = "order_updates")]
    order_updates: Option<bool>,
    promotions: Option<bool>,
    #[serde(alias = "community_posts")]
    community_posts: Option<bool>,
    #[serde(alias = "service_messages")]
    service_messages: Option<bool>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GenerateFulfillmentCodeRequest {
    #[serde(alias = "pickup_point_id")]
    pickup_point_id: Option<String>,
    #[serde(alias = "expires_at")]
    expires_at: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct VerifyFulfillmentRequest {
    code: String,
    #[serde(alias = "verified_by")]
    verified_by: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GroupLeaderVerifyFulfillmentRequest {
    #[serde(alias = "user_id")]
    user_id: String,
    #[serde(alias = "order_id")]
    order_id: String,
    code: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CommunityPostMutationRequest {
    #[serde(alias = "user_id")]
    user_id: String,
    title: String,
    summary: Option<String>,
    content: Option<String>,
    #[serde(alias = "image_url")]
    image_url: Option<String>,
    images: Option<Vec<String>>,
    #[serde(alias = "pickup_point_id")]
    pickup_point_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CommunityPostInteractionRequest {
    #[serde(alias = "user_id")]
    user_id: String,
    #[serde(alias = "interaction_type", alias = "type")]
    interaction_type: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProductMutationRequest {
    name: Option<String>,
    sku: Option<String>,
    #[serde(alias = "category_code")]
    category_code: Option<String>,
    subtitle: Option<String>,
    description: Option<String>,
    #[serde(alias = "image_url")]
    image_url: Option<String>,
    #[serde(alias = "price_cents")]
    price_cents: Option<i64>,
    #[serde(alias = "original_price_cents")]
    original_price_cents: Option<i64>,
    stock: Option<i32>,
    #[serde(alias = "stock_alert_threshold")]
    stock_alert_threshold: Option<i32>,
    #[serde(alias = "length_cm")]
    length_cm: Option<f64>,
    #[serde(alias = "width_cm")]
    width_cm: Option<f64>,
    #[serde(alias = "height_cm")]
    height_cm: Option<f64>,
    #[serde(alias = "volume_liters")]
    volume_liters: Option<f64>,
    #[serde(alias = "weight_kg")]
    weight_kg: Option<f64>,
    status: Option<String>,
    tags: Option<Vec<String>>,
    #[serde(alias = "delivery_minutes")]
    delivery_minutes: Option<i32>,
    #[serde(alias = "cold_chain_required")]
    cold_chain_required: Option<bool>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CategoryMutationRequest {
    code: Option<String>,
    name: Option<String>,
    #[serde(alias = "sort_order")]
    sort_order: Option<i32>,
    status: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CampaignMutationRequest {
    name: Option<String>,
    #[serde(alias = "campaign_type")]
    campaign_type: Option<String>,
    #[serde(alias = "budget_cents")]
    budget_cents: Option<i64>,
    rules: Option<Value>,
    status: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SettingsMutationRequest {
    #[serde(alias = "free_delivery_threshold_cents")]
    free_delivery_threshold_cents: Option<i64>,
    #[serde(alias = "default_delivery_fee_cents")]
    default_delivery_fee_cents: Option<i64>,
    #[serde(alias = "delivery_promise_minutes")]
    delivery_promise_minutes: Option<i32>,
    #[serde(alias = "cold_chain_enabled")]
    cold_chain_enabled: Option<bool>,
    #[serde(alias = "refund_review_minutes")]
    refund_review_minutes: Option<i32>,
    roles: Option<Value>,
    #[serde(alias = "risk_thresholds")]
    risk_thresholds: Option<Value>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DispatchOrderRequest {
    #[serde(alias = "vehicle_code")]
    vehicle_code: String,
    #[serde(alias = "tracking_distance_km")]
    tracking_distance_km: Option<f64>,
    #[serde(alias = "expected_delivery_window")]
    expected_delivery_window: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct UpdateOrderStatusRequest {
    status: String,
    description: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RefundRequest {
    #[serde(alias = "amount_cents")]
    amount_cents: Option<i64>,
    reason: Option<String>,
    #[serde(alias = "handling_method")]
    handling_method: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AfterSaleRequest {
    #[serde(alias = "user_id")]
    user_id: String,
    reason: String,
    description: Option<String>,
    #[serde(alias = "amount_cents")]
    amount_cents: Option<i64>,
    #[serde(alias = "evidence_images")]
    evidence_images: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateSupportSessionRequest {
    #[serde(alias = "user_id")]
    user_id: String,
    channel: String,
    topic: String,
    #[serde(alias = "assigned_agent_id")]
    assigned_agent_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateSupportMessageRequest {
    #[serde(alias = "sender_id")]
    sender_id: Option<String>,
    #[serde(alias = "sender_role")]
    sender_role: String,
    content: String,
    metadata: Option<Value>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateSupportTicketRequest {
    #[serde(alias = "user_id")]
    user_id: String,
    #[serde(alias = "session_id")]
    session_id: Option<String>,
    #[serde(alias = "order_id")]
    order_id: Option<String>,
    category: String,
    priority: Option<String>,
    title: String,
    description: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct UpdateSupportTicketRequest {
    status: Option<String>,
    #[serde(alias = "assigned_agent_id")]
    assigned_agent_id: Option<String>,
    resolution: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct KnowledgeMutationRequest {
    title: Option<String>,
    category: Option<String>,
    content: Option<String>,
    status: Option<String>,
}

#[derive(Debug, FromRow)]
struct CartProductRow {
    product_id: String,
    sku: String,
    name: String,
    category_code: Option<String>,
    image_url: Option<String>,
    price_cents: i64,
    stock: i32,
    quantity: i32,
}

#[derive(Debug, FromRow)]
struct CheckoutRow {
    id: String,
    user_id: String,
    source: String,
    product_id: Option<String>,
    quantity: i32,
    address_id: Option<String>,
    pickup_point_id: Option<String>,
}

#[derive(Debug, FromRow)]
struct CampaignDiscountRow {
    name: String,
    threshold_cents: i64,
    discount_cents: i64,
}

struct MallDiscount {
    coupon_cents: i64,
    description: Option<String>,
    threshold_cents: Option<i64>,
    discount_cents: Option<i64>,
}

#[derive(Debug, FromRow)]
struct AddressSnapshotRow {
    address_id: Option<String>,
    pickup_point_id: Option<String>,
    contact_name: Option<String>,
    contact_phone: Option<String>,
    address_text: String,
    latitude: Option<f64>,
    longitude: Option<f64>,
}

#[derive(Debug, FromRow)]
struct OrderFulfillmentSeedRow {
    user_id: String,
    pickup_point_id: Option<String>,
}

#[derive(Debug, FromRow)]
struct MallSettingsRow {
    free_delivery_threshold_cents: i64,
    default_delivery_fee_cents: i64,
}

#[derive(Clone)]
enum JsonPathSegment {
    Key(String),
    Index(usize),
}

async fn list_categories<S>(
    State(state): State<AppState<S>>,
) -> ApiResult<Json<ApiEnvelope<Vec<Value>>>>
where
    S: Storage,
{
    let categories = sqlx::query_scalar::<_, Value>(
        r#"
        SELECT jsonb_build_object(
            'id', id,
            'code', code,
            'name', name,
            'sortOrder', sort_order,
            'status', status
        )
        FROM mall_categories
        WHERE status = 'active'
        ORDER BY sort_order ASC, created_at ASC
        "#,
    )
    .fetch_all(&state.db)
    .await?;

    Ok(ok("查询成功", categories))
}

async fn admin_list_categories<S>(
    State(state): State<AppState<S>>,
    Query(query): Query<CategoryQuery>,
) -> ApiResult<Json<ApiEnvelope<Vec<Value>>>>
where
    S: Storage,
{
    let categories = fetch_categories(&state.db, query).await?;
    Ok(ok("查询成功", categories))
}

async fn admin_create_category<S>(
    State(state): State<AppState<S>>,
    Json(body): Json<CategoryMutationRequest>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let code = normalize_category_code(&require_non_empty(body.code, "品类编码不能为空")?);
    let name = require_non_empty(body.name, "品类名称不能为空")?;
    let status = body.status.unwrap_or_else(|| "active".to_string());
    validate_category_status(&status)?;

    let category = sqlx::query_scalar::<_, Value>(
        r#"
        INSERT INTO mall_categories (code, name, sort_order, status)
        VALUES ($1, $2, COALESCE($3, 0), $4)
        RETURNING jsonb_build_object(
          'id', id,
          'code', code,
          'name', name,
          'sortOrder', sort_order,
          'status', status,
          'createdAt', created_at,
          'updatedAt', updated_at
        )
        "#,
    )
    .bind(code)
    .bind(name)
    .bind(body.sort_order)
    .bind(status)
    .fetch_one(&state.db)
    .await?;

    Ok(ok("品类创建成功", category))
}

async fn admin_update_category<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
    Json(body): Json<CategoryMutationRequest>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    if let Some(status) = body.status.as_deref() {
        validate_category_status(status)?;
    }

    let code = match body.code {
        Some(code) => Some(normalize_category_code(&require_non_empty(
            Some(code),
            "品类编码不能为空",
        )?)),
        None => None,
    };
    let name = optional_non_empty(body.name, "品类名称不能为空")?;

    let category = sqlx::query_scalar::<_, Value>(
        r#"
        UPDATE mall_categories
        SET code = COALESCE($2, code),
            name = COALESCE($3, name),
            sort_order = COALESCE($4, sort_order),
            status = COALESCE($5, status),
            updated_at = now()
        WHERE id = $1
        RETURNING jsonb_build_object(
          'id', id,
          'code', code,
          'name', name,
          'sortOrder', sort_order,
          'status', status,
          'createdAt', created_at,
          'updatedAt', updated_at
        )
        "#,
    )
    .bind(&id)
    .bind(code)
    .bind(name)
    .bind(body.sort_order)
    .bind(body.status)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| ApiError::NotFound("品类不存在".to_string()))?;

    Ok(ok("品类更新成功", category))
}

async fn admin_delete_category<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let category = sqlx::query_scalar::<_, Value>(
        r#"
        UPDATE mall_categories
        SET status = 'deleted',
            updated_at = now()
        WHERE id = $1
        RETURNING jsonb_build_object(
          'id', id,
          'code', code,
          'name', name,
          'sortOrder', sort_order,
          'status', status,
          'createdAt', created_at,
          'updatedAt', updated_at
        )
        "#,
    )
    .bind(&id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| ApiError::NotFound("品类不存在".to_string()))?;

    Ok(ok("品类已删除", category))
}

async fn list_products<S>(
    State(state): State<AppState<S>>,
    Query(query): Query<ProductQuery>,
) -> ApiResult<Json<ApiEnvelope<Vec<Value>>>>
where
    S: Storage,
{
    let mut products = fetch_products(&state.db, query, true).await?;
    resolve_mall_image_urls_in_list(&state.storage, &mut products).await?;
    Ok(ok("查询成功", products))
}

async fn admin_list_inventory_alerts<S>(
    State(state): State<AppState<S>>,
    Query(query): Query<InventoryAlertQuery>,
) -> ApiResult<Json<ApiEnvelope<Vec<Value>>>>
where
    S: Storage,
{
    let mut products = fetch_inventory_alerts(&state.db, query).await?;
    resolve_mall_image_urls_in_list(&state.storage, &mut products).await?;
    Ok(ok("查询成功", products))
}

async fn admin_upload_product_image<S>(
    State(state): State<AppState<S>>,
    mut multipart: Multipart,
) -> ApiResult<Json<ApiEnvelope<Value>>>
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
            read_ignored_multipart_field(field, &mut ignored_field_bytes).await?;
            continue;
        }

        let content_type = field.content_type().map(str::to_string);
        if !content_type
            .as_deref()
            .is_some_and(|value| ALLOWED_MALL_PRODUCT_IMAGE_TYPES.contains(&value))
        {
            return Err(ApiError::BadRequest(
                "请上传 JPG、PNG、WebP 或 GIF 商品图片".to_string(),
            ));
        }
        let extension = extension_for_product_image(content_type.as_deref())
            .ok_or_else(|| ApiError::BadRequest("请上传有效的商品图片".to_string()))?;
        let bytes = read_mall_product_image_bytes(field).await?;

        if bytes.is_empty() {
            return Err(ApiError::BadRequest("图片不能为空".to_string()));
        }
        if bytes.len() > MAX_MALL_PRODUCT_IMAGE_BYTES {
            return Err(ApiError::BadRequest("商品图片不能超过5MB".to_string()));
        }

        let key = format!(
            "mall-products/uploads/{}-{}.{}",
            chrono::Utc::now().timestamp_millis(),
            &uuid::Uuid::new_v4().simple().to_string()[..8],
            extension
        );
        let file_key = state
            .storage
            .put_key(bytes, &key, content_type.as_deref())
            .await?;
        let url = state.storage.public_url(&file_key).await?;

        return Ok(ok(
            "商品图片上传成功",
            json!({
                "fileKey": file_key,
                "imageUrl": file_key,
                "url": url
            }),
        ));
    }

    Err(ApiError::BadRequest("请选择商品图片".to_string()))
}

async fn admin_list_products<S>(
    State(state): State<AppState<S>>,
    Query(query): Query<ProductQuery>,
) -> ApiResult<Json<ApiEnvelope<Vec<Value>>>>
where
    S: Storage,
{
    let mut products = fetch_products(&state.db, query, false).await?;
    resolve_mall_image_urls_in_list(&state.storage, &mut products).await?;
    Ok(ok("查询成功", products))
}

async fn get_product<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let mut product = fetch_product_json(&state.db, &id).await?;
    resolve_mall_image_urls(&state.storage, &mut product).await?;
    Ok(ok("查询成功", product))
}

async fn admin_get_product<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let mut product = fetch_product_json(&state.db, &id).await?;
    resolve_mall_image_urls(&state.storage, &mut product).await?;
    Ok(ok("查询成功", product))
}

async fn get_cart<S>(
    State(state): State<AppState<S>>,
    Query(query): Query<UserQuery>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let user_id = require_non_empty(query.user_id, "用户ID不能为空")?;
    let mut cart = cart_payload(&state.db, &user_id).await?;
    resolve_mall_image_urls(&state.storage, &mut cart).await?;
    Ok(ok("查询成功", cart))
}

async fn upsert_cart_item<S>(
    State(state): State<AppState<S>>,
    Json(body): Json<UpsertCartItemRequest>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    validate_quantity(body.quantity)?;
    ensure_product_can_sell(&state.db, &body.product_id, body.quantity).await?;

    let item = sqlx::query_scalar::<_, Value>(
        r#"
        INSERT INTO mall_cart_items (user_id, product_id, quantity, selected)
        VALUES ($1, $2, $3, COALESCE($4, true))
        ON CONFLICT (user_id, product_id)
        DO UPDATE SET quantity = mall_cart_items.quantity + EXCLUDED.quantity,
                      selected = EXCLUDED.selected,
                      updated_at = now()
        RETURNING jsonb_build_object(
          'id', mall_cart_items.id,
          'userId', mall_cart_items.user_id,
          'productId', mall_cart_items.product_id,
          'quantity', mall_cart_items.quantity,
          'selected', mall_cart_items.selected
        )
        "#,
    )
    .bind(body.user_id)
    .bind(body.product_id)
    .bind(body.quantity)
    .bind(body.selected)
    .fetch_one(&state.db)
    .await?;

    Ok(ok("已加入购物车", item))
}

async fn update_cart_item<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
    Json(body): Json<UpdateCartItemRequest>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    if let Some(quantity) = body.quantity {
        validate_quantity(quantity)?;
        let product_id: String =
            sqlx::query_scalar("SELECT product_id FROM mall_cart_items WHERE id = $1")
                .bind(&id)
                .fetch_optional(&state.db)
                .await?
                .ok_or_else(|| ApiError::NotFound("购物车项不存在".to_string()))?;
        ensure_product_can_sell(&state.db, &product_id, quantity).await?;
    }

    let item = sqlx::query_scalar::<_, Value>(
        r#"
        UPDATE mall_cart_items
        SET quantity = COALESCE($2, quantity),
            selected = COALESCE($3, selected),
            updated_at = now()
        WHERE id = $1
        RETURNING jsonb_build_object(
          'id', id,
          'userId', user_id,
          'productId', product_id,
          'quantity', quantity,
          'selected', selected
        )
        "#,
    )
    .bind(&id)
    .bind(body.quantity)
    .bind(body.selected)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| ApiError::NotFound("购物车项不存在".to_string()))?;

    Ok(ok("更新成功", item))
}

async fn delete_cart_item<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    sqlx::query("DELETE FROM mall_cart_items WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await?;
    Ok(ok("删除成功", Value::Null))
}

async fn create_mall_checkout<S>(
    State(state): State<AppState<S>>,
    Json(body): Json<CreateMallCheckoutRequest>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    validate_required(&body.user_id, "用户ID不能为空")?;
    let source = normalize_checkout_source(body.source.as_deref())?;
    let quantity = body.quantity.unwrap_or(1);
    if quantity <= 0 {
        return Err(ApiError::BadRequest("购买数量必须大于0".to_string()));
    }

    let product_id = non_empty(body.product_id);
    if source == "buy_now" {
        let product_id = product_id
            .as_deref()
            .ok_or_else(|| ApiError::BadRequest("直购商品不能为空".to_string()))?;
        ensure_product_can_sell(&state.db, product_id, quantity).await?;
    }

    let checkout_id = sqlx::query_scalar::<_, String>(
        r#"
        INSERT INTO mall_checkouts (
          user_id, source, product_id, quantity, address_id, pickup_point_id, expires_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, now() + interval '30 minutes')
        RETURNING id
        "#,
    )
    .bind(&body.user_id)
    .bind(source)
    .bind(product_id)
    .bind(quantity)
    .bind(non_empty(body.address_id))
    .bind(non_empty(body.pickup_point_id))
    .fetch_one(&state.db)
    .await?;

    let mut checkout = checkout_payload(&state.db, &checkout_id).await?;
    resolve_mall_image_urls(&state.storage, &mut checkout).await?;
    Ok(ok("结算单已创建", checkout))
}

async fn get_mall_checkout<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let mut checkout = checkout_payload(&state.db, &id).await?;
    resolve_mall_image_urls(&state.storage, &mut checkout).await?;
    Ok(ok("查询成功", checkout))
}

async fn list_mall_addresses<S>(
    State(state): State<AppState<S>>,
    Query(query): Query<AddressQuery>,
) -> ApiResult<Json<ApiEnvelope<Vec<Value>>>>
where
    S: Storage,
{
    let user_id = require_non_empty(query.user_id, "用户ID不能为空")?;
    let mut builder = QueryBuilder::<Postgres>::new(
        r#"
        SELECT jsonb_build_object(
          'id', id,
          'userId', user_id,
          'contactName', contact_name,
          'contactPhone', contact_phone,
          'addressLabel', address_label,
          'addressText', address_text,
          'latitude', latitude,
          'longitude', longitude,
          'addressType', address_type,
          'pickupPointId', pickup_point_id,
          'isDefault', is_default,
          'createdAt', created_at,
          'updatedAt', updated_at
        )
        FROM mall_addresses
        WHERE user_id =
        "#,
    );
    builder.push_bind(user_id);
    if let Some(address_type) = non_empty(query.address_type) {
        builder.push(" AND address_type = ");
        builder.push_bind(address_type);
    }
    builder.push(" ORDER BY is_default DESC, updated_at DESC, created_at DESC");
    let addresses = builder
        .build_query_scalar::<Value>()
        .fetch_all(&state.db)
        .await?;
    Ok(ok("查询成功", addresses))
}

async fn create_mall_address<S>(
    State(state): State<AppState<S>>,
    Json(body): Json<AddressMutationRequest>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let user_id = require_non_empty(body.user_id, "用户ID不能为空")?;
    let address_text = require_non_empty(body.address_text, "地址不能为空")?;
    let address_label = non_empty(body.address_label).or_else(|| Some(address_text.clone()));
    let contact_name = non_empty(body.contact_name)
        .or_else(|| address_label.clone())
        .unwrap_or_else(|| "社区用户".to_string());
    let contact_phone = non_empty(body.contact_phone);
    let address_type = non_empty(body.address_type).unwrap_or_else(|| "home".to_string());
    let pickup_point_id = non_empty(body.pickup_point_id);
    if let Some(pickup_point_id) = pickup_point_id.as_deref() {
        ensure_pickup_point_exists(&state.db, pickup_point_id).await?;
    }
    let has_address: bool =
        sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM mall_addresses WHERE user_id = $1)")
            .bind(&user_id)
            .fetch_one(&state.db)
            .await?;
    let is_default = body.is_default.unwrap_or(false) || !has_address;

    let mut tx = state.db.begin().await?;
    if is_default {
        sqlx::query(
            "UPDATE mall_addresses SET is_default = false, updated_at = now() WHERE user_id = $1",
        )
        .bind(&user_id)
        .execute(&mut *tx)
        .await?;
    }
    let address = sqlx::query_scalar::<_, Value>(
        r#"
        INSERT INTO mall_addresses (
          user_id, contact_name, contact_phone, address_label, address_text,
          latitude, longitude, address_type, pickup_point_id, is_default
        )
        VALUES ($1, $2, $3, $4, $5, $6::numeric, $7::numeric, $8, $9, $10)
        RETURNING jsonb_build_object(
          'id', id,
          'userId', user_id,
          'contactName', contact_name,
          'contactPhone', contact_phone,
          'addressLabel', address_label,
          'addressText', address_text,
          'latitude', latitude,
          'longitude', longitude,
          'addressType', address_type,
          'pickupPointId', pickup_point_id,
          'isDefault', is_default,
          'createdAt', created_at,
          'updatedAt', updated_at
        )
        "#,
    )
    .bind(&user_id)
    .bind(contact_name)
    .bind(contact_phone)
    .bind(address_label)
    .bind(address_text)
    .bind(body.latitude)
    .bind(body.longitude)
    .bind(address_type)
    .bind(pickup_point_id)
    .bind(is_default)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;

    Ok(ok("地址已保存", address))
}

async fn update_mall_address<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
    Json(body): Json<AddressMutationRequest>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let existing_user_id: String =
        sqlx::query_scalar("SELECT user_id FROM mall_addresses WHERE id = $1")
            .bind(&id)
            .fetch_optional(&state.db)
            .await?
            .ok_or_else(|| ApiError::NotFound("地址不存在".to_string()))?;

    let contact_name = non_empty(body.contact_name);
    let contact_phone = non_empty(body.contact_phone);
    let address_label = non_empty(body.address_label);
    let address_text = optional_non_empty(body.address_text, "地址不能为空")?;
    let address_type = non_empty(body.address_type);
    let pickup_point_id = non_empty(body.pickup_point_id);
    if let Some(pickup_point_id) = pickup_point_id.as_deref() {
        ensure_pickup_point_exists(&state.db, pickup_point_id).await?;
    }

    let mut tx = state.db.begin().await?;
    if body.is_default == Some(true) {
        sqlx::query(
            "UPDATE mall_addresses SET is_default = false, updated_at = now() WHERE user_id = $1 AND id <> $2",
        )
        .bind(&existing_user_id)
        .bind(&id)
        .execute(&mut *tx)
        .await?;
    }

    let address = sqlx::query_scalar::<_, Value>(
        r#"
        UPDATE mall_addresses
        SET contact_name = COALESCE($2, contact_name),
            contact_phone = COALESCE($3, contact_phone),
            address_label = COALESCE($4, address_label),
            address_text = COALESCE($5, address_text),
            latitude = COALESCE($6::numeric, latitude),
            longitude = COALESCE($7::numeric, longitude),
            address_type = COALESCE($8, address_type),
            pickup_point_id = COALESCE($9, pickup_point_id),
            is_default = COALESCE($10, is_default),
            updated_at = now()
        WHERE id = $1
        RETURNING jsonb_build_object(
          'id', id,
          'userId', user_id,
          'contactName', contact_name,
          'contactPhone', contact_phone,
          'addressLabel', address_label,
          'addressText', address_text,
          'latitude', latitude,
          'longitude', longitude,
          'addressType', address_type,
          'pickupPointId', pickup_point_id,
          'isDefault', is_default,
          'createdAt', created_at,
          'updatedAt', updated_at
        )
        "#,
    )
    .bind(&id)
    .bind(contact_name)
    .bind(contact_phone)
    .bind(address_label)
    .bind(address_text)
    .bind(body.latitude)
    .bind(body.longitude)
    .bind(address_type)
    .bind(pickup_point_id)
    .bind(body.is_default)
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;

    Ok(ok("地址已更新", address))
}

async fn list_pickup_points<S>(
    State(state): State<AppState<S>>,
    Query(query): Query<PickupPointQuery>,
) -> ApiResult<Json<ApiEnvelope<Vec<Value>>>>
where
    S: Storage,
{
    let points = fetch_pickup_points(&state.db, query, true).await?;
    Ok(ok("查询成功", points))
}

async fn admin_list_pickup_points<S>(
    State(state): State<AppState<S>>,
    Query(query): Query<PickupPointQuery>,
) -> ApiResult<Json<ApiEnvelope<Vec<Value>>>>
where
    S: Storage,
{
    let points = fetch_pickup_points(&state.db, query, false).await?;
    Ok(ok("查询成功", points))
}

async fn get_mall_profile<S>(
    State(state): State<AppState<S>>,
    Query(query): Query<UserQuery>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let user_id = require_non_empty(query.user_id, "用户ID不能为空")?;
    let member = fetch_member_profile(&state.db, &user_id).await?;
    let order_counts = fetch_member_order_counts(&state.db, &user_id).await?;
    let default_address = fetch_default_mall_address(&state.db, &user_id).await?;
    let group_leader = fetch_group_leader_context(&state.db, &user_id).await?;
    let default_pickup_point =
        fetch_default_pickup_point(&state.db, &user_id, group_leader.as_ref()).await?;
    let support_counts = fetch_member_support_counts(&state.db, &user_id).await?;
    let notification_preferences =
        upsert_notification_preferences(&state.db, &user_id, None).await?;

    Ok(ok(
        "查询成功",
        json!({
            "member": member,
            "orderCounts": order_counts,
            "defaultAddress": default_address,
            "defaultPickupPoint": default_pickup_point,
            "support": support_counts,
            "notificationPreferences": notification_preferences,
            "groupLeader": group_leader,
        }),
    ))
}

async fn get_group_leader_workbench<S>(
    State(state): State<AppState<S>>,
    Query(query): Query<UserQuery>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let user_id = require_non_empty(query.user_id, "用户ID不能为空")?;
    let leader = fetch_group_leader_context(&state.db, &user_id)
        .await?
        .ok_or_else(|| ApiError::Forbidden("当前用户不是团长".to_string()))?;
    let pickup_point_id = leader
        .pointer("/pickupPoint/id")
        .and_then(Value::as_str)
        .ok_or_else(|| ApiError::BadRequest("团长未绑定自提点".to_string()))?;
    let today = fetch_group_leader_today_counts(&state.db, pickup_point_id).await?;
    let pending_orders = fetch_group_leader_pending_orders(&state.db, pickup_point_id).await?;

    Ok(ok(
        "查询成功",
        json!({
            "leader": leader,
            "pickupPoint": leader.get("pickupPoint").cloned().unwrap_or(Value::Null),
            "today": today,
            "pendingOrders": pending_orders,
        }),
    ))
}

async fn group_leader_verify_fulfillment<S>(
    State(state): State<AppState<S>>,
    Json(body): Json<GroupLeaderVerifyFulfillmentRequest>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    validate_required(&body.user_id, "用户ID不能为空")?;
    validate_required(&body.order_id, "订单ID不能为空")?;
    let code = require_non_empty(Some(body.code), "提货码不能为空")?;
    let leader = fetch_group_leader_context(&state.db, &body.user_id)
        .await?
        .ok_or_else(|| ApiError::Forbidden("当前用户不是团长".to_string()))?;
    let pickup_point_id = leader
        .pointer("/pickupPoint/id")
        .and_then(Value::as_str)
        .ok_or_else(|| ApiError::BadRequest("团长未绑定自提点".to_string()))?
        .to_string();
    let verified_code = verify_fulfillment_code(
        &state.db,
        &body.order_id,
        &code,
        &body.user_id,
        Some(&pickup_point_id),
    )
    .await?;

    Ok(ok("核销成功", verified_code))
}

async fn list_community_posts<S>(
    State(state): State<AppState<S>>,
    Query(query): Query<CommunityPostQuery>,
) -> ApiResult<Json<ApiEnvelope<Vec<Value>>>>
where
    S: Storage,
{
    let mut builder = QueryBuilder::<Postgres>::new(
        r#"
        SELECT community_post_json(post)
        FROM mall_community_posts post
        WHERE post.status = 'published'
        "#,
    );
    if let Some(pickup_point_id) = non_empty(query.pickup_point_id) {
        builder.push(" AND post.pickup_point_id = ");
        builder.push_bind(pickup_point_id);
    }
    builder.push(" ORDER BY post.sort_order ASC, post.created_at DESC LIMIT 50");
    let posts = builder
        .build_query_scalar::<Value>()
        .fetch_all(&state.db)
        .await?;
    Ok(ok("查询成功", posts))
}

async fn create_community_post<S>(
    State(state): State<AppState<S>>,
    Json(body): Json<CommunityPostMutationRequest>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    validate_required(&body.user_id, "用户ID不能为空")?;
    validate_required(&body.title, "帖子标题不能为空")?;
    let pickup_point_id = non_empty(body.pickup_point_id);
    if let Some(pickup_point_id) = pickup_point_id.as_deref() {
        ensure_pickup_point_exists(&state.db, pickup_point_id).await?;
    }
    let images = json!(body.images.unwrap_or_default());
    let post = sqlx::query_scalar::<_, Value>(
        r#"
        INSERT INTO mall_community_posts (
          title, summary, content, image_url, images, pickup_point_id, author_user_id, author_name, status
        )
        SELECT $2, $3, $4, $5, $6, $7, u.id, COALESCE(u.name, u.nickname, u.username, u.phone), 'published'
        FROM users u
        WHERE u.id = $1
        RETURNING community_post_json(mall_community_posts)
        "#,
    )
    .bind(&body.user_id)
    .bind(body.title)
    .bind(body.summary)
    .bind(body.content)
    .bind(body.image_url)
    .bind(images)
    .bind(pickup_point_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| ApiError::NotFound("用户不存在".to_string()))?;

    Ok(ok("帖子已发布", post))
}

async fn create_community_post_interaction<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
    Json(body): Json<CommunityPostInteractionRequest>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    validate_required(&body.user_id, "用户ID不能为空")?;
    let interaction_type = normalize_community_interaction(&body.interaction_type)?;
    let post =
        upsert_community_interaction(&state.db, &id, &body.user_id, interaction_type).await?;
    Ok(ok("互动已记录", post))
}

async fn get_notification_preferences<S>(
    State(state): State<AppState<S>>,
    Query(query): Query<UserQuery>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let user_id = require_non_empty(query.user_id, "用户ID不能为空")?;
    Ok(ok(
        "查询成功",
        upsert_notification_preferences(&state.db, &user_id, None).await?,
    ))
}

async fn update_notification_preferences<S>(
    State(state): State<AppState<S>>,
    Query(query): Query<UserQuery>,
    Json(body): Json<NotificationPreferenceRequest>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let user_id = require_non_empty(query.user_id, "用户ID不能为空")?;
    Ok(ok(
        "设置已保存",
        upsert_notification_preferences(&state.db, &user_id, Some(body)).await?,
    ))
}

async fn create_mall_order<S>(
    State(state): State<AppState<S>>,
    Json(body): Json<CreateMallOrderRequest>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    validate_required(&body.user_id, "用户ID不能为空")?;
    let checkout = match non_empty(body.checkout_id) {
        Some(checkout_id) => Some(fetch_checkout(&state.db, &checkout_id).await?),
        None => None,
    };
    if let Some(checkout) = &checkout {
        if checkout.user_id != body.user_id {
            return Err(ApiError::Forbidden("结算单不属于当前用户".to_string()));
        }
    }
    let address_id = non_empty(body.address_id).or_else(|| {
        checkout
            .as_ref()
            .and_then(|checkout| checkout.address_id.clone())
    });
    let pickup_point_id = non_empty(body.pickup_point_id).or_else(|| {
        checkout
            .as_ref()
            .and_then(|checkout| checkout.pickup_point_id.clone())
    });

    let address = fetch_order_address_snapshot(
        &state.db,
        &body.user_id,
        address_id.as_deref(),
        pickup_point_id.as_deref(),
    )
    .await?;
    let cart_items = match checkout.as_ref() {
        Some(checkout) => checkout_products(&state.db, checkout).await?,
        None => fetch_selected_cart_products(&state.db, &body.user_id).await?,
    };
    if cart_items.is_empty() {
        return Err(ApiError::BadRequest("购物车为空".to_string()));
    }
    for item in &cart_items {
        if item.quantity > item.stock {
            return Err(ApiError::BadRequest(format!("{} 库存不足", item.name)));
        }
    }

    let settings = fetch_mall_settings(&state.db).await?;
    let subtotal_cents: i64 = cart_items
        .iter()
        .map(|item| item.price_cents * i64::from(item.quantity))
        .sum();
    let delivery_fee_cents = mall_delivery_fee_cents(subtotal_cents, &settings);
    let discount = calculate_mall_discount_cents(&state.db, subtotal_cents).await?;
    let coupon_cents = discount.coupon_cents;
    let payable_cents = (subtotal_cents + delivery_fee_cents - coupon_cents).max(0);
    if payable_cents <= 0 {
        return Err(ApiError::BadRequest("订单金额必须大于0".to_string()));
    }

    let mut tx = state.db.begin().await?;
    let order_no = new_mall_order_no();
    let cabin_code = random_cabin_code();
    let recipient_name = non_empty(body.recipient_name).or_else(|| address.contact_name.clone());
    let recipient_phone = non_empty(body.recipient_phone).or_else(|| address.contact_phone.clone());
    let delivery_method = non_empty(body.delivery_method).unwrap_or_else(|| {
        if address.pickup_point_id.is_some() {
            "社区团购自提".to_string()
        } else {
            "社区配送到家".to_string()
        }
    });
    let pickup_method = non_empty(body.pickup_method).unwrap_or_else(|| {
        if address.pickup_point_id.is_some() {
            "团长核销提货码".to_string()
        } else {
            "联系用户确认送达".to_string()
        }
    });

    let waypoints_json = body.waypoints.as_ref().map(|waypoints| {
        serde_json::to_value(waypoints).unwrap_or(json!([]))
    });
    
    let order_id: String = sqlx::query_scalar(
        r#"
        INSERT INTO mall_orders (
          order_no, user_id, address_id, pickup_point_id, recipient_name, recipient_phone, address_text,
          latitude, longitude, delivery_method, pickup_method, expected_delivery_window,
          subtotal_cents, delivery_fee_cents, coupon_cents, payable_cents,
          cabin_code, remark, waypoints, origin_latitude, origin_longitude, origin_address
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::numeric, $9::numeric, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20::numeric, $21::numeric, $22)
        RETURNING id
        "#,
    )
    .bind(&order_no)
    .bind(&body.user_id)
    .bind(&address.address_id)
    .bind(&address.pickup_point_id)
    .bind(recipient_name)
    .bind(recipient_phone)
    .bind(&address.address_text)
    .bind(address.latitude)
    .bind(address.longitude)
    .bind(delivery_method)
    .bind(pickup_method)
    .bind(body.expected_delivery_window)
    .bind(subtotal_cents)
    .bind(delivery_fee_cents)
    .bind(coupon_cents)
    .bind(payable_cents)
    .bind(cabin_code)
    .bind(body.remark)
    .bind(waypoints_json)
    .bind(body.origin_latitude.clone())
    .bind(body.origin_longitude.clone())
    .bind(body.origin_address.clone())
    .fetch_one(&mut *tx)
    .await?;

    for item in &cart_items {
        let line_total = item.price_cents * i64::from(item.quantity);
        sqlx::query(
            r#"
            INSERT INTO mall_order_items (
              order_id, product_id, sku, product_name, category_code, image_url,
              unit_price_cents, quantity, line_total_cents
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            "#,
        )
        .bind(&order_id)
        .bind(&item.product_id)
        .bind(&item.sku)
        .bind(&item.name)
        .bind(&item.category_code)
        .bind(&item.image_url)
        .bind(item.price_cents)
        .bind(item.quantity)
        .bind(line_total)
        .execute(&mut *tx)
        .await?;

        sqlx::query(
            r#"
            UPDATE mall_products
            SET stock = GREATEST(stock - $2, 0),
                sold_count = sold_count + $2,
                updated_at = now()
            WHERE id = $1
            "#,
        )
        .bind(&item.product_id)
        .bind(item.quantity)
        .execute(&mut *tx)
        .await?;
    }

    if checkout
        .as_ref()
        .map(|checkout| checkout.source == "cart")
        .unwrap_or(true)
    {
        sqlx::query("DELETE FROM mall_cart_items WHERE user_id = $1 AND selected = true")
            .bind(&body.user_id)
            .execute(&mut *tx)
            .await?;
    }

    if let Some(checkout) = &checkout {
        sqlx::query("DELETE FROM mall_checkouts WHERE id = $1")
            .bind(&checkout.id)
            .execute(&mut *tx)
            .await?;
    }

    insert_order_event_tx(
        &mut tx,
        &order_id,
        "order_created",
        "订单已提交",
        "等待用户完成支付",
        "done",
    )
    .await?;

    tx.commit().await?;

    let mut order = fetch_order_detail(&state.db, &order_id).await?;
    resolve_mall_image_urls(&state.storage, &mut order).await?;
    Ok(ok("订单创建成功", order))
}

async fn list_mall_orders<S>(
    State(state): State<AppState<S>>,
    Query(query): Query<UserQuery>,
) -> ApiResult<Json<ApiEnvelope<Vec<Value>>>>
where
    S: Storage,
{
    let user_id = require_non_empty(query.user_id, "用户ID不能为空")?;
    let mut orders = fetch_orders(&state.db, Some(&user_id), query.status.as_deref()).await?;
    resolve_mall_image_urls_in_list(&state.storage, &mut orders).await?;
    Ok(ok("查询成功", orders))
}

async fn admin_list_orders<S>(
    State(state): State<AppState<S>>,
    Query(query): Query<UserQuery>,
) -> ApiResult<Json<ApiEnvelope<Vec<Value>>>>
where
    S: Storage,
{
    let mut orders = fetch_orders(&state.db, None, query.status.as_deref()).await?;
    resolve_mall_image_urls_in_list(&state.storage, &mut orders).await?;
    Ok(ok("查询成功", orders))
}

async fn get_mall_order<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let mut order = fetch_order_detail(&state.db, &id).await?;
    resolve_mall_image_urls(&state.storage, &mut order).await?;
    Ok(ok("查询成功", order))
}

async fn admin_get_order<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let mut order = fetch_order_detail(&state.db, &id).await?;
    resolve_mall_image_urls(&state.storage, &mut order).await?;
    Ok(ok("查询成功", order))
}

async fn get_mall_order_tracking<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let mut order = fetch_order_detail(&state.db, &id).await?;
    resolve_mall_image_urls(&state.storage, &mut order).await?;
    let events = fetch_order_events(&state.db, &id).await?;
    Ok(ok(
        "查询成功",
        json!({
            "order": order,
            "events": events,
        }),
    ))
}

async fn create_after_sale<S>(
    State(state): State<AppState<S>>,
    Path(order_id): Path<String>,
    Json(body): Json<AfterSaleRequest>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    validate_required(&body.reason, "售后原因不能为空")?;
    ensure_order_exists(&state.db, &order_id).await?;
    let amount_cents = body.amount_cents.unwrap_or_else(|| 0).max(0);
    let evidence_images = json!(body.evidence_images.unwrap_or_default());

    let after_sale = sqlx::query_scalar::<_, Value>(
        r#"
        INSERT INTO mall_after_sales (order_id, user_id, reason, description, amount_cents, evidence_images)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING jsonb_build_object(
          'id', id,
          'orderId', order_id,
          'userId', user_id,
          'reason', reason,
          'description', description,
          'amountCents', amount_cents,
          'evidenceImages', evidence_images,
          'status', status,
          'handlingMethod', handling_method,
          'createdAt', created_at
        )
        "#,
    )
    .bind(&order_id)
    .bind(body.user_id)
    .bind(body.reason)
    .bind(body.description)
    .bind(amount_cents)
    .bind(evidence_images)
    .fetch_one(&state.db)
    .await?;

    sqlx::query(
        r#"
        UPDATE mall_orders
        SET after_sale_status = 'processing',
            updated_at = now()
        WHERE id = $1
        "#,
    )
    .bind(&order_id)
    .execute(&state.db)
    .await?;
    insert_order_event(
        &state.db,
        &order_id,
        "after_sale_submitted",
        "已提交申请",
        "上传破损照片与说明",
        "done",
    )
    .await?;

    Ok(ok("售后已提交", after_sale))
}

async fn list_after_sales<S>(
    State(state): State<AppState<S>>,
    Path(order_id): Path<String>,
) -> ApiResult<Json<ApiEnvelope<Vec<Value>>>>
where
    S: Storage,
{
    let list = sqlx::query_scalar::<_, Value>(
        r#"
        SELECT jsonb_build_object(
          'id', id,
          'orderId', order_id,
          'userId', user_id,
          'reason', reason,
          'description', description,
          'amountCents', amount_cents,
          'evidenceImages', evidence_images,
          'status', status,
          'handlingMethod', handling_method,
          'createdAt', created_at,
          'updatedAt', updated_at
        )
        FROM mall_after_sales
        WHERE order_id = $1
        ORDER BY created_at DESC
        "#,
    )
    .bind(order_id)
    .fetch_all(&state.db)
    .await?;

    Ok(ok("查询成功", list))
}

async fn admin_create_product<S>(
    State(state): State<AppState<S>>,
    Json(body): Json<ProductMutationRequest>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let name = require_non_empty(body.name, "商品名称不能为空")?;
    let sku = require_non_empty(body.sku, "SKU不能为空")?;
    let category_code = require_non_empty(body.category_code, "类目不能为空")?;
    let price_cents = body.price_cents.unwrap_or(0);
    if price_cents <= 0 {
        return Err(ApiError::BadRequest("售价必须大于0".to_string()));
    }
    ensure_category(&state.db, &category_code).await?;
    let tags = serde_json::to_value(body.tags.unwrap_or_default())
        .map_err(|err| ApiError::BadRequest(err.to_string()))?;
    validate_optional_non_negative_i32(body.stock_alert_threshold, "库存预警阈值不能小于0")?;
    validate_optional_non_negative_f64(body.length_cm, "长不能小于0")?;
    validate_optional_non_negative_f64(body.width_cm, "宽不能小于0")?;
    validate_optional_non_negative_f64(body.height_cm, "高不能小于0")?;
    validate_optional_non_negative_f64(body.volume_liters, "体积不能小于0")?;
    validate_optional_non_negative_f64(body.weight_kg, "重量不能小于0")?;

    let product_id = sqlx::query_scalar::<_, String>(
        r#"
        INSERT INTO mall_products (
          category_id, category_code, sku, name, subtitle, description, image_url,
          price_cents, original_price_cents, stock, status, tags, delivery_minutes,
          cold_chain_required, length_cm, width_cm, height_cm, volume_liters,
          weight_kg, stock_alert_threshold
        )
        VALUES (
          (SELECT id FROM mall_categories WHERE code = $1),
          $1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, 0),
          COALESCE($10, 'on_sale'), $11, COALESCE($12, 18), COALESCE($13, false),
          $14, $15, $16, $17, $18, COALESCE($19, 15)
        )
        RETURNING id
        "#,
    )
    .bind(category_code)
    .bind(sku)
    .bind(name)
    .bind(body.subtitle)
    .bind(body.description)
    .bind(body.image_url)
    .bind(price_cents)
    .bind(body.original_price_cents)
    .bind(body.stock)
    .bind(body.status)
    .bind(tags)
    .bind(body.delivery_minutes)
    .bind(body.cold_chain_required)
    .bind(body.length_cm)
    .bind(body.width_cm)
    .bind(body.height_cm)
    .bind(body.volume_liters)
    .bind(body.weight_kg)
    .bind(body.stock_alert_threshold)
    .fetch_one(&state.db)
    .await?;

    let mut product = fetch_product_json(&state.db, &product_id).await?;
    resolve_mall_image_urls(&state.storage, &mut product).await?;
    Ok(ok("商品创建成功", product))
}

async fn admin_update_product<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
    Json(body): Json<ProductMutationRequest>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    if let Some(category_code) = body.category_code.as_deref() {
        ensure_category(&state.db, category_code).await?;
    }
    validate_optional_non_negative_i32(body.stock_alert_threshold, "库存预警阈值不能小于0")?;
    validate_optional_non_negative_f64(body.length_cm, "长不能小于0")?;
    validate_optional_non_negative_f64(body.width_cm, "宽不能小于0")?;
    validate_optional_non_negative_f64(body.height_cm, "高不能小于0")?;
    validate_optional_non_negative_f64(body.volume_liters, "体积不能小于0")?;
    validate_optional_non_negative_f64(body.weight_kg, "重量不能小于0")?;
    let tags = match body.tags {
        Some(tags) => {
            Some(serde_json::to_value(tags).map_err(|err| ApiError::BadRequest(err.to_string()))?)
        }
        None => None,
    };
    let product_id = sqlx::query_scalar::<_, String>(
        r#"
        UPDATE mall_products
        SET category_id = COALESCE((SELECT id FROM mall_categories WHERE code = $2), category_id),
            category_code = COALESCE($2, category_code),
            sku = COALESCE($3, sku),
            name = COALESCE($4, name),
            subtitle = COALESCE($5, subtitle),
            description = COALESCE($6, description),
            image_url = COALESCE($7, image_url),
            price_cents = COALESCE($8, price_cents),
            original_price_cents = COALESCE($9, original_price_cents),
            stock = COALESCE($10, stock),
            status = COALESCE($11, status),
            tags = COALESCE($12, tags),
            delivery_minutes = COALESCE($13, delivery_minutes),
            cold_chain_required = COALESCE($14, cold_chain_required),
            length_cm = COALESCE($15, length_cm),
            width_cm = COALESCE($16, width_cm),
            height_cm = COALESCE($17, height_cm),
            volume_liters = COALESCE($18, volume_liters),
            weight_kg = COALESCE($19, weight_kg),
            stock_alert_threshold = COALESCE($20, stock_alert_threshold),
            updated_at = now()
        WHERE id = $1
        RETURNING id
        "#,
    )
    .bind(&id)
    .bind(body.category_code)
    .bind(body.sku)
    .bind(body.name)
    .bind(body.subtitle)
    .bind(body.description)
    .bind(body.image_url)
    .bind(body.price_cents)
    .bind(body.original_price_cents)
    .bind(body.stock)
    .bind(body.status)
    .bind(tags)
    .bind(body.delivery_minutes)
    .bind(body.cold_chain_required)
    .bind(body.length_cm)
    .bind(body.width_cm)
    .bind(body.height_cm)
    .bind(body.volume_liters)
    .bind(body.weight_kg)
    .bind(body.stock_alert_threshold)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| ApiError::NotFound("商品不存在".to_string()))?;

    let mut product = fetch_product_json(&state.db, &product_id).await?;
    resolve_mall_image_urls(&state.storage, &mut product).await?;
    Ok(ok("商品更新成功", product))
}

async fn admin_dispatch_order<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
    Json(body): Json<DispatchOrderRequest>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    validate_required(&body.vehicle_code, "车辆编号不能为空")?;
    let order = sqlx::query_scalar::<_, Value>(
        r#"
        UPDATE mall_orders
        SET vehicle_code = $2,
            tracking_distance_km = COALESCE($3::numeric, tracking_distance_km),
            expected_delivery_window = COALESCE($4, expected_delivery_window),
            status = 'dispatching',
            dispatched_at = COALESCE(dispatched_at, now()),
            updated_at = now()
        WHERE id = $1
        RETURNING jsonb_build_object('id', id, 'status', status, 'vehicleCode', vehicle_code)
        "#,
    )
    .bind(&id)
    .bind(body.vehicle_code)
    .bind(body.tracking_distance_km)
    .bind(body.expected_delivery_window)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| ApiError::NotFound("订单不存在".to_string()))?;

    insert_order_event(
        &state.db,
        &id,
        "vehicle_dispatched",
        "无人车已派发",
        "车辆正在前往商家取货",
        "done",
    )
    .await?;
    Ok(ok("派车成功", order))
}

async fn admin_update_order_status<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
    Json(body): Json<UpdateOrderStatusRequest>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    validate_order_status(&body.status)?;
    let order = sqlx::query_scalar::<_, Value>(
        r#"
        UPDATE mall_orders
        SET status = $2,
            completed_at = CASE WHEN $2 = 'completed' THEN COALESCE(completed_at, now()) ELSE completed_at END,
            cancelled_at = CASE WHEN $2 = 'cancelled' THEN COALESCE(cancelled_at, now()) ELSE cancelled_at END,
            updated_at = now()
        WHERE id = $1
        RETURNING jsonb_build_object('id', id, 'status', status)
        "#,
    )
    .bind(&id)
    .bind(&body.status)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| ApiError::NotFound("订单不存在".to_string()))?;

    let title = order_status_title(&body.status);
    insert_order_event(
        &state.db,
        &id,
        &body.status,
        title,
        body.description.as_deref().unwrap_or(title),
        if body.status == "completed" {
            "done"
        } else {
            "active"
        },
    )
    .await?;

    Ok(ok("状态更新成功", order))
}

async fn admin_refund_order<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
    Json(body): Json<RefundRequest>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    ensure_order_exists(&state.db, &id).await?;
    let amount_cents = body.amount_cents.unwrap_or_default().max(0);
    sqlx::query(
        r#"
        UPDATE mall_orders
        SET refund_status = 'approved',
            after_sale_status = 'refunding',
            updated_at = now()
        WHERE id = $1
        "#,
    )
    .bind(&id)
    .execute(&state.db)
    .await?;
    let after_sale = sqlx::query_scalar::<_, Value>(
        r#"
        INSERT INTO mall_after_sales (order_id, user_id, reason, description, amount_cents, status, handling_method)
        SELECT id, user_id, COALESCE($2, '平台退款处理'), $3, $4, 'approved', COALESCE($5, '极速退款')
        FROM mall_orders
        WHERE id = $1
        RETURNING jsonb_build_object(
          'id', id,
          'orderId', order_id,
          'status', status,
          'amountCents', amount_cents,
          'handlingMethod', handling_method
        )
        "#,
    )
    .bind(&id)
    .bind(body.reason)
    .bind("管理端已发起退款")
    .bind(amount_cents)
    .bind(body.handling_method)
    .fetch_one(&state.db)
    .await?;

    insert_order_event(
        &state.db,
        &id,
        "refund_approved",
        "退款处理中",
        "原支付渠道退回",
        "active",
    )
    .await?;

    Ok(ok("退款处理成功", after_sale))
}

async fn admin_generate_fulfillment_code<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
    Json(body): Json<GenerateFulfillmentCodeRequest>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let pickup_point_id = non_empty(body.pickup_point_id);
    let code = ensure_fulfillment_code(
        &state.db,
        &id,
        pickup_point_id.as_deref(),
        body.expires_at.as_deref(),
    )
    .await?;
    Ok(ok("提货码已生成", code))
}

async fn admin_verify_fulfillment<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
    Json(body): Json<VerifyFulfillmentRequest>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let code = require_non_empty(Some(body.code), "提货码不能为空")?;
    let verified_by = non_empty(body.verified_by).unwrap_or_else(|| "admin".to_string());
    let verified_code = verify_fulfillment_code(&state.db, &id, &code, &verified_by, None).await?;
    Ok(ok("核销成功", verified_code))
}

async fn list_campaigns<S>(
    State(state): State<AppState<S>>,
) -> ApiResult<Json<ApiEnvelope<Vec<Value>>>>
where
    S: Storage,
{
    let campaigns = sqlx::query_scalar::<_, Value>(
        r#"
        SELECT campaign_json(c)
        FROM mall_campaigns c
        ORDER BY created_at DESC
        "#,
    )
    .fetch_all(&state.db)
    .await?;
    Ok(ok("查询成功", campaigns))
}

async fn create_campaign<S>(
    State(state): State<AppState<S>>,
    Json(body): Json<CampaignMutationRequest>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let name = require_non_empty(body.name, "活动名称不能为空")?;
    let campaign_type = require_non_empty(body.campaign_type, "活动类型不能为空")?;
    let rules = body.rules.unwrap_or_else(|| json!({}));
    let campaign = sqlx::query_scalar::<_, Value>(
        r#"
        INSERT INTO mall_campaigns (name, campaign_type, budget_cents, rules, status)
        VALUES ($1, $2, COALESCE($3, 0), $4, COALESCE($5, 'draft'))
        RETURNING campaign_json(mall_campaigns)
        "#,
    )
    .bind(name)
    .bind(campaign_type)
    .bind(body.budget_cents)
    .bind(rules)
    .bind(body.status)
    .fetch_one(&state.db)
    .await?;
    Ok(ok("活动创建成功", campaign))
}

async fn update_campaign<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
    Json(body): Json<CampaignMutationRequest>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let campaign = sqlx::query_scalar::<_, Value>(
        r#"
        UPDATE mall_campaigns
        SET name = COALESCE($2, name),
            campaign_type = COALESCE($3, campaign_type),
            budget_cents = COALESCE($4, budget_cents),
            rules = COALESCE($5, rules),
            status = COALESCE($6, status),
            updated_at = now()
        WHERE id = $1
        RETURNING campaign_json(mall_campaigns)
        "#,
    )
    .bind(&id)
    .bind(body.name)
    .bind(body.campaign_type)
    .bind(body.budget_cents)
    .bind(body.rules)
    .bind(body.status)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| ApiError::NotFound("活动不存在".to_string()))?;
    Ok(ok("活动更新成功", campaign))
}

async fn get_operation_settings<S>(
    State(state): State<AppState<S>>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    Ok(ok("查询成功", fetch_settings_json(&state.db).await?))
}

async fn update_operation_settings<S>(
    State(state): State<AppState<S>>,
    Json(body): Json<SettingsMutationRequest>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let settings = sqlx::query_scalar::<_, Value>(
        r#"
        INSERT INTO mall_operation_settings (
          id, free_delivery_threshold_cents, default_delivery_fee_cents,
          delivery_promise_minutes, cold_chain_enabled, refund_review_minutes,
          roles, risk_thresholds
        )
        VALUES (
          'default',
          COALESCE($1, 9900),
          COALESCE($2, 600),
          COALESCE($3, 18),
          COALESCE($4, true),
          COALESCE($5, 10),
          COALESCE($6, '{}'::jsonb),
          COALESCE($7, '{}'::jsonb)
        )
        ON CONFLICT (id)
        DO UPDATE SET free_delivery_threshold_cents = COALESCE(EXCLUDED.free_delivery_threshold_cents, mall_operation_settings.free_delivery_threshold_cents),
                      default_delivery_fee_cents = COALESCE(EXCLUDED.default_delivery_fee_cents, mall_operation_settings.default_delivery_fee_cents),
                      delivery_promise_minutes = COALESCE(EXCLUDED.delivery_promise_minutes, mall_operation_settings.delivery_promise_minutes),
                      cold_chain_enabled = COALESCE(EXCLUDED.cold_chain_enabled, mall_operation_settings.cold_chain_enabled),
                      refund_review_minutes = COALESCE(EXCLUDED.refund_review_minutes, mall_operation_settings.refund_review_minutes),
                      roles = COALESCE(EXCLUDED.roles, mall_operation_settings.roles),
                      risk_thresholds = COALESCE(EXCLUDED.risk_thresholds, mall_operation_settings.risk_thresholds),
                      updated_at = now()
        RETURNING settings_json(mall_operation_settings)
        "#,
    )
    .bind(body.free_delivery_threshold_cents)
    .bind(body.default_delivery_fee_cents)
    .bind(body.delivery_promise_minutes)
    .bind(body.cold_chain_enabled)
    .bind(body.refund_review_minutes)
    .bind(body.roles)
    .bind(body.risk_thresholds)
    .fetch_one(&state.db)
    .await?;

    Ok(ok("设置已保存", settings))
}

async fn admin_overview<S>(State(state): State<AppState<S>>) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let overview = sqlx::query_scalar::<_, Value>(
        r#"
        SELECT jsonb_build_object(
          'onSaleProducts', (SELECT count(*) FROM mall_products WHERE status = 'on_sale'),
          'stockAlerts', (SELECT count(*) FROM mall_products WHERE stock <= stock_alert_threshold),
          'pendingOrders', (SELECT count(*) FROM mall_orders WHERE status IN ('pending_payment', 'paid', 'ready_for_pickup', 'dispatching')),
          'deliveryOrders', (SELECT count(*) FROM mall_orders WHERE status IN ('ready_for_pickup', 'dispatching', 'delivering')),
          'afterSales', (SELECT count(*) FROM mall_after_sales WHERE status IN ('submitted', 'approved')),
          'campaigns', (SELECT count(*) FROM mall_campaigns WHERE status = 'active'),
          'todayRevenueCents', COALESCE((SELECT sum(payable_cents) FROM mall_orders WHERE payment_status = 'paid' AND created_at >= date_trunc('day', now())), 0)
        )
        "#,
    )
    .fetch_one(&state.db)
    .await?;
    Ok(ok("查询成功", overview))
}

async fn create_support_session<S>(
    State(state): State<AppState<S>>,
    Json(body): Json<CreateSupportSessionRequest>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    validate_required(&body.user_id, "用户ID不能为空")?;
    validate_required(&body.channel, "渠道不能为空")?;
    validate_required(&body.topic, "主题不能为空")?;

    let session = sqlx::query_scalar::<_, Value>(
        r#"
        INSERT INTO support_sessions (user_id, assigned_agent_id, channel, topic, last_message)
        VALUES ($1, $2, $3, $4, $4)
        RETURNING support_session_json(support_sessions)
        "#,
    )
    .bind(body.user_id)
    .bind(body.assigned_agent_id)
    .bind(body.channel)
    .bind(body.topic)
    .fetch_one(&state.db)
    .await?;

    Ok(ok("会话创建成功", session))
}

async fn list_support_sessions<S>(
    State(state): State<AppState<S>>,
    Query(query): Query<SupportListQuery>,
) -> ApiResult<Json<ApiEnvelope<Vec<Value>>>>
where
    S: Storage,
{
    let mut builder = QueryBuilder::<Postgres>::new(
        "SELECT support_session_json(support_sessions) FROM support_sessions WHERE 1 = 1",
    );
    if let Some(user_id) = query
        .user_id
        .as_deref()
        .filter(|value| !value.trim().is_empty())
    {
        builder.push(" AND user_id = ");
        builder.push_bind(user_id);
    }
    if let Some(status) = query
        .status
        .as_deref()
        .filter(|value| !value.trim().is_empty())
    {
        builder.push(" AND status = ");
        builder.push_bind(status);
    }
    builder.push(" ORDER BY updated_at DESC LIMIT 100");
    let sessions = builder
        .build_query_scalar::<Value>()
        .fetch_all(&state.db)
        .await?;
    Ok(ok("查询成功", sessions))
}

async fn create_support_message<S>(
    State(state): State<AppState<S>>,
    Path(session_id): Path<String>,
    Json(body): Json<CreateSupportMessageRequest>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    validate_required(&body.sender_role, "发送者角色不能为空")?;
    validate_required(&body.content, "消息内容不能为空")?;
    let metadata = body.metadata.unwrap_or_else(|| json!({}));
    let message = sqlx::query_scalar::<_, Value>(
        r#"
        INSERT INTO support_messages (session_id, sender_id, sender_role, content, metadata)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING support_message_json(support_messages)
        "#,
    )
    .bind(&session_id)
    .bind(body.sender_id)
    .bind(body.sender_role)
    .bind(&body.content)
    .bind(metadata)
    .fetch_one(&state.db)
    .await?;

    sqlx::query(
        r#"
        UPDATE support_sessions
        SET last_message = $2,
            updated_at = now()
        WHERE id = $1
        "#,
    )
    .bind(session_id)
    .bind(body.content)
    .execute(&state.db)
    .await?;

    Ok(ok("消息发送成功", message))
}

async fn list_support_messages<S>(
    State(state): State<AppState<S>>,
    Path(session_id): Path<String>,
) -> ApiResult<Json<ApiEnvelope<Vec<Value>>>>
where
    S: Storage,
{
    let messages = sqlx::query_scalar::<_, Value>(
        "SELECT support_message_json(support_messages) FROM support_messages WHERE session_id = $1 ORDER BY created_at ASC",
    )
    .bind(session_id)
    .fetch_all(&state.db)
    .await?;
    Ok(ok("查询成功", messages))
}

async fn create_support_ticket<S>(
    State(state): State<AppState<S>>,
    Json(body): Json<CreateSupportTicketRequest>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    validate_required(&body.user_id, "用户ID不能为空")?;
    validate_required(&body.category, "工单分类不能为空")?;
    validate_required(&body.title, "工单标题不能为空")?;
    let ticket = sqlx::query_scalar::<_, Value>(
        r#"
        INSERT INTO support_tickets (
          user_id, session_id, order_id, category, priority, title, description
        )
        VALUES ($1, $2, $3, $4, COALESCE($5, 'normal'), $6, $7)
        RETURNING support_ticket_json(support_tickets)
        "#,
    )
    .bind(body.user_id)
    .bind(body.session_id)
    .bind(body.order_id)
    .bind(body.category)
    .bind(body.priority)
    .bind(body.title)
    .bind(body.description)
    .fetch_one(&state.db)
    .await?;
    Ok(ok("工单创建成功", ticket))
}

async fn list_support_tickets<S>(
    State(state): State<AppState<S>>,
    Query(query): Query<SupportListQuery>,
) -> ApiResult<Json<ApiEnvelope<Vec<Value>>>>
where
    S: Storage,
{
    let mut builder = QueryBuilder::<Postgres>::new(
        "SELECT support_ticket_json(support_tickets) FROM support_tickets WHERE 1 = 1",
    );
    if let Some(user_id) = query
        .user_id
        .as_deref()
        .filter(|value| !value.trim().is_empty())
    {
        builder.push(" AND user_id = ");
        builder.push_bind(user_id);
    }
    if let Some(status) = query
        .status
        .as_deref()
        .filter(|value| !value.trim().is_empty())
    {
        builder.push(" AND status = ");
        builder.push_bind(status);
    }
    builder.push(" ORDER BY created_at DESC LIMIT 100");
    let tickets = builder
        .build_query_scalar::<Value>()
        .fetch_all(&state.db)
        .await?;
    Ok(ok("查询成功", tickets))
}

async fn update_support_ticket<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
    Json(body): Json<UpdateSupportTicketRequest>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let ticket = sqlx::query_scalar::<_, Value>(
        r#"
        UPDATE support_tickets
        SET status = COALESCE($2, status),
            assigned_agent_id = COALESCE($3, assigned_agent_id),
            resolution = COALESCE($4, resolution),
            updated_at = now()
        WHERE id = $1
        RETURNING support_ticket_json(support_tickets)
        "#,
    )
    .bind(&id)
    .bind(body.status)
    .bind(body.assigned_agent_id)
    .bind(body.resolution)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| ApiError::NotFound("工单不存在".to_string()))?;
    Ok(ok("工单更新成功", ticket))
}

async fn create_knowledge<S>(
    State(state): State<AppState<S>>,
    Json(body): Json<KnowledgeMutationRequest>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let title = require_non_empty(body.title, "知识库标题不能为空")?;
    let category = require_non_empty(body.category, "知识库分类不能为空")?;
    let content = require_non_empty(body.content, "知识库内容不能为空")?;
    let article = sqlx::query_scalar::<_, Value>(
        r#"
        INSERT INTO support_knowledge_articles (title, category, content, status)
        VALUES ($1, $2, $3, COALESCE($4, 'draft'))
        RETURNING knowledge_json(support_knowledge_articles)
        "#,
    )
    .bind(title)
    .bind(category)
    .bind(content)
    .bind(body.status)
    .fetch_one(&state.db)
    .await?;
    Ok(ok("知识库已创建", article))
}

async fn list_knowledge<S>(
    State(state): State<AppState<S>>,
) -> ApiResult<Json<ApiEnvelope<Vec<Value>>>>
where
    S: Storage,
{
    let articles = sqlx::query_scalar::<_, Value>(
        "SELECT knowledge_json(support_knowledge_articles) FROM support_knowledge_articles ORDER BY updated_at DESC LIMIT 100",
    )
    .fetch_all(&state.db)
    .await?;
    Ok(ok("查询成功", articles))
}

async fn update_knowledge<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
    Json(body): Json<KnowledgeMutationRequest>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let article = sqlx::query_scalar::<_, Value>(
        r#"
        UPDATE support_knowledge_articles
        SET title = COALESCE($2, title),
            category = COALESCE($3, category),
            content = COALESCE($4, content),
            status = COALESCE($5, status),
            updated_at = now()
        WHERE id = $1
        RETURNING knowledge_json(support_knowledge_articles)
        "#,
    )
    .bind(&id)
    .bind(body.title)
    .bind(body.category)
    .bind(body.content)
    .bind(body.status)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| ApiError::NotFound("知识库文章不存在".to_string()))?;
    Ok(ok("知识库已更新", article))
}

async fn support_metrics<S>(State(state): State<AppState<S>>) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let metrics = sqlx::query_scalar::<_, Value>(
        r#"
        WITH first_user_messages AS (
          SELECT session_id, min(created_at) AS first_user_at
          FROM support_messages
          WHERE sender_role IN ('user', 'customer', 'member')
          GROUP BY session_id
        ),
        first_agent_messages AS (
          SELECT user_message.session_id, min(message.created_at) AS first_agent_at
          FROM first_user_messages user_message
          JOIN support_messages message
            ON message.session_id = user_message.session_id
           AND message.created_at >= user_message.first_user_at
           AND message.sender_role IN ('agent', 'admin', 'support')
          GROUP BY user_message.session_id
        )
        SELECT jsonb_build_object(
          'openSessions', (SELECT count(*) FROM support_sessions WHERE status = 'open'),
          'openTickets', (SELECT count(*) FROM support_tickets WHERE status = 'open'),
          'afterSales', (SELECT count(*) FROM mall_after_sales WHERE status IN ('submitted', 'approved')),
          'knowledgeArticles', (SELECT count(*) FROM support_knowledge_articles WHERE status = 'published'),
          'avgFirstResponseMinutes', COALESCE((
            SELECT round(avg(extract(epoch from (agent_message.first_agent_at - user_message.first_user_at)) / 60.0))::integer
            FROM first_user_messages user_message
            JOIN first_agent_messages agent_message ON agent_message.session_id = user_message.session_id
          ), 6),
          'satisfaction', 96
        )
        "#,
    )
    .fetch_one(&state.db)
    .await?;
    Ok(ok("查询成功", metrics))
}

pub async fn settle_mall_order_payment_success(pool: &PgPool, order_id: &str) -> ApiResult<()> {
    sqlx::query(
        r#"
        UPDATE mall_orders
        SET payment_status = 'paid',
            status = CASE WHEN status = 'pending_payment' THEN 'ready_for_pickup' ELSE status END,
            fulfillment_status = CASE
              WHEN fulfillment_status = 'not_ready' THEN 'code_pending'
              ELSE fulfillment_status
            END,
            paid_at = COALESCE(paid_at, now()),
            updated_at = now()
        WHERE id = $1
        "#,
    )
    .bind(order_id)
    .execute(pool)
    .await?;
    insert_order_event(
        pool,
        order_id,
        "paid",
        "订单支付",
        "用户完成支付，订单进入待自提",
        "done",
    )
    .await?;
    ensure_fulfillment_code(pool, order_id, None, None).await?;
    Ok(())
}

async fn resolve_mall_image_urls_in_list<S>(storage: &S, payloads: &mut [Value]) -> ApiResult<()>
where
    S: Storage,
{
    for payload in payloads {
        resolve_mall_image_urls(storage, payload).await?;
    }
    Ok(())
}

async fn resolve_mall_image_urls<S>(storage: &S, payload: &mut Value) -> ApiResult<()>
where
    S: Storage,
{
    let mut paths = Vec::new();
    collect_image_url_paths(payload, &mut Vec::new(), &mut paths);

    for path in paths {
        let Some(key) = value_at_path(payload, &path)
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|image_url| should_resolve_mall_image_url(image_url))
            .map(str::to_string)
        else {
            continue;
        };
        let public_url = storage.public_url(&key).await?;
        if let Some(Value::String(image_url)) = value_at_path_mut(payload, &path) {
            *image_url = public_url;
        }
    }

    Ok(())
}

fn collect_image_url_paths(
    value: &Value,
    current_path: &mut Vec<JsonPathSegment>,
    paths: &mut Vec<Vec<JsonPathSegment>>,
) {
    match value {
        Value::Array(items) => {
            for (index, item) in items.iter().enumerate() {
                current_path.push(JsonPathSegment::Index(index));
                collect_image_url_paths(item, current_path, paths);
                current_path.pop();
            }
        }
        Value::Object(object) => {
            for (key, child) in object {
                current_path.push(JsonPathSegment::Key(key.clone()));
                if key == "imageUrl"
                    && child
                        .as_str()
                        .map(str::trim)
                        .is_some_and(should_resolve_mall_image_url)
                {
                    paths.push(current_path.clone());
                }
                collect_image_url_paths(child, current_path, paths);
                current_path.pop();
            }
        }
        _ => {}
    }
}

fn should_resolve_mall_image_url(image_url: &str) -> bool {
    if image_url.is_empty() || image_url.starts_with('/') {
        return false;
    }

    let lower = image_url.to_ascii_lowercase();
    !(lower.starts_with("http://")
        || lower.starts_with("https://")
        || lower.starts_with("data:")
        || lower.starts_with("blob:"))
}

fn value_at_path<'a>(value: &'a Value, path: &[JsonPathSegment]) -> Option<&'a Value> {
    let mut current = value;
    for segment in path {
        current = match segment {
            JsonPathSegment::Key(key) => current.get(key)?,
            JsonPathSegment::Index(index) => current.get(*index)?,
        };
    }
    Some(current)
}

fn value_at_path_mut<'a>(value: &'a mut Value, path: &[JsonPathSegment]) -> Option<&'a mut Value> {
    let mut current = value;
    for segment in path {
        current = match segment {
            JsonPathSegment::Key(key) => current.get_mut(key)?,
            JsonPathSegment::Index(index) => current.get_mut(*index)?,
        };
    }
    Some(current)
}

async fn fetch_products(
    pool: &PgPool,
    query: ProductQuery,
    public_only: bool,
) -> ApiResult<Vec<Value>> {
    let mut builder = QueryBuilder::<Postgres>::new(
        r#"
        SELECT product_json(p, c.name)
        FROM mall_products p
        LEFT JOIN mall_categories c ON c.code = p.category_code
        WHERE 1 = 1
        "#,
    );

    if public_only {
        builder.push(" AND p.status = 'on_sale'");
    } else if let Some(status) = non_empty(query.status) {
        builder.push(" AND p.status = ");
        builder.push_bind(status);
    }
    if let Some(category_code) = non_empty(query.category_code) {
        builder.push(" AND p.category_code = ");
        builder.push_bind(category_code);
    }
    if let Some(category_id) = non_empty(query.category_id) {
        builder.push(" AND p.category_id = ");
        builder.push_bind(category_id);
    }
    if let Some(keyword) = non_empty(query.keyword) {
        let pattern = format!("%{keyword}%");
        builder.push(" AND (p.name ILIKE ");
        builder.push_bind(pattern.clone());
        builder.push(" OR p.subtitle ILIKE ");
        builder.push_bind(pattern.clone());
        builder.push(" OR p.description ILIKE ");
        builder.push_bind(pattern);
        builder.push(")");
    }
    if let Some(stock_status) = non_empty(query.stock_status) {
        match stock_status.as_str() {
            "out" => builder.push(" AND p.stock <= 0"),
            "low" => builder.push(" AND p.stock > 0 AND p.stock <= p.stock_alert_threshold"),
            "alert" => builder.push(" AND p.stock <= p.stock_alert_threshold"),
            _ => return Err(ApiError::BadRequest("库存筛选状态不正确".to_string())),
        };
    }
    let page = query.page.unwrap_or(1).max(1);
    let page_size = query.page_size.unwrap_or(50).clamp(1, 100);
    builder.push(" ORDER BY p.sort_order ASC, p.created_at DESC LIMIT ");
    builder.push_bind(page_size);
    builder.push(" OFFSET ");
    builder.push_bind((page - 1) * page_size);

    Ok(builder
        .build_query_scalar::<Value>()
        .fetch_all(pool)
        .await?)
}

async fn fetch_categories(pool: &PgPool, query: CategoryQuery) -> ApiResult<Vec<Value>> {
    let mut builder = QueryBuilder::<Postgres>::new(
        r#"
        SELECT jsonb_build_object(
          'id', id,
          'code', code,
          'name', name,
          'sortOrder', sort_order,
          'status', status,
          'createdAt', created_at,
          'updatedAt', updated_at
        )
        FROM mall_categories
        WHERE status IS DISTINCT FROM 'deleted'
        "#,
    );

    if let Some(status) = non_empty(query.status) {
        builder.push(" AND status = ");
        builder.push_bind(status);
    }
    if let Some(keyword) = non_empty(query.keyword) {
        let pattern = format!("%{keyword}%");
        builder.push(" AND (name ILIKE ");
        builder.push_bind(pattern.clone());
        builder.push(" OR code ILIKE ");
        builder.push_bind(pattern);
        builder.push(")");
    }
    builder.push(" ORDER BY sort_order ASC, created_at ASC");

    Ok(builder
        .build_query_scalar::<Value>()
        .fetch_all(pool)
        .await?)
}

async fn fetch_inventory_alerts(
    pool: &PgPool,
    query: InventoryAlertQuery,
) -> ApiResult<Vec<Value>> {
    let mut builder = QueryBuilder::<Postgres>::new(
        r#"
        SELECT product_json(p, c.name) || jsonb_build_object(
          'stockAlertLevel',
          CASE
            WHEN p.stock <= 0 THEN 'out'
            WHEN p.stock <= p.stock_alert_threshold THEN 'low'
            ELSE 'normal'
          END
        )
        FROM mall_products p
        LEFT JOIN mall_categories c ON c.code = p.category_code
        WHERE p.stock <= p.stock_alert_threshold
        "#,
    );

    if let Some(status) = non_empty(query.status) {
        builder.push(" AND p.status = ");
        builder.push_bind(status);
    }
    if let Some(category_code) = non_empty(query.category_code) {
        builder.push(" AND p.category_code = ");
        builder.push_bind(category_code);
    }
    if let Some(keyword) = non_empty(query.keyword) {
        let pattern = format!("%{keyword}%");
        builder.push(" AND (p.name ILIKE ");
        builder.push_bind(pattern.clone());
        builder.push(" OR p.sku ILIKE ");
        builder.push_bind(pattern.clone());
        builder.push(" OR p.subtitle ILIKE ");
        builder.push_bind(pattern);
        builder.push(")");
    }
    if let Some(stock_status) = non_empty(query.stock_status) {
        match stock_status.as_str() {
            "out" => {
                builder.push(" AND p.stock <= 0");
            }
            "low" => {
                builder.push(" AND p.stock > 0 AND p.stock <= p.stock_alert_threshold");
            }
            "alert" => {}
            _ => return Err(ApiError::BadRequest("库存预警状态不正确".to_string())),
        };
    }
    builder.push(" ORDER BY p.stock ASC, p.updated_at DESC");

    Ok(builder
        .build_query_scalar::<Value>()
        .fetch_all(pool)
        .await?)
}

async fn fetch_pickup_points(
    pool: &PgPool,
    query: PickupPointQuery,
    public_only: bool,
) -> ApiResult<Vec<Value>> {
    let mut builder = QueryBuilder::<Postgres>::new(
        r#"
        SELECT jsonb_build_object(
          'id', id,
          'name', name,
          'addressText', address_text,
          'latitude', latitude,
          'longitude', longitude,
          'businessHours', business_hours,
          'status', status,
          'communityName', community_name,
          'leaderName', leader_name,
          'leaderPhone', leader_phone,
          'sortOrder', sort_order,
          'createdAt', created_at,
          'updatedAt', updated_at
        )
        FROM mall_pickup_points
        WHERE 1 = 1
        "#,
    );
    if public_only {
        builder.push(" AND status = 'active'");
    } else if let Some(status) = non_empty(query.status) {
        builder.push(" AND status = ");
        builder.push_bind(status);
    }
    if let Some(community_name) = non_empty(query.community_name) {
        builder.push(" AND community_name = ");
        builder.push_bind(community_name);
    }
    builder.push(" ORDER BY sort_order ASC, created_at DESC LIMIT 100");
    Ok(builder
        .build_query_scalar::<Value>()
        .fetch_all(pool)
        .await?)
}

async fn fetch_member_profile(pool: &PgPool, user_id: &str) -> ApiResult<Value> {
    sqlx::query_scalar::<_, Value>(
        r#"
        WITH stats AS (
          SELECT
            count(*)::bigint AS order_count,
            COALESCE(sum(payable_cents), 0)::bigint AS total_spend_cents,
            (COALESCE(sum(payable_cents), 0) / 100)::integer AS points
          FROM mall_orders
          WHERE user_id = $1
            AND status <> 'cancelled'
        ),
        selected_level AS (
          SELECT level.*
          FROM mall_member_levels level, stats
          WHERE level.status = 'active'
            AND level.min_points <= stats.points
          ORDER BY level.min_points DESC, level.sort_order ASC
          LIMIT 1
        )
        SELECT jsonb_build_object(
          'id', u.id,
          'phone', u.phone,
          'name', COALESCE(u.name, u.nickname, u.username, u.phone),
          'nickname', u.nickname,
          'avatarUrl', COALESCE(u.avatar_url, u.avatar),
          'role', u.role,
          'status', u.status,
          'points', stats.points,
          'orderCount', stats.order_count,
          'totalSpendCents', stats.total_spend_cents,
          'level', CASE WHEN level.id IS NULL THEN NULL ELSE jsonb_build_object(
            'id', level.id,
            'code', level.code,
            'name', level.name,
            'discountBps', level.discount_bps,
            'benefits', level.benefits
          ) END,
          'createdAt', u.created_at,
          'updatedAt', u.updated_at
        )
        FROM users u
        CROSS JOIN stats
        LEFT JOIN selected_level level ON true
        WHERE u.id = $1
        "#,
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| ApiError::NotFound("用户不存在".to_string()))
}

async fn fetch_member_order_counts(pool: &PgPool, user_id: &str) -> ApiResult<Value> {
    Ok(sqlx::query_scalar::<_, Value>(
        r#"
        SELECT jsonb_build_object(
          'total', count(*),
          'pendingPayment', count(*) FILTER (WHERE status = 'pending_payment'),
          'paid', count(*) FILTER (WHERE status = 'paid'),
          'readyForPickup', count(*) FILTER (WHERE status = 'ready_for_pickup'),
          'dispatching', count(*) FILTER (WHERE status = 'dispatching'),
          'delivering', count(*) FILTER (WHERE status = 'delivering'),
          'completed', count(*) FILTER (WHERE status = 'completed'),
          'cancelled', count(*) FILTER (WHERE status = 'cancelled'),
          'afterSales', (
            SELECT count(*)
            FROM mall_after_sales sale
            WHERE sale.user_id = $1
              AND sale.status IN ('submitted', 'approved', 'refunding')
          )
        )
        FROM mall_orders
        WHERE user_id = $1
        "#,
    )
    .bind(user_id)
    .fetch_one(pool)
    .await?)
}

async fn fetch_default_mall_address(pool: &PgPool, user_id: &str) -> ApiResult<Value> {
    Ok(sqlx::query_scalar::<_, Value>(
        r#"
        SELECT jsonb_build_object(
          'id', id,
          'userId', user_id,
          'contactName', contact_name,
          'contactPhone', contact_phone,
          'addressLabel', address_label,
          'addressText', address_text,
          'latitude', latitude,
          'longitude', longitude,
          'addressType', address_type,
          'pickupPointId', pickup_point_id,
          'isDefault', is_default,
          'createdAt', created_at,
          'updatedAt', updated_at
        )
        FROM mall_addresses
        WHERE user_id = $1
        ORDER BY is_default DESC, updated_at DESC, created_at DESC
        LIMIT 1
        "#,
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await?
    .unwrap_or(Value::Null))
}

async fn fetch_default_pickup_point(
    pool: &PgPool,
    user_id: &str,
    group_leader: Option<&Value>,
) -> ApiResult<Value> {
    if let Some(pickup_point) = group_leader.and_then(|leader| leader.get("pickupPoint")) {
        if !pickup_point.is_null() {
            return Ok(pickup_point.clone());
        }
    }

    Ok(sqlx::query_scalar::<_, Value>(
        r#"
        SELECT jsonb_build_object(
          'id', point.id,
          'name', point.name,
          'addressText', point.address_text,
          'latitude', point.latitude,
          'longitude', point.longitude,
          'businessHours', point.business_hours,
          'status', point.status,
          'communityName', point.community_name,
          'leaderName', point.leader_name,
          'leaderPhone', point.leader_phone
        )
        FROM mall_orders o
        JOIN mall_pickup_points point ON point.id = o.pickup_point_id
        WHERE o.user_id = $1
        ORDER BY o.created_at DESC
        LIMIT 1
        "#,
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await?
    .unwrap_or(Value::Null))
}

async fn fetch_member_support_counts(pool: &PgPool, user_id: &str) -> ApiResult<Value> {
    Ok(sqlx::query_scalar::<_, Value>(
        r#"
        SELECT jsonb_build_object(
          'openSessions', (SELECT count(*) FROM support_sessions WHERE user_id = $1 AND status = 'open'),
          'openTickets', (SELECT count(*) FROM support_tickets WHERE user_id = $1 AND status = 'open'),
          'afterSales', (SELECT count(*) FROM mall_after_sales WHERE user_id = $1 AND status IN ('submitted', 'approved', 'refunding'))
        )
        "#,
    )
    .bind(user_id)
    .fetch_one(pool)
    .await?)
}

async fn fetch_group_leader_context(pool: &PgPool, user_id: &str) -> ApiResult<Option<Value>> {
    Ok(sqlx::query_scalar::<_, Value>(
        r#"
        WITH app_user AS (
          SELECT id, phone, name, nickname, username
          FROM users
          WHERE id = $1
        ),
        leader_rows AS (
          SELECT
            0 AS priority,
            leader.id,
            COALESCE(leader.user_id, app_user.id) AS user_id,
            COALESCE(leader.name, point.leader_name, app_user.name, app_user.nickname, app_user.username, app_user.phone) AS name,
            COALESCE(leader.phone, point.leader_phone, app_user.phone) AS phone,
            leader.status,
            leader.service_note,
            point.id AS pickup_point_id,
            point.name AS pickup_point_name,
            point.address_text,
            point.latitude,
            point.longitude,
            point.business_hours,
            point.status AS pickup_point_status,
            point.community_name,
            point.leader_name,
            point.leader_phone
          FROM app_user
          JOIN mall_group_leaders leader
            ON leader.user_id = app_user.id
            OR (leader.phone IS NOT NULL AND leader.phone = app_user.phone)
          JOIN mall_pickup_points point ON point.id = leader.pickup_point_id
          WHERE leader.status = 'active'

          UNION ALL

          SELECT
            1 AS priority,
            CONCAT('pickup-leader-', point.id) AS id,
            app_user.id AS user_id,
            COALESCE(point.leader_name, app_user.name, app_user.nickname, app_user.username, app_user.phone) AS name,
            COALESCE(point.leader_phone, app_user.phone) AS phone,
            point.status AS status,
            NULL::text AS service_note,
            point.id AS pickup_point_id,
            point.name AS pickup_point_name,
            point.address_text,
            point.latitude,
            point.longitude,
            point.business_hours,
            point.status AS pickup_point_status,
            point.community_name,
            point.leader_name,
            point.leader_phone
          FROM app_user
          JOIN mall_pickup_points point
            ON point.leader_phone IS NOT NULL
           AND point.leader_phone = app_user.phone
          WHERE point.status = 'active'
        )
        SELECT jsonb_build_object(
          'id', id,
          'userId', user_id,
          'name', name,
          'phone', phone,
          'status', status,
          'serviceNote', service_note,
          'pickupPoint', jsonb_build_object(
            'id', pickup_point_id,
            'name', pickup_point_name,
            'addressText', address_text,
            'latitude', latitude,
            'longitude', longitude,
            'businessHours', business_hours,
            'status', pickup_point_status,
            'communityName', community_name,
            'leaderName', leader_name,
            'leaderPhone', leader_phone
          )
        )
        FROM leader_rows
        ORDER BY priority ASC
        LIMIT 1
        "#,
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await?)
}

async fn fetch_group_leader_today_counts(pool: &PgPool, pickup_point_id: &str) -> ApiResult<Value> {
    Ok(sqlx::query_scalar::<_, Value>(
        r#"
        SELECT jsonb_build_object(
          'pendingPickup', (
            SELECT count(*)
            FROM mall_orders
            WHERE pickup_point_id = $1
              AND status IN ('paid', 'ready_for_pickup')
              AND fulfillment_status IN ('ready', 'code_pending')
          ),
          'completed', (
            SELECT count(*)
            FROM mall_orders
            WHERE pickup_point_id = $1
              AND status = 'completed'
              AND COALESCE(completed_at, updated_at, created_at) >= date_trunc('day', now())
          ),
          'afterSales', (
            SELECT count(*)
            FROM mall_after_sales sale
            JOIN mall_orders o ON o.id = sale.order_id
            WHERE o.pickup_point_id = $1
              AND sale.created_at >= date_trunc('day', now())
          )
        )
        "#,
    )
    .bind(pickup_point_id)
    .fetch_one(pool)
    .await?)
}

async fn fetch_group_leader_pending_orders(
    pool: &PgPool,
    pickup_point_id: &str,
) -> ApiResult<Vec<Value>> {
    Ok(sqlx::query_scalar::<_, Value>(
        r#"
        SELECT order_summary_json(o)
        FROM mall_orders o
        WHERE o.pickup_point_id = $1
          AND o.status IN ('paid', 'ready_for_pickup')
          AND o.fulfillment_status IN ('ready', 'code_pending')
        ORDER BY o.created_at ASC
        LIMIT 50
        "#,
    )
    .bind(pickup_point_id)
    .fetch_all(pool)
    .await?)
}

async fn fetch_product_json(pool: &PgPool, id: &str) -> ApiResult<Value> {
    sqlx::query_scalar::<_, Value>(
        r#"
        SELECT product_json(p, c.name)
        FROM mall_products p
        LEFT JOIN mall_categories c ON c.code = p.category_code
        WHERE p.id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| ApiError::NotFound("商品不存在".to_string()))
}

async fn cart_payload(pool: &PgPool, user_id: &str) -> ApiResult<Value> {
    let items = sqlx::query_scalar::<_, Value>(
        r#"
        SELECT jsonb_build_object(
          'id', ci.id,
          'userId', ci.user_id,
          'productId', ci.product_id,
          'quantity', ci.quantity,
          'selected', ci.selected,
          'product', product_json(p, c.name),
          'lineTotalCents', p.price_cents * ci.quantity
        )
        FROM mall_cart_items ci
        JOIN mall_products p ON p.id = ci.product_id
        LEFT JOIN mall_categories c ON c.code = p.category_code
        WHERE ci.user_id = $1
        ORDER BY ci.created_at DESC
        "#,
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;
    let subtotal_cents = items
        .iter()
        .filter(|item| item["selected"].as_bool().unwrap_or(false))
        .map(|item| item["lineTotalCents"].as_i64().unwrap_or_default())
        .sum::<i64>();
    let settings = fetch_mall_settings(pool).await?;
    let delivery_fee_cents = mall_delivery_fee_cents(subtotal_cents, &settings);
    let discount = calculate_mall_discount_cents(pool, subtotal_cents).await?;
    let payable_cents = (subtotal_cents + delivery_fee_cents - discount.coupon_cents).max(0);
    Ok(json!({
        "items": items,
        "subtotalCents": subtotal_cents,
        "deliveryFeeCents": delivery_fee_cents,
        "couponCents": discount.coupon_cents,
        "payableCents": payable_cents,
        "discountDescription": discount.description,
        "discountThresholdCents": discount.threshold_cents,
        "discountRuleCents": discount.discount_cents,
        "selectedCount": items.iter().filter(|item| item["selected"].as_bool().unwrap_or(false)).count(),
    }))
}

async fn checkout_payload(pool: &PgPool, checkout_id: &str) -> ApiResult<Value> {
    let checkout = fetch_checkout(pool, checkout_id).await?;
    let items = checkout_products(pool, &checkout).await?;
    if items.is_empty() {
        return Err(ApiError::BadRequest("结算商品为空".to_string()));
    }
    for item in &items {
        if item.quantity > item.stock {
            return Err(ApiError::BadRequest(format!("{} 库存不足", item.name)));
        }
    }

    let item_values = checkout_item_values(&items);
    let subtotal_cents = checkout_subtotal_cents(&items);
    let settings = fetch_mall_settings(pool).await?;
    let delivery_fee_cents = mall_delivery_fee_cents(subtotal_cents, &settings);
    let discount = calculate_mall_discount_cents(pool, subtotal_cents).await?;
    let payable_cents = (subtotal_cents + delivery_fee_cents - discount.coupon_cents).max(0);

    Ok(json!({
        "id": checkout.id,
        "userId": checkout.user_id,
        "source": checkout.source,
        "productId": checkout.product_id,
        "quantity": checkout.quantity,
        "addressId": checkout.address_id,
        "pickupPointId": checkout.pickup_point_id,
        "items": item_values,
        "subtotalCents": subtotal_cents,
        "deliveryFeeCents": delivery_fee_cents,
        "couponCents": discount.coupon_cents,
        "payableCents": payable_cents,
        "discountDescription": discount.description,
        "discountThresholdCents": discount.threshold_cents,
        "discountRuleCents": discount.discount_cents,
    }))
}

async fn fetch_checkout(pool: &PgPool, checkout_id: &str) -> ApiResult<CheckoutRow> {
    sqlx::query_as::<_, CheckoutRow>(
        r#"
        SELECT id, user_id, source, product_id, quantity, address_id, pickup_point_id
        FROM mall_checkouts
        WHERE id = $1
          AND expires_at > now()
        "#,
    )
    .bind(checkout_id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| ApiError::NotFound("结算单不存在或已过期".to_string()))
}

async fn checkout_products(
    pool: &PgPool,
    checkout: &CheckoutRow,
) -> ApiResult<Vec<CartProductRow>> {
    if checkout.source == "buy_now" {
        let product_id = checkout
            .product_id
            .as_deref()
            .ok_or_else(|| ApiError::BadRequest("直购商品不能为空".to_string()))?;
        return fetch_buy_now_product(pool, product_id, checkout.quantity).await;
    }
    fetch_selected_cart_products(pool, &checkout.user_id).await
}

async fn fetch_buy_now_product(
    pool: &PgPool,
    product_id: &str,
    quantity: i32,
) -> ApiResult<Vec<CartProductRow>> {
    let product = sqlx::query_as::<_, CartProductRow>(
        r#"
        SELECT
          p.id AS product_id,
          p.sku,
          p.name,
          p.category_code,
          p.image_url,
          p.price_cents,
          p.stock,
          $2::integer AS quantity
        FROM mall_products p
        WHERE p.id = $1
          AND p.status = 'on_sale'
        "#,
    )
    .bind(product_id)
    .bind(quantity)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| ApiError::NotFound("商品不存在或已下架".to_string()))?;
    Ok(vec![product])
}

fn checkout_item_values(items: &[CartProductRow]) -> Vec<Value> {
    items
        .iter()
        .map(|item| {
            json!({
                "productId": item.product_id,
                "sku": item.sku,
                "productName": item.name,
                "categoryCode": item.category_code,
                "imageUrl": item.image_url,
                "unitPriceCents": item.price_cents,
                "quantity": item.quantity,
                "lineTotalCents": item.price_cents * i64::from(item.quantity),
                "product": {
                    "id": item.product_id,
                    "sku": item.sku,
                    "name": item.name,
                    "categoryCode": item.category_code,
                    "imageUrl": item.image_url,
                    "priceCents": item.price_cents,
                    "stock": item.stock,
                    "status": "on_sale",
                }
            })
        })
        .collect()
}

fn checkout_subtotal_cents(items: &[CartProductRow]) -> i64 {
    items
        .iter()
        .map(|item| item.price_cents * i64::from(item.quantity))
        .sum()
}

async fn fetch_selected_cart_products(
    pool: &PgPool,
    user_id: &str,
) -> ApiResult<Vec<CartProductRow>> {
    Ok(sqlx::query_as::<_, CartProductRow>(
        r#"
        SELECT
          p.id AS product_id,
          p.sku,
          p.name,
          p.category_code,
          p.image_url,
          p.price_cents,
          p.stock,
          ci.quantity
        FROM mall_cart_items ci
        JOIN mall_products p ON p.id = ci.product_id
        WHERE ci.user_id = $1
          AND ci.selected = true
          AND p.status = 'on_sale'
        ORDER BY ci.created_at ASC
        "#,
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?)
}

async fn fetch_order_address_snapshot(
    pool: &PgPool,
    user_id: &str,
    address_id: Option<&str>,
    pickup_point_id: Option<&str>,
) -> ApiResult<AddressSnapshotRow> {
    if let Some(pickup_point_id) = pickup_point_id {
        return sqlx::query_as::<_, AddressSnapshotRow>(
            r#"
            SELECT
              NULL::text AS address_id,
              id AS pickup_point_id,
              NULL::text AS contact_name,
              NULL::text AS contact_phone,
              CONCAT_WS(' · ', community_name, name, address_text) AS address_text,
              latitude::float8 AS latitude,
              longitude::float8 AS longitude
            FROM mall_pickup_points
            WHERE id = $1 AND status = 'active'
            "#,
        )
        .bind(pickup_point_id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::NotFound("自提点不存在或已停用".to_string()));
    }

    let Some(address_id) = address_id else {
        return Err(ApiError::BadRequest("地址或自提点不能为空".to_string()));
    };

    sqlx::query_as::<_, AddressSnapshotRow>(
        r#"
        SELECT
          id AS address_id,
          pickup_point_id,
          contact_name,
          contact_phone,
          address_text,
          latitude::float8 AS latitude,
          longitude::float8 AS longitude
        FROM mall_addresses
        WHERE id = $1 AND user_id = $2
        "#,
    )
    .bind(address_id)
    .bind(user_id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| ApiError::NotFound("地址不存在".to_string()))
}

async fn fetch_mall_settings(pool: &PgPool) -> ApiResult<MallSettingsRow> {
    sqlx::query_as::<_, MallSettingsRow>(
        r#"
        SELECT free_delivery_threshold_cents, default_delivery_fee_cents
        FROM mall_operation_settings
        WHERE id = 'default'
        "#,
    )
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| ApiError::NotFound("商城设置不存在".to_string()))
}

fn mall_delivery_fee_cents(subtotal_cents: i64, settings: &MallSettingsRow) -> i64 {
    if subtotal_cents >= settings.free_delivery_threshold_cents {
        0
    } else {
        settings.default_delivery_fee_cents
    }
}

async fn calculate_mall_discount_cents(
    pool: &PgPool,
    subtotal_cents: i64,
) -> ApiResult<MallDiscount> {
    let rules = sqlx::query_as::<_, CampaignDiscountRow>(
        r#"
        SELECT
          name,
          COALESCE(NULLIF(rules->>'thresholdCents', '')::bigint, 0) AS threshold_cents,
          COALESCE(NULLIF(rules->>'discountCents', '')::bigint, 0) AS discount_cents
        FROM mall_campaigns
        WHERE status = 'active'
          AND rules ? 'thresholdCents'
          AND rules ? 'discountCents'
        ORDER BY COALESCE(NULLIF(rules->>'thresholdCents', '')::bigint, 0) ASC,
                 COALESCE(NULLIF(rules->>'discountCents', '')::bigint, 0) DESC
        "#,
    )
    .fetch_all(pool)
    .await?;

    let mut next_rule: Option<&CampaignDiscountRow> = None;
    let mut best_rule: Option<&CampaignDiscountRow> = None;
    for rule in &rules {
        if rule.threshold_cents <= subtotal_cents {
            if best_rule
                .map(|current| rule.discount_cents > current.discount_cents)
                .unwrap_or(true)
            {
                best_rule = Some(rule);
            }
        } else if next_rule
            .map(|current| rule.threshold_cents < current.threshold_cents)
            .unwrap_or(true)
        {
            next_rule = Some(rule);
        }
    }

    if let Some(rule) = best_rule {
        let coupon_cents = rule.discount_cents.clamp(0, subtotal_cents);
        return Ok(MallDiscount {
            coupon_cents,
            description: Some(rule.name.clone()),
            threshold_cents: Some(rule.threshold_cents),
            discount_cents: Some(rule.discount_cents),
        });
    }

    Ok(MallDiscount {
        coupon_cents: 0,
        description: next_rule.map(|rule| {
            format!(
                "满{}减{}",
                yuan_amount(rule.threshold_cents),
                yuan_amount(rule.discount_cents)
            )
        }),
        threshold_cents: next_rule.map(|rule| rule.threshold_cents),
        discount_cents: next_rule.map(|rule| rule.discount_cents),
    })
}

fn yuan_amount(cents: i64) -> String {
    if cents % 100 == 0 {
        (cents / 100).to_string()
    } else {
        format!("{:.2}", cents as f64 / 100.0)
    }
}

fn normalize_checkout_source(source: Option<&str>) -> ApiResult<&'static str> {
    match source.unwrap_or("cart").trim() {
        "" | "cart" => Ok("cart"),
        "buy_now" | "buyNow" | "direct" => Ok("buy_now"),
        _ => Err(ApiError::BadRequest("结算来源不支持".to_string())),
    }
}

async fn fetch_settings_json(pool: &PgPool) -> ApiResult<Value> {
    sqlx::query_scalar::<_, Value>(
        r#"
        SELECT settings_json(mall_operation_settings)
        FROM mall_operation_settings
        WHERE id = 'default'
        "#,
    )
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| ApiError::NotFound("商城设置不存在".to_string()))
}

async fn upsert_notification_preferences(
    pool: &PgPool,
    user_id: &str,
    body: Option<NotificationPreferenceRequest>,
) -> ApiResult<Value> {
    let (order_updates, promotions, community_posts, service_messages) = match body {
        Some(body) => (
            body.order_updates,
            body.promotions,
            body.community_posts,
            body.service_messages,
        ),
        None => (None, None, None, None),
    };
    Ok(sqlx::query_scalar::<_, Value>(
        r#"
        INSERT INTO mall_notification_preferences (
          user_id, order_updates, promotions, community_posts, service_messages
        )
        VALUES (
          $1,
          COALESCE($2, true),
          COALESCE($3, true),
          COALESCE($4, true),
          COALESCE($5, true)
        )
        ON CONFLICT (user_id)
        DO UPDATE SET order_updates = COALESCE($2, mall_notification_preferences.order_updates),
                      promotions = COALESCE($3, mall_notification_preferences.promotions),
                      community_posts = COALESCE($4, mall_notification_preferences.community_posts),
                      service_messages = COALESCE($5, mall_notification_preferences.service_messages),
                      updated_at = now()
        RETURNING jsonb_build_object(
          'id', id,
          'userId', user_id,
          'orderUpdates', order_updates,
          'promotions', promotions,
          'communityPosts', community_posts,
          'serviceMessages', service_messages,
          'createdAt', created_at,
          'updatedAt', updated_at
        )
        "#,
    )
    .bind(user_id)
    .bind(order_updates)
    .bind(promotions)
    .bind(community_posts)
    .bind(service_messages)
    .fetch_one(pool)
    .await?)
}

async fn fetch_orders(
    pool: &PgPool,
    user_id: Option<&str>,
    status: Option<&str>,
) -> ApiResult<Vec<Value>> {
    let mut builder = QueryBuilder::<Postgres>::new(
        "SELECT order_summary_json(o) FROM mall_orders o WHERE 1 = 1",
    );
    if let Some(user_id) = user_id {
        builder.push(" AND o.user_id = ");
        builder.push_bind(user_id);
    }
    if let Some(status) = status.map(str::trim).filter(|value| !value.is_empty()) {
        builder.push(" AND o.status = ");
        builder.push_bind(status);
    }
    builder.push(" ORDER BY o.created_at DESC LIMIT 100");
    Ok(builder
        .build_query_scalar::<Value>()
        .fetch_all(pool)
        .await?)
}

async fn fetch_order_detail(pool: &PgPool, order_id: &str) -> ApiResult<Value> {
    sqlx::query_scalar::<_, Value>(
        r#"
        SELECT order_detail_json(o)
        FROM mall_orders o
        WHERE o.id = $1
        "#,
    )
    .bind(order_id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| ApiError::NotFound("订单不存在".to_string()))
}

async fn fetch_order_events(pool: &PgPool, order_id: &str) -> ApiResult<Vec<Value>> {
    Ok(sqlx::query_scalar::<_, Value>(
        r#"
        SELECT jsonb_build_object(
          'id', id,
          'orderId', order_id,
          'stage', stage,
          'title', title,
          'description', description,
          'status', status,
          'eventTime', event_time,
          'metadata', metadata
        )
        FROM mall_order_events
        WHERE order_id = $1
        ORDER BY event_time ASC, id ASC
        "#,
    )
    .bind(order_id)
    .fetch_all(pool)
    .await?)
}

async fn upsert_community_interaction(
    pool: &PgPool,
    post_id: &str,
    user_id: &str,
    interaction_type: &'static str,
) -> ApiResult<Value> {
    let post_exists: bool = sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM mall_community_posts WHERE id = $1 AND status = 'published')",
    )
    .bind(post_id)
    .fetch_one(pool)
    .await?;
    if !post_exists {
        return Err(ApiError::NotFound("帖子不存在".to_string()));
    }

    let user_exists: bool = sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM users WHERE id = $1)")
        .bind(user_id)
        .fetch_one(pool)
        .await?;
    if !user_exists {
        return Err(ApiError::NotFound("用户不存在".to_string()));
    }

    sqlx::query(
        r#"
        INSERT INTO mall_community_post_interactions (post_id, user_id, interaction_type)
        VALUES ($1, $2, $3)
        ON CONFLICT (post_id, user_id, interaction_type)
        DO UPDATE SET updated_at = mall_community_post_interactions.updated_at
        "#,
    )
    .bind(post_id)
    .bind(user_id)
    .bind(interaction_type)
    .execute(pool)
    .await?;

    Ok(sqlx::query_scalar::<_, Value>(
        r#"
        WITH counts AS (
          SELECT
            count(*) FILTER (WHERE interaction_type = 'like')::integer AS like_count,
            count(*) FILTER (WHERE interaction_type = 'follow')::integer AS follow_count,
            count(*) FILTER (WHERE interaction_type = 'join')::integer AS join_count
          FROM mall_community_post_interactions
          WHERE post_id = $1
        )
        UPDATE mall_community_posts post
        SET like_count = counts.like_count,
            follow_count = counts.follow_count,
            join_count = counts.join_count,
            updated_at = now()
        FROM counts
        WHERE post.id = $1
        RETURNING jsonb_build_object(
          'post', community_post_json(post),
          'interactionType', $2,
          'counts', jsonb_build_object(
            'like', post.like_count,
            'follow', post.follow_count,
            'join', post.join_count
          )
        )
        "#,
    )
    .bind(post_id)
    .bind(interaction_type)
    .fetch_one(pool)
    .await?)
}

async fn ensure_product_can_sell(pool: &PgPool, product_id: &str, quantity: i32) -> ApiResult<()> {
    let stock: Option<i32> =
        sqlx::query_scalar("SELECT stock FROM mall_products WHERE id = $1 AND status = 'on_sale'")
            .bind(product_id)
            .fetch_optional(pool)
            .await?;
    let stock = stock.ok_or_else(|| ApiError::NotFound("商品不存在或已下架".to_string()))?;
    if stock < quantity {
        return Err(ApiError::BadRequest("商品库存不足".to_string()));
    }
    Ok(())
}

async fn ensure_category(pool: &PgPool, category_code: &str) -> ApiResult<()> {
    let exists: bool =
        sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM mall_categories WHERE code = $1)")
            .bind(category_code)
            .fetch_one(pool)
            .await?;
    if !exists {
        return Err(ApiError::BadRequest("商品类目不存在".to_string()));
    }
    Ok(())
}

async fn ensure_order_exists(pool: &PgPool, order_id: &str) -> ApiResult<()> {
    let exists: bool =
        sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM mall_orders WHERE id = $1)")
            .bind(order_id)
            .fetch_one(pool)
            .await?;
    if !exists {
        return Err(ApiError::NotFound("订单不存在".to_string()));
    }
    Ok(())
}

async fn ensure_pickup_point_exists(pool: &PgPool, pickup_point_id: &str) -> ApiResult<()> {
    let exists: bool = sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM mall_pickup_points WHERE id = $1 AND status = 'active')",
    )
    .bind(pickup_point_id)
    .fetch_one(pool)
    .await?;
    if !exists {
        return Err(ApiError::BadRequest("自提点不存在或已停用".to_string()));
    }
    Ok(())
}

async fn ensure_fulfillment_code(
    pool: &PgPool,
    order_id: &str,
    pickup_point_id_override: Option<&str>,
    expires_at: Option<&str>,
) -> ApiResult<Value> {
    sqlx::query(
        r#"
        UPDATE mall_fulfillment_codes
        SET status = 'expired',
            updated_at = now()
        WHERE order_id = $1
          AND status = 'ready'
          AND expires_at IS NOT NULL
          AND expires_at <= now()
        "#,
    )
    .bind(order_id)
    .execute(pool)
    .await?;

    if let Some(existing) = sqlx::query_scalar::<_, Value>(
        r#"
        SELECT jsonb_build_object(
          'id', id,
          'orderId', order_id,
          'userId', user_id,
          'pickupPointId', pickup_point_id,
          'code', code,
          'status', status,
          'verifiedBy', verified_by,
          'verifiedAt', verified_at,
          'expiresAt', expires_at,
          'createdAt', created_at,
          'updatedAt', updated_at
        )
        FROM mall_fulfillment_codes
        WHERE order_id = $1
          AND status = 'ready'
          AND (expires_at IS NULL OR expires_at > now())
        ORDER BY created_at DESC
        LIMIT 1
        "#,
    )
    .bind(order_id)
    .fetch_optional(pool)
    .await?
    {
        return Ok(existing);
    }

    let order = sqlx::query_as::<_, OrderFulfillmentSeedRow>(
        r#"
        SELECT user_id, pickup_point_id
        FROM mall_orders
        WHERE id = $1
        "#,
    )
    .bind(order_id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| ApiError::NotFound("订单不存在".to_string()))?;
    let pickup_point_id = pickup_point_id_override
        .map(str::to_string)
        .or(order.pickup_point_id);
    if let Some(pickup_point_id) = pickup_point_id.as_deref() {
        ensure_pickup_point_exists(pool, pickup_point_id).await?;
    }

    for _ in 0..8 {
        let code = random_fulfillment_code();
        let created = sqlx::query_scalar::<_, Value>(
            r#"
            INSERT INTO mall_fulfillment_codes (
              order_id, user_id, pickup_point_id, code, status, expires_at
            )
            VALUES (
              $1, $2, $3, $4, 'ready', COALESCE($5::timestamptz, now() + interval '7 days')
            )
            ON CONFLICT (code) DO NOTHING
            RETURNING jsonb_build_object(
              'id', id,
              'orderId', order_id,
              'userId', user_id,
              'pickupPointId', pickup_point_id,
              'code', code,
              'status', status,
              'verifiedBy', verified_by,
              'verifiedAt', verified_at,
              'expiresAt', expires_at,
              'createdAt', created_at,
              'updatedAt', updated_at
            )
            "#,
        )
        .bind(order_id)
        .bind(&order.user_id)
        .bind(pickup_point_id.as_deref())
        .bind(&code)
        .bind(expires_at)
        .fetch_optional(pool)
        .await?;

        if let Some(created) = created {
            let fulfillment_code_id = created["id"].as_str().map(str::to_string);
            sqlx::query(
                r#"
                UPDATE mall_orders
                SET pickup_point_id = COALESCE($2, pickup_point_id),
                    fulfillment_status = 'ready',
                    status = CASE
                      WHEN payment_status = 'paid' AND status NOT IN ('completed', 'cancelled')
                      THEN 'ready_for_pickup'
                      ELSE status
                    END,
                    updated_at = now()
                WHERE id = $1
                "#,
            )
            .bind(order_id)
            .bind(pickup_point_id.as_deref())
            .execute(pool)
            .await?;
            insert_fulfillment_event(
                pool,
                order_id,
                fulfillment_code_id.as_deref(),
                "code_ready",
                "提货码已生成",
                "用户可凭提货码到自提点核销",
                json!({ "code": code }),
            )
            .await?;
            insert_order_event(
                pool,
                order_id,
                "ready_for_pickup",
                "待自提核销",
                "提货码已生成，请按自提点营业时间提货",
                "active",
            )
            .await?;
            return Ok(created);
        }
    }

    Err(ApiError::BadRequest("提货码生成失败，请重试".to_string()))
}

async fn verify_fulfillment_code(
    pool: &PgPool,
    order_id: &str,
    code: &str,
    verified_by: &str,
    required_pickup_point_id: Option<&str>,
) -> ApiResult<Value> {
    let existing = sqlx::query_scalar::<_, Value>(
        r#"
        SELECT jsonb_build_object(
          'id', code.id,
          'orderId', code.order_id,
          'userId', code.user_id,
          'pickupPointId', code.pickup_point_id,
          'code', code.code,
          'status', code.status,
          'verifiedBy', code.verified_by,
          'verifiedAt', code.verified_at,
          'expiresAt', code.expires_at,
          'createdAt', code.created_at,
          'updatedAt', code.updated_at
        )
        FROM mall_fulfillment_codes code
        JOIN mall_orders o ON o.id = code.order_id
        WHERE code.order_id = $1
          AND code.code = $2
          AND code.status = 'ready'
          AND (code.expires_at IS NULL OR code.expires_at > now())
          AND (
            $3::text IS NULL
            OR (o.pickup_point_id = $3 AND COALESCE(code.pickup_point_id, o.pickup_point_id) = $3)
          )
        "#,
    )
    .bind(order_id)
    .bind(code)
    .bind(required_pickup_point_id)
    .fetch_optional(pool)
    .await?;

    if existing.is_none() {
        let expired = sqlx::query(
            r#"
            UPDATE mall_fulfillment_codes code
            SET status = 'expired',
                updated_at = now()
            FROM mall_orders o
            WHERE o.id = code.order_id
              AND code.order_id = $1
              AND code.code = $2
              AND code.status = 'ready'
              AND code.expires_at IS NOT NULL
              AND code.expires_at <= now()
              AND (
                $3::text IS NULL
                OR (o.pickup_point_id = $3 AND COALESCE(code.pickup_point_id, o.pickup_point_id) = $3)
              )
            "#,
        )
        .bind(order_id)
        .bind(code)
        .bind(required_pickup_point_id)
        .execute(pool)
        .await?;
        if expired.rows_affected() > 0 {
            return Err(ApiError::BadRequest("提货码已过期".to_string()));
        }
        return Err(ApiError::BadRequest("提货码无效或已核销".to_string()));
    }

    let mut tx = pool.begin().await?;
    let verified_code = sqlx::query_scalar::<_, Value>(
        r#"
        UPDATE mall_fulfillment_codes code
        SET status = 'verified',
            verified_by = $3,
            verified_at = now(),
            updated_at = now()
        FROM mall_orders o
        WHERE o.id = code.order_id
          AND code.order_id = $1
          AND code.code = $2
          AND code.status = 'ready'
          AND (
            $4::text IS NULL
            OR (o.pickup_point_id = $4 AND COALESCE(code.pickup_point_id, o.pickup_point_id) = $4)
          )
        RETURNING jsonb_build_object(
          'id', code.id,
          'orderId', code.order_id,
          'userId', code.user_id,
          'pickupPointId', code.pickup_point_id,
          'code', code.code,
          'status', code.status,
          'verifiedBy', code.verified_by,
          'verifiedAt', code.verified_at,
          'expiresAt', code.expires_at,
          'createdAt', code.created_at,
          'updatedAt', code.updated_at
        )
        "#,
    )
    .bind(order_id)
    .bind(code)
    .bind(verified_by)
    .bind(required_pickup_point_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| ApiError::BadRequest("提货码无效或已核销".to_string()))?;
    let fulfillment_code_id = verified_code["id"].as_str().map(str::to_string);

    sqlx::query(
        r#"
        UPDATE mall_orders
        SET status = 'completed',
            fulfillment_status = 'verified',
            completed_at = COALESCE(completed_at, now()),
            updated_at = now()
        WHERE id = $1
        "#,
    )
    .bind(order_id)
    .execute(&mut *tx)
    .await?;
    insert_fulfillment_event_tx(
        &mut tx,
        order_id,
        fulfillment_code_id.as_deref(),
        "verified",
        "提货码已核销",
        "团长已确认用户完成自提",
        json!({ "verifiedBy": verified_by }),
    )
    .await?;
    insert_order_event_tx(
        &mut tx,
        order_id,
        "completed",
        "已完成自提",
        "团长核销提货码后订单完成",
        "done",
    )
    .await?;
    tx.commit().await?;

    Ok(verified_code)
}

async fn insert_order_event(
    pool: &PgPool,
    order_id: &str,
    stage: &str,
    title: &str,
    description: &str,
    status: &str,
) -> ApiResult<()> {
    sqlx::query(
        r#"
        INSERT INTO mall_order_events (order_id, stage, title, description, status)
        VALUES ($1, $2, $3, $4, $5)
        "#,
    )
    .bind(order_id)
    .bind(stage)
    .bind(title)
    .bind(description)
    .bind(status)
    .execute(pool)
    .await?;
    Ok(())
}

async fn insert_fulfillment_event(
    pool: &PgPool,
    order_id: &str,
    fulfillment_code_id: Option<&str>,
    event_type: &str,
    title: &str,
    description: &str,
    metadata: Value,
) -> ApiResult<()> {
    sqlx::query(
        r#"
        INSERT INTO mall_fulfillment_events (
          order_id, fulfillment_code_id, event_type, title, description, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        "#,
    )
    .bind(order_id)
    .bind(fulfillment_code_id)
    .bind(event_type)
    .bind(title)
    .bind(description)
    .bind(metadata)
    .execute(pool)
    .await?;
    Ok(())
}

async fn insert_order_event_tx(
    tx: &mut sqlx::Transaction<'_, Postgres>,
    order_id: &str,
    stage: &str,
    title: &str,
    description: &str,
    status: &str,
) -> ApiResult<()> {
    sqlx::query(
        r#"
        INSERT INTO mall_order_events (order_id, stage, title, description, status)
        VALUES ($1, $2, $3, $4, $5)
        "#,
    )
    .bind(order_id)
    .bind(stage)
    .bind(title)
    .bind(description)
    .bind(status)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

async fn insert_fulfillment_event_tx(
    tx: &mut sqlx::Transaction<'_, Postgres>,
    order_id: &str,
    fulfillment_code_id: Option<&str>,
    event_type: &str,
    title: &str,
    description: &str,
    metadata: Value,
) -> ApiResult<()> {
    sqlx::query(
        r#"
        INSERT INTO mall_fulfillment_events (
          order_id, fulfillment_code_id, event_type, title, description, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        "#,
    )
    .bind(order_id)
    .bind(fulfillment_code_id)
    .bind(event_type)
    .bind(title)
    .bind(description)
    .bind(metadata)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

fn validate_required(value: &str, message: &str) -> ApiResult<()> {
    if value.trim().is_empty() {
        return Err(ApiError::BadRequest(message.to_string()));
    }
    Ok(())
}

fn require_non_empty(value: Option<String>, message: &str) -> ApiResult<String> {
    non_empty(value).ok_or_else(|| ApiError::BadRequest(message.to_string()))
}

fn non_empty(value: Option<String>) -> Option<String> {
    value.and_then(|value| {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    })
}

fn optional_non_empty(value: Option<String>, message: &str) -> ApiResult<Option<String>> {
    match value {
        Some(value) if value.trim().is_empty() => Err(ApiError::BadRequest(message.to_string())),
        Some(value) => Ok(Some(value.trim().to_string())),
        None => Ok(None),
    }
}

fn normalize_category_code(code: &str) -> String {
    code.trim().to_ascii_lowercase().replace(' ', "-")
}

fn validate_category_status(status: &str) -> ApiResult<()> {
    if matches!(status, "active" | "inactive" | "deleted") {
        Ok(())
    } else {
        Err(ApiError::BadRequest("品类状态不正确".to_string()))
    }
}

fn validate_optional_non_negative_i32(value: Option<i32>, message: &str) -> ApiResult<()> {
    if value.is_some_and(|next| next < 0) {
        Err(ApiError::BadRequest(message.to_string()))
    } else {
        Ok(())
    }
}

fn validate_optional_non_negative_f64(value: Option<f64>, message: &str) -> ApiResult<()> {
    if value.is_some_and(|next| next < 0.0) {
        Err(ApiError::BadRequest(message.to_string()))
    } else {
        Ok(())
    }
}

fn validate_quantity(quantity: i32) -> ApiResult<()> {
    if !(1..=99).contains(&quantity) {
        return Err(ApiError::BadRequest("购买数量需在 1-99 之间".to_string()));
    }
    Ok(())
}

fn validate_order_status(status: &str) -> ApiResult<()> {
    if matches!(
        status,
        "pending_payment"
            | "paid"
            | "ready_for_pickup"
            | "dispatching"
            | "delivering"
            | "completed"
            | "cancelled"
    ) {
        Ok(())
    } else {
        Err(ApiError::BadRequest("订单状态不正确".to_string()))
    }
}

fn normalize_community_interaction(interaction_type: &str) -> ApiResult<&'static str> {
    match interaction_type.trim() {
        "like" => Ok("like"),
        "follow" => Ok("follow"),
        "join" => Ok("join"),
        _ => Err(ApiError::BadRequest("互动类型不正确".to_string())),
    }
}

fn order_status_title(status: &str) -> &'static str {
    match status {
        "paid" => "订单支付",
        "ready_for_pickup" => "待自提核销",
        "dispatching" => "无人车已派发",
        "delivering" => "配送途中",
        "completed" => "已完成签收",
        "cancelled" => "订单已取消",
        _ => "订单状态更新",
    }
}

fn new_mall_order_no() -> String {
    let suffix = uuid::Uuid::new_v4().simple().to_string();
    format!(
        "RR{}{}",
        chrono::Utc::now().format("%y%m%d%H%M%S"),
        &suffix[..6]
    )
}

fn random_cabin_code() -> String {
    let suffix = uuid::Uuid::new_v4().simple().to_string();
    suffix[..6].to_ascii_uppercase()
}

fn random_fulfillment_code() -> String {
    let value = uuid::Uuid::new_v4().as_u128() % 1_000_000;
    format!("{value:06}")
}

async fn read_mall_product_image_bytes(
    field: axum::extract::multipart::Field<'_>,
) -> ApiResult<Vec<u8>> {
    field
        .bytes()
        .await
        .map(|bytes| bytes.to_vec())
        .map_err(|err| ApiError::BadRequest(err.to_string()))
}

async fn read_ignored_multipart_field(
    field: axum::extract::multipart::Field<'_>,
    total_bytes: &mut usize,
) -> ApiResult<()> {
    let bytes = field
        .bytes()
        .await
        .map_err(|err| ApiError::BadRequest(err.to_string()))?;
    *total_bytes += bytes.len();
    if *total_bytes > MAX_MALL_PRODUCT_IMAGE_BYTES {
        return Err(ApiError::BadRequest("上传字段过大".to_string()));
    }
    Ok(())
}

fn extension_for_product_image(content_type: Option<&str>) -> Option<&'static str> {
    match content_type {
        Some("image/jpeg") => Some("jpg"),
        Some("image/png") => Some("png"),
        Some("image/webp") => Some("webp"),
        Some("image/gif") => Some("gif"),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn create_order_request_accepts_pickup_point_without_address() {
        let body = serde_json::from_value::<CreateMallOrderRequest>(serde_json::json!({
            "userId": "mall-user-1",
            "pickupPointId": "pickup-point-1"
        }))
        .expect("pickup point checkout should not require an address id");

        assert!(body.address_id.is_none());
        assert_eq!(body.pickup_point_id.as_deref(), Some("pickup-point-1"));
    }
}
