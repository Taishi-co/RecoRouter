ALTER TABLE IF EXISTS mall_operation_settings
  ADD COLUMN IF NOT EXISTS delivery_rules jsonb NOT NULL DEFAULT '{
    "pickupWindowStart": "16:00",
    "pickupWindowEnd": "20:00",
    "deliveryBatchTimes": "10:00,14:00,18:00",
    "deliveryFeeCents": 600,
    "freeDeliveryThresholdCents": 9900,
    "coldChainRequired": true,
    "refundReviewMinutes": 10
  }'::jsonb;

ALTER TABLE IF EXISTS mall_operation_settings
  ADD COLUMN IF NOT EXISTS payment_split_rules jsonb NOT NULL DEFAULT '{
    "leaderCommissionRate": 8,
    "platformServiceRate": 3,
    "supplierSettlementCycle": "T+7",
    "withdrawMinCents": 10000
  }'::jsonb;

UPDATE mall_operation_settings
SET delivery_rules = delivery_rules
  || jsonb_build_object(
    'deliveryFeeCents', default_delivery_fee_cents,
    'freeDeliveryThresholdCents', free_delivery_threshold_cents,
    'coldChainRequired', cold_chain_enabled,
    'refundReviewMinutes', refund_review_minutes
  ),
  payment_split_rules = payment_split_rules
WHERE id = 'default';

CREATE OR REPLACE FUNCTION settings_json(settings mall_operation_settings)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'id', settings.id,
    'freeDeliveryThresholdCents', settings.free_delivery_threshold_cents,
    'defaultDeliveryFeeCents', settings.default_delivery_fee_cents,
    'deliveryPromiseMinutes', settings.delivery_promise_minutes,
    'coldChainEnabled', settings.cold_chain_enabled,
    'refundReviewMinutes', settings.refund_review_minutes,
    'deliveryRules', settings.delivery_rules,
    'paymentSplitRules', settings.payment_split_rules,
    'roles', settings.roles,
    'riskThresholds', settings.risk_thresholds,
    'updatedAt', settings.updated_at
  )
$$;
