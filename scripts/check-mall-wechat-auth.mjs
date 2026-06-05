import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const authModule = readFileSync(resolve('server/src/modules/auth.rs'), 'utf8')
const wechatPayModule = readFileSync(resolve('server/src/wechat_pay.rs'), 'utf8')
const authPage = readFileSync(resolve('src/pages/mall/auth/index.tsx'), 'utf8')
const migration = readFileSync(resolve('server/migrations/0018_mall_wechat_auth.sql'), 'utf8')

const assertions = [
  {
    ok: /\.route\(\s*["']\/api\/auth\/wechat-login["'][\s\S]*post\(wechat_login/.test(authModule),
    message: 'Auth router must expose POST /api/auth/wechat-login',
  },
  {
    ok: /WechatMiniappConfig::from_env\(\)/.test(authModule) && !/wechat_login[\s\S]{0,900}WechatPayMerchantConfig::from_env\(\)/.test(authModule),
    message: 'Wechat auth login must only require miniapp appid/secret, not full payment merchant config',
  },
  {
    ok: /exchange_miniapp_login_session/.test(authModule) && /wechat_openid/.test(authModule) && /wechat_appid/.test(authModule),
    message: 'Wechat auth login must exchange login code and persist appid/openid on users',
  },
  {
    ok: /CREATE UNIQUE INDEX IF NOT EXISTS users_wechat_appid_openid_uidx/i.test(migration)
      && /wechat_openid text/i.test(migration)
      && /wechat_unionid text/i.test(migration)
      && /wechat_appid text/i.test(migration),
    message: 'Migration must add user WeChat identity columns and a unique appid/openid index',
  },
  {
    ok: /pub struct WechatMiniappConfig/.test(wechatPayModule)
      && /pub struct MiniappLoginSession/.test(wechatPayModule)
      && /unionid: Option<String>/.test(wechatPayModule),
    message: 'Wechat helper must expose miniapp-only config and unionid-aware login session',
  },
  {
    ok: /Taro\.login\(\)/.test(authPage) && /\/api\/auth\/wechat-login/.test(authPage),
    message: 'Mall auth page must call Taro.login and POST /api/auth/wechat-login',
  },
  {
    ok: /微信快捷登录/.test(authPage) && /role:\s*registerRole/.test(authPage),
    message: 'Mall auth page must show WeChat quick login and pass the selected mall role',
  },
]

for (const assertion of assertions) {
  if (!assertion.ok) {
    throw new Error(assertion.message)
  }
}

console.log(`Mall WeChat auth checks passed (${assertions.length} checks).`)
