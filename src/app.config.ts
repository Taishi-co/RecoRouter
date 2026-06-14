const miniAppPages = [
  'pages/index/index',                    // 登录/注册页面（默认首页）
  'pages/enterprise/index/index',        // 企业端-首页
  'pages/enterprise/dispatch/index',     // 企业端-调度中心
  'pages/enterprise/dispatch/detail/index', // 企业端-配送详情
  'pages/enterprise/fleet/index',        // 企业端-车队管理
  'pages/enterprise/fleet/detail/index', // 企业端-车辆详情
  'pages/enterprise/stations/index',     // 企业端-奶站管理
  'pages/enterprise/stats/index',        // 企业端-数据统计
  'pages/enterprise/publish/index',      // 企业端-发布配送
  'pages/enterprise/order-hall/index',   // 企业端-接单大厅
  'pages/owner/vehicles/index',          // 车主端-车辆管理
  'pages/owner/vehicles/rental-settings/index', // 车主端-车辆租赁设置
  'pages/owner/vehicle-mock-demo/index', // 车主端-车机模拟数据Demo
  'pages/owner/vehicle-map/index',       // 车主端-车辆位置地图
  'pages/owner/demands/index',           // 车主端-需求列表
  'pages/owner/accept-order/index',      // 车主端-确认接单
  'pages/owner/orders/index',            // 车主端-订单管理
  'pages/owner/cancellations/index',     // 车主端-处理取消申请
  'pages/owner/commission-payment/index',// 车主端-佣金支付
  'pages/owner/stats/index',             // 车主端-统计
  'pages/owner/wallet/index',            // 车主端-运力钱包
  'pages/owner/profile/index',           // 车主端-我的
  'pages/owner/profile/revenue-stats/index', // 车主端-收益统计
  'pages/owner/account-settings/index',  // 车主端-账号设置
  'pages/owner/profile-edit/index',      // 车主端-个人信息编辑
  'pages/owner/change-phone/index',      // 车主端-修改手机号
  'pages/owner/change-password/index',   // 车主端-修改密码
  'pages/merchant/demands/index',        // 需求方端-发布需求
  'pages/merchant/demands/publish',      // 需求方端-发布需求表单
  'pages/merchant/demands/list',         // 需求方端-需求列表
  'pages/merchant/demands/edit',         // 需求方端-编辑需求
  'pages/merchant/demands/templates',    // 需求方端-常用模板
  'pages/merchant/demands/schedules',    // 需求方端-定时计划
  'pages/merchant/orders/index',         // 需求方端-订单管理
  'pages/merchant/payment/index',        // 需求方端-付款
  'pages/merchant/address-books/index',  // 需求方端-地址簿
  'pages/merchant/favorite-routes/index',// 需求方端-常用线路
  'pages/merchant/route-map/index',      // 线路地图显示
  'pages/merchant/stats/index',          // 需求方端-统计
  'pages/merchant/profile/index',        // 需求方端-我的
  'pages/merchant/rentals/index',        // 需求方端-租车大厅
  'pages/merchant/rentals/detail',       // 需求方端-车辆详情
  'pages/mall/index/index',              // 商城-首页
  'pages/mall/category/index',           // 商城-分类搜索
  'pages/mall/product/index',            // 商城-商品详情
  'pages/mall/pickup/index',             // 商城-送货地址兼容跳转
  'pages/mall/cart/index',               // 商城-购物车/结算/地址
  'pages/mall/confirm/index',            // 商城-确认订单
  'pages/mall/address/index',            // 商城-收货地址
  'pages/mall/payment-success/index',    // 商城-支付成功
  'pages/mall/orders/index',             // 商城-订单/支付/售后/追踪
  'pages/mall/order-detail/index',       // 商城-订单详情
  'pages/mall/after-sale/index',         // 商城-售后申请
  'pages/mall/support/index',            // 商城-客服中心
  'pages/mall/auth/index',               // 商城-登录注册
  'pages/mall/profile/index',            // 商城-我的
  'pages/mall/group-leader/index',       // 商城-我的兼容跳转
  'pages/mall/community/index',          // 商城-社区动态
  'pages/mall/settings/index',           // 商城-消息与设置
  'pages/owner/rentals/pending/index',   // 运力方端-待确认租赁
  'pages/role-switch/index',             // 角色管理
  'pages/rentals-history/index',         // 我的租赁记录
  'pages/notifications/index',           // 通知消息列表
  'pages/admin/console/index',           // Web管理端-三模块控制台
  'pages/admin/users/index',             // 运营端-用户管理
  'pages/admin/vehicles/index',          // 运营端-车辆审核
  'pages/admin/mall/index',              // 运营端-商城运营
  'pages/admin/support/index',           // 运营端-客服工作台
  'pages/admin/orders/index',            // 运营端-订单管理
  'pages/admin/commission/index',        // 运营端-佣金审核
  'pages/admin/stats/index',             // 运营端-数据统计
  'pages/admin/settings/index',          // 运营端-设置
]

