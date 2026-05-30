CREATE TABLE IF NOT EXISTS owner_wallet_accounts (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  owner_id text NOT NULL,
  provider text NOT NULL DEFAULT 'wechat',
  appid text NOT NULL,
  openid text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS owner_wallet_accounts_owner_provider_appid_uidx
  ON owner_wallet_accounts (owner_id, provider, appid)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS owner_wallet_accounts_owner_idx
  ON owner_wallet_accounts (owner_id);

CREATE TABLE IF NOT EXISTS owner_wallet_ledger_entries (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  owner_id text NOT NULL,
  order_id text,
  withdrawal_id text,
  entry_type text NOT NULL,
  amount_cents bigint NOT NULL,
  status text NOT NULL DEFAULT 'posted',
  description text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS owner_wallet_ledger_fare_credit_order_uidx
  ON owner_wallet_ledger_entries (order_id)
  WHERE entry_type = 'fare_credit' AND order_id IS NOT NULL AND status = 'posted';

CREATE UNIQUE INDEX IF NOT EXISTS owner_wallet_ledger_withdrawal_type_uidx
  ON owner_wallet_ledger_entries (withdrawal_id, entry_type)
  WHERE withdrawal_id IS NOT NULL
    AND entry_type IN ('withdrawal_hold', 'withdrawal_release');

CREATE INDEX IF NOT EXISTS owner_wallet_ledger_owner_created_idx
  ON owner_wallet_ledger_entries (owner_id, created_at DESC);

CREATE TABLE IF NOT EXISTS owner_withdrawals (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  owner_id text NOT NULL,
  provider text NOT NULL,
  amount_cents bigint NOT NULL,
  status text NOT NULL,
  out_bill_no text NOT NULL UNIQUE,
  transfer_bill_no text,
  package_info text,
  wechat_state text,
  fail_reason text,
  manual_note text,
  provider_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS owner_withdrawals_owner_created_idx
  ON owner_withdrawals (owner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS owner_withdrawals_status_idx
  ON owner_withdrawals (status);
