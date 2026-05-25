import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const indexPage = resolve('src/pages/index/index.tsx')
const source = readFileSync(indexPage, 'utf8')

const hasAuthUserInfoType = /interface\s+AuthUserInfo\s*\{[\s\S]*?token\??:\s*string[\s\S]*?\}/.test(source)
const hasPersistAuthSession = /const\s+persistAuthSession\s*=\s*\(\s*userInfo:\s*AuthUserInfo\s*\)\s*=>\s*\{[\s\S]*?const\s+token\s*=[\s\S]*?const\s+normalizedUserInfo[\s\S]*?Taro\.setStorageSync\(\s*['"]userInfo['"]\s*,\s*normalizedUserInfo\s*\)[\s\S]*?Taro\.setStorageSync\(\s*['"]token['"]\s*,\s*token\s*\)[\s\S]*?return\s+normalizedUserInfo[\s\S]*?\}/.test(source)
const loginPersistsSession = /url:\s*['"]\/api\/auth\/login['"][\s\S]*?if\s*\(\s*res\.data\.code\s*===\s*200\s*\)\s*\{[\s\S]*?persistAuthSession\s*\(/.test(source)
const registerPersistsSession = /url:\s*['"]\/api\/auth\/register['"][\s\S]*?if\s*\(\s*res\.data\.code\s*===\s*200\s*\)\s*\{[\s\S]*?persistAuthSession\s*\(/.test(source)
const ownerRoutesToHall = /userRole\s*===\s*['"]owner['"][\s\S]*?Taro\.redirectTo\(\s*\{\s*url:\s*['"]\/pages\/owner\/demands\/index['"]\s*\}\s*\)/.test(source)
const merchantRoutesToHall = /userRole\s*===\s*['"]merchant['"][\s\S]*?Taro\.redirectTo\(\s*\{\s*url:\s*['"]\/pages\/merchant\/demands\/index['"]\s*\}\s*\)/.test(source)

if (!hasAuthUserInfoType) {
  throw new Error('Index auth flow must define the authenticated user payload shape with token')
}

if (!hasPersistAuthSession) {
  throw new Error('Index auth flow must persist userInfo and token through a shared helper')
}

if (!loginPersistsSession) {
  throw new Error('Login success must persist the authenticated session')
}

if (!registerPersistsSession) {
  throw new Error('Register success must persist the authenticated session for automatic login')
}

if (!ownerRoutesToHall || !merchantRoutesToHall) {
  throw new Error('Authenticated users must be redirected to their role hall after auth')
}
