import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { performance } from 'node:perf_hooks'

const DEFAULT_BASE_URL = 'http://127.0.0.1:34532'
const DEFAULT_REPORT_DIR = 'reports/loadtest'
const DEFAULT_TIMEOUT_MS = 5000
const DEFAULT_ERROR_BACKOFF_MS = 100
const DEFAULT_MAX_ERROR_RATE = 0.01
const DEFAULT_MAX_OVERALL_P95_MS = 5000

const EXCLUDED_ROUTES = [
  'payment and transfer write routes',
  'file upload routes',
  'registration and account mutation routes',
  'captcha generation and rental expiry check routes with side effects',
  'order/demand create-cancel-confirm state transitions',
  'vehicle/admin review and update state transitions',
]

const PHASE_TEMPLATES = [
  {
    name: '01_smoke',
    durationSeconds: 30,
    concurrency: 2,
    requests: [
      get('health', '/api/health'),
      get('hello', '/api/hello'),
    ],
  },
  {
    name: '02_public_and_dashboard_reads',
    durationSeconds: 90,
    concurrency: 8,
    requests: [
      get('home_statistics', '/api/home/statistics'),
      get('home_latest_info', '/api/home/latest-info'),
      get('admin_statistics', '/api/admin/statistics'),
      get('platform_settings', '/api/platform/settings'),
      get('platform_payment_qr', '/api/platform/payment-qr'),
      get('rental_reminder_statistics', '/api/rental-reminders/statistics'),
      get('vehicles_locations', '/api/vehicles/locations'),
    ],
  },
  {
    name: '03_core_paginated_reads',
    durationSeconds: 120,
    concurrency: 10,
    requests: [
      get('orders_page_1', '/api/orders?page=1&pageSize=20'),
      get('orders_page_2', '/api/orders?page=2&pageSize=20'),
      get('orders_status_accepted', '/api/orders?status=accepted&page=1&pageSize=20'),
      get('demands_page_1', '/api/demands?page=1&pageSize=20'),
      get('demands_status_pending', '/api/demands?status=pending&page=1&pageSize=20'),
      get('vehicles_page_1', '/api/vehicles?page=1&pageSize=20'),
      get('vehicles_page_2', '/api/vehicles?page=2&pageSize=20'),
      get('admin_users_page_1', '/api/admin/users?page=1&pageSize=20'),
      get('admin_users_owners_page_1', '/api/admin/users?role=owner&page=1&pageSize=20'),
      get('admin_users_merchants_page_1', '/api/admin/users?role=merchant&page=1&pageSize=20'),
      get('admin_orders_page_1', '/api/admin/orders?page=1&pageSize=20'),
      get('admin_orders_status_completed', '/api/admin/orders?status=completed&page=1&pageSize=20'),
    ],
  },
  {
    name: '04_business_filtered_reads',
    durationSeconds: 120,
    concurrency: 10,
    requests: [
      get('orders_by_owner', '/api/orders?owner_id=${owner_id}&page=1&pageSize=20', ['owner_id']),
      get(
        'orders_by_merchant',
        '/api/orders?merchant_id=${merchant_id}&page=1&pageSize=20',
        ['merchant_id'],
      ),
      get('orders_owner_revenue', '/api/orders/owner-revenue/${owner_id}', ['owner_id']),
      get('orders_commission_summary', '/api/orders/commission-summary'),
      get('orders_commission_pending', '/api/orders/commission-pending'),
      get('order_detail', '/api/orders/${order_id}', ['order_id']),
      get('order_payment_info', '/api/orders/${order_id}/payment-info', ['order_id']),
      get('order_commission_info', '/api/orders/${order_id}/commission-info', ['order_id']),
      get('demands_by_merchant', '/api/demands?merchant_id=${merchant_id}&page=1&pageSize=20', [
        'merchant_id',
      ]),
      get('demands_merchant_stats', '/api/demands/stats/merchant?merchant_id=${merchant_id}', [
        'merchant_id',
      ]),
      get('demand_detail', '/api/demands/${demand_id}', ['demand_id']),
      get(
        'vehicles_by_owner',
        '/api/vehicles?owner_id=${owner_id}&user_id=${owner_id}&page=1&pageSize=20',
        ['owner_id'],
      ),
      get('vehicles_locations_by_owner', '/api/vehicles/locations?owner_id=${owner_id}', [
        'owner_id',
      ]),
      get('vehicle_detail', '/api/vehicles/${vehicle_id}', ['vehicle_id']),
      get('vehicle_rental_settings', '/api/vehicles/${vehicle_id}/rental-settings', ['vehicle_id']),
      get('vehicle_rental_info', '/api/rentals/vehicle/${vehicle_id}/info', ['vehicle_id']),
      get('rentals_available_vehicles', '/api/rentals/available-vehicles?user_id=${owner_id}', [
        'owner_id',
      ]),
      get('rentals_my', '/api/rentals/my?user_id=${owner_id}', ['owner_id']),
      get('rental_detail', '/api/rentals/${rental_id}', ['rental_id']),
      get('rentals_pending_for_owner', '/api/rentals/pending-for-owner?owner_id=${owner_id}', [
        'owner_id',
      ]),
      get('auth_user_info', '/api/auth/user-info?userId=${user_id}', ['user_id']),
      get('notifications_list', '/api/notifications?user_id=${user_id}&page=1&limit=20', [
        'user_id',
      ]),
      get('notifications_unread_count', '/api/notifications/unread-count?user_id=${user_id}', [
        'user_id',
      ]),
      get('address_books_list', '/api/address-books?user_id=${user_id}', ['user_id']),
      get('address_book_detail', '/api/address-books/${address_id}', ['address_id']),
      get('favorite_routes_list', '/api/favorite-routes?user_id=${user_id}', ['user_id']),
      get('favorite_route_detail', '/api/favorite-routes/${favorite_route_id}', [
        'favorite_route_id',
      ]),
      get('demand_templates_list', '/api/demand-templates?user_id=${user_id}', ['user_id']),
      get('demand_template_detail', '/api/demand-templates/${demand_template_id}', [
        'demand_template_id',
      ]),
      get('demand_schedules_list', '/api/demand-schedules?user_id=${user_id}', ['user_id']),
      get('demand_schedule_detail', '/api/demand-schedules/${demand_schedule_id}', [
        'demand_schedule_id',
      ]),
      get('demand_schedule_logs', '/api/demand-schedules/${demand_schedule_id}/logs', [
        'demand_schedule_id',
      ]),
      get('user_roles_my_roles', '/api/user-roles/my-roles?user_id=${user_id}', ['user_id']),
      get('user_roles_active', '/api/user-roles/active?user_id=${user_id}', ['user_id']),
      get('owner_wallet', '/api/owner-wallet/${owner_id}', ['owner_id']),
      get('admin_owner_withdrawals', '/api/admin/owner-withdrawals?status=pending'),
      get('cancellations_pending', '/api/cancellations/pending?owner_id=${owner_id}', ['owner_id']),
    ],
  },
  {
    name: '05_enterprise_reads',
    durationSeconds: 120,
    concurrency: 8,
    requests: [
      get('enterprise_by_admin', '/api/enterprise/admin/${enterprise_admin_id}', [
        'enterprise_admin_id',
      ]),
      get('enterprise_by_id', '/api/enterprise/${enterprise_id}', ['enterprise_id']),
      get('enterprise_stats_query', '/api/enterprise/stats?enterprise_id=${enterprise_id}', [
        'enterprise_id',
      ]),
      get('enterprise_stats_by_id', '/api/enterprise/${enterprise_id}/stats', ['enterprise_id']),
      get('station_list', '/api/station?enterpriseId=${enterprise_id}&page=1&pageSize=20', [
        'enterprise_id',
      ]),
      get('station_detail', '/api/station/${station_id}', ['station_id']),
      get('enterprise_demand_list', '/api/demand?enterpriseId=${enterprise_id}&page=1&pageSize=20', [
        'enterprise_id',
      ]),
      get(
        'enterprise_demand_pending',
        '/api/demand?enterpriseId=${enterprise_id}&status=pending&page=1&pageSize=20',
        ['enterprise_id'],
      ),
      get('enterprise_demand_stats', '/api/demand/stats/enterprise?enterprise_id=${enterprise_id}', [
        'enterprise_id',
      ]),
      get('enterprise_external_pending', '/api/demand/external/pending'),
      get(
        'enterprise_vehicle_list',
        '/api/enterprise-vehicles?enterprise_id=${enterprise_id}&page=1&pageSize=20',
        ['enterprise_id'],
      ),
      get(
        'enterprise_vehicle_internal_list',
        '/api/enterprise-vehicles?enterprise_id=${enterprise_id}&usage_mode=internal&page=1&pageSize=20',
        ['enterprise_id'],
      ),
      get('enterprise_vehicle_stats', '/api/enterprise-vehicles/stats?enterprise_id=${enterprise_id}', [
        'enterprise_id',
      ]),
      get('enterprise_vehicle_detail', '/api/enterprise-vehicles/${enterprise_vehicle_id}', [
        'enterprise_vehicle_id',
      ]),
    ],
  },
  {
    name: '06_safe_compute_posts',
    durationSeconds: 60,
    concurrency: 5,
    requests: [
      post('fare_calculate', '/api/fare/calculate', ['vehicle_id'], {
        vehicle_id: '${vehicle_id}',
        total_distance: 12,
      }),
      post('fare_calculate_multiple', '/api/fare/calculate-multiple', ['vehicle_id'], {
        vehicle_ids: ['${vehicle_id}'],
        pickup_lat: 31.2304,
        pickup_lng: 121.4737,
        delivery_lat: 30.2741,
        delivery_lng: 120.1551,
      }),
      post('fare_validate_pricing', '/api/fare/validate-pricing', [], {
        base_price: 20,
        base_distance: 3,
        price_per_km: 2,
      }),
      post('home_analyze_cargo', '/api/home/analyze-cargo', [], {
        photos: ['loadtest/non-mutating-placeholder.jpg'],
      }),
      post('demands_calculate_distance', '/api/demands/calculate-distance', [], {
        pickup_lat: 31.2304,
        pickup_lng: 121.4737,
        delivery_lat: 30.2741,
        delivery_lng: 120.1551,
      }),
      post('auth_login', '/api/auth/login', ['login_phone', 'login_password'], {
        phone: '${login_phone}',
        password: '${login_password}',
      }),
    ],
  },
]

