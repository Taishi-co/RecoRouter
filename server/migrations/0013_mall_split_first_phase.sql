ALTER TABLE IF EXISTS mall_orders
  ADD COLUMN IF NOT EXISTS pickup_point_id text,
  ADD COLUMN IF NOT EXISTS fulfillment_status text NOT NULL DEFAULT 'not_ready';

CREATE INDEX IF NOT EXISTS mall_orders_pickup_point_idx ON mall_orders (pickup_point_id, created_at DESC);
CREATE INDEX IF NOT EXISTS mall_orders_fulfillment_status_idx ON mall_orders (fulfillment_status, created_at DESC);

CREATE TABLE IF NOT EXISTS mall_addresses (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id text NOT NULL,
  contact_name text,
  contact_phone text,
  address_label text,
  address_text text NOT NULL,
  latitude numeric,
  longitude numeric,
  address_type text NOT NULL DEFAULT 'home',
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mall_addresses_user_created_idx ON mall_addresses (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS mall_addresses_user_default_idx ON mall_addresses (user_id, is_default, updated_at DESC);
CREATE INDEX IF NOT EXISTS mall_addresses_type_idx ON mall_addresses (address_type, updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS mall_addresses_one_default_per_user_uidx ON mall_addresses (user_id) WHERE is_default;

CREATE TABLE IF NOT EXISTS mall_pickup_points (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name text NOT NULL,
  address_text text NOT NULL,
  latitude numeric,
  longitude numeric,
  business_hours text,
  status text NOT NULL DEFAULT 'active',
  community_name text,
  leader_name text,
  leader_phone text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mall_pickup_points_status_sort_idx ON mall_pickup_points (status, sort_order, created_at DESC);
CREATE INDEX IF NOT EXISTS mall_pickup_points_community_idx ON mall_pickup_points (community_name, status, sort_order);

CREATE TABLE IF NOT EXISTS mall_group_leaders (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  pickup_point_id text NOT NULL,
  name text NOT NULL,
  phone text,
  status text NOT NULL DEFAULT 'active',
  service_note text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mall_group_leaders_pickup_status_idx ON mall_group_leaders (pickup_point_id, status);
CREATE INDEX IF NOT EXISTS mall_group_leaders_phone_idx ON mall_group_leaders (phone);

CREATE TABLE IF NOT EXISTS mall_fulfillment_codes (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  order_id text NOT NULL,
  user_id text NOT NULL,
  pickup_point_id text,
  code text NOT NULL,
  status text NOT NULL DEFAULT 'ready',
  verified_by text,
  verified_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS mall_fulfillment_codes_code_uidx ON mall_fulfillment_codes (code);
CREATE UNIQUE INDEX IF NOT EXISTS mall_fulfillment_codes_order_ready_uidx ON mall_fulfillment_codes (order_id) WHERE status = 'ready';
CREATE INDEX IF NOT EXISTS mall_fulfillment_codes_order_idx ON mall_fulfillment_codes (order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS mall_fulfillment_codes_user_idx ON mall_fulfillment_codes (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS mall_fulfillment_codes_pickup_status_idx ON mall_fulfillment_codes (pickup_point_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS mall_fulfillment_codes_status_expires_idx ON mall_fulfillment_codes (status, expires_at);

CREATE TABLE IF NOT EXISTS mall_fulfillment_events (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  order_id text NOT NULL,
  fulfillment_code_id text,
  event_type text NOT NULL,
  title text NOT NULL,
  description text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mall_fulfillment_events_order_idx ON mall_fulfillment_events (order_id, created_at ASC);
CREATE INDEX IF NOT EXISTS mall_fulfillment_events_code_idx ON mall_fulfillment_events (fulfillment_code_id, created_at ASC);

CREATE TABLE IF NOT EXISTS mall_member_levels (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  code text NOT NULL,
  name text NOT NULL,
  min_points integer NOT NULL DEFAULT 0,
  discount_bps integer NOT NULL DEFAULT 10000,
  benefits jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'active',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS mall_member_levels_code_uidx ON mall_member_levels (code);
CREATE INDEX IF NOT EXISTS mall_member_levels_status_sort_idx ON mall_member_levels (status, sort_order);

CREATE TABLE IF NOT EXISTS mall_community_posts (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title text NOT NULL,
  summary text,
  content text,
  image_url text,
  pickup_point_id text,
  status text NOT NULL DEFAULT 'published',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mall_community_posts_status_sort_idx ON mall_community_posts (status, sort_order, created_at DESC);
CREATE INDEX IF NOT EXISTS mall_community_posts_pickup_idx ON mall_community_posts (pickup_point_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS mall_notification_preferences (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id text NOT NULL,
  order_updates boolean NOT NULL DEFAULT true,
  promotions boolean NOT NULL DEFAULT true,
  community_posts boolean NOT NULL DEFAULT true,
  service_messages boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS mall_notification_preferences_user_uidx ON mall_notification_preferences (user_id);

INSERT INTO mall_pickup_points (
  id, name, address_text, latitude, longitude, business_hours, status,
  community_name, leader_name, leader_phone, sort_order
)
VALUES
  ('pickup-sanyou-central', '叁友甄选 · 中庭自提点', 'Haymarket 社区中庭 1 层服务台', -33.8796, 151.2056, '08:00-20:30', 'active', 'Haymarket 邻里', '林团长', '13950003001', 10),
  ('pickup-sanyou-garden', '叁友甄选 · 花园驿站', 'Ultimo Garden 3 号楼北门', -33.8814, 151.1992, '07:30-21:00', 'active', 'Ultimo 花园', '陈团长', '13950003002', 20),
  ('pickup-sanyou-harbour', '叁友甄选 · 海港便利点', 'Pyrmont Harbour Walk 88 号便利店', -33.8688, 151.1944, '09:00-19:30', 'active', 'Pyrmont 海港', '周团长', '13950003003', 30)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    address_text = EXCLUDED.address_text,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    business_hours = EXCLUDED.business_hours,
    status = EXCLUDED.status,
    community_name = EXCLUDED.community_name,
    leader_name = EXCLUDED.leader_name,
    leader_phone = EXCLUDED.leader_phone,
    sort_order = EXCLUDED.sort_order,
    updated_at = now();

INSERT INTO mall_member_levels (code, name, min_points, discount_bps, benefits, status, sort_order)
VALUES
  ('seed', '邻里新友', 0, 10000, '["新品提醒","自提点服务"]'::jsonb, 'active', 10),
  ('fresh', '鲜选会员', 500, 9800, '["会员价","优先售后"]'::jsonb, 'active', 20),
  ('captain', '团购达人', 2000, 9500, '["团购价","专属客服","活动优先"]'::jsonb, 'active', 30)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    min_points = EXCLUDED.min_points,
    discount_bps = EXCLUDED.discount_bps,
    benefits = EXCLUDED.benefits,
    status = EXCLUDED.status,
    sort_order = EXCLUDED.sort_order,
    updated_at = now();

INSERT INTO mall_community_posts (
  id, title, summary, content, image_url, pickup_point_id, status, sort_order
)
VALUES
  ('community-post-weekend-fruit', '本周邻里鲜果拼团', '草莓、蓝莓和家庭鲜果盒周末到点。', '团长会在到货后同步提货提醒，坏果可直接售后。', NULL, 'pickup-sanyou-central', 'published', 10),
  ('community-post-milk-breakfast', '早餐鲜奶补给提醒', '低温鲜牛奶今日补货，适合早餐组合加购。', '冷链到点后会生成提货码，请按自提点营业时间领取。', NULL, 'pickup-sanyou-garden', 'published', 20)
ON CONFLICT (id) DO UPDATE
SET title = EXCLUDED.title,
    summary = EXCLUDED.summary,
    content = EXCLUDED.content,
    image_url = EXCLUDED.image_url,
    pickup_point_id = EXCLUDED.pickup_point_id,
    status = EXCLUDED.status,
    sort_order = EXCLUDED.sort_order,
    updated_at = now();

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
