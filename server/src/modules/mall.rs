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
const MAX_MALL_QUALIFICATION_FILE_BYTES: usize = 10 * 1024 * 1024;
const MAX_PRODUCT_IMAGES: usize = 20;
const MAX_PRODUCT_VARIANTS: usize = 50;
const ALLOWED_MALL_PRODUCT_IMAGE_TYPES: &[&str] =
    &["image/jpeg", "image/png", "image/webp", "image/gif"];
const ALLOWED_MALL_QUALIFICATION_FILE_TYPES: &[&str] = &[
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "application/pdf",
];

pub fn router<S>() -> Router<AppState<S>>
where
    S: Storage,
{
    Router::new()
        .route("/api/mall/categories", get(list_categories::<S>))
        .route("/api/mall/home-banners", get(list_home_banners::<S>))
        .route("/api/mall/home-sections", get(list_home_sections::<S>))
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
            "/api/mall/delivery-time-slots",
            get(get_delivery_time_slots::<S>),
        )
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
        .route("/api/admin/mall/ops/overview", get(admin_ops_overview::<S>))
        .route(
            "/api/admin/mall/pickup-points",
            get(admin_list_pickup_points::<S>).post(admin_create_pickup_point::<S>),
        )
        .route(
            "/api/admin/mall/pickup-points/:id",
            put(admin_update_pickup_point::<S>).delete(admin_delete_pickup_point::<S>),
        )
        .route(
            "/api/admin/mall/group-leaders",
            get(admin_list_group_leaders::<S>).post(admin_create_group_leader::<S>),
        )
        .route(
            "/api/admin/mall/group-leaders/:id",
            put(admin_update_group_leader::<S>).delete(admin_delete_group_leader::<S>),
        )
        .route(
            "/api/admin/mall/listing-requests",
            get(admin_list_product_listing_requests::<S>)
                .post(admin_create_product_listing_request::<S>),
        )
        .route(
            "/api/admin/mall/listing-requests/:id/review",
            post(admin_review_product_listing_request::<S>),
        )
        .route(
            "/api/admin/mall/delivery-sheets",
            get(admin_list_delivery_sheets::<S>),
        )
        .route(
            "/api/admin/mall/delivery-sheets/generate",
            post(admin_generate_delivery_sheet::<S>),
        )
        .route(
            "/api/admin/mall/delivery-sheets/:id/status",
            put(admin_update_delivery_sheet_status::<S>),
        )
        .route(
            "/api/admin/mall/finance/bills",
            get(admin_list_finance_bills::<S>),
        )
        .route(
            "/api/admin/mall/finance/settlements",
            get(admin_list_settlement_records::<S>),
        )
        .route(
            "/api/admin/mall/finance/withdrawals",
            get(admin_list_withdrawal_requests::<S>).post(admin_create_withdrawal::<S>),
        )
        .route("/api/admin/mall/stats/sales", get(admin_sales_stats::<S>))
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
            get(admin_list_inventory_alerts::<S>).post(admin_create_inventory_alert::<S>),
        )
        .route(
            "/api/admin/mall/inventory-alerts/:id",
            put(admin_update_inventory_alert::<S>).delete(admin_delete_inventory_alert::<S>),
        )
        .route(
            "/api/admin/mall/uploads/product-image",
            post(admin_upload_product_image::<S>),
        )
        .route(
            "/api/admin/mall/uploads/qualification-file",
            post(admin_upload_qualification_file::<S>),
        )
        .route(
            "/api/admin/mall/procurement-buyers",
            get(admin_list_procurement_buyers::<S>).post(admin_create_procurement_buyer::<S>),
        )
        .route(
            "/api/admin/mall/procurement-buyers/:id",
            put(admin_update_procurement_buyer::<S>).delete(admin_delete_procurement_buyer::<S>),
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
            "/api/admin/mall/orders/:id/weight-adjustment",
            put(admin_update_order_weight_adjustment::<S>),
        )
        .route(
            "/api/admin/mall/orders/:id/refund",
            post(admin_refund_order::<S>),
        )
        .route(
            "/api/admin/mall/after-sales",
            get(admin_list_after_sales::<S>),
        )
        .route(
            "/api/admin/mall/after-sales/:id",
            put(admin_update_after_sale::<S>),
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
        .route(
            "/api/admin/mall/campaigns/:id",
            put(update_campaign::<S>).delete(delete_campaign::<S>),
        )
        .route(
            "/api/admin/mall/coupons",
            get(admin_list_coupons::<S>).post(admin_create_coupon::<S>),
        )
        .route(
            "/api/admin/mall/coupons/:id",
            get(admin_get_coupon::<S>)
                .put(admin_update_coupon::<S>)
                .delete(admin_delete_coupon::<S>),
        )
        .route(
            "/api/admin/mall/home-banners",
            get(admin_list_home_banners::<S>).post(admin_create_home_banner::<S>),
        )
        .route(
            "/api/admin/mall/home-banners/:id",
            get(admin_get_home_banner::<S>).put(admin_update_home_banner::<S>),
        )
        .route(
            "/api/admin/mall/home-sections",
            get(admin_list_home_sections::<S>).post(admin_create_home_section::<S>),
        )
        .route(
            "/api/admin/mall/home-sections/:id",
            get(admin_get_home_section::<S>)
                .put(admin_update_home_section::<S>)
                .delete(admin_delete_home_section::<S>),
        )
        .route(
            "/api/admin/mall/settings",
            get(get_operation_settings::<S>).put(update_operation_settings::<S>),
        )
        .route(
            "/api/admin/mall/permissions",
            get(admin_list_permissions::<S>).post(admin_create_permission::<S>),
        )
        .route(
            "/api/admin/mall/permissions/:id",
            put(admin_update_permission::<S>).delete(admin_delete_permission::<S>),
        )
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProductQuery {
    category_code: Option<String>,
    category_id: Option<String>,
    keyword: Option<String>,
    status: Option<String>,
    #[serde(alias = "activity", alias = "activity_type", alias = "campaign_type")]
    activity_type: Option<String>,
    #[serde(alias = "orderBy", alias = "order_by")]
    sort: Option<String>,
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
struct InventoryAlertMutationRequest {
    #[serde(alias = "product_id")]
    product_id: Option<String>,
    stock: Option<i32>,
    #[serde(alias = "stock_alert_threshold")]
    stock_alert_threshold: Option<i32>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProcurementBuyerQuery {
    keyword: Option<String>,
    status: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProcurementBuyerMutationRequest {
    name: Option<String>,
    #[serde(alias = "contact_name")]
    contact_name: Option<String>,
    #[serde(alias = "contact_phone", alias = "phone")]
    contact_phone: Option<String>,
    #[serde(alias = "license_url", alias = "business_license_url")]
    license_url: Option<String>,
    status: Option<String>,
    remark: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct UserQuery {
    #[serde(alias = "user_id")]
    user_id: Option<String>,
    status: Option<String>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct OrderQuery {
    #[serde(alias = "order_no")]
    order_no: Option<String>,
    #[serde(alias = "user_phone", alias = "phone")]
    user_phone: Option<String>,
    #[serde(alias = "merchant_id")]
    merchant_id: Option<String>,
    status: Option<String>,
    #[serde(alias = "start_date", alias = "date_from", alias = "started_at")]
    start_date: Option<String>,
    #[serde(alias = "end_date", alias = "date_to", alias = "ended_at")]
    end_date: Option<String>,
    page: Option<i64>,
    #[serde(alias = "page_size", alias = "limit")]
    page_size: Option<i64>,
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
    keyword: Option<String>,
    status: Option<String>,
    #[serde(alias = "community_name")]
    community_name: Option<String>,
    community: Option<String>,
    #[serde(alias = "page_size", alias = "limit")]
    page_size: Option<i64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PickupPointMutationRequest {
    name: Option<String>,
    #[serde(alias = "address_text", alias = "address")]
    address_text: Option<String>,
    latitude: Option<f64>,
    longitude: Option<f64>,
    #[serde(alias = "business_hours")]
    business_hours: Option<String>,
    status: Option<String>,
    #[serde(alias = "community_name")]
    community_name: Option<String>,
    #[serde(alias = "leader_name")]
    leader_name: Option<String>,
    #[serde(alias = "leader_phone")]
    leader_phone: Option<String>,
    #[serde(alias = "sort_order")]
    sort_order: Option<i32>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GroupLeaderQuery {
    keyword: Option<String>,
    status: Option<String>,
    #[serde(alias = "pickup_point_id")]
    pickup_point_id: Option<String>,
    #[serde(alias = "page_size", alias = "limit")]
    page_size: Option<i64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GroupLeaderMutationRequest {
    #[serde(alias = "pickup_point_id")]
    pickup_point_id: Option<String>,
    #[serde(alias = "user_id")]
    user_id: Option<String>,
    name: Option<String>,
    phone: Option<String>,
    status: Option<String>,
    #[serde(alias = "service_note")]
    service_note: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProductListingRequestQuery {
    status: Option<String>,
    #[serde(alias = "product_id")]
    product_id: Option<String>,
    #[serde(alias = "request_type")]
    request_type: Option<String>,
    #[serde(alias = "supplier_id")]
    supplier_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProductListingRequestMutation {
    #[serde(alias = "product_id")]
    product_id: Option<String>,
    #[serde(alias = "request_type")]
    request_type: Option<String>,
    #[serde(alias = "requested_status")]
    requested_status: Option<String>,
    #[serde(alias = "requester_id")]
    requester_id: Option<String>,
    #[serde(alias = "requester_role")]
    requester_role: Option<String>,
    #[serde(alias = "supplier_id")]
    supplier_id: Option<String>,
    reason: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProductListingReviewRequest {
    status: String,
    #[serde(alias = "reviewed_by")]
    reviewed_by: Option<String>,
    #[serde(alias = "review_note")]
    review_note: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DeliverySheetQuery {
    #[serde(alias = "sheet_date")]
    sheet_date: Option<String>,
    status: Option<String>,
    #[serde(alias = "pickup_point_id")]
    pickup_point_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GenerateDeliverySheetRequest {
    #[serde(alias = "sheet_date")]
    sheet_date: Option<String>,
    #[serde(alias = "pickup_point_id")]
    pickup_point_id: Option<String>,
    #[serde(alias = "generated_by")]
    generated_by: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct UpdateDeliverySheetStatusRequest {
    status: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FinanceQuery {
    period: Option<String>,
    #[serde(alias = "start_date")]
    start_date: Option<String>,
    #[serde(alias = "end_date")]
    end_date: Option<String>,
    #[serde(alias = "supplier_id")]
    supplier_id: Option<String>,
    status: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WithdrawalMutationRequest {
    #[serde(alias = "requester_id")]
    requester_id: Option<String>,
    #[serde(alias = "requester_role")]
    requester_role: Option<String>,
    #[serde(alias = "supplier_id")]
    supplier_id: Option<String>,
    #[serde(alias = "amount_cents")]
    amount_cents: Option<i64>,
    #[serde(alias = "bank_account_snapshot")]
    bank_account_snapshot: Option<Value>,
    note: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SalesStatsQuery {
    period: Option<String>,
    #[serde(alias = "start_date")]
    start_date: Option<String>,
    #[serde(alias = "end_date")]
    end_date: Option<String>,
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
struct AdminAfterSaleQuery {
    keyword: Option<String>,
    status: Option<String>,
    #[serde(alias = "start_date")]
    start_date: Option<String>,
    #[serde(alias = "end_date")]
    end_date: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct UpsertCartItemRequest {
    #[serde(alias = "user_id")]
    user_id: String,
    #[serde(alias = "product_id")]
    product_id: String,
    #[serde(alias = "variant_id")]
    variant_id: Option<String>,
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
    #[serde(alias = "delivery_date")]
    delivery_date: Option<String>,
    #[serde(alias = "delivery_time_slot")]
    delivery_time_slot: Option<String>,
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
    #[serde(alias = "variant_id")]
    variant_id: Option<String>,
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
    images: Option<Vec<String>>,
    variants: Option<Vec<ProductVariantMutation>>,
    #[serde(
        alias = "procurement_buyer_ids",
        alias = "buyer_ids",
        alias = "supplier_ids"
    )]
    procurement_buyer_ids: Option<Vec<String>>,
    #[serde(alias = "qualification_reports", alias = "quality_reports")]
    qualification_reports: Option<Vec<ProductQualificationReportMutation>>,
    #[serde(alias = "hide_supplier")]
    hide_supplier: Option<bool>,
    specification: Option<String>,
    #[serde(alias = "sale_method")]
    sale_method: Option<String>,
    #[serde(alias = "supply_price_cents")]
    supply_price_cents: Option<i64>,
    #[serde(alias = "price_cents")]
    price_cents: Option<i64>,
    #[serde(alias = "original_price_cents")]
    original_price_cents: Option<i64>,
    stock: Option<i32>,
    #[serde(alias = "stock_alert_threshold")]
    stock_alert_threshold: Option<i32>,
    #[serde(
        alias = "minimumOrderQuantity",
        alias = "minimum_order_quantity",
        alias = "min_order_quantity"
    )]
    minimum_order_quantity: Option<i32>,
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

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProductQualificationReportMutation {
    id: Option<String>,
    #[serde(alias = "buyer_id", alias = "supplier_id")]
    buyer_id: Option<String>,
    #[serde(alias = "report_name", alias = "name")]
    report_name: Option<String>,
    #[serde(alias = "report_type", alias = "type")]
    report_type: Option<String>,
    #[serde(alias = "report_url", alias = "url")]
    report_url: Option<String>,
    issuer: Option<String>,
    #[serde(alias = "issued_at")]
    issued_at: Option<String>,
    #[serde(alias = "expires_at")]
    expires_at: Option<String>,
    #[serde(alias = "hide_supplier")]
    hide_supplier: Option<bool>,
    status: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProductVariantMutation {
    id: Option<String>,
    name: Option<String>,
    sku: Option<String>,
    specification: Option<String>,
    #[serde(alias = "sale_method")]
    sale_method: Option<String>,
    #[serde(alias = "price_cents")]
    price_cents: Option<i64>,
    #[serde(alias = "original_price_cents")]
    original_price_cents: Option<i64>,
    #[serde(alias = "supply_price_cents")]
    supply_price_cents: Option<i64>,
    stock: Option<i32>,
    #[serde(
        alias = "minimumOrderQuantity",
        alias = "minimum_order_quantity",
        alias = "min_order_quantity"
    )]
    minimum_order_quantity: Option<i32>,
    status: Option<String>,
    #[serde(alias = "sort_order")]
    sort_order: Option<i32>,
    pricing_mode: Option<String>,
    weight_unit: Option<String>,
    weight_unit_label: Option<String>,
    weight_unit_grams: Option<i32>,
    weight_tolerance_bps: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProductVariant {
    id: String,
    name: String,
    sku: String,
    specification: String,
    #[serde(alias = "sale_method")]
    sale_method: String,
    #[serde(alias = "price_cents")]
    price_cents: i64,
    #[serde(alias = "original_price_cents")]
    original_price_cents: Option<i64>,
    #[serde(alias = "supply_price_cents")]
    supply_price_cents: Option<i64>,
    stock: i32,
    #[serde(alias = "minimum_order_quantity")]
    minimum_order_quantity: i32,
    status: String,
    #[serde(alias = "sort_order")]
    sort_order: i32,
    #[serde(default = "default_product_variant_pricing_mode")]
    pricing_mode: String,
    #[serde(default = "default_product_variant_weight_unit")]
    weight_unit: String,
    #[serde(default = "default_product_variant_weight_unit_label")]
    weight_unit_label: String,
    #[serde(default = "default_product_variant_weight_unit_grams")]
    weight_unit_grams: i32,
    #[serde(default = "default_product_variant_weight_tolerance_bps")]
    weight_tolerance_bps: i32,
}

#[derive(Debug, Clone)]
struct ProductVariantDefaults {
    sku: String,
    specification: String,
    sale_method: String,
    price_cents: i64,
    original_price_cents: Option<i64>,
    supply_price_cents: Option<i64>,
    stock: i32,
    minimum_order_quantity: i32,
    status: String,
}

#[derive(Debug, Clone)]
struct NormalizedQualificationReport {
    id: String,
    buyer_id: Option<String>,
    report_name: String,
    report_type: Option<String>,
    report_url: String,
    issuer: Option<String>,
    issued_at: Option<String>,
    expires_at: Option<String>,
    hide_supplier: bool,
    status: String,
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
struct CampaignQuery {
    keyword: Option<String>,
    status: Option<String>,
    #[serde(alias = "campaign_type")]
    campaign_type: Option<String>,
    #[serde(alias = "page_size", alias = "limit")]
    page_size: Option<i64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CouponQuery {
    keyword: Option<String>,
    status: Option<String>,
    #[serde(alias = "coupon_type")]
    coupon_type: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CouponMutationRequest {
    name: Option<String>,
    code: Option<String>,
    #[serde(alias = "coupon_type")]
    coupon_type: Option<String>,
    #[serde(alias = "threshold_cents")]
    threshold_cents: Option<i64>,
    #[serde(alias = "discount_cents")]
    discount_cents: Option<i64>,
    #[serde(alias = "total_quantity")]
    total_quantity: Option<i32>,
    #[serde(alias = "per_user_limit")]
    per_user_limit: Option<i32>,
    description: Option<String>,
    rules: Option<Value>,
    status: Option<String>,
    #[serde(alias = "starts_at")]
    starts_at: Option<String>,
    #[serde(alias = "ends_at")]
    ends_at: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct HomeBannerQuery {
    keyword: Option<String>,
    status: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct HomeBannerMutationRequest {
    title: Option<String>,
    subtitle: Option<String>,
    #[serde(alias = "image_url")]
    image_url: Option<String>,
    #[serde(alias = "link_type")]
    link_type: Option<String>,
    #[serde(alias = "link_target")]
    link_target: Option<String>,
    #[serde(alias = "sort_order")]
    sort_order: Option<i32>,
    status: Option<String>,
    #[serde(alias = "starts_at")]
    starts_at: Option<String>,
    #[serde(alias = "ends_at")]
    ends_at: Option<String>,
    metadata: Option<Value>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct HomeSectionQuery {
    keyword: Option<String>,
    status: Option<String>,
    #[serde(alias = "section_type")]
    section_type: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct HomeSectionMutationRequest {
    #[serde(alias = "section_type")]
    section_type: Option<String>,
    title: Option<String>,
    subtitle: Option<String>,
    content: Option<String>,
    #[serde(alias = "image_url")]
    image_url: Option<String>,
    #[serde(alias = "link_type")]
    link_type: Option<String>,
    #[serde(alias = "link_target")]
    link_target: Option<String>,
    #[serde(alias = "product_ids")]
    product_ids: Option<Value>,
    rules: Option<Value>,
    #[serde(alias = "sort_order")]
    sort_order: Option<i32>,
    status: Option<String>,
    #[serde(alias = "starts_at")]
    starts_at: Option<String>,
    #[serde(alias = "ends_at")]
    ends_at: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PermissionQuery {
    keyword: Option<String>,
    status: Option<String>,
    module: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PermissionMutationRequest {
    name: Option<String>,
    #[serde(alias = "role_key")]
    role_key: Option<String>,
    description: Option<String>,
    modules: Option<Vec<String>>,
    actions: Option<Vec<String>>,
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
    #[serde(alias = "delivery_rules")]
    delivery_rules: Option<Value>,
    #[serde(alias = "payment_split_rules")]
    payment_split_rules: Option<Value>,
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
struct WeightAdjustmentRequest {
    #[serde(alias = "item_id")]
    item_id: String,
    #[serde(alias = "actual_weight_grams")]
    actual_weight_grams: Option<i32>,
    #[serde(alias = "actual_weight_jin")]
    actual_weight_jin: Option<f64>,
    #[serde(alias = "adjusted_by")]
    adjusted_by: Option<String>,
    note: Option<String>,
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
struct UpdateAfterSaleRequest {
    status: Option<String>,
    #[serde(alias = "handling_method")]
    handling_method: Option<String>,
    resolution: Option<String>,
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
    variant_id: String,
    variant_name: String,
    sku: String,
    name: String,
    category_code: Option<String>,
    image_url: Option<String>,
    price_cents: i64,
    stock: i32,
    quantity: i32,
    pricing_mode: String,
    weight_unit: String,
    weight_unit_label: String,
    weight_unit_grams: i32,
    weight_tolerance_bps: i32,
}

#[derive(Debug, FromRow)]
struct CheckoutRow {
    id: String,
    user_id: String,
    source: String,
    product_id: Option<String>,
    variant_id: Option<String>,
    quantity: i32,
    address_id: Option<String>,
    pickup_point_id: Option<String>,
}

#[derive(Debug, FromRow)]
struct WeightAdjustmentItemRow {
    id: String,
    product_name: String,
    unit_price_cents: i64,
    line_total_cents: i64,
    estimated_line_total_cents: Option<i64>,
    pricing_mode: String,
    weight_unit_grams: Option<i32>,
    weight_unit_label: Option<String>,
}

#[derive(Debug, FromRow)]
struct WeightAdjustmentOrderRow {
    subtotal_cents: i64,
    delivery_fee_cents: i64,
    coupon_cents: i64,
    payable_cents: i64,
    estimated_payable_cents: Option<i64>,
}

#[derive(Debug, FromRow)]
struct CampaignDiscountRow {
    name: String,
    threshold_cents: i64,
    discount_cents: i64,
}

#[derive(Debug, FromRow)]
struct MemberPricingContextRow {
    available_points: i32,
    discount_bps: i32,
    level_code: Option<String>,
    level_name: Option<String>,
}

struct MallDiscount {
    discount_cents: i64,
    description: Option<String>,
    threshold_cents: Option<i64>,
    rule_discount_cents: Option<i64>,
    next_discount_cents: Option<i64>,
    next_gap_cents: Option<i64>,
}

struct MallPriceSummary {
    subtotal_cents: i64,
    full_reduction_cents: i64,
    coupon_discount_cents: i64,
    member_discount_cents: i64,
    points_redeemed_cents: i64,
    total_discount_cents: i64,
    payable_cents: i64,
    discount_description: Option<String>,
    discount_threshold_cents: Option<i64>,
    discount_rule_cents: Option<i64>,
    next_discount_gap_cents: Option<i64>,
    next_discount_cents: Option<i64>,
    available_points: i32,
    member_level: Option<Value>,
    discount_breakdown: Vec<Value>,
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
    enrich_products_pricing(&state.db, &mut products).await?;
    for product in &mut products {
        strip_public_product_specs(product);
    }
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

async fn admin_create_inventory_alert<S>(
    State(state): State<AppState<S>>,
    Json(body): Json<InventoryAlertMutationRequest>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let product_id = require_non_empty(body.product_id, "商品不能为空")?;
    let threshold = body
        .stock_alert_threshold
        .ok_or_else(|| ApiError::BadRequest("预警阈值不能为空".to_string()))?;
    validate_positive_i32(threshold, "预警阈值必须大于0")?;
    validate_optional_non_negative_i32(body.stock, "库存不能小于0")?;

    update_inventory_alert_product(
        &state.db,
        &state.storage,
        &product_id,
        body.stock,
        Some(threshold),
    )
    .await
    .map(|product| ok("库存预警创建成功", product))
}

async fn admin_update_inventory_alert<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
    Json(body): Json<InventoryAlertMutationRequest>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    validate_optional_non_negative_i32(body.stock, "库存不能小于0")?;
    validate_optional_non_negative_i32(body.stock_alert_threshold, "预警阈值不能小于0")?;

    update_inventory_alert_product(
        &state.db,
        &state.storage,
        &id,
        body.stock,
        body.stock_alert_threshold,
    )
    .await
    .map(|product| ok("库存预警更新成功", product))
}

async fn admin_delete_inventory_alert<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    update_inventory_alert_product(&state.db, &state.storage, &id, None, Some(0))
        .await
        .map(|product| ok("库存预警已删除", product))
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

async fn admin_upload_qualification_file<S>(
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
            .is_some_and(|value| ALLOWED_MALL_QUALIFICATION_FILE_TYPES.contains(&value))
        {
            return Err(ApiError::BadRequest(
                "请上传 JPG、PNG、WebP、GIF 或 PDF 资质文件".to_string(),
            ));
        }
        let extension = extension_for_qualification_file(content_type.as_deref())
            .ok_or_else(|| ApiError::BadRequest("请上传有效的资质文件".to_string()))?;
        let bytes = read_mall_product_image_bytes(field).await?;

        if bytes.is_empty() {
            return Err(ApiError::BadRequest("资质文件不能为空".to_string()));
        }
        if bytes.len() > MAX_MALL_QUALIFICATION_FILE_BYTES {
            return Err(ApiError::BadRequest("资质文件不能超过10MB".to_string()));
        }

        let key = format!(
            "mall-products/qualifications/{}-{}.{}",
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
            "资质文件上传成功",
            json!({
                "fileKey": file_key,
                "fileUrl": file_key,
                "url": url
            }),
        ));
    }

    Err(ApiError::BadRequest("请选择资质文件".to_string()))
}

async fn admin_list_procurement_buyers<S>(
    State(state): State<AppState<S>>,
    Query(query): Query<ProcurementBuyerQuery>,
) -> ApiResult<Json<ApiEnvelope<Vec<Value>>>>
where
    S: Storage,
{
    let mut builder = QueryBuilder::<Postgres>::new(
        r#"
        SELECT jsonb_build_object(
          'id', id,
          'name', name,
          'contactName', contact_name,
          'contactPhone', contact_phone,
          'licenseUrl', license_url,
          'status', status,
          'remark', remark,
          'createdAt', created_at,
          'updatedAt', updated_at
        )
        FROM mall_procurement_buyers
        WHERE 1 = 1
        "#,
    );
    if let Some(status) = non_empty(query.status) {
        builder.push(" AND status = ");
        builder.push_bind(status);
    } else {
        builder.push(" AND status <> 'deleted'");
    }
    if let Some(keyword) = non_empty(query.keyword) {
        let pattern = format!("%{keyword}%");
        builder.push(" AND (name ILIKE ");
        builder.push_bind(pattern.clone());
        builder.push(" OR contact_name ILIKE ");
        builder.push_bind(pattern.clone());
        builder.push(" OR contact_phone ILIKE ");
        builder.push_bind(pattern);
        builder.push(")");
    }
    builder.push(" ORDER BY updated_at DESC, created_at DESC LIMIT 200");

    let mut buyers = builder
        .build_query_scalar::<Value>()
        .fetch_all(&state.db)
        .await?;
    resolve_mall_image_urls_in_list(&state.storage, &mut buyers).await?;
    Ok(ok("查询成功", buyers))
}

async fn admin_create_procurement_buyer<S>(
    State(state): State<AppState<S>>,
    Json(body): Json<ProcurementBuyerMutationRequest>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let name = require_non_empty(body.name, "采购商名称不能为空")?;
    let status = body.status.unwrap_or_else(|| "active".to_string());
    validate_procurement_buyer_status(&status)?;
    let mut buyer = sqlx::query_scalar::<_, Value>(
        r#"
        INSERT INTO mall_procurement_buyers (
          name, contact_name, contact_phone, license_url, status, remark
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING jsonb_build_object(
          'id', id,
          'name', name,
          'contactName', contact_name,
          'contactPhone', contact_phone,
          'licenseUrl', license_url,
          'status', status,
          'remark', remark,
          'createdAt', created_at,
          'updatedAt', updated_at
        )
        "#,
    )
    .bind(name)
    .bind(non_empty(body.contact_name))
    .bind(non_empty(body.contact_phone))
    .bind(non_empty(body.license_url))
    .bind(status)
    .bind(non_empty(body.remark))
    .fetch_one(&state.db)
    .await?;
    resolve_mall_image_urls(&state.storage, &mut buyer).await?;
    Ok(ok("采购商创建成功", buyer))
}

async fn admin_update_procurement_buyer<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
    Json(body): Json<ProcurementBuyerMutationRequest>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    if let Some(status) = body.status.as_deref() {
        validate_procurement_buyer_status(status)?;
    }
    let mut buyer = sqlx::query_scalar::<_, Value>(
        r#"
        UPDATE mall_procurement_buyers
        SET name = COALESCE($2, name),
            contact_name = COALESCE($3, contact_name),
            contact_phone = COALESCE($4, contact_phone),
            license_url = COALESCE($5, license_url),
            status = COALESCE($6, status),
            remark = COALESCE($7, remark),
            updated_at = now()
        WHERE id = $1
        RETURNING jsonb_build_object(
          'id', id,
          'name', name,
          'contactName', contact_name,
          'contactPhone', contact_phone,
          'licenseUrl', license_url,
          'status', status,
          'remark', remark,
          'createdAt', created_at,
          'updatedAt', updated_at
        )
        "#,
    )
    .bind(&id)
    .bind(optional_non_empty(body.name, "采购商名称不能为空")?)
    .bind(non_empty(body.contact_name))
    .bind(non_empty(body.contact_phone))
    .bind(non_empty(body.license_url))
    .bind(body.status)
    .bind(non_empty(body.remark))
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| ApiError::NotFound("采购商不存在".to_string()))?;
    resolve_mall_image_urls(&state.storage, &mut buyer).await?;
    Ok(ok("采购商更新成功", buyer))
}

async fn admin_delete_procurement_buyer<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let buyer = sqlx::query_scalar::<_, Value>(
        r#"
        UPDATE mall_procurement_buyers
        SET status = 'deleted', updated_at = now()
        WHERE id = $1
        RETURNING jsonb_build_object('id', id, 'status', status)
        "#,
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| ApiError::NotFound("采购商不存在".to_string()))?;
    Ok(ok("采购商已删除", buyer))
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
    enrich_product_pricing(&state.db, &mut product).await?;
    strip_public_product_specs(&mut product);
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
    if let Some(items) = cart.get_mut("items").and_then(Value::as_array_mut) {
        for item in items {
            if let Some(product) = item.get_mut("product") {
                strip_public_product_specs(product);
            }
        }
    }
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
    let variant = ensure_product_variant_can_sell(
        &state.db,
        &body.product_id,
        body.variant_id.as_deref(),
        body.quantity,
    )
    .await?;

    let item = sqlx::query_scalar::<_, Value>(
        r#"
        INSERT INTO mall_cart_items (user_id, product_id, variant_id, variant_name, quantity, selected)
        VALUES ($1, $2, $3, $4, $5, COALESCE($6, true))
        ON CONFLICT (user_id, product_id, variant_id)
        DO UPDATE SET quantity = mall_cart_items.quantity + EXCLUDED.quantity,
                      variant_name = EXCLUDED.variant_name,
                      selected = EXCLUDED.selected,
                      updated_at = now()
        RETURNING jsonb_build_object(
          'id', mall_cart_items.id,
          'userId', mall_cart_items.user_id,
          'productId', mall_cart_items.product_id,
          'variantId', mall_cart_items.variant_id,
          'variantName', mall_cart_items.variant_name,
          'quantity', mall_cart_items.quantity,
          'selected', mall_cart_items.selected
        )
        "#,
    )
    .bind(body.user_id)
    .bind(body.product_id)
    .bind(variant.id)
    .bind(variant.name)
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
        let (product_id, variant_id): (String, String) =
            sqlx::query_as("SELECT product_id, variant_id FROM mall_cart_items WHERE id = $1")
                .bind(&id)
                .fetch_optional(&state.db)
                .await?
                .ok_or_else(|| ApiError::NotFound("购物车项不存在".to_string()))?;
        ensure_product_variant_can_sell(&state.db, &product_id, Some(&variant_id), quantity)
            .await?;
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
          'variantId', variant_id,
          'variantName', variant_name,
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
        ensure_product_variant_can_sell(
            &state.db,
            product_id,
            body.variant_id.as_deref(),
            quantity,
        )
        .await?;
    }

    let checkout_id = sqlx::query_scalar::<_, String>(
        r#"
        INSERT INTO mall_checkouts (
          user_id, source, product_id, variant_id, quantity, address_id, pickup_point_id, expires_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, now() + interval '30 minutes')
        RETURNING id
        "#,
    )
    .bind(&body.user_id)
    .bind(source)
    .bind(product_id)
    .bind(non_empty(body.variant_id))
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

async fn admin_create_pickup_point<S>(
    State(state): State<AppState<S>>,
    Json(body): Json<PickupPointMutationRequest>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let name = require_non_empty(body.name, "自提点名称不能为空")?;
    let address_text = require_non_empty(body.address_text, "自提点地址不能为空")?;
    let status = body.status.unwrap_or_else(|| "active".to_string());
    validate_pickup_point_status(&status)?;
    validate_optional_non_negative_i32(body.sort_order, "排序不能小于0")?;

    let point = sqlx::query_scalar::<_, Value>(
        r#"
        INSERT INTO mall_pickup_points (
          name, address_text, latitude, longitude, business_hours, status,
          community_name, leader_name, leader_phone, sort_order
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10, 0))
        RETURNING jsonb_build_object(
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
        "#,
    )
    .bind(name)
    .bind(address_text)
    .bind(body.latitude)
    .bind(body.longitude)
    .bind(non_empty(body.business_hours))
    .bind(status)
    .bind(non_empty(body.community_name))
    .bind(non_empty(body.leader_name))
    .bind(non_empty(body.leader_phone))
    .bind(body.sort_order)
    .fetch_one(&state.db)
    .await?;

    Ok(ok("自提点创建成功", point))
}

async fn admin_update_pickup_point<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
    Json(body): Json<PickupPointMutationRequest>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    if let Some(status) = body.status.as_deref() {
        validate_pickup_point_status(status)?;
    }
    validate_optional_non_negative_i32(body.sort_order, "排序不能小于0")?;
    let name = optional_non_empty(body.name, "自提点名称不能为空")?;
    let address_text = optional_non_empty(body.address_text, "自提点地址不能为空")?;

    let point = sqlx::query_scalar::<_, Value>(
        r#"
        UPDATE mall_pickup_points
        SET name = COALESCE($2, name),
            address_text = COALESCE($3, address_text),
            latitude = COALESCE($4, latitude),
            longitude = COALESCE($5, longitude),
            business_hours = COALESCE($6, business_hours),
            status = COALESCE($7, status),
            community_name = COALESCE($8, community_name),
            leader_name = COALESCE($9, leader_name),
            leader_phone = COALESCE($10, leader_phone),
            sort_order = COALESCE($11, sort_order),
            updated_at = now()
        WHERE id = $1
        RETURNING jsonb_build_object(
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
        "#,
    )
    .bind(&id)
    .bind(name)
    .bind(address_text)
    .bind(body.latitude)
    .bind(body.longitude)
    .bind(non_empty(body.business_hours))
    .bind(body.status)
    .bind(non_empty(body.community_name))
    .bind(non_empty(body.leader_name))
    .bind(non_empty(body.leader_phone))
    .bind(body.sort_order)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| ApiError::NotFound("自提点不存在".to_string()))?;

    Ok(ok("自提点更新成功", point))
}

async fn admin_delete_pickup_point<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let point = sqlx::query_scalar::<_, Value>(
        r#"
        UPDATE mall_pickup_points
        SET status = 'deleted',
            updated_at = now()
        WHERE id = $1
        RETURNING jsonb_build_object(
          'id', id,
          'name', name,
          'addressText', address_text,
          'status', status,
          'communityName', community_name,
          'leaderName', leader_name,
          'leaderPhone', leader_phone,
          'updatedAt', updated_at
        )
        "#,
    )
    .bind(&id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| ApiError::NotFound("自提点不存在".to_string()))?;

    sqlx::query(
        r#"
        UPDATE mall_group_leaders
        SET status = 'inactive',
            updated_at = now()
        WHERE pickup_point_id = $1
          AND status <> 'deleted'
        "#,
    )
    .bind(&id)
    .execute(&state.db)
    .await?;

    Ok(ok("自提点已删除", point))
}

async fn admin_list_group_leaders<S>(
    State(state): State<AppState<S>>,
    Query(query): Query<GroupLeaderQuery>,
) -> ApiResult<Json<ApiEnvelope<Vec<Value>>>>
where
    S: Storage,
{
    let leaders = fetch_group_leaders(&state.db, query).await?;
    Ok(ok("查询成功", leaders))
}

async fn admin_create_group_leader<S>(
    State(state): State<AppState<S>>,
    Json(body): Json<GroupLeaderMutationRequest>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let pickup_point_id = require_non_empty(body.pickup_point_id, "绑定自提点不能为空")?;
    let name = require_non_empty(body.name, "团长姓名不能为空")?;
    let status = body.status.unwrap_or_else(|| "active".to_string());
    validate_group_leader_status(&status)?;
    ensure_pickup_point_exists_for_admin(&state.db, &pickup_point_id).await?;

    let leader = sqlx::query_scalar::<_, Value>(
        r#"
        INSERT INTO mall_group_leaders (
          pickup_point_id, user_id, name, phone, status, service_note
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING jsonb_build_object(
          'id', id,
          'pickupPointId', pickup_point_id,
          'userId', user_id,
          'name', name,
          'phone', phone,
          'status', status,
          'serviceNote', service_note,
          'createdAt', created_at,
          'updatedAt', updated_at
        )
        "#,
    )
    .bind(&pickup_point_id)
    .bind(non_empty(body.user_id))
    .bind(name)
    .bind(non_empty(body.phone))
    .bind(status)
    .bind(non_empty(body.service_note))
    .fetch_one(&state.db)
    .await?;

    sync_pickup_point_leader_contact(&state.db, &pickup_point_id).await?;
    Ok(ok("团长创建成功", leader))
}

async fn admin_update_group_leader<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
    Json(body): Json<GroupLeaderMutationRequest>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    if let Some(status) = body.status.as_deref() {
        validate_group_leader_status(status)?;
    }
    if let Some(pickup_point_id) = body.pickup_point_id.as_deref().and_then(|value| {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        }
    }) {
        ensure_pickup_point_exists_for_admin(&state.db, pickup_point_id).await?;
    }

    let name = optional_non_empty(body.name, "团长姓名不能为空")?;
    let next_pickup_point_id = non_empty(body.pickup_point_id);
    let original_pickup_point_id = sqlx::query_scalar::<_, String>(
        "SELECT pickup_point_id FROM mall_group_leaders WHERE id = $1",
    )
    .bind(&id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| ApiError::NotFound("团长不存在".to_string()))?;

    let leader = sqlx::query_scalar::<_, Value>(
        r#"
        UPDATE mall_group_leaders
        SET pickup_point_id = COALESCE($2, pickup_point_id),
            user_id = COALESCE($3, user_id),
            name = COALESCE($4, name),
            phone = COALESCE($5, phone),
            status = COALESCE($6, status),
            service_note = COALESCE($7, service_note),
            updated_at = now()
        WHERE id = $1
        RETURNING jsonb_build_object(
          'id', id,
          'pickupPointId', pickup_point_id,
          'userId', user_id,
          'name', name,
          'phone', phone,
          'status', status,
          'serviceNote', service_note,
          'createdAt', created_at,
          'updatedAt', updated_at
        )
        "#,
    )
    .bind(&id)
    .bind(next_pickup_point_id.as_deref())
    .bind(non_empty(body.user_id))
    .bind(name)
    .bind(non_empty(body.phone))
    .bind(body.status)
    .bind(non_empty(body.service_note))
    .fetch_one(&state.db)
    .await?;

    sync_pickup_point_leader_contact(&state.db, &original_pickup_point_id).await?;
    if let Some(next_pickup_point_id) = next_pickup_point_id {
        if next_pickup_point_id != original_pickup_point_id {
            sync_pickup_point_leader_contact(&state.db, &next_pickup_point_id).await?;
        }
    }

    Ok(ok("团长更新成功", leader))
}

async fn admin_delete_group_leader<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let leader = sqlx::query_scalar::<_, Value>(
        r#"
        UPDATE mall_group_leaders
        SET status = 'deleted',
            updated_at = now()
        WHERE id = $1
        RETURNING jsonb_build_object(
          'id', id,
          'pickupPointId', pickup_point_id,
          'name', name,
          'phone', phone,
          'status', status,
          'serviceNote', service_note,
          'updatedAt', updated_at
        )
        "#,
    )
    .bind(&id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| ApiError::NotFound("团长不存在".to_string()))?;

    if let Some(pickup_point_id) = leader.get("pickupPointId").and_then(Value::as_str) {
        sync_pickup_point_leader_contact(&state.db, pickup_point_id).await?;
    }

    Ok(ok("团长已删除", leader))
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
    let coupon_wallet = fetch_member_coupon_wallet(&state.db).await?;
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
            "couponWallet": coupon_wallet,
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
    let total_payable_cents = today
        .get("totalPayableCents")
        .and_then(Value::as_i64)
        .unwrap_or_default();
    let commission_rate_bps = 1000_i64;
    let estimated_commission_cents = total_payable_cents * commission_rate_bps / 10_000;

    Ok(ok(
        "查询成功",
        json!({
            "leader": leader,
            "pickupPoint": leader.get("pickupPoint").cloned().unwrap_or(Value::Null),
            "today": today,
            "pendingOrders": pending_orders,
            "commissionRateBps": commission_rate_bps,
            "commissionRateRange": "8%-12%",
            "estimatedCommissionCents": estimated_commission_cents,
            "withdrawableCents": estimated_commission_cents,
            "monthlyRewardCents": if total_payable_cents >= 200_000 { 20_000 } else { 0 },
            "reminders": [
                {
                    "id": "orders",
                    "title": "自提点订单",
                    "description": "查看今日到点订单和待核销提货码",
                    "actionText": "查看"
                },
                {
                    "id": "verify",
                    "title": "核销取货",
                    "description": "输入或扫码核销团员取货码",
                    "actionText": "核销"
                },
                {
                    "id": "commission",
                    "title": "佣金明细",
                    "description": "按自提点销售额 8%-12% 计算",
                    "actionText": "明细"
                }
            ],
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
    let summary = calculate_mall_price_summary(
        &state.db,
        Some(&body.user_id),
        subtotal_cents,
        delivery_fee_cents,
    )
    .await?;
    let coupon_cents = summary.total_discount_cents;
    let payable_cents = summary.payable_cents;
    if payable_cents <= 0 {
        return Err(ApiError::BadRequest("订单金额必须大于0".to_string()));
    }
    let has_weighted_items = cart_items.iter().any(|item| item.pricing_mode == "weighed");
    let weight_adjustment_status = if has_weighted_items {
        "pending"
    } else {
        "none"
    };

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

    let waypoints_json = body
        .waypoints
        .as_ref()
        .map(|waypoints| serde_json::to_value(waypoints).unwrap_or(json!([])));

    let order_id: String = sqlx::query_scalar(
        r#"
        INSERT INTO mall_orders (
          order_no, user_id, address_id, pickup_point_id, recipient_name, recipient_phone, address_text,
          latitude, longitude, delivery_method, pickup_method, expected_delivery_window,
          delivery_date, delivery_time_slot,
          subtotal_cents, delivery_fee_cents, coupon_cents, payable_cents,
          cabin_code, remark, waypoints, origin_latitude, origin_longitude, origin_address,
          estimated_payable_cents, weight_adjustment_status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::numeric, $9::numeric, $10, $11, $12, $13::date, $14, $15, $16, $17, $18, $19, $20, $21, $22::numeric, $23::numeric, $24, $25, $26)
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
    .bind(&body.delivery_date)
    .bind(&body.delivery_time_slot)
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
    .bind(payable_cents)
    .bind(weight_adjustment_status)
    .fetch_one(&mut *tx)
    .await?;

    for item in &cart_items {
        let line_total = item.price_cents * i64::from(item.quantity);
        let estimated_weight_grams = estimated_weight_grams_for_item(item);
        let item_weight_adjustment_status = if item.pricing_mode == "weighed" {
            "pending"
        } else {
            "none"
        };
        sqlx::query(
            r#"
            INSERT INTO mall_order_items (
              order_id, product_id, variant_id, variant_name, sku, product_name, category_code, image_url,
              unit_price_cents, quantity, line_total_cents, estimated_line_total_cents,
              pricing_mode, estimated_weight_grams, weight_unit, weight_unit_label, weight_unit_grams,
              weight_tolerance_bps, weight_adjustment_status
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
            "#,
        )
        .bind(&order_id)
        .bind(&item.product_id)
        .bind(&item.variant_id)
        .bind(&item.variant_name)
        .bind(&item.sku)
        .bind(&item.name)
        .bind(&item.category_code)
        .bind(&item.image_url)
        .bind(item.price_cents)
        .bind(item.quantity)
        .bind(line_total)
        .bind(line_total)
        .bind(&item.pricing_mode)
        .bind(estimated_weight_grams)
        .bind(&item.weight_unit)
        .bind(&item.weight_unit_label)
        .bind(item.weight_unit_grams)
        .bind(item.weight_tolerance_bps)
        .bind(item_weight_adjustment_status)
        .execute(&mut *tx)
        .await?;

        sqlx::query(
            r#"
            UPDATE mall_products
            SET stock = GREATEST(stock - $2, 0),
                sold_count = sold_count + $2,
                variants = (
                  SELECT COALESCE(jsonb_agg(
                    CASE WHEN variant.value->>'id' = $3 THEN
                      jsonb_set(
                        variant.value,
                        '{stock}',
                        to_jsonb(GREATEST(((variant.value->>'stock')::integer - $2), 0))
                      )
                    ELSE variant.value END
                    ORDER BY variant.ordinality
                  ), variants)
                  FROM jsonb_array_elements(variants) WITH ORDINALITY AS variant(value, ordinality)
                ),
                updated_at = now()
            WHERE id = $1
            "#,
        )
        .bind(&item.product_id)
        .bind(item.quantity)
        .bind(&item.variant_id)
        .execute(&mut *tx)
        .await?;
    }

    if summary.points_redeemed_cents > 0 {
        sqlx::query(
            r#"
            INSERT INTO mall_points_ledger (
              user_id, order_id, entry_type, points, description
            )
            VALUES ($1, $2, 'redeem', $3, '订单积分抵扣')
            "#,
        )
        .bind(&body.user_id)
        .bind(&order_id)
        .bind(summary.points_redeemed_cents as i32)
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
    let order_query = OrderQuery {
        status: query.status,
        ..OrderQuery::default()
    };
    let mut orders = fetch_orders(&state.db, Some(&user_id), &order_query, false).await?;
    resolve_mall_image_urls_in_list(&state.storage, &mut orders).await?;
    Ok(ok("查询成功", orders))
}

async fn admin_list_orders<S>(
    State(state): State<AppState<S>>,
    Query(query): Query<OrderQuery>,
) -> ApiResult<Json<ApiEnvelope<Vec<Value>>>>
where
    S: Storage,
{
    let mut orders = fetch_orders(&state.db, None, &query, true).await?;
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
    let procurement_buyer_ids = body.procurement_buyer_ids.clone();
    let qualification_reports = body.qualification_reports.clone();
    let hide_supplier = body.hide_supplier;
    let name = require_non_empty(body.name, "商品名称不能为空")?;
    let sku = require_non_empty(body.sku, "SKU不能为空")?;
    let category_code = require_non_empty(body.category_code, "类目不能为空")?;
    let specification = require_non_empty(body.specification, "规格不能为空")?;
    let sale_method = require_non_empty(body.sale_method, "售卖方式不能为空")?;
    let supply_price_cents = body.supply_price_cents.unwrap_or(0);
    if supply_price_cents <= 0 {
        return Err(ApiError::BadRequest("进货价必须大于0".to_string()));
    }
    let price_cents = body.price_cents.unwrap_or(0);
    if price_cents <= 0 {
        return Err(ApiError::BadRequest("售价必须大于0".to_string()));
    }
    let stock = body.stock.unwrap_or(0);
    if stock < 0 {
        return Err(ApiError::BadRequest("库存不能小于0".to_string()));
    }
    let minimum_order_quantity = body.minimum_order_quantity.unwrap_or(1);
    validate_positive_i32(minimum_order_quantity, "最小起订量必须大于0")?;
    let product_status = body.status.clone().unwrap_or_else(|| "on_sale".to_string());
    ensure_category(&state.db, &category_code).await?;
    let tags = serde_json::to_value(body.tags.unwrap_or_default())
        .map_err(|err| ApiError::BadRequest(err.to_string()))?;
    validate_optional_non_negative_i32(body.stock_alert_threshold, "库存预警阈值不能小于0")?;
    validate_optional_non_negative_f64(body.length_cm, "长不能小于0")?;
    validate_optional_non_negative_f64(body.width_cm, "宽不能小于0")?;
    validate_optional_non_negative_f64(body.height_cm, "高不能小于0")?;
    validate_optional_non_negative_f64(body.volume_liters, "体积不能小于0")?;
    validate_optional_non_negative_f64(body.weight_kg, "重量不能小于0")?;
    let product_images =
        normalize_product_images(body.image_url.as_deref(), body.images.as_deref())?;
    let primary_image_url = primary_product_image_url(body.image_url.as_deref(), &product_images);
    let product_images_json = json!(product_images);
    let variant_defaults = ProductVariantDefaults {
        sku: sku.clone(),
        specification: specification.clone(),
        sale_method: sale_method.clone(),
        price_cents,
        original_price_cents: body.original_price_cents,
        supply_price_cents: Some(supply_price_cents),
        stock,
        minimum_order_quantity,
        status: product_status.clone(),
    };
    let variants = normalize_product_variants(body.variants.as_deref(), &variant_defaults)?;
    let display_variant = display_product_variant(&variants);
    let variant_stock = total_product_variant_stock(&variants);
    let variants_json =
        serde_json::to_value(&variants).map_err(|err| ApiError::BadRequest(err.to_string()))?;

    let product_id = sqlx::query_scalar::<_, String>(
        r#"
        INSERT INTO mall_products (
          category_id, category_code, sku, name, subtitle, description, image_url, images, variants, specification, sale_method,
          supply_price_cents, price_cents, original_price_cents, stock, status, tags, delivery_minutes,
          cold_chain_required, length_cm, width_cm, height_cm, volume_liters,
          weight_kg, stock_alert_threshold, minimum_order_quantity
        )
        VALUES (
          (SELECT id FROM mall_categories WHERE code = $1),
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
          $15, $16, COALESCE($17, 18), COALESCE($18, false),
          $19, $20, $21, $22, $23, COALESCE($24, 15), $25
        )
        RETURNING id
        "#,
    )
    .bind(category_code)
    .bind(sku)
    .bind(name)
    .bind(body.subtitle)
    .bind(body.description)
    .bind(primary_image_url)
    .bind(product_images_json)
    .bind(variants_json)
    .bind(&display_variant.specification)
    .bind(&display_variant.sale_method)
    .bind(display_variant.supply_price_cents)
    .bind(display_variant.price_cents)
    .bind(display_variant.original_price_cents)
    .bind(variant_stock)
    .bind(product_status)
    .bind(tags)
    .bind(body.delivery_minutes)
    .bind(body.cold_chain_required)
    .bind(body.length_cm)
    .bind(body.width_cm)
    .bind(body.height_cm)
    .bind(body.volume_liters)
    .bind(body.weight_kg)
    .bind(body.stock_alert_threshold)
    .bind(display_variant.minimum_order_quantity)
    .fetch_one(&state.db)
    .await?;

    sync_product_procurement(
        &state.db,
        &product_id,
        procurement_buyer_ids.as_deref(),
        qualification_reports.as_deref(),
        hide_supplier,
    )
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
    let procurement_buyer_ids = body.procurement_buyer_ids.clone();
    let qualification_reports = body.qualification_reports.clone();
    let hide_supplier = body.hide_supplier;
    if let Some(category_code) = body.category_code.as_deref() {
        ensure_category(&state.db, category_code).await?;
    }
    let mut specification = optional_non_empty(body.specification, "规格不能为空")?;
    let mut sale_method = optional_non_empty(body.sale_method, "售卖方式不能为空")?;
    validate_optional_non_negative_i64(body.supply_price_cents, "供货价不能小于0")?;
    validate_optional_non_negative_i32(body.stock_alert_threshold, "库存预警阈值不能小于0")?;
    validate_optional_non_negative_f64(body.length_cm, "长不能小于0")?;
    validate_optional_non_negative_f64(body.width_cm, "宽不能小于0")?;
    validate_optional_non_negative_f64(body.height_cm, "高不能小于0")?;
    validate_optional_non_negative_f64(body.volume_liters, "体积不能小于0")?;
    validate_optional_non_negative_f64(body.weight_kg, "重量不能小于0")?;
    if let Some(minimum_order_quantity) = body.minimum_order_quantity {
        validate_positive_i32(minimum_order_quantity, "最小起订量必须大于0")?;
    }
    let image_url_provided = normalize_product_image_value(body.image_url.as_deref()).is_some();
    let replace_image_url = body.images.is_some();
    let product_images = if body.images.is_some() || image_url_provided {
        Some(normalize_product_images(
            body.image_url.as_deref(),
            body.images.as_deref(),
        )?)
    } else {
        None
    };
    let primary_image_url = product_images
        .as_ref()
        .and_then(|images| primary_product_image_url(body.image_url.as_deref(), images));
    let product_images_json = product_images.as_ref().map(|images| json!(images));
    let mut supply_price_cents = body.supply_price_cents;
    let mut price_cents = body.price_cents;
    let mut original_price_cents = body.original_price_cents;
    let mut stock = body.stock;
    let mut minimum_order_quantity = body.minimum_order_quantity;
    let variants_json = if let Some(variants) = body.variants.as_deref() {
        let variant_defaults = ProductVariantDefaults {
            sku: body
                .sku
                .clone()
                .unwrap_or_else(|| format!("{}-DEFAULT", id)),
            specification: specification
                .clone()
                .or_else(|| body.subtitle.clone())
                .unwrap_or_else(|| "默认规格".to_string()),
            sale_method: sale_method
                .clone()
                .or_else(|| specification.clone())
                .unwrap_or_else(|| "按份".to_string()),
            price_cents: body.price_cents.unwrap_or(0),
            original_price_cents: body.original_price_cents,
            supply_price_cents: body.supply_price_cents,
            stock: body.stock.unwrap_or(0),
            minimum_order_quantity: body.minimum_order_quantity.unwrap_or(1),
            status: body.status.clone().unwrap_or_else(|| "on_sale".to_string()),
        };
        let normalized_variants = normalize_product_variants(Some(variants), &variant_defaults)?;
        let display_variant = display_product_variant(&normalized_variants);
        specification = Some(display_variant.specification.clone());
        sale_method = Some(display_variant.sale_method.clone());
        supply_price_cents = display_variant.supply_price_cents;
        price_cents = Some(display_variant.price_cents);
        original_price_cents = display_variant.original_price_cents;
        stock = Some(total_product_variant_stock(&normalized_variants));
        minimum_order_quantity = Some(display_variant.minimum_order_quantity);
        Some(
            serde_json::to_value(&normalized_variants)
                .map_err(|err| ApiError::BadRequest(err.to_string()))?,
        )
    } else {
        None
    };
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
            image_url = CASE WHEN $26 THEN $7 ELSE COALESCE($7, image_url) END,
            images = COALESCE($8, images),
            variants = COALESCE($27, variants),
            specification = COALESCE($9, specification),
            sale_method = COALESCE($10, sale_method),
            supply_price_cents = COALESCE($11, supply_price_cents),
            price_cents = COALESCE($12, price_cents),
            original_price_cents = COALESCE($13, original_price_cents),
            stock = COALESCE($14, stock),
            status = COALESCE($15, status),
            tags = COALESCE($16, tags),
            delivery_minutes = COALESCE($17, delivery_minutes),
            cold_chain_required = COALESCE($18, cold_chain_required),
            length_cm = COALESCE($19, length_cm),
            width_cm = COALESCE($20, width_cm),
            height_cm = COALESCE($21, height_cm),
            volume_liters = COALESCE($22, volume_liters),
            weight_kg = COALESCE($23, weight_kg),
            stock_alert_threshold = COALESCE($24, stock_alert_threshold),
            minimum_order_quantity = COALESCE($25, minimum_order_quantity),
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
    .bind(primary_image_url)
    .bind(product_images_json)
    .bind(specification)
    .bind(sale_method)
    .bind(supply_price_cents)
    .bind(price_cents)
    .bind(original_price_cents)
    .bind(stock)
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
    .bind(minimum_order_quantity)
    .bind(replace_image_url)
    .bind(variants_json)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| ApiError::NotFound("商品不存在".to_string()))?;

    sync_product_procurement(
        &state.db,
        &product_id,
        procurement_buyer_ids.as_deref(),
        qualification_reports.as_deref(),
        hide_supplier,
    )
    .await?;

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

async fn admin_update_order_weight_adjustment<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
    Json(body): Json<WeightAdjustmentRequest>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    apply_weight_adjustment(&state.db, &id, body).await?;
    let mut order = fetch_order_detail(&state.db, &id).await?;
    resolve_mall_image_urls(&state.storage, &mut order).await?;
    Ok(ok("称重改价成功", order))
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

async fn admin_list_after_sales<S>(
    State(state): State<AppState<S>>,
    Query(query): Query<AdminAfterSaleQuery>,
) -> ApiResult<Json<ApiEnvelope<Vec<Value>>>>
where
    S: Storage,
{
    let mut builder = QueryBuilder::<Postgres>::new(
        r#"
        SELECT jsonb_build_object(
          'id', sale.id,
          'orderId', sale.order_id,
          'orderNo', orders.order_no,
          'userId', sale.user_id,
          'userPhone', users.phone,
          'recipientName', orders.recipient_name,
          'recipientPhone', orders.recipient_phone,
          'productName', first_item.product_name,
          'reason', sale.reason,
          'description', sale.description,
          'amountCents', sale.amount_cents,
          'evidenceImages', sale.evidence_images,
          'status', sale.status,
          'handlingMethod', sale.handling_method,
          'createdAt', sale.created_at,
          'updatedAt', sale.updated_at
        )
        FROM mall_after_sales sale
        JOIN mall_orders orders ON orders.id = sale.order_id
        LEFT JOIN users ON users.id = sale.user_id
        LEFT JOIN LATERAL (
          SELECT item.product_name
          FROM mall_order_items item
          WHERE item.order_id = sale.order_id
          ORDER BY item.created_at ASC
          LIMIT 1
        ) first_item ON true
        WHERE 1 = 1
        "#,
    );

    if let Some(keyword) = query
        .keyword
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
    {
        let pattern = format!("%{}%", keyword);
        builder.push(" AND (lower(orders.order_no) LIKE lower(");
        builder.push_bind(pattern.clone());
        builder.push(") OR lower(COALESCE(users.phone, '')) LIKE lower(");
        builder.push_bind(pattern.clone());
        builder.push(") OR lower(COALESCE(orders.recipient_phone, '')) LIKE lower(");
        builder.push_bind(pattern.clone());
        builder.push(") OR lower(COALESCE(orders.recipient_name, '')) LIKE lower(");
        builder.push_bind(pattern.clone());
        builder.push(") OR lower(COALESCE(first_item.product_name, '')) LIKE lower(");
        builder.push_bind(pattern.clone());
        builder.push(") OR lower(sale.reason) LIKE lower(");
        builder.push_bind(pattern.clone());
        builder.push(") OR lower(COALESCE(sale.description, '')) LIKE lower(");
        builder.push_bind(pattern);
        builder.push("))");
    }

    if let Some(status) = query
        .status
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
    {
        builder.push(" AND sale.status = ");
        builder.push_bind(status);
    }

    if let Some(start_date) = query
        .start_date
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
    {
        builder.push(" AND sale.created_at >= ");
        builder.push_bind(start_date);
        builder.push("::date");
    }

    if let Some(end_date) = query
        .end_date
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
    {
        builder.push(" AND sale.created_at < (");
        builder.push_bind(end_date);
        builder.push("::date + INTERVAL '1 day')");
    }

    builder.push(" ORDER BY sale.created_at DESC LIMIT 200");
    let rows = builder
        .build_query_scalar::<Value>()
        .fetch_all(&state.db)
        .await?;
    Ok(ok("查询成功", rows))
}

async fn admin_update_after_sale<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
    Json(body): Json<UpdateAfterSaleRequest>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    if let Some(status) = body.status.as_deref() {
        validate_after_sale_status(status)?;
    }

    let handling_method = non_empty(body.handling_method);
    let resolution = non_empty(body.resolution);
    let after_sale = sqlx::query_scalar::<_, Value>(
        r#"
        WITH updated AS (
          UPDATE mall_after_sales
          SET status = COALESCE($2, status),
              handling_method = COALESCE($3, handling_method),
              description = COALESCE($4, description),
              updated_at = now()
          WHERE id = $1
          RETURNING *
        )
        SELECT jsonb_build_object(
          'id', sale.id,
          'orderId', sale.order_id,
          'orderNo', orders.order_no,
          'userId', sale.user_id,
          'userPhone', users.phone,
          'recipientName', orders.recipient_name,
          'recipientPhone', orders.recipient_phone,
          'productName', first_item.product_name,
          'reason', sale.reason,
          'description', sale.description,
          'amountCents', sale.amount_cents,
          'evidenceImages', sale.evidence_images,
          'status', sale.status,
          'handlingMethod', sale.handling_method,
          'createdAt', sale.created_at,
          'updatedAt', sale.updated_at
        )
        FROM updated sale
        JOIN mall_orders orders ON orders.id = sale.order_id
        LEFT JOIN users ON users.id = sale.user_id
        LEFT JOIN LATERAL (
          SELECT item.product_name
          FROM mall_order_items item
          WHERE item.order_id = sale.order_id
          ORDER BY item.created_at ASC
          LIMIT 1
        ) first_item ON true
        "#,
    )
    .bind(&id)
    .bind(body.status.as_deref())
    .bind(handling_method)
    .bind(resolution.clone())
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| ApiError::NotFound("售后申请不存在".to_string()))?;

    if let Some(status) = body.status.as_deref() {
        let order_id = after_sale
            .get("orderId")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string();
        let refund_status = refund_status_for_after_sale(status);
        let after_sale_status = order_after_sale_status(status);
        sqlx::query(
            r#"
            UPDATE mall_orders
            SET refund_status = COALESCE($2, refund_status),
                after_sale_status = $3,
                updated_at = now()
            WHERE id = $1
            "#,
        )
        .bind(&order_id)
        .bind(refund_status)
        .bind(after_sale_status)
        .execute(&state.db)
        .await?;

        insert_order_event(
            &state.db,
            &order_id,
            status,
            after_sale_status_title(status),
            resolution
                .as_deref()
                .unwrap_or_else(|| after_sale_status_title(status)),
            if matches!(status, "refunded" | "rejected" | "closed" | "resolved") {
                "done"
            } else {
                "active"
            },
        )
        .await?;
    }

    Ok(ok("售后申请处理成功", after_sale))
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
    Query(query): Query<CampaignQuery>,
) -> ApiResult<Json<ApiEnvelope<Vec<Value>>>>
where
    S: Storage,
{
    let mut builder =
        QueryBuilder::<Postgres>::new("SELECT campaign_json(c) FROM mall_campaigns c WHERE 1 = 1");

    if let Some(keyword) = query
        .keyword
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
    {
        let pattern = format!("%{}%", keyword);
        builder.push(" AND (lower(c.name) LIKE lower(");
        builder.push_bind(pattern.clone());
        builder.push(") OR lower(c.campaign_type) LIKE lower(");
        builder.push_bind(pattern);
        builder.push("))");
    }

    if let Some(status) = query
        .status
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
    {
        builder.push(" AND c.status = ");
        builder.push_bind(status);
    } else {
        builder.push(" AND c.status <> 'deleted'");
    }

    if let Some(campaign_type) = query
        .campaign_type
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
    {
        builder.push(" AND c.campaign_type = ");
        builder.push_bind(campaign_type);
    }

    let limit = query.page_size.unwrap_or(200).clamp(1, 500);
    builder.push(" ORDER BY c.created_at DESC LIMIT ");
    builder.push_bind(limit);
    let campaigns = builder
        .build_query_scalar::<Value>()
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

async fn delete_campaign<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let campaign = sqlx::query_scalar::<_, Value>(
        r#"
        UPDATE mall_campaigns
        SET status = 'deleted', updated_at = now()
        WHERE id = $1
        RETURNING campaign_json(mall_campaigns)
        "#,
    )
    .bind(&id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| ApiError::NotFound("活动不存在".to_string()))?;

    Ok(ok("活动删除成功", campaign))
}

async fn admin_list_coupons<S>(
    State(state): State<AppState<S>>,
    Query(query): Query<CouponQuery>,
) -> ApiResult<Json<ApiEnvelope<Vec<Value>>>>
where
    S: Storage,
{
    let mut builder =
        QueryBuilder::<Postgres>::new("SELECT coupon_json(c) FROM mall_coupons c WHERE 1 = 1");

    if let Some(keyword) = query
        .keyword
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
    {
        let pattern = format!("%{}%", keyword);
        builder.push(" AND (lower(c.name) LIKE lower(");
        builder.push_bind(pattern.clone());
        builder.push(") OR lower(c.code) LIKE lower(");
        builder.push_bind(pattern);
        builder.push("))");
    }

    if let Some(status) = query
        .status
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
    {
        builder.push(" AND c.status = ");
        builder.push_bind(status);
    } else {
        builder.push(" AND c.status <> 'deleted'");
    }

    if let Some(coupon_type) = query
        .coupon_type
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
    {
        builder.push(" AND c.coupon_type = ");
        builder.push_bind(coupon_type);
    }

    builder.push(" ORDER BY c.created_at DESC LIMIT 200");
    let coupons = builder
        .build_query_scalar::<Value>()
        .fetch_all(&state.db)
        .await?;
    Ok(ok("查询成功", coupons))
}

async fn admin_get_coupon<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let coupon = sqlx::query_scalar::<_, Value>(
        r#"
        SELECT coupon_json(c)
        FROM mall_coupons c
        WHERE c.id = $1
        "#,
    )
    .bind(&id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| ApiError::NotFound("优惠券不存在".to_string()))?;

    Ok(ok("查询成功", coupon))
}

async fn admin_create_coupon<S>(
    State(state): State<AppState<S>>,
    Json(body): Json<CouponMutationRequest>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let name = require_non_empty(body.name, "优惠券名称不能为空")?;
    let code = normalize_coupon_code(&require_non_empty(body.code, "优惠券编码不能为空")?);
    let coupon_type = non_empty(body.coupon_type).unwrap_or_else(|| "full_reduction".to_string());
    validate_coupon_type(&coupon_type)?;
    validate_coupon_status(body.status.as_deref().unwrap_or("draft"))?;
    validate_non_negative_i64(body.threshold_cents.unwrap_or(0), "使用门槛不能小于 0")?;
    validate_positive_i64(body.discount_cents.unwrap_or(0), "优惠金额必须大于 0")?;
    validate_non_negative_i32(body.total_quantity.unwrap_or(0), "发放数量不能小于 0")?;
    validate_positive_i32(body.per_user_limit.unwrap_or(1), "每人限领必须大于 0")?;

    let starts_at = non_empty(body.starts_at);
    let ends_at = non_empty(body.ends_at);
    let coupon = sqlx::query_scalar::<_, Value>(
        r#"
        INSERT INTO mall_coupons (
          name, code, coupon_type, threshold_cents, discount_cents, total_quantity,
          per_user_limit, description, rules, status, starts_at, ends_at
        )
        VALUES (
          $1, $2, $3, COALESCE($4, 0), COALESCE($5, 0), COALESCE($6, 0),
          COALESCE($7, 1), $8, COALESCE($9, '{}'::jsonb), COALESCE($10, 'draft'),
          $11::timestamptz, $12::timestamptz
        )
        RETURNING coupon_json(mall_coupons)
        "#,
    )
    .bind(name)
    .bind(code)
    .bind(coupon_type)
    .bind(body.threshold_cents)
    .bind(body.discount_cents)
    .bind(body.total_quantity)
    .bind(body.per_user_limit)
    .bind(non_empty(body.description))
    .bind(body.rules)
    .bind(body.status)
    .bind(starts_at)
    .bind(ends_at)
    .fetch_one(&state.db)
    .await?;

    Ok(ok("优惠券创建成功", coupon))
}

async fn admin_update_coupon<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
    Json(body): Json<CouponMutationRequest>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    if let Some(coupon_type) = body.coupon_type.as_deref() {
        validate_coupon_type(coupon_type)?;
    }
    if let Some(status) = body.status.as_deref() {
        validate_coupon_status(status)?;
    }
    if let Some(threshold_cents) = body.threshold_cents {
        validate_non_negative_i64(threshold_cents, "使用门槛不能小于 0")?;
    }
    if let Some(discount_cents) = body.discount_cents {
        validate_positive_i64(discount_cents, "优惠金额必须大于 0")?;
    }
    validate_optional_non_negative_i32(body.total_quantity, "发放数量不能小于 0")?;
    if let Some(per_user_limit) = body.per_user_limit {
        validate_positive_i32(per_user_limit, "每人限领必须大于 0")?;
    }

    let name = optional_non_empty(body.name, "优惠券名称不能为空")?;
    let code = match body.code {
        Some(code) => Some(normalize_coupon_code(&require_non_empty(
            Some(code),
            "优惠券编码不能为空",
        )?)),
        None => None,
    };
    let starts_at = non_empty(body.starts_at);
    let ends_at = non_empty(body.ends_at);

    let coupon = sqlx::query_scalar::<_, Value>(
        r#"
        UPDATE mall_coupons
        SET name = COALESCE($2, name),
            code = COALESCE($3, code),
            coupon_type = COALESCE($4, coupon_type),
            threshold_cents = COALESCE($5, threshold_cents),
            discount_cents = COALESCE($6, discount_cents),
            total_quantity = COALESCE($7, total_quantity),
            per_user_limit = COALESCE($8, per_user_limit),
            description = COALESCE($9, description),
            rules = COALESCE($10, rules),
            status = COALESCE($11, status),
            starts_at = COALESCE($12::timestamptz, starts_at),
            ends_at = COALESCE($13::timestamptz, ends_at),
            updated_at = now()
        WHERE id = $1
        RETURNING coupon_json(mall_coupons)
        "#,
    )
    .bind(&id)
    .bind(name)
    .bind(code)
    .bind(body.coupon_type)
    .bind(body.threshold_cents)
    .bind(body.discount_cents)
    .bind(body.total_quantity)
    .bind(body.per_user_limit)
    .bind(non_empty(body.description))
    .bind(body.rules)
    .bind(body.status)
    .bind(starts_at)
    .bind(ends_at)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| ApiError::NotFound("优惠券不存在".to_string()))?;

    Ok(ok("优惠券更新成功", coupon))
}

async fn admin_delete_coupon<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let coupon = sqlx::query_scalar::<_, Value>(
        r#"
        UPDATE mall_coupons
        SET status = 'deleted', updated_at = now()
        WHERE id = $1
        RETURNING coupon_json(mall_coupons)
        "#,
    )
    .bind(&id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| ApiError::NotFound("优惠券不存在".to_string()))?;

    Ok(ok("优惠券删除成功", coupon))
}

async fn list_home_banners<S>(
    State(state): State<AppState<S>>,
) -> ApiResult<Json<ApiEnvelope<Vec<Value>>>>
where
    S: Storage,
{
    let mut banners = sqlx::query_scalar::<_, Value>(
        r#"
        SELECT home_banner_json(b)
        FROM mall_home_banners b
        WHERE b.status = 'active'
          AND (b.starts_at IS NULL OR b.starts_at <= now())
          AND (b.ends_at IS NULL OR b.ends_at >= now())
        ORDER BY b.sort_order ASC, b.created_at DESC
        "#,
    )
    .fetch_all(&state.db)
    .await?;
    resolve_mall_image_urls_in_list(&state.storage, &mut banners).await?;

    Ok(ok("查询成功", banners))
}

async fn admin_list_home_banners<S>(
    State(state): State<AppState<S>>,
    Query(query): Query<HomeBannerQuery>,
) -> ApiResult<Json<ApiEnvelope<Vec<Value>>>>
where
    S: Storage,
{
    let mut builder = QueryBuilder::<Postgres>::new(
        "SELECT home_banner_json(b) FROM mall_home_banners b WHERE 1 = 1",
    );

    if let Some(keyword) = query
        .keyword
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
    {
        let pattern = format!("%{}%", keyword);
        builder.push(" AND (lower(b.title) LIKE lower(");
        builder.push_bind(pattern.clone());
        builder.push(") OR lower(COALESCE(b.subtitle, '')) LIKE lower(");
        builder.push_bind(pattern);
        builder.push("))");
    }

    if let Some(status) = query
        .status
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
    {
        builder.push(" AND b.status = ");
        builder.push_bind(status);
    }

    builder.push(" ORDER BY b.sort_order ASC, b.created_at DESC LIMIT 100");
    let banners = builder
        .build_query_scalar::<Value>()
        .fetch_all(&state.db)
        .await?;
    Ok(ok("查询成功", banners))
}

async fn admin_get_home_banner<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let banner = sqlx::query_scalar::<_, Value>(
        r#"
        SELECT home_banner_json(b)
        FROM mall_home_banners b
        WHERE b.id = $1
        "#,
    )
    .bind(&id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| ApiError::NotFound("首页配置不存在".to_string()))?;

    Ok(ok("查询成功", banner))
}

async fn admin_create_home_banner<S>(
    State(state): State<AppState<S>>,
    Json(body): Json<HomeBannerMutationRequest>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let title = require_non_empty(body.title, "标题不能为空")?;
    let link_type = non_empty(body.link_type).unwrap_or_else(|| "none".to_string());
    validate_home_banner_link_type(&link_type)?;
    validate_home_banner_status(body.status.as_deref().unwrap_or("draft"))?;

    let banner = sqlx::query_scalar::<_, Value>(
        r#"
        INSERT INTO mall_home_banners (
          title, subtitle, image_url, link_type, link_target, sort_order,
          status, starts_at, ends_at, metadata
        )
        VALUES (
          $1, $2, $3, $4, $5, COALESCE($6, 0), COALESCE($7, 'draft'),
          $8::timestamptz, $9::timestamptz, COALESCE($10, '{}'::jsonb)
        )
        RETURNING home_banner_json(mall_home_banners)
        "#,
    )
    .bind(title)
    .bind(non_empty(body.subtitle))
    .bind(non_empty(body.image_url))
    .bind(link_type)
    .bind(non_empty(body.link_target))
    .bind(body.sort_order)
    .bind(body.status)
    .bind(non_empty(body.starts_at))
    .bind(non_empty(body.ends_at))
    .bind(body.metadata)
    .fetch_one(&state.db)
    .await?;

    Ok(ok("首页配置创建成功", banner))
}

async fn admin_update_home_banner<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
    Json(body): Json<HomeBannerMutationRequest>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    if let Some(link_type) = body.link_type.as_deref() {
        validate_home_banner_link_type(link_type)?;
    }
    if let Some(status) = body.status.as_deref() {
        validate_home_banner_status(status)?;
    }

    let title = optional_non_empty(body.title, "标题不能为空")?;
    let banner = sqlx::query_scalar::<_, Value>(
        r#"
        UPDATE mall_home_banners
        SET title = COALESCE($2, title),
            subtitle = COALESCE($3, subtitle),
            image_url = COALESCE($4, image_url),
            link_type = COALESCE($5, link_type),
            link_target = COALESCE($6, link_target),
            sort_order = COALESCE($7, sort_order),
            status = COALESCE($8, status),
            starts_at = COALESCE($9::timestamptz, starts_at),
            ends_at = COALESCE($10::timestamptz, ends_at),
            metadata = COALESCE($11, metadata),
            updated_at = now()
        WHERE id = $1
        RETURNING home_banner_json(mall_home_banners)
        "#,
    )
    .bind(&id)
    .bind(title)
    .bind(non_empty(body.subtitle))
    .bind(non_empty(body.image_url))
    .bind(body.link_type)
    .bind(non_empty(body.link_target))
    .bind(body.sort_order)
    .bind(body.status)
    .bind(non_empty(body.starts_at))
    .bind(non_empty(body.ends_at))
    .bind(body.metadata)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| ApiError::NotFound("首页配置不存在".to_string()))?;

    Ok(ok("首页配置更新成功", banner))
}

async fn list_home_sections<S>(
    State(state): State<AppState<S>>,
) -> ApiResult<Json<ApiEnvelope<Vec<Value>>>>
where
    S: Storage,
{
    let sections = sqlx::query_scalar::<_, Value>(
        r#"
        SELECT home_section_json(s)
        FROM mall_home_sections s
        WHERE s.status = 'active'
          AND (s.starts_at IS NULL OR s.starts_at <= now())
          AND (s.ends_at IS NULL OR s.ends_at >= now())
        ORDER BY s.section_type ASC, s.sort_order ASC, s.created_at DESC
        "#,
    )
    .fetch_all(&state.db)
    .await?;

    Ok(ok("查询成功", sections))
}

async fn admin_list_home_sections<S>(
    State(state): State<AppState<S>>,
    Query(query): Query<HomeSectionQuery>,
) -> ApiResult<Json<ApiEnvelope<Vec<Value>>>>
where
    S: Storage,
{
    let mut builder = QueryBuilder::<Postgres>::new(
        "SELECT home_section_json(s) FROM mall_home_sections s WHERE 1 = 1",
    );

    if let Some(keyword) = query
        .keyword
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
    {
        let pattern = format!("%{}%", keyword);
        builder.push(" AND (lower(s.title) LIKE lower(");
        builder.push_bind(pattern.clone());
        builder.push(") OR lower(COALESCE(s.subtitle, '')) LIKE lower(");
        builder.push_bind(pattern.clone());
        builder.push(") OR lower(COALESCE(s.content, '')) LIKE lower(");
        builder.push_bind(pattern);
        builder.push("))");
    }

    if let Some(status) = query
        .status
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
    {
        builder.push(" AND s.status = ");
        builder.push_bind(status);
    } else {
        builder.push(" AND s.status <> 'deleted'");
    }

    if let Some(section_type) = query
        .section_type
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
    {
        builder.push(" AND s.section_type = ");
        builder.push_bind(section_type);
    }

    builder.push(" ORDER BY s.section_type ASC, s.sort_order ASC, s.created_at DESC LIMIT 200");
    let sections = builder
        .build_query_scalar::<Value>()
        .fetch_all(&state.db)
        .await?;

    Ok(ok("查询成功", sections))
}

async fn admin_get_home_section<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let section = sqlx::query_scalar::<_, Value>(
        r#"
        SELECT home_section_json(s)
        FROM mall_home_sections s
        WHERE s.id = $1
        "#,
    )
    .bind(&id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| ApiError::NotFound("首页专区配置不存在".to_string()))?;

    Ok(ok("查询成功", section))
}

async fn admin_create_home_section<S>(
    State(state): State<AppState<S>>,
    Json(body): Json<HomeSectionMutationRequest>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let section_type = require_non_empty(body.section_type, "配置类型不能为空")?;
    validate_home_section_type(&section_type)?;
    let title = require_non_empty(body.title, "标题不能为空")?;
    let link_type = non_empty(body.link_type).unwrap_or_else(|| "none".to_string());
    validate_home_banner_link_type(&link_type)?;
    validate_home_banner_status(body.status.as_deref().unwrap_or("draft"))?;

    let section = sqlx::query_scalar::<_, Value>(
        r#"
        INSERT INTO mall_home_sections (
          section_type, title, subtitle, content, image_url, link_type, link_target,
          product_ids, rules, sort_order, status, starts_at, ends_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          COALESCE($8, '[]'::jsonb), COALESCE($9, '{}'::jsonb), COALESCE($10, 0), COALESCE($11, 'draft'),
          $12::timestamptz, $13::timestamptz
        )
        RETURNING home_section_json(mall_home_sections)
        "#,
    )
    .bind(section_type)
    .bind(title)
    .bind(non_empty(body.subtitle))
    .bind(non_empty(body.content))
    .bind(non_empty(body.image_url))
    .bind(link_type)
    .bind(non_empty(body.link_target))
    .bind(body.product_ids)
    .bind(body.rules)
    .bind(body.sort_order)
    .bind(body.status)
    .bind(non_empty(body.starts_at))
    .bind(non_empty(body.ends_at))
    .fetch_one(&state.db)
    .await?;

    Ok(ok("首页专区配置创建成功", section))
}

async fn admin_update_home_section<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
    Json(body): Json<HomeSectionMutationRequest>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    if let Some(section_type) = body.section_type.as_deref() {
        validate_home_section_type(section_type)?;
    }
    if let Some(link_type) = body.link_type.as_deref() {
        validate_home_banner_link_type(link_type)?;
    }
    if let Some(status) = body.status.as_deref() {
        validate_home_banner_status(status)?;
    }

    let title = optional_non_empty(body.title, "标题不能为空")?;
    let section = sqlx::query_scalar::<_, Value>(
        r#"
        UPDATE mall_home_sections
        SET section_type = COALESCE($2, section_type),
            title = COALESCE($3, title),
            subtitle = COALESCE($4, subtitle),
            content = COALESCE($5, content),
            image_url = COALESCE($6, image_url),
            link_type = COALESCE($7, link_type),
            link_target = COALESCE($8, link_target),
            product_ids = COALESCE($9, product_ids),
            rules = COALESCE($10, rules),
            sort_order = COALESCE($11, sort_order),
            status = COALESCE($12, status),
            starts_at = COALESCE($13::timestamptz, starts_at),
            ends_at = COALESCE($14::timestamptz, ends_at),
            updated_at = now()
        WHERE id = $1
        RETURNING home_section_json(mall_home_sections)
        "#,
    )
    .bind(&id)
    .bind(body.section_type)
    .bind(title)
    .bind(non_empty(body.subtitle))
    .bind(non_empty(body.content))
    .bind(non_empty(body.image_url))
    .bind(body.link_type)
    .bind(non_empty(body.link_target))
    .bind(body.product_ids)
    .bind(body.rules)
    .bind(body.sort_order)
    .bind(body.status)
    .bind(non_empty(body.starts_at))
    .bind(non_empty(body.ends_at))
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| ApiError::NotFound("首页专区配置不存在".to_string()))?;

    Ok(ok("首页专区配置更新成功", section))
}

async fn admin_delete_home_section<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let section = sqlx::query_scalar::<_, Value>(
        r#"
        UPDATE mall_home_sections
        SET status = 'deleted', updated_at = now()
        WHERE id = $1
        RETURNING home_section_json(mall_home_sections)
        "#,
    )
    .bind(&id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| ApiError::NotFound("首页专区配置不存在".to_string()))?;

    Ok(ok("首页专区配置删除成功", section))
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
          roles, risk_thresholds, delivery_rules, payment_split_rules
        )
        VALUES (
          'default',
          COALESCE($1, 9900),
          COALESCE($2, 600),
          COALESCE($3, 18),
          COALESCE($4, true),
          COALESCE($5, 10),
          COALESCE($6, '{}'::jsonb),
          COALESCE($7, '{}'::jsonb),
          COALESCE($8, '{
            "pickupWindowStart": "16:00",
            "pickupWindowEnd": "20:00",
            "deliveryBatchTimes": "10:00,14:00,18:00",
            "deliveryFeeCents": 600,
            "freeDeliveryThresholdCents": 9900,
            "coldChainRequired": true,
            "refundReviewMinutes": 10
          }'::jsonb),
          COALESCE($9, '{
            "leaderCommissionRate": 8,
            "platformServiceRate": 3,
            "supplierSettlementCycle": "T+7",
            "withdrawMinCents": 10000
          }'::jsonb)
        )
        ON CONFLICT (id) DO UPDATE
        SET free_delivery_threshold_cents = COALESCE($1, mall_operation_settings.free_delivery_threshold_cents),
                      default_delivery_fee_cents = COALESCE($2, mall_operation_settings.default_delivery_fee_cents),
                      delivery_promise_minutes = COALESCE($3, mall_operation_settings.delivery_promise_minutes),
                      cold_chain_enabled = COALESCE($4, mall_operation_settings.cold_chain_enabled),
                      refund_review_minutes = COALESCE($5, mall_operation_settings.refund_review_minutes),
                      roles = COALESCE($6, mall_operation_settings.roles),
                      risk_thresholds = COALESCE($7, mall_operation_settings.risk_thresholds),
                      delivery_rules = COALESCE($8, mall_operation_settings.delivery_rules),
                      payment_split_rules = COALESCE($9, mall_operation_settings.payment_split_rules),
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
    .bind(body.delivery_rules)
    .bind(body.payment_split_rules)
    .fetch_one(&state.db)
    .await?;

    Ok(ok("设置已保存", settings))
}

async fn admin_list_permissions<S>(
    State(state): State<AppState<S>>,
    Query(query): Query<PermissionQuery>,
) -> ApiResult<Json<ApiEnvelope<Vec<Value>>>>
where
    S: Storage,
{
    let permissions = filter_permission_records(read_permission_records(&state.db).await?, query)?;
    Ok(ok("查询成功", permissions))
}

async fn admin_create_permission<S>(
    State(state): State<AppState<S>>,
    Json(body): Json<PermissionMutationRequest>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let name = require_non_empty(body.name, "权限名称不能为空")?;
    let role_key = normalize_permission_key(&require_non_empty(body.role_key, "权限角色不能为空")?);
    let status = body.status.unwrap_or_else(|| "active".to_string());
    validate_permission_status(&status)?;
    let modules = normalize_permission_modules(body.modules)?;
    let actions = normalize_permission_actions(body.actions)?;
    let now = chrono::Utc::now().to_rfc3339();
    let permission = json!({
        "id": uuid::Uuid::new_v4().to_string(),
        "name": name,
        "roleKey": role_key,
        "description": non_empty(body.description).unwrap_or_default(),
        "modules": modules,
        "actions": actions,
        "status": status,
        "createdAt": now,
        "updatedAt": now,
    });

    let mut roles = fetch_roles_config(&state.db).await?;
    let mut permissions = permissions_from_roles(&roles);
    permissions.insert(0, permission.clone());
    persist_permissions(&state.db, &mut roles, permissions).await?;

    Ok(ok("权限创建成功", permission))
}

async fn admin_update_permission<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
    Json(body): Json<PermissionMutationRequest>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let mut roles = fetch_roles_config(&state.db).await?;
    let mut permissions = permissions_from_roles(&roles);
    let index = permissions
        .iter()
        .position(|permission| string_field(permission, "id") == id)
        .ok_or_else(|| ApiError::NotFound("权限不存在".to_string()))?;

    if let Some(status) = body.status.as_deref() {
        validate_permission_status(status)?;
    }
    let modules = match body.modules {
        Some(modules) => Some(normalize_permission_modules(Some(modules))?),
        None => None,
    };
    let actions = match body.actions {
        Some(actions) => Some(normalize_permission_actions(Some(actions))?),
        None => None,
    };

    let mut permission = permissions[index].clone();
    if !permission.is_object() {
        permission = json!({});
    }
    let object = permission
        .as_object_mut()
        .ok_or_else(|| ApiError::BadRequest("权限数据格式不正确".to_string()))?;
    if let Some(name) = optional_non_empty(body.name, "权限名称不能为空")? {
        object.insert("name".to_string(), json!(name));
    }
    if let Some(role_key) = optional_non_empty(body.role_key, "权限角色不能为空")? {
        object.insert(
            "roleKey".to_string(),
            json!(normalize_permission_key(&role_key)),
        );
    }
    if let Some(description) = body.description {
        object.insert("description".to_string(), json!(description.trim()));
    }
    if let Some(modules) = modules {
        object.insert("modules".to_string(), json!(modules));
    }
    if let Some(actions) = actions {
        object.insert("actions".to_string(), json!(actions));
    }
    if let Some(status) = body.status {
        object.insert("status".to_string(), json!(status));
    }
    object.insert(
        "updatedAt".to_string(),
        json!(chrono::Utc::now().to_rfc3339()),
    );

    permissions[index] = permission.clone();
    persist_permissions(&state.db, &mut roles, permissions).await?;

    Ok(ok("权限更新成功", permission))
}

async fn admin_delete_permission<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let mut roles = fetch_roles_config(&state.db).await?;
    let permissions = permissions_from_roles(&roles);
    let original_len = permissions.len();
    let next_permissions: Vec<Value> = permissions
        .into_iter()
        .filter(|permission| string_field(permission, "id") != id)
        .collect();
    if next_permissions.len() == original_len {
        return Err(ApiError::NotFound("权限不存在".to_string()));
    }

    persist_permissions(&state.db, &mut roles, next_permissions).await?;
    Ok(ok("权限删除成功", json!({ "id": id, "deleted": true })))
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

async fn admin_ops_overview<S>(
    State(state): State<AppState<S>>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let overview = sqlx::query_scalar::<_, Value>(
        r#"
        SELECT jsonb_build_object(
          'onSaleProducts', (SELECT count(*) FROM mall_products WHERE status = 'on_sale'),
          'stockAlerts', (SELECT count(*) FROM mall_products WHERE stock <= stock_alert_threshold),
          'pendingListingRequests', (SELECT count(*) FROM mall_product_listing_requests WHERE status = 'pending'),
          'todayOrders', (SELECT count(*) FROM mall_orders WHERE created_at >= date_trunc('day', now())),
          'historyOrders', (SELECT count(*) FROM mall_orders),
          'exceptionOrders', (
            SELECT count(*) FROM mall_orders
            WHERE status = 'cancelled'
               OR refund_status IS NOT NULL
               OR after_sale_status IS NOT NULL
          ),
          'deliverySheets', (SELECT count(*) FROM mall_delivery_sheets WHERE sheet_date = CURRENT_DATE),
          'pendingWithdrawals', (SELECT count(*) FROM mall_withdrawal_requests WHERE status IN ('submitted', 'reviewing')),
          'todayRevenueCents', COALESCE((
            SELECT sum(payable_cents)
            FROM mall_orders
            WHERE payment_status = 'paid'
              AND created_at >= date_trunc('day', now())
          ), 0),
          'todaySupplyCents', COALESCE((
            SELECT sum(item.quantity * COALESCE(NULLIF(product.supply_price_cents, 0), item.unit_price_cents))
            FROM mall_order_items item
            JOIN mall_orders orders ON orders.id = item.order_id
            LEFT JOIN mall_products product ON product.id = item.product_id
            WHERE orders.payment_status = 'paid'
              AND orders.created_at >= date_trunc('day', now())
          ), 0)
        )
        "#,
    )
    .fetch_one(&state.db)
    .await?;

    Ok(ok("查询成功", overview))
}

async fn admin_list_product_listing_requests<S>(
    State(state): State<AppState<S>>,
    Query(query): Query<ProductListingRequestQuery>,
) -> ApiResult<Json<ApiEnvelope<Vec<Value>>>>
where
    S: Storage,
{
    let mut builder = QueryBuilder::<Postgres>::new(
        r#"
        SELECT jsonb_build_object(
          'id', request.id,
          'productId', request.product_id,
          'productName', product.name,
          'sku', product.sku,
          'currentStatus', product.status,
          'requestType', request.request_type,
          'requestedStatus', request.requested_status,
          'requesterId', request.requester_id,
          'requesterRole', request.requester_role,
          'supplierId', request.supplier_id,
          'reason', request.reason,
          'status', request.status,
          'reviewedBy', request.reviewed_by,
          'reviewedAt', request.reviewed_at,
          'reviewNote', request.review_note,
          'createdAt', request.created_at,
          'updatedAt', request.updated_at
        )
        FROM mall_product_listing_requests request
        LEFT JOIN mall_products product ON product.id = request.product_id
        WHERE 1 = 1
        "#,
    );

    if let Some(status) = non_empty(query.status) {
        builder.push(" AND request.status = ");
        builder.push_bind(status);
    }
    if let Some(product_id) = non_empty(query.product_id) {
        builder.push(" AND request.product_id = ");
        builder.push_bind(product_id);
    }
    if let Some(request_type) = non_empty(query.request_type) {
        builder.push(" AND request.request_type = ");
        builder.push_bind(request_type);
    }
    if let Some(supplier_id) = non_empty(query.supplier_id) {
        builder.push(" AND request.supplier_id = ");
        builder.push_bind(supplier_id);
    }
    builder.push(" ORDER BY request.created_at DESC LIMIT 100");

    Ok(ok(
        "查询成功",
        builder
            .build_query_scalar::<Value>()
            .fetch_all(&state.db)
            .await?,
    ))
}

async fn admin_create_product_listing_request<S>(
    State(state): State<AppState<S>>,
    Json(body): Json<ProductListingRequestMutation>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let product_id = require_non_empty(body.product_id, "商品ID不能为空")?;
    let requested_status = normalize_product_status(&require_non_empty(
        body.requested_status,
        "目标上下架状态不能为空",
    )?)?;
    ensure_product_exists(&state.db, &product_id).await?;

    let request_type = non_empty(body.request_type).unwrap_or_else(|| "status_change".to_string());
    validate_listing_request_type(&request_type)?;
    let requester_role = non_empty(body.requester_role).unwrap_or_else(|| "admin".to_string());
    validate_listing_requester_role(&requester_role)?;

    let request = sqlx::query_scalar::<_, Value>(
        r#"
        INSERT INTO mall_product_listing_requests (
          product_id, request_type, requested_status, requester_id, requester_role,
          supplier_id, reason, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
        RETURNING jsonb_build_object(
          'id', id,
          'productId', product_id,
          'requestType', request_type,
          'requestedStatus', requested_status,
          'requesterId', requester_id,
          'requesterRole', requester_role,
          'supplierId', supplier_id,
          'reason', reason,
          'status', status,
          'createdAt', created_at,
          'updatedAt', updated_at
        )
        "#,
    )
    .bind(product_id)
    .bind(request_type)
    .bind(requested_status)
    .bind(non_empty(body.requester_id))
    .bind(requester_role)
    .bind(non_empty(body.supplier_id))
    .bind(non_empty(body.reason))
    .fetch_one(&state.db)
    .await?;

    Ok(ok("上下架申请已提交", request))
}

async fn admin_review_product_listing_request<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
    Json(body): Json<ProductListingReviewRequest>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let status = normalize_listing_review_status(&body.status)?;
    let request = sqlx::query_scalar::<_, Value>(
        r#"
        UPDATE mall_product_listing_requests
        SET status = $2,
            reviewed_by = $3,
            reviewed_at = now(),
            review_note = $4,
            updated_at = now()
        WHERE id = $1
          AND status = 'pending'
        RETURNING jsonb_build_object(
          'id', id,
          'productId', product_id,
          'requestedStatus', requested_status,
          'status', status,
          'reviewedBy', reviewed_by,
          'reviewedAt', reviewed_at,
          'reviewNote', review_note
        )
        "#,
    )
    .bind(&id)
    .bind(&status)
    .bind(non_empty(body.reviewed_by))
    .bind(non_empty(body.review_note))
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| ApiError::NotFound("待审核申请不存在".to_string()))?;

    if status == "approved" {
        let product_id = string_field(&request, "productId");
        let requested_status = string_field(&request, "requestedStatus");
        sqlx::query(
            r#"
            UPDATE mall_products
            SET status = $2,
                updated_at = now()
            WHERE id = $1
            "#,
        )
        .bind(product_id)
        .bind(requested_status)
        .execute(&state.db)
        .await?;
    }

    Ok(ok("上下架申请已审核", request))
}

async fn admin_list_delivery_sheets<S>(
    State(state): State<AppState<S>>,
    Query(query): Query<DeliverySheetQuery>,
) -> ApiResult<Json<ApiEnvelope<Vec<Value>>>>
where
    S: Storage,
{
    let mut builder = QueryBuilder::<Postgres>::new(
        r#"
        SELECT delivery_sheet_json(sheet)
        FROM mall_delivery_sheets sheet
        WHERE 1 = 1
        "#,
    );

    if let Some(sheet_date) = non_empty(query.sheet_date) {
        builder.push(" AND sheet.sheet_date = ");
        builder.push_bind(sheet_date);
        builder.push("::date");
    }
    if let Some(status) = non_empty(query.status) {
        builder.push(" AND sheet.status = ");
        builder.push_bind(status);
    }
    if let Some(pickup_point_id) = non_empty(query.pickup_point_id) {
        builder.push(" AND sheet.pickup_point_id = ");
        builder.push_bind(pickup_point_id);
    }
    builder.push(" ORDER BY sheet.sheet_date DESC, sheet.pickup_point_name ASC LIMIT 100");

    Ok(ok(
        "查询成功",
        builder
            .build_query_scalar::<Value>()
            .fetch_all(&state.db)
            .await?,
    ))
}

async fn admin_generate_delivery_sheet<S>(
    State(state): State<AppState<S>>,
    Json(body): Json<GenerateDeliverySheetRequest>,
) -> ApiResult<Json<ApiEnvelope<Vec<Value>>>>
where
    S: Storage,
{
    let sheet_date =
        non_empty(body.sheet_date).unwrap_or_else(|| chrono::Utc::now().date_naive().to_string());
    let pickup_point_id = non_empty(body.pickup_point_id);

    sqlx::query(
        r#"
        WITH order_scope AS (
          SELECT
            orders.id,
            COALESCE(orders.pickup_point_id, 'unassigned') AS pickup_point_id,
            COALESCE(point.name, '未分配自提点') AS pickup_point_name,
            point.community_name,
            orders.payable_cents
          FROM mall_orders orders
          LEFT JOIN mall_pickup_points point ON point.id = orders.pickup_point_id
          WHERE orders.created_at >= $1::date
            AND orders.created_at < ($1::date + INTERVAL '1 day')
            AND ($3::text IS NULL OR orders.pickup_point_id = $3)
            AND orders.status IN ('paid', 'ready_for_pickup', 'dispatching', 'delivering')
        ),
        item_counts AS (
          SELECT
            scope.pickup_point_id,
            COALESCE(sum(item.quantity), 0)::integer AS item_count
          FROM order_scope scope
          LEFT JOIN mall_order_items item ON item.order_id = scope.id
          GROUP BY scope.pickup_point_id
        ),
        grouped AS (
          SELECT
            $1::date AS sheet_date,
            scope.pickup_point_id,
            max(scope.pickup_point_name) AS pickup_point_name,
            max(scope.community_name) AS community_name,
            count(scope.id)::integer AS order_count,
            max(item_counts.item_count) AS item_count,
            COALESCE(sum(scope.payable_cents), 0) AS total_payable_cents
          FROM order_scope scope
          LEFT JOIN item_counts ON item_counts.pickup_point_id = scope.pickup_point_id
          GROUP BY scope.pickup_point_id
        )
        INSERT INTO mall_delivery_sheets (
          sheet_date, pickup_point_id, pickup_point_name, community_name, status,
          order_count, item_count, total_payable_cents, generated_by, metadata
        )
        SELECT
          sheet_date, pickup_point_id, pickup_point_name, community_name, 'generated',
          order_count, item_count, total_payable_cents, $2,
          jsonb_build_object('generatedFrom', 'mall_orders')
        FROM grouped
        ON CONFLICT (sheet_date, pickup_point_id)
        DO UPDATE SET
          pickup_point_name = EXCLUDED.pickup_point_name,
          community_name = EXCLUDED.community_name,
          order_count = EXCLUDED.order_count,
          item_count = EXCLUDED.item_count,
          total_payable_cents = EXCLUDED.total_payable_cents,
          generated_by = EXCLUDED.generated_by,
          generated_at = now(),
          updated_at = now()
        "#,
    )
    .bind(&sheet_date)
    .bind(non_empty(body.generated_by))
    .bind(pickup_point_id)
    .execute(&state.db)
    .await?;

    let sheets = fetch_delivery_sheets_for_date(&state.db, &sheet_date).await?;
    Ok(ok("配送单已生成", sheets))
}

async fn admin_update_delivery_sheet_status<S>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
    Json(body): Json<UpdateDeliverySheetStatusRequest>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let status = normalize_delivery_sheet_status(&body.status)?;
    let sheet = sqlx::query_scalar::<_, Value>(
        r#"
        UPDATE mall_delivery_sheets
        SET status = $2,
            shipped_at = CASE WHEN $2 = 'shipped' THEN COALESCE(shipped_at, now()) ELSE shipped_at END,
            delivered_at = CASE WHEN $2 = 'delivered' THEN COALESCE(delivered_at, now()) ELSE delivered_at END,
            updated_at = now()
        WHERE id = $1
        RETURNING delivery_sheet_json(mall_delivery_sheets)
        "#,
    )
    .bind(id)
    .bind(status)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| ApiError::NotFound("配送单不存在".to_string()))?;

    Ok(ok("配送状态已更新", sheet))
}

async fn admin_list_finance_bills<S>(
    State(state): State<AppState<S>>,
    Query(query): Query<FinanceQuery>,
) -> ApiResult<Json<ApiEnvelope<Vec<Value>>>>
where
    S: Storage,
{
    let period = normalize_stats_period(query.period.as_deref().unwrap_or("day"))?;
    let bills = sqlx::query_scalar::<_, Value>(
        r#"
        WITH paid_orders AS (
          SELECT
            date_trunc($1, orders.created_at)::date AS period_start,
            orders.id,
            orders.payable_cents
          FROM mall_orders orders
          WHERE orders.payment_status = 'paid'
            AND ($2::date IS NULL OR orders.created_at >= $2::date)
            AND ($3::date IS NULL OR orders.created_at < ($3::date + INTERVAL '1 day'))
        ),
        item_cost AS (
          SELECT
            paid_orders.period_start,
            COALESCE(sum(item.quantity * COALESCE(NULLIF(product.supply_price_cents, 0), item.unit_price_cents)), 0) AS supply_amount_cents
          FROM paid_orders
          JOIN mall_order_items item ON item.order_id = paid_orders.id
          LEFT JOIN mall_products product ON product.id = item.product_id
          GROUP BY paid_orders.period_start
        ),
        refunds AS (
          SELECT
            date_trunc($1, sale.created_at)::date AS period_start,
            COALESCE(sum(sale.amount_cents), 0) AS refund_amount_cents
          FROM mall_after_sales sale
          WHERE sale.status IN ('submitted', 'approved', 'refunded')
            AND ($2::date IS NULL OR sale.created_at >= $2::date)
            AND ($3::date IS NULL OR sale.created_at < ($3::date + INTERVAL '1 day'))
          GROUP BY date_trunc($1, sale.created_at)::date
        ),
        grouped AS (
          SELECT
            paid_orders.period_start,
            count(DISTINCT paid_orders.id) AS order_count,
            COALESCE(sum(paid_orders.payable_cents), 0) AS payable_cents,
            COALESCE(max(item_cost.supply_amount_cents), 0) AS supply_amount_cents,
            COALESCE(max(refunds.refund_amount_cents), 0) AS refund_amount_cents
          FROM paid_orders
          LEFT JOIN item_cost ON item_cost.period_start = paid_orders.period_start
          LEFT JOIN refunds ON refunds.period_start = paid_orders.period_start
          GROUP BY paid_orders.period_start
        )
        SELECT jsonb_build_object(
          'period', $1,
          'periodStart', period_start,
          'periodEnd',
            CASE
              WHEN $1 = 'week' THEN period_start + 6
              WHEN $1 = 'month' THEN (period_start + INTERVAL '1 month' - INTERVAL '1 day')::date
              ELSE period_start
            END,
          'orderCount', order_count,
          'payableCents', payable_cents,
          'supplyAmountCents', supply_amount_cents,
          'refundAmountCents', refund_amount_cents,
          'settlementAmountCents', GREATEST(supply_amount_cents - refund_amount_cents, 0)
        )
        FROM grouped
        ORDER BY period_start DESC
        LIMIT 60
        "#,
    )
    .bind(period)
    .bind(non_empty(query.start_date))
    .bind(non_empty(query.end_date))
    .fetch_all(&state.db)
    .await?;

    Ok(ok("查询成功", bills))
}

async fn admin_list_settlement_records<S>(
    State(state): State<AppState<S>>,
    Query(query): Query<FinanceQuery>,
) -> ApiResult<Json<ApiEnvelope<Vec<Value>>>>
where
    S: Storage,
{
    let mut builder = QueryBuilder::<Postgres>::new(
        r#"
        SELECT jsonb_build_object(
          'id', id,
          'periodType', period_type,
          'periodStart', period_start,
          'periodEnd', period_end,
          'supplierId', supplier_id,
          'supplyAmountCents', supply_amount_cents,
          'refundAmountCents', refund_amount_cents,
          'settlementAmountCents', settlement_amount_cents,
          'status', status,
          'voucherUrl', voucher_url,
          'paidAt', paid_at,
          'createdAt', created_at,
          'updatedAt', updated_at
        )
        FROM mall_settlement_records
        WHERE 1 = 1
        "#,
    );

    if let Some(status) = non_empty(query.status) {
        builder.push(" AND status = ");
        builder.push_bind(status);
    }
    if let Some(period) = non_empty(query.period) {
        builder.push(" AND period_type = ");
        builder.push_bind(period);
    }
    if let Some(supplier_id) = non_empty(query.supplier_id) {
        builder.push(" AND supplier_id = ");
        builder.push_bind(supplier_id);
    }
    builder.push(" ORDER BY period_start DESC, created_at DESC LIMIT 100");

    Ok(ok(
        "查询成功",
        builder
            .build_query_scalar::<Value>()
            .fetch_all(&state.db)
            .await?,
    ))
}

async fn admin_list_withdrawal_requests<S>(
    State(state): State<AppState<S>>,
    Query(query): Query<FinanceQuery>,
) -> ApiResult<Json<ApiEnvelope<Vec<Value>>>>
where
    S: Storage,
{
    let mut builder = QueryBuilder::<Postgres>::new(
        r#"
        SELECT jsonb_build_object(
          'id', id,
          'requesterId', requester_id,
          'requesterRole', requester_role,
          'supplierId', supplier_id,
          'amountCents', amount_cents,
          'status', status,
          'bankAccountSnapshot', bank_account_snapshot,
          'reviewedBy', reviewed_by,
          'reviewedAt', reviewed_at,
          'paidAt', paid_at,
          'voucherUrl', voucher_url,
          'note', note,
          'createdAt', created_at,
          'updatedAt', updated_at
        )
        FROM mall_withdrawal_requests
        WHERE 1 = 1
        "#,
    );

    if let Some(status) = non_empty(query.status) {
        builder.push(" AND status = ");
        builder.push_bind(status);
    }
    if let Some(supplier_id) = non_empty(query.supplier_id) {
        builder.push(" AND supplier_id = ");
        builder.push_bind(supplier_id);
    }
    builder.push(" ORDER BY created_at DESC LIMIT 100");

    Ok(ok(
        "查询成功",
        builder
            .build_query_scalar::<Value>()
            .fetch_all(&state.db)
            .await?,
    ))
}

async fn admin_create_withdrawal<S>(
    State(state): State<AppState<S>>,
    Json(body): Json<WithdrawalMutationRequest>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let amount_cents = body.amount_cents.unwrap_or(0);
    if amount_cents <= 0 {
        return Err(ApiError::BadRequest("提现金额必须大于0".to_string()));
    }
    let requester_role = non_empty(body.requester_role).unwrap_or_else(|| "admin".to_string());
    validate_listing_requester_role(&requester_role)?;

    let withdrawal = sqlx::query_scalar::<_, Value>(
        r#"
        INSERT INTO mall_withdrawal_requests (
          requester_id, requester_role, supplier_id, amount_cents,
          bank_account_snapshot, note
        )
        VALUES ($1, $2, $3, $4, COALESCE($5, '{}'::jsonb), $6)
        RETURNING jsonb_build_object(
          'id', id,
          'requesterId', requester_id,
          'requesterRole', requester_role,
          'supplierId', supplier_id,
          'amountCents', amount_cents,
          'status', status,
          'bankAccountSnapshot', bank_account_snapshot,
          'note', note,
          'createdAt', created_at,
          'updatedAt', updated_at
        )
        "#,
    )
    .bind(non_empty(body.requester_id))
    .bind(requester_role)
    .bind(non_empty(body.supplier_id))
    .bind(amount_cents)
    .bind(body.bank_account_snapshot)
    .bind(non_empty(body.note))
    .fetch_one(&state.db)
    .await?;

    Ok(ok("提现申请已提交", withdrawal))
}

async fn admin_sales_stats<S>(
    State(state): State<AppState<S>>,
    Query(query): Query<SalesStatsQuery>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    let period = normalize_stats_period(query.period.as_deref().unwrap_or("day"))?;
    let stats = sqlx::query_scalar::<_, Value>(
        r#"
        WITH paid_orders AS (
          SELECT
            id,
            created_at,
            payable_cents
          FROM mall_orders
          WHERE payment_status = 'paid'
            AND ($2::date IS NULL OR created_at >= $2::date)
            AND ($3::date IS NULL OR created_at < ($3::date + INTERVAL '1 day'))
        ),
        sales AS (
          SELECT
            item.product_id,
            item.product_name,
            COALESCE(item.category_code, product.category_code, 'uncategorized') AS category_code,
            COALESCE(category.name, item.category_code, '未分类') AS category_name,
            item.quantity,
            item.line_total_cents,
            paid_orders.created_at
          FROM paid_orders
          JOIN mall_order_items item ON item.order_id = paid_orders.id
          LEFT JOIN mall_products product ON product.id = item.product_id
          LEFT JOIN mall_categories category ON category.code = COALESCE(item.category_code, product.category_code)
        ),
        product_stats AS (
          SELECT jsonb_agg(
            jsonb_build_object(
              'productId', product_rows.product_id,
              'productName', product_rows.product_name,
              'quantity', product_rows.quantity,
              'salesCents', product_rows.sales_cents
            )
            ORDER BY product_rows.quantity DESC, product_rows.sales_cents DESC
          ) AS rows
          FROM (
            SELECT
              product_id,
              product_name,
              sum(quantity)::integer AS quantity,
              sum(line_total_cents) AS sales_cents
            FROM sales
            GROUP BY product_id, product_name
            ORDER BY sum(quantity) DESC, sum(line_total_cents) DESC
            LIMIT 20
          ) product_rows
        ),
        category_stats AS (
          SELECT jsonb_agg(
            jsonb_build_object(
              'categoryCode', category_rows.category_code,
              'categoryName', category_rows.category_name,
              'quantity', category_rows.quantity,
              'salesCents', category_rows.sales_cents
            )
            ORDER BY category_rows.sales_cents DESC
          ) AS rows
          FROM (
            SELECT
              category_code,
              category_name,
              sum(quantity)::integer AS quantity,
              sum(line_total_cents) AS sales_cents
            FROM sales
            GROUP BY category_code, category_name
            ORDER BY sum(line_total_cents) DESC
          ) category_rows
        ),
        trend AS (
          SELECT jsonb_agg(
            jsonb_build_object(
              'bucket', trend_rows.bucket,
              'orderCount', trend_rows.order_count,
              'salesCents', trend_rows.sales_cents
            )
            ORDER BY trend_rows.bucket ASC
          ) AS rows
          FROM (
            SELECT
              date_trunc($1, paid_orders.created_at)::date AS bucket,
              count(*)::integer AS order_count,
              sum(paid_orders.payable_cents) AS sales_cents
            FROM paid_orders
            GROUP BY date_trunc($1, paid_orders.created_at)::date
            ORDER BY bucket ASC
          ) trend_rows
        )
        SELECT jsonb_build_object(
          'period', $1,
          'summary', jsonb_build_object(
            'orderCount', COALESCE((SELECT count(*) FROM paid_orders), 0),
            'salesCents', COALESCE((SELECT sum(payable_cents) FROM paid_orders), 0),
            'itemQuantity', COALESCE((SELECT sum(quantity) FROM sales), 0)
          ),
          'productStats', COALESCE((SELECT rows FROM product_stats), '[]'::jsonb),
          'categoryStats', COALESCE((SELECT rows FROM category_stats), '[]'::jsonb),
          'topProducts', COALESCE((SELECT rows FROM product_stats), '[]'::jsonb),
          'trend', COALESCE((SELECT rows FROM trend), '[]'::jsonb)
        )
        "#,
    )
    .bind(period)
    .bind(non_empty(query.start_date))
    .bind(non_empty(query.end_date))
    .fetch_one(&state.db)
    .await?;

    Ok(ok("查询成功", stats))
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
                if matches!(
                    key.as_str(),
                    "imageUrl" | "licenseUrl" | "reportUrl" | "fileUrl" | "iconUrl"
                ) {
                    if child
                        .as_str()
                        .map(str::trim)
                        .is_some_and(should_resolve_mall_image_url)
                    {
                        paths.push(current_path.clone());
                    }
                } else if key == "images" {
                    if let Value::Array(images) = child {
                        for (index, image) in images.iter().enumerate() {
                            if image
                                .as_str()
                                .map(str::trim)
                                .is_some_and(should_resolve_mall_image_url)
                            {
                                let mut image_path = current_path.clone();
                                image_path.push(JsonPathSegment::Index(index));
                                paths.push(image_path);
                            }
                        }
                    }
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
    let activity_type = match non_empty(query.activity_type) {
        Some(value) => Some(normalize_product_activity_type(&value)?),
        None => None,
    };
    let sort_key = match non_empty(query.sort) {
        Some(value) => normalize_product_sort(&value)?,
        None if activity_type.as_deref() == Some("best_seller") => "sales_desc".to_string(),
        None => "default".to_string(),
    };
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
        builder.push_bind(pattern.clone());
        builder.push(" OR p.specification ILIKE ");
        builder.push_bind(pattern.clone());
        builder.push(" OR p.sale_method ILIKE ");
        builder.push_bind(pattern.clone());
        builder.push(" OR p.sku ILIKE ");
        builder.push_bind(pattern.clone());
        builder.push(" OR c.name ILIKE ");
        builder.push_bind(pattern.clone());
        builder.push(" OR COALESCE(p.tags::text, '') ILIKE ");
        builder.push_bind(pattern);
        builder.push(")");
    }
    if let Some(activity_type) = activity_type.as_deref() {
        push_product_activity_filter(&mut builder, activity_type);
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
    push_product_order(&mut builder, &sort_key);
    builder.push(" LIMIT ");
    builder.push_bind(page_size);
    builder.push(" OFFSET ");
    builder.push_bind((page - 1) * page_size);

    Ok(builder
        .build_query_scalar::<Value>()
        .fetch_all(pool)
        .await?)
}

async fn sync_product_procurement(
    pool: &PgPool,
    product_id: &str,
    buyer_ids: Option<&[String]>,
    reports: Option<&[ProductQualificationReportMutation]>,
    hide_supplier: Option<bool>,
) -> ApiResult<()> {
    if buyer_ids.is_none() && reports.is_none() && hide_supplier.is_none() {
        return Ok(());
    }

    let default_hide_supplier = hide_supplier.unwrap_or(false);
    if buyer_ids.is_none() && reports.is_none() {
        sqlx::query(
            r#"
            UPDATE mall_product_buyers
            SET hide_supplier = $2
            WHERE product_id = $1
            "#,
        )
        .bind(product_id)
        .bind(default_hide_supplier)
        .execute(pool)
        .await?;
        sqlx::query(
            r#"
            UPDATE mall_product_qualification_reports
            SET hide_supplier = $2,
                updated_at = now()
            WHERE product_id = $1
            "#,
        )
        .bind(product_id)
        .bind(default_hide_supplier)
        .execute(pool)
        .await?;
        return Ok(());
    }

    let normalized_reports = normalize_qualification_reports(reports, default_hide_supplier)?;
    let normalized_buyer_ids =
        normalize_product_procurement_buyer_ids(buyer_ids, &normalized_reports);
    ensure_procurement_buyers_exist(pool, &normalized_buyer_ids).await?;

    sqlx::query("DELETE FROM mall_product_buyers WHERE product_id = $1")
        .bind(product_id)
        .execute(pool)
        .await?;
    for buyer_id in &normalized_buyer_ids {
        sqlx::query(
            r#"
            INSERT INTO mall_product_buyers (product_id, buyer_id, hide_supplier)
            VALUES ($1, $2, $3)
            ON CONFLICT (product_id, buyer_id)
            DO UPDATE SET hide_supplier = EXCLUDED.hide_supplier
            "#,
        )
        .bind(product_id)
        .bind(buyer_id)
        .bind(default_hide_supplier)
        .execute(pool)
        .await?;
    }

    sqlx::query("DELETE FROM mall_product_qualification_reports WHERE product_id = $1")
        .bind(product_id)
        .execute(pool)
        .await?;
    for report in normalized_reports {
        sqlx::query(
            r#"
            INSERT INTO mall_product_qualification_reports (
              id, product_id, buyer_id, report_name, report_type, report_url,
              issuer, issued_at, expires_at, hide_supplier, status
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            "#,
        )
        .bind(report.id)
        .bind(product_id)
        .bind(report.buyer_id)
        .bind(report.report_name)
        .bind(report.report_type)
        .bind(report.report_url)
        .bind(report.issuer)
        .bind(report.issued_at)
        .bind(report.expires_at)
        .bind(report.hide_supplier)
        .bind(report.status)
        .execute(pool)
        .await?;
    }

    Ok(())
}

async fn ensure_procurement_buyers_exist(pool: &PgPool, buyer_ids: &[String]) -> ApiResult<()> {
    for buyer_id in buyer_ids {
        let exists = sqlx::query_scalar::<_, bool>(
            r#"
            SELECT EXISTS (
              SELECT 1
              FROM mall_procurement_buyers
              WHERE id = $1
                AND status <> 'deleted'
            )
            "#,
        )
        .bind(buyer_id)
        .fetch_one(pool)
        .await?;
        if !exists {
            return Err(ApiError::BadRequest("采购商不存在或已删除".to_string()));
        }
    }
    Ok(())
}

fn normalize_product_procurement_buyer_ids(
    buyer_ids: Option<&[String]>,
    reports: &[NormalizedQualificationReport],
) -> Vec<String> {
    let mut normalized = Vec::new();
    if let Some(buyer_ids) = buyer_ids {
        for buyer_id in buyer_ids {
            push_unique_non_empty(&mut normalized, buyer_id);
        }
    }
    for report in reports {
        if let Some(buyer_id) = report.buyer_id.as_deref() {
            push_unique_non_empty(&mut normalized, buyer_id);
        }
    }
    normalized
}

fn normalize_qualification_reports(
    reports: Option<&[ProductQualificationReportMutation]>,
    default_hide_supplier: bool,
) -> ApiResult<Vec<NormalizedQualificationReport>> {
    let mut normalized = Vec::new();
    let Some(reports) = reports else {
        return Ok(normalized);
    };
    for report in reports {
        let has_any_value = [
            report.buyer_id.as_deref(),
            report.report_name.as_deref(),
            report.report_type.as_deref(),
            report.report_url.as_deref(),
            report.issuer.as_deref(),
            report.issued_at.as_deref(),
            report.expires_at.as_deref(),
        ]
        .iter()
        .any(|value| value.is_some_and(|value| !value.trim().is_empty()));
        if !has_any_value {
            continue;
        }

        let report_name = normalize_product_image_value(report.report_name.as_deref())
            .ok_or_else(|| ApiError::BadRequest("资质报告名称不能为空".to_string()))?;
        let report_url = normalize_product_image_value(report.report_url.as_deref())
            .ok_or_else(|| ApiError::BadRequest("资质报告文件不能为空".to_string()))?;
        let status = report
            .status
            .clone()
            .unwrap_or_else(|| "active".to_string());
        validate_qualification_report_status(&status)?;

        normalized.push(NormalizedQualificationReport {
            id: normalize_product_image_value(report.id.as_deref())
                .unwrap_or_else(|| uuid::Uuid::new_v4().to_string()),
            buyer_id: normalize_product_image_value(report.buyer_id.as_deref()),
            report_name,
            report_type: normalize_product_image_value(report.report_type.as_deref()),
            report_url,
            issuer: normalize_product_image_value(report.issuer.as_deref()),
            issued_at: normalize_product_image_value(report.issued_at.as_deref()),
            expires_at: normalize_product_image_value(report.expires_at.as_deref()),
            hide_supplier: report.hide_supplier.unwrap_or(default_hide_supplier),
            status,
        });
    }
    Ok(normalized)
}

fn push_unique_non_empty(values: &mut Vec<String>, value: &str) {
    let Some(normalized) = normalize_product_image_value(Some(value)) else {
        return;
    };
    if !values.iter().any(|current| current == &normalized) {
        values.push(normalized);
    }
}

fn normalize_product_activity_type(value: &str) -> ApiResult<String> {
    match value.trim() {
        "" | "all" | "全部" => Ok("all".to_string()),
        "flashSale" | "flash_sale" | "seckill" | "秒杀" => Ok("flash_sale".to_string()),
        "fullReduction" | "full_reduction" | "discount" | "满减" => {
            Ok("full_reduction".to_string())
        }
        "fixedPrice" | "fixed_price" | "onePrice" | "one_price" | "fixed" | "一口价" => {
            Ok("fixed_price".to_string())
        }
        "newArrival" | "new_arrival" | "new" | "新品" | "上新" => Ok("new_arrival".to_string()),
        "bestSeller" | "best_seller" | "hot" | "爆款" => Ok("best_seller".to_string()),
        _ => Err(ApiError::BadRequest("活动筛选条件不正确".to_string())),
    }
}

fn normalize_product_sort(value: &str) -> ApiResult<String> {
    match value.trim() {
        "" | "default" | "comprehensive" | "综合" => Ok("default".to_string()),
        "priceAsc" | "price_asc" => Ok("price_asc".to_string()),
        "priceDesc" | "price_desc" => Ok("price_desc".to_string()),
        "updatedDesc" | "updated_desc" | "recent" | "recentlyEdited" | "recently_edited" => {
            Ok("updated_desc".to_string())
        }
        "updatedAsc" | "updated_asc" => Ok("updated_asc".to_string()),
        "nameAsc" | "name_asc" => Ok("name_asc".to_string()),
        "nameDesc" | "name_desc" => Ok("name_desc".to_string()),
        "categoryAsc" | "category_asc" => Ok("category_asc".to_string()),
        "categoryDesc" | "category_desc" => Ok("category_desc".to_string()),
        "newest" | "dateDesc" | "date_desc" | "createdDesc" | "created_desc" => {
            Ok("newest".to_string())
        }
        "oldest" | "dateAsc" | "date_asc" | "createdAsc" | "created_asc" => {
            Ok("oldest".to_string())
        }
        "salesDesc" | "sales_desc" | "soldDesc" | "sold_desc" | "bestSeller" | "best_seller" => {
            Ok("sales_desc".to_string())
        }
        "stockAsc" | "stock_asc" => Ok("stock_asc".to_string()),
        "stockDesc" | "stock_desc" => Ok("stock_desc".to_string()),
        _ => Err(ApiError::BadRequest("商品排序条件不正确".to_string())),
    }
}

fn push_product_activity_filter(builder: &mut QueryBuilder<Postgres>, activity_type: &str) {
    match activity_type {
        "all" => {}
        "flash_sale" => {
            builder.push(
                r#"
            AND (
              EXISTS (
                SELECT 1
                FROM mall_home_sections s
                WHERE s.section_type = 'flash_sale'
                  AND s.status = 'active'
                  AND (s.starts_at IS NULL OR s.starts_at <= now())
                  AND (s.ends_at IS NULL OR s.ends_at >= now())
                  AND EXISTS (
                    SELECT 1
                    FROM jsonb_array_elements_text(COALESCE(s.product_ids, '[]'::jsonb)) AS item(value)
                    WHERE item.value = p.id::text OR item.value = p.sku
                  )
              )
              OR COALESCE(p.tags::text, '') ~ '秒杀|特价|爆款'
            )
            "#,
            );
        }
        "full_reduction" => {
            builder.push(
                r#"
            AND EXISTS (
              SELECT 1
              FROM mall_campaigns campaign
              WHERE campaign.status = 'active'
                AND (campaign.starts_at IS NULL OR campaign.starts_at <= now())
                AND (campaign.ends_at IS NULL OR campaign.ends_at >= now())
                AND campaign.rules ? 'thresholdCents'
                AND campaign.rules ? 'discountCents'
            )
            "#,
            );
        }
        "fixed_price" => {
            builder.push(
                r#"
            AND EXISTS (
              SELECT 1
              FROM mall_campaigns campaign
              JOIN LATERAL jsonb_array_elements(COALESCE(campaign.rules->'items', '[]'::jsonb)) AS item(value) ON true
              WHERE campaign.campaign_type = 'fixed_price'
                AND campaign.status = 'active'
                AND (campaign.starts_at IS NULL OR campaign.starts_at <= now())
                AND (campaign.ends_at IS NULL OR campaign.ends_at >= now())
                AND (
                  item.value->>'productId' = p.id::text
                  OR item.value->>'id' = p.id::text
                  OR item.value->>'sku' = p.sku
                )
                AND COALESCE(
                  NULLIF(item.value->>'fixedPriceCents', '')::bigint,
                  NULLIF(item.value->>'priceCents', '')::bigint,
                  NULLIF(campaign.rules->>'fixedPriceCents', '')::bigint,
                  0
                ) > 0
            )
            "#,
            );
        }
        "new_arrival" => {
            builder.push(
                r#"
            AND (
              EXISTS (
                SELECT 1
                FROM mall_home_sections s
                WHERE s.section_type = 'new_arrival'
                  AND s.status = 'active'
                  AND (s.starts_at IS NULL OR s.starts_at <= now())
                  AND (s.ends_at IS NULL OR s.ends_at >= now())
                  AND EXISTS (
                    SELECT 1
                    FROM jsonb_array_elements_text(COALESCE(s.product_ids, '[]'::jsonb)) AS item(value)
                    WHERE item.value = p.id::text OR item.value = p.sku
                  )
              )
              OR COALESCE(p.tags::text, '') ~ '今日|新品|新上|现货'
              OR p.created_at >= now() - interval '3 days'
            )
            "#,
            );
        }
        "best_seller" => {}
        _ => {}
    };
}

fn push_product_order(builder: &mut QueryBuilder<Postgres>, sort_key: &str) {
    match sort_key {
        "price_asc" => {
            builder.push(" ORDER BY p.price_cents ASC, p.sort_order ASC, p.created_at DESC");
        }
        "price_desc" => {
            builder.push(" ORDER BY p.price_cents DESC, p.sort_order ASC, p.created_at DESC");
        }
        "updated_desc" => {
            builder.push(" ORDER BY p.updated_at DESC, p.created_at DESC");
        }
        "updated_asc" => {
            builder.push(" ORDER BY p.updated_at ASC, p.created_at ASC");
        }
        "name_asc" => {
            builder.push(" ORDER BY p.name ASC, p.sort_order ASC, p.updated_at DESC");
        }
        "name_desc" => {
            builder.push(" ORDER BY p.name DESC, p.sort_order ASC, p.updated_at DESC");
        }
        "category_asc" => {
            builder.push(" ORDER BY c.name ASC NULLS LAST, p.category_code ASC, p.sort_order ASC, p.updated_at DESC");
        }
        "category_desc" => {
            builder.push(" ORDER BY c.name DESC NULLS LAST, p.category_code DESC, p.sort_order ASC, p.updated_at DESC");
        }
        "newest" => {
            builder.push(" ORDER BY p.created_at DESC, p.sort_order ASC");
        }
        "oldest" => {
            builder.push(" ORDER BY p.created_at ASC, p.sort_order ASC");
        }
        "sales_desc" => {
            builder.push(" ORDER BY p.sold_count DESC, p.created_at DESC");
        }
        "stock_asc" => {
            builder.push(" ORDER BY p.stock ASC, p.sort_order ASC, p.created_at DESC");
        }
        "stock_desc" => {
            builder.push(" ORDER BY p.stock DESC, p.sort_order ASC, p.created_at DESC");
        }
        _ => {
            builder.push(" ORDER BY p.sort_order ASC, p.created_at DESC");
        }
    };
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
        WHERE p.stock_alert_threshold > 0
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

async fn update_inventory_alert_product<S: Storage>(
    pool: &PgPool,
    storage: &S,
    product_id: &str,
    stock: Option<i32>,
    stock_alert_threshold: Option<i32>,
) -> ApiResult<Value> {
    let updated_id = sqlx::query_scalar::<_, String>(
        r#"
        UPDATE mall_products
        SET stock = COALESCE($2, stock),
            stock_alert_threshold = COALESCE($3, stock_alert_threshold),
            updated_at = now()
        WHERE id = $1
        RETURNING id
        "#,
    )
    .bind(product_id)
    .bind(stock)
    .bind(stock_alert_threshold)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| ApiError::NotFound("商品不存在".to_string()))?;

    let mut product = fetch_product_json(pool, &updated_id).await?;
    resolve_mall_image_urls(storage, &mut product).await?;
    Ok(product)
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
    } else {
        builder.push(" AND status <> 'deleted'");
    }
    if let Some(keyword) = non_empty(query.keyword) {
        let pattern = format!("%{keyword}%");
        builder.push(" AND (name ILIKE ");
        builder.push_bind(pattern.clone());
        builder.push(" OR address_text ILIKE ");
        builder.push_bind(pattern.clone());
        builder.push(" OR community_name ILIKE ");
        builder.push_bind(pattern.clone());
        builder.push(" OR leader_name ILIKE ");
        builder.push_bind(pattern.clone());
        builder.push(" OR leader_phone ILIKE ");
        builder.push_bind(pattern);
        builder.push(")");
    }
    let community = query.community_name.or(query.community);
    if let Some(community_name) = non_empty(community) {
        builder.push(" AND community_name ILIKE ");
        let community_pattern = format!("%{community_name}%");
        builder.push_bind(community_pattern);
    }
    let limit = query.page_size.unwrap_or(100).clamp(1, 200);
    builder.push(" ORDER BY sort_order ASC, created_at DESC LIMIT ");
    builder.push_bind(limit);
    Ok(builder
        .build_query_scalar::<Value>()
        .fetch_all(pool)
        .await?)
}

async fn fetch_group_leaders(pool: &PgPool, query: GroupLeaderQuery) -> ApiResult<Vec<Value>> {
    let mut builder = QueryBuilder::<Postgres>::new(
        r#"
        SELECT jsonb_build_object(
          'id', leader.id,
          'pickupPointId', leader.pickup_point_id,
          'pickupPointName', point.name,
          'pickupPointAddress', point.address_text,
          'communityName', point.community_name,
          'userId', leader.user_id,
          'name', leader.name,
          'phone', leader.phone,
          'status', leader.status,
          'serviceNote', leader.service_note,
          'createdAt', leader.created_at,
          'updatedAt', leader.updated_at
        )
        FROM mall_group_leaders leader
        JOIN mall_pickup_points point ON point.id = leader.pickup_point_id
        WHERE leader.status <> 'deleted'
        "#,
    );

    if let Some(status) = non_empty(query.status) {
        builder.push(" AND leader.status = ");
        builder.push_bind(status);
    }
    if let Some(pickup_point_id) = non_empty(query.pickup_point_id) {
        builder.push(" AND leader.pickup_point_id = ");
        builder.push_bind(pickup_point_id);
    }
    if let Some(keyword) = non_empty(query.keyword) {
        let pattern = format!("%{keyword}%");
        builder.push(" AND (leader.name ILIKE ");
        builder.push_bind(pattern.clone());
        builder.push(" OR leader.phone ILIKE ");
        builder.push_bind(pattern.clone());
        builder.push(" OR leader.user_id ILIKE ");
        builder.push_bind(pattern.clone());
        builder.push(" OR point.name ILIKE ");
        builder.push_bind(pattern.clone());
        builder.push(" OR point.community_name ILIKE ");
        builder.push_bind(pattern);
        builder.push(")");
    }

    let limit = query.page_size.unwrap_or(100).clamp(1, 200);
    builder.push(" ORDER BY leader.updated_at DESC, leader.created_at DESC LIMIT ");
    builder.push_bind(limit);
    Ok(builder
        .build_query_scalar::<Value>()
        .fetch_all(pool)
        .await?)
}

async fn sync_pickup_point_leader_contact(pool: &PgPool, pickup_point_id: &str) -> ApiResult<()> {
    sqlx::query(
        r#"
        WITH active_leader AS (
          SELECT name, phone
          FROM mall_group_leaders
          WHERE pickup_point_id = $1
            AND status = 'active'
          ORDER BY updated_at DESC, created_at DESC
          LIMIT 1
        )
        UPDATE mall_pickup_points point
        SET leader_name = active_leader.name,
            leader_phone = active_leader.phone,
            updated_at = now()
        FROM active_leader
        WHERE point.id = $1
        "#,
    )
    .bind(pickup_point_id)
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        UPDATE mall_pickup_points
        SET leader_name = NULL,
            leader_phone = NULL,
            updated_at = now()
        WHERE id = $1
          AND NOT EXISTS (
            SELECT 1
            FROM mall_group_leaders
            WHERE pickup_point_id = $1
              AND status = 'active'
          )
        "#,
    )
    .bind(pickup_point_id)
    .execute(pool)
    .await?;

    Ok(())
}

async fn ensure_pickup_point_exists_for_admin(
    pool: &PgPool,
    pickup_point_id: &str,
) -> ApiResult<()> {
    let exists = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS (SELECT 1 FROM mall_pickup_points WHERE id = $1 AND status <> 'deleted')",
    )
    .bind(pickup_point_id)
    .fetch_one(pool)
    .await?;
    if !exists {
        return Err(ApiError::BadRequest("自提点不存在或已删除".to_string()));
    }
    Ok(())
}

async fn fetch_member_profile(pool: &PgPool, user_id: &str) -> ApiResult<Value> {
    sqlx::query_scalar::<_, Value>(
        r#"
        WITH stats AS (
          SELECT
            count(*)::bigint AS order_count,
            COALESCE(sum(payable_cents), 0)::bigint AS total_spend_cents,
            (COALESCE(sum(payable_cents), 0) / 100)::integer AS earned_points
          FROM mall_orders
          WHERE user_id = $1
            AND status <> 'cancelled'
        ),
        redeemed AS (
          SELECT COALESCE(sum(points), 0)::integer AS redeemed_points
          FROM mall_points_ledger
          WHERE user_id = $1
            AND entry_type = 'redeem'
        ),
        point_stats AS (
          SELECT
            stats.order_count,
            stats.total_spend_cents,
            stats.earned_points,
            redeemed.redeemed_points,
            GREATEST(stats.earned_points - redeemed.redeemed_points, 0)::integer AS points
          FROM stats
          CROSS JOIN redeemed
        ),
        selected_level AS (
          SELECT level.*
          FROM mall_member_levels level, point_stats
          WHERE level.status = 'active'
            AND level.min_points <= point_stats.earned_points
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
          'points', point_stats.points,
          'earnedPoints', point_stats.earned_points,
          'redeemedPoints', point_stats.redeemed_points,
          'orderCount', point_stats.order_count,
          'totalSpendCents', point_stats.total_spend_cents,
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
        CROSS JOIN point_stats
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

async fn fetch_member_coupon_wallet(pool: &PgPool) -> ApiResult<Value> {
    Ok(sqlx::query_scalar::<_, Value>(
        r#"
        SELECT jsonb_build_object(
          'availableCount', count(*) FILTER (
            WHERE status = 'active'
              AND (starts_at IS NULL OR starts_at <= now())
              AND (ends_at IS NULL OR ends_at >= now())
              AND (total_quantity <= 0 OR used_count < total_quantity)
          ),
          'expiringCount', count(*) FILTER (
            WHERE status = 'active'
              AND ends_at IS NOT NULL
              AND ends_at >= now()
              AND ends_at <= now() + interval '7 days'
          ),
          'nearestExpiry', min(ends_at) FILTER (
            WHERE status = 'active'
              AND ends_at IS NOT NULL
              AND ends_at >= now()
          )
        )
        FROM mall_coupons
        "#,
    )
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
          'orderCount', (
            SELECT count(*)
            FROM mall_orders
            WHERE pickup_point_id = $1
              AND created_at >= date_trunc('day', now())
          ),
          'totalPayableCents', (
            SELECT COALESCE(sum(payable_cents), 0)
            FROM mall_orders
            WHERE pickup_point_id = $1
              AND payment_status = 'paid'
              AND created_at >= date_trunc('day', now())
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

async fn enrich_products_pricing(pool: &PgPool, products: &mut [Value]) -> ApiResult<()> {
    for product in products {
        enrich_product_pricing(pool, product).await?;
    }
    Ok(())
}

fn strip_public_product_specs(product: &mut Value) {
    if let Some(object) = product.as_object_mut() {
        for key in [
            "supplyPriceCents",
            "stockAlertThreshold",
            "coldChainRequired",
            "lengthCm",
            "widthCm",
            "heightCm",
            "volumeLiters",
            "weightKg",
        ] {
            object.remove(key);
        }
        if let Some(variants) = object.get_mut("variants").and_then(Value::as_array_mut) {
            for variant in variants {
                if let Some(variant_object) = variant.as_object_mut() {
                    variant_object.remove("supplyPriceCents");
                }
            }
        }
    }
}

#[cfg(test)]
mod product_listing_query_tests {
    use super::*;

    #[test]
    fn activity_filters_match_jsonb_tags_without_array_functions() {
        for activity_type in ["flash_sale", "new_arrival"] {
            let mut builder =
                QueryBuilder::<Postgres>::new("SELECT 1 FROM mall_products p WHERE 1 = 1");

            push_product_activity_filter(&mut builder, activity_type);

            let sql = builder.sql();
            assert!(
                !sql.contains("array_to_string(p.tags"),
                "{activity_type} filter must not treat jsonb tags as a postgres array"
            );
            assert!(
                sql.contains("p.tags::text"),
                "{activity_type} filter should match against jsonb tag text"
            );
        }
    }

    #[test]
    fn product_image_gallery_is_limited_to_twenty_images() {
        let images = (0..=MAX_PRODUCT_IMAGES)
            .map(|index| format!("mall-products/{index}.jpeg"))
            .collect::<Vec<_>>();

        let error = normalize_product_images(None, Some(&images))
            .expect_err("more than 20 product images should fail");

        assert!(error.to_string().contains("最多上传 20 张图片"));
    }

    #[test]
    fn product_image_gallery_keeps_primary_image_first() {
        let images = vec![
            "mall-products/detail-1.jpeg".to_string(),
            "mall-products/main.jpeg".to_string(),
            "  ".to_string(),
        ];

        let normalized = normalize_product_images(Some("mall-products/main.jpeg"), Some(&images))
            .expect("valid image gallery should normalize");

        assert_eq!(
            normalized,
            vec![
                "mall-products/main.jpeg".to_string(),
                "mall-products/detail-1.jpeg".to_string(),
            ]
        );
    }

    #[test]
    fn product_variants_default_to_legacy_product_fields() {
        let defaults = ProductVariantDefaults {
            sku: "SKU-1".to_string(),
            specification: "330ml/瓶".to_string(),
            sale_method: "1瓶".to_string(),
            price_cents: 300,
            original_price_cents: Some(350),
            supply_price_cents: Some(180),
            stock: 120,
            minimum_order_quantity: 1,
            status: "on_sale".to_string(),
        };

        let variants = normalize_product_variants(None, &defaults)
            .expect("legacy single-spec product should produce a default variant");

        assert_eq!(variants[0].id, "default");
        assert_eq!(variants[0].name, "1瓶");
        assert_eq!(variants[0].price_cents, 300);
        assert_eq!(variants[0].stock, 120);
        assert_eq!(variants[0].pricing_mode, "fixed");
    }

    #[test]
    fn product_variants_are_limited() {
        let defaults = ProductVariantDefaults {
            sku: "SKU-1".to_string(),
            specification: "默认规格".to_string(),
            sale_method: "按份".to_string(),
            price_cents: 100,
            original_price_cents: None,
            supply_price_cents: None,
            stock: 1,
            minimum_order_quantity: 1,
            status: "on_sale".to_string(),
        };
        let variants = (0..=MAX_PRODUCT_VARIANTS)
            .map(|index| ProductVariantMutation {
                id: Some(format!("v-{index}")),
                name: Some(format!("规格{index}")),
                sku: None,
                specification: None,
                sale_method: None,
                price_cents: None,
                original_price_cents: None,
                supply_price_cents: None,
                stock: None,
                minimum_order_quantity: None,
                status: None,
                sort_order: None,
                pricing_mode: None,
                weight_unit: None,
                weight_unit_label: None,
                weight_unit_grams: None,
                weight_tolerance_bps: None,
            })
            .collect::<Vec<_>>();

        let error = normalize_product_variants(Some(&variants), &defaults)
            .expect_err("more than the variant limit should fail");

        assert!(error.to_string().contains("最多配置 50 个规格"));
    }

    #[test]
    fn weighted_product_variant_keeps_weight_pricing_fields() {
        let defaults = ProductVariantDefaults {
            sku: "WATERMELON".to_string(),
            specification: "约30斤".to_string(),
            sale_method: "按斤".to_string(),
            price_cents: 1000,
            original_price_cents: None,
            supply_price_cents: None,
            stock: 200,
            minimum_order_quantity: 30,
            status: "on_sale".to_string(),
        };
        let variants = vec![ProductVariantMutation {
            id: Some("by-jin".to_string()),
            name: Some("按斤称重".to_string()),
            sku: None,
            specification: None,
            sale_method: Some("按斤".to_string()),
            price_cents: Some(1000),
            original_price_cents: None,
            supply_price_cents: None,
            stock: Some(200),
            minimum_order_quantity: Some(30),
            status: Some("on_sale".to_string()),
            sort_order: Some(1),
            pricing_mode: Some("weighed".to_string()),
            weight_unit: Some("jin".to_string()),
            weight_unit_label: Some("斤".to_string()),
            weight_unit_grams: Some(500),
            weight_tolerance_bps: Some(800),
        }];

        let normalized = normalize_product_variants(Some(&variants), &defaults)
            .expect("weighted variant should normalize");

        assert_eq!(normalized[0].pricing_mode, "weighed");
        assert_eq!(normalized[0].weight_unit_label, "斤");
        assert_eq!(normalized[0].weight_unit_grams, 500);
        assert_eq!(normalized[0].weight_tolerance_bps, 800);
        assert_eq!(weighed_line_total_cents(1000, 15_050, 500), 30_100);
    }
}

async fn enrich_product_pricing(pool: &PgPool, product: &mut Value) -> ApiResult<()> {
    let product_id = product
        .get("id")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string();
    let sku = product
        .get("sku")
        .and_then(Value::as_str)
        .map(str::to_string);
    let price_cents = product
        .get("priceCents")
        .and_then(Value::as_i64)
        .unwrap_or_default()
        .max(0);
    let original_price_cents = product
        .get("originalPriceCents")
        .and_then(Value::as_i64)
        .unwrap_or(price_cents)
        .max(price_cents);
    let full_reduction = calculate_mall_discount_cents(pool, price_cents).await?;
    let coupon = calculate_mall_coupon_discount_cents(pool, price_cents).await?;
    let preview_discount_cents =
        (full_reduction.discount_cents + coupon.discount_cents).clamp(0, price_cents);
    let fixed_price_campaign = if product_id.is_empty() {
        None
    } else {
        find_fixed_price_campaign(pool, &product_id, sku.as_deref()).await?
    };
    let discounted_price_cents = fixed_price_campaign
        .as_ref()
        .and_then(fixed_price_campaign_price_cents)
        .map(|fixed_price| fixed_price.clamp(0, price_cents))
        .unwrap_or_else(|| (price_cents - preview_discount_cents).max(0));
    let saved_cents = (original_price_cents - discounted_price_cents).max(0);
    let points_deductible_cents = (discounted_price_cents / 20).clamp(0, 500);
    let coupon_stackable = coupon.discount_cents > 0 || coupon.next_gap_cents.is_some();
    let discount_label = fixed_price_campaign
        .as_ref()
        .and_then(|campaign| campaign.get("badgeText").and_then(Value::as_str))
        .map(str::to_string)
        .or(full_reduction.description)
        .or(coupon.description)
        .unwrap_or_else(|| "今日优惠".to_string());

    if let Some(object) = product.as_object_mut() {
        object.insert(
            "discountedPriceCents".to_string(),
            json!(discounted_price_cents),
        );
        object.insert("savedCents".to_string(), json!(saved_cents));
        object.insert("couponStackable".to_string(), json!(coupon_stackable));
        object.insert(
            "pointsDeductibleCents".to_string(),
            json!(points_deductible_cents),
        );
        object.insert("discountLabel".to_string(), json!(discount_label));
        if let Some(campaign) = fixed_price_campaign {
            object.insert("fixedPriceCampaign".to_string(), campaign);
        } else {
            object.remove("fixedPriceCampaign");
        }
    }

    Ok(())
}

async fn find_fixed_price_campaign(
    pool: &PgPool,
    product_id: &str,
    sku: Option<&str>,
) -> ApiResult<Option<Value>> {
    let campaign = sqlx::query_scalar::<_, Value>(
        r#"
        SELECT jsonb_build_object(
          'campaignId', campaign.id,
          'campaignName', campaign.name,
          'fixedPriceCents', COALESCE(
            NULLIF(item.value->>'fixedPriceCents', '')::bigint,
            NULLIF(item.value->>'priceCents', '')::bigint,
            NULLIF(campaign.rules->>'fixedPriceCents', '')::bigint,
            0
          ),
          'badgeText', COALESCE(
            NULLIF(item.value->>'badgeText', ''),
            NULLIF(campaign.rules #>> '{badge,text}', ''),
            NULLIF(campaign.rules->>'badgeText', ''),
            '一口价'
          ),
          'badgeIcon', COALESCE(
            NULLIF(item.value->>'badgeIcon', ''),
            NULLIF(campaign.rules #>> '{badge,icon}', ''),
            NULLIF(campaign.rules->>'badgeIcon', ''),
            ''
          ),
          'badgeIconUrl', COALESCE(
            NULLIF(item.value->>'badgeIconUrl', ''),
            NULLIF(campaign.rules #>> '{badge,iconUrl}', ''),
            NULLIF(campaign.rules->>'badgeIconUrl', ''),
            ''
          ),
          'badgeBackgroundColor', COALESCE(
            NULLIF(item.value->>'badgeBackgroundColor', ''),
            NULLIF(campaign.rules #>> '{badge,backgroundColor}', ''),
            NULLIF(campaign.rules->>'badgeBackgroundColor', ''),
            '#FF9238'
          ),
          'badgeTextColor', COALESCE(
            NULLIF(item.value->>'badgeTextColor', ''),
            NULLIF(campaign.rules #>> '{badge,textColor}', ''),
            NULLIF(campaign.rules->>'badgeTextColor', ''),
            '#FFFFFF'
          )
        )
        FROM mall_campaigns campaign
        JOIN LATERAL jsonb_array_elements(COALESCE(campaign.rules->'items', '[]'::jsonb)) AS item(value) ON true
        WHERE campaign.campaign_type = 'fixed_price'
          AND campaign.status = 'active'
          AND (campaign.starts_at IS NULL OR campaign.starts_at <= now())
          AND (campaign.ends_at IS NULL OR campaign.ends_at >= now())
          AND (
            item.value->>'productId' = $1
            OR item.value->>'id' = $1
            OR item.value->>'sku' = COALESCE($2, '')
          )
          AND COALESCE(
            NULLIF(item.value->>'fixedPriceCents', '')::bigint,
            NULLIF(item.value->>'priceCents', '')::bigint,
            NULLIF(campaign.rules->>'fixedPriceCents', '')::bigint,
            0
          ) > 0
        ORDER BY campaign.updated_at DESC, campaign.created_at DESC
        LIMIT 1
        "#,
    )
    .bind(product_id)
    .bind(sku)
    .fetch_optional(pool)
    .await?;

    Ok(campaign)
}

fn fixed_price_campaign_price_cents(campaign: &Value) -> Option<i64> {
    campaign
        .get("fixedPriceCents")
        .and_then(Value::as_i64)
        .filter(|value| *value > 0)
}

async fn cart_payload(pool: &PgPool, user_id: &str) -> ApiResult<Value> {
    let mut items = sqlx::query_scalar::<_, Value>(
        r#"
        SELECT jsonb_build_object(
          'id', ci.id,
          'userId', ci.user_id,
          'productId', ci.product_id,
          'variantId', ci.variant_id,
          'variantName', COALESCE(ci.variant_name, variant.value->>'name'),
          'quantity', ci.quantity,
          'selected', ci.selected,
          'product', product_json(p, c.name) || jsonb_build_object(
            'selectedVariantId', ci.variant_id,
            'priceCents', COALESCE((variant.value->>'priceCents')::bigint, p.price_cents),
            'originalPriceCents', COALESCE((variant.value->>'originalPriceCents')::bigint, p.original_price_cents),
            'stock', COALESCE((variant.value->>'stock')::integer, p.stock),
            'specification', COALESCE(variant.value->>'specification', p.specification),
            'saleMethod', COALESCE(variant.value->>'saleMethod', p.sale_method),
            'pricingMode', COALESCE(variant.value->>'pricingMode', 'fixed'),
            'weightUnit', COALESCE(variant.value->>'weightUnit', 'jin'),
            'weightUnitLabel', COALESCE(variant.value->>'weightUnitLabel', '斤'),
            'weightUnitGrams', COALESCE((variant.value->>'weightUnitGrams')::integer, 500),
            'weightToleranceBps', COALESCE((variant.value->>'weightToleranceBps')::integer, 500)
          ),
          'lineTotalCents', COALESCE((variant.value->>'priceCents')::bigint, p.price_cents) * ci.quantity,
          'pricingMode', COALESCE(variant.value->>'pricingMode', 'fixed'),
          'estimatedWeightGrams', CASE
            WHEN COALESCE(variant.value->>'pricingMode', 'fixed') = 'weighed'
            THEN ci.quantity * COALESCE((variant.value->>'weightUnitGrams')::integer, 500)
            ELSE NULL
          END,
          'weightUnitLabel', COALESCE(variant.value->>'weightUnitLabel', '斤'),
          'weightUnitGrams', COALESCE((variant.value->>'weightUnitGrams')::integer, 500),
          'weightToleranceBps', COALESCE((variant.value->>'weightToleranceBps')::integer, 500)
        )
        FROM mall_cart_items ci
        JOIN mall_products p ON p.id = ci.product_id
        LEFT JOIN mall_categories c ON c.code = p.category_code
        LEFT JOIN LATERAL (
          SELECT item.value
          FROM jsonb_array_elements(COALESCE(p.variants, '[]'::jsonb)) AS item(value)
          WHERE item.value->>'id' = ci.variant_id
          LIMIT 1
        ) variant ON true
        WHERE ci.user_id = $1
        ORDER BY ci.created_at DESC
        "#,
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;
    for item in &mut items {
        if let Some(product) = item.get_mut("product") {
            enrich_product_pricing(pool, product).await?;
        }
    }
    apply_fixed_price_to_cart_item_values(&mut items);
    let subtotal_cents = items
        .iter()
        .filter(|item| item["selected"].as_bool().unwrap_or(false))
        .map(|item| item["lineTotalCents"].as_i64().unwrap_or_default())
        .sum::<i64>();
    let settings = fetch_mall_settings(pool).await?;
    let delivery_fee_cents = mall_delivery_fee_cents(subtotal_cents, &settings);
    let summary =
        calculate_mall_price_summary(pool, Some(user_id), subtotal_cents, delivery_fee_cents)
            .await?;
    apply_cart_item_pricing(&mut items, &summary);
    Ok(json!({
        "items": items,
        "subtotalCents": subtotal_cents,
        "deliveryFeeCents": delivery_fee_cents,
        "couponCents": summary.total_discount_cents,
        "payableCents": summary.payable_cents,
        "discountDescription": summary.discount_description,
        "discountThresholdCents": summary.discount_threshold_cents,
        "discountRuleCents": summary.discount_rule_cents,
        "fullReductionCents": summary.full_reduction_cents,
        "couponDiscountCents": summary.coupon_discount_cents,
        "memberDiscountCents": summary.member_discount_cents,
        "pointsRedeemedCents": summary.points_redeemed_cents,
        "totalDiscountCents": summary.total_discount_cents,
        "discountBreakdown": summary.discount_breakdown,
        "nextDiscountGapCents": summary.next_discount_gap_cents,
        "nextDiscountCents": summary.next_discount_cents,
        "availablePoints": summary.available_points,
        "memberLevel": summary.member_level,
        "selectedCount": items.iter().filter(|item| item["selected"].as_bool().unwrap_or(false)).count(),
    }))
}

async fn checkout_payload(pool: &PgPool, checkout_id: &str) -> ApiResult<Value> {
    let checkout = fetch_checkout(pool, checkout_id).await?;
    let mut items = checkout_products(pool, &checkout).await?;
    if items.is_empty() {
        return Err(ApiError::BadRequest("结算商品为空".to_string()));
    }
    for item in &items {
        if item.quantity > item.stock {
            return Err(ApiError::BadRequest(format!("{} 库存不足", item.name)));
        }
    }
    apply_fixed_price_to_cart_rows(pool, &mut items).await?;

    let subtotal_cents = checkout_subtotal_cents(&items);
    let settings = fetch_mall_settings(pool).await?;
    let delivery_fee_cents = mall_delivery_fee_cents(subtotal_cents, &settings);
    let summary = calculate_mall_price_summary(
        pool,
        Some(&checkout.user_id),
        subtotal_cents,
        delivery_fee_cents,
    )
    .await?;
    let item_values = checkout_item_values(&items, &summary);

    Ok(json!({
        "id": checkout.id,
        "userId": checkout.user_id,
        "source": checkout.source,
        "productId": checkout.product_id,
        "variantId": checkout.variant_id,
        "quantity": checkout.quantity,
        "addressId": checkout.address_id,
        "pickupPointId": checkout.pickup_point_id,
        "items": item_values,
        "subtotalCents": subtotal_cents,
        "deliveryFeeCents": delivery_fee_cents,
        "couponCents": summary.total_discount_cents,
        "payableCents": summary.payable_cents,
        "discountDescription": summary.discount_description,
        "discountThresholdCents": summary.discount_threshold_cents,
        "discountRuleCents": summary.discount_rule_cents,
        "fullReductionCents": summary.full_reduction_cents,
        "couponDiscountCents": summary.coupon_discount_cents,
        "memberDiscountCents": summary.member_discount_cents,
        "pointsRedeemedCents": summary.points_redeemed_cents,
        "totalDiscountCents": summary.total_discount_cents,
        "discountBreakdown": summary.discount_breakdown,
        "nextDiscountGapCents": summary.next_discount_gap_cents,
        "nextDiscountCents": summary.next_discount_cents,
        "availablePoints": summary.available_points,
        "memberLevel": summary.member_level,
    }))
}

async fn fetch_checkout(pool: &PgPool, checkout_id: &str) -> ApiResult<CheckoutRow> {
    sqlx::query_as::<_, CheckoutRow>(
        r#"
        SELECT id, user_id, source, product_id, variant_id, quantity, address_id, pickup_point_id
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
        return fetch_buy_now_product(
            pool,
            product_id,
            checkout.variant_id.as_deref(),
            checkout.quantity,
        )
        .await;
    }
    fetch_selected_cart_products(pool, &checkout.user_id).await
}

fn apply_fixed_price_to_cart_item_values(items: &mut [Value]) {
    for item in items {
        let quantity = item
            .get("quantity")
            .and_then(Value::as_i64)
            .unwrap_or(1)
            .max(1);
        let fixed_price_cents = item
            .get("product")
            .and_then(|product| product.get("fixedPriceCampaign"))
            .and_then(fixed_price_campaign_price_cents);
        let Some(fixed_price_cents) = fixed_price_cents else {
            continue;
        };
        if let Some(object) = item.as_object_mut() {
            object.insert(
                "lineTotalCents".to_string(),
                json!(fixed_price_cents * quantity),
            );
        }
    }
}

async fn apply_fixed_price_to_cart_rows(
    pool: &PgPool,
    items: &mut [CartProductRow],
) -> ApiResult<()> {
    for item in items {
        if let Some(campaign) =
            find_fixed_price_campaign(pool, &item.product_id, Some(&item.sku)).await?
        {
            if let Some(fixed_price_cents) = fixed_price_campaign_price_cents(&campaign) {
                item.price_cents = fixed_price_cents;
            }
        }
    }
    Ok(())
}

fn apply_cart_item_pricing(items: &mut [Value], summary: &MallPriceSummary) {
    for item in items {
        let selected = item
            .get("selected")
            .and_then(Value::as_bool)
            .unwrap_or(false);
        let quantity = item
            .get("quantity")
            .and_then(Value::as_i64)
            .unwrap_or(1)
            .max(1);
        let line_total_cents = item
            .get("lineTotalCents")
            .and_then(Value::as_i64)
            .unwrap_or_default()
            .max(0);
        let unit_price_cents = line_total_cents / quantity;
        let line_discount_cents = if selected {
            proportional_discount_cents(
                line_total_cents,
                summary.subtotal_cents,
                summary.total_discount_cents,
            )
        } else {
            0
        };
        let line_payable_cents = (line_total_cents - line_discount_cents).max(0);
        let discounted_unit_price_cents = if selected {
            line_payable_cents / quantity
        } else {
            unit_price_cents
        };
        let points_deductible_cents = (discounted_unit_price_cents / 20).clamp(0, 500);

        if let Some(object) = item.as_object_mut() {
            object.insert(
                "originalUnitPriceCents".to_string(),
                json!(unit_price_cents),
            );
            object.insert(
                "discountedUnitPriceCents".to_string(),
                json!(discounted_unit_price_cents),
            );
            object.insert("lineDiscountCents".to_string(), json!(line_discount_cents));
            object.insert("linePayableCents".to_string(), json!(line_payable_cents));
            object.insert("savedCents".to_string(), json!(line_discount_cents));
            object.insert(
                "couponStackable".to_string(),
                json!(
                    summary.coupon_discount_cents > 0 || summary.next_discount_gap_cents.is_some()
                ),
            );
            object.insert(
                "pointsDeductibleCents".to_string(),
                json!(points_deductible_cents),
            );
        }

        if let Some(product) = item.get_mut("product").and_then(Value::as_object_mut) {
            product.insert(
                "discountedPriceCents".to_string(),
                json!(discounted_unit_price_cents),
            );
            product.insert(
                "savedCents".to_string(),
                json!((unit_price_cents - discounted_unit_price_cents).max(0)),
            );
            product.insert(
                "couponStackable".to_string(),
                json!(
                    summary.coupon_discount_cents > 0 || summary.next_discount_gap_cents.is_some()
                ),
            );
            product.insert(
                "pointsDeductibleCents".to_string(),
                json!(points_deductible_cents),
            );
        }
    }
}

async fn fetch_buy_now_product(
    pool: &PgPool,
    product_id: &str,
    variant_id: Option<&str>,
    quantity: i32,
) -> ApiResult<Vec<CartProductRow>> {
    let variant = ensure_product_variant_can_sell(pool, product_id, variant_id, quantity).await?;
    let product = sqlx::query_as::<_, CartProductRow>(
        r#"
        SELECT
          p.id AS product_id,
          $3::text AS variant_id,
          $4::text AS variant_name,
          $5::text AS sku,
          p.name,
          p.category_code,
          p.image_url,
          $6::bigint AS price_cents,
          $7::integer AS stock,
          $2::integer AS quantity,
          $8::text AS pricing_mode,
          $9::text AS weight_unit,
          $10::text AS weight_unit_label,
          $11::integer AS weight_unit_grams,
          $12::integer AS weight_tolerance_bps
        FROM mall_products p
        WHERE p.id = $1
          AND p.status = 'on_sale'
        "#,
    )
    .bind(product_id)
    .bind(quantity)
    .bind(&variant.id)
    .bind(&variant.name)
    .bind(&variant.sku)
    .bind(variant.price_cents)
    .bind(variant.stock)
    .bind(&variant.pricing_mode)
    .bind(&variant.weight_unit)
    .bind(&variant.weight_unit_label)
    .bind(variant.weight_unit_grams)
    .bind(variant.weight_tolerance_bps)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| ApiError::NotFound("商品不存在或已下架".to_string()))?;
    Ok(vec![product])
}

fn checkout_item_values(items: &[CartProductRow], summary: &MallPriceSummary) -> Vec<Value> {
    items
        .iter()
        .map(|item| {
            let line_total_cents = item.price_cents * i64::from(item.quantity);
            let estimated_weight_grams = estimated_weight_grams_for_item(item);
            let line_discount_cents =
                proportional_discount_cents(line_total_cents, summary.subtotal_cents, summary.total_discount_cents);
            let line_payable_cents = (line_total_cents - line_discount_cents).max(0);
            let discounted_unit_price_cents = if item.quantity > 0 {
                line_payable_cents / i64::from(item.quantity)
            } else {
                item.price_cents
            };
            let points_deductible_cents = (item.price_cents / 20).clamp(0, 500);
            let product = json!({
                "id": item.product_id,
                "selectedVariantId": item.variant_id,
                "sku": item.sku,
                "name": item.name,
                "categoryCode": item.category_code,
                "imageUrl": item.image_url,
                "priceCents": item.price_cents,
                "discountedPriceCents": discounted_unit_price_cents,
                "savedCents": (item.price_cents - discounted_unit_price_cents).max(0),
                "couponStackable": summary.coupon_discount_cents > 0 || summary.next_discount_gap_cents.is_some(),
                "pointsDeductibleCents": points_deductible_cents,
                "stock": item.stock,
                "pricingMode": item.pricing_mode,
                "weightUnit": item.weight_unit,
                "weightUnitLabel": item.weight_unit_label,
                "weightUnitGrams": item.weight_unit_grams,
                "weightToleranceBps": item.weight_tolerance_bps,
                "status": "on_sale",
            });
            json!({
                "productId": item.product_id,
                "variantId": item.variant_id,
                "variantName": item.variant_name,
                "sku": item.sku,
                "productName": item.name,
                "categoryCode": item.category_code,
                "imageUrl": item.image_url,
                "unitPriceCents": item.price_cents,
                "originalUnitPriceCents": item.price_cents,
                "discountedUnitPriceCents": discounted_unit_price_cents,
                "quantity": item.quantity,
                "lineTotalCents": line_total_cents,
                "estimatedLineTotalCents": line_total_cents,
                "lineDiscountCents": line_discount_cents,
                "linePayableCents": line_payable_cents,
                "pricingMode": item.pricing_mode,
                "estimatedWeightGrams": estimated_weight_grams,
                "weightUnit": item.weight_unit,
                "weightUnitLabel": item.weight_unit_label,
                "weightUnitGrams": item.weight_unit_grams,
                "weightToleranceBps": item.weight_tolerance_bps,
                "weightAdjustmentStatus": if item.pricing_mode == "weighed" { "pending" } else { "none" },
                "savedCents": line_discount_cents,
                "couponStackable": summary.coupon_discount_cents > 0 || summary.next_discount_gap_cents.is_some(),
                "pointsDeductibleCents": points_deductible_cents,
                "product": product
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
          ci.variant_id,
          COALESCE(ci.variant_name, variant.value->>'name', p.sale_method, p.specification, '默认规格') AS variant_name,
          COALESCE(variant.value->>'sku', p.sku) AS sku,
          p.name,
          p.category_code,
          p.image_url,
          COALESCE((variant.value->>'priceCents')::bigint, p.price_cents) AS price_cents,
          COALESCE((variant.value->>'stock')::integer, p.stock) AS stock,
          ci.quantity,
          COALESCE(variant.value->>'pricingMode', 'fixed') AS pricing_mode,
          COALESCE(variant.value->>'weightUnit', 'jin') AS weight_unit,
          COALESCE(variant.value->>'weightUnitLabel', '斤') AS weight_unit_label,
          COALESCE((variant.value->>'weightUnitGrams')::integer, 500) AS weight_unit_grams,
          COALESCE((variant.value->>'weightToleranceBps')::integer, 500) AS weight_tolerance_bps
        FROM mall_cart_items ci
        JOIN mall_products p ON p.id = ci.product_id
        LEFT JOIN LATERAL (
          SELECT item.value
          FROM jsonb_array_elements(COALESCE(p.variants, '[]'::jsonb)) AS item(value)
          WHERE item.value->>'id' = ci.variant_id
          LIMIT 1
        ) variant ON true
        WHERE ci.user_id = $1
          AND ci.selected = true
          AND p.status = 'on_sale'
          AND variant.value IS NOT NULL
          AND COALESCE(variant.value->>'status', 'on_sale') = 'on_sale'
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
        let discount_cents = rule.discount_cents.clamp(0, subtotal_cents);
        return Ok(MallDiscount {
            discount_cents,
            description: Some(rule.name.clone()),
            threshold_cents: Some(rule.threshold_cents),
            rule_discount_cents: Some(rule.discount_cents),
            next_discount_cents: next_rule.map(|rule| rule.discount_cents),
            next_gap_cents: next_rule.map(|rule| rule.threshold_cents - subtotal_cents),
        });
    }

    Ok(MallDiscount {
        discount_cents: 0,
        description: next_rule.map(|rule| {
            format!(
                "满{}减{}",
                yuan_amount(rule.threshold_cents),
                yuan_amount(rule.discount_cents)
            )
        }),
        threshold_cents: next_rule.map(|rule| rule.threshold_cents),
        rule_discount_cents: next_rule.map(|rule| rule.discount_cents),
        next_discount_cents: next_rule.map(|rule| rule.discount_cents),
        next_gap_cents: next_rule.map(|rule| rule.threshold_cents - subtotal_cents),
    })
}

async fn calculate_mall_coupon_discount_cents(
    pool: &PgPool,
    subtotal_cents: i64,
) -> ApiResult<MallDiscount> {
    let rules = sqlx::query_as::<_, CampaignDiscountRow>(
        r#"
        SELECT
          name,
          threshold_cents,
          discount_cents
        FROM mall_coupons
        WHERE status = 'active'
          AND coupon_type = 'full_reduction'
          AND (starts_at IS NULL OR starts_at <= now())
          AND (ends_at IS NULL OR ends_at >= now())
          AND (total_quantity <= 0 OR used_count < total_quantity)
          AND COALESCE((rules->>'autoApply')::boolean, true) = true
        ORDER BY threshold_cents ASC, discount_cents DESC
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
        return Ok(MallDiscount {
            discount_cents: rule.discount_cents.clamp(0, subtotal_cents),
            description: Some(rule.name.clone()),
            threshold_cents: Some(rule.threshold_cents),
            rule_discount_cents: Some(rule.discount_cents),
            next_discount_cents: next_rule.map(|rule| rule.discount_cents),
            next_gap_cents: next_rule.map(|rule| rule.threshold_cents - subtotal_cents),
        });
    }

    Ok(MallDiscount {
        discount_cents: 0,
        description: next_rule.map(|rule| {
            format!(
                "优惠券满{}减{}",
                yuan_amount(rule.threshold_cents),
                yuan_amount(rule.discount_cents)
            )
        }),
        threshold_cents: next_rule.map(|rule| rule.threshold_cents),
        rule_discount_cents: next_rule.map(|rule| rule.discount_cents),
        next_discount_cents: next_rule.map(|rule| rule.discount_cents),
        next_gap_cents: next_rule.map(|rule| rule.threshold_cents - subtotal_cents),
    })
}

async fn calculate_mall_price_summary(
    pool: &PgPool,
    user_id: Option<&str>,
    subtotal_cents: i64,
    delivery_fee_cents: i64,
) -> ApiResult<MallPriceSummary> {
    let subtotal_cents = subtotal_cents.max(0);
    let full_reduction = calculate_mall_discount_cents(pool, subtotal_cents).await?;
    let coupon = calculate_mall_coupon_discount_cents(pool, subtotal_cents).await?;
    let member_context = fetch_member_pricing_context(pool, user_id).await?;
    let after_market_discount =
        (subtotal_cents - full_reduction.discount_cents - coupon.discount_cents).max(0);
    let member_discount_cents = if member_context.discount_bps < 10_000 {
        (after_market_discount * i64::from(10_000 - member_context.discount_bps) / 10_000)
            .clamp(0, after_market_discount)
    } else {
        0
    };
    let after_member_discount = (after_market_discount - member_discount_cents).max(0);
    let point_cents = i64::from(member_context.available_points / 100 * 100);
    let max_points_redeemable = (after_member_discount + delivery_fee_cents - 1).max(0);
    let points_redeemed_cents = point_cents.clamp(0, max_points_redeemable);
    let total_discount_cents = full_reduction.discount_cents
        + coupon.discount_cents
        + member_discount_cents
        + points_redeemed_cents;
    let payable_cents = (subtotal_cents + delivery_fee_cents - total_discount_cents).max(0);
    let mut discount_breakdown = Vec::new();

    if full_reduction.discount_cents > 0 {
        discount_breakdown.push(json!({
            "type": "full_reduction",
            "label": full_reduction.description.clone().unwrap_or_else(|| "满减活动".to_string()),
            "amountCents": full_reduction.discount_cents,
        }));
    }
    if coupon.discount_cents > 0 {
        discount_breakdown.push(json!({
            "type": "coupon",
            "label": coupon.description.clone().unwrap_or_else(|| "优惠券".to_string()),
            "amountCents": coupon.discount_cents,
        }));
    }
    if member_discount_cents > 0 {
        let level_name = member_context.level_name.as_deref().unwrap_or("会员折扣");
        discount_breakdown.push(json!({
            "type": "member",
            "label": format!("{level_name}折扣"),
            "amountCents": member_discount_cents,
        }));
    }
    if points_redeemed_cents > 0 {
        discount_breakdown.push(json!({
            "type": "points",
            "label": "积分抵扣",
            "amountCents": points_redeemed_cents,
        }));
    }

    let next_gap = [full_reduction.next_gap_cents, coupon.next_gap_cents]
        .into_iter()
        .flatten()
        .filter(|value| *value > 0)
        .min();
    let next_discount = match next_gap {
        Some(gap) if Some(gap) == full_reduction.next_gap_cents => {
            full_reduction.next_discount_cents
        }
        Some(_) => coupon.next_discount_cents,
        None => None,
    };
    let discount_description = discount_breakdown
        .first()
        .and_then(|item| item.get("label"))
        .and_then(Value::as_str)
        .map(str::to_string)
        .or_else(|| full_reduction.description.clone())
        .or_else(|| coupon.description.clone());
    let member_level = member_context.level_name.as_ref().map(|name| {
        json!({
            "code": member_context.level_code,
            "name": name,
            "discountBps": member_context.discount_bps,
        })
    });

    Ok(MallPriceSummary {
        subtotal_cents,
        full_reduction_cents: full_reduction.discount_cents,
        coupon_discount_cents: coupon.discount_cents,
        member_discount_cents,
        points_redeemed_cents,
        total_discount_cents,
        payable_cents,
        discount_description,
        discount_threshold_cents: full_reduction.threshold_cents.or(coupon.threshold_cents),
        discount_rule_cents: full_reduction
            .rule_discount_cents
            .or(coupon.rule_discount_cents),
        next_discount_gap_cents: next_gap,
        next_discount_cents: next_discount,
        available_points: member_context.available_points,
        member_level,
        discount_breakdown,
    })
}

async fn fetch_member_pricing_context(
    pool: &PgPool,
    user_id: Option<&str>,
) -> ApiResult<MemberPricingContextRow> {
    let Some(user_id) = user_id.map(str::trim).filter(|value| !value.is_empty()) else {
        return Ok(default_member_pricing_context());
    };

    Ok(sqlx::query_as::<_, MemberPricingContextRow>(
        r#"
        WITH stats AS (
          SELECT
            (COALESCE(sum(payable_cents), 0) / 100)::integer AS earned_points
          FROM mall_orders
          WHERE user_id = $1
            AND status <> 'cancelled'
        ),
        redeemed AS (
          SELECT COALESCE(sum(points), 0)::integer AS redeemed_points
          FROM mall_points_ledger
          WHERE user_id = $1
            AND entry_type = 'redeem'
        ),
        point_stats AS (
          SELECT
            stats.earned_points,
            GREATEST(stats.earned_points - redeemed.redeemed_points, 0)::integer AS available_points
          FROM stats
          CROSS JOIN redeemed
        ),
        selected_level AS (
          SELECT level.*
          FROM mall_member_levels level, point_stats
          WHERE level.status = 'active'
            AND level.min_points <= point_stats.earned_points
          ORDER BY level.min_points DESC, level.sort_order ASC
          LIMIT 1
        )
        SELECT
          point_stats.available_points,
          COALESCE(level.discount_bps, 10000)::integer AS discount_bps,
          level.code AS level_code,
          level.name AS level_name
        FROM point_stats
        LEFT JOIN selected_level level ON true
        "#,
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await?
    .unwrap_or_else(default_member_pricing_context))
}

fn default_member_pricing_context() -> MemberPricingContextRow {
    MemberPricingContextRow {
        available_points: 0,
        discount_bps: 10_000,
        level_code: None,
        level_name: None,
    }
}

fn proportional_discount_cents(
    line_total_cents: i64,
    subtotal_cents: i64,
    total_discount_cents: i64,
) -> i64 {
    if subtotal_cents <= 0 || total_discount_cents <= 0 || line_total_cents <= 0 {
        return 0;
    }
    (line_total_cents * total_discount_cents / subtotal_cents).clamp(0, line_total_cents)
}

fn estimated_weight_grams_for_item(item: &CartProductRow) -> Option<i32> {
    if item.pricing_mode != "weighed" {
        return None;
    }
    Some(item.quantity.saturating_mul(item.weight_unit_grams.max(1)))
}

fn actual_weight_grams_from_request(body: &WeightAdjustmentRequest) -> ApiResult<i32> {
    if let Some(grams) = body.actual_weight_grams {
        validate_positive_i32(grams, "实际称重必须大于0")?;
        return Ok(grams);
    }
    if let Some(jin) = body.actual_weight_jin {
        if !jin.is_finite() || jin <= 0.0 {
            return Err(ApiError::BadRequest("实际称重必须大于0".to_string()));
        }
        return Ok((jin * 500.0).round() as i32);
    }
    Err(ApiError::BadRequest("请输入实际称重".to_string()))
}

fn weighed_line_total_cents(
    unit_price_cents: i64,
    actual_weight_grams: i32,
    unit_grams: i32,
) -> i64 {
    let unit_grams = i64::from(unit_grams.max(1));
    let numerator = unit_price_cents.saturating_mul(i64::from(actual_weight_grams.max(0)));
    (numerator + unit_grams / 2) / unit_grams
}

fn weight_text(weight_grams: i32, unit_grams: i32, unit_label: &str) -> String {
    let unit_grams = f64::from(unit_grams.max(1));
    let value = f64::from(weight_grams.max(0)) / unit_grams;
    if (value.fract()).abs() < f64::EPSILON {
        format!("{value:.0}{unit_label}")
    } else {
        format!("{value:.2}{unit_label}")
    }
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

async fn fetch_roles_config(pool: &PgPool) -> ApiResult<Value> {
    sqlx::query(
        r#"
        INSERT INTO mall_operation_settings (id)
        VALUES ('default')
        ON CONFLICT (id) DO NOTHING
        "#,
    )
    .execute(pool)
    .await?;

    Ok(sqlx::query_scalar::<_, Value>(
        r#"
        SELECT COALESCE(roles, '{}'::jsonb)
        FROM mall_operation_settings
        WHERE id = 'default'
        "#,
    )
    .fetch_one(pool)
    .await?)
}

async fn persist_permissions(
    pool: &PgPool,
    roles: &mut Value,
    permissions: Vec<Value>,
) -> ApiResult<()> {
    if !roles.is_object() {
        *roles = json!({});
    }
    let object = roles
        .as_object_mut()
        .ok_or_else(|| ApiError::BadRequest("权限配置格式不正确".to_string()))?;
    object.insert("permissions".to_string(), Value::Array(permissions));

    sqlx::query(
        r#"
        UPDATE mall_operation_settings
        SET roles = $1, updated_at = now()
        WHERE id = 'default'
        "#,
    )
    .bind(roles.clone())
    .execute(pool)
    .await?;

    Ok(())
}

fn permissions_from_roles(roles: &Value) -> Vec<Value> {
    roles
        .get("permissions")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default()
}

async fn read_permission_records(pool: &PgPool) -> ApiResult<Vec<Value>> {
    let roles = fetch_roles_config(pool).await?;
    Ok(permissions_from_roles(&roles))
}

fn filter_permission_records(
    permissions: Vec<Value>,
    query: PermissionQuery,
) -> ApiResult<Vec<Value>> {
    if let Some(status) = query.status.as_deref() {
        validate_permission_status(status)?;
    }
    if let Some(module) = query.module.as_deref() {
        validate_permission_module(module)?;
    }
    let keyword = query.keyword.and_then(|value| {
        let trimmed = value.trim().to_lowercase();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        }
    });

    Ok(permissions
        .into_iter()
        .filter(|permission| {
            if let Some(status) = query.status.as_deref() {
                if string_field(permission, "status") != status {
                    return false;
                }
            }
            if let Some(module) = query.module.as_deref() {
                if !array_field_contains(permission, "modules", module) {
                    return false;
                }
            }
            if let Some(keyword) = keyword.as_deref() {
                let haystack = [
                    string_field(permission, "name"),
                    string_field(permission, "roleKey"),
                    string_field(permission, "description"),
                ]
                .join(" ")
                .to_lowercase();
                if !haystack.contains(keyword) {
                    return false;
                }
            }
            true
        })
        .collect())
}

fn string_field(record: &Value, key: &str) -> String {
    record
        .get(key)
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string()
}

fn array_field_contains(record: &Value, key: &str, needle: &str) -> bool {
    record
        .get(key)
        .and_then(Value::as_array)
        .map(|values| {
            values
                .iter()
                .filter_map(Value::as_str)
                .any(|value| value == needle)
        })
        .unwrap_or(false)
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
    query: &OrderQuery,
    include_admin_fields: bool,
) -> ApiResult<Vec<Value>> {
    let mut builder = QueryBuilder::<Postgres>::new("SELECT order_summary_json(o)");
    if include_admin_fields {
        builder.push(" || jsonb_build_object('merchantId', o.merchant_id, 'userPhone', u.phone)");
    }
    builder.push(
        r#"
        FROM mall_orders o
        LEFT JOIN users u ON u.id = o.user_id
        WHERE 1 = 1
        "#,
    );
    if let Some(user_id) = user_id {
        builder.push(" AND o.user_id = ");
        builder.push_bind(user_id);
    }
    if let Some(status) = non_empty(query.status.clone()) {
        builder.push(" AND o.status = ");
        builder.push_bind(status);
    }
    if let Some(order_no) = non_empty(query.order_no.clone()) {
        builder.push(" AND o.order_no ILIKE ");
        builder.push_bind(format!("%{order_no}%"));
    }
    if let Some(user_phone) = non_empty(query.user_phone.clone()) {
        let pattern = format!("%{user_phone}%");
        builder.push(" AND (o.recipient_phone ILIKE ");
        builder.push_bind(pattern.clone());
        builder.push(" OR u.phone ILIKE ");
        builder.push_bind(pattern);
        builder.push(")");
    }
    if let Some(merchant_id) = non_empty(query.merchant_id.clone()) {
        builder.push(" AND o.merchant_id = ");
        builder.push_bind(merchant_id);
    }
    if let Some(start_date) = non_empty(query.start_date.clone()) {
        builder.push(" AND o.created_at >= ");
        builder.push_bind(start_date);
        builder.push("::date");
    }
    if let Some(end_date) = non_empty(query.end_date.clone()) {
        builder.push(" AND o.created_at < (");
        builder.push_bind(end_date);
        builder.push("::date + interval '1 day')");
    }
    let page = query.page.unwrap_or(1).max(1);
    let page_size = query.page_size.unwrap_or(50).clamp(1, 100);
    builder.push(" ORDER BY o.created_at DESC LIMIT ");
    builder.push_bind(page_size);
    builder.push(" OFFSET ");
    builder.push_bind((page - 1) * page_size);
    Ok(builder
        .build_query_scalar::<Value>()
        .fetch_all(pool)
        .await?)
}

async fn fetch_order_detail(pool: &PgPool, order_identifier: &str) -> ApiResult<Value> {
    sqlx::query_scalar::<_, Value>(
        r#"
        SELECT order_detail_json(o) || jsonb_build_object('merchantId', o.merchant_id, 'userPhone', u.phone)
        FROM mall_orders o
        LEFT JOIN users u ON u.id = o.user_id
        WHERE o.id = $1
           OR lower(o.order_no) = lower($1)
        "#,
    )
    .bind(order_identifier.trim())
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| ApiError::NotFound("订单不存在".to_string()))
}

async fn apply_weight_adjustment(
    pool: &PgPool,
    order_id: &str,
    body: WeightAdjustmentRequest,
) -> ApiResult<()> {
    let mut tx = pool.begin().await?;
    let order = sqlx::query_as::<_, WeightAdjustmentOrderRow>(
        r#"
        SELECT subtotal_cents, delivery_fee_cents, coupon_cents, payable_cents, estimated_payable_cents
        FROM mall_orders
        WHERE id = $1
        FOR UPDATE
        "#,
    )
    .bind(order_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| ApiError::NotFound("订单不存在".to_string()))?;

    let item = sqlx::query_as::<_, WeightAdjustmentItemRow>(
        r#"
        SELECT id, product_name, unit_price_cents, line_total_cents, estimated_line_total_cents,
               pricing_mode, weight_unit_grams, weight_unit_label
        FROM mall_order_items
        WHERE order_id = $1
          AND id = $2
        FOR UPDATE
        "#,
    )
    .bind(order_id)
    .bind(body.item_id.trim())
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| ApiError::NotFound("订单商品不存在".to_string()))?;

    if item.pricing_mode != "weighed" {
        return Err(ApiError::BadRequest(
            "该订单商品不是称重计价商品".to_string(),
        ));
    }

    let weight_unit_grams = item.weight_unit_grams.unwrap_or(500).max(1);
    let actual_weight_grams = actual_weight_grams_from_request(&body)?;
    let line_total_cents = weighed_line_total_cents(
        item.unit_price_cents,
        actual_weight_grams,
        weight_unit_grams,
    );
    let subtotal_cents = (order.subtotal_cents + line_total_cents - item.line_total_cents).max(0);
    let payable_cents = (subtotal_cents + order.delivery_fee_cents - order.coupon_cents).max(0);
    let estimated_payable_cents = order.estimated_payable_cents.unwrap_or(order.payable_cents);
    let weight_adjustment_cents = payable_cents - estimated_payable_cents;
    let adjusted_by = non_empty(body.adjusted_by).unwrap_or_else(|| "admin".to_string());
    let note = non_empty(body.note);

    sqlx::query(
        r#"
        UPDATE mall_order_items
        SET actual_weight_grams = $3,
            line_total_cents = $4,
            estimated_line_total_cents = COALESCE(estimated_line_total_cents, $5),
            weight_adjustment_status = 'confirmed',
            weight_adjusted_by = $6,
            weight_adjusted_at = now(),
            weight_adjustment_note = $7
        WHERE order_id = $1
          AND id = $2
        "#,
    )
    .bind(order_id)
    .bind(&item.id)
    .bind(actual_weight_grams)
    .bind(line_total_cents)
    .bind(
        item.estimated_line_total_cents
            .unwrap_or(item.line_total_cents),
    )
    .bind(&adjusted_by)
    .bind(&note)
    .execute(&mut *tx)
    .await?;

    let has_pending_weight_adjustment: bool = sqlx::query_scalar(
        r#"
        SELECT EXISTS (
          SELECT 1
          FROM mall_order_items
          WHERE order_id = $1
            AND pricing_mode = 'weighed'
            AND (actual_weight_grams IS NULL OR weight_adjustment_status <> 'confirmed')
        )
        "#,
    )
    .bind(order_id)
    .fetch_one(&mut *tx)
    .await?;
    let order_weight_status = if has_pending_weight_adjustment {
        "pending"
    } else {
        "confirmed"
    };

    sqlx::query(
        r#"
        UPDATE mall_orders
        SET subtotal_cents = $2,
            payable_cents = $3,
            estimated_payable_cents = COALESCE(estimated_payable_cents, $4),
            weight_adjustment_cents = $5,
            weight_adjustment_status = $6,
            updated_at = now()
        WHERE id = $1
        "#,
    )
    .bind(order_id)
    .bind(subtotal_cents)
    .bind(payable_cents)
    .bind(estimated_payable_cents)
    .bind(weight_adjustment_cents)
    .bind(order_weight_status)
    .execute(&mut *tx)
    .await?;

    let unit_label = item.weight_unit_label.unwrap_or_else(|| "斤".to_string());
    let actual_weight_text = weight_text(actual_weight_grams, weight_unit_grams, &unit_label);
    let description = format!(
        "{}实际称重{}，订单金额调整为{}元，差额{}元",
        item.product_name,
        actual_weight_text,
        yuan_amount(payable_cents),
        yuan_amount(weight_adjustment_cents)
    );
    insert_order_event_tx(
        &mut tx,
        order_id,
        "weight_adjusted",
        "称重改价完成",
        &description,
        "done",
    )
    .await?;
    tx.commit().await?;
    Ok(())
}

async fn fetch_delivery_sheets_for_date(pool: &PgPool, sheet_date: &str) -> ApiResult<Vec<Value>> {
    Ok(sqlx::query_scalar::<_, Value>(
        r#"
        SELECT delivery_sheet_json(sheet)
        FROM mall_delivery_sheets sheet
        WHERE sheet.sheet_date = $1::date
        ORDER BY sheet.pickup_point_name ASC
        "#,
    )
    .bind(sheet_date)
    .fetch_all(pool)
    .await?)
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

async fn ensure_product_variant_can_sell(
    pool: &PgPool,
    product_id: &str,
    variant_id: Option<&str>,
    quantity: i32,
) -> ApiResult<ProductVariant> {
    let variant = fetch_product_variant_snapshot(pool, product_id, variant_id).await?;
    if variant.status != "on_sale" {
        return Err(ApiError::NotFound("商品规格不存在或已下架".to_string()));
    }
    if quantity < variant.minimum_order_quantity {
        return Err(ApiError::BadRequest(format!(
            "{} 起订量为 {}",
            variant.name, variant.minimum_order_quantity
        )));
    }
    if variant.stock < quantity {
        return Err(ApiError::BadRequest(format!("{} 库存不足", variant.name)));
    }
    Ok(variant)
}

async fn fetch_product_variant_snapshot(
    pool: &PgPool,
    product_id: &str,
    variant_id: Option<&str>,
) -> ApiResult<ProductVariant> {
    let product = fetch_product_json(pool, product_id).await?;
    if product.get("status").and_then(Value::as_str) != Some("on_sale") {
        return Err(ApiError::NotFound("商品不存在或已下架".to_string()));
    }
    let variants_value = product
        .get("variants")
        .cloned()
        .unwrap_or_else(|| json!([]));
    let variants: Vec<ProductVariant> = serde_json::from_value(variants_value)
        .map_err(|err| ApiError::BadRequest(err.to_string()))?;
    let fallback_variant_id = product
        .get("defaultVariantId")
        .and_then(Value::as_str)
        .or_else(|| variants.first().map(|variant| variant.id.as_str()));
    let variant_id = variant_id
        .and_then(|value| normalize_product_image_value(Some(value)))
        .or_else(|| fallback_variant_id.map(str::to_string))
        .ok_or_else(|| ApiError::BadRequest("商品规格不存在".to_string()))?;
    variants
        .into_iter()
        .find(|variant| variant.id == variant_id)
        .ok_or_else(|| ApiError::BadRequest("商品规格不存在".to_string()))
}

async fn ensure_product_exists(pool: &PgPool, product_id: &str) -> ApiResult<()> {
    let exists: bool =
        sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM mall_products WHERE id = $1)")
            .bind(product_id)
            .fetch_one(pool)
            .await?;
    if !exists {
        return Err(ApiError::NotFound("商品不存在".to_string()));
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

fn normalize_product_image_value(value: Option<&str>) -> Option<String> {
    value.and_then(|value| {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    })
}

fn normalize_product_images(
    image_url: Option<&str>,
    images: Option<&[String]>,
) -> ApiResult<Vec<String>> {
    let mut normalized = Vec::new();
    let primary_image = normalize_product_image_value(image_url);

    if let Some(primary_image) = primary_image.as_ref() {
        normalized.push(primary_image.clone());
    }

    if let Some(images) = images {
        for image in images {
            let Some(image) = normalize_product_image_value(Some(image)) else {
                continue;
            };
            if normalized.iter().any(|current| current == &image) {
                continue;
            }
            normalized.push(image);
        }
    }

    if normalized.len() > MAX_PRODUCT_IMAGES {
        return Err(ApiError::BadRequest(format!(
            "单个商品最多上传 {} 张图片",
            MAX_PRODUCT_IMAGES
        )));
    }

    Ok(normalized)
}

fn primary_product_image_url(image_url: Option<&str>, images: &[String]) -> Option<String> {
    normalize_product_image_value(image_url).or_else(|| images.first().cloned())
}

fn normalize_product_variants(
    variants: Option<&[ProductVariantMutation]>,
    defaults: &ProductVariantDefaults,
) -> ApiResult<Vec<ProductVariant>> {
    let source_variants = variants.unwrap_or(&[]);
    if source_variants.len() > MAX_PRODUCT_VARIANTS {
        return Err(ApiError::BadRequest(format!(
            "单个商品最多配置 {} 个规格",
            MAX_PRODUCT_VARIANTS
        )));
    }

    let mut normalized = Vec::new();
    if source_variants.is_empty() {
        normalized.push(ProductVariant {
            id: "default".to_string(),
            name: defaults.sale_method.clone(),
            sku: defaults.sku.clone(),
            specification: defaults.specification.clone(),
            sale_method: defaults.sale_method.clone(),
            price_cents: defaults.price_cents,
            original_price_cents: defaults.original_price_cents,
            supply_price_cents: defaults.supply_price_cents,
            stock: defaults.stock,
            minimum_order_quantity: defaults.minimum_order_quantity,
            status: defaults.status.clone(),
            sort_order: 1,
            pricing_mode: default_product_variant_pricing_mode(),
            weight_unit: default_product_variant_weight_unit(),
            weight_unit_label: default_product_variant_weight_unit_label(),
            weight_unit_grams: default_product_variant_weight_unit_grams(),
            weight_tolerance_bps: default_product_variant_weight_tolerance_bps(),
        });
    } else {
        for (index, variant) in source_variants.iter().enumerate() {
            let name = normalize_product_image_value(variant.name.as_deref())
                .or_else(|| normalize_product_image_value(variant.sale_method.as_deref()))
                .or_else(|| normalize_product_image_value(variant.specification.as_deref()))
                .unwrap_or_else(|| format!("规格{}", index + 1));
            let id = normalize_product_variant_id(variant.id.as_deref(), &name, index);
            if normalized
                .iter()
                .any(|current: &ProductVariant| current.id == id)
            {
                return Err(ApiError::BadRequest("规格ID不能重复".to_string()));
            }
            let price_cents = variant.price_cents.unwrap_or(defaults.price_cents);
            if price_cents <= 0 {
                return Err(ApiError::BadRequest("规格售价必须大于0".to_string()));
            }
            let stock = variant.stock.unwrap_or(defaults.stock);
            if stock < 0 {
                return Err(ApiError::BadRequest("规格库存不能小于0".to_string()));
            }
            let minimum_order_quantity = variant
                .minimum_order_quantity
                .unwrap_or(defaults.minimum_order_quantity);
            validate_positive_i32(minimum_order_quantity, "规格最小起订量必须大于0")?;
            let status =
                normalize_product_variant_status(variant.status.as_deref(), &defaults.status)?;
            let pricing_mode =
                normalize_product_variant_pricing_mode(variant.pricing_mode.as_deref())?;
            let weight_unit = normalize_product_variant_weight_unit(variant.weight_unit.as_deref());
            let weight_unit_label = normalize_product_variant_weight_unit_label(
                variant.weight_unit_label.as_deref(),
                &weight_unit,
            );
            let weight_unit_grams = normalize_product_variant_weight_unit_grams(
                variant.weight_unit_grams,
                &weight_unit,
            )?;
            let weight_tolerance_bps =
                normalize_product_variant_weight_tolerance_bps(variant.weight_tolerance_bps)?;
            normalized.push(ProductVariant {
                id,
                name,
                sku: normalize_product_image_value(variant.sku.as_deref())
                    .unwrap_or_else(|| defaults.sku.clone()),
                specification: normalize_product_image_value(variant.specification.as_deref())
                    .unwrap_or_else(|| defaults.specification.clone()),
                sale_method: normalize_product_image_value(variant.sale_method.as_deref())
                    .unwrap_or_else(|| defaults.sale_method.clone()),
                price_cents,
                original_price_cents: variant
                    .original_price_cents
                    .or(defaults.original_price_cents),
                supply_price_cents: variant.supply_price_cents.or(defaults.supply_price_cents),
                stock,
                minimum_order_quantity,
                status,
                sort_order: variant.sort_order.unwrap_or((index + 1) as i32),
                pricing_mode,
                weight_unit,
                weight_unit_label,
                weight_unit_grams,
                weight_tolerance_bps,
            });
        }
    }

    if normalized.is_empty() {
        return Err(ApiError::BadRequest("至少需要一个商品规格".to_string()));
    }

    Ok(normalized)
}

fn default_product_variant_pricing_mode() -> String {
    "fixed".to_string()
}

fn default_product_variant_weight_unit() -> String {
    "jin".to_string()
}

fn default_product_variant_weight_unit_label() -> String {
    "斤".to_string()
}

fn default_product_variant_weight_unit_grams() -> i32 {
    500
}

fn default_product_variant_weight_tolerance_bps() -> i32 {
    500
}

fn normalize_product_variant_pricing_mode(value: Option<&str>) -> ApiResult<String> {
    let mode = value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("fixed")
        .to_string();
    if matches!(mode.as_str(), "fixed" | "weighed") {
        Ok(mode)
    } else {
        Err(ApiError::BadRequest("规格计价方式不正确".to_string()))
    }
}

fn normalize_product_variant_weight_unit(value: Option<&str>) -> String {
    value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("jin")
        .to_string()
}

fn normalize_product_variant_weight_unit_label(value: Option<&str>, unit: &str) -> String {
    value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .unwrap_or_else(|| match unit {
            "kg" => "公斤".to_string(),
            "g" => "克".to_string(),
            _ => "斤".to_string(),
        })
}

fn normalize_product_variant_weight_unit_grams(value: Option<i32>, unit: &str) -> ApiResult<i32> {
    let grams = value.unwrap_or_else(|| match unit {
        "kg" => 1000,
        "g" => 1,
        _ => 500,
    });
    validate_positive_i32(grams, "称重单位克重必须大于0")?;
    Ok(grams)
}

fn normalize_product_variant_weight_tolerance_bps(value: Option<i32>) -> ApiResult<i32> {
    let bps = value.unwrap_or_else(default_product_variant_weight_tolerance_bps);
    if (0..=5000).contains(&bps) {
        Ok(bps)
    } else {
        Err(ApiError::BadRequest(
            "称重浮动范围需在0%-50%之间".to_string(),
        ))
    }
}

fn normalize_product_variant_id(value: Option<&str>, name: &str, index: usize) -> String {
    normalize_product_image_value(value).unwrap_or_else(|| {
        let slug = name
            .chars()
            .map(|character| {
                if character.is_ascii_alphanumeric() {
                    character.to_ascii_lowercase()
                } else {
                    '-'
                }
            })
            .collect::<String>()
            .trim_matches('-')
            .to_string();
        if slug.is_empty() {
            format!("variant-{}", index + 1)
        } else {
            slug
        }
    })
}

fn normalize_product_variant_status(value: Option<&str>, fallback: &str) -> ApiResult<String> {
    let status = value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(fallback)
        .to_string();
    if matches!(status.as_str(), "on_sale" | "off_sale" | "draft") {
        Ok(status)
    } else {
        Err(ApiError::BadRequest("规格状态不正确".to_string()))
    }
}

fn display_product_variant(variants: &[ProductVariant]) -> &ProductVariant {
    variants
        .iter()
        .find(|variant| variant.status == "on_sale" && variant.stock > 0)
        .or_else(|| variants.iter().find(|variant| variant.status == "on_sale"))
        .unwrap_or(&variants[0])
}

fn total_product_variant_stock(variants: &[ProductVariant]) -> i32 {
    variants
        .iter()
        .filter(|variant| variant.status == "on_sale")
        .map(|variant| variant.stock.max(0))
        .sum()
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

fn normalize_coupon_code(code: &str) -> String {
    code.trim().to_ascii_uppercase().replace(' ', "-")
}

fn validate_category_status(status: &str) -> ApiResult<()> {
    if matches!(status, "active" | "inactive" | "deleted") {
        Ok(())
    } else {
        Err(ApiError::BadRequest("品类状态不正确".to_string()))
    }
}

fn validate_pickup_point_status(status: &str) -> ApiResult<()> {
    if matches!(status, "active" | "inactive" | "deleted") {
        Ok(())
    } else {
        Err(ApiError::BadRequest("自提点状态不正确".to_string()))
    }
}

fn validate_group_leader_status(status: &str) -> ApiResult<()> {
    if matches!(status, "active" | "inactive" | "deleted") {
        Ok(())
    } else {
        Err(ApiError::BadRequest("团长状态不正确".to_string()))
    }
}

fn validate_procurement_buyer_status(status: &str) -> ApiResult<()> {
    if matches!(status, "active" | "inactive" | "deleted") {
        Ok(())
    } else {
        Err(ApiError::BadRequest("采购商状态不正确".to_string()))
    }
}

fn validate_qualification_report_status(status: &str) -> ApiResult<()> {
    if matches!(status, "active" | "inactive" | "deleted") {
        Ok(())
    } else {
        Err(ApiError::BadRequest("资质报告状态不正确".to_string()))
    }
}

fn validate_coupon_type(coupon_type: &str) -> ApiResult<()> {
    if matches!(
        coupon_type,
        "full_reduction" | "cash" | "delivery" | "new_user"
    ) {
        Ok(())
    } else {
        Err(ApiError::BadRequest("优惠券类型不正确".to_string()))
    }
}

fn validate_coupon_status(status: &str) -> ApiResult<()> {
    if matches!(
        status,
        "active" | "draft" | "inactive" | "expired" | "deleted"
    ) {
        Ok(())
    } else {
        Err(ApiError::BadRequest("优惠券状态不正确".to_string()))
    }
}

fn validate_home_banner_status(status: &str) -> ApiResult<()> {
    if matches!(status, "active" | "draft" | "inactive") {
        Ok(())
    } else {
        Err(ApiError::BadRequest("首页配置状态不正确".to_string()))
    }
}

fn validate_home_section_type(section_type: &str) -> ApiResult<()> {
    if matches!(
        section_type,
        "announcement" | "flash_sale" | "new_arrival" | "best_seller"
    ) {
        Ok(())
    } else {
        Err(ApiError::BadRequest("首页专区类型不正确".to_string()))
    }
}

fn normalize_product_status(status: &str) -> ApiResult<String> {
    let normalized = status.trim().to_ascii_lowercase();
    if matches!(
        normalized.as_str(),
        "on_sale" | "off_sale" | "draft" | "inactive"
    ) {
        Ok(normalized)
    } else {
        Err(ApiError::BadRequest("商品上下架状态不正确".to_string()))
    }
}

fn validate_listing_request_type(request_type: &str) -> ApiResult<()> {
    if matches!(
        request_type,
        "status_change" | "new_product" | "stock_update" | "listing" | "delisting"
    ) {
        Ok(())
    } else {
        Err(ApiError::BadRequest("上下架申请类型不正确".to_string()))
    }
}

fn validate_listing_requester_role(role: &str) -> ApiResult<()> {
    if matches!(role, "admin" | "supplier") {
        Ok(())
    } else {
        Err(ApiError::BadRequest("运营账号类型不正确".to_string()))
    }
}

fn normalize_listing_review_status(status: &str) -> ApiResult<String> {
    let normalized = status.trim().to_ascii_lowercase();
    if matches!(normalized.as_str(), "approved" | "rejected") {
        Ok(normalized)
    } else {
        Err(ApiError::BadRequest("审核状态不正确".to_string()))
    }
}

fn normalize_delivery_sheet_status(status: &str) -> ApiResult<String> {
    let normalized = status.trim().to_ascii_lowercase();
    if matches!(
        normalized.as_str(),
        "generated" | "shipped" | "delivered" | "cancelled"
    ) {
        Ok(normalized)
    } else {
        Err(ApiError::BadRequest("配送单状态不正确".to_string()))
    }
}

fn normalize_stats_period(period: &str) -> ApiResult<String> {
    let normalized = period.trim().to_ascii_lowercase();
    match normalized.as_str() {
        "day" | "7d" | "14d" | "30d" | "90d" => Ok("day".to_string()),
        "week" => Ok("week".to_string()),
        "month" => Ok("month".to_string()),
        _ => Err(ApiError::BadRequest("统计周期不正确".to_string())),
    }
}

fn validate_home_banner_link_type(link_type: &str) -> ApiResult<()> {
    if matches!(
        link_type,
        "none" | "category" | "product" | "search" | "activity" | "url"
    ) {
        Ok(())
    } else {
        Err(ApiError::BadRequest("首页配置跳转类型不正确".to_string()))
    }
}

fn validate_permission_status(status: &str) -> ApiResult<()> {
    if matches!(status, "active" | "inactive" | "draft") {
        Ok(())
    } else {
        Err(ApiError::BadRequest("权限状态不正确".to_string()))
    }
}

fn validate_permission_module(module: &str) -> ApiResult<()> {
    if matches!(
        module,
        "products"
            | "orders"
            | "marketing"
            | "support"
            | "finance"
            | "settings"
            | "data"
            | "leaders"
    ) {
        Ok(())
    } else {
        Err(ApiError::BadRequest("权限模块不正确".to_string()))
    }
}

fn validate_permission_action(action: &str) -> ApiResult<()> {
    if matches!(
        action,
        "view" | "create" | "update" | "delete" | "approve" | "refund" | "export" | "dispatch"
    ) {
        Ok(())
    } else {
        Err(ApiError::BadRequest("权限动作不正确".to_string()))
    }
}

fn normalize_permission_key(value: &str) -> String {
    value
        .trim()
        .to_lowercase()
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || ch == '_' || ch == '-' {
                ch
            } else {
                '_'
            }
        })
        .collect()
}

fn normalize_permission_modules(modules: Option<Vec<String>>) -> ApiResult<Vec<String>> {
    let mut normalized = Vec::new();
    for module in modules.unwrap_or_default() {
        let value = module.trim().to_string();
        if value.is_empty() {
            continue;
        }
        validate_permission_module(&value)?;
        if !normalized.contains(&value) {
            normalized.push(value);
        }
    }
    if normalized.is_empty() {
        return Err(ApiError::BadRequest("至少选择一个权限模块".to_string()));
    }
    Ok(normalized)
}

fn normalize_permission_actions(actions: Option<Vec<String>>) -> ApiResult<Vec<String>> {
    let mut normalized = Vec::new();
    for action in actions.unwrap_or_default() {
        let value = action.trim().to_string();
        if value.is_empty() {
            continue;
        }
        validate_permission_action(&value)?;
        if !normalized.contains(&value) {
            normalized.push(value);
        }
    }
    if normalized.is_empty() {
        return Err(ApiError::BadRequest("至少选择一个权限动作".to_string()));
    }
    Ok(normalized)
}

fn validate_non_negative_i64(value: i64, message: &str) -> ApiResult<()> {
    if value < 0 {
        Err(ApiError::BadRequest(message.to_string()))
    } else {
        Ok(())
    }
}

fn validate_positive_i64(value: i64, message: &str) -> ApiResult<()> {
    if value <= 0 {
        Err(ApiError::BadRequest(message.to_string()))
    } else {
        Ok(())
    }
}

fn validate_non_negative_i32(value: i32, message: &str) -> ApiResult<()> {
    if value < 0 {
        Err(ApiError::BadRequest(message.to_string()))
    } else {
        Ok(())
    }
}

fn validate_positive_i32(value: i32, message: &str) -> ApiResult<()> {
    if value <= 0 {
        Err(ApiError::BadRequest(message.to_string()))
    } else {
        Ok(())
    }
}

fn validate_optional_non_negative_i32(value: Option<i32>, message: &str) -> ApiResult<()> {
    if value.is_some_and(|next| next < 0) {
        Err(ApiError::BadRequest(message.to_string()))
    } else {
        Ok(())
    }
}

fn validate_optional_non_negative_i64(value: Option<i64>, message: &str) -> ApiResult<()> {
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

fn validate_after_sale_status(status: &str) -> ApiResult<()> {
    if matches!(
        status,
        "submitted"
            | "approved"
            | "processing"
            | "refunding"
            | "refunded"
            | "rejected"
            | "resolved"
            | "closed"
    ) {
        Ok(())
    } else {
        Err(ApiError::BadRequest("售后状态不正确".to_string()))
    }
}

fn refund_status_for_after_sale(status: &str) -> Option<&'static str> {
    match status {
        "approved" | "refunding" => Some("approved"),
        "refunded" | "resolved" | "closed" => Some("refunded"),
        "rejected" => Some("rejected"),
        _ => None,
    }
}

fn order_after_sale_status(status: &str) -> &'static str {
    match status {
        "approved" => "approved",
        "processing" => "processing",
        "refunding" => "refunding",
        "refunded" => "refunded",
        "rejected" => "rejected",
        "resolved" => "resolved",
        "closed" => "closed",
        _ => "processing",
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

fn after_sale_status_title(status: &str) -> &'static str {
    match status {
        "approved" => "售后审核通过",
        "processing" => "售后处理中",
        "refunding" => "退款处理中",
        "refunded" => "退款已完成",
        "rejected" => "售后已驳回",
        "resolved" => "售后已解决",
        "closed" => "售后已关闭",
        _ => "售后申请已提交",
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

fn extension_for_qualification_file(content_type: Option<&str>) -> Option<&'static str> {
    match content_type {
        Some("application/pdf") => Some("pdf"),
        value => extension_for_product_image(value),
    }
}

/// 获取可用的配送时间段列表
/// 时间段按一小时划分，从 08:00 到 21:00
async fn get_delivery_time_slots<S>(
    _state: State<AppState<S>>,
) -> ApiResult<Json<ApiEnvelope<Value>>>
where
    S: Storage,
{
    // 硬编码的时间段列表（08:00-21:00，每小时一个时间段）
    let slots = vec![
        json!({"slot": "08:00-09:00", "label": "08:00-09:00"}),
        json!({"slot": "09:00-10:00", "label": "09:00-10:00"}),
        json!({"slot": "10:00-11:00", "label": "10:00-11:00"}),
        json!({"slot": "11:00-12:00", "label": "11:00-12:00"}),
        json!({"slot": "12:00-13:00", "label": "12:00-13:00"}),
        json!({"slot": "13:00-14:00", "label": "13:00-14:00"}),
        json!({"slot": "14:00-15:00", "label": "14:00-15:00"}),
        json!({"slot": "15:00-16:00", "label": "15:00-16:00"}),
        json!({"slot": "16:00-17:00", "label": "16:00-17:00"}),
        json!({"slot": "17:00-18:00", "label": "17:00-18:00"}),
        json!({"slot": "18:00-19:00", "label": "18:00-19:00"}),
        json!({"slot": "19:00-20:00", "label": "19:00-20:00"}),
        json!({"slot": "20:00-21:00", "label": "20:00-21:00"}),
    ];

    Ok(ok(
        "获取成功",
        json!({
            "slots": slots,
            "description": "配送时间段按一小时划分，请在下单时选择期望的配送时间段"
        }),
    ))
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
