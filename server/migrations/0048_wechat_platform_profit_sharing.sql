-- WeChat Pay platform collection and payment (平台收付通) support (migration 0048).
-- Independent partners are onboarded as WeChat secondary merchants. Customer
-- funds therefore enter the secondary merchant account instead of the platform
-- collecting and settling them offline.

CREATE TABLE IF NOT EXISTS mall_merchants (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name text NOT NULL,
  legal_name text NOT NULL,
  wechat_sub_mchid text NOT NULL UNIQUE,
  wechat_sub_appid text,
  service_fee_rate_bps integer NOT NULL DEFAULT 300,
  onboarding_status text NOT NULL DEFAULT 'pending',
  qualification_status text NOT NULL DEFAULT 'pending',
  business_license_url text,
  contact_name text,
  contact_phone text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mall_merchants_service_fee_rate_check
    CHECK (service_fee_rate_bps BETWEEN 1 AND 3000),
  CONSTRAINT mall_merchants_onboarding_status_check
    CHECK (onboarding_status IN ('pending', 'active', 'suspended', 'rejected')),
  CONSTRAINT mall_merchants_qualification_status_check
    CHECK (qualification_status IN ('pending', 'approved', 'rejected', 'expired'))
);

CREATE INDEX IF NOT EXISTS mall_merchants_status_idx
  ON mall_merchants (onboarding_status, qualification_status, created_at DESC);

ALTER TABLE mall_products
  ADD COLUMN IF NOT EXISTS merchant_id text;

CREATE INDEX IF NOT EXISTS mall_products_merchant_idx
  ON mall_products (merchant_id, status, created_at DESC);

ALTER TABLE mall_order_items
  ADD COLUMN IF NOT EXISTS merchant_id text;

CREATE INDEX IF NOT EXISTS mall_order_items_merchant_idx
  ON mall_order_items (merchant_id, created_at DESC);

ALTER TABLE mall_orders
  ADD COLUMN IF NOT EXISTS wechat_sub_mchid text,
  ADD COLUMN IF NOT EXISTS wechat_sub_appid text,
  ADD COLUMN IF NOT EXISTS platform_service_fee_rate_bps integer,
  ADD COLUMN IF NOT EXISTS platform_service_fee_cents bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS merchant_receivable_cents bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS profit_sharing_status text NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS profit_sharing_out_order_no text,
  ADD COLUMN IF NOT EXISTS profit_sharing_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS profit_sharing_last_error text;

CREATE UNIQUE INDEX IF NOT EXISTS mall_orders_profit_sharing_out_order_uidx
  ON mall_orders (profit_sharing_out_order_no)
  WHERE profit_sharing_out_order_no IS NOT NULL;

CREATE INDEX IF NOT EXISTS mall_orders_profit_sharing_status_idx
  ON mall_orders (profit_sharing_status, completed_at DESC)
  WHERE profit_sharing_status <> 'not_required';

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS payment_mode text NOT NULL DEFAULT 'direct',
  ADD COLUMN IF NOT EXISTS wechat_sub_mchid text,
  ADD COLUMN IF NOT EXISTS profit_sharing_required boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS payments_profit_sharing_idx
  ON payments (profit_sharing_required, status, paid_at DESC)
  WHERE profit_sharing_required = true;

CREATE TABLE IF NOT EXISTS platform_profit_sharing_orders (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  payment_id text NOT NULL,
  business_type text NOT NULL,
  business_id text NOT NULL,
  sub_mchid text NOT NULL,
  transaction_id text NOT NULL,
  out_order_no text NOT NULL UNIQUE,
  provider_order_id text,
  platform_service_fee_cents bigint NOT NULL,
  merchant_receivable_cents bigint NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  provider_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT platform_profit_sharing_amount_check
    CHECK (platform_service_fee_cents > 0 AND merchant_receivable_cents > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS platform_profit_sharing_payment_uidx
  ON platform_profit_sharing_orders (payment_id);

CREATE INDEX IF NOT EXISTS platform_profit_sharing_status_idx
  ON platform_profit_sharing_orders (status, updated_at ASC);

CREATE OR REPLACE FUNCTION mall_merchant_json(merchant mall_merchants)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'id', merchant.id,
    'name', merchant.name,
    'legalName', merchant.legal_name,
    'wechatSubMchid', merchant.wechat_sub_mchid,
    'wechatSubAppid', merchant.wechat_sub_appid,
    'serviceFeeRateBps', merchant.service_fee_rate_bps,
    'onboardingStatus', merchant.onboarding_status,
    'qualificationStatus', merchant.qualification_status,
    'businessLicenseUrl', merchant.business_license_url,
    'contactName', merchant.contact_name,
    'contactPhone', merchant.contact_phone,
    'metadata', merchant.metadata,
    'createdAt', merchant.created_at,
    'updatedAt', merchant.updated_at
  )
$$;

CREATE TABLE IF NOT EXISTS platform_profit_sharing_returns (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  profit_sharing_order_id text NOT NULL,
  refund_order_id text NOT NULL,
  out_return_no text NOT NULL UNIQUE,
  amount_cents bigint NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  provider_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT platform_profit_sharing_return_amount_check CHECK (amount_cents > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS platform_profit_sharing_return_refund_uidx
  ON platform_profit_sharing_returns (refund_order_id);

-- Existing products remain self-operated and keep using the direct merchant
-- payment path. A product only enters partner mode after an approved merchant
-- is assigned explicitly.
