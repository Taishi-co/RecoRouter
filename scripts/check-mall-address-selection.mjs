#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()

const files = {
  appConfig: read('src/app.config.ts'),
  address: read('src/pages/mall/address/index.tsx'),
  cart: read('src/pages/mall/cart/index.tsx'),
  confirm: read('src/pages/mall/confirm/index.tsx'),
}

const checks = [
  {
    name: '小程序声明用户定位和地图选点权限',
    pass: /scope\.userLocation/.test(files.appConfig)
      && /requiredPrivateInfos/.test(files.appConfig)
      && /getLocation/.test(files.appConfig)
      && /chooseLocation/.test(files.appConfig),
  },
  {
    name: '地址页支持获取定位和地图选点，并保存经纬度',
    pass: /Taro\.getLocation/.test(files.address)
      && /Taro\.chooseLocation/.test(files.address)
      && /latitude/.test(files.address)
      && /longitude/.test(files.address)
      && /createMallAddress\(\{[\s\S]*latitude[\s\S]*longitude/.test(files.address),
  },
  {
    name: '地址页选择地址会回写商城当前收货地址',
    pass: /MALL_SELECTED_ADDRESS_STORAGE_KEY/.test(files.address)
      && /Taro\.setStorageSync\(MALL_SELECTED_ADDRESS_STORAGE_KEY,\s*address\.id\)/.test(files.address)
      && /selectAddress/.test(files.address)
      && /hasAddressLocation/.test(files.address),
  },
  {
    name: '购物车读取并提交用户选中的送货地址',
    pass: /MALL_SELECTED_ADDRESS_STORAGE_KEY/.test(files.cart)
      && /Taro\.getStorageSync\(MALL_SELECTED_ADDRESS_STORAGE_KEY\)/.test(files.cart)
      && /setSelectedAddressId\(resolveSelectedAddressId/.test(files.cart)
      && /addressId:\s*selectedAddressId\s*\|\|\s*undefined/.test(files.cart),
  },
  {
    name: '购物车没有有效地址时不能进入结算',
    pass: /if \(!selectedAddress\)/.test(files.cart)
      && /请选择送货地址/.test(files.cart)
      && /\/pages\/mall\/address\/index\?select=1/.test(files.cart),
  },
  {
    name: '确认订单返回后刷新选中地址，并在支付前校验地址',
    pass: /useDidShow/.test(files.confirm)
      && /Taro\.getStorageSync\(MALL_SELECTED_ADDRESS_STORAGE_KEY\)/.test(files.confirm)
      && /if \(!address\)/.test(files.confirm)
      && /addressId:\s*address\.id/.test(files.confirm),
  },
]

const failures = checks.filter((check) => !check.pass)
if (failures.length) {
  console.error('Mall address selection checks failed:')
  for (const failure of failures) {
    console.error(`- ${failure.name}`)
  }
  process.exit(1)
}

console.log(`Mall address selection checks passed (${checks.length} checks).`)

function read(path) {
  return readFileSync(join(root, path), 'utf8')
}
