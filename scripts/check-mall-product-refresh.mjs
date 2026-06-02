import { readFileSync } from 'node:fs'

const source = readFileSync('src/pages/mall/index/index.tsx', 'utf8')
const serviceSource = readFileSync('src/services/mall.ts', 'utf8')

const importsUseDidShow =
  /import\s+Taro\s*,\s*\{[^}]*\buseDidShow\b[^}]*\}\s+from\s+['"]@tarojs\/taro['"]/.test(
    source,
  )
const refreshesProductsOnShow =
  /useDidShow\s*\(\s*\(\s*\)\s*=>\s*\{[\s\S]*?loadProducts\s*\(\s*\)[\s\S]*?\}\s*\)/.test(
    source,
  )

if (!importsUseDidShow) {
  throw new Error('Mall home must import useDidShow from @tarojs/taro')
}

if (!refreshesProductsOnShow) {
  throw new Error('Mall home must load products whenever the page is shown')
}

if (!/function\s+cleanQueryData\s*\(/.test(serviceSource)) {
  throw new Error('Mall services must clean optional GET query params before requesting products')
}

if (
  !/Network\.request\s*\(\s*\{\s*url,\s*method:\s*'GET',\s*data:\s*cleanQueryData\s*\(\s*data\s*\)/.test(
    serviceSource,
  )
) {
  throw new Error('Mall GET requests must not send undefined optional params as query strings')
}
