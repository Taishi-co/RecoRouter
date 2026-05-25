import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const demandService = readFileSync(resolve('server/src/modules/demand/demand.service.ts'), 'utf8')
const demandsService = readFileSync(resolve('server/src/modules/demands/demands.service.ts'), 'utf8')
const userRolesDto = readFileSync(resolve('server/src/modules/user-roles/dto/user-roles.dto.ts'), 'utf8')
const adminService = readFileSync(resolve('server/src/modules/admin/admin.service.ts'), 'utf8')
const schema = readFileSync(resolve('server/src/storage/database/shared/schema.ts'), 'utf8')
const rustDemands = readFileSync(resolve('server-rust/src/modules/demands.rs'), 'utf8')
const rustEnterpriseDemands = readFileSync(resolve('server-rust/src/modules/enterprise_demands.rs'), 'utf8')
const rustOrders = readFileSync(resolve('server-rust/src/modules/orders.rs'), 'utf8')

const assertions = [
  {
    ok: /z\.enum\(\s*\[\s*['"]owner['"]\s*,\s*['"]merchant['"]\s*,\s*['"]enterprise['"]\s*\]/.test(userRolesDto),
    message: 'User role creation must allow enterprise roles, not only owner/merchant',
  },
  {
    ok: /user\.role\s*!==\s*['"]merchant['"]/.test(demandsService)
      && !/\[\s*['"]merchant['"]\s*,\s*['"]enterprise['"]\s*\]\.includes\(user\.role\)/.test(demandsService),
    message: 'Nest public demand creation must only allow merchant users',
  },
  {
    ok: /role\s*!=\s*["']merchant["']/.test(rustDemands)
      && !/role\s*==\s*["']enterprise["']/.test(rustDemands),
    message: 'Rust public demand creation must only allow merchant users',
  },
  {
    ok: !/getEnterpriseRequesterId/.test(demandService),
    message: 'Nest enterprise demand bridge must not map an enterprise to a merchant requester helper',
  },
  {
    ok: !/merchant_id:\s*enterprise/.test(demandService) && !/\.eq\(\s*['"]merchant_id['"]\s*,\s*enterprise/.test(demandService),
    message: 'Nest enterprise bridge must not write or match enterprise data through merchant_id',
  },
  {
    ok: /demand_source:\s*['"]enterprise['"]/.test(demandService)
      && /enterprise_id:\s*data\.enterpriseId/.test(demandService)
      && /enterprise_demand_id:\s*demand\.id/.test(demandService),
    message: 'Nest enterprise bridge must use explicit enterprise source columns',
  },
  {
    ok: /merchant_id,\s*enterprise_id,\s*enterprise_demand_id,\s*demand_source/.test(rustEnterpriseDemands)
      && /\$1,\s*NULL,\s*\$2,\s*\$3,\s*['"]enterprise['"]/.test(rustEnterpriseDemands),
    message: 'Rust enterprise bridge must use explicit enterprise source columns and leave merchant_id empty',
  },
  {
    ok: /order_source/.test(rustOrders) && /enterprise_demand_id/.test(rustOrders),
    message: 'Rust order creation must carry merchant/enterprise source fields separately',
  },
  {
    ok: /enterprise:\s*usersByRole\?\.filter\(u\s*=>\s*u\.role\s*===\s*['"]enterprise['"]\)/.test(adminService),
    message: 'Admin statistics must count enterprise users separately',
  },
  {
    ok: /owner\/merchant\/enterprise\/admin/.test(schema),
    message: 'Shared user schema role comment must include enterprise',
  },
  {
    ok: /demand_source/.test(schema) && /enterprise_id/.test(schema) && /enterprise_demand_id/.test(schema),
    message: 'Shared schema must model enterprise-origin public demands explicitly',
  },
]

for (const assertion of assertions) {
  if (!assertion.ok) {
    throw new Error(assertion.message)
  }
}
