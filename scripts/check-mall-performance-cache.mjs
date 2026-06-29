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
const webAdmin = read('src/web-admin/main.tsx')

expect(/MALL_GET_CACHE_TTL_MS/.test(mallService), 'mall service must define a short GET cache TTL')
expect(/mallGetInFlight/.test(mallService), 'mall service must deduplicate in-flight GET requests')
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

expect(/WEB_ADMIN_GET_CACHE_TTL_MS/.test(webAdmin), 'web admin must define a GET cache TTL')
expect(/adminGetInFlight/.test(webAdmin), 'web admin must deduplicate in-flight GET requests')
expect(/invalidateAdminGetCache/.test(webAdmin), 'web admin mutations must invalidate cached GET data')
expect(/apiGet<[\s\S]*options/.test(webAdmin), 'web admin apiGet should support cache/fresh options')
expect(/productFilterDebounceRef\.current\s*=\s*window\.setTimeout/.test(webAdmin), 'web admin product filters should debounce list refreshes')

console.log('mall performance cache checks passed')