export function buildReadinessPlan(fixtures = {}, overrides = {}) {
  const skipped = []
  const phases = PHASE_TEMPLATES.map(phase => {
    const requests = []
    for (const template of phase.requests) {
      const missing = (template.requires || []).filter(key => !hasFixture(fixtures, key))
      if (missing.length > 0) {
        skipped.push({
          name: template.name,
          method: template.method,
          path: template.path,
          reason: `missing fixture ${missing.join(', ')}`,
        })
        continue
      }
      requests.push(interpolateTemplate(template, fixtures))
    }

    return {
      name: phase.name,
      durationSeconds: phaseDuration(phase, overrides),
      concurrency: phaseConcurrency(phase, overrides),
      requests,
    }
  }).filter(phase => phase.requests.length > 0)

  return {
    phases,
    skipped,
    excluded: EXCLUDED_ROUTES,
  }
}

export function interpolateTemplate(template, fixtures) {
  return {
    name: template.name,
    method: template.method,
    path: interpolateValue(template.path, fixtures),
    expectedStatuses: template.expectedStatuses || [200],
    body: template.body === undefined ? undefined : interpolateValue(template.body, fixtures),
  }
}

export function renderMarkdownReport(report) {
  const lines = [
    `# ${report.title}`,
    '',
    `Verdict: ${report.verdict}`,
    '',
    `- Target: ${report.baseUrl}`,
    `- Started: ${report.startedAt}`,
    `- Finished: ${report.finishedAt}`,
    `- Max error rate threshold: ${formatPercent(report.thresholds.maxErrorRate)}`,
    `- Max overall p95 threshold: ${formatNumber(report.thresholds.maxOverallP95Ms)}ms`,
    '',
    '## Executive Summary',
    '',
    `- Requests: ${report.totals.requests}`,
    `- Errors: ${report.totals.errors}`,
    `- Error rate: ${formatPercent(report.totals.errorRate)}`,
    `- RPS: ${formatNumber(report.totals.rps)}`,
    `- p50: ${formatNumber(report.totals.p50)}ms`,
    `- p95: ${formatNumber(report.totals.p95)}ms`,
    `- p99: ${formatNumber(report.totals.p99)}ms`,
    '',
    '## Phase Results',
    '',
  ]

  for (const phase of report.phases) {
    lines.push(`### ${phase.name}`, '')
    lines.push(`Duration: ${phase.durationSeconds}s  `)
    lines.push(`Concurrency: ${phase.concurrency}`, '')
    lines.push('| Endpoint | Method | Requests | Errors | Statuses | RPS | p50 | p95 | p99 |')
    lines.push('| --- | --- | ---: | ---: | --- | ---: | ---: | ---: | ---: |')
    for (const metric of phase.metrics) {
      lines.push(
        `| ${metric.name}<br><code>${metric.path}</code> | ${metric.method} | ${metric.requests} | ${metric.errors} | ${formatStatusObject(metric.statuses)} | ${formatNumber(metric.rps)} | ${formatNumber(metric.p50)}ms | ${formatNumber(metric.p95)}ms | ${formatNumber(metric.p99)}ms |`,
      )
    }
    lines.push('')
  }

  lines.push('## Skipped Endpoints', '')
  if (report.skipped.length === 0) {
    lines.push('None.', '')
  } else {
    lines.push('| Endpoint | Reason |')
    lines.push('| --- | --- |')
    for (const item of report.skipped) {
      lines.push(`| ${item.name}<br><code>${item.path}</code> | ${item.reason} |`)
    }
    lines.push('')
  }

  lines.push('## Excluded From Throughput Test', '')
  for (const item of report.excluded) {
    lines.push(`- ${item}`)
  }
  lines.push('')
  lines.push('## Readiness Notes', '')
  lines.push('- Any network error or unexpected non-200 response is counted as an endpoint error.')
  lines.push('- Payment, transfer, upload, and state-changing write flows require dedicated sandbox or idempotency tests.')
  lines.push('- Public-domain results include internet and TLS latency; server-local results require running from the host or VPC.')
  lines.push('')

  return lines.join('\n')
}

