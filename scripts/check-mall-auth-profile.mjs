import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const appConfigSource = readFileSync(resolve('src/app.config.ts'), 'utf8')
const profileSource = readFileSync(resolve('src/pages/mall/profile/index.tsx'), 'utf8')
const mallServiceSource = readFileSync(resolve('src/services/mall.ts'), 'utf8')
const authRouteSource = readFileSync(resolve('src/pages/mall/auth-route.ts'), 'utf8')

const authPagePath = 'src/pages/mall/auth/index.tsx'
let authPageSource = ''
try {
  authPageSource = readFileSync(resolve(authPagePath), 'utf8')
} catch {
  throw new Error('Mall app must provide a dedicated login/register page at src/pages/mall/auth/index.tsx')
}

if (!/['"]pages\/mall\/auth\/index['"]/.test(appConfigSource)) {
  throw new Error('Mall auth page must be registered in src/app.config.ts')
}

if (/\/api\/auth\/(?:login|register|captcha|wechat-login)/.test(authPageSource)) {
  throw new Error('Mall auth page must not call the vehicle-side /api/auth APIs')
}

if (!/mallAuthApiBase\s*=\s*['"]\/api\/mall\/auth['"]/.test(authPageSource)) {
  throw new Error('Mall auth page must define the mall auth API base path')
}

if (!/\$\{mallAuthApiBase\}\/login/.test(authPageSource) || !/\$\{mallAuthApiBase\}\/register/.test(authPageSource)) {
  throw new Error('Mall auth page must call the mall login and register APIs')
}

if (!/\$\{mallAuthApiBase\}\/captcha/.test(authPageSource)) {
  throw new Error('Mall registration must use the mall graphical captcha API')
}

if (!/role:\s*registerRole/.test(authPageSource) || !/['"]customer['"]/.test(authPageSource) || !/['"]group_leader['"]/.test(authPageSource)) {
  throw new Error('Mall registration must let users choose customer or group_leader roles')
}

if (/role:\s*['"](owner|merchant|enterprise)['"]/.test(authPageSource)) {
  throw new Error('Mall registration must not create vehicle-side owner/merchant/enterprise users')
}

if (!/Taro\.setStorageSync\(\s*['"]userInfo['"]/.test(authPageSource) || !/Taro\.setStorageSync\(\s*['"]token['"]/.test(authPageSource)) {
  throw new Error('Mall auth page must persist both userInfo and token after login/register')
}

if (
  !/defaultReturnUrl\s*=\s*mallHomeUrl/.test(authPageSource)
  || !/Taro\.redirectTo\(\{\s*url:\s*mallHomeUrl\s*\}\)/.test(authPageSource)
  || !/defaultMallAuthReturnUrl\s*=\s*['"]\/pages\/mall\/index\/index['"]/.test(authRouteSource)
) {
  throw new Error('Mall auth must return to the mall home page by default and when tapping the back button')
}

if (/getMallProfileSafe/.test(profileSource)) {
  throw new Error('Mall profile page must not use getMallProfileSafe fallback data')
}

if (!/getMallProfile/.test(profileSource)) {
  throw new Error('Mall profile page must call getMallProfile for real backend data')
}

if (!/listMallOrders/.test(profileSource)) {
  throw new Error('Mall profile page must call listMallOrders for order-derived metrics')
}

for (const literal of ['张女士', '银卡会员', '3张券', '路北区邻里驿站']) {
  if (profileSource.includes(literal) || mallServiceSource.includes(literal)) {
    throw new Error(`Mall profile must not include demo literal: ${literal}`)
  }
}
