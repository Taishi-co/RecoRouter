import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const appConfigSource = readFileSync(resolve('src/app.config.ts'), 'utf8')
const profileSource = readFileSync(resolve('src/pages/mall/profile/index.tsx'), 'utf8')
const mallServiceSource = readFileSync(resolve('src/services/mall.ts'), 'utf8')

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

if (!/\/api\/auth\/login/.test(authPageSource) || !/\/api\/auth\/register/.test(authPageSource)) {
  throw new Error('Mall auth page must call the existing backend login and register APIs')
}

if (!/\/api\/auth\/captcha/.test(authPageSource)) {
  throw new Error('Mall registration must use the existing graphical captcha API')
}

if (!/role:\s*['"]customer['"]/.test(authPageSource)) {
  throw new Error('Mall registration must create customer users, not vehicle-side owner/merchant users')
}

if (!/Taro\.setStorageSync\(\s*['"]userInfo['"]/.test(authPageSource) || !/Taro\.setStorageSync\(\s*['"]token['"]/.test(authPageSource)) {
  throw new Error('Mall auth page must persist both userInfo and token after login/register')
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
