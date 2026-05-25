import fs from 'node:fs'
import path from 'node:path'

const rootDir = process.cwd()
const appConfigPath = path.join(rootDir, 'src/app.config.ts')
const designSpecPath = path.join(rootDir, 'src/data/reco-ui-pages.json')

const appConfig = fs.readFileSync(appConfigPath, 'utf8')
const configuredPages = [
  ...new Set(
    [...appConfig.matchAll(/'([^']+)'(?:\s*,)?\s*\/\/ /g)].map((match) => match[1]),
  ),
]

if (!fs.existsSync(designSpecPath)) {
  throw new Error(`Missing UI design spec data: ${path.relative(rootDir, designSpecPath)}`)
}

const designSpec = JSON.parse(fs.readFileSync(designSpecPath, 'utf8'))
const pageSpecs = Array.isArray(designSpec.pages) ? designSpec.pages : []
const pagePaths = new Set(pageSpecs.map((page) => page.path))
const missingPages = configuredPages.filter((page) => !pagePaths.has(page))
const duplicatePages = pageSpecs
  .map((page) => page.path)
  .filter((page, index, pages) => pages.indexOf(page) !== index)

if (missingPages.length > 0 || duplicatePages.length > 0) {
  const lines = []
  if (missingPages.length > 0) {
    lines.push(`Missing UI specs for ${missingPages.length} configured page(s):`)
    lines.push(...missingPages.map((page) => `  - ${page}`))
  }
  if (duplicatePages.length > 0) {
    lines.push(`Duplicate UI specs: ${[...new Set(duplicatePages)].join(', ')}`)
  }
  throw new Error(lines.join('\n'))
}

console.log(`UI design coverage OK: ${configuredPages.length} configured pages mapped.`)
