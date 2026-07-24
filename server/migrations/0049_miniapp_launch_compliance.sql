-- Mini Program launch compliance: privacy, account deletion, merchant
-- qualifications, invoices, shipping reporting and consumer complaints.
-- No physical foreign keys are added; services validate ownership explicitly.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS anonymized_at timestamptz;

CREATE TABLE IF NOT EXISTS mall_legal_documents (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  document_type text NOT NULL,
  title text NOT NULL,
  version text NOT NULL,
  summary text,
  content jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'retired')),
  effective_at timestamptz,
  published_at timestamptz,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_type, version)
);

CREATE UNIQUE INDEX IF NOT EXISTS mall_legal_documents_current_uidx
  ON mall_legal_documents (document_type)
  WHERE status = 'published';

CREATE TABLE IF NOT EXISTS mall_platform_legal_profile (
  id text PRIMARY KEY DEFAULT 'default',
  operator_name text NOT NULL DEFAULT '叁友甄选',
  legal_entity_name text,
  unified_social_credit_code text,
  business_license_url text,
  business_license_expires_at date,
  platform_qualification_type text,
  platform_qualification_number text,
  platform_qualification_url text,
  platform_qualification_expires_at date,
  service_phone text,
  service_email text,
  complaint_phone text,
  complaint_email text,
  complaint_description text NOT NULL DEFAULT '可在小程序客服中心提交投诉工单',
  office_address text,
  updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO mall_platform_legal_profile (id)
VALUES ('default')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS mall_privacy_consents (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id text NOT NULL,
  policy_version text NOT NULL,
  action text NOT NULL CHECK (action IN ('granted', 'withdrawn')),
  consent_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  source text NOT NULL DEFAULT 'miniapp',
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mall_privacy_consents_user_idx
  ON mall_privacy_consents (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS mall_account_deletion_requests (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'waiting', 'completed', 'cancelled', 'rejected')),
  reason text,
  blockers jsonb NOT NULL DEFAULT '[]'::jsonb,
  requested_at timestamptz NOT NULL DEFAULT now(),
  scheduled_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS mall_account_deletion_active_uidx
  ON mall_account_deletion_requests (user_id)
  WHERE status IN ('pending', 'waiting');

CREATE TABLE IF NOT EXISTS mall_invoice_requests (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  invoice_no text NOT NULL UNIQUE,
  user_id text NOT NULL,
  order_id text NOT NULL,
  invoice_type text NOT NULL DEFAULT 'electronic_normal'
    CHECK (invoice_type IN ('electronic_normal', 'electronic_special')),
  title_type text NOT NULL DEFAULT 'individual'
    CHECK (title_type IN ('individual', 'enterprise')),
  title text NOT NULL,
  tax_number text,
  email text NOT NULL,
  amount_cents bigint NOT NULL,
  status text NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted', 'processing', 'issued', 'rejected', 'cancelled')),
  invoice_url text,
  invoice_code text,
  rejection_reason text,
  issued_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS mall_invoice_requests_active_order_uidx
  ON mall_invoice_requests (order_id)
  WHERE status NOT IN ('rejected', 'cancelled');
CREATE INDEX IF NOT EXISTS mall_invoice_requests_user_idx
  ON mall_invoice_requests (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS mall_invoice_requests_status_idx
  ON mall_invoice_requests (status, created_at DESC);

ALTER TABLE mall_merchants
  ADD COLUMN IF NOT EXISTS business_license_number text,
  ADD COLUMN IF NOT EXISTS business_license_expires_at date,
  ADD COLUMN IF NOT EXISTS last_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_review_at date;

CREATE TABLE IF NOT EXISTS mall_merchant_qualifications (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  merchant_id text NOT NULL,
  qualification_type text NOT NULL
    CHECK (qualification_type IN (
      'business_license', 'food_business_license',
      'prepackaged_food_filing', 'other'
    )),
  qualification_name text NOT NULL,
  certificate_number text NOT NULL,
  certificate_url text NOT NULL,
  issuer text,
  issued_at date,
  expires_at date,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  verified_by text,
  verified_at timestamptz,
  rejection_reason text,
  public_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mall_merchant_qualifications_merchant_idx
  ON mall_merchant_qualifications (merchant_id, status, expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS mall_merchant_qualifications_number_uidx
  ON mall_merchant_qualifications (merchant_id, qualification_type, certificate_number);

CREATE TABLE IF NOT EXISTS mall_wechat_shipping_reports (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  order_id text NOT NULL UNIQUE,
  payment_id text,
  transaction_id text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'reported', 'failed', 'not_required')),
  attempts integer NOT NULL DEFAULT 0,
  request_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  response_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_error text,
  reported_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mall_wechat_shipping_reports_status_idx
  ON mall_wechat_shipping_reports (status, updated_at);

CREATE TABLE IF NOT EXISTS mall_wechat_complaints (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  complaint_id text NOT NULL UNIQUE,
  order_no text,
  transaction_id text,
  user_complaint_times integer NOT NULL DEFAULT 1,
  complaint_detail text,
  complaint_state text NOT NULL DEFAULT 'pending',
  payer_phone text,
  complaint_media jsonb NOT NULL DEFAULT '[]'::jsonb,
  provider_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  response_content text,
  responded_by text,
  responded_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mall_wechat_complaints_state_idx
  ON mall_wechat_complaints (complaint_state, updated_at DESC);

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
    'businessLicenseNumber', merchant.business_license_number,
    'businessLicenseUrl', merchant.business_license_url,
    'businessLicenseExpiresAt', merchant.business_license_expires_at,
    'lastVerifiedAt', merchant.last_verified_at,
    'nextReviewAt', merchant.next_review_at,
    'contactName', merchant.contact_name,
    'contactPhone', merchant.contact_phone,
    'metadata', merchant.metadata,
    'createdAt', merchant.created_at,
    'updatedAt', merchant.updated_at
  )
$$;

INSERT INTO mall_legal_documents (
  document_type, title, version, summary, content, status, effective_at, published_at
) VALUES
(
  'privacy_policy', '叁友甄选隐私保护指引', '2026.07',
  '说明个人信息处理目的、方式、范围及用户权利。',
  '[
    {"heading":"我们如何收集和使用信息","body":"仅为登录、下单、配送、售后和安全保障处理必要信息；非必要信息将单独征得同意。"},
    {"heading":"个人信息清单","items":["微信OpenID：账号识别与登录","手机号：账号登录、订单通知与售后联系","收货人、电话和地址：履约配送","订单与支付状态：交易、退款和售后","设备及日志信息：安全审计与故障排查","定位信息：经单独授权后推荐附近自提点"]},
    {"heading":"第三方SDK清单","items":["微信小程序基础能力：登录、手机号授权、支付和客服，提供方深圳市腾讯计算机系统有限公司","腾讯云对象存储：商品与资质图片存储，提供方腾讯云计算（北京）有限责任公司"]},
    {"heading":"保存期限与安全","body":"信息仅在实现业务目的及法定义务所需期限内保存；交易记录依法留存后进行匿名化处理。"},
    {"heading":"您的权利","body":"可在隐私中心查询或撤回同意，在账号与安全中申请注销；撤回不影响此前基于同意开展的处理。"},
    {"heading":"投诉与联系","body":"可通过小程序客服中心提交隐私或个人信息投诉，平台将在十五个工作日内反馈。"}
  ]'::jsonb,
  'published', now(), now()
),
(
  'service_agreement', '叁友甄选用户服务协议', '2026.07',
  '约定账号、交易、配送、售后、争议解决与平台责任。',
  '[
    {"heading":"服务内容","body":"平台提供商品展示、订单撮合、支付接入、配送进度和售后协助服务。"},
    {"heading":"账号使用","body":"用户应提供真实必要信息并妥善保管账号凭证，不得实施欺诈、刷单或侵犯他人权益的行为。"},
    {"heading":"交易与售后","body":"商品价格、运费、履约主体和售后规则以订单确认页及已公示交易规则为准。"},
    {"heading":"争议解决","body":"可先通过客服投诉处理；协商不成的，依法向有管辖权的人民法院主张权利。"}
  ]'::jsonb,
  'published', now(), now()
),
(
  'transaction_rules', '叁友甄选平台交易规则', '2026.07',
  '公示商品、订单、配送、退款、售后与商家管理规则。',
  '[
    {"heading":"下单与支付","body":"订单以支付成功为生效条件；库存或价格异常时平台将及时通知并原路退款。"},
    {"heading":"配送与签收","body":"配送时间为预计时间；冷链或称重商品的特殊规则会在商品和订单页面明示。"},
    {"heading":"退款与售后","body":"用户可在订单详情提交退款退货申请并查看处理进度；平台留存完整协商与处理记录。"},
    {"heading":"商家管理","body":"平台核验、登记并定期更新商家身份和许可信息；资质过期、被撤销或不再适用时暂停相关经营。"},
    {"heading":"规则更新","body":"规则变更将生成新版本并公示生效日期，历史版本继续存档可查。"}
  ]'::jsonb,
  'published', now(), now()
)
ON CONFLICT (document_type, version) DO NOTHING;
