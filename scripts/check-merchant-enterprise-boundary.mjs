import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const demandsModule = readFileSync(resolve('server/src/modules/demands.rs'), 'utf8')
const enterpriseDemandsModule = readFileSync(resolve('server/src/modules/enterprise_demands.rs'), 'utf8')
const userRolesModule = readFileSync(resolve('server/src/modules/user_roles.rs'), 'utf8')
const adminModule = readFileSync(resolve('server/src/modules/admin.rs'), 'utf8')
const enterpriseMigration = readFileSync(
  resolve('server/migrations/0005_merchant_enterprise_no_physical_constraints.sql'),
  'utf8',
)
const validateRoleSource = userRolesModule.match(/fn validate_role[\s\S]*?\n}/)?.[0] || ''

const assertions = [
  {
    ok: ['owner', 'merchant', 'enterprise'].every((role) => validateRoleSource.includes(`"${role}"`)),
    message: 'User role creation must allow enterprise roles, not only owner/merchant',
  },
  {
    ok: /role\s*!=\s*"merchant"/.test(demandsModule)
      && !/matches!\(\s*role\.as_str\(\),\s*"merchant"\s*\|\s*"enterprise"\s*\)/.test(demandsModule),
    message: 'Merchant demand creation must only allow merchant users',
  },
  {
    ok: !/get_enterprise_requester_id/.test(demandsModule),
    message: 'Enterprise demand logic must not map an enterprise to a merchant requester helper',
  },
  {
    ok: !/WHERE\s+merchant_id\s*=/i.test(enterpriseDemandsModule)
      && !/WHERE\s+merchant_id\s+IN/i.test(enterpriseDemandsModule)
      && !/merchant_id\s*=\s*enterprise_id/i.test(enterpriseDemandsModule),
    message: 'Enterprise public-demand bridge must not write or match enterprise data through merchant_id',
  },
  {
    ok: /demand_source/.test(enterpriseDemandsModule)
      && /'enterprise'/.test(enterpriseDemandsModule)
      && /enterprise_id/.test(enterpriseDemandsModule)
      && /enterprise_demand_id/.test(enterpriseDemandsModule),
    message: 'Enterprise public-demand bridge must use explicit enterprise source columns',
  },
  {
    ok: /"enterprise":\s*user_rows\.iter\(\)\.filter/.test(adminModule),
    message: 'Admin statistics must count enterprise users separately',
  },
  {
    ok: /demand_source/.test(enterpriseMigration)
      && /enterprise_id/.test(enterpriseMigration)
      && /enterprise_demand_id/.test(enterpriseMigration),
    message: 'Migrations must model enterprise-origin public demands explicitly',
  },
]

for (const assertion of assertions) {
  if (!assertion.ok) {
    throw new Error(assertion.message)
  }
}
