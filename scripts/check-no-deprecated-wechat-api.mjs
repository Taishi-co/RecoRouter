import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = 'src'
const deprecatedPatterns = [
  {
    name: 'getSystemInfoSync',
    pattern: /\bgetSystemInfoSync\b/,
    replacement: 'getWindowInfo/getDeviceInfo/getAppBaseInfo',
  },
]
const sourceExtensions = new Set(['.js', '.jsx', '.ts', '.tsx'])

const failures = []

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    const stat = statSync(path)
    if (stat.isDirectory()) {
      walk(path)
      continue
    }

    if (!sourceExtensions.has(path.slice(path.lastIndexOf('.')))) {
      continue
    }

    const text = readFileSync(path, 'utf8')
    for (const check of deprecatedPatterns) {
      if (check.pattern.test(text)) {
        failures.push(
          `${relative('.', path)} uses deprecated wx.${check.name}; use ${check.replacement}`,
        )
      }
    }
  }
}

walk(root)

if (failures.length > 0) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log('deprecated WeChat API check passed')
