import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');

function read(pathname) {
  return readFileSync(resolve(root, pathname), 'utf8');
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const adminMain = read('src/web-admin/main.tsx');
const adminStyles = read('src/web-admin/styles.css');
const mallBackend = read('server/src/modules/mall.rs');
const packageJson = read('package.json');

assert(
  /function MallOrdersSection\([\s\S]*onViewDetail[\s\S]*\)/.test(adminMain),
  'MallOrdersSection must expose onViewDetail for row-level order detail actions.',
);
assert(
  /onClick=\{\(\) => onViewDetail\([\s\S]*详情/.test(adminMain),
  'Mall order rows must render a detail button that calls onViewDetail.',
);
assert(
  /function MallOrderDetailModal\(/.test(adminMain),
  'Web admin must provide a modal for viewing order details from the order list.',
);
assert(
  /function MallOrderDetailSearchSection\(/.test(adminMain),
  'Web admin must provide a dedicated order detail search section.',
);
assert(
  /activePageKey === 'mall\.orderDetail'[\s\S]*<MallOrderDetailSearchSection/.test(adminMain),
  'The mall.orderDetail page must render the order detail search section.',
);
assert(
  /搜索订单号/.test(adminMain) && /placeholder="输入订单号/.test(adminMain),
  'The order detail page must allow operators to search by order number.',
);
assert(
  /\/api\/admin\/mall\/orders\/\$\{encodeURIComponent/.test(adminMain),
  'Order detail loading must call the real admin order detail API with encodeURIComponent.',
);
assert(
  /WHERE o\.id = \$1[\s\S]*lower\(o\.order_no\) = lower\(\$1\)/.test(mallBackend),
  'Backend order detail lookup must support both order id and order_no.',
);
assert(
  /\.order-detail-modal/.test(adminStyles) && /\.order-detail-grid/.test(adminStyles),
  'Order detail modal/search view styles must be defined.',
);
assert(
  /"check:web-admin-mall-order-detail": "node scripts\/check-web-admin-mall-order-detail\.mjs"/.test(packageJson),
  'package.json must expose check:web-admin-mall-order-detail.',
);
assert(
  /check:web-admin-mall-order-detail/.test(JSON.parse(packageJson).scripts.validate),
  'pnpm validate must include check:web-admin-mall-order-detail.',
);

console.log('web admin mall order detail contract ok');
