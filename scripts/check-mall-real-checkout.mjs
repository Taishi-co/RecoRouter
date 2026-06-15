#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

const files = {
  product: read('src/pages/mall/product/index.tsx'),
  cart: read('src/pages/mall/cart/index.tsx'),
  confirm: read('src/pages/mall/confirm/index.tsx'),
  paymentSuccess: read('src/pages/mall/payment-success/index.tsx'),
  orderDetail: read('src/pages/mall/order-detail/index.tsx'),
  address: read('src/pages/mall/address/index.tsx'),
  auth: read('src/pages/mall/auth/index.tsx'),
  groupLeader: read('src/pages/mall/group-leader/index.tsx'),
  service: read('src/services/mall.ts'),
  serverMall: read('server/src/modules/mall.rs'),
  serverAuth: read('server/src/modules/auth.rs'),
  app: read('server/src/app.rs'),
};

const mallRoutesBlock = files.app.match(/fn mall_routes[\s\S]*?\nfn platform_routes/)?.[0] || '';
const platformRoutesBlock = files.app.match(/fn platform_routes[\s\S]*$/)?.[0] || '';

const checks = [
  {
    name: '商品详情使用小程序分享卡片 contract',
    pass: /useShareAppMessage/.test(files.product)
      && /title:\s*product\?\.name/.test(files.product)
      && /path:.*pages\/mall\/product\/index\?id=/.test(files.product),
  },
  {
    name: '立即选购直接创建 checkout，不复用购物车跳转',
    pass: /createMallCheckout/.test(files.product)
      && /\/pages\/mall\/confirm\/index\?checkoutId=/.test(files.product)
      && !/handleAddCart\(true\)/.test(files.product),
  },
  {
    name: '确认订单通过 checkout summary 使用后端优惠计算',
    pass: /getMallCheckout/.test(files.confirm)
      && /checkout\?\.couponCents/.test(files.confirm)
      && !/cart\.subtotalCents\s*>\s*0\s*\?\s*Math\.min\(600/.test(files.confirm),
  },
  {
    name: '购物车页不在前端硬算满减',
    pass: /cart\.couponCents/.test(files.cart)
      && !/cart\.subtotalCents\s*>\s*0\s*\?\s*Math\.min\(600/.test(files.cart),
  },
  {
    name: '支付失败不能跳转到本地成功页',
    pass: !/payment-success\/index\?orderId=local-order/.test(files.confirm)
      && !/fallbackOrder/.test(files.paymentSuccess),
  },
  {
    name: '支付成功页必须读取真实订单和团购状态',
    pass: /getMallOrder/.test(files.paymentSuccess)
      && /groupStatusText/.test(files.paymentSuccess)
      && !/4 人团已完成/.test(files.paymentSuccess)
      && !/A739/.test(files.paymentSuccess),
  },
  {
    name: '订单详情页不允许本地假订单 fallback',
    pass: /getMallOrder/.test(files.orderDetail)
      && !/fallbackOrder/.test(files.orderDetail)
      && !/王团长 138\*\*\*\*6732/.test(files.orderDetail),
  },
  {
    name: '地址页真实写入送货地址，不再接自提点列表',
    pass: !/listMallPickupPoints|MallPickupPoint|pickupPoints|addPickupPoint/.test(files.address)
      && /createMallAddress/.test(files.address)
      && /addressType:\s*'delivery'/.test(files.address)
      && !/fallbackAddresses/.test(files.address),
  },
  {
    name: '旧团长中心在用户端隐藏为我的页面兼容跳转',
    pass: /Taro\.redirectTo\(\{\s*url:\s*'\/pages\/mall\/profile\/index'\s*\}\)/.test(files.groupLeader)
      && /当前商城订单仅支持送货到家/.test(files.groupLeader)
      && !/getMallGroupLeaderCenter|verifyMallGroupLeaderFulfillment|getMallGroupLeaderCenterSafe|fallbackReminders|取货码|自提/.test(files.groupLeader),
  },
  {
    name: '注册支持用户和团长角色',
    pass: /role:\s*registerRole/.test(files.auth)
      && /group_leader/.test(files.auth)
      && /"customer"\s*\|\s*"group_leader"/.test(files.serverAuth),
  },
  {
    name: '后端创建订单计算商城优惠，不信任前端 couponCents',
    pass: /calculate_mall_discount_cents/.test(files.serverMall)
      && !/let coupon_cents = body\s*\n\s*\.coupon_cents/.test(files.serverMall),
  },
  {
    name: '公共 platform 服务暴露支付路由',
    pass: /\.merge\(payments::router::<S>\(\)\)/.test(platformRoutesBlock)
      && !/\.merge\(payments::router::<S>\(\)\)/.test(mallRoutesBlock),
  },
  {
    name: '服务层 exposes checkout API 和真实优惠字段',
    pass: /interface MallCheckout/.test(files.service)
      && /createMallCheckout/.test(files.service)
      && /getMallCheckout/.test(files.service)
      && /couponCents/.test(files.service)
      && /discountDescription/.test(files.service),
  },
];

const failures = checks.filter(check => !check.pass);

if (failures.length) {
  console.error('Mall real checkout checks failed:');
  for (const failure of failures) {
    console.error(`- ${failure.name}`);
  }
  process.exit(1);
}

console.log(`Mall real checkout checks passed (${checks.length} checks).`);

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}
