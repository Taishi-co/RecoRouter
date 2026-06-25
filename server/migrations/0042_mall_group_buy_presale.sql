CREATE TABLE IF NOT EXISTS mall_group_buy_activities (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name text NOT NULL,
  product_id text NOT NULL,
  variant_id text,
  unit_name text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  balance_due_at timestamptz,
  min_group_quantity integer NOT NULL CHECK (min_group_quantity > 0),
  max_quantity_per_user integer CHECK (max_quantity_per_user IS NULL OR max_quantity_per_user > 0),
  min_credit_score integer NOT NULL DEFAULT 80 CHECK (min_credit_score >= 0),
  overdue_credit_penalty integer NOT NULL DEFAULT 10 CHECK (overdue_credit_penalty >= 0),
  deposit_type text NOT NULL DEFAULT 'percent',
  deposit_value integer NOT NULL DEFAULT 20 CHECK (deposit_value >= 0),
  tiers jsonb NOT NULL DEFAULT '[]'::jsonb,
  formed_quantity integer NOT NULL DEFAULT 0,
  final_tier_quantity integer,
  final_unit_price_cents bigint,
  ops_review_reason text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mall_group_buy_activities_status_time_idx
  ON mall_group_buy_activities (status, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS mall_group_buy_activities_product_idx
  ON mall_group_buy_activities (product_id, variant_id);

CREATE TABLE IF NOT EXISTS mall_group_buy_subscriptions (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  activity_id text NOT NULL,
  user_id text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending_deposit',
  estimated_unit_price_cents bigint NOT NULL DEFAULT 0,
  final_unit_price_cents bigint,
  estimated_total_cents bigint NOT NULL DEFAULT 0,
  deposit_cents bigint NOT NULL DEFAULT 0,
  balance_cents bigint NOT NULL DEFAULT 0,
  deposit_payment_id text,
  balance_payment_id text,
  deposit_paid_at timestamptz,
  balance_paid_at timestamptz,
  mall_order_id text,
  cancel_reason text,
  credit_penalty_points integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS mall_group_buy_subscriptions_active_user_uidx
  ON mall_group_buy_subscriptions (activity_id, user_id)
  WHERE status NOT IN ('deposit_refunded', 'balance_overdue_cancelled', 'activity_cancel_refunding', 'refunded');
CREATE INDEX IF NOT EXISTS mall_group_buy_subscriptions_activity_status_idx
  ON mall_group_buy_subscriptions (activity_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS mall_group_buy_subscriptions_user_idx
  ON mall_group_buy_subscriptions (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS mall_group_buy_events (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  activity_id text,
  subscription_id text,
  event_type text NOT NULL,
  title text NOT NULL,
  description text,
  actor_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mall_group_buy_events_activity_idx
  ON mall_group_buy_events (activity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS mall_group_buy_events_subscription_idx
  ON mall_group_buy_events (subscription_id, created_at DESC);

CREATE TABLE IF NOT EXISTS mall_credit_ledger (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id text NOT NULL,
  source_type text NOT NULL,
  source_id text NOT NULL,
  delta integer NOT NULL,
  score_before integer NOT NULL,
  score_after integer NOT NULL,
  reason text NOT NULL,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS mall_credit_ledger_source_uidx
  ON mall_credit_ledger (source_type, source_id, reason);
CREATE INDEX IF NOT EXISTS mall_credit_ledger_user_idx
  ON mall_credit_ledger (user_id, created_at DESC);

-- Payment business types used by this feature: mall_group_buy_deposit, mall_group_buy_balance.

CREATE OR REPLACE FUNCTION mall_group_buy_activity_json(activity mall_group_buy_activities)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'id', activity.id,
    'name', activity.name,
    'productId', activity.product_id,
    'variantId', activity.variant_id,
    'unitName', activity.unit_name,
    'status', activity.status,
    'startsAt', activity.starts_at,
    'endsAt', activity.ends_at,
    'balanceDueAt', activity.balance_due_at,
    'minGroupQuantity', activity.min_group_quantity,
    'maxQuantityPerUser', activity.max_quantity_per_user,
    'minCreditScore', activity.min_credit_score,
    'overdueCreditPenalty', activity.overdue_credit_penalty,
    'depositType', activity.deposit_type,
    'depositValue', activity.deposit_value,
    'tiers', activity.tiers,
    'formedQuantity', activity.formed_quantity,
    'finalTierQuantity', activity.final_tier_quantity,
    'finalUnitPriceCents', activity.final_unit_price_cents,
    'opsReviewReason', activity.ops_review_reason,
    'createdBy', activity.created_by,
    'createdAt', activity.created_at,
    'updatedAt', activity.updated_at
  );
$$;

CREATE OR REPLACE FUNCTION mall_group_buy_subscription_json(subscription mall_group_buy_subscriptions)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'id', subscription.id,
    'activityId', subscription.activity_id,
    'userId', subscription.user_id,
    'quantity', subscription.quantity,
    'unitName', subscription.unit_name,
    'status', subscription.status,
    'estimatedUnitPriceCents', subscription.estimated_unit_price_cents,
    'finalUnitPriceCents', subscription.final_unit_price_cents,
    'estimatedTotalCents', subscription.estimated_total_cents,
    'depositCents', subscription.deposit_cents,
    'balanceCents', subscription.balance_cents,
    'depositPaymentId', subscription.deposit_payment_id,
    'balancePaymentId', subscription.balance_payment_id,
    'depositPaidAt', subscription.deposit_paid_at,
    'balancePaidAt', subscription.balance_paid_at,
    'mallOrderId', subscription.mall_order_id,
    'cancelReason', subscription.cancel_reason,
    'creditPenaltyPoints', subscription.credit_penalty_points,
    'createdAt', subscription.created_at,
    'updatedAt', subscription.updated_at
  );
$$;
