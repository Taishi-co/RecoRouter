import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const mallSource = readFileSync(resolve('server/src/modules/mall.rs'), 'utf8')
const migrationSource = readFileSync(resolve('server/migrations/0012_mall_product_cos_images.sql'), 'utf8')
const miniappMallServiceSource = readFileSync(resolve('src/services/mall.ts'), 'utf8')
const serverMainSource = readFileSync(resolve('server/src/main.rs'), 'utf8')
const webAdminSource = readFileSync(resolve('src/web-admin/main.tsx'), 'utf8')
const viteSource = readFileSync(resolve('web-admin/vite.config.ts'), 'utf8')
const deployWorkflowSource = readFileSync(resolve('.github/workflows/deploy-prod.yml'), 'utf8')
const installDockerSource = readFileSync(resolve('deploy/install-docker-release.sh'), 'utf8')
const makeDockerReleaseSource = readFileSync(resolve('deploy/make-docker-release.sh'), 'utf8')

if (!/regexp_replace\(image_url,\s*'\^\/assets\/'/.test(migrationSource)) {
  throw new Error('0012 migration must rewrite old /assets mall product paths to storage keys')
}

if (!/storage\.public_url\(&key\)\.await/.test(mallSource)) {
  throw new Error('mall.rs must resolve mall image storage keys through Storage::public_url')
}

if (!/starts_with\('\/'\)|starts_with\(\"\/\"\)/.test(mallSource) || !/starts_with\(\"data:\"\)/.test(mallSource) || !/starts_with\(\"blob:\"\)/.test(mallSource)) {
  throw new Error('mall image resolver must preserve legacy absolute, data, and blob image URLs')
}

if (/\/assets\/mall-products/.test(webAdminSource)) {
  throw new Error('web admin product image form must not write local /assets/mall-products paths')
}

if (!/mall-products\/kiwi\.jpeg/.test(webAdminSource) || !/mall-products\/fresh-milk\.jpeg/.test(webAdminSource)) {
  throw new Error('web admin product image form must offer COS storage keys')
}

if (!/\/api\/uploads\/\$\{imageUrl\}/.test(miniappMallServiceSource)) {
  throw new Error('miniapp mall image resolver must map bare storage keys to /api/uploads fallback URLs')
}

if (!/sync-mall-assets/.test(serverMainSource) || !/put_key\(bytes,\s*&key/.test(serverMainSource)) {
  throw new Error('server binary must provide sync-mall-assets for deterministic mall product image upload')
}

if (!/src\/assets\/mall-products/.test(deployWorkflowSource) || !/src\/assets\/mall-products/.test(makeDockerReleaseSource)) {
  throw new Error('release packaging must include mall product image assets')
}

if (!/sync-mall-assets/.test(installDockerSource) || !/\/assets\/mall-products/.test(installDockerSource)) {
  throw new Error('docker install script must sync mall product images during deployment')
}

if (/copyMallProductAssets|mallAssetsSource|mallAssetsTarget/.test(viteSource)) {
  throw new Error('web-admin Vite build must not copy local mall product images into dist-web')
}
