CREATE TABLE IF NOT EXISTS platform_app_configs (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  service_name text NOT NULL,
  app_type text NOT NULL,
  appid text NOT NULL,
  mch_id text,
  notify_url text,
  status text NOT NULL DEFAULT 'active',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS platform_app_configs_service_type_uidx
  ON platform_app_configs (service_name, app_type, appid);

CREATE TABLE IF NOT EXISTS platform_payment_orders (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  business_type text NOT NULL,
  business_id text NOT NULL,
  appid text,
  payer_id text,
  payer_openid text,
  provider text NOT NULL DEFAULT 'wechat',
  out_trade_no text NOT NULL UNIQUE,
  amount_cents bigint NOT NULL,
  currency text NOT NULL DEFAULT 'CNY',
  status text NOT NULL DEFAULT 'pending',
  idempotency_key text,
  provider_prepay_id text,
  provider_transaction_id text,
  client_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  provider_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  notify_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  paid_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS platform_payment_orders_idempotency_uidx
  ON platform_payment_orders (idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS platform_payment_orders_business_idx
  ON platform_payment_orders (business_type, business_id);
CREATE INDEX IF NOT EXISTS platform_payment_orders_status_idx
  ON platform_payment_orders (status, created_at DESC);

CREATE TABLE IF NOT EXISTS platform_refund_orders (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  business_type text NOT NULL,
  business_id text NOT NULL,
  payment_order_id text,
  provider text NOT NULL DEFAULT 'wechat',
  out_refund_no text NOT NULL UNIQUE,
  amount_cents bigint NOT NULL,
  currency text NOT NULL DEFAULT 'CNY',
  reason text,
  status text NOT NULL DEFAULT 'submitted',
  requested_by text,
  idempotency_key text,
  provider_refund_id text,
  provider_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  notify_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS platform_refund_orders_idempotency_uidx
  ON platform_refund_orders (idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS platform_refund_orders_business_idx
  ON platform_refund_orders (business_type, business_id);
CREATE INDEX IF NOT EXISTS platform_refund_orders_status_idx
  ON platform_refund_orders (status, created_at DESC);

CREATE TABLE IF NOT EXISTS platform_transfer_orders (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  business_type text NOT NULL,
  business_id text NOT NULL,
  receiver_id text NOT NULL,
  receiver_name text,
  provider text NOT NULL DEFAULT 'wechat',
  out_bill_no text NOT NULL UNIQUE,
  transfer_bill_no text,
  amount_cents bigint NOT NULL,
  currency text NOT NULL DEFAULT 'CNY',
  reason text,
  status text NOT NULL DEFAULT 'submitted',
  requested_by text,
  idempotency_key text,
  package_info text,
  provider_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  notify_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS platform_transfer_orders_idempotency_uidx
  ON platform_transfer_orders (idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS platform_transfer_orders_business_idx
  ON platform_transfer_orders (business_type, business_id);
CREATE INDEX IF NOT EXISTS platform_transfer_orders_status_idx
  ON platform_transfer_orders (status, created_at DESC);

CREATE TABLE IF NOT EXISTS platform_receivers (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  receiver_type text NOT NULL,
  receiver_name text NOT NULL,
  provider text NOT NULL DEFAULT 'wechat',
  provider_account_id text,
  status text NOT NULL DEFAULT 'active',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS platform_receivers_status_idx
  ON platform_receivers (status, created_at DESC);

CREATE TABLE IF NOT EXISTS platform_split_plans (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  business_type text NOT NULL,
  business_id text NOT NULL,
  payment_id text,
  plan_stage text NOT NULL DEFAULT 'default',
  total_amount_cents bigint NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  submitted_by text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  executed_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS platform_split_plans_business_stage_uidx
  ON platform_split_plans (business_type, business_id, plan_stage);
CREATE INDEX IF NOT EXISTS platform_split_plans_status_idx
  ON platform_split_plans (status, created_at DESC);

CREATE TABLE IF NOT EXISTS platform_split_items (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  plan_id text NOT NULL,
  receiver_id text NOT NULL,
  receiver_type text,
  amount_cents bigint NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS platform_split_items_plan_idx
  ON platform_split_items (plan_id, created_at ASC);
CREATE INDEX IF NOT EXISTS platform_split_items_receiver_idx
  ON platform_split_items (receiver_id, created_at DESC);

CREATE TABLE IF NOT EXISTS platform_event_deliveries (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  event_type text NOT NULL,
  business_type text NOT NULL,
  business_id text NOT NULL,
  platform_record_id text,
  target_service text NOT NULL,
  callback_url text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  next_retry_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS platform_event_deliveries_status_idx
  ON platform_event_deliveries (status, next_retry_at, created_at DESC);
CREATE INDEX IF NOT EXISTS platform_event_deliveries_business_idx
  ON platform_event_deliveries (business_type, business_id);

CREATE TABLE IF NOT EXISTS platform_cos_uploads (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  service_name text NOT NULL,
  business_type text,
  business_id text,
  key text NOT NULL,
  original_file_name text,
  content_type text,
  size_bytes bigint,
  status text NOT NULL DEFAULT 'active',
  uploaded_by text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS platform_cos_uploads_service_idx
  ON platform_cos_uploads (service_name, created_at DESC);
CREATE INDEX IF NOT EXISTS platform_cos_uploads_key_idx
  ON platform_cos_uploads (key);

CREATE TABLE IF NOT EXISTS platform_audit_logs (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  service_name text NOT NULL,
  actor_id text,
  actor_type text,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,
  business_type text,
  business_id text,
  request_id text,
  ip_address text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS platform_audit_logs_service_created_idx
  ON platform_audit_logs (service_name, created_at DESC);
CREATE INDEX IF NOT EXISTS platform_audit_logs_business_idx
  ON platform_audit_logs (business_type, business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS platform_audit_logs_actor_idx
  ON platform_audit_logs (actor_id, created_at DESC);

CREATE TABLE IF NOT EXISTS platform_idempotency_keys (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  idempotency_key text NOT NULL UNIQUE,
  service_name text NOT NULL,
  request_hash text,
  response_payload jsonb,
  status text NOT NULL DEFAULT 'processing',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  expires_at timestamptz
);

CREATE INDEX IF NOT EXISTS platform_idempotency_keys_service_idx
  ON platform_idempotency_keys (service_name, created_at DESC);
