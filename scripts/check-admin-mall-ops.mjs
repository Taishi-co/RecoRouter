import { readFileSync, readdirSync } from 'node:fs'

const webAdmin = readFileSync('src/web-admin/main.tsx', 'utf8')
const mallModule = readFileSync('server/src/modules/mall.rs', 'utf8')
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
requireIncludes(webAdmin, 'ProductSpecSubtable', 'Mall product loading dimensions must move into an internal spec subtable')
requireIncludes(webAdmin, '装载规格（可选，不对外展示）', 'Mall loading specs must be marked optional and internal-only')
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
  '售价',
  '进货价',
  '库存',
  '规格',
  '状态',
  '商品说明',
  '售卖方式',
]) {
  requireIncludes(productFormSection, `${label}<span className="required-mark">*</span>`, `Mall product form must mark ${label} as required`)
}

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
]) {
  requireIncludes(migrations, column, `Mall product schema must include ${column}`)
}

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
