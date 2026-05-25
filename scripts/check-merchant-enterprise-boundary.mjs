import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const demandService = readFileSync(resolve('server/src/modules/demand/demand.service.ts'), 'utf8')
const demandsService = readFileSync(resolve('server/src/modules/demands/demands.service.ts'), 'utf8')
const userRolesDto = readFileSync(resolve('server/src/modules/user-roles/dto/user-roles.dto.ts'), 'utf8')
const adminService = readFileSync(resolve('server/src/modules/admin/admin.service.ts'), 'utf8')
const schema = readFileSync(resolve('server/src/storage/database/shared/schema.ts'), 'utf8')

const assertions = [
  {
    ok: /z\.enum\(\s*\[\s*['"]owner['"]\s*,\s*['"]merchant['"]\s*,\s*['"]enterprise['"]\s*\]/.test(userRolesDto),
    message: 'User role creation must allow enterprise roles, not only owner/merchant',
  },
  {
    ok: /\[\s*['"]merchant['"]\s*,\s*['"]enterprise['"]\s*\]\.includes\(user\.role\)/.test(demandsService),
    message: 'Public demand creation must allow enterprise users as demand publishers',
  },
  {
    ok: !/const\s+merchantId\s*=/.test(demandService),
    message: 'Enterprise demand bridge must not name enterprise admin requester as merchantId',
  },
  {
    ok: !/\.eq\(\s*['"]merchant_id['"]\s*,\s*demand\.enterprise_id\s*\)/.test(demandService),
    message: 'Enterprise cancellation must not match demands.merchant_id with enterprise_id',
  },
  {
    ok: /getEnterpriseRequesterId/.test(demandService),
    message: 'Enterprise demand bridge should resolve the enterprise requester through a named helper',
  },
  {
    ok: /enterprise:\s*usersByRole\?\.filter\(u\s*=>\s*u\.role\s*===\s*['"]enterprise['"]\)/.test(adminService),
    message: 'Admin statistics must count enterprise users separately',
  },
  {
    ok: /owner\/merchant\/enterprise\/admin/.test(schema),
    message: 'Shared user schema role comment must include enterprise',
  },
]

for (const assertion of assertions) {
  if (!assertion.ok) {
    throw new Error(assertion.message)
  }
}
