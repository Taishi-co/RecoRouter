import fs from 'node:fs'

const read = path => fs.readFileSync(path, 'utf8')

const files = {
  app: read('server/src/app.rs'),
  auth: read('server/src/modules/auth.rs'),
  mall: read('server/src/modules/mall.rs'),
  payments: read('server/src/modules/payments.rs'),
  privacyPage: read('src/pages/mall/privacy/index.tsx'),
  privacyService: read('src/services/mall-compliance.ts'),
  miniappApp: read('src/app.tsx'),
}

const checks = [
  {
    name: '商城业务接口使用隐私同意守卫',
    pass:
      /mall::customer_router::<S>\(\)[\s\S]*auth::mall_customer_guard::<S>/.test(files.app)
      && /pub async fn mall_customer_guard/.test(files.auth)
      && /请先阅读并同意当前隐私政策/.test(files.auth),
  },
  {
    name: '隐私选择和账号注销在撤回后仍可访问',
    pass:
      /pub fn customer_compliance_router/.test(files.mall)
      && /mall::customer_compliance_router::<S>\(\)[\s\S]*auth::user_guard::<S>/.test(files.app),
  },
  {
    name: '守卫只认可最新一次且仍处于发布状态的同意记录',
    pass:
      /ORDER BY consent\.created_at DESC, consent\.id DESC/.test(files.auth)
      && /document\.status = 'published'/.test(files.auth),
  },
  {
    name: '商城预支付无法绕过隐私同意守卫',
    pass:
      /business_type\.is_mall\(\)/.test(files.payments)
      && /require_mall_privacy_consent\(&state\.db, &user\)/.test(files.payments),
  },
  {
    name: '等待中的账号注销会刷新阻塞项并在条件满足后自动完成',
    pass:
      /async fn reconcile_account_deletion/.test(files.mall)
      && /reconcile_account_deletion\(&state\.db, &user\.id\)\.await\?/.test(files.mall)
      && /complete_account_deletion\(pool, user_id, &request_id\)/.test(files.mall),
  },
  {
    name: '账号注销覆盖集采和开票阻塞并匿名化订单直接身份信息',
    pass:
      /'type', 'active_group_buy'/.test(files.mall)
      && /'type', 'active_invoice'/.test(files.mall)
      && /recipient_name = '已注销用户'/.test(files.mall)
      && /recipient_phone = NULL/.test(files.mall)
      && /address_text = '已匿名化'/.test(files.mall)
      && /UPDATE support_sessions SET user_id = \$2/.test(files.mall),
  },
  {
    name: '隐私中心支持读取状态、撤回后重新同意并恢复功能',
    pass:
      /export function getPrivacyConsent/.test(files.privacyService)
      && /getPrivacyConsent\(\)/.test(files.privacyPage)
      && /重新同意并恢复功能/.test(files.privacyPage),
  },
  {
    name: '商城启动时同步服务端同意状态',
    pass:
      /await getPrivacyConsent\(\)/.test(files.miniappApp)
      && /consent\.action === 'granted'/.test(files.miniappApp)
      && /consent\.currentPolicyVersion/.test(files.miniappApp),
  },
]

const failed = checks.filter(check => !check.pass)
if (failed.length > 0) {
  console.error('Miniapp launch compliance checks failed:')
  for (const check of failed) console.error(`- ${check.name}`)
  process.exit(1)
}

console.log(`Miniapp launch compliance checks passed (${checks.length} checks).`)
