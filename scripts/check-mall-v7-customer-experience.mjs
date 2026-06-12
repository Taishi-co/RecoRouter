#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()

const files = {
  service: read('src/services/mall.ts'),
  ui: read('src/pages/mall/mall-ui.tsx'),
  theme: read('src/pages/mall/mall-theme.css'),
  home: read('src/pages/mall/index/index.tsx'),
  category: read('src/pages/mall/category/index.tsx'),
  product: read('src/pages/mall/product/index.tsx'),
  bottomNav: read('src/components/layout/bottom-nav.tsx'),
  cart: read('src/pages/mall/cart/index.tsx'),
  confirm: read('src/pages/mall/confirm/index.tsx'),
  orders: read('src/pages/mall/orders/index.tsx'),
  profile: read('src/pages/mall/profile/index.tsx'),
  auth: read('src/pages/mall/auth/index.tsx'),
  authRoute: read('src/pages/mall/auth-route.ts'),
  categoryOptions: read('src/pages/mall/category-options.ts'),
  leader: read('src/pages/mall/group-leader/index.tsx'),
  serverMall: read('server/src/modules/mall.rs'),
  productDetailMigration: readOptional('server/migrations/0027_mall_product_detail_fields.sql'),
  webAdmin: read('src/web-admin/main.tsx'),
  webAdminStyles: read('src/web-admin/styles.css'),
}

const homeCampaigns = ['开业大促', '满减活动', '新品首发', '节日福利']
const orderTabs = ['待支付', '待配送', '待收货', '售后']

