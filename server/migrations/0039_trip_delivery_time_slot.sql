-- 行程表添加配送时间段字段
ALTER TABLE vehicle_trips
  ADD COLUMN IF NOT EXISTS delivery_date date,
  ADD COLUMN IF NOT EXISTS delivery_time_slot text;

-- 添加索引以支持按时间段查询行程
CREATE INDEX IF NOT EXISTS idx_vehicle_trips_delivery_date ON vehicle_trips(delivery_date);
CREATE INDEX IF NOT EXISTS idx_vehicle_trips_delivery_time_slot ON vehicle_trips(delivery_time_slot);

-- 注释说明
COMMENT ON COLUMN vehicle_trips.delivery_date IS '行程配送日期';
COMMENT ON COLUMN vehicle_trips.delivery_time_slot IS '行程配送时间段，格式如 "09:00-10:00"';
