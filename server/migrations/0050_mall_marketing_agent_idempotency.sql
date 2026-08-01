CREATE UNIQUE INDEX IF NOT EXISTS mall_campaigns_agent_idempotency_uidx
  ON mall_campaigns ((btrim(rules ->> 'idempotencyKey')))
  WHERE status <> 'deleted'
    AND NULLIF(btrim(rules ->> 'idempotencyKey'), '') IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS mall_coupons_agent_idempotency_uidx
  ON mall_coupons ((btrim(rules ->> 'idempotencyKey')))
  WHERE status <> 'deleted'
    AND NULLIF(btrim(rules ->> 'idempotencyKey'), '') IS NOT NULL;
