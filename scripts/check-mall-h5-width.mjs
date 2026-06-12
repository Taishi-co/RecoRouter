import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(resolve('src/pages/mall/mall-theme.css'), 'utf8')

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const block = (selector) => {
  const match = source.match(new RegExp(`${escapeRegExp(selector)}\\s*\\{([\\s\\S]*?)\\}`))
  if (!match) {
    throw new Error(`Missing ${selector} styles`)
  }
  return match[1]
}

const shell = block('.mall-shell')
const tabbar = block('.mall-tabbar')

if (!/width:\s*100%/.test(shell) || /width:\s*390PX/.test(shell)) {
  throw new Error('Mall H5 shell must fill its parent width instead of using a fixed 390PX width')
}

if (!/max-width:\s*100%/.test(shell) || !/overflow-x:\s*hidden/.test(shell)) {
  throw new Error('Mall H5 shell must clamp and hide horizontal overflow')
}

if (!/max-width:\s*100%/.test(tabbar)) {
  throw new Error('Mall H5 tabbar must not be capped at 390PX; it should match the current screen/frame width')
}

if (!/body\.reco-mall-h5\s+\.taro_page\s*\{[\s\S]*overflow-x:\s*hidden\s*!important[\s\S]*\}/.test(source)) {
  throw new Error('Mall H5 taro_page must explicitly disable horizontal scrolling')
}

console.log('Mall H5 width checks passed.')