export async function runReadinessLoadTest(env = process.env) {
  const baseUrl = trimTrailingSlash(env.BACKEND_BASE_URL || DEFAULT_BASE_URL)
  const timeoutMs = readPositiveInteger(env, 'LOADTEST_REQUEST_TIMEOUT_MS', DEFAULT_TIMEOUT_MS)
  const errorBackoffMs = readPositiveInteger(
    env,
    'LOADTEST_ERROR_BACKOFF_MS',
    DEFAULT_ERROR_BACKOFF_MS,
  )
  const thresholds = {
    maxErrorRate: readNumber(env, 'LOADTEST_MAX_ERROR_RATE', DEFAULT_MAX_ERROR_RATE),
    maxOverallP95Ms: readNumber(env, 'LOADTEST_MAX_OVERALL_P95_MS', DEFAULT_MAX_OVERALL_P95_MS),
  }
  const startedAt = new Date()
  const providedFixtures = envFixtures(env)
  const discovered =
    env.LOADTEST_SKIP_DISCOVERY === 'true'
      ? {}
      : await discoverFixtures(baseUrl, timeoutMs, providedFixtures)
  const fixtures = { ...discovered, ...providedFixtures }
  const plan = buildReadinessPlan(fixtures, {
    durationSeconds: optionalPositiveInteger(env, 'LOADTEST_DURATION_SECONDS'),
    concurrency: optionalPositiveInteger(env, 'LOADTEST_CONCURRENCY'),
  })

  const phases = []
  for (const phase of plan.phases) {
    console.log(`\nRunning ${phase.name}: ${phase.requests.length} endpoints, ${phase.durationSeconds}s, concurrency ${phase.concurrency}`)
    const metrics = await runPhase(baseUrl, phase, { timeoutMs, errorBackoffMs })
    phases.push({ ...phase, metrics })
  }

  const totals = summarizeReport(phases)
  const verdict =
    totals.errorRate <= thresholds.maxErrorRate && totals.p95 <= thresholds.maxOverallP95Ms
      ? 'PASS'
      : 'FAIL'
  const finishedAt = new Date()
  const report = {
    title: 'Backend Readiness Load Test',
    baseUrl,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    verdict,
    thresholds,
    fixtures: redactFixtures(fixtures),
    totals,
    phases,
    skipped: plan.skipped,
    excluded: plan.excluded,
  }

  if (env.LOADTEST_WRITE_REPORT !== 'false') {
    const paths = await writeReports(report, env.LOADTEST_REPORT_DIR || DEFAULT_REPORT_DIR)
    console.log(`\nMarkdown report: ${paths.markdown}`)
    console.log(`JSON report: ${paths.json}`)
  }

  printConsoleSummary(report)
  return report
}

