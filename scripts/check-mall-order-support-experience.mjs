import fs from 'node:fs'

function read(path) {
  return fs.readFileSync(path, 'utf8')
}

function expect(condition, message) {
  if (!condition) {
    console.error(`Mall order support experience check failed: ${message}`)
    process.exit(1)
  }
}

const orderDetail = read('src/pages/mall/order-detail/index.tsx')
const afterSale = read('src/pages/mall/after-sale/index.tsx')
const support = read('src/pages/mall/support/index.tsx')
const paymentSuccess = read('src/pages/mall/payment-success/index.tsx')
const service = read('src/services/mall.ts')
const backend = read('server/src/modules/mall.rs')
const theme = read('src/pages/mall/mall-theme.css')

expect(
  !/const phone\s*=\s*order\.recipientPhone/.test(orderDetail)
    && !/order\?\.recipientPhone/.test(support),
  '配送客服手机号不能读取收货人 recipientPhone。',
)

expect(
  /supportPhone\??:\s*string/.test(service)
    && /supportPhone/.test(backend)
    && /supportPhone/.test(orderDetail)
    && /supportPhone/.test(support),
  '订单和客服页需要使用运营配置的 supportPhone。',
)

expect(
  !/配送员/.test(paymentSuccess) && !/mall-avatar-row/.test(paymentSuccess),
  '支付成功页不应展示不明所以的配送员/我头像链路。',
)

expect(
  /mall-order-status-hero/.test(orderDetail)
    && /mall-order-products-card/.test(orderDetail)
    && /mall-order-fee-card/.test(orderDetail)
    && /mall-order-action-bar/.test(orderDetail),
  '订单详情需要有电商订单页结构：状态、商品、费用、底部操作。',
)

expect(
  /mall-after-sale-method-list/.test(afterSale)
    && /mall-after-sale-flow/.test(afterSale)
    && /退款金额/.test(afterSale)
    && /问题描述/.test(afterSale),
  '售后页需要按成熟电商结构展示类型、商品、金额、说明和流程。',
)

expect(
  /mall-support-keyboard/.test(support)
    && /mall-support-quick-replies/.test(support)
    && /mall-support-order-card/.test(support)
    && /发送/.test(support),
  '客服聊天页需要有订单上下文、快捷问题和底部输入栏。',
)

expect(
  /mall-order-status-hero/.test(theme)
    && /mall-after-sale-method-list/.test(theme)
    && /mall-support-keyboard/.test(theme),
  '订单、售后、客服的新结构需要有对应样式。',
)

console.log('Mall order support experience checks passed.')
