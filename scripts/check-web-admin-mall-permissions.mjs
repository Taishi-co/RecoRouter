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

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert(start >= 0, `${name} must exist.`);
  const next = source.indexOf('\nfunction ', start + 1);
  return source.slice(start, next === -1 ? source.length : next);
}

const adminMain = read('src/web-admin/main.tsx');
const adminStyles = read('src/web-admin/styles.css');
const mallBackend = read('server/src/modules/mall.rs');
const packageJson = JSON.parse(read('package.json'));
const permissionsSection = extractFunction(adminMain, 'MallPermissionsSection');

assert(/interface MallPermissionForm/.test(adminMain), 'Web admin must define a mall permission form model.');
assert(/interface MallPermissionFilterState/.test(adminMain), 'Web admin must define mall permission filters.');
assert(/mallPermissions: JsonRecord\[]/.test(adminMain), 'Dashboard data must include mall permissions.');
assert(/initialPermissionForm/.test(adminMain), 'Web admin must define initial permission form state.');
assert(/initialPermissionFilters/.test(adminMain), 'Web admin must define initial permission filters.');
assert(/apiGet<JsonRecord\[]>\('\/api\/admin\/mall\/permissions'/.test(adminMain), 'Web admin must load mall permissions from a real backend API.');
assert(/apiPost(?:<[^>]+>)?\('\/api\/admin\/mall\/permissions'/.test(adminMain), 'Web admin must create mall permissions through a backend API.');
assert(/apiPut(?:<[^>]+>)?\(`\/api\/admin\/mall\/permissions\/\$\{[^}]+\}`/.test(adminMain), 'Web admin must update mall permissions through a backend API.');
assert(/apiDelete(?:<[^>]+>)?\(`\/api\/admin\/mall\/permissions\/\$\{[^}]+\}`/.test(adminMain), 'Web admin must delete mall permissions through a backend API.');
assert(/function MallPermissionsSection\(/.test(adminMain), 'Web admin must render a real mall permissions section.');
assert(/activePageKey === 'mall\.permissions'[\s\S]*<MallPermissionsSection/.test(adminMain), 'mall.permissions must route to MallPermissionsSection.');
assert(/运营权限/.test(adminMain), 'Mall permissions page must expose the expected Chinese title.');
assert(/新增权限/.test(adminMain), 'Mall permissions page must support create.');
assert(/编辑权限/.test(adminMain), 'Mall permissions page must support edit.');
assert(/删除/.test(adminMain), 'Mall permissions page must support delete.');
assert(/权限搜索/.test(adminMain), 'Mall permissions page must support search.');
assert(!/permission-summary-grid/.test(permissionsSection), 'Mall permissions page must not render metrics or data summary cards.');
assert(!/权限总数|启用权限|停用\/草稿/.test(permissionsSection), 'Mall permissions page must only focus on permission CRUD.');

assert(/\/api\/admin\/mall\/permissions/.test(mallBackend), 'Backend must expose admin mall permission routes.');
assert(/struct PermissionMutationRequest/.test(mallBackend), 'Backend must define permission mutation request.');
assert(/async fn admin_list_permissions/.test(mallBackend), 'Backend must implement permission listing.');
assert(/async fn admin_create_permission/.test(mallBackend), 'Backend must implement permission creation.');
assert(/async fn admin_update_permission/.test(mallBackend), 'Backend must implement permission update.');
assert(/async fn admin_delete_permission/.test(mallBackend), 'Backend must implement permission deletion.');
assert(/mall_operation_settings/.test(mallBackend) && /roles/.test(mallBackend), 'Backend must persist permissions in mall operation settings roles JSON.');

assert(/\.permission-admin/.test(adminStyles), 'Permissions page CSS shell must exist.');
assert(/\.permission-editor/.test(adminStyles), 'Permissions editor CSS must exist.');
assert(/\.permission-module-grid/.test(adminStyles), 'Permissions module selector CSS must exist.');
assert(!/\.permission-summary-grid/.test(adminStyles), 'Permissions summary card CSS must be removed.');

assert(
  packageJson.scripts['check:web-admin-mall-permissions'] === 'node scripts/check-web-admin-mall-permissions.mjs',
  'package.json must expose check:web-admin-mall-permissions.',
);
assert(
  packageJson.scripts.validate.includes('check:web-admin-mall-permissions'),
  'pnpm validate must include check:web-admin-mall-permissions.',
);

console.log('web admin mall permissions contract ok');
