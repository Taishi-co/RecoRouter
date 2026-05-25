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

CREATE INDEX IF NOT EXISTS users_phone_idx ON users(phone);
CREATE INDEX IF NOT EXISTS users_role_idx ON users(role);
CREATE INDEX IF NOT EXISTS demands_merchant_id_idx ON demands(merchant_id);
CREATE INDEX IF NOT EXISTS demands_owner_id_idx ON demands(owner_id);
CREATE INDEX IF NOT EXISTS demands_enterprise_id_idx ON demands(enterprise_id);
CREATE INDEX IF NOT EXISTS demands_enterprise_demand_id_idx ON demands(enterprise_demand_id);
CREATE INDEX IF NOT EXISTS demands_source_status_idx ON demands(demand_source, status);
CREATE INDEX IF NOT EXISTS demands_status_idx ON demands(status);
CREATE INDEX IF NOT EXISTS demands_pickup_time_idx ON demands(pickup_time);
CREATE INDEX IF NOT EXISTS vehicles_owner_id_idx ON vehicles(owner_id);
CREATE INDEX IF NOT EXISTS vehicles_current_renter_id_idx ON vehicles(current_renter_id);
CREATE INDEX IF NOT EXISTS vehicles_status_idx ON vehicles(status);
CREATE INDEX IF NOT EXISTS orders_demand_id_idx ON orders(demand_id);
CREATE INDEX IF NOT EXISTS orders_vehicle_id_idx ON orders(vehicle_id);
CREATE INDEX IF NOT EXISTS orders_merchant_id_idx ON orders(merchant_id);
CREATE INDEX IF NOT EXISTS orders_owner_id_idx ON orders(owner_id);
CREATE INDEX IF NOT EXISTS orders_enterprise_id_idx ON orders(enterprise_id);
CREATE INDEX IF NOT EXISTS orders_enterprise_demand_id_idx ON orders(enterprise_demand_id);
CREATE INDEX IF NOT EXISTS orders_source_status_idx ON orders(order_source, status);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(status);
CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders(created_at);
CREATE INDEX IF NOT EXISTS cancellation_requests_order_id_idx ON cancellation_requests(order_id);
CREATE INDEX IF NOT EXISTS cancellation_requests_requestor_id_idx ON cancellation_requests(requestor_id);
CREATE INDEX IF NOT EXISTS cancellation_requests_responder_id_idx ON cancellation_requests(responder_id);
CREATE INDEX IF NOT EXISTS notifications_user_id_created_at_idx ON notifications(user_id, created_at);
CREATE INDEX IF NOT EXISTS address_books_user_id_idx ON address_books(user_id);
CREATE INDEX IF NOT EXISTS favorite_routes_user_id_idx ON favorite_routes(user_id);
CREATE INDEX IF NOT EXISTS favorite_routes_pickup_address_id_idx ON favorite_routes(pickup_address_id);
CREATE INDEX IF NOT EXISTS favorite_routes_delivery_address_id_idx ON favorite_routes(delivery_address_id);
CREATE INDEX IF NOT EXISTS demand_templates_user_id_idx ON demand_templates(user_id);
CREATE INDEX IF NOT EXISTS demand_schedules_user_id_idx ON demand_schedules(user_id);
CREATE INDEX IF NOT EXISTS demand_schedules_template_id_idx ON demand_schedules(template_id);
CREATE INDEX IF NOT EXISTS demand_schedules_status_next_publish_idx ON demand_schedules(status, next_publish_time);
CREATE INDEX IF NOT EXISTS demand_publish_logs_schedule_id_idx ON demand_publish_logs(schedule_id);
CREATE INDEX IF NOT EXISTS demand_publish_logs_demand_id_idx ON demand_publish_logs(demand_id);
CREATE INDEX IF NOT EXISTS user_roles_user_id_status_idx ON user_roles(user_id, status);
CREATE INDEX IF NOT EXISTS vehicle_rentals_vehicle_status_idx ON vehicle_rentals(vehicle_id, status);
CREATE INDEX IF NOT EXISTS vehicle_rentals_owner_status_idx ON vehicle_rentals(owner_id, status);
CREATE INDEX IF NOT EXISTS vehicle_rentals_renter_status_idx ON vehicle_rentals(renter_id, status);
CREATE INDEX IF NOT EXISTS rental_reminders_rental_id_idx ON rental_reminders(rental_id);
CREATE INDEX IF NOT EXISTS rental_reminders_owner_id_idx ON rental_reminders(owner_id);
CREATE INDEX IF NOT EXISTS rental_reminders_renter_id_idx ON rental_reminders(renter_id);
CREATE INDEX IF NOT EXISTS rental_violations_rental_id_idx ON rental_violations(rental_id);
CREATE INDEX IF NOT EXISTS rental_violations_user_id_idx ON rental_violations(user_id);
CREATE INDEX IF NOT EXISTS enterprises_admin_id_idx ON enterprises(admin_id);
CREATE INDEX IF NOT EXISTS dairy_stations_enterprise_id_idx ON dairy_stations(enterprise_id);
CREATE INDEX IF NOT EXISTS enterprise_demands_enterprise_id_idx ON enterprise_demands(enterprise_id);

COMMIT;
