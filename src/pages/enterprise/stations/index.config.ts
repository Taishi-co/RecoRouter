export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '配送点管理',
    })
  : { navigationBarTitleText: '配送点管理' }
