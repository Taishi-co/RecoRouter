import fs from 'node:fs'

function read(path) {
  return fs.readFileSync(path, 'utf8')
}

function expect(condition, message) {
  if (!condition) {
    console.error(`Mall marketing scope check failed: ${message}`)
    process.exit(1)
  }
}

const mallUi = read('src/pages/mall/mall-ui.tsx')
const categoryPage = read('src/pages/mall/category/index.tsx')
const productPage = read('src/pages/mall/product/index.tsx')
const admin = read('src/web-admin/main.tsx')
const backend = read('server/src/modules/mall.rs')

expect(
  !/productTag\s*=\s*rankLabel\s*\|\|\s*product\.tags/.test(mallUi)
    && !/mall-v7-product-tag">\{product\.tags/.test(mallUi),
  '商品图片角标不能从普通 product.tags 读取。',
)

expect(
  /mallProductImageBadge/.test(mallUi)
    && /fixedPriceCampaign/.test(mallUi)
    && /promotionTags/.test(mallUi),
  '商品卡片图片角标需要只使用运营营销配置。',
)

expect(
  /shouldUseActivityFilteredProducts/.test(categoryPage)
    && /nextProducts\s*=\s*activityMatchedProducts/.test(categoryPage)
    && !/activityMatchedProducts\.length\s*>\s*0/.test(categoryPage),
  '活动筛选不能在本地无匹配时退回展示全量商品。',
)

expect(
  /PromotionActivitiesSection/.test(productPage)
    && /product\.promotions/.test(productPage)
    && /优惠活动/.test(productPage),
  '商品详情页需要展示后端返回的活动详情。',
)

expect(
  /groupBuyProductKeyword/.test(admin)
    && /groupBuyInlineProductToProductForm/.test(admin)
    && /现场新建商品/.test(admin)
    && /搜索商品名称、类目、SKU/.test(admin),
  '集采预售新建表单需要支持搜索已有商品和现场新建商品。',
)

expect(
  /MallMarketingContext/.test(backend)
    && /fetch_mall_marketing_context/.test(backend)
    && /eligible_delivery_subtotal_cents/.test(backend)
    && /calculate_mall_delivery_campaign_discount_cents\([\s\S]*eligible_subtotal_cents/.test(backend),
  '结算优惠计算需要带商品活动命中上下文，免运费不能只按全单粗算。',
)

console.log('Mall marketing scope and presale product checks passed.')
