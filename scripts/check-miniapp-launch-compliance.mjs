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
  authPage: read('src/pages/mall/auth/index.tsx'),
  legalPage: read('src/pages/mall/legal/index.tsx'),
  admin: read('src/web-admin/main.tsx'),
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
    name: '商城启动时同步公开条款版本和服务端同意状态',
    pass:
      /await getLegalCenter\(\)/.test(files.miniappApp)
      && /resolvePrivacyPolicyVersion\(center\)/.test(files.miniappApp)
      && /acceptedPolicyVersion === currentPolicyVersion/.test(files.miniappApp)
      && /useDidShow\(scheduleMallPrivacyCheck\)/.test(files.miniappApp)
      && /await getPrivacyConsent\(\)/.test(files.miniappApp)
      && /consent\.action === 'granted'/.test(files.miniappApp)
      && /consent\.currentPolicyVersion/.test(files.miniappApp),
  },
  {
    name: '首启只显示可点击条款入口和一次确认操作',
    pass:
      /if \(firstLaunch\)/.test(files.privacyPage)
      && /<Dialog[\s\S]*open=\{promptOpen\}/.test(files.privacyPage)
      && /consentDocuments\.map/.test(files.privacyPage)
      && /openDocument\(document\.documentType\)/.test(files.privacyPage)
      && /同意并继续/.test(files.privacyPage)
      && files.privacyPage.indexOf('if (firstLaunch)') < files.privacyPage.indexOf('privacyPolicy?.content.map'),
  },
  {
    name: '条款入口打开独立全文页并可靠返回确认弹窗',
    pass:
      /params\.documentType/.test(files.legalPage)
      && /selectedDocument\.content\.map/.test(files.legalPage)
      && /正在加载条款全文/.test(files.legalPage)
      && /returnToConsent=1/.test(files.privacyPage)
      && /reason=policy_updated/.test(files.privacyPage)
      && /Taro\.redirectTo\(\{ url: `\/pages\/mall\/privacy\/index\?\$\{query\.join\('&'\)\}` \}\)/.test(files.legalPage),
  },
  {
    name: '登录页使用管理端当前隐私版本记录同意',
    pass:
      /getLegalCenter\(\)/.test(files.authPage)
      && /resolvePrivacyPolicyVersion\(center\)/.test(files.authPage)
      && /recordPrivacyConsent\('granted', currentPolicyVersion\)/.test(files.authPage)
      && /MALL_PRIVACY_STORAGE_KEY, currentPolicyVersion/.test(files.authPage),
  },
  {
    name: '管理端支持复制条款、发布新版本并提示重新确认',
    pass:
      /copyDocumentToDraft/.test(files.admin)
      && /parseLegalDocumentContent/.test(files.admin)
      && /复制并修改/.test(files.admin)
      && /继续编辑/.test(files.admin)
      && /apiPut\(`\/api\/admin\/mall\/legal-documents\/\$\{documentDraft\.sourceId\}`/.test(files.admin)
      && /async fn admin_update_legal_document/.test(files.mall)
      && /current_status != "draft"/.test(files.mall)
      && /所有用户下次打开商城时都会先看到更新提醒/.test(files.admin)
      && /用户下次使用前会重新确认/.test(files.admin),
  },
]

const failed = checks.filter(check => !check.pass)
if (failed.length > 0) {
  console.error('Miniapp launch compliance checks failed:')
  for (const check of failed) console.error(`- ${check.name}`)
  process.exit(1)
}

console.log(`Miniapp launch compliance checks passed (${checks.length} checks).`)