async function runPhase(baseUrl, phase, options) {
  const metrics = new Map(
    phase.requests.map(request => [
      request.name,
      {
        name: request.name,
        method: request.method,
        path: request.path,
        requests: 0,
        errors: 0,
        statuses: {},
        latencies: [],
      },
    ]),
  )
  let nextRequestIndex = 0
  const started = performance.now()
  const deadline = started + phase.durationSeconds * 1000

  await Promise.all(
    Array.from({ length: phase.concurrency }, async () => {
      while (performance.now() < deadline) {
        const request = phase.requests[nextRequestIndex % phase.requests.length]
        nextRequestIndex += 1
        await executeRequest(baseUrl, request, metrics.get(request.name), options)
      }
    }),
  )

  const elapsedSeconds = Math.max((performance.now() - started) / 1000, 0.001)
  return [...metrics.values()].map(metric => finalizeMetric(metric, elapsedSeconds))
}

async function executeRequest(baseUrl, request, metric, options) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs)
  const start = performance.now()
  const init = {
    method: request.method,
    signal: controller.signal,
    headers: {},
  }
  if (request.body !== undefined) {
    init.headers['content-type'] = 'application/json'
    init.body = JSON.stringify(request.body)
  }

  try {
    const response = await fetch(`${baseUrl}${request.path}`, init)
    const latency = performance.now() - start
    await response.arrayBuffer()
    recordMetric(metric, response.status, latency, !request.expectedStatuses.includes(response.status))
  } catch (error) {
    const latency = performance.now() - start
    recordMetric(metric, 'ERR', latency, true)
    await sleep(options.errorBackoffMs)
  } finally {
    clearTimeout(timeout)
  }
}

