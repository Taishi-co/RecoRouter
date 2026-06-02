CREATE TABLE IF NOT EXISTS admin_sessions (
  token text PRIMARY KEY,
  user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE INDEX IF NOT EXISTS admin_sessions_user_created_idx
  ON admin_sessions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS admin_sessions_active_token_idx
  ON admin_sessions (token)
  WHERE revoked_at IS NULL;
