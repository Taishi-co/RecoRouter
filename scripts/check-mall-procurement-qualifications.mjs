#!/usr/bin/env node
import { readFileSync } from 'node:fs'

const files = {
  server: read('server/src/modules/mall.rs'),
  migration: read('server/migrations/0032_mall_procurement_qualifications.sql'),
  admin: read('src/web-admin/main.tsx'),
  adminStyles: read('src/web-admin/styles.css'),
  service: read('src/services/mall.ts'),
  product: read('src/pages/mall/product/index.tsx'),
  ui: read('src/pages/mall/mall-ui.tsx'),
  theme: read('src/pages/mall/mall-theme.css'),
}

const checks = [
  {
    name: '后端有采购商、商品采购商和商品资质报告表',
    pass: /CREATE TABLE IF NOT EXISTS mall_procurement_buyers/.test(files.migration)
      && /CREATE TABLE IF NOT EXISTS mall_product_buyers/.test(files.migration)
      && /CREATE TABLE IF NOT EXISTS mall_product_qualification_reports/.test(files.migration),
  },
  {
    name: '后端商品 JSON 输出品质保证、采购商和资质报告',
    pass: /'qualityGuaranteed'/.test(files.migration)
      && /'procurementBuyers'/.test(files.migration)
      && /'qualificationReports'/.test(files.migration)
      && /'buyerName', CASE/.test(files.migration),
  },
  {
    name: '后端提供采购商 CRUD 和资质文件上传',
    pass: /\/api\/admin\/mall\/procurement-buyers/.test(files.server)
      && /admin_create_procurement_buyer/.test(files.server)
      && /admin_update_procurement_buyer/.test(files.server)
      && /admin_delete_procurement_buyer/.test(files.server)
      && /\/api\/admin\/mall\/uploads\/qualification-file/.test(files.server),
  },
  {
    name: '商品创建和编辑会同步采购商多选、资质报告和隐藏供货商开关',
    pass: /procurement_buyer_ids/.test(files.server)
      && /qualification_reports/.test(files.server)
      && /hide_supplier/.test(files.server)
      && /sync_product_procurement/.test(files.server)
      && /procurementBuyerIds/.test(files.admin)
      && /qualificationReports/.test(files.admin)
      && /hideSupplier/.test(files.admin),
  },
  {
    name: 'Web 管理端有采购商管理页和资质子表格',
    pass: /mall\.procurementBuyers/.test(files.admin)
      && /ProcurementBuyersSection/.test(files.admin)
      && /ProductQualificationSubtable/.test(files.admin)
      && /buyer-check-grid/.test(files.adminStyles)
      && /qualification-report-table/.test(files.adminStyles),
  },
  {
    name: 'App 商品列表和详情展示品质保证与查看资质',
    pass: /qualityGuaranteed/.test(files.service)
      && /MallQualificationReport/.test(files.service)
      && /品质保证/.test(files.ui)
      && /ProductQualificationSection/.test(files.product)
      && /查看资质/.test(files.product)
      && /mall-product-quality-panel/.test(files.theme),
  },
]

const failures = checks.filter(check => !check.pass)
if (failures.length) {
  console.error('Mall procurement qualification checks failed:')
  for (const failure of failures) {
    console.error(`- ${failure.name}`)
  }
  process.exit(1)
}

console.log(`Mall procurement qualification checks passed (${checks.length} checks).`)

function read(path) {
  return readFileSync(path, 'utf8')
}