async function discoverFixtures(baseUrl, timeoutMs, providedFixtures = {}) {
  const fixtures = { ...providedFixtures }
  await discoverFromJson(fixtures, baseUrl, '/api/admin/users?page=1&pageSize=100', timeoutMs, value => {
    const users = dataArray(value)
    const user = users.find(item => item.id)
    const owner = users.find(user => user.role === 'owner')
    const merchant = users.find(user => user.role === 'merchant')
    const enterprise = users.find(user => user.role === 'enterprise')
    if (user?.id) fixtures.user_id ||= user.id
    if (owner?.id) fixtures.owner_id ||= owner.id
    if (owner?.id) fixtures.user_id ||= owner.id
    if (merchant?.id) fixtures.merchant_id ||= merchant.id
    if (enterprise?.id) fixtures.enterprise_admin_id ||= enterprise.id
  })
  if (fixtures.enterprise_admin_id && !fixtures.enterprise_id) {
    await discoverFromJson(
      fixtures,
      baseUrl,
      `/api/enterprise/admin/${urlEncode(fixtures.enterprise_admin_id)}`,
      timeoutMs,
      value => {
        if (value?.data?.id) fixtures.enterprise_id ||= value.data.id
      },
    )
  }
  await discoverFromJson(fixtures, baseUrl, '/api/vehicles?page=1&pageSize=100', timeoutMs, value => {
    const vehicles = dataArray(value)
    const vehicle = vehicles.find(item => item.id)
    if (vehicle?.id) fixtures.vehicle_id ||= vehicle.id
    if (vehicle?.owner_id) fixtures.owner_id ||= vehicle.owner_id
    if (vehicle?.owner_id) fixtures.user_id ||= vehicle.owner_id
  })
  await discoverFromJson(fixtures, baseUrl, '/api/demands?page=1&pageSize=100', timeoutMs, value => {
    const demands = dataArray(value)
    const demand = demands.find(item => item.id)
    if (demand?.id) fixtures.demand_id ||= demand.id
    if (demand?.merchant_id) fixtures.merchant_id ||= demand.merchant_id
    if (demand?.enterprise_id) fixtures.enterprise_id ||= demand.enterprise_id
  })
  await discoverFromJson(fixtures, baseUrl, '/api/orders?page=1&pageSize=100', timeoutMs, value => {
    const orders = dataArray(value)
    const order = orders.find(item => item.id)
    if (order?.id) fixtures.order_id ||= order.id
    if (order?.owner_id) fixtures.owner_id ||= order.owner_id
    if (order?.merchant_id) fixtures.merchant_id ||= order.merchant_id
    if (order?.vehicle_id) fixtures.vehicle_id ||= order.vehicle_id
    if (order?.demand_id) fixtures.demand_id ||= order.demand_id
    if (order?.enterprise_id) fixtures.enterprise_id ||= order.enterprise_id
  })
  await discoverFromJson(fixtures, baseUrl, '/api/admin/orders?page=1&pageSize=100', timeoutMs, value => {
    const orders = dataArray(value)
    const order = orders.find(item => item.id)
    if (order?.id) fixtures.order_id ||= order.id
    if (order?.owner_id) fixtures.owner_id ||= order.owner_id
    if (order?.merchant_id) fixtures.merchant_id ||= order.merchant_id
    if (order?.vehicle_id) fixtures.vehicle_id ||= order.vehicle_id
    if (order?.demand_id) fixtures.demand_id ||= order.demand_id
  })
  if (fixtures.user_id) {
    const userId = urlEncode(fixtures.user_id)
    await discoverFromJson(fixtures, baseUrl, `/api/address-books?user_id=${userId}`, timeoutMs, value => {
      const address = dataArray(value).find(item => item.id)
      if (address?.id) fixtures.address_id ||= address.id
    })
    await discoverFromJson(
      fixtures,
      baseUrl,
      `/api/favorite-routes?user_id=${userId}`,
      timeoutMs,
      value => {
        const route = dataArray(value).find(item => item.id)
        if (route?.id) fixtures.favorite_route_id ||= route.id
      },
    )
    await discoverFromJson(
      fixtures,
      baseUrl,
      `/api/demand-templates?user_id=${userId}`,
      timeoutMs,
      value => {
        const template = dataArray(value).find(item => item.id)
        if (template?.id) fixtures.demand_template_id ||= template.id
      },
    )
    await discoverFromJson(
      fixtures,
      baseUrl,
      `/api/demand-schedules?user_id=${userId}`,
      timeoutMs,
      value => {
        const schedule = dataArray(value).find(item => item.id)
        if (schedule?.id) fixtures.demand_schedule_id ||= schedule.id
      },
    )
    await discoverFromJson(fixtures, baseUrl, `/api/rentals/my?user_id=${userId}`, timeoutMs, value => {
      const rental = rentalArray(value).find(item => item.id)
      if (rental?.id) fixtures.rental_id ||= rental.id
    })
  }
  if (fixtures.enterprise_id) {
    const enterpriseId = urlEncode(fixtures.enterprise_id)
    await discoverFromJson(
      fixtures,
      baseUrl,
      `/api/station?enterpriseId=${enterpriseId}&page=1&pageSize=100`,
      timeoutMs,
      value => {
        const station = dataArray(value).find(item => item.id)
        if (station?.id) fixtures.station_id ||= station.id
      },
    )
    await discoverFromJson(
      fixtures,
      baseUrl,
      `/api/enterprise-vehicles?enterprise_id=${enterpriseId}&page=1&pageSize=100`,
      timeoutMs,
      value => {
        const vehicle = dataArray(value).find(item => item.id)
        if (vehicle?.id) fixtures.enterprise_vehicle_id ||= vehicle.id
      },
    )
  }
  return fixtures
}

