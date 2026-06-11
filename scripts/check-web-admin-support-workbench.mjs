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
const packageJson = JSON.parse(read('package.json'));
const supportSection = adminMain.match(/function SupportSection\([\s\S]*?\nfunction AfterSalesSection\(/)?.[0] || '';

assert(/interface SupportFilterState/.test(adminMain), 'Support workbench must define explicit filter state.');
assert(/const initialSupportFilters/.test(adminMain), 'Support workbench must define initial filters.');
assert(/filteredSupportSessions/.test(adminMain), 'Support workbench must filter support sessions.');
assert(/filteredSupportTickets/.test(adminMain), 'Support workbench must filter support tickets.');
assert(/afterSalesQueue/.test(adminMain), 'Support workbench must surface after-sales items.');
assert(/supportDashboardStats/.test(adminMain), 'Support data page must compute dashboard stats.');
assert(/designPage\('mall\.supportData', '客服数据'/.test(adminMain), 'Support data display must live on a separate page.');
assert(/designPage\('mall\.supportTickets', '客服工单'/.test(adminMain), 'Support tickets must live on a separate page.');
assert(/function SupportDataSection\(/.test(adminMain), 'Support data page must render its own section.');
assert(/function SupportTicketsSection\(/.test(adminMain), 'Support ticket page must render its own section.');
assert(/function AfterSalesSection\(/.test(adminMain), 'After-sales page must render its own section.');
assert(/function SupportKnowledgeSection\(/.test(adminMain), 'Knowledge page must render its own section.');
assert(/apiGet<JsonRecord\[]>\('\/api\/admin\/mall\/after-sales'/.test(adminMain), 'After-sales page must load real admin after-sales records.');
assert(/apiPut<JsonRecord>\(`\/api\/admin\/mall\/after-sales\/\$\{id\}`/.test(adminMain), 'After-sales page must update real after-sales records.');
assert(/messages: JsonRecord\[\]/.test(supportSection), 'SupportSection must focus on live sessions and messages.');
assert(!/knowledge: JsonRecord\[\]/.test(supportSection), 'SupportSection must not own knowledge-base data.');
assert(!/afterSales: JsonRecord\[\]/.test(supportSection), 'SupportSection must not own after-sales queue data.');
assert(!/tickets: JsonRecord\[\]/.test(supportSection), 'SupportSection must not own ticket board data.');
assert(/onViewAfterSaleOrder/.test(adminMain), 'Support workbench must allow jumping from after-sales queue to order detail.');
assert(/support-workbench/.test(adminMain), 'Support page must render a dedicated workbench layout.');
assert(/support-filterbar/.test(adminMain), 'Support page must expose filters.');
assert(/support-session-shell/.test(adminMain), 'Support page must render a two-column session/message shell.');
assert(/support-session-list/.test(adminMain), 'Support page must render a scannable session list.');
assert(/support-message-composer/.test(adminMain), 'Support page must render a dedicated message composer.');
assert(/support-context-panel/.test(adminMain), 'Support page must render customer context next to messages.');
assert(/support-after-sales/.test(adminMain), 'Support page must render after-sales queue.');
assert(/support-conversation/.test(adminMain), 'Support page must render conversation detail separately.');
assert(/support-ticket-board/.test(adminMain), 'Support page must render ticket board.');
assert(/support-knowledge-panel/.test(adminMain), 'Support page must render knowledge panel.');
assert(!/activePageKey === 'mall\.support' \|\| activePageKey === 'mall\.afterSales' \|\| activePageKey === 'mall\.knowledge'/.test(adminMain), 'Support, after-sales, and knowledge pages must not share one mixed section.');

assert(/\.support-workbench/.test(adminStyles), 'Support workbench layout CSS must exist.');
assert(/\.support-filterbar/.test(adminStyles), 'Support filter bar CSS must exist.');
assert(/\.support-session-shell/.test(adminStyles), 'Support session shell CSS must exist.');
assert(/\.support-session-list/.test(adminStyles), 'Support session list CSS must exist.');
assert(/\.support-message-composer/.test(adminStyles), 'Support message composer CSS must exist.');
assert(/\.support-context-panel/.test(adminStyles), 'Support context panel CSS must exist.');
assert(/\.support-after-sales/.test(adminStyles), 'Support after-sales queue CSS must exist.');
assert(/\.support-conversation/.test(adminStyles), 'Support conversation detail CSS must exist.');
assert(/\.support-ticket-board/.test(adminStyles), 'Support ticket board CSS must exist.');
assert(/\.support-knowledge-panel/.test(adminStyles), 'Support knowledge panel CSS must exist.');

assert(/\/api\/admin\/mall\/after-sales/.test(mallBackend), 'Backend must expose admin after-sales routes.');
assert(/async fn admin_list_after_sales/.test(mallBackend), 'Backend must implement admin_list_after_sales.');
assert(/async fn admin_update_after_sale/.test(mallBackend), 'Backend must implement admin_update_after_sale.');
assert(/validate_after_sale_status/.test(mallBackend), 'Backend must validate after-sales statuses.');

assert(
  packageJson.scripts['check:web-admin-support-workbench'] === 'node scripts/check-web-admin-support-workbench.mjs',
  'package.json must expose check:web-admin-support-workbench.',
);
assert(
  packageJson.scripts.validate.includes('check:web-admin-support-workbench'),
  'pnpm validate must include check:web-admin-support-workbench.',
);

console.log('web admin support workbench contract ok');
