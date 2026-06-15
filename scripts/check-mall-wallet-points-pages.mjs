import fs from 'node:fs'

function read(path) {
  return fs.readFileSync(path, 'utf8')
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

const appConfig = read('src/app.config.ts')
const profile = read('src/pages/mall/profile/index.tsx')
const mallService = read('src/services/mall.ts')
const serverMall = read('server/src/modules/mall.rs')
const userCouponMigration = read('server/migrations/0037_mall_user_coupons.sql')

assert(
  appConfig.includes("'pages/mall/coupons/index'"),
  'mall app config should register the coupon wallet page',
)
assert(
  appConfig.includes("'pages/mall/points/index'"),
  'mall app config should register the points mall page',
)
assert(
  profile.includes("url: '/pages/mall/coupons/index'"),
  'profile coupon entry should navigate to the coupon wallet page',
)
assert(
  profile.includes("url: '/pages/mall/points/index'"),
  'profile points entry should navigate to the points mall page',
)
assert(
  !profile.includes("keyword=优惠券") && !profile.includes("keyword=积分兑换"),
  'profile coupon and points entries should not search the product list',
)
assert(
  fs.existsSync('src/pages/mall/coupons/index.tsx') && fs.existsSync('src/pages/mall/coupons/index.config.ts'),
  'coupon wallet page files should exist',
)
assert(
  fs.existsSync('src/pages/mall/points/index.tsx') && fs.existsSync('src/pages/mall/points/index.config.ts'),
  'points mall page files should exist',
)
assert(
  mallService.includes('listMallCoupons') && mallService.includes('/api/mall/coupons'),
  'mall service should expose the customer coupon wallet API',
)
assert(
  mallService.includes('getMallPointsMall') && mallService.includes('/api/mall/points-mall'),
  'mall service should expose the customer points mall API',
)
assert(
  serverMall.includes('"/api/mall/coupons"') && serverMall.includes('list_customer_coupons'),
  'mall backend should expose the customer coupon wallet endpoint',
)
assert(
  serverMall.includes('"/api/mall/coupons/:id/claim"') && serverMall.includes('claim_customer_coupon'),
  'mall backend should expose the customer coupon claim endpoint',
)
assert(
  serverMall.includes('"/api/mall/points-mall"') && serverMall.includes('get_points_mall'),
  'mall backend should expose the customer points mall endpoint',
)
assert(
  serverMall.includes('mark_best_customer_coupon_used_tx') && serverMall.includes("status = 'used'"),
  'mall backend should mark claimed coupons as used after a coupon-backed order',
)
assert(
  userCouponMigration.includes('CREATE TABLE IF NOT EXISTS mall_user_coupons')
    && userCouponMigration.includes('mall_user_coupons_user_status_idx'),
  'mall migrations should create the user coupon wallet table and user-status index',
)

console.log('mall coupon wallet and points mall page checks passed')
