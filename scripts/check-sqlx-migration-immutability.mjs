import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const lockedMigrations = new Map([
  // These hashes match the migrations already recorded in production _sqlx_migrations.
  ['server/migrations/0001_init.sql', '136eab1705f9a81d3025a5b8f75b8976f9f2964e350372d4ec92fb316ea6f203'],
  ['server/migrations/0002_enterprise_dispatch_indexes.sql', '540e9998be943ca52c29ab9f29cee4dbf5d676ccd5a0894f7afb004bb290ae57'],
  ['server/migrations/0003_enterprise_legacy_dispatch_contract.sql', 'f0d57d64ee15eb9f57dc0a521a6faf4f4c8a184bae29e5f8abe50bc8faf64798'],
  ['server/migrations/0004_delivery_point_type.sql', '52ebad7b4da89011b647dd9ff0f3fe4bc1f76b03f0d8a1f785c7c3a450aeb84c'],
  ['server/migrations/0005_merchant_enterprise_no_physical_constraints.sql', '1264e4bc2182bbc98efdf88456f9c6a98fc159b1ed8b44970b45a8913a22413c'],
  ['server/migrations/0006_default_zero_commission.sql', '899ce6fbdb773842f3fb24c743e1181c2f3ea96a3e6a8b19122ba37f751d50f0'],
  ['server/migrations/0007_payments.sql', 'a035e89012ab23febb9d380b004704a0cd403c51456a3aee1336f9459dff3cae'],
  ['server/migrations/0008_owner_wallet.sql', 'e986ac9d6716fa94ef64a438cafc853fd1fc916491d06e3104f802e891736d3d'],
  ['server/migrations/0009_mall_operations_support.sql', '29c51fa01bc07118f5a235531b8b83ba88c3339e8607ac5856edb6fa4eca014a'],
  ['server/migrations/0010_seed_mall_image_products.sql', 'e78e5f519f4f748af580f1cc7618c7548e21038057d071c980b38e0fb5214b5a'],
  ['server/migrations/0011_admin_sessions.sql', 'cb338125b578e67d086b1621eb1a74d83773db999ee999275440140f229fbc80'],
  ['server/migrations/0012_mall_product_cos_images.sql', '1604768f84ddb8dd1d57b8985b4ec54c032fdf1ac517de47383364ea411662d0'],
  ['server/migrations/0013_mall_split_first_phase.sql', '99885d27ecca033a7345f6013d9d5b5fcefaa48c90c88abc566b347af71a4458'],
  ['server/migrations/0014_platform_service_foundation.sql', '2fdcd67c8306cc3b7955b14d66605dbc21a3eab666129d48c3a48ea6b33dd847'],
  ['server/migrations/0015_mall_app_backend_gaps.sql', '1d98141ff9a3a748cee9a488a37f6d2d3634c63fb19b764bf4fd37780380ac82'],
  ['server/migrations/0016_mall_product_specs.sql', 'bb6f68fd0e20c0d744caf36d620d7490792eb0ca7bf5aa6d67aa30ad1494fdbf'],
  ['server/migrations/0017_mall_real_checkout.sql', '7b1173dd9198c1d8e33c0dd23ade437c02ae3c37c491138d5a6e89a8bc89d365'],
  ['server/migrations/0018_mall_wechat_auth.sql', 'badf8c84960354cb81d35a11373fa4fc13a10f3343fb41b8e41b3f732695f7f6'],
  ['server/migrations/0019_mall_marketing_admin.sql', '752e8cf2544426320eb8a895b7c13a9578e415cd9e2c8cd011ef572f6d09b769'],
  ['server/migrations/0020_mall_v7_points_ledger.sql', '9348d78e40134a5cb40f2c558cd4348a8f93b60a69537d3b2a12b477aa8f2153'],
])

const digest = (path) =>
  createHash('sha256')
    .update(readFileSync(resolve(path)))
    .digest('hex')

const violations = []
const migrationVersions = new Map()

for (const [path, expectedHash] of lockedMigrations) {
  const actualHash = digest(path)
  if (actualHash !== expectedHash) {
    violations.push(`${path} checksum changed: expected ${expectedHash}, got ${actualHash}`)
  }
}

for (const file of readdirSync(resolve('server/migrations'))) {
  const match = file.match(/^(\d+)_.*\.sql$/)
  if (!match) {
    continue
  }
  const version = match[1]
  const existing = migrationVersions.get(version)
  if (existing) {
    violations.push(`duplicate SQLx migration version ${version}: ${existing}, ${file}`)
  } else {
    migrationVersions.set(version, file)
  }
}

if (violations.length > 0) {
  throw new Error(`Already-applied SQLx migrations must stay immutable:\n- ${violations.join('\n- ')}`)
}
