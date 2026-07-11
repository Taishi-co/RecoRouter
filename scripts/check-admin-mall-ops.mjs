import { readFileSync, readdirSync } from 'node:fs'

const webAdmin = readFileSync('src/web-admin/main.tsx', 'utf8')
const mallModule = readFileSync('server/src/modules/mall.rs', 'utf8')
const mallService = readFileSync('src/services/mall.ts', 'utf8')
const mallProductDetail = readFileSync('src/pages/mall/product/index.tsx', 'utf8')
const mallUi = readFileSync('src/pages/mall/mall-ui.tsx', 'utf8')
const migrations = readdirSync('server/migrations')
  .filter((name) => name.endsWith('.sql'))
  .sort()
  .map((name) => readFileSync(`server/migrations/${name}`, 'utf8'))
  .join('\n')

function requireIncludes(source, needle, message) {
  if (!source.includes(needle)) {
    throw new Error(message)
  }
}

function requireRegex(source, pattern, message) {
  if (!pattern.test(source)) {
    throw new Error(message)
  }
}

for (const field of [
  'lengthCm',
  'widthCm',
  'heightCm',
  'volumeLiters',
  'weightKg',
  'stockAlertThreshold',
]) {
  requireIncludes(webAdmin, field, `Web admin product form must expose ${field}`)
}

requireRegex(webAdmin, /type="file"/, 'Mall product image must use operator file upload')
requireIncludes(webAdmin, '/api/admin/mall/uploads/product-image', 'Web admin must upload product images through backend upload API')
requireIncludes(webAdmin, 'MallCategoriesSection', 'Web admin must render real mall category management section')
requireIncludes(webAdmin, 'MallInventorySection', 'Web admin must render real stock warning section')
requireIncludes(webAdmin, 'productFilters', 'Web admin must support product search filters')
requireIncludes(webAdmin, 'categoryFilters', 'Web admin must support category search filters')
requireIncludes(webAdmin, 'inventoryFilters', 'Web admin must support stock warning filters')
requireIncludes(webAdmin, 'ProductCreateModal', 'Mall product creation must be handled by a modal')
requireIncludes(webAdmin, 'setCreateModalOpen(true)', 'Mall product listing/upsert flow must open a create modal')
requireIncludes(webAdmin, '新增上架商品', 'Mall product create modal must provide an explicit create action')
requireIncludes(webAdmin, 'supplyPriceYuan', 'Mall product listing form must collect purchase cost')
requireIncludes(webAdmin, 'specification', 'Mall product listing form must collect sale specification')
requireIncludes(webAdmin, 'saleMethod', 'Mall product listing form must collect sale method')
requireIncludes(webAdmin, 'variant-loading-spec-grid', 'Mall product loading dimensions must be configured per sale variant')
requireIncludes(webAdmin, 'variantLoadingPatch', 'Mall variant loading specs must update the matching sale variant')
requireIncludes(webAdmin, 'productImageLimit = 20', 'Mall product image gallery must cap a product at 20 images')
requireIncludes(webAdmin, 'ProductImageGalleryInput', 'Mall product form must support multiple uploaded product images')
requireIncludes(webAdmin, 'multiple', 'Mall product image upload input must allow selecting multiple images')
requireIncludes(webAdmin, 'ProductVariantSubtable', 'Mall product form must support multiple sale variants')
requireIncludes(webAdmin, 'productVariantLimit', 'Mall product variants must have an explicit frontend limit')
requireIncludes(webAdmin, 'addProductVariant', 'Mall product form must let operators add variants')
requireIncludes(webAdmin, 'removeProductVariant', 'Mall product form must let operators remove variants')
requireIncludes(webAdmin, 'onSaveCategoryOrder', 'Mall categories must support deferred persisted drag reorder')
requireIncludes(webAdmin, 'draggable', 'Mall categories table rows must be draggable')
requireIncludes(webAdmin, 'onCreateInventoryAlert', 'Mall inventory page must support creating warning rules')
requireIncludes(webAdmin, 'onEditInventoryAlert', 'Mall inventory page must support editing warning rules')
requireIncludes(webAdmin, 'onDeleteInventoryAlert', 'Mall inventory page must support deleting warning rules')
requireIncludes(webAdmin, '/api/admin/mall/inventory-alerts/${id}', 'Web admin must call real inventory warning detail endpoints')
requireIncludes(webAdmin, "designPage('mall.inventory', '库存预警', '商品管理'", 'Stock warning must stay under mall product management')
requireIncludes(webAdmin, '编辑排序', 'Mall categories must require entering sort edit mode before dragging.')
requireIncludes(webAdmin, '保存排序', 'Mall categories must save category ordering explicitly.')
requireIncludes(webAdmin, '取消排序', 'Mall categories must allow cancelling category ordering changes.')
requireIncludes(webAdmin, 'categorySortEditing', 'Mall categories must keep sorting in local edit mode.')
requireIncludes(webAdmin, 'categorySortDraft', 'Mall categories must keep a local draft order before save.')
requireIncludes(webAdmin, "setModalMode('create')", 'Mall inventory warning creation must open a modal.')
requireIncludes(webAdmin, "setModalMode('edit')", 'Mall inventory warning editing must open a modal.')

