CREATE TABLE IF NOT EXISTS mall_checkouts (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id text NOT NULL,
  source text NOT NULL DEFAULT 'cart',
  product_id text,
  quantity integer NOT NULL DEFAULT 1,
  address_id text,
  pickup_point_id text,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '30 minutes',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mall_checkouts_user_created_idx
  ON mall_checkouts (user_id, created_at DESC);

ALTER TABLE IF EXISTS mall_addresses
  ADD COLUMN IF NOT EXISTS pickup_point_id text;

CREATE INDEX IF NOT EXISTS mall_addresses_pickup_point_idx
  ON mall_addresses (pickup_point_id, updated_at DESC);

UPDATE mall_campaigns
SET name = '满49减6',
    campaign_type = 'full_reduction',
    rules = '{"thresholdCents":4900,"discountCents":600}'::jsonb,
    updated_at = now()
WHERE name = '满99免配送'
  AND campaign_type = 'delivery_discount'
  AND rules = '{"thresholdCents":9900,"discountCents":600}'::jsonb;

CREATE OR REPLACE FUNCTION order_summary_json(mall_order mall_orders)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'id', mall_order.id,
    'orderNo', mall_order.order_no,
    'userId', mall_order.user_id,
    'addressId', mall_order.address_id,
    'pickupPointId', mall_order.pickup_point_id,
    'pickupPointName', point.name,
    'groupLeaderName', point.leader_name,
    'groupLeaderPhone', point.leader_phone,
    'addressText', mall_order.address_text,
    'deliveryMethod', mall_order.delivery_method,
    'pickupMethod', mall_order.pickup_method,
    'expectedDeliveryWindow', mall_order.expected_delivery_window,
    'subtotalCents', mall_order.subtotal_cents,
    'deliveryFeeCents', mall_order.delivery_fee_cents,
    'couponCents', mall_order.coupon_cents,
    'payableCents', mall_order.payable_cents,
    'paymentStatus', mall_order.payment_status,
    'status', mall_order.status,
    'fulfillmentStatus', mall_order.fulfillment_status,
    'refundStatus', mall_order.refund_status,
    'afterSaleStatus', mall_order.after_sale_status,
    'vehicleCode', mall_order.vehicle_code,
    'trackingDistanceKm', mall_order.tracking_distance_km,
    'cabinCode', mall_order.cabin_code,
    'createdAt', mall_order.created_at,
    'updatedAt', mall_order.updated_at,
    'fulfillmentCode', (
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
      WHERE code.order_id = mall_order.id
      ORDER BY code.created_at DESC
      LIMIT 1
    ),
    'items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', item.id,
        'productId', item.product_id,
        'sku', item.sku,
        'productName', item.product_name,
        'categoryCode', item.category_code,
        'imageUrl', item.image_url,
        'unitPriceCents', item.unit_price_cents,
        'quantity', item.quantity,
        'lineTotalCents', item.line_total_cents
      ) ORDER BY item.created_at ASC)
      FROM mall_order_items item
      WHERE item.order_id = mall_order.id
    ), '[]'::jsonb)
  )
  FROM (SELECT 1) seed
  LEFT JOIN mall_pickup_points point ON point.id = mall_order.pickup_point_id
$$;

CREATE OR REPLACE FUNCTION order_detail_json(mall_order mall_orders)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT order_summary_json(mall_order) || jsonb_build_object(
    'recipientName', mall_order.recipient_name,
    'recipientPhone', mall_order.recipient_phone,
    'latitude', mall_order.latitude,
    'longitude', mall_order.longitude,
    'remark', mall_order.remark,
    'paidAt', mall_order.paid_at,
    'dispatchedAt', mall_order.dispatched_at,
    'completedAt', mall_order.completed_at,
    'cancelledAt', mall_order.cancelled_at,
    'events', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', event.id,
        'stage', event.stage,
        'title', event.title,
        'description', event.description,
        'status', event.status,
        'eventTime', event.event_time,
        'metadata', event.metadata
      ) ORDER BY event.event_time ASC, event.id ASC)
      FROM mall_order_events event
      WHERE event.order_id = mall_order.id
    ), '[]'::jsonb),
    'fulfillmentEvents', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', event.id,
        'orderId', event.order_id,
        'fulfillmentCodeId', event.fulfillment_code_id,
        'eventType', event.event_type,
        'title', event.title,
        'description', event.description,
        'metadata', event.metadata,
        'createdAt', event.created_at
      ) ORDER BY event.created_at ASC, event.id ASC)
      FROM mall_fulfillment_events event
      WHERE event.order_id = mall_order.id
    ), '[]'::jsonb),
    'afterSales', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', sale.id,
        'reason', sale.reason,
        'description', sale.description,
        'amountCents', sale.amount_cents,
        'status', sale.status,
        'handlingMethod', sale.handling_method,
        'createdAt', sale.created_at
      ) ORDER BY sale.created_at DESC)
      FROM mall_after_sales sale
      WHERE sale.order_id = mall_order.id
    ), '[]'::jsonb)
  )
$$;
