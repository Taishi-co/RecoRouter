BEGIN;

ALTER TABLE demands
  ADD COLUMN IF NOT EXISTS enterprise_id text,
  ADD COLUMN IF NOT EXISTS enterprise_demand_id text,
  ADD COLUMN IF NOT EXISTS demand_source text DEFAULT 'merchant';

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS enterprise_id text,
  ADD COLUMN IF NOT EXISTS enterprise_demand_id text,
  ADD COLUMN IF NOT EXISTS order_source text DEFAULT 'merchant';

ALTER TABLE demands ALTER COLUMN merchant_id DROP NOT NULL;
ALTER TABLE orders ALTER COLUMN merchant_id DROP NOT NULL;

UPDATE demands SET demand_source = 'merchant' WHERE demand_source IS NULL;
UPDATE orders SET order_source = 'merchant' WHERE order_source IS NULL;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT conrelid::regclass::text AS table_name, conname
    FROM pg_constraint
    WHERE contype = 'f'
      AND connamespace = 'public'::regnamespace
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT IF EXISTS %I', r.table_name, r.conname);
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS demands_merchant_id_idx ON demands(merchant_id);
CREATE INDEX IF NOT EXISTS demands_owner_id_idx ON demands(owner_id);
CREATE INDEX IF NOT EXISTS demands_enterprise_id_idx ON demands(enterprise_id);
CREATE INDEX IF NOT EXISTS demands_enterprise_demand_id_idx ON demands(enterprise_demand_id);
CREATE INDEX IF NOT EXISTS demands_source_status_idx ON demands(demand_source, status);
CREATE INDEX IF NOT EXISTS vehicles_owner_id_idx ON vehicles(owner_id);
CREATE INDEX IF NOT EXISTS vehicles_current_renter_id_idx ON vehicles(current_renter_id);
CREATE INDEX IF NOT EXISTS orders_demand_id_idx ON orders(demand_id);
CREATE INDEX IF NOT EXISTS orders_vehicle_id_idx ON orders(vehicle_id);
CREATE INDEX IF NOT EXISTS orders_merchant_id_idx ON orders(merchant_id);
CREATE INDEX IF NOT EXISTS orders_owner_id_idx ON orders(owner_id);
CREATE INDEX IF NOT EXISTS orders_enterprise_id_idx ON orders(enterprise_id);
CREATE INDEX IF NOT EXISTS orders_enterprise_demand_id_idx ON orders(enterprise_demand_id);
CREATE INDEX IF NOT EXISTS orders_source_status_idx ON orders(order_source, status);
CREATE INDEX IF NOT EXISTS enterprises_admin_id_idx ON enterprises(admin_id);
CREATE INDEX IF NOT EXISTS dairy_stations_enterprise_id_idx ON dairy_stations(enterprise_id);
CREATE INDEX IF NOT EXISTS enterprise_demands_enterprise_id_idx ON enterprise_demands(enterprise_id);

COMMIT;
