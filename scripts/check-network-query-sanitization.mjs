import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(resolve('src/network.ts'), 'utf8')

if (!/const\s+sanitizeGetQueryData\s*=\s*\(\s*data:\s*unknown\s*\)\s*:\s*unknown\s*=>/.test(source)) {
  throw new Error('Network.request must define a GET query data sanitizer')
}

if (!/value\s*!==\s*undefined/.test(source) || !/value\s*!==\s*null/.test(source) || !/value\s*!==\s*['"]{2}/.test(source)) {
  throw new Error('GET query sanitizer must drop undefined, null, and empty-string values')
}

if (!/const\s+method\s*=\s*option\.method\s*\?\?\s*['"]GET['"]/.test(source)) {
  throw new Error('Network.request must treat an omitted method as GET')
}

if (!/method\.toUpperCase\(\)\s*===\s*['"]GET['"]/.test(source)) {
  throw new Error('Network.request must only sanitize explicit/default GET requests')
}

if (
  !/data:\s*method\.toUpperCase\(\)\s*===\s*['"]GET['"]\s*\?\s*sanitizeGetQueryData\s*\(\s*option\.data\s*\)\s*:\s*option\.data/.test(
    source,
  )
) {
  throw new Error('Network.request must leave non-GET request bodies untouched')
}

if (!/Taro\.getStorageSync\(\s*['"]token['"]\s*\)/.test(source) || !/Authorization:\s*`Bearer\s+\$\{token\}`/.test(source)) {
  throw new Error('Network.request must attach the stored bearer token to API requests')
}

if (!/header:\s*\{[\s\S]*\.\.\.authHeader\(\)[\s\S]*\.\.\.\(option\.header\s*\|\|\s*\{\}\)[\s\S]*\}/.test(source)) {
  throw new Error('Network.request must preserve caller headers after adding the bearer token')
}
