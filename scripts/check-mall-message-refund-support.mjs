import fs from 'node:fs'

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
}

function expect(condition, message) {
  if (!condition) {
    console.error(`Mall message/refund/support check failed: ${message}`)
    process.exit(1)
  }
}

const mallBackend = read('server/src/modules/mall.rs')
const cartPage = read('src/pages/mall/cart/index.tsx')
const afterSalePage = read('src/pages/mall/after-sale/index.tsx')
const supportPage = read('src/pages/mall/support/index.tsx')
const profilePage = read('src/pages/mall/profile/index.tsx')
const mallUi = read('src/pages/mall/mall-ui.tsx')
const appConfig = read('src/app.config.ts')
const notificationsPage = read('src/pages/notifications/index.tsx')
const webAdmin = read('src/web-admin/main.tsx')
const service = read('src/services/mall.ts')

expect(
  /savedCents:\s*Math\.max\(\s*savedCents\s*,\s*0\s*\)/.test(cartPage)
    && !/savedCents:\s*Math\.max\(\s*savedCents\s*\+\s*freeDeliveryDiscountCents/.test(cartPage),
  '购物车已省不能把免运折扣在前端二次叠加。',
)

expect(
  /all_items_delivery_campaign_eligible/.test(mallBackend)
    && /context\.all_items_delivery_campaign_eligible/.test(mallBackend),
  '后端免运活动需要判断选中商品是否全部命中配送活动，混选非免运商品时免运失效。',
)

expect(
  /Taro\.previewImage/.test(afterSalePage)
    && /removeEvidenceImage/.test(afterSalePage)
    && /mall-evidence-delete/.test(afterSalePage),
  '售后凭证图片需要支持预览和删除。',
)

expect(
  /latestAfterSale/.test(afterSalePage)
    && /提交后不可修改/.test(afterSalePage)
    && /return_refund/.test(afterSalePage)
    && /refund_only/.test(afterSalePage),
  '售后申请提交后页面要进入只读状态，并保留三类售后入口。',
)

expect(
  /ensure_no_active_after_sale_for_items/.test(mallBackend)
    && /normalize_after_sale_selected_items[\s\S]*mall_order_items/.test(mallBackend),
  '服务端创建售后前要按订单商品校验并阻止同一商品重复发起未完结售后。',
)

expect(
  /admin_refund_order[\s\S]*refund_required_or_existing_after_sale/.test(mallBackend)
    || /admin_refund_order[\s\S]*existing_after_sale/.test(mallBackend),
  '管理端退款不能重复插入售后，必须复用或拒绝已有退款中的记录。',
)

expect(
  /create_mall_platform_refund_order/.test(mallBackend)
    && /\/v3\/refund\/domestic\/refunds/.test(mallBackend)
    && /platform_refund_orders[\s\S]*idempotency_key/.test(mallBackend),
  '商城退款需要创建幂等平台退款单并调用微信原路退款接口。',
)

expect(
  /setInterval\(/.test(supportPage)
    && /loadMessages/.test(supportPage)
    && /INITIAL_SUPPORT_MESSAGE/.test(supportPage)
    && /autoSendInitialMessage/.test(supportPage),
  '客服聊天需要轮询刷新，并且首条售后协助消息只在首次建会话时自动发出。',
)

expect(
  /setInterval\(\(\)\s*=>\s*\{[\s\S]*pollSessionUpdates\(selectedSession\)[\s\S]*\},\s*4000\)/.test(supportPage)
    && /updatedAfter:\s*sessionVersionRef\.current/.test(supportPage)
    && /await loadMessages\(refreshedSession\)/.test(supportPage),
  '小程序客服聊天需要稳定增量轮询，仅在当前会话变化时刷新消息。',
)

expect(
  /setInterval\(\(\)\s*=>\s*\{[\s\S]*refreshSupportRealtime\(\)[\s\S]*\},\s*5000\)/.test(webAdmin)
    && /document\.visibilityState === 'hidden'/.test(webAdmin)
    && /updateSupportSessionStatus/.test(webAdmin),
  '管理端客服会话需要节流刷新、隐藏页暂停，并支持完成/重开会话。',
)

expect(
  /selectedItems/.test(supportPage)
    && /order\.items\.map/.test(supportPage)
    && /mall-support-item/.test(supportPage),
  '客服售后页需要展示订单号、商品明细和售后商品上下文。',
)

expect(
  /listNotifications/.test(service)
    && /getUnreadNotificationCount/.test(service)
    && /markNotificationRead/.test(service),
  '商城端需要通知列表、未读数和已读服务方法。',
)

expect(
  /'pages\/notifications\/index'/.test(appConfig.match(/const mallPages = \[[\s\S]*?\]/)?.[0] || ''),
  '商城小程序 profile 必须注册通知页，否则消息提醒点不进去。',
)

expect(
  /MallNotificationFloat/.test(mallUi)
    && /listNotifications\(/.test(mallUi)
    && /mall-notification-float/.test(mallUi)
    && /setTimeout\(\(\)\s*=>\s*\{[\s\S]*setLatest\(null\)[\s\S]*\},\s*4000\)/.test(mallUi),
  '商城页面需要顶部悬浮栏展示新消息提醒，并在短暂停留后自动收起。',
)

expect(
  /relatedTypeOf/.test(notificationsPage)
    && /relatedIdOf/.test(notificationsPage)
    && /relatedOrderIdOf/.test(notificationsPage),
  '通知点击跳转需要兼容 snake_case 和 camelCase 关联字段。',
)

expect(
  /ProfileLink[\s\S]*消息提醒/.test(profilePage)
    && /unreadNotificationCount/.test(profilePage)
    && /\/pages\/notifications\/index/.test(profilePage),
  '商城我的页需要消息提醒入口和未读数量。',
)

expect(
  /insert_mall_notification/.test(mallBackend)
    && /mall_order_paid/.test(mallBackend)
    && /mall_after_sale_processed/.test(mallBackend)
    && /mall_support_message/.test(mallBackend),
  '商城订单、售后和客服事件需要写入用户消息提醒。',
)

expect(
  /count\(DISTINCT sale\.order_id\)/.test(mallBackend),
  '我的页售后数量需要按订单去重，不能一张订单多个售后记录显示多单。',
)

expect(
  /admin_refund_order[\s\S]*existing_after_sale[\s\S]*status NOT IN \('rejected', 'closed'\)/.test(mallBackend)
    && /UPDATE mall_after_sales[\s\S]*SET status = 'refunding'[\s\S]*WHERE id = \$1/.test(mallBackend),
  '管理端退款遇到已有未完结售后时必须复用记录并更新为退款中，不能重复插入售后。',
)

console.log('Mall message/refund/support checks passed.')