async function discoverFromJson(fixtures, baseUrl, path, timeoutMs, apply) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(`${baseUrl}${path}`, { signal: controller.signal })
    if (!response.ok) return
    apply(await response.json(), fixtures)
  } catch (error) {
    // Discovery is best effort; missing fixtures are reported as skipped endpoints.
  } finally {
    clearTimeout(timeout)
  }
}

function recordMetric(metric, status, latency, error) {
  metric.requests += 1
  metric.errors += error ? 1 : 0
  metric.statuses[status] = (metric.statuses[status] || 0) + 1
  metric.latencies.push(latency)
}

function finalizeMetric(metric, elapsedSeconds) {
  return {
    name: metric.name,
    method: metric.method,
    path: metric.path,
    requests: metric.requests,
    errors: metric.errors,
    statuses: metric.statuses,
    rps: metric.requests / elapsedSeconds,
    p50: percentile(metric.latencies, 50),
    p95: percentile(metric.latencies, 95),
    p99: percentile(metric.latencies, 99),
  }
}

function summarizeReport(phases) {
  const latencies = []
  let requests = 0
  let errors = 0
  let elapsedWeightedRps = 0
  for (const phase of phases) {
    for (const metric of phase.metrics) {
      requests += metric.requests
      errors += metric.errors
      elapsedWeightedRps += metric.rps
      latencies.push(metric.p50, metric.p95, metric.p99)
    }
  }
  return {
    requests,
    errors,
    errorRate: requests === 0 ? 1 : errors / requests,
    rps: elapsedWeightedRps,
    p50: percentile(latencies, 50),
    p95: percentile(latencies, 95),
    p99: percentile(latencies, 99),
  }
}

