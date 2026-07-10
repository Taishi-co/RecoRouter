#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const cleanupMigrationPath = join(root, 'server/migrations/0044_mall_roadshow_product_cleanup.sql')
const campaignCleanupMigrationPath = join(root, 'server/migrations/0045_mall_roadshow_campaign_cleanup.sql')
const categoryOptions = read('src/pages/mall/category-options.ts')
const cleanupMigration = existsSync(cleanupMigrationPath) ? readFileSync(cleanupMigrationPath, 'utf8') : ''
const campaignCleanupMigration = existsSync(campaignCleanupMigrationPath)
  ? readFileSync(campaignCleanupMigrationPath, 'utf8')
  : ''

const failures = []

if (!cleanupMigration.includes('TEST-GOODS-RECO-DINO') || !/status\s*=\s*'deleted'/.test(cleanupMigration)) {
  failures.push('roadshow cleanup migration must delete the RecoRouter toy/test product')
}

if (!/name ILIKE '%测试%'/.test(cleanupMigration)) {
  failures.push('roadshow cleanup migration must delete products with visible test names')
}

if (!/NULLIF\(btrim\(COALESCE\(image_url, ''\)\), ''\) IS NULL/.test(cleanupMigration)
  || !/jsonb_array_elements_text/.test(cleanupMigration)) {
  failures.push('roadshow cleanup migration must delete products without a primary image or image gallery')
}

for (const sku of [
  'MILK-DAIRY-FARMERS-1L',
  'FRUIT-KIWI-6',
  'FRUIT-BANANA-BUNCH',
  'FRUIT-DURIAN-BOX',
]) {
  if (!cleanupMigration.includes(sku)) {
    failures.push(`roadshow cleanup migration must rename retained seed product SKU ${sku}`)
  }
}

if (!/WHERE code IN \('goods', 'expired_milk'\)/.test(cleanupMigration) || !/NOT EXISTS/.test(cleanupMigration)) {
  failures.push('roadshow cleanup migration must delete low-quality roadshow categories only after their visible products are gone')
}

for (const categoryCode of ['goods', 'expired_milk']) {
  if (new RegExp(`\\{\\s*code:\\s*['"]${categoryCode}['"]`).test(categoryOptions)) {
    failures.push(`mall fallback category options must not expose ${categoryCode}`)
  }
}

if (!/category\.status !== 'inactive' && category\.status !== 'deleted'/.test(categoryOptions)) {
  failures.push('mall category options must filter deleted categories')
}

if (!campaignCleanupMigration.includes('0826bd10-ee84-4e1d-b90b-4cd94ce2cc23')
  || !campaignCleanupMigration.includes("status = 'inactive'")
  || !campaignCleanupMigration.includes("= '一口价2'")
  || !campaignCleanupMigration.includes('= 5')) {
  failures.push('roadshow campaign cleanup must retire the malformed five-cent fixed-price campaign')
}

if (failures.length > 0) {
  console.error('Mall roadshow product cleanup checks failed:')
  for (const failure of failures) {
    console.error(`- ${failure}`)
  }
  process.exit(1)
}

console.log('Mall roadshow product cleanup checks passed.')

function read(path) {
  return readFileSync(join(root, path), 'utf8')
}
