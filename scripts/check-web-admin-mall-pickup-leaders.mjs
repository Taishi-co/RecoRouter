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
const adminMallApp = read('src/pages/admin/mall/index.tsx');
const mallService = read('src/services/mall.ts');
const mallBackend = read('server/src/modules/mall.rs');
const packageJson = read('package.json');

assert(
  /function MallPickupPointsSection\(/.test(adminMain),
  'Web admin must provide a real MallPickupPointsSection instead of a design placeholder.',
);
assert(
  /function MallGroupLeadersSection\(/.test(adminMain),
  'Web admin must provide a real MallGroupLeadersSection instead of a design placeholder.',
);
assert(
  /activePageKey === 'mall\.pickup'[\s\S]*<MallPickupPointsSection/.test(adminMain),
  'The mall.pickup page must render the real pickup-point section.',
);
assert(
  /activePageKey === 'mall\.leaders'[\s\S]*<MallGroupLeadersSection/.test(adminMain),
  'The mall.leaders page must render the real group-leader section.',
);
for (const label of ['新增自提点', '自提点名称', '小区', '营业时间', '团长姓名', '团长手机号']) {
  assert(adminMain.includes(label), `Pickup-point management must expose ${label}.`);
}
for (const label of ['新增团长', '绑定自提点', '服务说明', '启用', '停用']) {
  assert(adminMain.includes(label), `Group-leader management must expose ${label}.`);
}
for (const needle of [
  '/api/admin/mall/pickup-points',
  '/api/admin/mall/group-leaders',
  'savePickupPoint',
  'saveGroupLeader',
  'deletePickupPoint',
  'deleteGroupLeader',
]) {
  assert(adminMain.includes(needle), `Web admin must wire ${needle}.`);
}
for (const backendNeedle of [
  'get(admin_list_pickup_points::<S>).post(admin_create_pickup_point::<S>)',
  'put(admin_update_pickup_point::<S>).delete(admin_delete_pickup_point::<S>)',
  'get(admin_list_group_leaders::<S>).post(admin_create_group_leader::<S>)',
  'put(admin_update_group_leader::<S>).delete(admin_delete_group_leader::<S>)',
  'fetch_group_leaders',
  'sync_pickup_point_leader_contact',
]) {
  assert(mallBackend.includes(backendNeedle), `Backend must implement ${backendNeedle}.`);
}
for (const appNeedle of [
  "type PanelKey = 'products' | 'orders' | 'pickup' | 'leaders' | 'delivery' | 'finance' | 'stats'",
  "{ key: 'pickup', label: '自提点'",
  "{ key: 'leaders', label: '团长'",
  'adminListMallGroupLeaders',
  'adminCreateMallPickupPoint',
  'adminUpdateMallPickupPoint',
  'adminDeleteMallPickupPoint',
  'adminCreateMallGroupLeader',
  'adminUpdateMallGroupLeader',
  'adminDeleteMallGroupLeader',
  "panel === 'pickup'",
  "panel === 'leaders'",
]) {
  assert(adminMallApp.includes(appNeedle), `Admin miniapp mall workbench must wire ${appNeedle}.`);
}
for (const serviceNeedle of [
  'export interface MallGroupLeader',
  'adminListMallGroupLeaders',
  'adminCreateMallPickupPoint',
  'adminUpdateMallPickupPoint',
  'adminDeleteMallPickupPoint',
  'adminCreateMallGroupLeader',
  'adminUpdateMallGroupLeader',
  'adminDeleteMallGroupLeader',
]) {
  assert(mallService.includes(serviceNeedle), `Mall service must expose ${serviceNeedle}.`);
}
assert(
  /"check:web-admin-mall-pickup-leaders": "node scripts\/check-web-admin-mall-pickup-leaders\.mjs"/.test(packageJson),
  'package.json must expose check:web-admin-mall-pickup-leaders.',
);
assert(
  /check:web-admin-mall-pickup-leaders/.test(JSON.parse(packageJson).scripts.validate),
  'pnpm validate must include check:web-admin-mall-pickup-leaders.',
);

console.log('web admin mall pickup and leader contract ok');
