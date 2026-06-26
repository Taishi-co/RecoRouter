import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
const assert = (condition, message) => {
  if (!condition) {
    console.error(`FAIL ${message}`)
    process.exitCode = 1
  } else {
    console.log(`PASS ${message}`)
  }
}

const admin = read('src/web-admin/main.tsx')
const mall = read('server/src/modules/mall.rs')
const groupBuyDetail = read('src/pages/mall/group-buy/detail.tsx')
const packageJson = JSON.parse(read('package.json'))

assert(/newProductImages:\s*string\[\]/.test(admin), 'group-buy inline product form stores uploaded image list')
assert(/newProductImageUrl:\s*string/.test(admin), 'group-buy inline product form stores primary image')
assert(/useTierPricing:\s*boolean/.test(admin), 'group-buy form has explicit tier pricing switch')
assert(/inlineProductImageForm[\s\S]*imageUrl:\s*form\.newProductImageUrl[\s\S]*images:\s*form\.newProductImages[\s\S]*ProductImageGalleryInput[\s\S]*form=\{inlineProductImageForm\}/.test(admin), 'inline product form reuses product image uploader')
assert(/onUploadImage:\s*\(file:\s*File\)\s*=>\s*Promise<string>/.test(admin), 'group-buy modal receives product image upload callback')
assert(/images:\s*form\.newProductImages/.test(admin), 'inline product payload carries uploaded images')
assert(/imageUrl:\s*form\.newProductImageUrl/.test(admin), 'inline product payload carries primary image')
assert(/checked=\{form\.useTierPricing\}/.test(admin), 'tier pricing switch is rendered')
assert(/form\.useTierPricing\s*\?\s*form\.tiers/.test(admin), 'group-buy payload only uses tiers when tier pricing is enabled')
assert(/groupBuyDefaultTier[\s\S]*createGroupBuyTierForm/.test(admin) && /form\.useTierPricing\s*\?\s*form\.tiers\s*:\s*\[groupBuyDefaultTier\(form\)\]/.test(admin), 'group-buy payload derives a default tier when tier pricing is disabled')
assert(/form\.useTierPricing\s*\?\s*'请至少配置一档阶梯价'/.test(admin) || /if\s*\(form\.useTierPricing\s*&&\s*!tiers\.length\)/.test(admin), 'missing tiers only blocks enabled tier pricing')
assert(/group_buy_only/.test(mall), 'backend recognizes group-buy-only product status')
assert(/status:\s*'group_buy_only'/.test(admin), 'inline group-buy product is created as group-buy-only')
assert(/const \[saving, setSaving\] = useState\(false\)/.test(admin), 'group-buy modal tracks submit state')
assert(/if \(saving\) return/.test(admin), 'group-buy modal blocks duplicate submits')
assert(/disabled=\{saving\}[\s\S]{0,140}type="submit"/.test(admin), 'group-buy save button is disabled while submitting')
assert(/p\.status = 'on_sale'/.test(mall), 'normal product list still filters regular on-sale products')
assert(/product\.status IN \('on_sale', 'group_buy_only'\)/.test(mall) || /is_group_buy_product_status/.test(mall), 'public group-buy queries allow group-buy-only products')
assert(/ensure_product_variant_can_sell[\s\S]*Some\("on_sale"\)/.test(mall) || /is_regular_product_status/.test(mall), 'normal cart and buy-now product validation stays on-sale only')
assert(/AS current_quantity[\s\S]{0,700}subscription\.status IN \('deposit_paid', 'pending_balance', 'balance_paid', 'order_created'\)/.test(mall), 'group-buy progress only counts deposit-paid subscriptions')
assert(!/SELECT COALESCE\(sum\(subscription\.quantity\), 0\)::integer AS current_quantity[\s\S]{0,260}subscription\.status NOT IN \(\s*'deposit_refunded'/.test(mall), 'group-buy progress does not count pending deposits')
assert(!/SELECT COALESCE\(sum\(quantity\), 0\)::integer[\s\S]{0,260}status NOT IN \(\s*'deposit_refunded'/.test(mall), 'group-buy tier estimate ignores unpaid pending deposits')
assert(/openProductDetail/.test(groupBuyDetail), 'group-buy detail has product detail navigation handler')
assert(/\/pages\/mall\/product\/index\?id=/.test(groupBuyDetail), 'group-buy detail navigates to product detail')
assert(/mall-group-buy-detail-product[\s\S]{0,120}onClick=\{openProductDetail\}/.test(groupBuyDetail), 'group-buy detail product card is clickable')
assert(packageJson.scripts['check:web-admin-group-buy-inline-product'] === 'node scripts/check-web-admin-group-buy-inline-product.mjs', 'package script exists')
assert(packageJson.scripts.validate.includes('check:web-admin-group-buy-inline-product'), 'validate includes group-buy inline product check')

if (process.exitCode) process.exit(process.exitCode)
