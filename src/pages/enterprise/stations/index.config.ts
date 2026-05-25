export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '奶站管理',
    })
  : { navigationBarTitleText: '奶站管理' }
