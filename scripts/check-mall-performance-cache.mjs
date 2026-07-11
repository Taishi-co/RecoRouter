import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const expect = (condition, message) => {
  if (!condition) {
    throw new Error(message)
  }
}

const mallService = read('src/services/mall.ts')
const cartPage = read('src/pages/mall/cart/index.tsx')
const homePage = read('src/pages/mall/index/index.tsx')
const categoryPage = read('src/pages/mall/category/index.tsx')
const ordersPage = read('src/pages/mall/orders/index.tsx')
const supportPage = read('src/pages/mall/support/index.tsx')
const webAdmin = read('src/web-admin/main.tsx')
const mallBackend = read('server/src/modules/mall.rs')
const supportIndexes = read('server/migrations/0047_support_polling_indexes.sql')

expect(/MALL_GET_CACHE_TTL_MS/.test(mallService), 'mall service must define a short GET cache TTL')
expect(/mallGetInFlight/.test(mallService), 'mall service must deduplicate in-flight GET requests')
expect(/MALL_GET_CACHE_MAX_ENTRIES/.test(mallService), 'mall service must bound GET cache growth')
expect(/mallGetCacheEpoch/.test(mallService), 'mall service must prevent pre-mutation GETs from repopulating stale cache')
expect(/mallGetInFlight\.get\(cacheKey\) === request/.test(mallService), 'mall service must not let an old request clear a newer in-flight request')
expect(/cachedApiGet/.test(mallService), 'mall service must route cacheable GET calls through cachedApiGet')
expect(/clearMallGetCache/.test(mallService), 'mall service must expose cache invalidation for mutations')
expect(/apiPost[\s\S]*clearMallGetCache/.test(mallService), 'mall POST mutations must invalidate stale GET cache')
expect(/apiPut[\s\S]*clearMallGetCache/.test(mallService), 'mall PUT mutations must invalidate stale GET cache')
expect(/apiDelete[\s\S]*clearMallGetCache/.test(mallService), 'mall DELETE mutations must invalidate stale GET cache')

for (const fn of [
  'listMallCategories',
  'listMallProducts',
  'listMallHomeBanners',
  'listMallHomeSections',
  'listMallPromotionVenues',
  'getMallProduct',
  'listMallAddresses',
  'listMallOrders',
]) {
  const start = mallService.indexOf(`export async function ${fn}`)
  const nextExport = mallService.indexOf('\nexport async function ', start + 1)
  const block = start >= 0 ? mallService.slice(start, nextExport > start ? nextExport : undefined) : ''
  expect(/cachedApiGet/.test(block), `${fn} should use cachedApiGet for smoother navigation`)
}

expect(/loadProducts\(\{\s*preferCache:\s*true/.test(homePage), 'mall home should render from cache first before silent refresh')
expect(/loadProducts\(\{[\s\S]*preferCache:\s*true/.test(categoryPage), 'mall category should reuse cached product pages while switching tabs')
expect(/revalidate:\s*true/.test(categoryPage), 'mall category should revalidate product pages after cached render')
expect(/loadOrders\(\{\s*preferCache:\s*true/.test(ordersPage), 'mall orders should render cached order list before refreshing')

expect(/loadData\(\{\s*refreshAddresses:\s*false/.test(cartPage), 'cart item mutations should refresh cart only, not addresses')
expect(/loadAddresses/.test(cartPage), 'cart page should load addresses separately for reuse')
expect(/title:\s*'确认清空购物车吗'/.test(cartPage), 'cart clear action should require explicit confirmation')
expect(/bulkAction/.test(cartPage), 'cart bulk actions should prevent duplicate taps')
expect(/useDidHide/.test(homePage), 'mall home timers should pause while the page is hidden')
expect(/hasActiveCountdown/.test(ordersPage), 'orders should only run a one-second timer when a payment countdown is visible')

expect(/WEB_ADMIN_GET_CACHE_TTL_MS/.test(webAdmin), 'web admin must define a GET cache TTL')
expect(/WEB_ADMIN_GET_CACHE_MAX_ENTRIES/.test(webAdmin), 'web admin must bound GET cache growth')
expect(/adminGetInFlight/.test(webAdmin), 'web admin must deduplicate in-flight GET requests')
expect(/invalidateAdminGetCache/.test(webAdmin), 'web admin mutations must invalidate cached GET data')
expect(/adminGetCacheEpoch/.test(webAdmin), 'web admin must prevent pre-mutation GETs from repopulating stale cache')
expect(/getStoredAdminSession\(\)\?\.user\.id \|\| 'anonymous'/.test(webAdmin), 'web admin cache keys must be isolated by admin session')
expect(/pathname\.startsWith\('\/api\/auth\/'\)/.test(webAdmin), 'web admin captcha and auth reads must bypass cache')
expect(/adminGetInFlight\.get\(cacheKey\) === request/.test(webAdmin), 'web admin must not let an old request clear a newer in-flight request')
expect(/apiGet<[\s\S]*options/.test(webAdmin), 'web admin apiGet should support cache/fresh options')
expect(/productFilterDebounceRef\.current\s*=\s*window\.setTimeout/.test(webAdmin), 'web admin product filters should debounce list refreshes')
expect(/fetchDashboardPageData/.test(webAdmin), 'web admin should load data for the active page instead of every module')
expect(/fetchDashboardData\([\s\S]*pageKey/.test(webAdmin), 'web admin reloads should pass the active page scope')
expect(/setData\(current\s*=>\s*\(\{\s*\.\.\.current,\s*\.\.\.result\.data/.test(webAdmin), 'page reloads should preserve already loaded page data')
expect(/loadedPageKeysRef/.test(webAdmin), 'web admin should avoid blanking an already loaded page during refresh')
expect(/Object\.fromEntries\(adminModules\.flatMap/.test(webAdmin), 'web admin should collapse unrelated navigation groups on first load')
expect(/nextPage\.group.*false/.test(webAdmin), 'web admin should reveal the active navigation group on route changes')
expect(/updatedAfter:\s*supportSessionVersionRef\.current/.test(webAdmin), 'support polling should request only sessions changed since the last refresh')
expect(/now\s*-\s*supportMetricsRefreshRef\.current\s*>=\s*30_000/.test(webAdmin), 'support metrics should refresh less often than the live queue')
expect(/updated_after:\s*Option<DateTime<Utc>>/.test(mallBackend), 'support session API should accept an incremental updated-after cursor')
expect(/session\.updated_at >/.test(mallBackend), 'support session API should filter incremental refreshes by updated_at')
expect(/support_sessions_updated_idx/.test(supportIndexes), 'support polling should have an updated_at index')
expect(/support_messages_session_role_created_idx/.test(supportIndexes), 'support latest-message lookups should have a session/role/time index')
expect(/useDidHide/.test(supportPage), 'miniapp support polling should pause when the page is hidden')
expect(/updatedAfter:\s*sessionVersionRef\.current/.test(supportPage), 'miniapp support polling should request only changed sessions')
expect(/if \(refreshedSession\)[\s\S]*await loadMessages\(refreshedSession\)/.test(supportPage), 'miniapp support should reload messages only when the active session changed')

console.log('mall performance cache checks passed')
