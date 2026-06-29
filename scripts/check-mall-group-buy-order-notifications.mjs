import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = file => fs.readFileSync(path.join(root, file), 'utf8')

function expect(condition, message) {
  if (!condition) {
    console.error(`Mall group-buy order notification check failed: ${message}`)
    process.exit(1)
  }
}

const mallBackend = read('server/src/modules/mall.rs')
const ordersPage = read('src/pages/mall/orders/index.tsx')
const profilePage = read('src/pages/mall/profile/index.tsx')
const mallService = read('src/services/mall.ts')
const webAdmin = read('src/web-admin/main.tsx')
const packageJson = JSON.parse(read('package.json'))

expect(
  /notify_group_buy_balance_due/.test(mallBackend)
    && /mall_group_buy_balance_due/.test(mallBackend)
    && /集采已成团，待支付尾款/.test(mallBackend),
  'group-buy formation must create user notifications for pending balance.',
)

expect(
  /mall_group_buy_deposit_paid/.test(mallBackend)
    && /mall_group_buy_balance_paid/.test(mallBackend)
    && /mall_group_buy_order_created/.test(mallBackend),
  'group-buy deposit paid, balance paid, and generated-order events must notify users.',
)

expect(
  /listMyMallGroupBuySubscriptions/.test(ordersPage)
    && /MallOrderListItem/.test(ordersPage)
    && /groupBuySubscriptionToOrderItem/.test(ordersPage),
  'mall order center must merge group-buy subscriptions into the order list.',
)

expect(
  /mall-orders-tab-count/.test(ordersPage)
    && /orderTabCounts/.test(ordersPage)
    && /filter\.key !== 'all'/.test(ordersPage),
  'mall order tabs must show counts for pending payment, processing, and after-sale.',
)

expect(
  /payGroupBuyBalance/.test(ordersPage)
    && /businessType:\s*'mall_group_buy_balance'/.test(ordersPage),
  'pending group-buy balance rows must allow balance payment directly from my orders.',
)

expect(
  /listMyMallGroupBuySubscriptions/.test(profilePage)
    && /groupBuyPendingPaymentCount/.test(profilePage)
    && /groupBuyProcessingCount/.test(profilePage),
  'mall profile order counts must include group-buy pending balance and active subscriptions.',
)

expect(
  /listMyMallGroupBuySubscriptions\([\s\S]*userId:\s*string,[\s\S]*options:\s*MallGetOptions/.test(mallService),
  'group-buy subscription list service must support cache options like order APIs.',
)

expect(
  /splitEstimateRatio/.test(webAdmin)
    && /技术估算/.test(webAdmin)
    && /运营估算/.test(webAdmin)
    && /仅用于展示估算/.test(webAdmin),
  'finance bills must show an editable technical/operations split estimate for display only.',
)

expect(
  packageJson.scripts['check:mall-group-buy-order-notifications'] === 'node scripts/check-mall-group-buy-order-notifications.mjs',
  'package script exists.',
)

expect(
  packageJson.scripts.validate.includes('check:mall-group-buy-order-notifications'),
  'validate includes group-buy order notification check.',
)

console.log('Mall group-buy order notification checks passed.')
