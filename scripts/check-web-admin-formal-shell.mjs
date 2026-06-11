import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const mainSource = readFileSync(resolve(root, 'src/web-admin/main.tsx'), 'utf8');
const cssSource = readFileSync(resolve(root, 'src/web-admin/styles.css'), 'utf8');
const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));

const failures = [];

function expect(condition, message) {
  if (!condition) failures.push(message);
}

expect(mainSource.includes('sidebarCollapsed'), 'web admin shell must keep a sidebarCollapsed state.');
expect(mainSource.includes('sidebar-toggle'), 'web admin sidebar must expose a collapse/expand toggle.');
expect(mainSource.includes('sidebar-admin-card'), 'current admin details must live in the sidebar.');
expect(mainSource.includes('sidebar-logout'), 'logout action must live in the sidebar.');
expect(mainSource.includes('退出登录'), 'sidebar logout action should use the complete label 退出登录.');
expect(mainSource.includes('aria-label="退出登录"'), 'icon-only collapsed logout must keep an accessible name.');
expect(mainSource.includes('aria-label={`${module.moduleLabel}，${module.pages.length} 页`}'), 'collapsed module buttons must keep full accessible names.');
expect(mainSource.includes('normalizeLoadedValue'), 'dashboard loading must normalize malformed API payloads.');
expect(mainSource.includes('Array.isArray(fallback)'), 'dashboard loading must guard list payloads before rendering.');
expect(cssSource.includes('.design-admin.sidebar-collapsed'), 'collapsed sidebar layout must be styled.');
expect(cssSource.includes('.sidebar-collapsed .design-sidebar'), 'collapsed sidebar must restyle the sidebar itself.');
expect(cssSource.includes('.sidebar-bottom'), 'sidebar bottom area must be styled for account actions.');

const topbarMatch = mainSource.match(/<header className="topbar design-topbar">[\s\S]*?<\/header>/);
expect(Boolean(topbarMatch), 'web admin shell must keep a topbar header.');

if (topbarMatch) {
  const topbar = topbarMatch[0];
  expect(!topbar.includes('admin-account'), 'current admin details must not be rendered in the topbar.');
  expect(!topbar.includes('onClick={reload}'), 'topbar must not provide a refresh button.');
  expect(!topbar.includes('handleLogout'), 'topbar must not provide a logout button.');
  expect(!topbar.includes('刷新'), 'topbar must not show refresh copy.');
  expect(!topbar.includes('退出'), 'topbar must not show logout copy.');
}

expect(
  packageJson.scripts['check:web-admin-formal-shell'] === 'node scripts/check-web-admin-formal-shell.mjs',
  'package.json must expose check:web-admin-formal-shell.',
);
expect(
  packageJson.scripts.validate.includes('check:web-admin-formal-shell'),
  'pnpm validate must include check:web-admin-formal-shell.',
);

if (failures.length) {
  throw new Error(`Web admin formal-shell check failed:\n- ${failures.join('\n- ')}`);
}

console.log('web admin formal shell contract ok');
