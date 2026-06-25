#!/usr/bin/env node
import { readFileSync } from 'node:fs'

const files = {
  packageJson: read('package.json'),
  server: read('server/src/modules/mall.rs'),
  admin: read('src/web-admin/main.tsx'),
  adminStyles: read('src/web-admin/styles.css'),
  service: read('src/services/mall.ts'),
  ui: read('src/pages/mall/mall-ui.tsx'),
  theme: read('src/pages/mall/mall-theme.css'),
}

const packageJson = JSON.parse(files.packageJson)

const checks = [
  {
    name: 'package exposes the fixed-price campaign contract check',
    pass: packageJson.scripts?.['check:mall-fixed-price-campaign'] === 'node scripts/check-mall-fixed-price-campaign.mjs',
  },
  {
    name: 'backend recognizes fixed_price campaigns and applies fixed-price product badges',
    pass: /campaign_type\s*=\s*'fixed_price'/.test(files.server)
      && /find_fixed_price_campaign/.test(files.server)
      && /fixedPriceCampaign/.test(files.server)
      && /badgeBackgroundColor/.test(files.server)
      && /badgeTextColor/.test(files.server),
  },
  {
    name: 'backend product filtering can return fixed-price campaign products',
    pass: /"fixed_price"/.test(files.server)
      && /jsonb_array_elements\(COALESCE\(campaign\.rules->'items'/.test(files.server)
      && /normalize_product_activity_type/.test(files.server),
  },
  {
    name: 'web admin has a dedicated one-price marketing page',
    pass: /designPage\('mall\.fixedPriceCampaigns', '一口价'/.test(files.admin)
      && /function MallFixedPriceCampaignsSection\(/.test(files.admin)
      && /fixedPriceCampaignForm/.test(files.admin)
      && /saveFixedPriceCampaign/.test(files.admin),
  },
  {
    name: 'web admin one-price form supports products, fixed price, badge text, icon and colors',
    pass: /FixedPriceCampaignItemForm/.test(files.admin)
      && /badgeText/.test(files.admin)
      && /badgeIcon/.test(files.admin)
      && /badgeIconUrl/.test(files.admin)
      && /badgeBackgroundColor/.test(files.admin)
      && /badgeTextColor/.test(files.admin)
      && /fixedPriceYuan/.test(files.admin),
  },
  {
    name: 'app service and product card expose one-price campaigns through unified promotion tags',
    pass: /fixedPriceCampaign\?: MallFixedPriceCampaign/.test(files.service)
      && /interface MallFixedPriceCampaign/.test(files.service)
      && /promotionTags\?: MallProductPromotionTag\[\]/.test(files.service)
      && /fixedPriceCampaignRules[\s\S]*display:/.test(files.admin)
      && /promotionTags/.test(files.ui)
      && /mall-v7-promotion-tag/.test(files.ui)
      && !/fixedPriceCampaign/.test(extractFunction(files.ui, 'MallDealProductCard'))
      && /mall-v7-promotion-tag/.test(files.theme),
  },
]

const failures = checks.filter(check => !check.pass)
if (failures.length) {
  console.error('Mall fixed-price campaign checks failed:')
  for (const failure of failures) {
    console.error(`- ${failure.name}`)
  }
  process.exit(1)
}

console.log(`Mall fixed-price campaign checks passed (${checks.length} checks).`)

function read(path) {
  return readFileSync(path, 'utf8')
}

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`)
  if (start < 0) return ''
  const next = source.indexOf('\nfunction ', start + 1)
  return source.slice(start, next === -1 ? source.length : next)
}
