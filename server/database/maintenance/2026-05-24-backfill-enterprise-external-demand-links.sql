-- Backfill links between enterprise external-capacity demands and public hall demands.
-- Safe to run multiple times. It fills missing links and normalizes legacy vehicle_source/allocation values.

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
