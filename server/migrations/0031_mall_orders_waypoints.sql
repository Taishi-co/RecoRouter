ALTER TABLE mall_orders ADD COLUMN IF NOT EXISTS waypoints jsonb;
ALTER TABLE mall_orders ADD COLUMN IF NOT EXISTS origin_latitude numeric;
ALTER TABLE mall_orders ADD COLUMN IF NOT EXISTS origin_longitude numeric;
ALTER TABLE mall_orders ADD COLUMN IF NOT EXISTS origin_address text;
