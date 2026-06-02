import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildReadinessPlan,
  interpolateTemplate,
  renderMarkdownReport,
} from './loadtest-backend-readiness.mjs'

test('buildReadinessPlan includes safe full-readiness phases and skips missing fixtures', () => {
  const plan = buildReadinessPlan({
    owner_id: 'owner-1',
    merchant_id: 'merchant-1',
    vehicle_id: 'vehicle-1',
  })

  const included = plan.phases.flatMap(phase => phase.requests.map(request => request.name))
  const skipped = plan.skipped.map(request => request.name)

  assert.ok(included.includes('health'))
  assert.ok(included.includes('orders_page_1'))
  assert.ok(included.includes('orders_by_owner'))
  assert.ok(included.includes('fare_calculate'))
  assert.ok(included.includes('fare_validate_pricing'))
  assert.ok(skipped.includes('enterprise_demand_list'))
  assert.ok(skipped.includes('notifications_list'))
})

test('buildReadinessPlan uses backend query parameter names for fixture routes', () => {
  const plan = buildReadinessPlan({
    owner_id: 'owner-1',
    merchant_id: 'merchant-1',
    user_id: 'user-1',
    enterprise_id: 'enterprise-1',
    enterprise_admin_id: 'enterprise-admin-1',
    vehicle_id: 'vehicle-1',
    demand_id: 'demand-1',
    order_id: 'order-1',
  })

  const paths = plan.phases.flatMap(phase => phase.requests.map(request => request.path))

  assert.ok(paths.includes('/api/enterprise/stats?enterprise_id=enterprise-1'))
  assert.ok(paths.includes('/api/demand/stats/enterprise?enterprise_id=enterprise-1'))
  assert.ok(paths.includes('/api/demand/external/pending'))
  assert.ok(paths.includes('/api/cancellations/pending?owner_id=owner-1'))
})

test('buildReadinessPlan does not include destructive default routes', () => {
  const plan = buildReadinessPlan({
    owner_id: 'owner-1',
    merchant_id: 'merchant-1',
    user_id: 'user-1',
    vehicle_id: 'vehicle-1',
    enterprise_id: 'enterprise-1',
  })

  const unsafePatterns = [
    /\/api\/payments\/prepay/,
    /\/api\/owner-wallet\/bind-wechat/,
    /\/api\/auth\/register/,
    /\/api\/orders$/,
    /\/api\/demands$/,
    /\/api\/home\/upload/,
  ]

  for (const request of plan.phases.flatMap(phase => phase.requests)) {
    for (const pattern of unsafePatterns) {
      assert.equal(
        pattern.test(request.path) && request.method !== 'GET',
        false,
        `${request.name} should not be an unsafe default request`,
      )
    }
  }
})

test('interpolateTemplate replaces path and body fixture placeholders', () => {
  const result = interpolateTemplate(
    {
      name: 'fare',
      method: 'POST',
      path: '/api/fare/calculate',
      body: { vehicle_id: '${vehicle_id}', total_distance: 12 },
    },
    { vehicle_id: 'vehicle-1' },
  )

  assert.equal(result.path, '/api/fare/calculate')
  assert.deepEqual(result.body, { vehicle_id: 'vehicle-1', total_distance: 12 })
})

test('renderMarkdownReport includes readiness conclusion and skipped endpoints', () => {
  const markdown = renderMarkdownReport({
    title: 'Backend Readiness Load Test',
    baseUrl: 'https://car.shcxyz.site',
    startedAt: '2026-06-02T00:00:00.000Z',
    finishedAt: '2026-06-02T00:02:00.000Z',
    verdict: 'PASS',
    thresholds: { maxErrorRate: 0.01, maxOverallP95Ms: 5000 },
    totals: { requests: 10, errors: 0, errorRate: 0, rps: 5, p50: 100, p95: 200, p99: 300 },
    phases: [
      {
        name: 'smoke',
        durationSeconds: 30,
        concurrency: 2,
        metrics: [
          {
            name: 'health',
            method: 'GET',
            path: '/api/health',
            requests: 10,
            errors: 0,
            statuses: { 200: 10 },
            rps: 5,
            p50: 100,
            p95: 200,
            p99: 300,
          },
        ],
      },
    ],
    skipped: [{ name: 'notifications_list', reason: 'missing fixture user_id' }],
    excluded: ['payment and transfer write routes'],
  })

  assert.match(markdown, /# Backend Readiness Load Test/)
  assert.match(markdown, /Verdict: PASS/)
  assert.match(markdown, /notifications_list/)
  assert.match(markdown, /payment and transfer write routes/)
})
