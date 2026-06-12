ALTER TABLE IF EXISTS mall_orders
  ADD COLUMN IF NOT EXISTS weight_adjustment_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS weight_adjustment_cents bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estimated_payable_cents bigint;

UPDATE mall_orders
SET estimated_payable_cents = payable_cents
WHERE estimated_payable_cents IS NULL;

ALTER TABLE IF EXISTS mall_order_items
  ADD COLUMN IF NOT EXISTS pricing_mode text NOT NULL DEFAULT 'fixed',
  ADD COLUMN IF NOT EXISTS estimated_weight_grams integer,
  ADD COLUMN IF NOT EXISTS actual_weight_grams integer,
  ADD COLUMN IF NOT EXISTS weight_unit text,
  ADD COLUMN IF NOT EXISTS weight_unit_label text,
  ADD COLUMN IF NOT EXISTS weight_unit_grams integer,
  ADD COLUMN IF NOT EXISTS weight_tolerance_bps integer,
  ADD COLUMN IF NOT EXISTS estimated_line_total_cents bigint,
  ADD COLUMN IF NOT EXISTS weight_adjustment_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS weight_adjusted_by text,
  ADD COLUMN IF NOT EXISTS weight_adjusted_at timestamptz,
  ADD COLUMN IF NOT EXISTS weight_adjustment_note text;

UPDATE mall_order_items
SET estimated_line_total_cents = line_total_cents
WHERE estimated_line_total_cents IS NULL;

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
    'estimatedPayableCents', mall_order.estimated_payable_cents,
    'weightAdjustmentStatus', mall_order.weight_adjustment_status,
    'weightAdjustmentCents', mall_order.weight_adjustment_cents,
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