if (webAdmin.includes("designPage('mall.images'")) {
  throw new Error('Mall product asset page must be removed from product management navigation')
}

if (webAdmin.includes("designPage('mall.listingRequests'") || webAdmin.includes('MallListingRequestsSection')) {
  throw new Error('Mall listing-request page must be removed from product management navigation')
}

const categoryRouteSection = webAdmin.slice(
  webAdmin.indexOf("activePageKey === 'mall.categories'"),
  webAdmin.indexOf("activePageKey === 'mall.inventory'"),
)

if (categoryRouteSection.includes('MallInventorySection') || categoryRouteSection.includes('mallInventoryAlerts')) {
  throw new Error('Mall category management page must not embed stock warning management.')
}

const categoriesSection = webAdmin.slice(
  webAdmin.indexOf('function MallCategoriesSection'),
  webAdmin.indexOf('function MallInventorySection'),
)

if (categoriesSection.includes('void onSaveCategoryOrder(')) {
  throw new Error('Mall category drag/drop must not persist until the operator clicks save.')
}

const productListSection = webAdmin.slice(
  webAdmin.indexOf('function MallProductsSection'),
  webAdmin.indexOf('function ProductCreateModal'),
)

for (const required of [
  'productSortOptions',
  'productPageSizeOptions',
  '最近编辑',
  '商品名',
  '类目',
  '价格从低到高',
  '库存从低到高',
  'product-pagination',
]) {
  requireIncludes(webAdmin, required, `Mall product list must support server-side sorting and pagination: ${required}`)
}

for (const required of [
  /page:\s*(?:context\.)?productFilters\.page/,
  /pageSize:\s*(?:context\.)?productFilters\.pageSize/,
  /sort:\s*(?:context\.)?productFilters\.sort/,
]) {
  if (!required.test(webAdmin)) {
    throw new Error(`Mall product list must keep server-side sorting and pagination: ${required}`)
  }
}

for (const sortKey of [
  'updated_desc',
  'name_asc',
  'category_asc',
  'price_asc',
  'stock_asc',
]) {
  requireIncludes(mallModule, sortKey, `Mall product backend must support sort key ${sortKey}`)
}

const productListingSection = webAdmin.slice(
  webAdmin.indexOf('function MallProductDesignSection'),
  webAdmin.indexOf('function ProductFormFields'),
)

if (productListingSection.includes('商品搜索')) {
  throw new Error('Mall product listing/create page must not include product search controls')
}

for (const removedCopy of [
  '新增商品、价格、库存和图片',
  '点击新增上架商品后',
  '图片上传',
  '规格校验',
  '上架时可同步设置商品库存和预警阈值',
]) {
  if (productListingSection.includes(removedCopy)) {
    throw new Error(`Mall product listing/create page must not render explanatory copy: ${removedCopy}`)
  }
}

if (!webAdmin.includes("designPage('mall.products', '商品上架', '商品管理', ''")) {
  throw new Error('Mall product listing/create page must not render a page-header explanation.')
}

if (productListSection.includes('<Panel title="新增商品"')) {
  throw new Error('Mall product list must not include an inline create-product panel')
}

if (productListSection.includes('新增商品') || productListSection.includes('新增上架商品')) {
  throw new Error('Mall product list page must not expose product creation actions')
}

if (productListSection.includes('onSubmit={onSubmit}')) {
  throw new Error('Mall product list must not own the create-product submit flow')
}

const productFormSection = webAdmin.slice(
  webAdmin.indexOf('function ProductFormFields'),
  webAdmin.indexOf('function ProductImage'),
)

for (const label of [
  '商品名称',
  '类目',
  '状态',
  '商品说明',
]) {
  requireIncludes(productFormSection, `${label}<span className="required-mark">*</span>`, `Mall product form must mark ${label} as required`)
}

for (const label of [
  '售价',
  '进货价',
  '库存',
  '规格',
  '单份售卖方式',
  '最小起订量',
]) {
  requireIncludes(webAdmin, `data-variant-required="${label}"`, `Mall sale variant table must mark ${label} as required`)
}

const productBaseFormSection = productFormSection.slice(
  productFormSection.indexOf('<div className="product-form-grid product-base-grid">'),
  productFormSection.indexOf('<ProductVariantSubtable'),
)

for (const duplicatedLabel of [
  '售价',
  '进货价',
  '库存',
  '规格',
  '售卖方式',
  '最小起订量',
]) {
  if (productBaseFormSection.includes(`<label>${duplicatedLabel}`) || productBaseFormSection.includes(`${duplicatedLabel}<span className="required-mark">*</span>`)) {
    throw new Error(`Mall product base form must not duplicate variant-level field: ${duplicatedLabel}`)
  }
}

