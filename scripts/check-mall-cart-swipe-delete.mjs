#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()

const files = {
  cart: read('src/pages/mall/cart/index.tsx'),
  theme: read('src/pages/mall/mall-theme.css'),
  packageJson: read('package.json'),
}

const checks = [
  {
    name: '购物车商品行监听左滑手势',
    pass: /swipedCartItemId/.test(files.cart)
      && /handleCartItemTouchStart/.test(files.cart)
      && /handleCartItemTouchMove/.test(files.cart)
      && /handleCartItemTouchEnd/.test(files.cart)
      && /onTouchStart=/.test(files.cart)
      && /onTouchMove=/.test(files.cart),
  },
  {
    name: '左滑后露出单个商品删除操作',
    pass: /mall-v7-cart-swipe/.test(files.cart)
      && /mall-v7-cart-delete-action/.test(files.cart)
      && /mall-v7-cart-item-swiped/.test(files.cart)
      && /删除/.test(files.cart),
  },
  {
    name: '删除商品前必须二次确认',
    pass: /confirmDeleteCartItem/.test(files.cart)
      && /Taro\.showModal/.test(files.cart)
      && /确认删除吗/.test(files.cart)
      && /confirmColor:\s*['"]#D14343['"]/.test(files.cart),
  },
  {
    name: '确认后调用真实购物车删除接口并刷新',
    pass: /deleteMallCartItem\(item\.id\)/.test(files.cart)
      && /loadData\(\)/.test(files.cart)
      && /已删除/.test(files.cart),
  },
  {
    name: '样式为 iPhone 风格的右侧红色删除滑层',
    pass: /\.mall-v7-cart-swipe/.test(files.theme)
      && /\.mall-v7-cart-delete-action/.test(files.theme)
      && /background:\s*#d14343/.test(files.theme)
      && /translateX\(-76PX\)/.test(files.theme)
      && /transition:\s*transform/.test(files.theme),
  },
  {
    name: '校验脚本纳入 validate',
    pass: /"check:mall-cart-swipe-delete": "node scripts\/check-mall-cart-swipe-delete\.mjs"/.test(files.packageJson)
      && /check:mall-cart-swipe-delete/.test(JSON.parse(files.packageJson).scripts.validate),
  },
]

const failures = checks.filter((check) => !check.pass)
if (failures.length) {
  console.error('Mall cart swipe delete checks failed:')
  for (const failure of failures) {
    console.error(`- ${failure.name}`)
  }
  process.exit(1)
}

console.log(`Mall cart swipe delete checks passed (${checks.length} checks).`)

function read(path) {
  return readFileSync(join(root, path), 'utf8')
}
