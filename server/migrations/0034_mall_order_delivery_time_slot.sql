-- 订单收货时间段字段
ALTER TABLE mall_orders
  ADD COLUMN IF NOT EXISTS delivery_date date,
  ADD COLUMN IF NOT EXISTS delivery_time_slot text;

-- 添加索引以支持按时间段查询订单
CREATE INDEX IF NOT EXISTS idx_mall_orders_delivery_date ON mall_orders(delivery_date);
CREATE INDEX IF NOT EXISTS idx_mall_orders_delivery_time_slot ON mall_orders(delivery_time_slot);

-- 注释说明时间段格式
COMMENT ON COLUMN mall_orders.delivery_date IS '期望配送日期';
COMMENT ON COLUMN mall_orders.delivery_time_slot IS '期望配送时间段，格式如 "09:00-10:00"';
