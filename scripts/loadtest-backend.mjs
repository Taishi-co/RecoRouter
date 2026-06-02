import { performance } from 'node:perf_hooks'

const DEFAULT_ENDPOINTS = [
  '/api/health',
  '/api/orders?page=1&pageSize=20',
  '/api/demands?page=1&pageSize=20',
  '/api/vehicles?page=1&pageSize=20',
]

const baseUrl = trimTrailingSlash(process.env.BACKEND_BASE_URL || 'http://127.0.0.1:34532')
const durationSeconds = readPositiveInteger('LOADTEST_DURATION_SECONDS', 30)
const concurrency = readPositiveInteger('LOADTEST_CONCURRENCY', 10)
const timeoutMs = readPositiveInteger('LOADTEST_REQUEST_TIMEOUT_MS', 5000)
const errorBackoffMs = readPositiveInteger('LOADTEST_ERROR_BACKOFF_MS', 100)
const endpoints = readEndpoints()

const startedAt = performance.now()
const deadline = startedAt + durationSeconds * 1000
let nextEndpointIndex = 0

const metrics = new Map(
  endpoints.map(endpoint => [
    endpoint,
    {
      count: 0,
      errors: 0,
      statuses: new Map(),
      latencies: [],
    },
  ]),
)

console.log(`Backend load test target: ${baseUrl}`)
console.log(
  `Duration: ${durationSeconds}s, concurrency: ${concurrency}, timeout: ${timeoutMs}ms, error backoff: ${errorBackoffMs}ms`,
)
console.log(`Endpoints: ${endpoints.join(', ')}`)

await Promise.all(Array.from({ length: concurrency }, worker))

const finishedAt = performance.now()
const elapsedSeconds = (finishedAt - startedAt) / 1000
const totals = summarizeTotals(metrics)

console.log('')
console.log('Endpoint metrics:')
for (const endpoint of endpoints) {
  printEndpointSummary(endpoint, metrics.get(endpoint), elapsedSeconds)
}

console.log('')
console.log(
  `Overall: requests=${totals.count}, errors=${totals.errors}, rps=${formatNumber(
    totals.count / elapsedSeconds,
  )}, p50=${formatNumber(percentile(totals.latencies, 50))}ms, p95=${formatNumber(
    percentile(totals.latencies, 95),
  )}ms, p99=${formatNumber(percentile(totals.latencies, 99))}ms`,
)
console.log(`Status counts: ${formatStatuses(totals.statuses)}`)

if (totals.count === 0) {
  console.error('Load test did not complete any requests. Check BACKEND_BASE_URL and server state.')
  process.exit(1)
}

if (totals.errors > 0 || hasServerError(totals.statuses)) {
  console.error('Load test observed network errors or 5xx responses.')
  process.exit(1)
}

async function worker() {
  while (performance.now() < deadline) {
    const endpoint = endpoints[nextEndpointIndex % endpoints.length]
    nextEndpointIndex += 1
    await requestEndpoint(endpoint)
  }
}

async function requestEndpoint(endpoint) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  const url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`
  const start = performance.now()

  try {
    const response = await fetch(url, { signal: controller.signal })
    const latency = performance.now() - start
    await response.arrayBuffer()
    record(endpoint, response.status, latency)
  } catch (error) {
    const latency = performance.now() - start
    record(endpoint, 'ERR', latency, true)
    await sleep(errorBackoffMs)
  } finally {
    clearTimeout(timeout)
  }
}

function record(endpoint, status, latency, error = false) {
  const item = metrics.get(endpoint)
  item.count += 1
  item.latencies.push(latency)
  item.statuses.set(status, (item.statuses.get(status) || 0) + 1)
  if (error) {
    item.errors += 1
  }
}

function readPositiveInteger(key, fallback) {
  const raw = process.env[key]
  if (!raw) return fallback
  const value = Number.parseInt(raw, 10)
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${key} must be a positive integer`)
  }
  return value
}

function readEndpoints() {
  const raw = process.env.LOADTEST_ENDPOINTS
  if (!raw) return DEFAULT_ENDPOINTS
  const parsed = raw
    .split(',')
    .map(endpoint => endpoint.trim())
    .filter(Boolean)
  if (parsed.length === 0) {
    throw new Error('LOADTEST_ENDPOINTS must contain at least one endpoint')
  }
  return parsed
}

function summarizeTotals(items) {
  const totals = {
    count: 0,
    errors: 0,
    statuses: new Map(),
    latencies: [],
  }
  for (const item of items.values()) {
    totals.count += item.count
    totals.errors += item.errors
    totals.latencies.push(...item.latencies)
    for (const [status, count] of item.statuses) {
      totals.statuses.set(status, (totals.statuses.get(status) || 0) + count)
    }
  }
  return totals
}

function printEndpointSummary(endpoint, item, elapsedSeconds) {
  console.log(
    [
      endpoint,
      `requests=${item.count}`,
      `errors=${item.errors}`,
      `rps=${formatNumber(item.count / elapsedSeconds)}`,
      `p50=${formatNumber(percentile(item.latencies, 50))}ms`,
      `p95=${formatNumber(percentile(item.latencies, 95))}ms`,
      `p99=${formatNumber(percentile(item.latencies, 99))}ms`,
      `statuses=${formatStatuses(item.statuses)}`,
    ].join(' | '),
  )
}

function percentile(values, percentileValue) {
  if (values.length === 0) return 0
  const sorted = [...values].sort((left, right) => left - right)
  const index = Math.ceil((percentileValue / 100) * sorted.length) - 1
  return sorted[Math.max(0, Math.min(sorted.length - 1, index))]
}

function hasServerError(statuses) {
  for (const status of statuses.keys()) {
    if (typeof status === 'number' && status >= 500) return true
  }
  return false
}

function formatStatuses(statuses) {
  return [...statuses.entries()]
    .sort(([left], [right]) => String(left).localeCompare(String(right)))
    .map(([status, count]) => `${status}:${count}`)
    .join(', ')
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