async function writeReports(report, reportDir) {
  const stamp = report.startedAt.replace(/[:.]/g, '-')
  const basePath = resolve(reportDir, `backend-readiness-${stamp}`)
  const jsonPath = `${basePath}.json`
  const markdownPath = `${basePath}.md`
  await mkdir(dirname(jsonPath), { recursive: true })
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  await writeFile(markdownPath, renderMarkdownReport(report), 'utf8')
  return { json: jsonPath, markdown: markdownPath }
}

function printConsoleSummary(report) {
  console.log('')
  console.log(`Verdict: ${report.verdict}`)
  console.log(
    `Overall: requests=${report.totals.requests}, errors=${report.totals.errors}, errorRate=${formatPercent(
      report.totals.errorRate,
    )}, rps=${formatNumber(report.totals.rps)}, p95=${formatNumber(report.totals.p95)}ms, p99=${formatNumber(
      report.totals.p99,
    )}ms`,
  )
  if (report.skipped.length > 0) {
    console.log(`Skipped endpoints: ${report.skipped.length}`)
  }
}

function envFixtures(env) {
  return compactObject({
    user_id: env.LOADTEST_USER_ID,
    owner_id: env.LOADTEST_OWNER_ID,
    merchant_id: env.LOADTEST_MERCHANT_ID,
    enterprise_id: env.LOADTEST_ENTERPRISE_ID,
    enterprise_admin_id: env.LOADTEST_ENTERPRISE_ADMIN_ID,
    vehicle_id: env.LOADTEST_VEHICLE_ID,
    enterprise_vehicle_id: env.LOADTEST_ENTERPRISE_VEHICLE_ID,
    demand_id: env.LOADTEST_DEMAND_ID,
    order_id: env.LOADTEST_ORDER_ID,
    rental_id: env.LOADTEST_RENTAL_ID,
    address_id: env.LOADTEST_ADDRESS_ID,
    favorite_route_id: env.LOADTEST_FAVORITE_ROUTE_ID,
    demand_template_id: env.LOADTEST_DEMAND_TEMPLATE_ID,
    demand_schedule_id: env.LOADTEST_DEMAND_SCHEDULE_ID,
    station_id: env.LOADTEST_STATION_ID,
    login_phone: env.LOADTEST_LOGIN_PHONE,
    login_password: env.LOADTEST_LOGIN_PASSWORD,
  })
}

