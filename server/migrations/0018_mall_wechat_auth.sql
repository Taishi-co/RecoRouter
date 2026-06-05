ALTER TABLE users ADD COLUMN IF NOT EXISTS wechat_openid text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS wechat_unionid text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS wechat_appid text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS wechat_bound_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS users_wechat_appid_openid_uidx
  ON users (wechat_appid, wechat_openid)
  WHERE wechat_appid IS NOT NULL AND wechat_openid IS NOT NULL;

CREATE INDEX IF NOT EXISTS users_wechat_unionid_idx
  ON users (wechat_unionid)
  WHERE wechat_unionid IS NOT NULL;
