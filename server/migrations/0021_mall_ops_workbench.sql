ALTER TABLE IF EXISTS mall_products
  ADD COLUMN IF NOT EXISTS supply_price_cents bigint NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS mall_product_listing_requests (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  product_id text NOT NULL,
  request_type text NOT NULL DEFAULT 'status_change',
  requested_status text NOT NULL,
  requester_id text,
  requester_role text NOT NULL DEFAULT 'admin',
  supplier_id text,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by text,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mall_listing_requests_product_idx
  ON mall_product_listing_requests (product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS mall_listing_requests_status_idx
  ON mall_product_listing_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS mall_listing_requests_supplier_idx
  ON mall_product_listing_requests (supplier_id, created_at DESC);

CREATE TABLE IF NOT EXISTS mall_delivery_sheets (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  sheet_date date NOT NULL,
  pickup_point_id text NOT NULL DEFAULT 'unassigned',
  pickup_point_name text NOT NULL DEFAULT '未分配自提点',
  community_name text,
  status text NOT NULL DEFAULT 'generated',
  order_count integer NOT NULL DEFAULT 0,
  item_count integer NOT NULL DEFAULT 0,
  total_payable_cents bigint NOT NULL DEFAULT 0,
  generated_by text,
  generated_at timestamptz DEFAULT now(),
  shipped_at timestamptz,
  delivered_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS mall_delivery_sheets_date_pickup_uidx
  ON mall_delivery_sheets (sheet_date, pickup_point_id);
CREATE INDEX IF NOT EXISTS mall_delivery_sheets_status_idx
  ON mall_delivery_sheets (status, sheet_date DESC);

CREATE TABLE IF NOT EXISTS mall_settlement_records (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  period_type text NOT NULL DEFAULT 'day',
  period_start date NOT NULL,
  period_end date NOT NULL,
  supplier_id text,
  supply_amount_cents bigint NOT NULL DEFAULT 0,
  refund_amount_cents bigint NOT NULL DEFAULT 0,
  settlement_amount_cents bigint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  voucher_url text,
  paid_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mall_settlement_records_period_idx
  ON mall_settlement_records (period_type, period_start DESC);
CREATE INDEX IF NOT EXISTS mall_settlement_records_supplier_idx
  ON mall_settlement_records (supplier_id, period_start DESC);

CREATE TABLE IF NOT EXISTS mall_withdrawal_requests (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  requester_id text,
  requester_role text NOT NULL DEFAULT 'admin',
  supplier_id text,
  amount_cents bigint NOT NULL,
  status text NOT NULL DEFAULT 'submitted',
  bank_account_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  reviewed_by text,
  reviewed_at timestamptz,
  paid_at timestamptz,
  voucher_url text,
  note text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mall_withdrawal_requests_status_idx
  ON mall_withdrawal_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS mall_withdrawal_requests_supplier_idx
  ON mall_withdrawal_requests (supplier_id, created_at DESC);

CREATE OR REPLACE FUNCTION delivery_sheet_json(sheet mall_delivery_sheets)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'id', sheet.id,
    'sheetDate', sheet.sheet_date,
    'pickupPointId', sheet.pickup_point_id,
    'pickupPointName', sheet.pickup_point_name,
    'communityName', sheet.community_name,
    'status', sheet.status,
    'orderCount', sheet.order_count,
    'itemCount', sheet.item_count,
    'totalPayableCents', sheet.total_payable_cents,
    'generatedBy', sheet.generated_by,
    'generatedAt', sheet.generated_at,
    'shippedAt', sheet.shipped_at,
    'deliveredAt', sheet.delivered_at,
    'metadata', sheet.metadata,
    'createdAt', sheet.created_at,
    'updatedAt', sheet.updated_at
  )
$$;

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
    'supplyPriceCents', product.supply_price_cents,
    'priceCents', product.price_cents,
    'originalPriceCents', product.original_price_cents,
    'stock', product.stock,
    'stockAlertThreshold', product.stock_alert_threshold,
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
