ALTER TABLE IF EXISTS dairy_stations ADD COLUMN IF NOT EXISTS point_type text DEFAULT 'terminal';

UPDATE dairy_stations
SET point_type = 'terminal',
    updated_at = now()
WHERE point_type IS NULL
   OR point_type NOT IN ('terminal', 'community_leader');

CREATE INDEX IF NOT EXISTS dairy_stations_point_type_idx ON dairy_stations(point_type);
CREATE INDEX IF NOT EXISTS dairy_stations_enterprise_point_type_idx
  ON dairy_stations(enterprise_id, point_type, status);
