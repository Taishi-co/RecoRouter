-- 行程表添加自增编号
ALTER TABLE vehicle_trips
  ADD COLUMN IF NOT EXISTS trip_no SERIAL;

-- 同一天同一辆车只能有一个行程的唯一约束
-- 仅对未取消、未完成的行程生效（planned/locked/in_progress）
CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicle_trips_vehicle_date_active
  ON vehicle_trips (vehicle_id, delivery_date)
  WHERE status IN ('planned', 'locked', 'in_progress');

-- 给已有的行程补编号
-- (SERIAL 会自动从1开始编号，已有数据的话需要手动设置起始值)
