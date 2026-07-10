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

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert(start >= 0, `${name} must exist.`);
  const next = source.indexOf('\nfunction ', start + 1);
  return source.slice(start, next === -1 ? source.length : next);
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
const settingsSection = extractFunction(adminMain, 'MallSettingsSection');
const homeBannersSection = extractFunction(adminMain, 'MallHomeBannersSection');
const homeSectionsSection = extractFunction(adminMain, 'MallHomeSectionsSection');
const paymentSplitSection = extractFunction(adminMain, 'MallPaymentSplitRulesSection');
const campaignsSection = extractFunction(adminMain, 'MallCampaignsSection');

assert(!/designPage\('mall\.couponCreate'/.test(adminMain), 'Mall admin coupon creation must be folded into coupon center, not a separate page.');
assert(/designPage\('mall\.coupons', '券中心'/.test(adminMain), 'Mall admin coupon page must be renamed to coupon center.');
assert(!/designPage\('mall\.campaignCreate'/.test(adminMain), 'Mall admin campaign creation must be folded into campaign list, not a separate page.');
assert(/designPage\('mall\.campaigns', '营销活动'/.test(adminMain), 'Mall admin campaign page must be a single searchable activity list.');
assert(/designPage\('mall\.marketingAgent', '营销 Agent'/.test(adminMain), 'Mall admin must expose a web-only marketing agent page.');
assert(/function MallCouponCenterSection\(/.test(adminMain), 'Web admin must render a real coupon center section.');
assert(/function MallHomeBannersSection\(/.test(adminMain), 'Web admin must render a real home configuration section.');
assert(/designPage\('mall\.banners', '轮播广告位'/.test(adminMain), 'Mall admin must expose carousel banner configuration.');
assert(/designPage\('mall\.homeNotices', '公告栏配置'/.test(adminMain), 'Mall admin must expose homepage notice configuration.');
assert(/designPage\('mall\.homeFlashSale', '秒杀专区'/.test(adminMain), 'Mall admin must expose flash-sale homepage section configuration.');
assert(/designPage\('mall\.homeNewArrivals', '新上专区'/.test(adminMain), 'Mall admin must expose new-arrival homepage section configuration.');
assert(/designPage\('mall\.homeHotProducts', '爆款推荐'/.test(adminMain), 'Mall admin must expose hot-product homepage section configuration.');
assert(/function MallHomeSectionsSection\(/.test(adminMain), 'Web admin must render real homepage section configuration pages.');
assert(/function MallCampaignsSection\(/.test(adminMain), 'Web admin must render a real campaign list section.');
assert(/function CampaignBusinessFields\(/.test(adminMain), 'Campaign modal must render type-specific business fields instead of a generic rules-only editor.');
assert(/门槛金额/.test(adminMain) && /满减金额/.test(adminMain), 'Full-reduction campaigns must expose threshold and reduction amount fields.');
assert(/折扣力度/.test(adminMain), 'Full-discount campaigns must expose a discount input field.');
assert(/包邮门槛/.test(adminMain), 'Free-delivery campaigns must expose a free-shipping threshold field.');
assert(/运费减免金额/.test(adminMain), 'Delivery-reduction campaigns must expose a delivery-reduction amount field.');
assert(/编辑一口价/.test(campaignsSection) && /onOpenFixedPriceCampaign/.test(campaignsSection), 'Fixed-price campaign edit from marketing list must navigate to the fixed-price page.');
assert(/进入一口价页面配置商品、商品组、角标和活动时间/.test(adminMain), 'Fixed-price creation in the general campaign modal must direct operators to the fixed-price page.');
assert(/function MallSettingsSection\(/.test(adminMain), 'Web admin must keep operation settings separate from campaign management.');
assert(/function MallDeliveryRulesSection\(/.test(adminMain), 'Web admin must render a real delivery rules section.');
assert(/function MallPaymentSplitRulesSection\(/.test(adminMain), 'Web admin must render a real payment split rules section.');
assert(/const \[isEditing, setIsEditing\] = useState\(false\)/.test(paymentSplitSection), 'Payment split rules must display first and enter edit mode explicitly.');
assert(/const \[draft, setDraft\] = useState<SettingsForm>\(settingsForm\)/.test(paymentSplitSection), 'Payment split rules must edit a local draft before saving.');
assert(/编辑分账规则/.test(paymentSplitSection), 'Payment split rules must expose an edit button.');
assert(/保存分账规则/.test(paymentSplitSection), 'Payment split rules must expose an explicit save button.');
assert(/settings-summary-grid/.test(paymentSplitSection), 'Payment split rules must render a read-only summary before editing.');
assert(/onSettingsSave\(draft\)[\s\S]*setIsEditing\(false\)/.test(paymentSplitSection), 'Payment split rules must persist through the shared save handler before leaving edit mode.');
assert(/Panel title="活动启停"/.test(settingsSection), 'Operation settings page must be an activity enable/disable workbench.');
assert(/settings-campaign-list/.test(settingsSection), 'Operation settings page must show an activity list.');
assert(/status === 'active' \? 'inactive' : 'active'/.test(settingsSection), 'Operation settings page must switch activity status directly.');
assert(/onCampaignStatus/.test(settingsSection), 'Operation settings quick workbench must toggle campaign status through the campaign API.');
assert(!/freeDeliveryThresholdYuan|defaultDeliveryFeeYuan|coldChainEnabled|refundReviewMinutes/.test(settingsSection), 'Operation settings page must not contain delivery or refund rule form fields.');
assert(/activePageKey === 'mall\.coupons'[\s\S]*<MallCouponCenterSection/.test(adminMain), 'mall.coupons must route to MallCouponCenterSection.');
assert(/activePageKey === 'mall\.banners'[\s\S]*<MallHomeBannersSection/.test(adminMain), 'mall.banners must route to MallHomeBannersSection.');
assert(/homeSectionPageConfigs\[activePageKey\][\s\S]*<MallHomeSectionsSection/.test(adminMain), 'Homepage section pages must route to MallHomeSectionsSection.');
assert(/activePageKey === 'mall\.campaigns'[\s\S]*<MallCampaignsSection/.test(adminMain), 'mall.campaigns must route to MallCampaignsSection.');
assert(/activePageKey === 'mall\.marketingAgent'[\s\S]*<MallMarketingAgentSection/.test(adminMain), 'mall.marketingAgent must route to MallMarketingAgentSection.');
assert(/activePageKey === 'mall\.settings'[\s\S]*<MallSettingsSection/.test(adminMain), 'mall.settings must route to MallSettingsSection.');
assert(/activePageKey === 'mall\.deliveryRules'[\s\S]*<MallDeliveryRulesSection/.test(adminMain), 'mall.deliveryRules must route to MallDeliveryRulesSection.');
assert(/activePageKey === 'mall\.paymentSplit'[\s\S]*<MallPaymentSplitRulesSection/.test(adminMain), 'mall.paymentSplit must route to MallPaymentSplitRulesSection.');
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
assert(/apiPost<JsonRecord>\('\/api\/admin\/mall\/marketing-agent'/.test(adminMain), 'Marketing agent must call the backend admin agent API.');
assert(!/sk-cp-[A-Za-z0-9_-]+/.test(adminMain), 'Web admin must never contain a MiniMax API key.');
assert(/keyword: campaignFilters\.keyword/.test(adminMain), 'Campaign list must support keyword search.');
assert(/categoryCode: campaignFilters\.categoryCode/.test(adminMain), 'Campaign list must support activity type search.');
assert(/displayTitle/.test(adminMain), 'Generic marketing campaign form must include a customer-facing display title.');
assert(/tagText/.test(adminMain), 'Generic marketing campaign form must include configurable product tag text.');
assert(/iconText/.test(adminMain), 'Generic marketing campaign form must include configurable tag icon text.');
assert(/tagBackgroundColor/.test(adminMain), 'Generic marketing campaign form must include configurable tag background color.');
assert(/tagTextColor/.test(adminMain), 'Generic marketing campaign form must include configurable tag text color.');
assert(/ruleExplanation/.test(adminMain), 'Generic marketing campaign form must include rule explanation copy.');
assert(/limitText/.test(adminMain), 'Generic marketing campaign form must include activity limit copy.');
assert(/CampaignDisplayPreview/.test(adminMain), 'Web admin must preview campaign tag and product-detail promotion display.');
assert(/campaignDisplayFromRules/.test(adminMain), 'Web admin must read display metadata from campaign rules.');
assert(/campaignDisplayFromForm/.test(adminMain), 'Web admin must persist display metadata into rules.display.');
assert(/display:\s*\{/.test(adminMain), 'Campaign rules must include a display block.');
assert(/fixedPriceCampaignRules[\s\S]*display:/.test(adminMain), 'Fixed-price campaign rules must save shared display metadata.');
assert(/promotionVenueRules[\s\S]*display:/.test(adminMain), 'Promotion venue rules must save shared display metadata.');
assert(/const \[modalOpen/.test(homeBannersSection), 'Home banner creation must use a modal.');
assert(/<Panel title="首页配置列表"[\s\S]*新增首页配置/.test(homeBannersSection), 'Home banner list must expose a create button.');
assert(/modal-backdrop[\s\S]*编辑首页配置[\s\S]*新增首页配置/.test(homeBannersSection), 'Home banner create/edit form must render inside a modal.');
assert(!/Panel title=\{form\.id \? '编辑首页配置' : '新增首页配置'\}/.test(homeBannersSection), 'Home banner create form must not be shown as an inline page panel.');
assert(/const \[modalOpen/.test(homeSectionsSection), 'Homepage section creation must use a modal.');
assert(homeSectionsSection.includes('<Panel title={`${title}列表`}') && homeSectionsSection.includes('{`新增${title}`}'), 'Homepage section list must expose a create button.');
assert(homeSectionsSection.includes('modal-backdrop') && homeSectionsSection.includes('<h2>{form.id ? `编辑${title}` : `新增${title}`}</h2>'), 'Homepage section create/edit form must render inside a modal.');
assert(!/Panel title=\{form\.id \? `编辑\$\{title\}` : `新增\$\{title\}`\}/.test(homeSectionsSection), 'Homepage section create form must not be shown as an inline page panel.');
assert(/export async function listMallHomeBanners\([^)]*\)/.test(mallService), 'Mall app service must expose the public home banner API.');
assert(/cachedApiGet\('\/api\/mall\/home-banners'/.test(mallService), 'Mall app service must call the public home banner endpoint.');
assert(/export async function listMallHomeSections\([^)]*\)/.test(mallService), 'Mall app service must expose the public home section API.');
assert(/cachedApiGet\('\/api\/mall\/home-sections'/.test(mallService), 'Mall app service must call the public home section endpoint.');
assert(/listMallHomeBanners/.test(mallHome), 'Mall home page must load configured home banners.');
assert(/listMallHomeSections/.test(mallHome), 'Mall home page must load configured home sections.');
assert(/buildAnnouncements\(homeSections\)/.test(mallHome), 'Mall home page must render configured homepage announcements.');
assert(/resolveSectionProducts\(products, flashSaleSection/.test(mallHome), 'Mall home page must apply configured flash-sale products.');
assert(/resolveSectionProducts\(products, newArrivalSection/.test(mallHome), 'Mall home page must apply configured new-arrival products.');
assert(/resolveSectionProducts\(products, bestSellerSection/.test(mallHome), 'Mall home page must apply configured hot products.');
assert(/resolveMallImageUrl\(primaryBanner\?\.imageUrl\)/.test(mallHome), 'Mall home page must render configured banner images.');
assert(/categoryCode=\$\{encodeURIComponent\(target\)\}/.test(mallHome), 'Mall home banner category links must navigate with categoryCode.');

assert(/deliveryRules/.test(adminMain), 'Web admin must save delivery rules into mall settings.');
assert(/paymentSplitRules/.test(adminMain), 'Web admin must save payment split rules into mall settings.');
assert(/showMessage\('success', `\$\{label\}成功`\)/.test(adminMain), 'Write actions must show a success message through runAction.');
assert(/const message = `\$\{label\}失败：/.test(adminMain) && /showMessage\('error', message\)/.test(adminMain), 'Write actions must show a failure message through runAction.');
[
  '商品创建',
  '商品更新',
  '品类更新',
  '品类排序保存',
  '库存预警更新',
  '自提点更新',
  '团长更新',
  '活动更新',
  '优惠券更新',
  '首页配置更新',
  '首页专区配置更新',
  '运营配置保存',
  '权限更新',
].forEach(label => {
  assert(adminMain.includes(label), `${label} must keep a visible save/update result notice label.`);
});
assert(/delivery_rules/.test(mallBackend), 'Backend settings mutation must accept delivery_rules.');
assert(/payment_split_rules/.test(mallBackend), 'Backend settings mutation must accept payment_split_rules.');
assert(/delivery_rules jsonb/.test(migrations), 'Migrations must add delivery_rules JSON settings.');
assert(/payment_split_rules jsonb/.test(migrations), 'Migrations must add payment_split_rules JSON settings.');
assert(/'deliveryRules'/.test(migrations), 'settings_json must expose deliveryRules.');
assert(/'paymentSplitRules'/.test(migrations), 'settings_json must expose paymentSplitRules.');

assert(/\/api\/admin\/mall\/coupons/.test(mallBackend), 'Backend must expose admin coupon routes.');
assert(/\/api\/admin\/mall\/marketing-agent/.test(mallBackend), 'Backend must expose the admin marketing agent route.');
assert(/MINIMAX_API_KEY/.test(mallBackend), 'Backend marketing agent must read the MiniMax API key from environment variables.');
assert(!/sk-cp-[A-Za-z0-9_-]+/.test(mallBackend), 'Backend source must never hardcode a MiniMax API key.');
assert(/marketing_agent_context/.test(mallBackend), 'Backend marketing agent must build a sanitized marketing context.');
assert(/admin_marketing_agent/.test(mallBackend), 'Backend must implement the marketing agent handler.');
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