requireIncludes(webAdmin, 'variant.pricingMode === \'weighed\' &&', 'Fixed-price sale variants must hide weight unit and tolerance inputs')
requireIncludes(webAdmin, 'variant-loading-spec-grid', 'Loading specs must be edited per sale variant')
requireIncludes(webAdmin, 'variantLoadingPatch', 'Sale variants must carry their own loading spec patch')
requireIncludes(webAdmin, 'product-modal-wide', 'Product create/edit modal must use a wider layout')
requireIncludes(webAdmin, 'product-form-scroll-guard', 'Product create/edit modal must guard against horizontal overflow')

if (productFormSection.includes('>原价')) {
  throw new Error('Mall product form must label purchase cost as 进货价 instead of 原价')
}

if (/图片路径[\s\S]*?<select[\s\S]*mall-products\/fresh-milk\.jpeg/.test(webAdmin)) {
  throw new Error('Mall product forms must not present fixed product image choices')
}

for (const column of [
  'specification',
  'sale_method',
  'length_cm',
  'width_cm',
  'height_cm',
  'volume_liters',
  'weight_kg',
  'stock_alert_threshold',
  'images jsonb',
  'variants jsonb',
  'variant_id text',
  'variant_name text',
]) {
  requireIncludes(migrations, column, `Mall product schema must include ${column}`)
}

for (const required of [
  'MAX_PRODUCT_IMAGES',
  'MAX_PRODUCT_VARIANTS',
  'ProductVariantMutation',
  'normalize_product_variants',
  'fetch_product_variant_snapshot',
  'variant_id',
  'variantName',
  'normalize_product_images',
  'images: Option<Vec<String>>',
  'variants: Option<Vec<ProductVariantMutation>>',
]) {
  requireIncludes(mallModule, required, `Mall product backend must support product image gallery: ${required}`)
}

for (const required of [
  "'imageKeys'",
  "'images'",
]) {
  requireIncludes(migrations, required, `Mall product schema JSON must expose product image gallery field: ${required}`)
}

requireIncludes(mallService, 'images?: string[]', 'Mall app service type must expose product image galleries')
requireIncludes(mallService, 'MallProductVariant', 'Mall app service type must expose product variants')
requireIncludes(mallUi, 'primaryMallProductImageUrl', 'Mall app thumbnails must prefer the first product gallery image')
requireIncludes(mallProductDetail, 'MallProductImageCarousel', 'Mall product detail page must render a product image carousel')
requireIncludes(mallProductDetail, 'productImageUrls', 'Mall product detail page must resolve all product gallery image URLs')
requireIncludes(mallProductDetail, 'VariantSelector', 'Mall product detail page must let users select a product variant')
requireIncludes(mallProductDetail, 'selectedVariant', 'Mall product detail page must bind price/cart/buy-now to selected variant')
requireIncludes(webAdmin, 'pricingMode', 'Mall product variants must support weighted pricing configuration')
requireIncludes(webAdmin, 'WeightAdjustmentModal', 'Mall order detail must support weighing-based price adjustment')
requireIncludes(mallProductDetail, 'weighedVariantRangeText', 'Mall product detail must explain weighted fresh-goods price ranges')
requireIncludes(mallService, 'pricingMode?:', 'Mall app service type must expose weighted pricing mode')
requireIncludes(mallModule, 'admin_update_order_weight_adjustment', 'Mall backend must expose admin order weighing adjustment')
requireIncludes(mallModule, 'apply_weight_adjustment', 'Mall backend must adjust weighted order item totals')
requireIncludes(migrations, 'actual_weight_grams', 'Mall order item schema must store actual weighed weight')
requireIncludes(migrations, 'weight_adjustment_cents', 'Mall order schema must store weighing price adjustment amount')

for (const route of [
  '/api/admin/mall/categories',
  '/api/admin/mall/categories/:id',
  '/api/admin/mall/inventory-alerts',
  '/api/admin/mall/inventory-alerts/:id',
  '/api/admin/mall/uploads/product-image',
]) {
  requireIncludes(mallModule, route, `Mall admin router must expose ${route}`)
}

for (const handler of [
  'admin_create_category',
  'admin_update_category',
  'admin_list_inventory_alerts',
  'admin_create_inventory_alert',
  'admin_update_inventory_alert',
  'admin_delete_inventory_alert',
  'admin_upload_product_image',
]) {
  requireIncludes(mallModule, handler, `Mall admin backend must implement ${handler}`)
}

for (const field of [
  'specification',
  'sale_method',
  'length_cm',
  'width_cm',
  'height_cm',
  'volume_liters',
  'weight_kg',
  'stock_alert_threshold',
]) {
  requireIncludes(mallModule, field, `Mall admin backend must persist ${field}`)
}

requireIncludes(mallModule, 'strip_public_product_specs', 'Public mall product APIs must strip internal loading specs')
