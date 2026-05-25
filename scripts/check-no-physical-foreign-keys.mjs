import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'

const root = resolve('.')
const read = (path) => readFileSync(resolve(root, path), 'utf8')
const sqlDirs = [
  'server/database/init',
  'server/database/migrations',
  'server-rust/migrations',
]

const immutableSqlxMigrations = new Set([
  // Already-applied SQLx migrations must not be rewritten; later migrations clean up final state.
  'server-rust/migrations/0001_init.sql',
])

const stripSqlComments = (source) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/--.*$/gm, '')

const sqlFiles = sqlDirs.flatMap((dir) => {
  const absoluteDir = resolve(root, dir)
  if (!existsSync(absoluteDir)) return []
  return readdirSync(absoluteDir)
    .filter((file) => extname(file) === '.sql')
    .map((file) => join(dir, file))
})

const violations = []
const schema = read('server/src/storage/database/shared/schema.ts')

if (/\.references\s*\(/.test(schema)) {
  violations.push('server/src/storage/database/shared/schema.ts contains Drizzle .references(...) definitions')
}

for (const file of sqlFiles) {
  if (immutableSqlxMigrations.has(file)) continue

  const source = stripSqlComments(read(file))
  if (/\bREFERENCES\b/i.test(source)) {
    violations.push(`${file} contains SQL REFERENCES definitions`)
  }
  if (/\bFOREIGN\s+KEY\b/i.test(source)) {
    violations.push(`${file} contains SQL FOREIGN KEY definitions`)
  }
}

const initFiles = [
  'server/database/init/01-schema.sql',
  'server-rust/migrations/0005_merchant_enterprise_no_physical_constraints.sql',
]

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

for (const file of initFiles) {
  const source = read(file)
  for (const indexName of requiredIndexes) {
    if (!source.includes(indexName)) {
      violations.push(`${file} is missing relation lookup index ${indexName}`)
    }
  }
}

if (violations.length > 0) {
  throw new Error(`Physical DB relation check failed:\n- ${violations.join('\n- ')}`)
}
