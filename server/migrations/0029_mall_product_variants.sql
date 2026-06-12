ALTER TABLE IF EXISTS mall_products
  ADD COLUMN IF NOT EXISTS variants jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE mall_products
SET variants = jsonb_build_array(jsonb_build_object(
  'id', 'default',
  'name', COALESCE(NULLIF(sale_method, ''), NULLIF(specification, ''), '默认规格'),
  'sku', sku,
  'specification', COALESCE(NULLIF(specification, ''), NULLIF(subtitle, ''), '默认规格'),
  'saleMethod', COALESCE(NULLIF(sale_method, ''), NULLIF(specification, ''), '按份'),
  'priceCents', price_cents,
  'originalPriceCents', original_price_cents,
  'supplyPriceCents', supply_price_cents,
  'stock', stock,
  'minimumOrderQuantity', minimum_order_quantity,
  'status', status,
  'sortOrder', 1
))
WHERE variants = '[]'::jsonb;

ALTER TABLE IF EXISTS mall_cart_items
  ADD COLUMN IF NOT EXISTS variant_id text NOT NULL DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS variant_name text;

UPDATE mall_cart_items
SET variant_id = 'default'
WHERE variant_id IS NULL OR btrim(variant_id) = '';

DROP INDEX IF EXISTS mall_cart_items_user_product_uidx;

CREATE UNIQUE INDEX IF NOT EXISTS mall_cart_items_user_product_variant_uidx
  ON mall_cart_items (user_id, product_id, variant_id);

ALTER TABLE IF EXISTS mall_checkouts
  ADD COLUMN IF NOT EXISTS variant_id text;

ALTER TABLE IF EXISTS mall_order_items
  ADD COLUMN IF NOT EXISTS variant_id text,
  ADD COLUMN IF NOT EXISTS variant_name text;

CREATE OR REPLACE FUNCTION product_json(product mall_products, category_name text)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'id', product.id,
    'categoryId', product.category_id,
    'categoryCode', product.category_code,
    'categoryName', category_name,
    'sku', product.sku,
    'name', product.name,
    'subtitle', product.subtitle,
    'description', product.description,
    'imageKey', product.image_url,
    'imageUrl', product.image_url,
    'imageKeys', product.images,
    'images', CASE
      WHEN jsonb_typeof(product.images) = 'array' AND jsonb_array_length(product.images) > 0 THEN product.images
      WHEN product.image_url IS NOT NULL AND btrim(product.image_url) <> '' THEN jsonb_build_array(product.image_url)
      ELSE '[]'::jsonb
    END,
    'variants', CASE
      WHEN jsonb_typeof(product.variants) = 'array' AND jsonb_array_length(product.variants) > 0 THEN product.variants
      ELSE jsonb_build_array(jsonb_build_object(
        'id', 'default',
        'name', COALESCE(NULLIF(product.sale_method, ''), NULLIF(product.specification, ''), '默认规格'),
        'sku', product.sku,
        'specification', COALESCE(NULLIF(product.specification, ''), NULLIF(product.subtitle, ''), '默认规格'),
        'saleMethod', COALESCE(NULLIF(product.sale_method, ''), NULLIF(product.specification, ''), '按份'),
        'priceCents', product.price_cents,
        'originalPriceCents', product.original_price_cents,
        'supplyPriceCents', product.supply_price_cents,
        'stock', product.stock,
        'minimumOrderQuantity', product.minimum_order_quantity,
        'status', product.status,
        'sortOrder', 1
      ))
    END,
    'defaultVariantId', COALESCE(product.variants->0->>'id', 'default'),
    'specification', product.specification,
    'saleMethod', product.sale_method,
    'supplyPriceCents', product.supply_price_cents,
    'priceCents', product.price_cents,
    'originalPriceCents', product.original_price_cents,
    'stock', product.stock,
    'stockAlertThreshold', product.stock_alert_threshold,
    'minimumOrderQuantity', product.minimum_order_quantity,
    'soldCount', product.sold_count,
    'rating', product.rating,
    'status', product.status,
    'tags', product.tags,
    'deliveryMinutes', product.delivery_minutes,
    'coldChainRequired', product.cold_chain_required,
    'lengthCm', product.length_cm,
    'widthCm', product.width_cm,
    'heightCm', product.height_cm,
    'volumeLiters', product.volume_liters,
    'weightKg', product.weight_kg,
    'createdAt', product.created_at,
    'updatedAt', product.updated_at
  )
$$;

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
        'variantId', item.variant_id,
        'variantName', item.variant_name,
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
