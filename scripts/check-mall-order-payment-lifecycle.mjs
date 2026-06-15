import fs from 'node:fs'

const files = {
  mallBackend: 'server/src/modules/mall.rs',
  paymentsBackend: 'server/src/modules/payments.rs',
  migration: 'server/migrations/0038_mall_order_payment_lifecycle.sql',
  ordersPage: 'src/pages/mall/orders/index.tsx',
  confirmPage: 'src/pages/mall/confirm/index.tsx',
  mallService: 'src/services/mall.ts',
  theme: 'src/pages/mall/mall-theme.css',
}

const sources = Object.fromEntries(
  Object.entries(files).map(([key, file]) => [key, fs.readFileSync(file, 'utf8')]),
)

const checks = [
  [sources.paymentsBackend, 'WechatPayConfig::from_env_for_business(state.service, business_type)', '商城支付必须按业务类型选择微信配置'],
  [sources.paymentsBackend, 'PaymentBusinessType::MallOrder => crate::config::ApiService::Mall', '商城订单支付必须使用商城小程序 appid/secret'],
  [sources.mallBackend, 'checkout_id', '商城订单必须记录 checkout_id 以支持幂等'],
  [sources.mallBackend, 'pg_advisory_xact_lock(hashtext($1))', '同一 checkout 创建订单必须串行化'],
  [sources.mallBackend, 'expire_unpaid_mall_orders', '未支付订单必须支持自动过期'],
  [sources.mallBackend, '/api/mall/orders/:id/cancel', '用户端必须有取消待支付订单接口'],
  [sources.mallBackend, 'restore_mall_order_inventory_tx', '取消待支付订单必须回补库存'],
  [sources.mallBackend, 'release_mall_order_promotions_tx', '取消待支付订单必须释放优惠券和积分'],
  [sources.migration, 'mall_orders_checkout_id_uidx', '迁移必须给 checkout_id 建唯一索引'],
  [sources.migration, 'paymentExpiresAt', '订单 JSON 必须返回支付过期时间'],
  [sources.confirmPage, 'if (submitting) return', '确认订单支付按钮必须防重复点击'],
  [sources.mallService, 'cancelMallOrder', '前端服务必须暴露取消订单接口'],
  [sources.mallService, 'paymentExpiresAt?: string | null', '前端订单类型必须包含支付过期时间'],
  [sources.ordersPage, 'mall-orders-card', '订单中心必须使用订单卡片'],
  [sources.ordersPage, '立刻支付', '待支付订单必须有立刻支付入口'],
  [sources.ordersPage, '取消订单', '待支付订单必须有取消订单入口'],
  [sources.ordersPage, '联系客服', '订单卡片必须有联系客服入口'],
  [sources.ordersPage, 'paymentCountdownText', '待支付订单必须展示倒计时'],
  [sources.ordersPage, '<Image', '订单卡片必须展示商品图片'],
  [sources.theme, '.mall-orders-card', '订单中心卡片样式必须存在'],
  [sources.theme, '.mall-orders-actions', '订单中心操作按钮样式必须存在'],
]

const failed = checks.filter(([source, needle]) => !source.includes(needle))

if (failed.length > 0) {
  console.error('mall order payment lifecycle checks failed:')
  for (const [, needle, message] of failed) {
    console.error(`- ${message}: missing ${needle}`)
  }
  process.exit(1)
}

console.log(`mall order payment lifecycle checks passed (${checks.length} checks)`)
