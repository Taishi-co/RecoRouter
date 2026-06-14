import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const authModule = readFileSync(resolve('server/src/modules/auth.rs'), 'utf8')
const wechatPayModule = readFileSync(resolve('server/src/wechat_pay.rs'), 'utf8')
const authPage = readFileSync(resolve('src/pages/mall/auth/index.tsx'), 'utf8')
const migration = readFileSync(resolve('server/migrations/0018_mall_wechat_auth.sql'), 'utf8')

const assertions = [
  {
    ok: /\.route\(\s*["']\/api\/mall\/auth\/wechat-login["'][\s\S]*post\(wechat_login/.test(authModule),
    message: 'Mall auth router must expose POST /api/mall/auth/wechat-login',
  },
  {
    ok: /WechatMiniappConfig::from_env(?:_for_service)?\(/.test(authModule)
      && !/wechat_login[\s\S]{0,900}WechatPayMerchantConfig::from_env(?:_for_service)?\(/.test(authModule),
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
    ok: /pub struct MiniappPhoneNumber/.test(wechatPayModule)
      && /WECHAT_ACCESS_TOKEN_URL/.test(wechatPayModule)
      && /WECHAT_GET_PHONE_NUMBER_URL/.test(wechatPayModule)
      && /exchange_miniapp_phone_number/.test(wechatPayModule),
    message: 'Wechat helper must exchange getPhoneNumber phone code into a verified phone number',
  },
  {
    ok: /phone_code:\s*Option<String>/.test(authModule)
      && /exchange_miniapp_phone_number/.test(authModule)
      && /请授权手机号完成快捷登录/.test(authModule)
      && /validate_phone\(&phone/.test(authModule),
    message: 'Mall WeChat login must require phone authorization and validate the returned phone number',
  },
  {
    ok: /default_wechat_display_name/.test(authModule)
      && /微信用户/.test(authModule)
      && /微信团长/.test(authModule)
      && /take\(6\)/.test(authModule),
    message: 'Mall WeChat login must generate a non-duplicated default nickname suffix',
  },
  {
    ok: !/\/api\/auth\/wechat-login/.test(authPage)
      && /Taro\.login\(\)/.test(authPage)
      && /openType=["']getPhoneNumber["']/.test(authPage)
      && /phoneCode/.test(authPage)
      && /mallAuthApiBase\s*=\s*['"]\/api\/mall\/auth['"]/.test(authPage)
      && /\$\{mallAuthApiBase\}\/wechat-login/.test(authPage),
    message: 'Mall auth page must use WeChat phone authorization, call Taro.login, and POST /api/mall/auth/wechat-login',
  },
  {
    ok: /微信手机号快捷登录/.test(authPage) && /role:\s*registerRole/.test(authPage),
    message: 'Mall auth page must show WeChat quick login and pass the selected mall role',
  },
]

for (const assertion of assertions) {
  if (!assertion.ok) {
    throw new Error(assertion.message)
  }
}

console.log(`Mall WeChat auth checks passed (${assertions.length} checks).`)
