import { readdirSync, readFileSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'

const root = resolve('.')

const read = (path) => readFileSync(resolve(root, path), 'utf8')

const stripSqlComments = (source) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/--.*$/gm, '')

const sqlFiles = [
  ...readdirSync(resolve(root, 'server/migrations'))
    .filter((file) => extname(file) === '.sql')
    .map((file) => join('server/migrations', file)),
]

const violations = []
const historicalPhysicalFkMigrationExceptions = new Set([
  // Already applied in production; 0036 drops these constraints without
  // mutating the SQLx migration history.
  'server/migrations/0026_vehicle_trips.sql',
])

for (const file of sqlFiles.filter((file) => !file.endsWith('0001_init.sql'))) {
  if (historicalPhysicalFkMigrationExceptions.has(file)) {
    continue
  }

  const source = stripSqlComments(read(file))
  if (/\bREFERENCES\b/i.test(source)) {
    violations.push(`${file} contains SQL REFERENCES physical FK definitions`)
  }
  if (/\bFOREIGN\s+KEY\b/i.test(source)) {
    violations.push(`${file} contains SQL FOREIGN KEY physical FK definitions`)
  }
}

const vehicleTripsFkCleanup = 'server/migrations/0036_drop_vehicle_trips_physical_fks.sql'
if (!sqlFiles.includes(vehicleTripsFkCleanup)) {
  violations.push(`${vehicleTripsFkCleanup} must remove the historical vehicle trip physical FK constraints`)
} else {
  const cleanupSource = stripSqlComments(read(vehicleTripsFkCleanup))
  for (const constraintName of [
    'trip_stops_trip_id_fkey',
    'trip_stops_mall_order_id_fkey',
    'mall_orders_trip_id_fkey',
  ]) {
    if (!new RegExp(`DROP\\s+CONSTRAINT\\s+IF\\s+EXISTS\\s+${constraintName}`, 'i').test(cleanupSource)) {
      violations.push(`${vehicleTripsFkCleanup} must drop ${constraintName}`)
    }
  }
}

const migrationSql = sqlFiles.map((file) => read(file)).join('\n')
const requiredIndexes = [
  'demands_merchant_id_idx',
  'demands_owner_id_idx',
  'demands_enterprise_id_idx',
  'demands_enterprise_demand_id_idx',
  'orders_demand_id_idx',
  'orders_vehicle_id_idx',
  'orders_merchant_id_idx',
  'orders_owner_id_idx',
  'orders_enterprise_id_idx',
  'orders_enterprise_demand_id_idx',
  'vehicles_owner_id_idx',
  'vehicles_current_renter_id_idx',
  'enterprises_admin_id_idx',
  'dairy_stations_enterprise_id_idx',
  'enterprise_demands_enterprise_id_idx',
]

for (const indexName of requiredIndexes) {
  if (!migrationSql.includes(indexName)) {
    violations.push(`server/migrations is missing relation lookup index ${indexName}`)
  }
}

if (violations.length > 0) {
  throw new Error(`Physical FK check failed:\n- ${violations.join('\n- ')}`)
}
