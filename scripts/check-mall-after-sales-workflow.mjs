import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

function assertIncludes(path, expected, message) {
  const source = read(path);
  if (!source.includes(expected)) {
    throw new Error(`${message}: ${path} missing ${expected}`);
  }
}

function assertSourceIncludes(source, label, expected, message) {
  if (!source.includes(expected)) {
    throw new Error(`${message}: ${label} missing ${expected}`);
  }
}

const migrationCandidates = [
  'server/migrations/0035_mall_after_sales_workflow.sql',
  'server/migrations/0033_mall_after_sales_workflow.sql',
];
const migration = migrationCandidates.find((path) => existsSync(join(root, path)) && read(path).includes('after_sale_type'));
if (!migration) {
  throw new Error(`${migration} is required for the mall after-sales workflow`);
}
const migrationSource = read(migration);

[
  'after_sale_type',
  'selected_items',
  'requested_amount_cents',
  'approved_amount_cents',
  'solution_type',
  'negotiation_status',
  'support_session_id',
  'timeline',
].forEach((field) => assertSourceIncludes(migrationSource, migration, field, 'after-sales migration should add workflow field'));

[
  'validate_after_sale_type',
  'return_refund',
  'exchange',
  'refund_only',
  'support_session_id',
  'selected_items',
  'requested_amount_cents',
  'exchange_processing',
].forEach((field) => assertIncludes('server/src/modules/mall.rs', field, 'mall backend should expose standard after-sales workflow'));

[
  '退货退款',
  '换货',
  '仅退款',
  'getMallOrder',
  'selectedOrderItemIds',
  'requestedAmountCents',
].forEach((text) => assertIncludes('src/pages/mall/after-sale/index.tsx', text, 'mall after-sale page should use the real order workflow'));

[
  'sessionId',
  'afterSaleId',
].forEach((text) => assertIncludes('src/pages/mall/support/index.tsx', text, 'mall support page should bind to after-sale sessions'));

[
  '协商中',
  '退货中',
  '换货中',
  '售后类型',
].forEach((text) => assertIncludes('src/web-admin/main.tsx', text, 'web admin should handle after-sale workflow states'));

console.log('mall after-sales workflow check passed');
