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

assert(/interface SupportFilterState/.test(adminMain), 'Support workbench must define explicit filter state.');
assert(/const initialSupportFilters/.test(adminMain), 'Support workbench must define initial filters.');
assert(/filteredSupportSessions/.test(adminMain), 'Support workbench must filter support sessions.');
assert(/filteredSupportTickets/.test(adminMain), 'Support workbench must filter support tickets.');
assert(/afterSalesQueue/.test(adminMain), 'Support workbench must surface after-sales items.');
assert(/SupportSection\([\s\S]*afterSales/.test(adminMain), 'SupportSection must receive after-sales queue data.');
assert(/onViewAfterSaleOrder/.test(adminMain), 'Support workbench must allow jumping from after-sales queue to order detail.');
assert(/support-workbench/.test(adminMain), 'Support page must render a dedicated workbench layout.');
assert(/support-filterbar/.test(adminMain), 'Support page must expose filters.');
assert(/support-after-sales/.test(adminMain), 'Support page must render after-sales queue.');
assert(/support-conversation/.test(adminMain), 'Support page must render conversation detail separately.');
assert(/support-ticket-board/.test(adminMain), 'Support page must render ticket board.');
assert(/support-knowledge-panel/.test(adminMain), 'Support page must render knowledge panel.');

assert(/\.support-workbench/.test(adminStyles), 'Support workbench layout CSS must exist.');
assert(/\.support-filterbar/.test(adminStyles), 'Support filter bar CSS must exist.');
assert(/\.support-after-sales/.test(adminStyles), 'Support after-sales queue CSS must exist.');
assert(/\.support-conversation/.test(adminStyles), 'Support conversation detail CSS must exist.');
assert(/\.support-ticket-board/.test(adminStyles), 'Support ticket board CSS must exist.');
assert(/\.support-knowledge-panel/.test(adminStyles), 'Support knowledge panel CSS must exist.');

assert(
  packageJson.scripts['check:web-admin-support-workbench'] === 'node scripts/check-web-admin-support-workbench.mjs',
  'package.json must expose check:web-admin-support-workbench.',
);
assert(
  packageJson.scripts.validate.includes('check:web-admin-support-workbench'),
  'pnpm validate must include check:web-admin-support-workbench.',
);

console.log('web admin support workbench contract ok');
