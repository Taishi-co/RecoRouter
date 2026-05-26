export const getRoleLandingUrl = (role?: string) => {
  if (role === 'merchant') return '/pages/merchant/demands/publish'
  if (role === 'owner') return '/pages/owner/demands/index'
  if (role === 'admin') return '/pages/admin/users/index'
  if (role === 'enterprise_admin' || role === 'enterprise') return '/pages/enterprise/index/index'
  return '/pages/index/index'
}
