CREATE TABLE IF NOT EXISTS mall_coupons (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  coupon_type text NOT NULL DEFAULT 'full_reduction',
  threshold_cents bigint NOT NULL DEFAULT 0,
  discount_cents bigint NOT NULL DEFAULT 0,
  total_quantity integer NOT NULL DEFAULT 0,
  claimed_count integer NOT NULL DEFAULT 0,
  used_count integer NOT NULL DEFAULT 0,
  per_user_limit integer NOT NULL DEFAULT 1,
  description text,
  rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mall_coupons_status_idx ON mall_coupons (status, created_at DESC);
CREATE INDEX IF NOT EXISTS mall_coupons_code_idx ON mall_coupons (lower(code));

CREATE TABLE IF NOT EXISTS mall_home_banners (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title text NOT NULL,
  subtitle text,
  image_url text,
  link_type text NOT NULL DEFAULT 'none',
  link_target text,
  sort_order integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  starts_at timestamptz,
  ends_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mall_home_banners_status_idx ON mall_home_banners (status, sort_order ASC, created_at DESC);

CREATE OR REPLACE FUNCTION coupon_json(coupon mall_coupons)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'id', coupon.id,
    'name', coupon.name,
    'code', coupon.code,
    'couponType', coupon.coupon_type,
    'thresholdCents', coupon.threshold_cents,
    'discountCents', coupon.discount_cents,
    'totalQuantity', coupon.total_quantity,
    'claimedCount', coupon.claimed_count,
    'usedCount', coupon.used_count,
    'perUserLimit', coupon.per_user_limit,
    'description', coupon.description,
    'rules', coupon.rules,
    'status', coupon.status,
    'startsAt', coupon.starts_at,
    'endsAt', coupon.ends_at,
    'createdAt', coupon.created_at,
    'updatedAt', coupon.updated_at
  )
$$;

CREATE OR REPLACE FUNCTION home_banner_json(banner mall_home_banners)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'id', banner.id,
    'title', banner.title,
    'subtitle', banner.subtitle,
    'imageUrl', banner.image_url,
    'linkType', banner.link_type,
    'linkTarget', banner.link_target,
    'sortOrder', banner.sort_order,
    'status', banner.status,
    'startsAt', banner.starts_at,
    'endsAt', banner.ends_at,
    'metadata', banner.metadata,
    'createdAt', banner.created_at,
    'updatedAt', banner.updated_at
  )
$$;

INSERT INTO mall_coupons (
  name, code, coupon_type, threshold_cents, discount_cents, total_quantity,
  per_user_limit, description, rules, status, starts_at, ends_at
)
VALUES (
  '新人满49减6',
  'NEW49-6',
  'full_reduction',
  4900,
  600,
  1000,
  1,
  '新用户首单可用，结算时满足门槛自动抵扣。',
  jsonb_build_object('audience', 'new_user', 'autoApply', true),
  'active',
  now(),
  now() + interval '90 days'
)
ON CONFLICT (code) DO NOTHING;

INSERT INTO mall_home_banners (
  id, title, subtitle, image_url, link_type, link_target, sort_order, status, metadata
)
VALUES
  (
    'home-banner-fruit',
    '叁友甄选今日鲜果',
    '邻里一起拼，新鲜果蔬当天到点',
    'mall-products/kiwi.jpeg',
    'category',
    'fruit',
    10,
    'active',
    jsonb_build_object('tag', '安心溯源')
  ),
  (
    'home-banner-breakfast',
    '早餐烘焙补货',
    '鲜奶、面包和家庭量贩组合限时上新',
    'mall-products/fresh-milk.jpeg',
    'search',
    '早餐',
    20,
    'active',
    jsonb_build_object('tag', '今日到点')
  )
ON CONFLICT (id) DO NOTHING;
