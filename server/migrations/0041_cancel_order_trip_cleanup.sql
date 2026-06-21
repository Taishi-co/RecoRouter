-- 订单取消时自动从行程中移除
CREATE OR REPLACE FUNCTION cleanup_cancelled_order_from_trip()
RETURNS TRIGGER AS $$
DECLARE
    v_trip_id UUID;
    v_has_remaining_stops BOOLEAN;
BEGIN
    IF NEW.status = 'cancelled' AND OLD.trip_id IS NOT NULL THEN
        v_trip_id := OLD.trip_id;

        DELETE FROM trip_stops
        WHERE trip_id = v_trip_id
          AND mall_order_id = OLD.id;

        UPDATE mall_orders
        SET trip_id = NULL,
            updated_at = now()
        WHERE id = OLD.id;

        SELECT EXISTS(
            SELECT 1 FROM trip_stops WHERE trip_id = v_trip_id
        ) INTO v_has_remaining_stops;

        IF NOT v_has_remaining_stops THEN
            DELETE FROM vehicle_trips WHERE id = v_trip_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_cancelled_order_cleanup ON mall_orders;

CREATE TRIGGER trigger_cancelled_order_cleanup
    AFTER UPDATE OF status ON mall_orders
    FOR EACH ROW
    WHEN (NEW.status = 'cancelled' AND OLD.trip_id IS NOT NULL)
    EXECUTE FUNCTION cleanup_cancelled_order_from_trip();
