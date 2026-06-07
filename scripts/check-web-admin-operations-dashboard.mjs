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
const packageJson = JSON.parse(read('package.json'));

assert(/function OperationsDataScreen\(/.test(adminMain), 'Web admin must render operations data through a dedicated big-screen component.');
assert(/buildOperationsScreenModel/.test(adminMain), 'Operations dashboard must build a cross-business data model.');
assert(/operationsTrendBars/.test(adminMain), 'Operations dashboard must derive trend bars from real order data.');
assert(/operationsFunnelSteps/.test(adminMain), 'Operations dashboard must derive a business funnel.');
assert(/operationsModuleCards/.test(adminMain), 'Operations dashboard must derive module health cards.');
assert(/operationsRiskItems/.test(adminMain), 'Operations dashboard must derive risk queue items.');
assert(/activePageKey === 'platform\.overview'[\s\S]*<OperationsDataScreen/.test(adminMain), 'platform.overview must route to the operations big screen.');
assert(/activePageKey === 'mall\.data'[\s\S]*<OperationsDataScreen/.test(adminMain), 'mall.data must route to the operations big screen.');
assert(/运营数据大屏/.test(adminMain), 'Operations big screen must expose the expected page title.');
assert(/交易趋势/.test(adminMain), 'Operations big screen must show the transaction trend section.');
assert(/业务漏斗/.test(adminMain), 'Operations big screen must show the business funnel section.');
assert(/模块健康/.test(adminMain), 'Operations big screen must show module health.');
assert(/风险队列/.test(adminMain), 'Operations big screen must show risk queue.');

assert(/\.operations-screen/.test(adminStyles), 'Operations dashboard styles must define the screen shell.');
assert(/\.operations-hero/.test(adminStyles), 'Operations dashboard styles must define the hero region.');
assert(/\.operations-kpi-grid/.test(adminStyles), 'Operations dashboard styles must define KPI grid.');
assert(/\.operations-trend-bars/.test(adminStyles), 'Operations dashboard styles must define trend bars.');
assert(/\.operations-funnel/.test(adminStyles), 'Operations dashboard styles must define funnel layout.');
assert(/\.operations-risk-list/.test(adminStyles), 'Operations dashboard styles must define risk list layout.');
assert(/@media \(max-width: 860px\)[\s\S]*\.operations-screen/.test(adminStyles), 'Operations dashboard must have mobile responsive rules.');

assert(
  packageJson.scripts['check:web-admin-operations-dashboard'] === 'node scripts/check-web-admin-operations-dashboard.mjs',
  'package.json must expose check:web-admin-operations-dashboard.',
);
assert(
  packageJson.scripts.validate.includes('check:web-admin-operations-dashboard'),
  'pnpm validate must include check:web-admin-operations-dashboard.',
);

console.log('web admin operations dashboard contract ok');
