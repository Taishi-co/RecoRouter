ALTER TABLE IF EXISTS mall_orders
  ADD COLUMN IF NOT EXISTS merchant_id text;

CREATE INDEX IF NOT EXISTS mall_orders_merchant_created_idx
  ON mall_orders (merchant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS mall_orders_recipient_phone_created_idx
  ON mall_orders (recipient_phone, created_at DESC);
