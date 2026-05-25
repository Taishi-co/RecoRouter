import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const lockedMigrations = new Map([
  // These hashes match the migrations already recorded in production _sqlx_migrations.
  ['server/migrations/0001_init.sql', '136eab1705f9a81d3025a5b8f75b8976f9f2964e350372d4ec92fb316ea6f203'],
  ['server/migrations/0002_enterprise_dispatch_indexes.sql', '540e9998be943ca52c29ab9f29cee4dbf5d676ccd5a0894f7afb004bb290ae57'],
  ['server/migrations/0003_enterprise_legacy_dispatch_contract.sql', 'f0d57d64ee15eb9f57dc0a521a6faf4f4c8a184bae29e5f8abe50bc8faf64798'],
  ['server/migrations/0004_delivery_point_type.sql', '52ebad7b4da89011b647dd9ff0f3fe4bc1f76b03f0d8a1f785c7c3a450aeb84c'],
])

const digest = (path) =>
  createHash('sha256')
    .update(readFileSync(resolve(path)))
    .digest('hex')

const violations = []

for (const [path, expectedHash] of lockedMigrations) {
  const actualHash = digest(path)
  if (actualHash !== expectedHash) {
    violations.push(`${path} checksum changed: expected ${expectedHash}, got ${actualHash}`)
  }
}

if (violations.length > 0) {
  throw new Error(`Already-applied SQLx migrations must stay immutable:\n- ${violations.join('\n- ')}`)
}
