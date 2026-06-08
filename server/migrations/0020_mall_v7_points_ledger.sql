CREATE TABLE IF NOT EXISTS mall_points_ledger (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id text NOT NULL,
  order_id text,
  entry_type text NOT NULL DEFAULT 'adjust',
  points integer NOT NULL DEFAULT 0,
  description text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mall_points_ledger_user_idx ON mall_points_ledger (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS mall_points_ledger_order_idx ON mall_points_ledger (order_id);
CREATE INDEX IF NOT EXISTS mall_points_ledger_type_idx ON mall_points_ledger (entry_type);
