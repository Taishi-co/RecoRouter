CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  phone text UNIQUE,
  password text,
  role text,
  name text,
  username text,
  nickname text,
  id_card text,
  merchant_type text,
  address text,
  avatar text,
  avatar_url text,
  gender text DEFAULT 'secret',
  birthday date,
  status text DEFAULT 'active',
  wechat_payment_qr text,
  credit_score integer DEFAULT 100,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz
);

CREATE TABLE IF NOT EXISTS demands (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  merchant_id text REFERENCES users(id) ON DELETE CASCADE,
  owner_id text REFERENCES users(id) ON DELETE SET NULL,
  template_id text,
  schedule_id text,
  cargo_name text,
  cargo_type text,
  weight numeric,
  volume numeric,
  pickup_time timestamptz,
  pickup_address text,
  pickup_location jsonb,
  pickup_lat numeric,
  pickup_lng numeric,
  delivery_address text,
  delivery_location jsonb,
  delivery_lat numeric,
  delivery_lng numeric,
  estimated_distance numeric,
  estimated_fare numeric,
  route_type text,
  time_window jsonb,
  pickup_point jsonb,
  delivery_points jsonb,
  cargo_info jsonb,
  pickup_time_start text,
  pickup_time_end text,
  cargo_photos jsonb,
  remarks text,
  status text DEFAULT 'pending',
  is_from_schedule boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz
);

CREATE TABLE IF NOT EXISTS vehicles (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  owner_id text REFERENCES users(id) ON DELETE CASCADE,
  enterprise_id text,
  vehicle_code text,
  vehicle_type text,
  license_plate text,
  load_capacity numeric,
  volume numeric,
  length numeric,
  width numeric,
  height numeric,
  battery_life numeric,
  operation_area jsonb,
  available_hours jsonb,
  has_cold_chain boolean DEFAULT false,
  is_available boolean DEFAULT true,
  is_available_for_rent boolean DEFAULT false,
  current_renter_id text REFERENCES users(id) ON DELETE SET NULL,
  current_location text,
  usage_mode text,
  rental_status text,
  trip_status text DEFAULT 'idle',
  status text DEFAULT 'pending',
  photos jsonb,
  remarks text,
  base_price numeric DEFAULT 20,
  base_distance numeric DEFAULT 3,
  price_per_km numeric DEFAULT 2,
  price_updated_at timestamptz,
  rent_monthly_price numeric,
  rent_yearly_price numeric,
  rent_deposit numeric,
  contact_phone text,
  contact_wechat text,
  today_internal_orders integer DEFAULT 0,
  today_external_orders integer DEFAULT 0,
  today_distance numeric DEFAULT 0,
  rent_start_date timestamptz,
  rent_end_date timestamptz,
  rent_type text,
  rental_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz
);

CREATE TABLE IF NOT EXISTS orders (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  demand_id text CONSTRAINT orders_demand_id_demands_id_fk REFERENCES demands(id) ON DELETE CASCADE,
  vehicle_id text REFERENCES vehicles(id) ON DELETE SET NULL,
  merchant_id text CONSTRAINT orders_merchant_id_users_id_fk REFERENCES users(id) ON DELETE CASCADE,
  owner_id text CONSTRAINT orders_owner_id_users_id_fk REFERENCES users(id) ON DELETE SET NULL,
  status text DEFAULT 'pending',
  pickup_photo_key text,
  delivery_photo_key text,
  delivery_proof_key text,
  cancel_reason text,
  cancel_time timestamptz,
  accept_time timestamptz,
  complete_time timestamptz,
  pickup_time timestamptz,
  pickup_address text,
  delivery_address text,
  remarks text,
  fare_price numeric DEFAULT 0,
  calculated_fare numeric,
  fare_calculation_detail jsonb,
  is_custom_fare boolean DEFAULT true,
  merchant_confirmed boolean DEFAULT false,
  confirm_time timestamptz,
  payment_status text DEFAULT 'unpaid',
  commission_amount numeric DEFAULT 0,
  commission_payment_status text DEFAULT 'pending',
  transport_completed_time timestamptz,
  payment_time timestamptz,
  payment_confirm_time timestamptz,
  commission_payment_time timestamptz,
  commission_confirm_time timestamptz,
  actual_complete_time timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz
);

