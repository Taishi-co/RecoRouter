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

assert(!/designPage\('mall\.couponCreate'/.test(adminMain), 'Mall admin coupon creation must be folded into coupon center, not a separate page.');
assert(/designPage\('mall\.coupons', '券中心'/.test(adminMain), 'Mall admin coupon page must be renamed to coupon center.');
assert(!/designPage\('mall\.campaignCreate'/.test(adminMain), 'Mall admin campaign creation must be folded into campaign list, not a separate page.');
assert(/designPage\('mall\.campaigns', '营销活动'/.test(adminMain), 'Mall admin campaign page must be a single searchable activity list.');
assert(/function MallCouponCenterSection\(/.test(adminMain), 'Web admin must render a real coupon center section.');
assert(/function MallHomeBannersSection\(/.test(adminMain), 'Web admin must render a real home configuration section.');
assert(/designPage\('mall\.banners', '轮播广告位'/.test(adminMain), 'Mall admin must expose carousel banner configuration.');
assert(/designPage\('mall\.homeNotices', '公告栏配置'/.test(adminMain), 'Mall admin must expose homepage notice configuration.');
assert(/designPage\('mall\.homeFlashSale', '秒杀专区'/.test(adminMain), 'Mall admin must expose flash-sale homepage section configuration.');
assert(/designPage\('mall\.homeNewArrivals', '新上专区'/.test(adminMain), 'Mall admin must expose new-arrival homepage section configuration.');
assert(/designPage\('mall\.homeHotProducts', '爆款推荐'/.test(adminMain), 'Mall admin must expose hot-product homepage section configuration.');
assert(/function MallHomeSectionsSection\(/.test(adminMain), 'Web admin must render real homepage section configuration pages.');
assert(/function MallCampaignsSection\(/.test(adminMain), 'Web admin must render a real campaign list section.');
assert(/function MallSettingsSection\(/.test(adminMain), 'Web admin must keep operation settings separate from campaign management.');
assert(/activePageKey === 'mall\.coupons'[\s\S]*<MallCouponCenterSection/.test(adminMain), 'mall.coupons must route to MallCouponCenterSection.');
assert(/activePageKey === 'mall\.banners'[\s\S]*<MallHomeBannersSection/.test(adminMain), 'mall.banners must route to MallHomeBannersSection.');
assert(/homeSectionPageConfigs\[activePageKey\][\s\S]*<MallHomeSectionsSection/.test(adminMain), 'Homepage section pages must route to MallHomeSectionsSection.');
assert(/activePageKey === 'mall\.campaigns'[\s\S]*<MallCampaignsSection/.test(adminMain), 'mall.campaigns must route to MallCampaignsSection.');
assert(/activePageKey === 'mall\.settings'[\s\S]*<MallSettingsSection/.test(adminMain), 'mall.settings must route to MallSettingsSection.');
assert(/apiPost(?:<[^>]+>)?\('\/api\/admin\/mall\/coupons'/.test(adminMain), 'Coupon creation must call the real admin coupon API.');
assert(/apiPut<JsonRecord>\(`\/api\/admin\/mall\/coupons\/\$\{[^}]+\}`/.test(adminMain), 'Coupon edit must call the real admin coupon update API.');
assert(/apiDelete\(`\/api\/admin\/mall\/coupons\/\$\{[^}]+\}`/.test(adminMain), 'Coupon delete must call the real admin coupon delete API.');
assert(/apiGet<JsonRecord\[]>\('\/api\/admin\/mall\/coupons'/.test(adminMain), 'Coupon list must load from the real admin coupon API.');
assert(/apiGet<JsonRecord\[]>\('\/api\/admin\/mall\/home-banners'/.test(adminMain), 'Home configuration must load from the real admin home banner API.');
assert(/apiPost(?:<[^>]+>)?\('\/api\/admin\/mall\/home-banners'/.test(adminMain), 'Home configuration creation must call the real admin home banner API.');
assert(/apiPut(?:<[^>]+>)?\(`\/api\/admin\/mall\/home-banners\/\$\{[^}]+\}`/.test(adminMain), 'Home configuration edit must call the real admin home banner update API.');
assert(/apiGet<JsonRecord\[]>\('\/api\/admin\/mall\/home-sections'/.test(adminMain), 'Home section configuration must load from the real admin home section API.');
assert(/apiPost(?:<[^>]+>)?\('\/api\/admin\/mall\/home-sections'/.test(adminMain), 'Home section creation must call the real admin home section API.');
assert(/apiPut<JsonRecord>\(`\/api\/admin\/mall\/home-sections\/\$\{[^}]+\}`/.test(adminMain), 'Home section edit must call the real admin home section update API.');
assert(/apiDelete\(`\/api\/admin\/mall\/home-sections\/\$\{[^}]+\}`/.test(adminMain), 'Home section delete must call the real admin home section delete API.');
assert(/apiPost(?:<[^>]+>)?\('\/api\/admin\/mall\/campaigns'/.test(adminMain), 'Campaign creation must call the real admin campaign API.');
assert(/apiPut<JsonRecord>\(`\/api\/admin\/mall\/campaigns\/\$\{[^}]+\}`/.test(adminMain), 'Campaign edit must call the real admin campaign update API.');
assert(/apiDelete\(`\/api\/admin\/mall\/campaigns\/\$\{[^}]+\}`/.test(adminMain), 'Campaign delete must call the real admin campaign delete API.');
assert(/apiGet<JsonRecord\[]>\('\/api\/admin\/mall\/campaigns'/.test(adminMain), 'Campaign list must load from the real admin campaign API.');
assert(/keyword: campaignFilters\.keyword/.test(adminMain), 'Campaign list must support keyword search.');
assert(/categoryCode: campaignFilters\.categoryCode/.test(adminMain), 'Campaign list must support activity type search.');
assert(/export async function listMallHomeBanners\(\)/.test(mallService), 'Mall app service must expose the public home banner API.');
assert(/apiGet\('\/api\/mall\/home-banners'\)/.test(mallService), 'Mall app service must call the public home banner endpoint.');
assert(/export async function listMallHomeSections\(\)/.test(mallService), 'Mall app service must expose the public home section API.');
assert(/apiGet\('\/api\/mall\/home-sections'\)/.test(mallService), 'Mall app service must call the public home section endpoint.');
assert(/listMallHomeBanners/.test(mallHome), 'Mall home page must load configured home banners.');
assert(/listMallHomeSections/.test(mallHome), 'Mall home page must load configured home sections.');
assert(/buildAnnouncements\(homeSections\)/.test(mallHome), 'Mall home page must render configured homepage announcements.');
assert(/resolveSectionProducts\(products, flashSaleSection/.test(mallHome), 'Mall home page must apply configured flash-sale products.');
assert(/resolveSectionProducts\(products, newArrivalSection/.test(mallHome), 'Mall home page must apply configured new-arrival products.');
assert(/resolveSectionProducts\(products, bestSellerSection/.test(mallHome), 'Mall home page must apply configured hot products.');
assert(/resolveMallImageUrl\(primaryBanner\?\.imageUrl\)/.test(mallHome), 'Mall home page must render configured banner images.');
assert(/categoryCode=\$\{encodeURIComponent\(target\)\}/.test(mallHome), 'Mall home banner category links must navigate with categoryCode.');

assert(/\/api\/admin\/mall\/coupons/.test(mallBackend), 'Backend must expose admin coupon routes.');
assert(/\/api\/admin\/mall\/home-banners/.test(mallBackend), 'Backend must expose admin home banner routes.');
assert(/\/api\/admin\/mall\/home-sections/.test(mallBackend), 'Backend must expose admin home section routes.');
assert(/\/api\/mall\/home-banners/.test(mallBackend), 'Backend must expose public mall home banner route.');
assert(/\/api\/mall\/home-sections/.test(mallBackend), 'Backend must expose public mall home section route.');
assert(/async fn admin_create_coupon/.test(mallBackend), 'Backend must implement admin_create_coupon.');
assert(/async fn admin_delete_coupon/.test(mallBackend), 'Backend must implement admin_delete_coupon.');
assert(/async fn delete_campaign/.test(mallBackend), 'Backend must implement delete_campaign.');
assert(/Query\(query\): Query<CampaignQuery>/.test(mallBackend), 'Backend campaign list must accept search filters.');
assert(/get\(admin_get_coupon::<S>\)[\s\S]*\.put\(admin_update_coupon::<S>\)[\s\S]*\.delete\(admin_delete_coupon::<S>\)/.test(mallBackend), 'Backend coupon route must support GET, PUT and DELETE.');
assert(/put\(update_campaign::<S>\)[\s\S]*\.delete\(delete_campaign::<S>\)/.test(mallBackend), 'Backend campaign route must support PUT and DELETE.');
assert(/async fn admin_update_home_banner/.test(mallBackend), 'Backend must implement admin_update_home_banner.');
assert(/async fn list_home_sections/.test(mallBackend), 'Backend must implement list_home_sections.');
assert(/async fn admin_create_home_section/.test(mallBackend), 'Backend must implement admin_create_home_section.');
assert(/async fn admin_delete_home_section/.test(mallBackend), 'Backend must implement admin_delete_home_section.');
assert(/CREATE TABLE IF NOT EXISTS mall_coupons/.test(migrations), 'Migrations must create mall_coupons.');
assert(/CREATE TABLE IF NOT EXISTS mall_home_banners/.test(migrations), 'Migrations must create mall_home_banners.');
assert(/CREATE TABLE IF NOT EXISTS mall_home_sections/.test(migrations), 'Migrations must create mall_home_sections.');
assert(/CREATE OR REPLACE FUNCTION coupon_json/.test(migrations), 'Migrations must define coupon_json.');
assert(/CREATE OR REPLACE FUNCTION home_banner_json/.test(migrations), 'Migrations must define home_banner_json.');
assert(/CREATE OR REPLACE FUNCTION home_section_json/.test(migrations), 'Migrations must define home_section_json.');

assert(
  packageJson.scripts['check:web-admin-mall-marketing'] === 'node scripts/check-web-admin-mall-marketing.mjs',
  'package.json must expose check:web-admin-mall-marketing.',
);
assert(
  packageJson.scripts.validate.includes('check:web-admin-mall-marketing'),
  'pnpm validate must include check:web-admin-mall-marketing.',
);

console.log('web admin mall marketing contract ok');
