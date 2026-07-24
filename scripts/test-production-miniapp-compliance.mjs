import crypto from 'node:crypto'

const baseUrl = String(process.env.MINIAPP_API_BASE_URL || 'https://car.shcxyz.site')
  .replace(/\/+$/, '')

if (process.env.ALLOW_PRODUCTION_TEST !== '1') {
  throw new Error('Set ALLOW_PRODUCTION_TEST=1 to create and immediately delete temporary test accounts.')
}

const results = []
const users = []

try {
  const policyVersion = await currentPrivacyPolicyVersion()
  const first = await registerTemporaryUser('A')
  users.push(first)
  const second = await registerTemporaryUser('B')
  users.push(second)

  await expectStatus(
    'AUTH-01 未同意隐私政策时业务接口被拒绝',
    api('/api/mall/me/profile', { token: first.token }),
    403,
  )

  await grantConsent(first, policyVersion)
  await grantConsent(second, policyVersion)

  const createdAddress = await expectOk(
    'IDOR-01 前端伪造 userId 不改变地址归属',
    api('/api/mall/addresses', {
      method: 'POST',
      token: first.token,
      body: {
        userId: second.id,
        contactName: '自动化测试用户',
        contactPhone: '19900000000',
        addressLabel: '测试地址',
        addressText: '自动化测试完成后随账号删除',
        latitude: 31.2304,
        longitude: 121.4737,
        addressType: 'home',
        isDefault: true,
      },
    }),
  )
  assert(createdAddress.id, 'address id should exist')

  const secondAddresses = await expectOk(
    'IDOR-02 用户 B 无法读取用户 A 的地址',
    api(`/api/mall/addresses?userId=${encodeURIComponent(first.id)}`, {
      token: second.token,
    }),
  )
  assert(Array.isArray(secondAddresses) && secondAddresses.length === 0, 'user B saw user A address')

  const firstProfile = await expectOk(
    'IDOR-03 用户 A 伪造 userId 仍只返回自己的资料',
    api(`/api/mall/me/profile?userId=${encodeURIComponent(second.id)}`, {
      token: first.token,
    }),
  )
  assert(firstProfile?.member?.id === first.id, 'profile ownership did not follow bearer identity')

  await expectOk(
    'PRIV-01 撤回隐私同意',
    api('/api/mall/privacy/consent', {
      method: 'POST',
      token: first.token,
      body: { policyVersion, action: 'withdrawn', consentItems: [] },
    }),
  )
  await expectStatus(
    'PRIV-02 撤回后地址接口立即被拒绝',
    api('/api/mall/addresses', { token: first.token }),
    403,
  )
  const withdrawn = await expectOk(
    'PRIV-03 撤回后仍可访问隐私选择接口',
    api('/api/mall/privacy/consent', { token: first.token }),
  )
  assert(withdrawn.action === 'withdrawn', 'latest consent should be withdrawn')

  await grantConsent(first, policyVersion)
  await deleteTemporaryUser(first, 'DELETE-01 无阻塞账号可立即注销并匿名化')
  await deleteTemporaryUser(second, 'DELETE-02 第二个临时账号清理完成')

  await expectStatus(
    'DELETE-03 注销后原登录凭证失效',
    api('/api/mall/privacy/consent', { token: first.token }),
    401,
  )
} finally {
  for (const user of users) {
    if (user.deleted) continue
    try {
      const policyVersion = await currentPrivacyPolicyVersion()
      await grantConsent(user, policyVersion)
      await deleteTemporaryUser(user, `CLEANUP-${user.label}`)
    } catch {
      // The summary below makes incomplete cleanup visible without exposing credentials.
      results.push({ case: `CLEANUP-${user.label}`, status: 'FAILED' })
    }
  }
}

const failed = results.filter(result => result.status !== 'PASSED')
for (const result of results) console.log(`${result.status} ${result.case}`)
console.log(`Production miniapp compliance E2E: ${results.length - failed.length}/${results.length} passed`)
if (failed.length > 0) process.exit(1)

async function currentPrivacyPolicyVersion() {
  const legalCenter = await expectOk(
    'LEGAL-01 当前隐私政策可公开读取',
    api('/api/mall/legal-center'),
    { quietDuplicate: true },
  )
  const policy = legalCenter.documents?.find(document => document.documentType === 'privacy_policy')
  assert(policy?.version, 'published privacy policy version should exist')
  return policy.version
}

async function registerTemporaryUser(label) {
  const captcha = await expectOk(
    `AUTH-${label}-CAPTCHA 图形验证码可用`,
    api('/api/mall/auth/captcha'),
  )
  const verificationCode = decodeCaptcha(captcha.image)
  const phone = `1990000${crypto.randomInt(1000, 10000)}`
  const password = `Qa!${crypto.randomBytes(9).toString('base64url')}`
  const user = await expectOk(
    `AUTH-${label}-REGISTER 临时测试账号注册`,
    api('/api/mall/auth/register', {
      method: 'POST',
      body: {
        phone,
        password,
        confirmPassword: password,
        verificationCode,
        captchaId: captcha.captchaId,
        name: `系统测试${label}`,
        role: 'customer',
      },
    }),
  )
  assert(user?.id && user?.token, 'registration should return id and token')
  return { id: user.id, token: user.token, label, deleted: false }
}

async function grantConsent(user, policyVersion) {
  await expectOk(
    `PRIV-${user.label}-GRANT 同意当前隐私政策`,
    api('/api/mall/privacy/consent', {
      method: 'POST',
      token: user.token,
      body: {
        policyVersion,
        action: 'granted',
        consentItems: ['account', 'order_fulfillment', 'customer_service', 'security'],
      },
    }),
    { quietDuplicate: true },
  )
}

async function deleteTemporaryUser(user, caseName) {
  const deletion = await expectOk(
    caseName,
    api('/api/mall/account/deletion', {
      method: 'POST',
      token: user.token,
      body: { reason: '生产环境自动化测试完成后清理临时账号' },
    }),
  )
  assert(deletion.status === 'completed', `temporary account ${user.label} deletion is blocked`)
  user.deleted = true
}

async function api(path, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const payload = await response.json().catch(() => null)
  return { status: response.status, payload }
}

async function expectOk(caseName, request, options = {}) {
  const response = await request
  if (response.status !== 200 || response.payload?.code !== 200) {
    results.push({ case: caseName, status: 'FAILED' })
    throw new Error(`${caseName}: expected 200, got ${response.status}`)
  }
  if (!options.quietDuplicate || !results.some(result => result.case === caseName)) {
    results.push({ case: caseName, status: 'PASSED' })
  }
  return response.payload.data
}

async function expectStatus(caseName, request, status) {
  const response = await request
  const passed = response.status === status
  results.push({ case: caseName, status: passed ? 'PASSED' : 'FAILED' })
  if (!passed) throw new Error(`${caseName}: expected ${status}, got ${response.status}`)
  return response.payload
}

function decodeCaptcha(dataUrl) {
  const encoded = String(dataUrl || '').split(',', 2)[1]
  assert(encoded, 'captcha image data should exist')
  const svg = decodeURIComponent(encoded)
  const characters = [...svg.matchAll(/<text[^>]*>([A-Z2-9])<\/text>/g)].map(match => match[1])
  assert(characters.length === 4, 'captcha should contain four readable characters')
  return characters.join('')
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}
