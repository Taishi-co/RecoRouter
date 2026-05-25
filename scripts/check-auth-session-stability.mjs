import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const indexSource = readFileSync(resolve('src/pages/index/index.tsx'), 'utf8')
const roleSwitchSource = readFileSync(resolve('src/pages/role-switch/index.tsx'), 'utf8')

const restoresStoredAuthUser = /const\s+getStoredAuthUser\s*=\s*\(\s*\)\s*:\s*AuthUserInfo\s*\|\s*null\s*=>\s*\{[\s\S]*?Taro\.getStorageSync\(\s*['"]userInfo['"]\s*\)[\s\S]*?Taro\.getStorageSync\(\s*['"]token['"]\s*\)/.test(indexSource)
const indexTracksCurrentUser = /const\s+\[\s*currentUser\s*,\s*setCurrentUser\s*\]\s*=\s*useState\s*<\s*AuthUserInfo\s*\|\s*null\s*>\s*\(\s*null\s*\)/.test(indexSource)
const indexLoadsStoredUser = /useEffect\s*\(\s*\(\s*\)\s*=>\s*\{[\s\S]*?setCurrentUser\s*\(\s*getStoredAuthUser\s*\(\s*\)\s*\)[\s\S]*?loadStatistics\s*\(\s*\)[\s\S]*?loadLatestInfo\s*\(\s*\)/.test(indexSource)
const indexShowsEnterHall = /currentUser\s*\?[\s\S]*?onClick=\{\s*\(\s*\)\s*=>\s*switchTabByRole\s*\(\s*currentUser\.role\s*\)\s*\}[\s\S]*?进入大厅/.test(indexSource)
const authPersistNormalizesToken = /const\s+persistAuthSession\s*=\s*\(\s*userInfo:\s*AuthUserInfo\s*\)\s*=>\s*\{[\s\S]*?const\s+token\s*=[\s\S]*?userInfo\.token[\s\S]*?Taro\.getStorageSync\(\s*['"]token['"]\s*\)[\s\S]*?userInfo\.id[\s\S]*?Taro\.setStorageSync\(\s*['"]userInfo['"]\s*,\s*normalizedUserInfo\s*\)[\s\S]*?Taro\.setStorageSync\(\s*['"]token['"]\s*,\s*token\s*\)[\s\S]*?return\s+normalizedUserInfo/.test(indexSource)

const roleSwitchPreservesToken = /const\s+persistSwitchedUserInfo\s*=\s*\([\s\S]*?\)\s*=>\s*\{[\s\S]*?Taro\.getStorageSync\(\s*['"]token['"]\s*\)[\s\S]*?token:[\s\S]*?Taro\.setStorageSync\(\s*['"]userInfo['"]\s*,\s*normalizedUserInfo\s*\)[\s\S]*?Taro\.setStorageSync\(\s*['"]token['"]\s*,\s*token\s*\)[\s\S]*?return\s+normalizedUserInfo/.test(roleSwitchSource)
const roleSwitchUsesHelper = /const\s+updatedUserInfo\s*=\s*persistSwitchedUserInfo\s*\(\s*res\.data\.data\s*,\s*currentUser\s*\)/.test(roleSwitchSource)

if (!restoresStoredAuthUser || !authPersistNormalizesToken) {
  throw new Error('Index auth flow must normalize and restore persisted auth sessions')
}

if (!indexTracksCurrentUser || !indexLoadsStoredUser || !indexShowsEnterHall) {
  throw new Error('Index page must show an authenticated enter-hall action from persisted login state')
}

if (!roleSwitchPreservesToken || !roleSwitchUsesHelper) {
  throw new Error('Role switching must preserve token when replacing userInfo in storage')
}
