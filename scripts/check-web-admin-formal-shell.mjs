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
expect(mainSource.includes('moduleSwitcherCollapsed'), 'web admin shell must let the main sidebar module switcher collapse.');
expect(mainSource.includes('collapsedGroups'), 'web admin shell must let page function groups collapse independently.');
expect(mainSource.includes('sidebar-toggle'), 'web admin sidebar must expose a collapse/expand toggle.');
expect(mainSource.includes('sidebar-admin-card'), 'current admin details must live in the sidebar.');
expect(mainSource.includes('sidebar-logout'), 'logout action must live in the sidebar.');
expect(mainSource.includes('退出登录'), 'sidebar logout action should use the complete label 退出登录.');
expect(mainSource.includes('aria-label="退出登录"'), 'icon-only collapsed logout must keep an accessible name.');
expect(mainSource.includes('aria-label={`${module.moduleLabel}，${module.pages.length} 页`}'), 'collapsed module buttons must keep full accessible names.');
expect(mainSource.includes('aria-expanded={!moduleCollapsed}'), 'module buttons must expose expanded state.');
expect(mainSource.includes('aria-expanded={!groupCollapsed}'), 'page group buttons must expose expanded state.');
expect(mainSource.includes('page-menu-state'), 'page group buttons must show a visible expand/collapse state.');
expect(mainSource.includes('module-pages-collapsed'), 'collapsed modules must hide their page list.');
expect(mainSource.includes('page-menu-items-collapsed'), 'collapsed page groups must hide their function list.');
expect(!mainSource.includes('currentPage.description ? <p'), 'page descriptions must not be rendered as guidance copy in the topbar.');
expect(!mainSource.includes('<p>{page.description}</p>'), 'fallback design pages must not render page descriptions as guidance copy.');
expect(!mainSource.includes('<p>{description}</p>'), 'panels must not render description paragraphs as guidance copy.');
expect(mainSource.includes('getInitialAdminRouteState'), 'web admin must restore the active module/page from the current URL.');
expect(mainSource.includes('writeAdminRouteToLocation'), 'web admin must sync module/page changes into the URL.');
expect(mainSource.includes("window.addEventListener('hashchange'"), 'web admin must respond to hash navigation.');
expect(mainSource.includes('normalizeLoadedValue'), 'dashboard loading must normalize malformed API payloads.');
expect(mainSource.includes('Array.isArray(fallback)'), 'dashboard loading must guard list payloads before rendering.');
expect(mainSource.includes('AdminMessageHost'), 'web admin must render a global top message host for operation feedback.');
expect(mainSource.includes('AdminMessageBox'), 'web admin topbar must expose a message history box.');
expect(mainSource.includes('messageHistory'), 'web admin must keep operation message history.');
expect(mainSource.includes('setMessageHistory'), 'web admin operation messages must be written to history.');
expect(mainSource.includes("showMessage('success'"), 'web admin write operations must show success messages.');
expect(mainSource.includes("showMessage('error'"), 'web admin write operations must show failure messages.');
expect(mainSource.includes('window.setTimeout(() => dismissMessage(id), 3000)'), 'web admin messages must auto-dismiss after 3 seconds.');
expect(!mainSource.includes('window.alert'), 'web admin must use global messages instead of blocking alert dialogs.');
expect(cssSource.includes('.design-admin.sidebar-collapsed'), 'collapsed sidebar layout must be styled.');
expect(cssSource.includes('.sidebar-collapsed .design-sidebar'), 'collapsed sidebar must restyle the sidebar itself.');
expect(cssSource.includes('.sidebar-bottom'), 'sidebar bottom area must be styled for account actions.');
expect(cssSource.includes('.module-pages-collapsed'), 'sidebar module collapse must be styled.');
expect(cssSource.includes('.page-menu-items-collapsed'), 'sidebar page group collapse must be styled.');
expect(cssSource.includes('.page-menu-items.page-menu-items-collapsed'), 'page group collapsed style must override page-menu display.');
expect(cssSource.includes('.page-menu-state'), 'page group expand/collapse state must be styled.');
expect(cssSource.includes('.admin-message-stack'), 'global operation messages must be fixed at the top of the viewport.');
expect(cssSource.includes('.admin-message-success'), 'global operation messages must include a success style.');
expect(cssSource.includes('.admin-message-error'), 'global operation messages must include an error style.');
expect(cssSource.includes('.message-box-popover'), 'message history box must be styled as a topbar popover.');
expect(mainSource.includes('HomePreviewShell'), 'home configuration must provide preview modals.');
expect(mainSource.includes('HomeBannerPreview'), 'home banner configuration must support preview.');
expect(mainSource.includes('HomeSectionPreview'), 'home section configuration must support preview.');
expect(mainSource.includes('编辑配送规则'), 'delivery rules must start in read-only mode and expose an edit action.');
expect(mainSource.includes('保存配送规则'), 'delivery rules edit mode must expose save.');
expect(mainSource.includes('编辑分账规则'), 'payment split rules must start in read-only mode and expose an edit action.');
expect(mainSource.includes('保存分账规则'), 'payment split rules edit mode must expose save.');
expect(mainSource.includes('const cancelEditing = () =>'), 'rule setting edit modes must expose cancel handlers.');

const topbarMatch = mainSource.match(/<header className="topbar design-topbar">[\s\S]*?<\/header>/);
expect(Boolean(topbarMatch), 'web admin shell must keep a topbar header.');

if (topbarMatch) {
  const topbar = topbarMatch[0];
  expect(!topbar.includes('admin-account'), 'current admin details must not be rendered in the topbar.');
  expect(!topbar.includes('onClick={reload}'), 'topbar must not provide a refresh button.');
  expect(!topbar.includes('handleLogout'), 'topbar must not provide a logout button.');
  expect(!topbar.includes('刷新'), 'topbar must not show refresh copy.');
  expect(!topbar.includes('退出'), 'topbar must not show logout copy.');
  expect(!topbar.includes('status-dot'), 'topbar must not show transient operation status text.');
  expect(topbar.includes('AdminMessageBox'), 'topbar must show the message history box.');
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
