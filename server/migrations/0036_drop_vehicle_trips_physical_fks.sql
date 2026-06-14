-- Remove physical FK constraints introduced by the already-applied 0026
-- migration. Trip and mall order links are logical ids across service
-- boundaries; lookup performance is covered by the indexes from 0026.
ALTER TABLE trip_stops DROP CONSTRAINT IF EXISTS trip_stops_trip_id_fkey;
ALTER TABLE trip_stops DROP CONSTRAINT IF EXISTS trip_stops_mall_order_id_fkey;
ALTER TABLE mall_orders DROP CONSTRAINT IF EXISTS mall_orders_trip_id_fkey;
