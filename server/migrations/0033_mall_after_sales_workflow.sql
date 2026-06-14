-- Add cancellation fields to vehicle_trips
ALTER TABLE vehicle_trips ADD COLUMN IF NOT EXISTS cancel_reason text;
ALTER TABLE vehicle_trips ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
