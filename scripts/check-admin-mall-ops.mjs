import { readFileSync } from 'node:fs'

const webAdmin = readFileSync('src/web-admin/main.tsx', 'utf8')
const mallModule = readFileSync('server/src/modules/mall.rs', 'utf8')
const migrations = [
  'server/migrations/0009_mall_operations_support.sql',
  'server/migrations/0016_mall_product_specs.sql',
].map((path) => {
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return ''
  }
}).join('\n')

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
requireIncludes(webAdmin, 'onCreateInventoryAlert', 'Mall inventory page must support creating warning rules')
requireIncludes(webAdmin, 'onEditInventoryAlert', 'Mall inventory page must support editing warning rules')
requireIncludes(webAdmin, 'onDeleteInventoryAlert', 'Mall inventory page must support deleting warning rules')
requireIncludes(webAdmin, '/api/admin/mall/inventory-alerts/${id}', 'Web admin must call real inventory warning detail endpoints')
requireIncludes(webAdmin, "designPage('mall.inventory', '库存预警', '商品管理'", 'Stock warning must stay under mall product management')

if (webAdmin.includes("designPage('mall.images'")) {
  throw new Error('Mall product asset page must be removed from product management navigation')
}

const productListSection = webAdmin.slice(
  webAdmin.indexOf('function MallProductsSection'),
  webAdmin.indexOf('function ProductCreateModal'),
)

if (productListSection.includes('<Panel title="新增商品"')) {
  throw new Error('Mall product list must not include an inline create-product panel')
}

if (productListSection.includes('onSubmit={onSubmit}')) {
  throw new Error('Mall product list must not own the create-product submit flow')
}

if (/图片路径[\s\S]*?<select[\s\S]*mall-products\/fresh-milk\.jpeg/.test(webAdmin)) {
  throw new Error('Mall product forms must not present fixed product image choices')
}

for (const column of [
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
  'length_cm',
  'width_cm',
  'height_cm',
  'volume_liters',
  'weight_kg',
  'stock_alert_threshold',
]) {
  requireIncludes(mallModule, field, `Mall admin backend must persist ${field}`)
}
