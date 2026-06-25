import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
const assert = (condition, message) => {
  if (!condition) {
    console.error(`FAIL ${message}`)
    process.exitCode = 1
  } else {
    console.log(`PASS ${message}`)
  }
}

const migration = read('server/migrations/0039_mall_group_buy_presale.sql')
const mall = read('server/src/modules/mall.rs')
const payments = read('server/src/modules/payments.rs')
const mallService = read('src/services/mall.ts')
const paymentService = read('src/services/payment.ts')
const appConfig = read('src/app.config.ts')
const admin = read('src/web-admin/main.tsx')
const packageJson = JSON.parse(read('package.json'))

for (const table of [
  'mall_group_buy_activities',
  'mall_group_buy_subscriptions',
  'mall_group_buy_events',
  'mall_credit_ledger',
]) {
  assert(migration.includes(`CREATE TABLE IF NOT EXISTS ${table}`), `${table} table exists`)
}

for (const businessType of ['mall_group_buy_deposit', 'mall_group_buy_balance']) {
  assert(migration.includes(businessType), `${businessType} migration reference exists`)
  assert(payments.includes(businessType), `${businessType} backend payment type exists`)
  assert(paymentService.includes(businessType), `${businessType} frontend payment type exists`)
}

for (const route of [
  '/api/mall/group-buys',
  '/api/mall/group-buy-subscriptions/:id/pay-deposit',
  '/api/mall/group-buy-subscriptions/:id/pay-balance',
  '/api/admin/mall/group-buys',
  '/api/admin/mall/group-buys/:id/confirm-procurement',
]) {
  assert(mall.includes(route), `${route} route is wired`)
}

for (const page of [
  'pages/mall/group-buy/index',
  'pages/mall/group-buy/detail',
  'pages/mall/group-buy/my',
]) {
  assert(appConfig.includes(page), `${page} is registered`)
}

for (const apiName of [
  'listMallGroupBuys',
  'getMallGroupBuy',
  'subscribeMallGroupBuy',
  'payMallGroupBuyDeposit',
  'payMallGroupBuyBalance',
  'listMyMallGroupBuySubscriptions',
]) {
  assert(mallService.includes(`function ${apiName}`) || mallService.includes(`const ${apiName}`), `${apiName} service exists`)
}

assert(admin.includes('mall.groupBuyPresale'), 'web admin group-buy page key exists')
assert(packageJson.scripts['check:mall-group-buy-presale'] === 'node scripts/check-mall-group-buy-presale.mjs', 'package script exists')
assert(packageJson.scripts.validate.includes('check:mall-group-buy-presale'), 'validate includes group-buy check')

if (process.exitCode) process.exit(process.exitCode)