CREATE TABLE IF NOT EXISTS cancellation_requests (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  order_id text REFERENCES orders(id) ON DELETE CASCADE,
  requestor_id text REFERENCES users(id) ON DELETE SET NULL,
  responder_id text REFERENCES users(id) ON DELETE SET NULL,
  reason text,
  status text DEFAULT 'pending',
  response_reason text,
  responded_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id text REFERENCES users(id) ON DELETE CASCADE,
  type text,
  title text,
  content text,
  related_order_id text,
  related_demand_id text,
  related_type text,
  related_id text,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS platform_settings (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  commission_rate numeric DEFAULT 5,
  commission_payment_qr text,
  updated_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS address_books (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id text REFERENCES users(id) ON DELETE CASCADE,
  address_name text,
  address text,
  latitude numeric,
  longitude numeric,
  address_type text DEFAULT 'other',
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz
);

CREATE TABLE IF NOT EXISTS favorite_routes (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id text REFERENCES users(id) ON DELETE CASCADE,
  route_name text,
  pickup_address_id text REFERENCES address_books(id) ON DELETE SET NULL,
  delivery_address_id text REFERENCES address_books(id) ON DELETE SET NULL,
  pickup_address_name text,
  pickup_address text,
  pickup_lat numeric,
  pickup_lng numeric,
  delivery_address_name text,
  delivery_address text,
  delivery_lat numeric,
  delivery_lng numeric,
  estimated_distance numeric,
  estimated_fare numeric,
  use_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz
);

CREATE TABLE IF NOT EXISTS demand_templates (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id text REFERENCES users(id) ON DELETE CASCADE,
  template_name text,
  cargo_name text,
  cargo_type text DEFAULT 'normal',
  weight numeric,
  volume numeric,
  pickup_address text,
  pickup_lat numeric,
  pickup_lng numeric,
  delivery_address text,
  delivery_lat numeric,
  delivery_lng numeric,
  remarks text,
  estimated_distance numeric,
  estimated_fare numeric,
  use_count integer DEFAULT 0,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz
);

CREATE TABLE IF NOT EXISTS demand_schedules (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id text REFERENCES users(id) ON DELETE CASCADE,
  template_id text REFERENCES demand_templates(id) ON DELETE CASCADE,
  schedule_name text,
  schedule_type text,
  interval_days integer,
  base_date date,
  base_time text,
  pickup_time_offset text,
  max_publish_count integer,
  end_time timestamptz,
  published_count integer DEFAULT 0,
  status text DEFAULT 'active',
  next_publish_time timestamptz,
  last_published_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz
);

CREATE TABLE IF NOT EXISTS demand_publish_logs (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  schedule_id text REFERENCES demand_schedules(id) ON DELETE CASCADE,
  demand_id text REFERENCES demands(id) ON DELETE SET NULL,
  publish_time timestamptz,
  publish_type text,
  status text,
  error_message text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_roles (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id text REFERENCES users(id) ON DELETE CASCADE,
  role text,
  is_active boolean DEFAULT false,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz
);

CREATE TABLE IF NOT EXISTS vehicle_rentals (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  vehicle_id text REFERENCES vehicles(id) ON DELETE CASCADE,
  owner_id text REFERENCES users(id) ON DELETE CASCADE,
  renter_id text REFERENCES users(id) ON DELETE CASCADE,
  rent_type text,
  rent_start_date timestamptz,
  rent_end_date timestamptz,
  contract_signed boolean DEFAULT false,
  rent_paid boolean DEFAULT false,
  deposit_paid boolean DEFAULT false,
  deposit_amount numeric DEFAULT 0,
  status text DEFAULT 'pending',
  confirmed_by_owner boolean DEFAULT false,
  confirmed_by_renter boolean DEFAULT false,
  confirmed_at timestamptz,
  owner_confirmed_at timestamptz,
  renter_confirmed_at timestamptz,
  returned_at timestamptz,
  last_reminder_time timestamptz,
  reminder_sent_count integer DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz
);

CREATE TABLE IF NOT EXISTS rental_reminders (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  rental_id text REFERENCES vehicle_rentals(id) ON DELETE CASCADE,
  owner_id text REFERENCES users(id) ON DELETE SET NULL,
  renter_id text REFERENCES users(id) ON DELETE SET NULL,
  reminder_type text,
  reminder_channel text,
  is_sent boolean DEFAULT false,
  sent_at timestamptz,
  sent_status text,
  error_message text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rental_violations (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  rental_id text REFERENCES vehicle_rentals(id) ON DELETE CASCADE,
  user_id text REFERENCES users(id) ON DELETE SET NULL,
  violation_type text,
  overdue_days integer,
  penalty_amount numeric DEFAULT 0,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz
);

CREATE TABLE IF NOT EXISTS enterprises (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name text,
  type text,
  status text DEFAULT 'active',
  admin_id text REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz
);

CREATE TABLE IF NOT EXISTS dairy_stations (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  enterprise_id text REFERENCES enterprises(id) ON DELETE CASCADE,
  name text,
  address text,
  location jsonb,
  phone text,
  customer_type text DEFAULT 'owned',
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz
);

CREATE TABLE IF NOT EXISTS enterprise_demands (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  enterprise_id text REFERENCES enterprises(id) ON DELETE CASCADE,
  pickup_point_type text,
  pickup_point_info jsonb,
  delivery_points jsonb,
  cargo_info jsonb,
  time_window jsonb,
  vehicle_source text,
  vehicle_allocation jsonb,
  optimized_routes jsonb,
  external_demand_id text,
  remark text,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz
);

CREATE TABLE IF NOT EXISTS sms_codes (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  phone text,
  code text,
  type text,
  is_used boolean DEFAULT false,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS users_phone_idx ON users(phone);
CREATE INDEX IF NOT EXISTS users_role_idx ON users(role);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(status);
CREATE INDEX IF NOT EXISTS demands_status_idx ON demands(status);
CREATE INDEX IF NOT EXISTS vehicles_status_idx ON vehicles(status);
CREATE INDEX IF NOT EXISTS dairy_stations_enterprise_id_idx ON dairy_stations(enterprise_id);
CREATE INDEX IF NOT EXISTS dairy_stations_status_idx ON dairy_stations(status);
CREATE INDEX IF NOT EXISTS enterprise_demands_enterprise_id_idx ON enterprise_demands(enterprise_id);
CREATE INDEX IF NOT EXISTS enterprise_demands_status_idx ON enterprise_demands(status);
CREATE INDEX IF NOT EXISTS enterprise_demands_created_at_idx ON enterprise_demands(created_at);
CREATE INDEX IF NOT EXISTS enterprise_demands_external_demand_id_idx ON enterprise_demands(external_demand_id);
CREATE INDEX IF NOT EXISTS vehicles_enterprise_dispatch_idx ON vehicles(enterprise_id, usage_mode, status, trip_status);

ALTER TABLE IF EXISTS demands ADD COLUMN IF NOT EXISTS route_type text;
ALTER TABLE IF EXISTS demands ADD COLUMN IF NOT EXISTS time_window jsonb;
ALTER TABLE IF EXISTS demands ADD COLUMN IF NOT EXISTS pickup_point jsonb;
ALTER TABLE IF EXISTS demands ADD COLUMN IF NOT EXISTS delivery_points jsonb;
ALTER TABLE IF EXISTS demands ADD COLUMN IF NOT EXISTS cargo_info jsonb;
ALTER TABLE IF EXISTS demands ADD COLUMN IF NOT EXISTS pickup_time_start text;
ALTER TABLE IF EXISTS demands ADD COLUMN IF NOT EXISTS pickup_time_end text;

ALTER TABLE IF EXISTS vehicles ADD COLUMN IF NOT EXISTS enterprise_id text;
ALTER TABLE IF EXISTS vehicles ADD COLUMN IF NOT EXISTS vehicle_code text;
ALTER TABLE IF EXISTS vehicles ADD COLUMN IF NOT EXISTS length numeric;
ALTER TABLE IF EXISTS vehicles ADD COLUMN IF NOT EXISTS width numeric;
ALTER TABLE IF EXISTS vehicles ADD COLUMN IF NOT EXISTS height numeric;
ALTER TABLE IF EXISTS vehicles ADD COLUMN IF NOT EXISTS current_location text;
ALTER TABLE IF EXISTS vehicles ADD COLUMN IF NOT EXISTS usage_mode text;
ALTER TABLE IF EXISTS vehicles ADD COLUMN IF NOT EXISTS trip_status text DEFAULT 'idle';
ALTER TABLE IF EXISTS vehicles ADD COLUMN IF NOT EXISTS price_updated_at timestamptz;
ALTER TABLE IF EXISTS vehicles ADD COLUMN IF NOT EXISTS rent_monthly_price numeric;
ALTER TABLE IF EXISTS vehicles ADD COLUMN IF NOT EXISTS rent_yearly_price numeric;
ALTER TABLE IF EXISTS vehicles ADD COLUMN IF NOT EXISTS rent_deposit numeric;
ALTER TABLE IF EXISTS vehicles ADD COLUMN IF NOT EXISTS contact_phone text;
ALTER TABLE IF EXISTS vehicles ADD COLUMN IF NOT EXISTS contact_wechat text;
ALTER TABLE IF EXISTS vehicles ADD COLUMN IF NOT EXISTS today_internal_orders integer DEFAULT 0;
ALTER TABLE IF EXISTS vehicles ADD COLUMN IF NOT EXISTS today_external_orders integer DEFAULT 0;
ALTER TABLE IF EXISTS vehicles ADD COLUMN IF NOT EXISTS today_distance numeric DEFAULT 0;
ALTER TABLE IF EXISTS vehicles ADD COLUMN IF NOT EXISTS rent_start_date timestamptz;
ALTER TABLE IF EXISTS vehicles ADD COLUMN IF NOT EXISTS rent_end_date timestamptz;
ALTER TABLE IF EXISTS vehicles ADD COLUMN IF NOT EXISTS rent_type text;
ALTER TABLE IF EXISTS vehicles ADD COLUMN IF NOT EXISTS rental_notes text;

ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS calculated_fare numeric;
ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS fare_calculation_detail jsonb;
ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS is_custom_fare boolean DEFAULT true;

ALTER TABLE IF EXISTS dairy_stations ADD COLUMN IF NOT EXISTS customer_type text DEFAULT 'owned';

ALTER TABLE IF EXISTS enterprise_demands ADD COLUMN IF NOT EXISTS external_demand_id text;
ALTER TABLE IF EXISTS enterprise_demands ADD COLUMN IF NOT EXISTS remark text;

UPDATE enterprise_demands
SET vehicle_source = 'internal',
    updated_at = now()
WHERE vehicle_source = 'own';

UPDATE enterprise_demands
SET vehicle_allocation = (
  jsonb_set(
    COALESCE(vehicle_allocation, '{}'::jsonb),
    '{vehicle_ids}',
    COALESCE(
      (
        SELECT jsonb_agg(DISTINCT vehicle_id)
        FROM jsonb_array_elements(
          COALESCE(vehicle_allocation->'vehicle_ids', '[]'::jsonb)
          || COALESCE(vehicle_allocation->'ownVehicleIds', '[]'::jsonb)
          || COALESCE(vehicle_allocation->'externalVehicleIds', '[]'::jsonb)
        ) AS legacy_ids(vehicle_id)
        WHERE jsonb_typeof(vehicle_id) = 'string'
          AND vehicle_id #>> '{}' <> ''
      ),
      '[]'::jsonb
    )
  ) - 'ownVehicleIds' - 'externalVehicleIds'
),
updated_at = now()
WHERE vehicle_allocation IS NOT NULL
  AND jsonb_typeof(vehicle_allocation) = 'object'
  AND (
    vehicle_allocation ? 'ownVehicleIds'
    OR vehicle_allocation ? 'externalVehicleIds'
  );

WITH candidates AS (
  SELECT
    ed.id AS enterprise_demand_id,
    d.id AS public_demand_id,
    row_number() OVER (
      PARTITION BY ed.id
      ORDER BY abs(extract(epoch FROM (d.created_at - ed.created_at))), d.created_at
    ) AS rank
  FROM enterprise_demands ed
  LEFT JOIN enterprises e ON e.id = ed.enterprise_id
  JOIN demands d
    ON d.remarks = '企业外部需求'
   AND d.merchant_id IN (ed.enterprise_id, e.admin_id)
   AND d.created_at >= ed.created_at
   AND d.created_at < ed.created_at + interval '10 seconds'
  WHERE ed.vehicle_source = 'external'
    AND ed.external_demand_id IS NULL
)
UPDATE enterprise_demands ed
SET external_demand_id = candidates.public_demand_id,
    updated_at = now()
FROM candidates
WHERE candidates.enterprise_demand_id = ed.id
  AND candidates.rank = 1
  AND ed.external_demand_id IS NULL;

GRANT USAGE ON SCHEMA public TO anon, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, service_role;