const checks = [
  {
    name: '首页是 V7 唯一流量入口，包含固定顶部、轮播广告、滚动公告和三段核心营销',
    pass: /MallHomeFixedHeader/.test(files.home)
      && /mall-v7-home-fixed/.test(files.home)
      && /mall-v7-announcement/.test(files.home)
      && /mall-v7-announcement-track/.test(files.home)
      && /mall-v7-announcement-marquee/.test(files.theme)
      && /flashSaleProducts/.test(files.home)
      && /newArrivalProducts/.test(files.home)
      && /bestSellerProducts/.test(files.home),
  },
  {
    name: '首页广告覆盖设计稿业务文案，快捷分类与品类接口保持一致',
    pass: homeCampaigns.every((text) => files.home.includes(text))
      && /listMallCategories/.test(files.home)
      && /mallCategoryOptionsFromCategories/.test(files.home),
  },
  {
    name: '全局商品卡展示满减后实付价、原价划线、省钱、券和积分标签、一键加购',
    pass: /MallDealProductCard/.test(files.ui)
      && /discountedPriceCents/.test(files.ui)
      && /originalPriceCents/.test(files.ui)
      && /savedCents/.test(files.ui)
      && /couponStackable/.test(files.ui)
      && /pointsDeductibleCents/.test(files.ui)
      && /mall-v7-add-button/.test(files.ui),
  },
  {
    name: '分类页是一行横向分类 + 统一商品列表，不保留左侧二级分类栏',
    pass: /mall-v7-category-tabs/.test(files.category)
      && /MallDealProductCard/.test(files.category)
      && !/mall-category-rail/.test(files.category),
  },
  {
    name: '分类页 tag 使用品类列表数据，并支持商品列表触底分页加载',
    pass: /listMallCategories/.test(files.category)
      && /mallCategoryOptionsFromCategories/.test(files.category)
      && /useReachBottom/.test(files.category)
      && /pageSize/.test(files.category)
      && /page:\s*nextPage/.test(files.category)
      && /setProducts\(\(current\)\s*=>\s*append/.test(files.category)
      && /onReachBottomDistance/.test(read('src/pages/mall/category/index.config.ts'))
      && /fallbackMallCategoryOptions/.test(files.categoryOptions),
  },
  {
    name: '分类页支持活动筛选、条件搜索、排序和 tag 切换加载态',
    pass: /activityFilters/.test(files.category)
      && /sortOptions/.test(files.category)
      && /activityType:\s*nextActivityType/.test(files.category)
      && /sort:\s*nextSort/.test(files.category)
      && /mall-v7-filter-panel/.test(files.category)
      && /mall-loading-overlay/.test(files.category)
      && /mall-loading-spinner/.test(files.theme)
      && /setLoading\(true\)[\s\S]{0,420}setActiveCode/.test(files.category)
      && /handleSearch/.test(files.category)
      && /Picker/.test(files.category),
  },
  {
    name: '商品详情页提供电商式商品详情、规格参数、起订信息和售后说明',
    pass: /商品详情/.test(files.product)
      && /规格参数/.test(files.product)
      && /起订信息/.test(files.product)
      && /售后说明/.test(files.product)
      && /minimumOrderQuantity/.test(files.product)
      && /mall-product-detail-section/.test(files.theme),
  },
  {
    name: '商品最小起订量贯通后端商品 JSON、管理端录入和服务类型',
    pass: /minimum_order_quantity/.test(files.serverMall)
      && /minimumOrderQuantity/.test(files.serverMall)
      && /minimumOrderQuantity/.test(files.service)
      && /minimumOrderQuantity/.test(files.webAdmin)
      && /最小起订量/.test(files.webAdmin)
      && /minimum_order_quantity/.test(files.productDetailMigration)
      && /product_json/.test(files.productDetailMigration),
  },
  {
    name: '首页秒杀倒计时真实刷新，banner 和营销专区能进入活动筛选列表',
    pass: /setInterval\(\(\)\s*=>\s*setNow\(Date\.now\(\)\),\s*1000\)/.test(files.home)
      && /buildFlashSaleState/.test(files.home)
      && /formatDurationSeconds/.test(files.home)
      && /resolveBannerActivityType/.test(files.home)
      && /linkType:\s*'activity'/.test(files.home)
      && /activityType=/.test(files.home)
      && /openActivity\('flash_sale'/.test(files.home)
      && /openActivity\('best_seller',\s*'sales_desc'\)/.test(files.home),
  },
  {
    name: '后端商品列表支持关键词扩展搜索、活动筛选和排序白名单',
    pass: /activity_type:\s*Option<String>/.test(files.serverMall)
      && /sort:\s*Option<String>/.test(files.serverMall)
      && /normalize_product_activity_type/.test(files.serverMall)
      && /normalize_product_sort/.test(files.serverMall)
      && /push_product_activity_filter/.test(files.serverMall)
      && /push_product_order/.test(files.serverMall)
      && /p\.sku ILIKE/.test(files.serverMall)
      && /COALESCE\(p\.tags::text,\s*''\)/.test(files.serverMall)
      && !/COALESCE\(array_to_string\(p\.tags/.test(files.serverMall),
  },
  {
    name: '购物车展示满减前合计、满减后实付、省钱、单品折后价和凑单提示',
    pass: /cart-subtotal-before/.test(files.cart)
      && /cart-payable-after/.test(files.cart)
      && /cart-saved-cents/.test(files.cart)
      && /discountedUnitPriceCents/.test(files.cart)
      && /lineDiscountCents/.test(files.cart)
      && /addOnPrompt/.test(files.cart)
      && /nextDiscountGapCents/.test(files.cart),
  },
  {
    name: '购物车支持一键全选、一键清空和底部固定结算',
    pass: /selectAllCartItems/.test(files.cart)
      && /clearMallCart/.test(files.cart)
      && /mall-v7-fixed-checkout/.test(files.cart),
  },
  {
    name: '结算页仅保留微信支付，并展示满减、优惠券、积分、会员折扣的后端优惠栈',
    pass: /discountBreakdown/.test(files.confirm)
      && /pointsRedeemedCents/.test(files.confirm)
      && /memberDiscountCents/.test(files.confirm)
      && /微信支付/.test(files.confirm)
      && !/支付宝|余额支付|货到付款/.test(files.confirm),
  },
  {
    name: '订单中心为待支付、待配送、待收货、售后四状态且不再使用本地假订单',
    pass: orderTabs.every((text) => files.orders.includes(text))
      && /pending_delivery/.test(files.orders)
      && /pending_receipt/.test(files.orders)
      && /fulfillmentCode/.test(files.orders)
      && /groupLeaderPhone/.test(files.orders)
      && !/fallbackOrders/.test(files.orders),
  },
  {
    name: '个人中心包含会员积分、订单入口、卡包优惠券、地址、发票、积分商城和固定团长入口',
    pass: /couponWallet/.test(files.profile)
      && /积分商城/.test(files.profile)
      && /发票申请/.test(files.profile)
      && /mall-v7-leader-cta/.test(files.profile)
      && /memberLevel/.test(files.profile),
  },
  {
    name: '团长后台展示自提点订单、核销、佣金、提现和 8%-12% 佣金范围',
    pass: /commissionRateBps/.test(files.leader)
      && /pendingOrders/.test(files.leader)
      && /verify/.test(files.leader)
      && /提现/.test(files.leader)
      && /8%-12%/.test(files.leader),
  },
  {
    name: '服务层声明 V7 价格摘要、优惠栈、会员和团长字段',
    pass: /interface MallDiscountBreakdown/.test(files.service)
      && /discountedPriceCents/.test(files.service)
      && /nextDiscountGapCents/.test(files.service)
      && /memberDiscountCents/.test(files.service)
      && /pointsRedeemedCents/.test(files.service)
      && /couponWallet/.test(files.service)
      && /commissionRateBps/.test(files.service),
  },
  {
    name: '后端统一计算满减、会员折扣、积分抵扣、凑单差额和商品折后价',
    pass: /calculate_mall_price_summary/.test(files.serverMall)
      && /discount_breakdown/.test(files.serverMall)
      && /nextDiscountGapCents/.test(files.serverMall)
      && /memberDiscountCents/.test(files.serverMall)
      && /pointsRedeemedCents/.test(files.serverMall)
      && /enrich_product_pricing/.test(files.serverMall),
  },
  {
    name: 'V7 样式包含固定首页、秒杀、商品卡、购物车摘要、团长 CTA，并禁用切换动画',
    pass: /mall-v7-home-fixed/.test(files.theme)
      && /mall-v7-flash-sale/.test(files.theme)
      && /mall-v7-product-card/.test(files.theme)
      && /mall-v7-cart-summary/.test(files.theme)
      && /mall-v7-leader-cta/.test(files.theme)
      && /transition:\s*none\s*!important/.test(files.theme),
  },
  {
    name: '商城品牌图标使用叁友甄选新 icon，覆盖商城底部导航、商城入口和 Web 管理端商城模块',
    pass: existsSync(join(root, 'src/assets/brand/sanyou.png'))
      && /sanyou\.png/.test(files.ui)
      && /mall-tab-brand-icon/.test(files.ui)
      && /MallBrandMark/.test(files.ui)
      && /mall-brand-mark/.test(files.theme)
      && /bottom-nav-brand-icon/.test(files.bottomNav)
      && /brandIcon:\s*'sanyou'/.test(files.bottomNav)
      && /sanyouLogo/.test(files.webAdmin)
      && /brand-mark-image/.test(files.webAdmin)
      && /module-button-mark-image/.test(files.webAdmin)
      && /brand-mark-image/.test(files.webAdminStyles)
      && /module-button-mark-image/.test(files.webAdminStyles),
  },
  {
    name: '商城登录默认和返回按钮回到商城首页，带 returnUrl 的业务登录仍可回原页面',
    pass: /defaultReturnUrl\s*=\s*mallHomeUrl/.test(files.auth)
      && /Taro\.redirectTo\(\{\s*url:\s*mallHomeUrl\s*\}\)/.test(files.auth)
      && /defaultMallAuthReturnUrl\s*=\s*['"]\/pages\/mall\/index\/index['"]/.test(files.authRoute)
      && /returnUrl\.startsWith\(['"]\/pages\/mall\/['"]\)/.test(files.authRoute),
  },
]

const failures = checks.filter((check) => !check.pass)

if (failures.length > 0) {
  console.error('Mall V7 customer experience checks failed:')
  for (const failure of failures) {
    console.error(`- ${failure.name}`)
  }
  process.exit(1)
}

console.log(`Mall V7 customer experience checks passed (${checks.length} checks).`)

function read(path) {
  return readFileSync(join(root, path), 'utf8')
}

function readOptional(path) {
  const file = join(root, path)
  return existsSync(file) ? readFileSync(file, 'utf8') : ''
}
