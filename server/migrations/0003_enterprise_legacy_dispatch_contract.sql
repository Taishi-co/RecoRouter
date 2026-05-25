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

CREATE INDEX IF NOT EXISTS demands_status_idx ON demands(status);
CREATE INDEX IF NOT EXISTS vehicles_status_idx ON vehicles(status);
CREATE INDEX IF NOT EXISTS vehicles_enterprise_dispatch_idx
  ON vehicles(enterprise_id, usage_mode, status, trip_status);
CREATE INDEX IF NOT EXISTS dairy_stations_enterprise_id_idx ON dairy_stations(enterprise_id);
CREATE INDEX IF NOT EXISTS dairy_stations_status_idx ON dairy_stations(status);
CREATE INDEX IF NOT EXISTS enterprise_demands_enterprise_id_idx ON enterprise_demands(enterprise_id);
CREATE INDEX IF NOT EXISTS enterprise_demands_status_idx ON enterprise_demands(status);
CREATE INDEX IF NOT EXISTS enterprise_demands_created_at_idx ON enterprise_demands(created_at);
CREATE INDEX IF NOT EXISTS enterprise_demands_external_demand_id_idx
  ON enterprise_demands(external_demand_id);

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
