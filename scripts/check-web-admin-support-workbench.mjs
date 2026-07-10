import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = pathname => readFileSync(resolve(root, pathname), 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const adminMain = read('src/web-admin/main.tsx');
const adminStyles = read('src/web-admin/styles.css');
const mallSupport = read('src/pages/mall/support/index.tsx');
const mallService = read('src/services/mall.ts');
const mallBackend = read('server/src/modules/mall.rs');
const packageJson = JSON.parse(read('package.json'));
const supportSection = adminMain.match(/function SupportSection\([\s\S]*?\nfunction AfterSalesSection\(/)?.[0] || '';

assert(/function SupportSection\(/.test(adminMain), 'Admin must render a dedicated live support workbench.');
assert(/support-inbox-toolbar/.test(supportSection), 'Support workbench must expose a compact inbox toolbar.');
assert(/support-inbox-tabs/.test(supportSection), 'Support workbench must expose open, resolved, and all tabs.');
assert(/support-inbox-list/.test(supportSection), 'Support workbench must render a conversation queue.');
assert(/support-unread-badge/.test(supportSection), 'Conversation queue must surface unread customer messages.');
assert(/support-chat-card/.test(supportSection), 'Support workbench must keep the chat in the center column.');
assert(/support-customer-card/.test(supportSection), 'Support workbench must show real customer context.');
assert(/support-order-card/.test(supportSection), 'Support workbench must show the latest related order.');
assert(/onOpenOrder/.test(supportSection), 'Support workbench must open the related order.');
assert(/onOpenAfterSales/.test(supportSection), 'Support workbench must jump into after-sales handling.');
assert(/onCreateTicket/.test(supportSection), 'Support workbench must create a ticket from the current context.');
assert(/requestSubmit/.test(supportSection), 'Support composer must support Enter-to-send.');
assert(!/onCreateSession/.test(supportSection), 'Agents must not create artificial customer sessions from the inbox.');
assert(!/support-create-session/.test(supportSection), 'The live inbox must not ask agents for raw user IDs.');

for (const className of [
  'support-inbox-toolbar',
  'support-inbox-tabs',
  'support-inbox-layout',
  'support-inbox-row',
  'support-unread-badge',
  'support-chat-card',
  'support-customer-card',
  'support-order-card',
]) {
  assert(adminStyles.includes(`.${className}`), `Missing support workbench style: ${className}.`);
}

for (const endpoint of [
  '/api/admin/mall/support/sessions',
  '/api/admin/mall/support/tickets',
  '/api/admin/mall/support/knowledge',
  '/api/admin/mall/support/metrics',
]) {
  assert(adminMain.includes(endpoint), `Web admin must use protected endpoint ${endpoint}.`);
  assert(mallBackend.includes(endpoint), `Backend must expose protected endpoint ${endpoint}.`);
}
assert(/async fn admin_list_support_sessions/.test(mallBackend), 'Backend must provide enriched admin sessions.');
assert(/'customer', jsonb_build_object/.test(mallBackend), 'Admin session payload must include customer identity.');
assert(/'recentOrder', recent_order\.payload/.test(mallBackend), 'Admin session payload must include a recent related order.');
assert(/'unreadCount'/.test(mallBackend) && /'waitingMinutes'/.test(mallBackend), 'Admin sessions must include queue priority signals.');
assert(/require_non_empty\(query\.user_id, "用户ID不能为空"\)/.test(mallBackend), 'Public support lists must require a user ID.');
assert(/ensure_support_session_owner/.test(mallBackend), 'Public support messages must verify session ownership.');
assert(/用户端不能发送客服坐席消息/.test(mallBackend), 'Public users must not spoof agent replies.');
assert(/upload_support_evidence/.test(mallBackend), 'Backend must persist real support evidence uploads.');

assert(/uploadSupportEvidence/.test(mallSupport) && /evidenceImages/.test(mallSupport), 'Customer support must upload and render real evidence images.');
assert(/Network\.uploadFile/.test(mallService), 'Support evidence must use the shared upload transport.');
assert(/listSupportMessages\(session\.id, userId\)/.test(mallSupport), 'Customer message reads must include ownership context.');
assert(/}, 4000\)/.test(mallSupport), 'Customer chat polling must use a reasonable interval.');
assert(/document\.visibilityState === 'hidden'/.test(adminMain), 'Admin polling must pause while the tab is hidden.');
assert(/}, 5000\)/.test(adminMain), 'Admin polling must avoid one-second request pressure.');

assert(/function SupportDataSection\(/.test(adminMain), 'Support metrics must stay on a separate page.');
assert(/function SupportTicketsSection\(/.test(adminMain), 'Support tickets must stay on a separate page.');
assert(/function AfterSalesSection\(/.test(adminMain), 'After-sales handling must stay on a separate page.');
assert(/function SupportKnowledgeSection\(/.test(adminMain), 'Knowledge management must stay on a separate page.');

assert(
  packageJson.scripts['check:web-admin-support-workbench'] === 'node scripts/check-web-admin-support-workbench.mjs',
  'package.json must expose check:web-admin-support-workbench.',
);
assert(
  packageJson.scripts.validate.includes('check:web-admin-support-workbench'),
  'pnpm validate must include check:web-admin-support-workbench.',
);

console.log('web admin support workbench contract ok');
