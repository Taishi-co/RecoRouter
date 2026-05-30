CREATE TABLE IF NOT EXISTS payments (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  business_type text NOT NULL,
  business_id text NOT NULL,
  payer_id text,
  provider text NOT NULL,
  out_trade_no text NOT NULL UNIQUE,
  amount_cents bigint NOT NULL,
  currency text NOT NULL DEFAULT 'CNY',
  status text NOT NULL DEFAULT 'pending',
  provider_prepay_id text,
  provider_transaction_id text,
  client_payload jsonb,
  provider_payload jsonb,
  notify_payload jsonb,
  paid_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz
);

CREATE INDEX IF NOT EXISTS payments_business_idx ON payments (business_type, business_id);
CREATE INDEX IF NOT EXISTS payments_status_idx ON payments (status);
CREATE INDEX IF NOT EXISTS payments_provider_idx ON payments (provider);
