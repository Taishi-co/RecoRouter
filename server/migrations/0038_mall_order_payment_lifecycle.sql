ALTER TABLE IF EXISTS mall_orders
  ADD COLUMN IF NOT EXISTS checkout_id text,
  ADD COLUMN IF NOT EXISTS payment_expires_at timestamptz;

UPDATE mall_orders
SET payment_expires_at = created_at + interval '10 minutes'
WHERE payment_expires_at IS NULL
  AND status = 'pending_payment';

CREATE UNIQUE INDEX IF NOT EXISTS mall_orders_checkout_id_uidx
  ON mall_orders (checkout_id)
  WHERE checkout_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS mall_orders_payment_expiry_idx
  ON mall_orders (status, payment_status, payment_expires_at);

CREATE OR REPLACE FUNCTION order_summary_json(mall_order mall_orders)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'id', mall_order.id,
    'orderNo', mall_order.order_no,
    'userId', mall_order.user_id,
    'checkoutId', mall_order.checkout_id,
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
    'estimatedPayableCents', mall_order.estimated_payable_cents,
    'weightAdjustmentStatus', mall_order.weight_adjustment_status,
    'weightAdjustmentCents', mall_order.weight_adjustment_cents,
    'paymentStatus', mall_order.payment_status,
    'paymentExpiresAt', mall_order.payment_expires_at,
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
        'variantId', item.variant_id,
        'variantName', item.variant_name,
        'sku', item.sku,
        'productName', item.product_name,
        'categoryCode', item.category_code,
        'imageUrl', item.image_url,
        'unitPriceCents', item.unit_price_cents,
        'quantity', item.quantity,
        'lineTotalCents', item.line_total_cents,
        'estimatedLineTotalCents', item.estimated_line_total_cents,
        'pricingMode', item.pricing_mode,
        'estimatedWeightGrams', item.estimated_weight_grams,
        'actualWeightGrams', item.actual_weight_grams,
        'weightUnit', item.weight_unit,
        'weightUnitLabel', item.weight_unit_label,
        'weightUnitGrams', item.weight_unit_grams,
        'weightToleranceBps', item.weight_tolerance_bps,
        'weightAdjustmentStatus', item.weight_adjustment_status,
        'weightAdjustmentNote', item.weight_adjustment_note,
        'weightAdjustedAt', item.weight_adjusted_at
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
    'addressId', mall_order.address_id,
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
      SELECT jsonb_agg(mall_after_sale_json(sale) ORDER BY sale.created_at DESC)
      FROM mall_after_sales sale
      WHERE sale.order_id = mall_order.id
    ), '[]'::jsonb)
  )
$$;
