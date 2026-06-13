import fs from 'node:fs';

const webAdminSource = fs.readFileSync('src/web-admin/main.tsx', 'utf8');
const serverSource = fs.readFileSync('server/src/modules/mall.rs', 'utf8');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

function expect(condition, message) {
  if (!condition) {
    console.error(`Delivery range check failed: ${message}`);
    process.exit(1);
  }
}

expect(
  packageJson.scripts['check:mall-delivery-range-rules'] === 'node scripts/check-mall-delivery-range-rules.mjs',
  'package.json must expose check:mall-delivery-range-rules.',
);

[
  'deliveryRangeEnabled',
  'deliveryOriginLatitude',
  'deliveryOriginLongitude',
  'deliveryRangeRadiusKm',
  'deliveryFeeTiersText',
  'parseDeliveryFeeTiers',
  'formatDeliveryFeeTiers',
  '配送范围',
  '阶梯运费',
].forEach(token => {
  expect(webAdminSource.includes(token), `web admin must include ${token}.`);
});

[
  'DeliveryRangeRule',
  'DeliveryFeeTier',
  'calculate_delivery_distance_km',
  'mall_delivery_fee_cents(subtotal_cents, &settings, Some(&address))',
  '超出配送范围',
  'deliveryDistanceKm',
].forEach(token => {
  expect(serverSource.includes(token), `server must include ${token}.`);
});

console.log('Delivery range rule checks passed.');
