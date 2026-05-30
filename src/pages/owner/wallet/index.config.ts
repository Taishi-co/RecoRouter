export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '运力钱包' })
  : { navigationBarTitleText: '运力钱包' }
