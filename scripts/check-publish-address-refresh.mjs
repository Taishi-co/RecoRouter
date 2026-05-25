import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const publishPage = resolve('src/pages/merchant/demands/publish.tsx')
const source = readFileSync(publishPage, 'utf8')

const importsUseDidShow = /import\s+Taro\s*,\s*\{[^}]*\buseDidShow\b[^}]*\}\s+from\s+['"]@tarojs\/taro['"]/.test(source)
const refreshesOnShow = /useDidShow\s*\(\s*\(\s*\)\s*=>\s*\{[\s\S]*?loadAddressData\s*\(\s*\)[\s\S]*?\}\s*\)/.test(source)
const hasUploadState = /const\s+\[\s*uploadingPhotos\s*,\s*setUploadingPhotos\s*\]\s*=\s*useState\s*\(\s*false\s*\)/.test(source)
const showsUploadLoading = /setUploadingPhotos\s*\(\s*true\s*\)[\s\S]*?Taro\.showLoading\s*\(\s*\{[\s\S]*?title:\s*['"]上传中/.test(source)
const clearsUploadLoading = /finally\s*\{[\s\S]*?Taro\.hideLoading\s*\(\s*\)[\s\S]*?setUploadingPhotos\s*\(\s*false\s*\)[\s\S]*?\}/.test(source)
const preservesFormDuringUpload = /setFormData\s*\(\s*\(\s*prev\s*\)\s*=>\s*\(\s*\{[\s\S]*?\.\.\.prev[\s\S]*?cargo_photos:\s*\[\s*\.\.\.prev\.cargo_photos\s*,\s*\.\.\.successfulUploads\s*\][\s\S]*?\}\s*\)\s*\)/.test(source)

if (!importsUseDidShow) {
  throw new Error('Publish page must import useDidShow from @tarojs/taro')
}

if (!refreshesOnShow) {
  throw new Error('Publish page must reload address data when the page is shown again')
}

if (!hasUploadState) {
  throw new Error('Publish page must track image upload loading state')
}

if (!showsUploadLoading || !clearsUploadLoading) {
  throw new Error('Publish page must show and clear an upload loading indicator')
}

if (!preservesFormDuringUpload) {
  throw new Error('Publish page must append uploaded photos with functional setFormData so addresses are preserved')
}