function redactFixtures(fixtures) {
  const result = {}
  for (const [key, value] of Object.entries(fixtures)) {
    if (!value) continue
    result[key] = key.includes('password') ? '<redacted>' : value
  }
  return result
}

function get(name, path, requires = []) {
  return { name, method: 'GET', path, requires, expectedStatuses: [200] }
}

function post(name, path, requires = [], body = {}) {
  return { name, method: 'POST', path, requires, body, expectedStatuses: [200] }
}

function hasFixture(fixtures, key) {
  return typeof fixtures[key] === 'string' && fixtures[key].trim().length > 0
}

function compactObject(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => typeof item === 'string' && item.trim().length > 0),
  )
}

function interpolateValue(value, fixtures) {
  if (typeof value === 'string') {
    return value.replace(/\$\{([^}]+)\}/g, (_, key) => fixtures[key] || '')
  }
  if (Array.isArray(value)) {
    return value.map(item => interpolateValue(item, fixtures))
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, interpolateValue(item, fixtures)]),
    )
  }
  return value
}

function phaseDuration(phase, overrides) {
  return overrides.durationSeconds || phase.durationSeconds
}

function phaseConcurrency(phase, overrides) {
  return overrides.concurrency || phase.concurrency
}

function readPositiveInteger(env, key, fallback) {
  const value = optionalPositiveInteger(env, key)
  return value || fallback
}

function optionalPositiveInteger(env, key) {
  const raw = env[key]
  if (!raw) return undefined
  const value = Number.parseInt(raw, 10)
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${key} must be a positive integer`)
  }
  return value
}

function readNumber(env, key, fallback) {
  const raw = env[key]
  if (!raw) return fallback
  const value = Number.parseFloat(raw)
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${key} must be a non-negative number`)
  }
  return value
}

function dataArray(value) {
  if (Array.isArray(value?.data)) return value.data
  if (Array.isArray(value?.data?.list)) return value.data.list
  return []
}

function rentalArray(value) {
  const data = value?.data
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.list)) return data.list
  return [...(data?.as_renter || []), ...(data?.as_owner || [])]
}

function percentile(values, percentileValue) {
  const filtered = values.filter(value => Number.isFinite(value)).sort((left, right) => left - right)
  if (filtered.length === 0) return 0
  const index = Math.ceil((percentileValue / 100) * filtered.length) - 1
  return filtered[Math.max(0, Math.min(filtered.length - 1, index))]
}

function formatStatusObject(statuses) {
  return Object.entries(statuses)
    .sort(([left], [right]) => String(left).localeCompare(String(right)))
    .map(([status, count]) => `${status}:${count}`)
    .join(', ')
}

function formatPercent(value) {
  return `${formatNumber(value * 100)}%`
}

function formatNumber(value) {
  return Number.isFinite(value) ? value.toFixed(2) : '0.00'
}

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, '')
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function urlEncode(value) {
  return encodeURIComponent(value)
}

const isDirectRun = process.argv[1] ? import.meta.url === pathToFileURL(resolve(process.argv[1])).href : false

if (isDirectRun) {
  runReadinessLoadTest()
    .then(report => {
      if (report.verdict !== 'PASS') {
        process.exitCode = 1
      }
    })
    .catch(error => {
      console.error(error)
      process.exitCode = 1
    })
}
