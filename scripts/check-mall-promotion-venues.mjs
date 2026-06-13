import fs from 'node:fs';

const checks = [
  {
    file: 'server/src/modules/mall.rs',
    required: [
      '/api/mall/promotion-venues',
      'list_promotion_venues',
      'promotion_venue',
      'venue_id',
      'push_product_promotion_venue_filter',
    ],
  },
  {
    file: 'src/services/mall.ts',
    required: [
      'MallPromotionVenue',
      'listMallPromotionVenues',
      'venueId',
      '/api/mall/promotion-venues',
    ],
  },
  {
    file: 'src/pages/mall/index/index.tsx',
    required: [
      'listMallPromotionVenues',
      'promotionVenues',
      'openPromotionVenue',
      'mall-v7-promotion-venues',
    ],
  },
  {
    file: 'src/pages/mall/category/index.tsx',
    required: [
      'promotion_venue',
      'venueId',
      '会场',
    ],
  },
  {
    file: 'src/web-admin/main.tsx',
    required: [
      'mall.promotionVenues',
      'PromotionVenueForm',
      'promotionVenueRules',
      'MallPromotionVenuesSection',
      '大促会场',
    ],
  },
];

const missing = [];

for (const check of checks) {
  const content = fs.readFileSync(check.file, 'utf8');
  for (const needle of check.required) {
    if (!content.includes(needle)) {
      missing.push(`${check.file}: missing ${needle}`);
    }
  }
}

if (missing.length) {
  console.error(missing.join('\n'));
  process.exit(1);
}

console.log('Mall promotion venue workflow checks passed');
