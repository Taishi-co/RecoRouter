import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const payments = readFileSync('server/src/modules/payments.rs', 'utf8');
const mall = readFileSync('server/src/modules/mall.rs', 'utf8');
const migration = readFileSync(
  'server/migrations/0048_wechat_platform_profit_sharing.sql',
  'utf8',
);

assert.match(payments, /\/v3\/pay\/partner\/transactions\/jsapi/);
assert.match(payments, /"settle_info": \{ "profit_sharing": true \}/);
assert.match(payments, /\/v3\/ecommerce\/profitsharing\/orders/);
assert.match(payments, /query_profit_sharing_order/);
assert.match(payments, /"finish": true/);
assert.match(payments, /"receiver_account": config\.merchant\.mch_id/);
assert.match(payments, /verify_wechat_notify_if_configured/);
assert.match(payments, /Wechatpay-Signature/);
assert.match(mall, /\/v3\/ecommerce\/refunds\/apply/);
assert.match(mall, /\/v3\/ecommerce\/profitsharing\/returnorders/);
assert.match(mall, /不同商家的商品暂不支持合并支付，请分开结算/);
assert.match(mall, /合作商家货款由微信支付直接结算，禁止通过平台提现/);
assert.match(migration, /CREATE TABLE IF NOT EXISTS mall_merchants/);
assert.match(migration, /service_fee_rate_bps BETWEEN 1 AND 3000/);
assert.match(migration, /CREATE TABLE IF NOT EXISTS platform_profit_sharing_orders/);
assert.match(migration, /merchant_receivable_cents > 0/);

console.log('wechat platform profit sharing checks passed');
