export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '收益统计',
      navigationBarBackgroundColor: '#0062ff',
      navigationBarTextStyle: 'white'
    })
  : {
      navigationBarTitleText: '收益统计',
      navigationBarBackgroundColor: '#0062ff',
      navigationBarTextStyle: 'white'
    }
