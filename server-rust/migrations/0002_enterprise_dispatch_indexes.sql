CREATE INDEX IF NOT EXISTS enterprise_demands_external_demand_id_idx
  ON enterprise_demands(external_demand_id);

CREATE INDEX IF NOT EXISTS vehicles_enterprise_dispatch_idx
  ON vehicles(enterprise_id, usage_mode, status, trip_status);