const vehiclePages = [
  'pages/index/index',                    // 锐途运力-首页登录与角色选择
  'pages/enterprise/index/index',        // 企业端-首页
  'pages/enterprise/dispatch/index',     // 企业端-调度中心
  'pages/enterprise/dispatch/detail/index', // 企业端-配送详情
  'pages/enterprise/fleet/index',        // 企业端-车队管理
  'pages/enterprise/fleet/detail/index', // 企业端-车辆详情
  'pages/enterprise/stations/index',     // 企业端-奶站管理
  'pages/enterprise/stats/index',        // 企业端-数据统计
  'pages/enterprise/publish/index',      // 企业端-发布配送
  'pages/enterprise/order-hall/index',   // 企业端-接单大厅
  'pages/owner/vehicles/index',          // 车主端-车辆管理
  'pages/owner/vehicles/rental-settings/index', // 车主端-车辆租赁设置
  'pages/owner/vehicle-mock-demo/index', // 车主端-车机模拟数据Demo
  'pages/owner/vehicle-map/index',       // 车主端-车辆位置地图
  'pages/owner/demands/index',           // 车主端-需求列表
  'pages/owner/accept-order/index',      // 车主端-确认接单
  'pages/owner/orders/index',            // 车主端-订单管理
  'pages/owner/cancellations/index',     // 车主端-处理取消申请
  'pages/owner/commission-payment/index',// 车主端-佣金支付
  'pages/owner/stats/index',             // 车主端-统计
  'pages/owner/wallet/index',            // 车主端-运力钱包
  'pages/owner/profile/index',           // 车主端-我的
  'pages/owner/profile/revenue-stats/index', // 车主端-收益统计
  'pages/owner/account-settings/index',  // 车主端-账号设置
  'pages/owner/profile-edit/index',      // 车主端-个人信息编辑
  'pages/owner/change-phone/index',      // 车主端-修改手机号
  'pages/owner/change-password/index',   // 车主端-修改密码
  'pages/merchant/demands/index',        // 需求方端-发布需求
  'pages/merchant/demands/publish',      // 需求方端-发布需求表单
  'pages/merchant/demands/list',         // 需求方端-需求列表
  'pages/merchant/demands/edit',         // 需求方端-编辑需求
  'pages/merchant/demands/templates',    // 需求方端-常用模板
  'pages/merchant/demands/schedules',    // 需求方端-定时计划
  'pages/merchant/orders/index',         // 需求方端-订单管理
  'pages/merchant/payment/index',        // 需求方端-付款
  'pages/merchant/address-books/index',  // 需求方端-地址簿
  'pages/merchant/favorite-routes/index',// 需求方端-常用线路
  'pages/merchant/route-map/index',      // 线路地图显示
  'pages/merchant/stats/index',          // 需求方端-统计
  'pages/merchant/profile/index',        // 需求方端-我的
  'pages/merchant/rentals/index',        // 需求方端-租车大厅
  'pages/merchant/rentals/detail',       // 需求方端-车辆详情
  'pages/owner/rentals/pending/index',   // 运力方端-待确认租赁
  'pages/role-switch/index',             // 角色管理
  'pages/rentals-history/index',         // 我的租赁记录
  'pages/notifications/index',           // 通知消息列表
]

const mallPages = [
  'pages/mall/index/index',              // 商城-首页
  'pages/mall/category/index',           // 商城-分类搜索
  'pages/mall/product/index',            // 商城-商品详情
  'pages/mall/pickup/index',             // 商城-送货地址兼容跳转
  'pages/mall/cart/index',               // 商城-购物车/结算/地址
  'pages/mall/confirm/index',            // 商城-确认订单
  'pages/mall/address/index',            // 商城-收货地址
  'pages/mall/payment-success/index',    // 商城-支付成功
  'pages/mall/orders/index',             // 商城-订单/支付/售后/追踪
  'pages/mall/order-detail/index',       // 商城-订单详情
  'pages/mall/after-sale/index',         // 商城-售后申请
  'pages/mall/support/index',            // 商城-客服中心
  'pages/mall/auth/index',               // 商城-登录注册
  'pages/mall/profile/index',            // 商城-我的
  'pages/mall/group-leader/index',       // 商城-我的兼容跳转
  'pages/mall/community/index',          // 商城-社区动态
  'pages/mall/settings/index',           // 商城-消息与设置
]

const adminPages = [
  'pages/admin/console/index',           // Web管理端-三模块控制台
  'pages/admin/users/index',             // 运营端-用户管理
  'pages/admin/vehicles/index',          // 运营端-车辆审核
  'pages/admin/mall/index',              // 运营端-商城运营
  'pages/admin/support/index',           // 运营端-客服工作台
  'pages/admin/orders/index',            // 运营端-订单管理
  'pages/admin/commission/index',        // 运营端-佣金审核
  'pages/admin/stats/index',             // 运营端-数据统计
  'pages/admin/settings/index',          // 运营端-设置
]

type AppProfile = 'vehicle' | 'mall' | 'admin' | 'all'

const profileAlias: Record<string, AppProfile> = {
  vehicle: 'vehicle',
  mall: 'mall',
  admin: 'admin',
  all: 'all',
  full: 'all',
}

const rawProfile = typeof APP_PROFILE === 'string' ? APP_PROFILE.trim() : 'all'
const appProfile = profileAlias[rawProfile] || 'all'

const pagesByProfile: Record<AppProfile, string[]> = {
  vehicle: vehiclePages,
  mall: mallPages,
  admin: adminPages,
  all: miniAppPages,
}

const navigationTitleByProfile: Record<AppProfile, string> = {
  vehicle: '锐途运力',
  mall: '叁友甄选',
  admin: 'Reco Console',
  all: '无人车共享运营平台',
}

const appConfig = {
  pages: pagesByProfile[appProfile],
  window: {
    backgroundTextStyle: 'light' as const,
    navigationStyle: 'custom' as const,
    navigationBarBackgroundColor: '#ffffff',
    navigationBarTitleText: navigationTitleByProfile[appProfile],
    navigationBarTextStyle: 'black' as const,
  },
  permission: {
    'scope.userLocation': {
      desc: '用于选择送货地址并计算配送范围',
    },
  },
  requiredPrivateInfos: ['getLocation', 'chooseLocation'] as Array<'getLocation' | 'chooseLocation'>,
}

export default typeof defineAppConfig === 'function'
  ? defineAppConfig(appConfig)
  : appConfig
