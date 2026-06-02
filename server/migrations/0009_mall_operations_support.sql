CREATE TABLE IF NOT EXISTS mall_categories (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mall_products (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  category_id text,
  category_code text NOT NULL,
  sku text NOT NULL UNIQUE,
  name text NOT NULL,
  subtitle text,
  description text,
  image_url text,
  price_cents bigint NOT NULL,
  original_price_cents bigint,
  stock integer NOT NULL DEFAULT 0,
  sold_count integer NOT NULL DEFAULT 0,
  rating numeric NOT NULL DEFAULT 98,
  status text NOT NULL DEFAULT 'on_sale',
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  delivery_minutes integer NOT NULL DEFAULT 18,
  cold_chain_required boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mall_products_category_idx ON mall_products (category_code, sort_order);
CREATE INDEX IF NOT EXISTS mall_products_status_idx ON mall_products (status, created_at DESC);
CREATE INDEX IF NOT EXISTS mall_products_name_idx ON mall_products USING gin (to_tsvector('simple', name || ' ' || COALESCE(subtitle, '') || ' ' || COALESCE(description, '')));

CREATE TABLE IF NOT EXISTS mall_cart_items (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id text NOT NULL,
  product_id text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  selected boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS mall_cart_items_user_product_uidx ON mall_cart_items (user_id, product_id);
CREATE INDEX IF NOT EXISTS mall_cart_items_user_idx ON mall_cart_items (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS mall_orders (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  order_no text NOT NULL UNIQUE,
  user_id text NOT NULL,
  address_id text,
  recipient_name text,
  recipient_phone text,
  address_text text NOT NULL,
  latitude numeric,
  longitude numeric,
  delivery_method text NOT NULL DEFAULT '无人车冷链直送',
  pickup_method text NOT NULL DEFAULT '短信码开舱',
  expected_delivery_window text,
  subtotal_cents bigint NOT NULL DEFAULT 0,
  delivery_fee_cents bigint NOT NULL DEFAULT 0,
  coupon_cents bigint NOT NULL DEFAULT 0,
  payable_cents bigint NOT NULL DEFAULT 0,
  payment_status text NOT NULL DEFAULT 'unpaid',
  status text NOT NULL DEFAULT 'pending_payment',
  refund_status text,
  after_sale_status text,
  vehicle_code text,
  tracking_distance_km numeric,
  cabin_code text,
  remark text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  paid_at timestamptz,
  dispatched_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz
);

CREATE INDEX IF NOT EXISTS mall_orders_user_created_idx ON mall_orders (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS mall_orders_status_idx ON mall_orders (status, created_at DESC);
CREATE INDEX IF NOT EXISTS mall_orders_payment_status_idx ON mall_orders (payment_status, created_at DESC);

CREATE TABLE IF NOT EXISTS mall_order_items (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  order_id text NOT NULL,
  product_id text NOT NULL,
  sku text NOT NULL,
  product_name text NOT NULL,
  category_code text,
  image_url text,
  unit_price_cents bigint NOT NULL,
  quantity integer NOT NULL,
  line_total_cents bigint NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mall_order_items_order_idx ON mall_order_items (order_id);

CREATE TABLE IF NOT EXISTS mall_order_events (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  order_id text NOT NULL,
  stage text NOT NULL,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'done',
  event_time timestamptz DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS mall_order_events_order_time_idx ON mall_order_events (order_id, event_time ASC);

CREATE TABLE IF NOT EXISTS mall_after_sales (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  order_id text NOT NULL,
  user_id text NOT NULL,
  reason text NOT NULL,
  description text,
  amount_cents bigint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'submitted',
  handling_method text NOT NULL DEFAULT '极速退款',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mall_after_sales_order_idx ON mall_after_sales (order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS mall_after_sales_status_idx ON mall_after_sales (status, created_at DESC);

CREATE TABLE IF NOT EXISTS mall_campaigns (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name text NOT NULL,
  campaign_type text NOT NULL,
  budget_cents bigint NOT NULL DEFAULT 0,
  spent_cents bigint NOT NULL DEFAULT 0,
  rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mall_campaigns_status_idx ON mall_campaigns (status, created_at DESC);

CREATE TABLE IF NOT EXISTS mall_operation_settings (
  id text PRIMARY KEY DEFAULT 'default',
  free_delivery_threshold_cents bigint NOT NULL DEFAULT 9900,
  default_delivery_fee_cents bigint NOT NULL DEFAULT 600,
  delivery_promise_minutes integer NOT NULL DEFAULT 18,
  cold_chain_enabled boolean NOT NULL DEFAULT true,
  refund_review_minutes integer NOT NULL DEFAULT 10,
  roles jsonb NOT NULL DEFAULT '{}'::jsonb,
  risk_thresholds jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS support_sessions (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id text NOT NULL,
  assigned_agent_id text,
  channel text NOT NULL,
  topic text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  last_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_sessions_status_idx ON support_sessions (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS support_sessions_user_idx ON support_sessions (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS support_messages (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  session_id text NOT NULL,
  sender_id text,
  sender_role text NOT NULL,
  content text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_messages_session_idx ON support_messages (session_id, created_at ASC);

CREATE TABLE IF NOT EXISTS support_tickets (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id text NOT NULL,
  session_id text,
  order_id text,
  category text NOT NULL,
  priority text NOT NULL DEFAULT 'normal',
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'open',
  assigned_agent_id text,
  resolution text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_tickets_status_idx ON support_tickets (status, priority, created_at DESC);
CREATE INDEX IF NOT EXISTS support_tickets_user_idx ON support_tickets (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS support_knowledge_articles (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title text NOT NULL,
  category text NOT NULL,
  content text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  use_count integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_knowledge_status_idx ON support_knowledge_articles (status, category, updated_at DESC);

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
    'imageUrl', product.image_url,
    'priceCents', product.price_cents,
    'originalPriceCents', product.original_price_cents,
    'stock', product.stock,
    'soldCount', product.sold_count,
    'rating', product.rating,
    'status', product.status,
    'tags', product.tags,
    'deliveryMinutes', product.delivery_minutes,
    'coldChainRequired', product.cold_chain_required,
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
    'refundStatus', mall_order.refund_status,
    'afterSaleStatus', mall_order.after_sale_status,
    'vehicleCode', mall_order.vehicle_code,
    'trackingDistanceKm', mall_order.tracking_distance_km,
    'cabinCode', mall_order.cabin_code,
    'createdAt', mall_order.created_at,
    'updatedAt', mall_order.updated_at,
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

CREATE OR REPLACE FUNCTION campaign_json(campaign mall_campaigns)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'id', campaign.id,
    'name', campaign.name,
    'campaignType', campaign.campaign_type,
    'budgetCents', campaign.budget_cents,
    'spentCents', campaign.spent_cents,
    'rules', campaign.rules,
    'status', campaign.status,
    'startsAt', campaign.starts_at,
    'endsAt', campaign.ends_at,
    'createdAt', campaign.created_at,
    'updatedAt', campaign.updated_at
  )
$$;

CREATE OR REPLACE FUNCTION settings_json(settings mall_operation_settings)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'id', settings.id,
    'freeDeliveryThresholdCents', settings.free_delivery_threshold_cents,
    'defaultDeliveryFeeCents', settings.default_delivery_fee_cents,
    'deliveryPromiseMinutes', settings.delivery_promise_minutes,
    'coldChainEnabled', settings.cold_chain_enabled,
    'refundReviewMinutes', settings.refund_review_minutes,
    'roles', settings.roles,
    'riskThresholds', settings.risk_thresholds,
    'updatedAt', settings.updated_at
  )
$$;

CREATE OR REPLACE FUNCTION support_session_json(session support_sessions)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'id', session.id,
    'userId', session.user_id,
    'assignedAgentId', session.assigned_agent_id,
    'channel', session.channel,
    'topic', session.topic,
    'status', session.status,
    'lastMessage', session.last_message,
    'createdAt', session.created_at,
    'updatedAt', session.updated_at
  )
$$;

CREATE OR REPLACE FUNCTION support_message_json(message support_messages)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'id', message.id,
    'sessionId', message.session_id,
    'senderId', message.sender_id,
    'senderRole', message.sender_role,
    'content', message.content,
    'metadata', message.metadata,
    'createdAt', message.created_at
  )
$$;

CREATE OR REPLACE FUNCTION support_ticket_json(ticket support_tickets)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'id', ticket.id,
    'userId', ticket.user_id,
    'sessionId', ticket.session_id,
    'orderId', ticket.order_id,
    'category', ticket.category,
    'priority', ticket.priority,
    'title', ticket.title,
    'description', ticket.description,
    'status', ticket.status,
    'assignedAgentId', ticket.assigned_agent_id,
    'resolution', ticket.resolution,
    'createdAt', ticket.created_at,
    'updatedAt', ticket.updated_at
  )
$$;

CREATE OR REPLACE FUNCTION knowledge_json(article support_knowledge_articles)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'id', article.id,
    'title', article.title,
    'category', article.category,
    'content', article.content,
    'status', article.status,
    'useCount', article.use_count,
    'createdAt', article.created_at,
    'updatedAt', article.updated_at
  )
$$;

INSERT INTO mall_categories (code, name, sort_order, status)
VALUES
  ('fruit', '水果', 10, 'active'),
  ('milk', '鲜奶', 20, 'active'),
  ('vegetable', '蔬菜', 30, 'active'),
  ('bakery', '早餐烘焙', 40, 'active'),
  ('bundle', '家庭量贩', 50, 'active')
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    sort_order = EXCLUDED.sort_order,
    status = EXCLUDED.status,
    updated_at = now();

INSERT INTO mall_products (
  category_id, category_code, sku, name, subtitle, description, price_cents,
  original_price_cents, stock, sold_count, rating, status, tags,
  delivery_minutes, cold_chain_required, sort_order
)
SELECT c.id, seed.category_code, seed.sku, seed.name, seed.subtitle, seed.description,
       seed.price_cents, seed.original_price_cents, seed.stock, seed.sold_count,
       seed.rating, seed.status, seed.tags::jsonb, seed.delivery_minutes,
       seed.cold_chain_required, seed.sort_order
FROM (
  VALUES
    ('fruit', 'FRUIT-STRAWBERRY-250', '有机草莓', '250g · 果园直采', '附近合作果园采摘，入仓质检后由 RecoRouter 无人车送达。', 1990, 2490, 86, 1284, 98, 'on_sale', '["爆款","18分钟达","坏果包赔"]', 18, false, 10),
    ('milk', 'MILK-FRESH-950', '低温鲜牛奶', '950ml · 今早到店', '全程温控冷链鲜奶，适合早餐与家庭补给。', 1280, 1580, 42, 882, 97, 'on_sale', '["冷链","鲜奶","温控"]', 18, true, 20),
    ('fruit', 'FRUIT-GRAPE-500', '阳光玫瑰葡萄', '500g · 甜度18+', '本地果仓可配送，甜度抽检达标。', 2990, 3390, 34, 520, 96, 'on_sale', '["新鲜","可配送"]', 25, false, 30),
    ('fruit', 'FRUIT-BLUEBERRY-125', '蓝莓杯', '125g · 冷藏', '冷藏蓝莓杯，适合拼单加购。', 1680, NULL, 28, 430, 95, 'on_sale', '["加购","冷藏"]', 20, false, 40),
    ('bundle', 'BUNDLE-FAMILY-FRUIT', '家庭鲜果盒', '草莓/蓝莓/橙 · 2kg', '周末家庭量贩装，支持坏果包赔。', 5900, 6900, 18, 214, 98, 'on_sale', '["家庭量贩","组合优惠"]', 30, false, 50),
    ('vegetable', 'VEG-LETTUCE-300', '有机生菜组合', '300g · 无人车配送', '轻食生菜组合，和鲜奶水果一起配送。', 1620, NULL, 52, 318, 96, 'on_sale', '["蔬菜","同城配送"]', 25, false, 60)
) AS seed(category_code, sku, name, subtitle, description, price_cents, original_price_cents, stock, sold_count, rating, status, tags, delivery_minutes, cold_chain_required, sort_order)
JOIN mall_categories c ON c.code = seed.category_code
ON CONFLICT (sku) DO UPDATE
SET category_id = EXCLUDED.category_id,
    category_code = EXCLUDED.category_code,
    name = EXCLUDED.name,
    subtitle = EXCLUDED.subtitle,
    description = EXCLUDED.description,
    price_cents = EXCLUDED.price_cents,
    original_price_cents = EXCLUDED.original_price_cents,
    stock = EXCLUDED.stock,
    sold_count = EXCLUDED.sold_count,
    rating = EXCLUDED.rating,
    status = EXCLUDED.status,
    tags = EXCLUDED.tags,
    delivery_minutes = EXCLUDED.delivery_minutes,
    cold_chain_required = EXCLUDED.cold_chain_required,
    sort_order = EXCLUDED.sort_order,
    updated_at = now();

INSERT INTO mall_operation_settings (id)
VALUES ('default')
ON CONFLICT (id) DO NOTHING;

INSERT INTO mall_campaigns (name, campaign_type, budget_cents, spent_cents, rules, status)
VALUES
  ('满99免配送', 'delivery_discount', 500000, 128000, '{"thresholdCents":9900,"discountCents":600}'::jsonb, 'active'),
  ('鲜奶组合优惠', 'bundle_discount', 300000, 76000, '{"categoryCode":"milk","discountCents":200}'::jsonb, 'active')
ON CONFLICT DO NOTHING;

INSERT INTO support_knowledge_articles (title, category, content, status)
VALUES
  ('冷链破损极速退款', 'after_sales', '核验配送与冷链记录后原路退款。', 'published'),
  ('无人车开舱码未收到', 'delivery', '核对手机号后可由客服重新发送短信开舱码。', 'published')
ON CONFLICT DO NOTHING;
