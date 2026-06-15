CREATE TABLE IF NOT EXISTS mall_user_coupons (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id text NOT NULL,
  coupon_id text NOT NULL,
  status text NOT NULL DEFAULT 'claimed',
  claimed_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz,
  expires_at timestamptz,
  order_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mall_user_coupons_user_status_idx
  ON mall_user_coupons (user_id, status, expires_at, claimed_at DESC);

CREATE INDEX IF NOT EXISTS mall_user_coupons_coupon_status_idx
  ON mall_user_coupons (coupon_id, status, claimed_at DESC);

CREATE INDEX IF NOT EXISTS mall_user_coupons_order_idx
  ON mall_user_coupons (order_id);
