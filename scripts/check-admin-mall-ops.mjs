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
  '/api/admin/mall/uploads/product-image',
]) {
  requireIncludes(mallModule, route, `Mall admin router must expose ${route}`)
}

for (const handler of [
  'admin_create_category',
  'admin_update_category',
  'admin_list_inventory_alerts',
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
