export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '三模块后台' })
  : { navigationBarTitleText: '三模块后台' }
