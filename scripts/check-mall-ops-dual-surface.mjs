import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')

function read(pathname) {
  return readFileSync(resolve(root, pathname), 'utf8')
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function assertIncludes(source, needle, message) {
  assert(source.includes(needle), message)
}

const miniappAdmin = read('src/pages/admin/mall/index.tsx')
const mallService = read('src/services/mall.ts')
const webAdmin = read('src/web-admin/main.tsx')
const mallModule = read('server/src/modules/mall.rs')
const packageJson = JSON.parse(read('package.json'))
const migrations = readdirSync(resolve(root, 'server/migrations'))
  .filter((name) => name.endsWith('.sql'))
  .sort()
  .map((name) => read(`server/migrations/${name}`))
  .join('\n')

for (const forbidden of ['#0062FF', 'bg-blue-50', 'text-blue-600']) {
  assert(!miniappAdmin.includes(forbidden), `Miniapp mall ops page must not use blue admin token ${forbidden}`)
}

for (const label of [
  '商品管理',
  '库存管理',
  '上下架申请',
  '今日订单',
  '历史订单',
  '异常订单',
  '配送单',
  '配送状态',
  '自提点',
  '账单明细',
  '结算记录',
  '提现申请',
  '销量统计',
  '收益统计',
  '热销商品',
]) {
  assertIncludes(miniappAdmin, label, `Miniapp mall ops page must expose ${label}`)
  assertIncludes(webAdmin, label, `Web admin mall business must expose ${label}`)
}

for (const fnName of [
  'adminGetMallOpsOverview',
  'adminListMallProductListingRequests',
  'adminCreateMallProductListingRequest',
  'adminReviewMallProductListingRequest',
  'adminListMallDeliverySheets',
  'adminGenerateMallDeliverySheet',
  'adminUpdateMallDeliverySheetStatus',
  'adminListMallFinanceBills',
  'adminListMallSettlementRecords',
  'adminCreateMallWithdrawal',
  'adminGetMallSalesStats',
]) {
  assertIncludes(mallService, `function ${fnName}`, `Mall service must export ${fnName}`)
  assertIncludes(miniappAdmin, fnName, `Miniapp mall ops page must call ${fnName}`)
}

for (const endpoint of [
  '/api/admin/mall/ops/overview',
  '/api/admin/mall/listing-requests',
  '/api/admin/mall/listing-requests/:id/review',
  '/api/admin/mall/delivery-sheets',
  '/api/admin/mall/delivery-sheets/generate',
  '/api/admin/mall/delivery-sheets/:id/status',
  '/api/admin/mall/finance/bills',
  '/api/admin/mall/finance/settlements',
  '/api/admin/mall/finance/withdrawals',
  '/api/admin/mall/stats/sales',
]) {
  assertIncludes(mallModule, endpoint, `Mall admin router must expose ${endpoint}`)
}

for (const table of [
  'mall_product_listing_requests',
  'mall_delivery_sheets',
  'mall_settlement_records',
  'mall_withdrawal_requests',
]) {
  assertIncludes(migrations, table, `Mall ops migrations must create ${table}`)
}

assertIncludes(migrations, 'supply_price_cents', 'Mall product schema must store supply cost')
assertIncludes(mallModule, 'supply_price_cents', 'Mall admin product backend must persist supply cost')
assertIncludes(mallService, 'supplyPriceCents', 'Mall product service type must expose supply cost')
assertIncludes(webAdmin, '/api/admin/mall/delivery-sheets/generate', 'Web admin must generate delivery sheets through backend')
assertIncludes(webAdmin, '/api/admin/mall/finance/withdrawals', 'Web admin must submit withdrawal requests through backend')
assertIncludes(webAdmin, '/api/admin/mall/stats/sales', 'Web admin must load real mall sales stats')

assert(
  packageJson.scripts['check:mall-ops-dual-surface'] === 'node scripts/check-mall-ops-dual-surface.mjs',
  'package.json must expose check:mall-ops-dual-surface',
)
assert(
  packageJson.scripts.validate.includes('check:mall-ops-dual-surface'),
  'pnpm validate must include check:mall-ops-dual-surface',
)

console.log('mall ops dual-surface contract ok')
