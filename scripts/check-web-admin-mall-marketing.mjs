import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');

function read(pathname) {
  return readFileSync(resolve(root, pathname), 'utf8');
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const adminMain = read('src/web-admin/main.tsx');
const mallService = read('src/services/mall.ts');
const mallHome = read('src/pages/mall/index/index.tsx');
const mallBackend = read('server/src/modules/mall.rs');
const packageJsonSource = read('package.json');
const packageJson = JSON.parse(packageJsonSource);
const migrations = readdirSync(resolve(root, 'server/migrations'))
  .filter(name => name.endsWith('.sql'))
  .map(name => read(`server/migrations/${name}`))
  .join('\n');

assert(/designPage\('mall\.couponCreate', '新增优惠券'/.test(adminMain), 'Mall admin must have a dedicated coupon creation page.');
assert(/designPage\('mall\.coupons', '优惠券列表'/.test(adminMain), 'Mall admin coupon list page must be separate from creation.');
assert(/designPage\('mall\.campaignCreate', '新增营销活动'/.test(adminMain), 'Mall admin must have a dedicated campaign creation page.');
assert(/designPage\('mall\.campaigns', '营销活动列表'/.test(adminMain), 'Mall admin campaign list page must be separate from creation.');
assert(/function MallCouponCreateSection\(/.test(adminMain), 'Web admin must render a real coupon creation section.');
assert(/function MallCouponsSection\(/.test(adminMain), 'Web admin must render a real coupon list section.');
assert(/function MallHomeBannersSection\(/.test(adminMain), 'Web admin must render a real home configuration section.');
assert(/function MallCampaignCreateSection\(/.test(adminMain), 'Web admin must render a real campaign creation section.');
assert(/function MallCampaignsSection\(/.test(adminMain), 'Web admin must render a real campaign list section.');
assert(/function MallSettingsSection\(/.test(adminMain), 'Web admin must keep operation settings separate from campaign management.');
assert(/activePageKey === 'mall\.couponCreate'[\s\S]*<MallCouponCreateSection/.test(adminMain), 'mall.couponCreate must route to MallCouponCreateSection.');
assert(/activePageKey === 'mall\.coupons'[\s\S]*<MallCouponsSection/.test(adminMain), 'mall.coupons must route to MallCouponsSection.');
assert(/activePageKey === 'mall\.banners'[\s\S]*<MallHomeBannersSection/.test(adminMain), 'mall.banners must route to MallHomeBannersSection.');
assert(/activePageKey === 'mall\.campaignCreate'[\s\S]*<MallCampaignCreateSection/.test(adminMain), 'mall.campaignCreate must route to MallCampaignCreateSection.');
assert(/activePageKey === 'mall\.campaigns'[\s\S]*<MallCampaignsSection/.test(adminMain), 'mall.campaigns must route to MallCampaignsSection.');
assert(/activePageKey === 'mall\.settings'[\s\S]*<MallSettingsSection/.test(adminMain), 'mall.settings must route to MallSettingsSection.');
assert(/apiPost\('\/api\/admin\/mall\/coupons'/.test(adminMain), 'Coupon creation must call the real admin coupon API.');
assert(/apiGet<JsonRecord\[]>\('\/api\/admin\/mall\/coupons'/.test(adminMain), 'Coupon list must load from the real admin coupon API.');
assert(/apiGet<JsonRecord\[]>\('\/api\/admin\/mall\/home-banners'/.test(adminMain), 'Home configuration must load from the real admin home banner API.');
assert(/apiPost(?:<[^>]+>)?\('\/api\/admin\/mall\/home-banners'/.test(adminMain), 'Home configuration creation must call the real admin home banner API.');
assert(/apiPut(?:<[^>]+>)?\(`\/api\/admin\/mall\/home-banners\/\$\{[^}]+\}`/.test(adminMain), 'Home configuration edit must call the real admin home banner update API.');
assert(/apiPost\('\/api\/admin\/mall\/campaigns'/.test(adminMain), 'Campaign creation must call the real admin campaign API.');
assert(/apiGet<JsonRecord\[]>\('\/api\/admin\/mall\/campaigns'/.test(adminMain), 'Campaign list must load from the real admin campaign API.');
assert(/export async function listMallHomeBanners\(\)/.test(mallService), 'Mall app service must expose the public home banner API.');
assert(/apiGet\('\/api\/mall\/home-banners'\)/.test(mallService), 'Mall app service must call the public home banner endpoint.');
assert(/listMallHomeBanners/.test(mallHome), 'Mall home page must load configured home banners.');
assert(/resolveMallImageUrl\(primaryBanner\?\.imageUrl\)/.test(mallHome), 'Mall home page must render configured banner images.');
assert(/categoryCode=\$\{encodeURIComponent\(target\)\}/.test(mallHome), 'Mall home banner category links must navigate with categoryCode.');

assert(/\/api\/admin\/mall\/coupons/.test(mallBackend), 'Backend must expose admin coupon routes.');
assert(/\/api\/admin\/mall\/home-banners/.test(mallBackend), 'Backend must expose admin home banner routes.');
assert(/\/api\/mall\/home-banners/.test(mallBackend), 'Backend must expose public mall home banner route.');
assert(/async fn admin_create_coupon/.test(mallBackend), 'Backend must implement admin_create_coupon.');
assert(/async fn admin_update_home_banner/.test(mallBackend), 'Backend must implement admin_update_home_banner.');
assert(/CREATE TABLE IF NOT EXISTS mall_coupons/.test(migrations), 'Migrations must create mall_coupons.');
assert(/CREATE TABLE IF NOT EXISTS mall_home_banners/.test(migrations), 'Migrations must create mall_home_banners.');
assert(/CREATE OR REPLACE FUNCTION coupon_json/.test(migrations), 'Migrations must define coupon_json.');
assert(/CREATE OR REPLACE FUNCTION home_banner_json/.test(migrations), 'Migrations must define home_banner_json.');

assert(
  packageJson.scripts['check:web-admin-mall-marketing'] === 'node scripts/check-web-admin-mall-marketing.mjs',
  'package.json must expose check:web-admin-mall-marketing.',
);
assert(
  packageJson.scripts.validate.includes('check:web-admin-mall-marketing'),
  'pnpm validate must include check:web-admin-mall-marketing.',
);

console.log('web admin mall marketing contract ok');
