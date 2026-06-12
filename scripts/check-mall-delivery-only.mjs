#!/usr/bin/env node
import { readFileSync } from 'node:fs'

const files = {
  address: read('src/pages/mall/address/index.tsx'),
  cart: read('src/pages/mall/cart/index.tsx'),
  confirm: read('src/pages/mall/confirm/index.tsx'),
  home: read('src/pages/mall/index/index.tsx'),
  orders: read('src/pages/mall/orders/index.tsx'),
  orderDetail: read('src/pages/mall/order-detail/index.tsx'),
  paymentSuccess: read('src/pages/mall/payment-success/index.tsx'),
  profile: read('src/pages/mall/profile/index.tsx'),
  settings: read('src/pages/mall/settings/index.tsx'),
  auth: read('src/pages/mall/auth/index.tsx'),
  product: read('src/pages/mall/product/index.tsx'),
  ui: read('src/pages/mall/mall-ui.tsx'),
}

const checks = [
  {
    name: 'address page manages delivery addresses instead of pickup points',
    pass: !/listMallPickupPoints|MallPickupPoint|pickupPoints|addPickupPoint|自提点列表|新增常用自提点/.test(files.address)
      && /收货地址/.test(files.address)
      && /createMallAddress/.test(files.address)
      && /addressType:\s*'delivery'/.test(files.address),
  },
  {
    name: 'cart and confirm submit delivery-only checkout/order payloads',
    pass: !/pickupPointId:\s*checkout\.pickupPointId|pickupPointId:\s*selectedAddress|deliveryMethod:\s*'社区自提'|pickupMethod:\s*'团长验码'|自提服务费/.test(files.confirm)
      && !/自提点|收货地址 \/ 自提点/.test(files.cart)
      && /deliveryMethod:\s*'送货到家'/.test(files.confirm)
      && /配送费/.test(files.confirm),
  },
  {
    name: 'home page no longer exposes pickup switching',
    pass: !/mall-v7-pickup-strip|默认自提点|中庭自提点|切换/.test(files.home)
      && !/自提点订单|团长招募/.test(files.home),
  },
  {
    name: 'order and payment pages use delivery copy instead of pickup code flow',
    pass: !/自提码|取货码|待自提|团长|自提点信息|联系团长|社区团购自提/.test([
      files.orders,
      files.orderDetail,
      files.paymentSuccess,
    ].join('\n'))
      && /配送信息/.test(files.orderDetail)
      && /配送状态/.test(files.paymentSuccess),
  },
  {
    name: 'profile/settings/product/auth copy is delivery-only for customer flow',
    pass: !/自提点|自提码|团长权益|团长申请入口|申请成为团长|进入团长后台|团长验货|到自提点|自提通知|自提/.test([
      files.profile,
      files.settings,
      files.auth,
      files.product,
      files.ui,
    ].join('\n'))
      && /送货地址/.test(files.profile)
      && /配送通知/.test(files.settings),
  },
]

const failures = checks.filter(check => !check.pass)
if (failures.length) {
  console.error('Mall delivery-only checks failed:')
  for (const failure of failures) {
    console.error(`- ${failure.name}`)
  }
  process.exit(1)
}

console.log(`Mall delivery-only checks passed (${checks.length} checks).`)

function read(path) {
  return readFileSync(path, 'utf8')
}
