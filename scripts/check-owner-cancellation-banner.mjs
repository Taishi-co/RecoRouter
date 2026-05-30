import fs from 'node:fs';

const ordersSource = fs.readFileSync('src/pages/owner/orders/index.tsx', 'utf8');
const cancellationsSource = fs.readFileSync('src/pages/owner/cancellations/index.tsx', 'utf8');

if (!/pendingCancellationCount\s*>\s*0\s*&&/.test(ordersSource)) {
  throw new Error('Owner orders cancellation banner must be gated by pendingCancellationCount > 0');
}

if (!ordersSource.includes('/api/cancellations/pending?owner_id=')) {
  throw new Error('Owner orders page must query pending cancellations for the current owner before showing the banner');
}

if (!/useDidShow\s*\(/.test(ordersSource)) {
  throw new Error('Owner orders page must refresh cancellation banner state when returning from the handling page');
}

if (!cancellationsSource.includes('/api/cancellations/pending?owner_id=')) {
  throw new Error('Owner cancellation handling page must query pending requests with an explicit owner_id query string');
}
