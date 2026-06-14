#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const files = {
  category: read('src/pages/mall/category/index.tsx'),
  home: read('src/pages/mall/index/index.tsx'),
  profile: read('src/pages/mall/profile/index.tsx'),
  address: read('src/pages/mall/address/index.tsx'),
  service: read('src/services/mall.ts'),
  serverMall: read('server/src/modules/mall.rs'),
  safeArea: read('src/lib/safe-area.ts'),
}

const checks = [
  {
    name: '商品列表顶部不展示右侧当前筛选胶囊',
    pass: !/mall-v7-head-pill/.test(files.category) && !/activeFilterLabel/.test(files.category),
  },
  {
    name: '首页顶部有品牌和定位信息，banner 在其下方',
    pass: /mall-v7-home-topbar/.test(files.home)
      && /叁友甄选/.test(files.home)
      && /MapPin/.test(files.home)
      && /<Swiper className="mall-v7-banner-swiper"/.test(files.home),
  },
  {
    name: '普通页面顶部不再跟随右上角胶囊底部下沉',
    pass: !/menuBottom \+ 20/.test(files.safeArea)
      && !/menuBottom \+ 8/.test(files.safeArea),
  },
  {
    name: '我的页支持编辑昵称和绑定或换绑手机号',
    pass: /updateMallProfile/.test(files.profile)
      && /editProfile/.test(files.profile)
      && /绑定手机号|换绑手机号/.test(files.profile)
      && /保存资料/.test(files.profile),
  },
  {
    name: '商城服务和后端提供真实会员资料更新接口',
    pass: /export async function updateMallProfile/.test(files.service)
      && /"\/api\/mall\/me\/profile"[\s\S]*get\(get_mall_profile::<S>\)\.put\(update_mall_profile::<S>\)/.test(files.serverMall)
      && /async fn update_mall_profile/.test(files.serverMall),
  },
  {
    name: '地址页用一个定位选点入口并明确必填项',
    pass: /chooseDeliveryLocation/.test(files.address)
      && /定位并选择送货位置/.test(files.address)
      && /mall-required/.test(files.address)
      && !/已记录定位/.test(files.address)
      && !/const getUserLocation/.test(files.address),
  },
]

const failures = checks.filter((check) => !check.pass)
if (failures.length) {
  console.error('Mall profile/address/layout checks failed:')
  for (const failure of failures) {
    console.error(`- ${failure.name}`)
  }
  process.exit(1)
}

console.log(`Mall profile/address/layout checks passed (${checks.length} checks).`)

function read(path) {
  return readFileSync(resolve(path), 'utf8')
}
