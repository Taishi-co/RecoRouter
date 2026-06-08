-- Vehicle trips: one trip = one vehicle's delivery run with multiple orders
-- Lives in the mall database (recocar_mall) because trips primarily manage mall order dispatch
-- vehicle_id is a logical reference (no FK) because vehicles lives in a separate database
CREATE TABLE IF NOT EXISTS vehicle_trips (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  vehicle_id text NOT NULL,
  vehicle_code text,
  license_plate text,
  vehicle_type text,
  driver_id text,
  status text NOT NULL DEFAULT 'planned',
  -- planned: 已规划待出发, in_progress: 运输中, completed: 已完成, cancelled: 已取消
  planned_departure_time timestamptz,
  actual_departure_time timestamptz,
  completed_time timestamptz,
  total_distance_km numeric,
  total_orders integer NOT NULL DEFAULT 0,
  completed_orders integer NOT NULL DEFAULT 0,
  notes text,
  created_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vehicle_trips_vehicle_idx ON vehicle_trips(vehicle_id, status);
CREATE INDEX IF NOT EXISTS vehicle_trips_status_idx ON vehicle_trips(status, planned_departure_time);

-- Trip stops: ordered delivery/pickup points within a trip
CREATE TABLE IF NOT EXISTS trip_stops (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  trip_id text NOT NULL REFERENCES vehicle_trips(id) ON DELETE CASCADE,
  mall_order_id text REFERENCES mall_orders(id) ON DELETE SET NULL,
  stop_type text NOT NULL DEFAULT 'delivery',
  -- pickup: 取货点, delivery: 送货点
  stop_sequence integer NOT NULL DEFAULT 0,
  address text,
  latitude numeric,
  longitude numeric,
  contact_name text,
  contact_phone text,
  cargo_info text,
  status text NOT NULL DEFAULT 'pending',
  -- pending: 待到达, arrived: 已到达, completed: 已完成, skipped: 已跳过
  arrived_at timestamptz,
  completed_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trip_stops_trip_idx ON trip_stops(trip_id, stop_sequence);
CREATE INDEX IF NOT EXISTS trip_stops_order_idx ON trip_stops(mall_order_id);

-- Add trip_id to mall_orders so we know which trip an order belongs to
ALTER TABLE mall_orders ADD COLUMN IF NOT EXISTS trip_id text REFERENCES vehicle_trips(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS mall_orders_trip_id_idx ON mall_orders(trip_id);
