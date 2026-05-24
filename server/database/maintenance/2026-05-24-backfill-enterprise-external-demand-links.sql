-- Backfill links between enterprise external-capacity demands and public hall demands.
-- Safe to run multiple times. It only fills missing links and normalizes legacy vehicle_source values.

UPDATE enterprise_demands
SET vehicle_source = 'internal',
    updated_at = now()
WHERE vehicle_source = 'own';

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
