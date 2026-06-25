import { StrictMode, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { DragEvent, FormEvent, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import sanyouLogo from '@/assets/brand/sanyou.png';
import './styles.css';

declare const __PROJECT_DOMAIN__: string | undefined;

type JsonRecord = Record<string, unknown>;
type AdminMessageType = 'success' | 'error' | 'info' | 'warning';

interface AdminMessageItem {
  id: string;
  type: AdminMessageType;
  content: string;
  createdAt: number;
}

type AdminMessageHandler = (type: AdminMessageType, content: string) => void;

const AdminMessageContext = createContext<AdminMessageHandler | null>(null);

function useAdminMessage(): AdminMessageHandler {
  return useContext(AdminMessageContext) || (() => undefined);
}

type NavigationKey =
  | 'overview'
  | 'users'
  | 'vehicles'
  | 'transportOrders'
  | 'mallProducts'
  | 'mallOrders'
  | 'operations'
  | 'support';

interface NavigationItem {
  key: NavigationKey;
  label: string;
  description: string;
  icon: IconName;
}

type AdminModuleKey = 'platform' | 'vehicle' | 'mall';
type MallOrderOpsMode = 'today' | 'history' | 'abnormal';
type MallDeliveryOpsMode = 'sheets' | 'tracking' | 'pickup';
type MallFinanceOpsMode = 'bills' | 'settlements' | 'withdrawals';
type MallStatsOpsMode = 'sales' | 'revenue' | 'hot';

interface AdminPageSpec {
  key: string;
  label: string;
  group: string;
  description: string;
  icon: IconName;
  routeKey?: NavigationKey;
  tableTitle?: string;
  detailTitle?: string;
  workflow?: string[];
}

interface AdminModuleSpec {
  key: AdminModuleKey;
  brand: string;
  subtitle: string;
  moduleLabel: string;
  theme: 'blue' | 'green';
  pages: AdminPageSpec[];
}

interface LoadErrors {
  [key: string]: string;
}

interface AdminUserInfo {
  id: string;
  phone: string;
  name: string;
  role: string;
  token: string;
}

interface AdminSession {
  token: string;
  user: AdminUserInfo;
}

interface LoginForm {
  phone: string;
  password: string;
  captchaId: string;
  captchaCode: string;
}

interface DashboardData {
  adminStats: JsonRecord;
  users: JsonRecord[];
  vehicles: JsonRecord[];
  transportOrders: JsonRecord[];
  commissionPending: JsonRecord[];
  commissionSummary: JsonRecord;
  mallOverview: JsonRecord;
  mallCategories: JsonRecord[];
  mallProducts: JsonRecord[];
  mallProcurementBuyers: JsonRecord[];
  mallInventoryAlerts: JsonRecord[];
  mallOrders: JsonRecord[];
  mallAfterSales: JsonRecord[];
  mallOpsOverview: JsonRecord;
  mallDeliverySheets: JsonRecord[];
  mallPickupPoints: JsonRecord[];
  mallGroupLeaders: JsonRecord[];
  mallFinanceBills: JsonRecord[];
  mallSettlementRecords: JsonRecord[];
  mallWithdrawalRequests: JsonRecord[];
  mallSalesStats: JsonRecord;
  campaigns: JsonRecord[];
  fixedPriceCampaigns: JsonRecord[];
  promotionVenues: JsonRecord[];
  mallGroupBuys: JsonRecord[];
  mallCoupons: JsonRecord[];
  mallHomeBanners: JsonRecord[];
  mallHomeSections: JsonRecord[];
  mallPermissions: JsonRecord[];
  mallSettings: JsonRecord;
  supportMetrics: JsonRecord;
  supportSessions: JsonRecord[];
  supportTickets: JsonRecord[];
  supportKnowledge: JsonRecord[];
  enterprises: JsonRecord[];
  demands: JsonRecord[];
  cancellations: JsonRecord[];
  ownerWithdrawals: JsonRecord[];
  trips: JsonRecord[];
  undispatchedOrders: JsonRecord[];
  allOrders: JsonRecord[];
  availableVehicles: JsonRecord[];
}

interface ProductForm {
  name: string;
  sku: string;
  categoryCode: string;
  subtitle: string;
  description: string;
  imageUrl: string;
  images: string[];
  specification: string;
  saleMethod: string;
  priceYuan: string;
  supplyPriceYuan: string;
  stock: string;
  stockAlertThreshold: string;
  minimumOrderQuantity: string;
  lengthCm: string;
  widthCm: string;
  heightCm: string;
  volumeLiters: string;
  weightKg: string;
  tags: string;
  status: string;
  deliveryMinutes: string;
  coldChainRequired: boolean;
  variants: ProductVariantForm[];
  procurementBuyerIds: string[];
  qualificationReports: ProductQualificationReportForm[];
  hideSupplier: boolean;
}

interface ProductVariantForm {
  id: string;
  name: string;
  sku: string;
  specification: string;
  saleMethod: string;
  priceYuan: string;
  originalPriceYuan: string;
  supplyPriceYuan: string;
  stock: string;
  minimumOrderQuantity: string;
  status: string;
  sortOrder: string;
  pricingMode: string;
  weightUnitLabel: string;
  weightUnitGrams: string;
  weightTolerancePercent: string;
  lengthCm: string;
  widthCm: string;
  heightCm: string;
  volumeLiters: string;
  weightKg: string;
}

interface ProductQualificationReportForm {
  id: string;
  buyerId: string;
  reportName: string;
  reportType: string;
  reportUrl: string;
  issuer: string;
  issuedAt: string;
  expiresAt: string;
}

interface ProcurementBuyerForm {
  id: string;
  name: string;
  contactName: string;
  contactPhone: string;
  licenseUrl: string;
  status: string;
  remark: string;
}

const productImageLimit = 20;
const productVariantLimit = 50;

interface CategoryForm {
  id: string;
  code: string;
  name: string;
  sortOrder: string;
  status: string;
}

interface MallFilterState {
  keyword: string;
  categoryCode: string;
  status: string;
  stockStatus: string;
  sort: string;
  page: string;
  pageSize: string;
}

interface PickupPointForm {
  id: string;
  name: string;
  addressText: string;
  latitude: string;
  longitude: string;
  businessHours: string;
  status: string;
  communityName: string;
  leaderName: string;
  leaderPhone: string;
  sortOrder: string;
}

interface PickupPointFilterState {
  keyword: string;
  status: string;
  community: string;
}

interface GroupLeaderForm {
  id: string;
  pickupPointId: string;
  userId: string;
  name: string;
  phone: string;
  status: string;
  serviceNote: string;
}

interface GroupLeaderFilterState {
  keyword: string;
  status: string;
  pickupPointId: string;
}

interface CampaignForm {
  id: string;
  name: string;
  campaignType: string;
  budgetYuan: string;
  status: string;
  startsAt: string;
  endsAt: string;
  displayTitle: string;
  tagText: string;
  iconText: string;
  iconUrl: string;
  tagBackgroundColor: string;
  tagTextColor: string;
  ruleExplanation: string;
  limitText: string;
  scopeType: string;
  productIds: string;
  productGroups: CampaignProductGroupForm[];
  audienceType: string;
  newCustomerRule: string;
  tiers: CampaignTierForm[];
}

interface CampaignDisplayConfig {
  title: string;
  tagText: string;
  iconText: string;
  iconUrl: string;
  backgroundColor: string;
  textColor: string;
  ruleExplanation: string;
  limitText: string;
}

interface CampaignTierForm {
  id: string;
  thresholdYuan: string;
  discountYuan: string;
  discountPercent: string;
}

interface CampaignProductGroupForm {
  id: string;
  name: string;
  productIds: string;
}

interface FixedPriceCampaignItemForm {
  productId: string;
  fixedPriceYuan: string;
}

interface FixedPriceCampaignGroupForm {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  items: FixedPriceCampaignItemForm[];
}

interface FixedPriceCampaignForm {
  id: string;
  name: string;
  status: string;
  startsAt: string;
  endsAt: string;
  badgeText: string;
  badgeIcon: string;
  badgeIconUrl: string;
  badgeBackgroundColor: string;
  badgeTextColor: string;
  badgePosition: string;
  groups: FixedPriceCampaignGroupForm[];
}

interface PromotionVenueItemForm {
  productId: string;
}

interface PromotionVenueForm {
  id: string;
  name: string;
  status: string;
  title: string;
  tagText: string;
  subtitle: string;
  copy: string;
  limitText: string;
  buttonText: string;
  iconText: string;
  iconUrl: string;
  backgroundImageUrl: string;
  backgroundColor: string;
  textColor: string;
  entryPosition: string;
  sortOrder: string;
  items: PromotionVenueItemForm[];
}

interface GroupBuyTierForm {
  id: string;
  quantity: string;
  priceYuan: string;
}

interface GroupBuyForm {
  id: string;
  name: string;
  productId: string;
  variantId: string;
  startsAt: string;
  endsAt: string;
  balanceDueAt: string;
  minGroupQuantity: string;
  maxQuantityPerUser: string;
  minCreditScore: string;
  overdueCreditPenalty: string;
  depositType: string;
  depositValue: string;
  tiers: GroupBuyTierForm[];
}

interface CouponForm {
  id: string;
  name: string;
  code: string;
  couponType: string;
  thresholdYuan: string;
  discountYuan: string;
  totalQuantity: string;
  perUserLimit: string;
  status: string;
  startsAt: string;
  endsAt: string;
  description: string;
}

interface HomeBannerForm {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  linkType: string;
  linkTarget: string;
  sortOrder: string;
  status: string;
  startsAt: string;
  endsAt: string;
  tag: string;
}

interface HomeSectionForm {
  id: string;
  sectionType: string;
  title: string;
  subtitle: string;
  content: string;
  imageUrl: string;
  linkType: string;
  linkTarget: string;
  productIds: string;
  rules: string;
  sortOrder: string;
  status: string;
  startsAt: string;
  endsAt: string;
}

interface SettingsForm {
  freeDeliveryThresholdYuan: string;
  defaultDeliveryFeeYuan: string;
  deliveryPromiseMinutes: string;
  refundReviewMinutes: string;
  coldChainEnabled: boolean;
  deliveryRangeEnabled: boolean;
  deliveryOriginLatitude: string;
  deliveryOriginLongitude: string;
  deliveryOriginAddress: string;
  deliveryRangeRadiusKm: string;
  deliveryRangePolygon: string;
  deliveryFeeTiersText: string;
  pickupWindowStart: string;
  pickupWindowEnd: string;
  deliveryBatchTimes: string;
  leaderCommissionRate: string;
  platformServiceRate: string;
  supplierSettlementCycle: string;
  withdrawMinYuan: string;
}

interface MallPermissionForm {
  id: string;
  name: string;
  roleKey: string;
  description: string;
  modules: string[];
  actions: string[];
  status: string;
}

interface MallPermissionFilterState {
  keyword: string;
  status: string;
  module: string;
}

interface MallOpsFilterState {
  keyword: string;
  status: string;
  date: string;
  community: string;
}

interface MallOrderDetailSearchFilters {
  orderNo: string;
  userPhone: string;
  merchantId: string;
  startDate: string;
  endDate: string;
}

interface WithdrawalForm {
  amountYuan: string;
  note: string;
}

interface SupportForm {
  userId: string;
  topic: string;
  message: string;
  ticketTitle: string;
  ticketCategory: string;
  ticketPriority: string;
  ticketOrderId: string;
  knowledgeTitle: string;
  knowledgeCategory: string;
  knowledgeContent: string;
}

interface SupportFilterState {
  keyword: string;
  status: string;
  category: string;
  priority: string;
}

interface OperationsTrendBar {
  key: string;
  label: string;
  orders: number;
  revenueCents: number;
  percentage: number;
}

interface OperationsFunnelStep {
  label: string;
  value: number;
  detail: string;
  percentage: number;
}

interface OperationsModuleCard {
  label: string;
  value: string;
  detail: string;
  status: string;
  progress: number;
}

interface OperationsRiskItem {
  label: string;
  value: string;
  detail: string;
  tone: 'blue' | 'green' | 'amber' | 'gray';
}

interface OperationsInsightCard {
  label: string;
  value: string;
  detail: string;
}

interface OperationsCategorySale {
  name: string;
  quantity: number;
  revenueCents: number;
  percentage: number;
}

interface OperationsHotProduct {
  name: string;
  category: string;
  quantity: number;
  revenueCents: number;
}

interface OperationsScreenModel {
  kpis: Array<{
    label: string;
    value: string;
    detail: string;
    trend: string;
  }>;
  trends: OperationsTrendBar[];
  funnel: OperationsFunnelStep[];
  modules: OperationsModuleCard[];
  risks: OperationsRiskItem[];
  insights: OperationsInsightCard[];
  categorySales: OperationsCategorySale[];
  hotProducts: OperationsHotProduct[];
}

type IconName =
  | 'dashboard'
  | 'users'
  | 'truck'
  | 'orders'
  | 'shop'
  | 'shopping-bag'
  | 'route'
  | 'megaphone'
  | 'support'
  | 'refresh'
  | 'check'
  | 'x'
  | 'send'
  | 'save'
  | 'plus'
  | 'refund'
  | 'lock'
  | 'unlock'
  | 'menu'
  | 'logout';

interface ApiEnvelope<T> {
  code?: number | string;
  statusCode?: number | string;
  message?: string;
  data?: T;
}

const API_BASE =
  typeof __PROJECT_DOMAIN__ === 'string' && __PROJECT_DOMAIN__.trim().length > 0
    ? __PROJECT_DOMAIN__.replace(/\/$/, '')
    : '';
const AUTH_FAILURE_STATUS_CODES = [401, 403];

let currentAdminSession: AdminSession | null = null;
let adminAuthFailureHandler: ((message: string) => void) | null = null;

function normalizeAdminUser(record: JsonRecord): AdminUserInfo | null {
  const id = stringValue(record, 'id');
  const token = stringValue(record, 'token');
  const role = stringValue(record, 'role');

  if (!id || !token || !role) {
    return null;
  }

  return {
    id,
    token,
    role,
    phone: stringValue(record, 'phone'),
    name: stringValue(record, 'name'),
  };
}

function clearStoredAdminSession() {
  currentAdminSession = null;

  if (typeof localStorage === 'undefined') {
    return;
  }

  localStorage.removeItem('webAdminSession');
}

function persistAdminSession(user: AdminUserInfo) {
  const session: AdminSession = {
    token: user.token,
    user,
  };

  currentAdminSession = session;
  localStorage.setItem('webAdminSession', JSON.stringify(session));

  return session;
}

function getStoredAdminSession() {
  if (currentAdminSession) {
    return currentAdminSession;
  }

  if (typeof localStorage === 'undefined') {
    return null;
  }

  const rawSession = localStorage.getItem('webAdminSession');
  if (!rawSession) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawSession) as JsonRecord;
    const userValue = parsed.user;

    if (!userValue || typeof userValue !== 'object' || Array.isArray(userValue)) {
      clearStoredAdminSession();
      return null;
    }

    const userRecord = userValue as JsonRecord;
    const token = stringValue(parsed, 'token') || stringValue(userRecord, 'token');
    const user = normalizeAdminUser({ ...userRecord, token });

    if (!user || user.role !== 'admin') {
      clearStoredAdminSession();
      return null;
    }

    currentAdminSession = {
      token: user.token,
      user,
    };
    return currentAdminSession;
  } catch {
    clearStoredAdminSession();
    return null;
  }
}

function isAuthFailureStatus(value: unknown) {
  const status = typeof value === 'string' ? Number(value) : value;
  return typeof status === 'number' && AUTH_FAILURE_STATUS_CODES.includes(status);
}

function handleAdminAuthFailure(message: string) {
  clearStoredAdminSession();
  adminAuthFailureHandler?.(message);
}

const navigation: NavigationItem[] = [
  { key: 'overview', label: '运营看板', description: '平台指标与风险概览', icon: 'dashboard' },
  { key: 'users', label: '账号角色', description: '用户启停与角色核验', icon: 'users' },
  { key: 'vehicles', label: '车辆审核', description: '车辆资质与运营状态', icon: 'truck' },
  { key: 'transportOrders', label: '运力订单', description: '订单与佣金结算', icon: 'route' },
  { key: 'mallProducts', label: '商城商品', description: '商品上下架与库存', icon: 'shop' },
  { key: 'mallOrders', label: '商城订单', description: '派送、售后与退款', icon: 'orders' },
  { key: 'operations', label: '运营配置', description: '活动、规则、配送设置', icon: 'megaphone' },
  { key: 'support', label: '客服工作台', description: '会话、工单、知识库', icon: 'support' },
];

const navigationByKey = new Map(navigation.map(item => [item.key, item]));

function designPage(
  key: string,
  label: string,
  group: string,
  description: string,
  icon: IconName,
  routeKey?: NavigationKey,
  workflow: string[] = ['筛选', '列表', '详情', '处理'],
): AdminPageSpec {
  const legacy = routeKey ? navigationByKey.get(routeKey) : undefined;
  return {
    key,
    label,
    group,
    description: description || legacy?.description || '',
    icon: legacy?.icon || icon,
    routeKey,
    tableTitle: `${label}列表`,
    detailTitle: `${label}详情`,
    workflow,
  };
}

const adminModules: AdminModuleSpec[] = [
  {
    key: 'platform',
    brand: 'Reco Console',
    subtitle: '超级管理端',
    moduleLabel: '平台治理',
    theme: 'blue',
    pages: [
      designPage('platform.overview', '总览看板', '平台', '平台指标、服务状态和风险事项', 'dashboard', 'overview'),
      designPage('platform.accounts', '账号列表', '账号权限', '账号启停、角色和主体信息', 'users', 'users'),
      designPage('platform.invites', '邀请账号', '账号权限', '运营/客服/财务账号邀请流程', 'plus'),
      designPage('platform.roles', '角色权限', '账号权限', '模块权限、数据权限和操作权限', 'users'),
      designPage('platform.enterpriseAudit', '企业审核', '审核中心', '企业主体、商户和资质资料审核', 'check'),
      designPage('platform.ownerAudit', '车主审核', '审核中心', '车主身份、车辆所有权和结算资料', 'truck'),
      designPage('platform.merchantAudit', '商户审核', '审核中心', '商城商户资料和结算资质', 'shop'),
      designPage('platform.paymentRecon', '支付对账', '财务', '微信支付、退款和异常账单', 'refund'),
      designPage('platform.splitLedger', '分账台账', '财务', '无人车与商城业务分账记录', 'orders'),
      designPage('platform.commission', '佣金审核', '财务', '运力订单佣金确认与异常处理', 'route', 'transportOrders'),
      designPage('platform.cos', '素材资源', '公共服务', '商品图、资质图和上传资源治理', 'shop'),
      designPage('platform.logs', '日志检索', '公共服务', '业务日志、错误日志和审计日志', 'support'),
      designPage('platform.apiHealth', '服务健康', '公共服务', '无人车、商城、平台服务健康检查', 'refresh'),
      designPage('platform.risk', '风控规则', '安全', '支付、售后、账号和频控策略', 'x'),
      designPage('platform.auditLog', '操作审计', '安全', '管理员操作轨迹与敏感动作', 'orders'),
      designPage('platform.notice', '系统公告', '运营', 'Web、小程序和服务通知发布', 'megaphone'),
      designPage('platform.dictionary', '基础字典', '运营', '状态、类目、标签和枚举治理', 'dashboard'),
      designPage('platform.stations', '站点字典', '运营', '无人车站点、自提点基础资料', 'route'),
      designPage('platform.analytics', '数据报表', '数据', '业务漏斗、收入和履约效率', 'dashboard'),
      designPage('platform.release', '发布检查', '运维', '版本、部署和回滚检查清单', 'check'),
      designPage('platform.settings', '系统设置', '设置', '域名、商户号、密钥和公共配置', 'save'),
      designPage('platform.messages', '消息中心', '运营', '站内消息、模板消息和触达记录', 'send'),
    ],
  },
  {
    key: 'vehicle',
    brand: '锐途运力',
    subtitle: 'B端无人车小程序后台',
    moduleLabel: '无人车业务',
    theme: 'blue',
    pages: [
      designPage('vehicle.review', '审核', '审核', '企业、车主、车辆资料集中审核', 'check', 'vehicles'),
      designPage('vehicle.enterpriseReview', '企业入驻审核', '审核', '需求方企业主体审核和资料补录', 'users'),
      designPage('vehicle.ownerReview', '车主入驻审核', '审核', '车主资质、收款和认证资料', 'users'),
      designPage('vehicle.vehicleList', '无人车管理', '无人车管理', '车辆列表、冷链能力和运营状态', 'truck', 'vehicles'),
      designPage('vehicle.vehicleDetail', '车辆详情', '无人车管理', '车辆资质、绑定关系和历史订单', 'truck'),
      designPage('vehicle.bindings', '车辆绑定', '无人车管理', '无人车和账号/企业绑定关系', 'route'),
      designPage('vehicle.status', '状态监控', '状态监控', '车辆在线、舱门、电量和异常状态', 'dashboard'),
      designPage('vehicle.map', '地图监控', '状态监控', '车辆位置、站点和配送轨迹', 'route'),
      designPage('vehicle.alerts', '告警中心', '状态监控', '离线、异常、冷链和超时告警', 'support'),
      designPage('vehicle.dispatch', '调度中心', '运单工单', '企业需求、派单和无人车履约', 'send'),
      designPage('vehicle.transportOrders', '运单列表', '运单工单', '运单、佣金和结算流程', 'orders', 'transportOrders'),
      designPage('vehicle.cancellations', '取消申请', '运单工单', '取消原因、赔付和人工处理', 'x'),
      designPage('vehicle.commission', '佣金确认', '运单工单', '车主佣金支付与平台确认', 'refund', 'transportOrders'),
      designPage('vehicle.wallet', '运力钱包', '运单工单', '车主余额、转账和失败重试', 'orders'),
      designPage('vehicle.support', '客服运维', '客服运维', '无人车业务客服会话和工单', 'support', 'support'),
      designPage('vehicle.knowledge', '运维知识库', '客服运维', '车辆、开舱、配送异常处理话术', 'support'),
      designPage('vehicle.stats', '运力数据', '数据', '接单、履约、时效和收入指标', 'dashboard'),
      designPage('vehicle.settings', '运力设置', '设置', '无人车业务规则、站点和客服配置', 'save'),
    ],
  },
  {
    key: 'mall',
    brand: '叁友甄选',
    subtitle: '商城运营端',
    moduleLabel: '商城业务',
    theme: 'green',
    pages: [
      designPage('mall.products', '商品上架', '商品管理', '', 'shop', 'mallProducts'),
      designPage('mall.productList', '商品列表', '商品管理', '在售、售罄和下架商品管理', 'shop', 'mallProducts'),
      designPage('mall.procurementBuyers', '采购商管理', '商品管理', '采购商、营业执照和供货资质', 'users', 'mallProducts'),
      designPage('mall.categories', '品类管理', '品类管理', '社区团购类目、排序和状态', 'dashboard'),
      designPage('mall.inventory', '库存预警', '商品管理', '库存管理、低库存、缺货替换和补货提醒', 'support'),
      designPage('mall.todayOrders', '今日订单', '订单管理', '按小区汇总今日订单并生成分拣单', 'orders', 'mallOrders'),
      designPage('mall.historyOrders', '历史订单', '订单管理', '历史订单明细检索与履约回溯', 'orders', 'mallOrders'),
      designPage('mall.abnormalOrders', '异常订单', '订单管理', '退款、售后和履约异常处理', 'refund', 'mallOrders'),
      designPage('mall.orders', '订单管理', '订单管理', '商城订单、履约和退款售后', 'orders', 'mallOrders'),
      designPage('mall.orderDetail', '订单详情', '订单管理', '订单明细、支付、自提和客服记录', 'orders'),
      designPage('mall.fulfillment', '自提核销', '订单管理', '提货码生成、团长核销和异常处理', 'check'),
      designPage('mall.refunds', '退款售后', '订单管理', '售后申请、坏果包赔和退款处理', 'refund', 'mallOrders'),
      designPage('mall.pickup', '自提点管理', '订单管理', '自提点、团长和营业时间管理', 'route'),
      designPage('mall.leaders', '团长管理', '订单管理', '团长中心、核销权限和服务质量', 'users'),
      designPage('mall.deliverySheets', '配送单生成', '配送管理', '按日期和小区生成配送单', 'send', 'operations'),
      designPage('mall.deliveryTracking', '配送状态跟踪', '配送管理', '配送单发货、送达状态跟踪', 'route', 'operations'),
      designPage('mall.pickupConnect', '自提点对接', '配送管理', '团长联系方式、自提点地址和小区覆盖', 'users', 'operations'),
      designPage('mall.community', '邻里圈', '营销中心', '自提点动态、拼团和用户互动', 'megaphone'),
      designPage('mall.campaigns', '营销活动', '营销中心', '活动搜索、创建、编辑、启停和删除', 'megaphone', 'operations'),
      designPage('mall.fixedPriceCampaigns', '一口价', '营销中心', '商品一口价活动和商品图角标配置', 'megaphone', 'operations'),
      designPage('mall.promotionVenues', '大促会场', '营销中心', '会场入口、视觉配置和商品池', 'megaphone', 'operations'),
      designPage('mall.groupBuyPresale', '集采预售', '营销中心', '集采预售活动、定金、尾款和采购确认', 'shopping-bag'),
      designPage('mall.coupons', '券中心', '营销中心', '券创建、编辑、发放量、核销状态和启停', 'megaphone'),
      designPage('mall.banners', '轮播广告位', '首页配置', '首页 3 张轮播、图片、跳转和排序', 'dashboard'),
      designPage('mall.homeNotices', '公告栏配置', '首页配置', '今日到货、配送时效、售后通知和团长招募', 'megaphone'),
      designPage('mall.homeFlashSale', '秒杀专区', '首页配置', '每日两场秒杀、倒计时、库存和商品池', 'shop', 'mallProducts'),
      designPage('mall.homeNewArrivals', '新上专区', '首页配置', '每日上新 10-15 款和今日刚到标签', 'plus', 'mallProducts'),
      designPage('mall.homeHotProducts', '爆款推荐', '首页配置', '平台销量 TOP10 和排序规则', 'shop', 'mallProducts'),
      designPage('mall.supportData', '客服数据', '客服售后', '响应、会话、售后和知识库指标', 'dashboard', 'support'),
      designPage('mall.support', '客服售后', '客服售后', '用户咨询会话、消息回复和用户上下文', 'support', 'support'),
      designPage('mall.afterSales', '售后申请', '客服售后', '售后单审核、证据图片和退款流转', 'refund', 'mallOrders'),
      designPage('mall.supportTickets', '客服工单', '客服售后', '内部跟进工单、跨岗位协同和处理结果', 'check', 'support'),
      designPage('mall.knowledge', '客服知识库', '客服售后', '商城 FAQ、坏果包赔和履约话术', 'support', 'support'),
      designPage('mall.settings', '运营设置', '运营设置', '活动启停', 'save', 'operations'),
      designPage('mall.deliveryRules', '配送规则', '运营设置', '自提窗口、冷链承诺和服务费', 'route'),
      designPage('mall.paymentSplit', '分账规则', '运营设置', '商城分账、团长佣金和商户结算', 'refund'),
      designPage('mall.risk', '风险审核', '运营设置', '售后异常、频控和恶意退款拦截', 'x'),
      designPage('mall.financeBills', '账单明细', '财务结算', '每日、每周、每月账单明细', 'orders', 'operations'),
      designPage('mall.settlements', '结算记录', '财务结算', '结算状态、金额和打款凭证', 'refund', 'operations'),
      designPage('mall.withdrawals', '提现申请', '财务结算', '平台运营提现申请与审核状态', 'send', 'operations'),
      designPage('mall.salesStats', '销量统计', '数据', '按商品、分类和时间查看销量', 'dashboard'),
      designPage('mall.revenueStats', '收益统计', '数据', '每日、每周、每月收益趋势', 'dashboard'),
      designPage('mall.hotProducts', '热销商品排行', '数据', '热销商品排名和销售贡献', 'shop'),
      designPage('mall.data', '运营数据', '数据', '商城收入、订单、复购和售后指标', 'dashboard'),
      designPage('mall.permissions', '运营权限', '设置', '商品、客服、财务和团长权限', 'users'),
    ],
  },
];

function findAdminRoute(pageKey: string) {
  for (const module of adminModules) {
    const page = module.pages.find(item => item.key === pageKey);
    if (page) return { moduleKey: module.key, pageKey: page.key };
  }
  return null;
}

function getInitialAdminRouteState() {
  const fallback = { moduleKey: adminModules[0].key, pageKey: adminModules[0].pages[0].key };
  if (typeof window === 'undefined') return fallback;

  const rawHash = window.location.hash.replace(/^#\/?/, '');
  const pageKey = decodeURIComponent(rawHash.split('?')[0] || '').trim();
  return (pageKey ? findAdminRoute(pageKey) : null) || fallback;
}

function writeAdminRouteToLocation(pageKey: string, mode: 'push' | 'replace' = 'push') {
  if (typeof window === 'undefined') return;
  const nextHash = `#/${encodeURIComponent(pageKey)}`;
  if (window.location.hash === nextHash) return;
  const nextUrl = `${window.location.pathname}${window.location.search}${nextHash}`;
  if (mode === 'replace') {
    window.history.replaceState(null, '', nextUrl);
    return;
  }
  window.history.pushState(null, '', nextUrl);
}

const initialData: DashboardData = {
  adminStats: {},
  users: [],
  vehicles: [],
  transportOrders: [],
  commissionPending: [],
  commissionSummary: {},
  mallOverview: {},
  mallCategories: [],
  mallProducts: [],
  mallProcurementBuyers: [],
  mallInventoryAlerts: [],
  mallOrders: [],
  mallAfterSales: [],
  mallOpsOverview: {},
  mallDeliverySheets: [],
  mallPickupPoints: [],
  mallGroupLeaders: [],
  mallFinanceBills: [],
  mallSettlementRecords: [],
  mallWithdrawalRequests: [],
  mallSalesStats: {},
  campaigns: [],
  fixedPriceCampaigns: [],
  promotionVenues: [],
  mallGroupBuys: [],
  mallCoupons: [],
  mallHomeBanners: [],
  mallHomeSections: [],
  mallPermissions: [],
  mallSettings: {},
  supportMetrics: {},
  supportSessions: [],
  supportTickets: [],
  supportKnowledge: [],
  enterprises: [],
  demands: [],
  cancellations: [],
  ownerWithdrawals: [],
  trips: [],
  undispatchedOrders: [],
  allOrders: [],
  availableVehicles: [],
};

const initialProductForm: ProductForm = {
  name: '',
  sku: '',
  categoryCode: 'fruit',
  subtitle: '',
  description: '',
  imageUrl: '',
  images: [],
  specification: '单份',
  saleMethod: '按份',
  priceYuan: '19.90',
  supplyPriceYuan: '12.80',
  stock: '80',
  stockAlertThreshold: '15',
  minimumOrderQuantity: '1',
  lengthCm: '',
  widthCm: '',
  heightCm: '',
  volumeLiters: '',
  weightKg: '',
  tags: '鲜选,冷链',
  status: 'on_sale',
  deliveryMinutes: '18',
  coldChainRequired: false,
  variants: [createDefaultProductVariantForm()],
  procurementBuyerIds: [],
  qualificationReports: [],
  hideSupplier: false,
};

function createDefaultProductVariantForm(index = 0): ProductVariantForm {
  return {
    id: index === 0 ? 'default' : `variant-${Date.now()}-${index}`,
    name: index === 0 ? '默认规格' : `规格${index + 1}`,
    sku: '',
    specification: '单份',
    saleMethod: '按份',
    priceYuan: '19.90',
    originalPriceYuan: '',
    supplyPriceYuan: '12.80',
    stock: '80',
    minimumOrderQuantity: '1',
    status: 'on_sale',
    sortOrder: String(index + 1),
    pricingMode: 'fixed',
    weightUnitLabel: '斤',
    weightUnitGrams: '500',
    weightTolerancePercent: '5',
    lengthCm: '',
    widthCm: '',
    heightCm: '',
    volumeLiters: '',
    weightKg: '',
  };
}

const initialCategoryForm: CategoryForm = {
  id: '',
  code: '',
  name: '',
  sortOrder: '0',
  status: 'active',
};

const initialProcurementBuyerForm: ProcurementBuyerForm = {
  id: '',
  name: '',
  contactName: '',
  contactPhone: '',
  licenseUrl: '',
  status: 'active',
  remark: '',
};

const initialPickupPointForm: PickupPointForm = {
  id: '',
  name: '',
  addressText: '',
  latitude: '',
  longitude: '',
  businessHours: '08:00-20:00',
  status: 'active',
  communityName: '',
  leaderName: '',
  leaderPhone: '',
  sortOrder: '10',
};

const initialPickupPointFilters: PickupPointFilterState = {
  keyword: '',
  status: '',
  community: '',
};

const initialGroupLeaderForm: GroupLeaderForm = {
  id: '',
  pickupPointId: '',
  userId: '',
  name: '',
  phone: '',
  status: 'active',
  serviceNote: '',
};

const initialGroupLeaderFilters: GroupLeaderFilterState = {
  keyword: '',
  status: '',
  pickupPointId: '',
};

const initialProductFilters: MallFilterState = {
  keyword: '',
  categoryCode: '',
  status: '',
  stockStatus: '',
  sort: 'updated_desc',
  page: '1',
  pageSize: '20',
};

const initialCategoryFilters: MallFilterState = {
  keyword: '',
  categoryCode: '',
  status: '',
  stockStatus: '',
  sort: '',
  page: '1',
  pageSize: '100',
};

const initialInventoryFilters: MallFilterState = {
  keyword: '',
  categoryCode: '',
  status: '',
  stockStatus: 'alert',
  sort: '',
  page: '1',
  pageSize: '100',
};

const productSortOptions = [
  { value: 'updated_desc', label: '最近编辑' },
  { value: 'updated_asc', label: '最早编辑' },
  { value: 'price_asc', label: '价格从低到高' },
  { value: 'price_desc', label: '价格从高到低' },
  { value: 'stock_asc', label: '库存从低到高' },
  { value: 'stock_desc', label: '库存从高到低' },
  { value: 'category_asc', label: '类目 A-Z' },
  { value: 'category_desc', label: '类目 Z-A' },
  { value: 'name_asc', label: '商品名 A-Z' },
  { value: 'name_desc', label: '商品名 Z-A' },
  { value: 'newest', label: '最新上架' },
  { value: 'oldest', label: '最早上架' },
];

const productPageSizeOptions = ['10', '20', '50', '100'];

const campaignTypeOptions = [
  { value: 'full_reduction', label: '满减' },
  { value: 'full_discount', label: '满折' },
  { value: 'free_delivery', label: '免运费' },
  { value: 'delivery_reduction', label: '减运费' },
  { value: 'fixed_price', label: '一口价' },
  { value: 'promotion_venue', label: '大促会场' },
];

const campaignScopeOptions = [
  { value: 'all', label: '全部商品' },
  { value: 'partial', label: '部分商品' },
  { value: 'product_group', label: '商品组' },
];

const campaignAudienceOptions = [
  { value: 'all', label: '全部用户' },
  { value: 'new_customer', label: '新客专享' },
];

const newCustomerRuleOptions = [
  { value: 'first_product_purchase', label: '第一次购买此商品' },
  { value: 'first_store_order', label: '第一次在本店下单' },
  { value: 'first_platform_order', label: '第一次在叁友甄选下单' },
];

const fixedPriceBadgePositionOptions = [
  { value: 'top_left', label: '左上角' },
  { value: 'top_right', label: '右上角' },
  { value: 'bottom_left', label: '左下角' },
  { value: 'bottom_right', label: '右下角' },
];

const createCampaignTierForm = (overrides: Partial<CampaignTierForm> = {}): CampaignTierForm => ({
  id: overrides.id || `tier-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`,
  thresholdYuan: overrides.thresholdYuan || '49',
  discountYuan: overrides.discountYuan || '6',
  discountPercent: overrides.discountPercent || '95',
});

const createCampaignProductGroupForm = (overrides: Partial<CampaignProductGroupForm> = {}): CampaignProductGroupForm => ({
  id: overrides.id || `group-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`,
  name: overrides.name || '商品组',
  productIds: overrides.productIds || '',
});

const createFixedPriceGroupForm = (overrides: Partial<FixedPriceCampaignGroupForm> = {}): FixedPriceCampaignGroupForm => ({
  id: overrides.id || `group-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`,
  name: overrides.name || '默认商品组',
  startsAt: overrides.startsAt || '',
  endsAt: overrides.endsAt || '',
  items: overrides.items || [],
});

const createGroupBuyTierForm = (overrides: Partial<GroupBuyTierForm> = {}): GroupBuyTierForm => ({
  id: overrides.id || `tier-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`,
  quantity: overrides.quantity || '20',
  priceYuan: overrides.priceYuan || '19.90',
});

const initialCampaignForm: CampaignForm = {
  id: '',
  name: '鲜选满减',
  campaignType: 'full_reduction',
  budgetYuan: '3000',
  status: 'active',
  startsAt: '',
  endsAt: '',
  displayTitle: '鲜选满减',
  tagText: '满99减10',
  iconText: '减',
  iconUrl: '',
  tagBackgroundColor: '#FFF1E5',
  tagTextColor: '#E85D04',
  ruleExplanation: '活动期间，参与商品满99元减10元。',
  limitText: '限活动商品；退款后按实付金额退回。',
  scopeType: 'all',
  productIds: '',
  productGroups: [],
  audienceType: 'all',
  newCustomerRule: 'first_platform_order',
  tiers: [createCampaignTierForm()],
};

const initialFixedPriceCampaignForm: FixedPriceCampaignForm = {
  id: '',
  name: '本周一口价',
  status: 'active',
  startsAt: '',
  endsAt: '',
  badgeText: '一口价',
  badgeIcon: '¥',
  badgeIconUrl: '',
  badgeBackgroundColor: '#FF9238',
  badgeTextColor: '#FFFFFF',
  badgePosition: 'top_left',
  groups: [createFixedPriceGroupForm()],
};

const initialPromotionVenueForm: PromotionVenueForm = {
  id: '',
  name: '周末大促会场',
  status: 'active',
  title: '周末大促',
  tagText: '大促',
  subtitle: '限时精选',
  copy: '生鲜好货集中上新',
  limitText: '限会场商品参与，具体优惠以下单页为准。',
  buttonText: '进入会场',
  iconText: '促',
  iconUrl: '',
  backgroundImageUrl: '',
  backgroundColor: '#F4FBF5',
  textColor: '#153A24',
  entryPosition: 'home_after_banner',
  sortOrder: '10',
  items: [],
};

const emptyGroupBuyForm: GroupBuyForm = {
  id: '',
  name: '',
  productId: '',
  variantId: '',
  startsAt: '',
  endsAt: '',
  balanceDueAt: '',
  minGroupQuantity: '20',
  maxQuantityPerUser: '',
  minCreditScore: '80',
  overdueCreditPenalty: '10',
  depositType: 'percent',
  depositValue: '20',
  tiers: [createGroupBuyTierForm()],
};

const initialCouponForm: CouponForm = {
  id: '',
  name: '新人满49减6',
  code: `COUPON-${Date.now().toString().slice(-6)}`,
  couponType: 'full_reduction',
  thresholdYuan: '49',
  discountYuan: '6',
  totalQuantity: '1000',
  perUserLimit: '1',
  status: 'active',
  startsAt: '',
  endsAt: '',
  description: '新用户首单可用，满足门槛自动抵扣。',
};

const initialHomeBannerForm: HomeBannerForm = {
  id: '',
  title: '叁友甄选今日鲜果',
  subtitle: '邻里一起拼，新鲜果蔬当天到点',
  imageUrl: '',
  linkType: 'category',
  linkTarget: 'fruit',
  sortOrder: '10',
  status: 'active',
  startsAt: '',
  endsAt: '',
  tag: '安心溯源',
};

const initialHomeSectionForm: HomeSectionForm = {
  id: '',
  sectionType: 'announcement',
  title: '今日到货提醒',
  subtitle: '',
  content: '草莓、鲜奶、鸡蛋 16:00 后可提',
  imageUrl: '',
  linkType: 'none',
  linkTarget: '',
  productIds: '',
  rules: '{"displayLimit":6}',
  sortOrder: '10',
  status: 'active',
  startsAt: '',
  endsAt: '',
};

const homeSectionPageConfigs: Record<string, { sectionType: string; title: string; description: string; defaults: Partial<HomeSectionForm> }> = {
  'mall.homeNotices': {
    sectionType: 'announcement',
    title: '公告栏配置',
    description: '维护首页顶部单行滚动公告，可用于今日到货、配送时效、售后通知和团长招募。',
    defaults: {
      sectionType: 'announcement',
      title: '今日到货提醒',
      content: '草莓、鲜奶、鸡蛋 16:00 后可提',
      rules: '{"audience":"all"}',
      sortOrder: '10',
    },
  },
  'mall.homeFlashSale': {
    sectionType: 'flash_sale',
    title: '秒杀专区',
    description: '配置首页最醒目的秒杀专区，每日早 8 点 / 晚 6 点两场，支持指定商品或按标签/库存自动选品。',
    defaults: {
      sectionType: 'flash_sale',
      title: '秒杀专区',
      subtitle: '早 8 点 / 晚 6 点，每日两场',
      content: '剩余库存',
      linkType: 'search',
      linkTarget: '秒杀',
      rules: '{"sessions":[8,18],"displayLimit":2,"autoPick":"tag_or_low_stock","tagKeywords":["秒杀","特价","爆款"]}',
      sortOrder: '10',
    },
  },
  'mall.homeNewArrivals': {
    sectionType: 'new_arrival',
    title: '新上专区',
    description: '配置每日上新 10-15 款专区，可指定商品池，未指定时按今日/新品/新上/现货标签自动挑选。',
    defaults: {
      sectionType: 'new_arrival',
      title: '新上专区',
      subtitle: '每日上新 10-15 款',
      content: '今日刚到',
      linkType: 'search',
      linkTarget: '新品',
      rules: '{"displayLimit":6,"autoPick":"tag","tagKeywords":["今日","新品","新上","现货"],"badge":"今日刚到"}',
      sortOrder: '20',
    },
  },
  'mall.homeHotProducts': {
    sectionType: 'best_seller',
    title: '爆款推荐',
    description: '配置平台销量 TOP10 推荐位，可手动指定商品，未指定时按 soldCount 自动排序。',
    defaults: {
      sectionType: 'best_seller',
      title: '爆款推荐',
      subtitle: '平台销量 TOP10 自动更新',
      content: 'TOP10',
      linkType: 'search',
      linkTarget: '爆款',
      rules: '{"displayLimit":10,"autoPick":"sold_count","badgePrefix":"TOP"}',
      sortOrder: '30',
    },
  },
};

const initialSettingsForm: SettingsForm = {
  freeDeliveryThresholdYuan: '99',
  defaultDeliveryFeeYuan: '6',
  deliveryPromiseMinutes: '18',
  refundReviewMinutes: '10',
  coldChainEnabled: true,
  deliveryRangeEnabled: false,
  deliveryOriginLatitude: '',
  deliveryOriginLongitude: '',
  deliveryOriginAddress: '',
  deliveryRangeRadiusKm: '5',
  deliveryRangePolygon: '',
  deliveryFeeTiersText: '0-2=0\n2-3=3\n3-5=4',
  pickupWindowStart: '16:00',
  pickupWindowEnd: '20:00',
  deliveryBatchTimes: '10:00,14:00,18:00',
  leaderCommissionRate: '8',
  platformServiceRate: '3',
  supplierSettlementCycle: 'T+7',
  withdrawMinYuan: '100',
};

const permissionModuleOptions = [
  ['products', '商品管理'],
  ['orders', '订单履约'],
  ['marketing', '营销活动'],
  ['support', '客服售后'],
  ['finance', '财务分账'],
  ['settings', '运营设置'],
  ['data', '运营数据'],
  ['leaders', '团长管理'],
] as const;

const permissionActionOptions = [
  ['view', '查看'],
  ['create', '新增'],
  ['update', '编辑'],
  ['delete', '删除'],
  ['approve', '审核'],
  ['refund', '退款'],
  ['export', '导出'],
  ['dispatch', '派车'],
] as const;

const initialPermissionForm: MallPermissionForm = {
  id: '',
  name: '',
  roleKey: '',
  description: '',
  modules: ['products'],
  actions: ['view'],
  status: 'active',
};

const initialPermissionFilters: MallPermissionFilterState = {
  keyword: '',
  status: '',
  module: '',
};

const initialMallOpsFilters: MallOpsFilterState = {
  keyword: '',
  status: '',
  date: '',
  community: '',
};

const initialMallOrderDetailSearchFilters: MallOrderDetailSearchFilters = {
  orderNo: '',
  userPhone: '',
  merchantId: '',
  startDate: '',
  endDate: '',
};

const initialWithdrawalForm: WithdrawalForm = {
  amountYuan: '',
  note: '平台运营提现申请',
};

const initialSupportForm: SupportForm = {
  userId: '',
  topic: '订单配送咨询',
  message: '您好，客服已收到您的问题，正在核实订单状态。',
  ticketTitle: '配送时效工单',
  ticketCategory: 'delivery',
  ticketPriority: 'normal',
  ticketOrderId: '',
  knowledgeTitle: '坏果包赔处理口径',
  knowledgeCategory: '售后',
  knowledgeContent: '用户上传商品破损或坏果照片后，客服核对订单、配送记录和证据图片，符合规则的按原路退款或补发处理。',
};

const initialSupportFilters: SupportFilterState = {
  keyword: '',
  status: 'open',
  category: '',
  priority: '',
};

function createApiUrl(pathname: string, params: JsonRecord = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    search.set(key, String(value));
  });
  const query = search.toString();
  return `${API_BASE}${pathname}${query ? `?${query}` : ''}`;
}

async function apiRequest<T>(pathname: string, init: RequestInit = {}, params?: JsonRecord): Promise<T> {
  const session = getStoredAdminSession();
  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;
  const response = await fetch(createApiUrl(pathname, params), {
    ...init,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
      ...(init.headers || {}),
    },
  });
  const payload = (await response.json().catch(() => ({}))) as ApiEnvelope<T>;
  const code = typeof payload.code === 'string' ? Number(payload.code) : payload.code;
  const statusCode = typeof payload.statusCode === 'string' ? Number(payload.statusCode) : payload.statusCode;

  if (
    pathname !== '/api/auth/login'
    && (isAuthFailureStatus(response.status) || isAuthFailureStatus(statusCode) || isAuthFailureStatus(code))
  ) {
    handleAdminAuthFailure(payload.message || '登录已过期，请重新登录');
  }

  if (!response.ok || (typeof statusCode === 'number' && statusCode >= 400) || (typeof code === 'number' && code >= 400)) {
    throw new Error(payload.message || `请求失败 ${response.status}`);
  }
  return (payload.data ?? payload) as T;
}

function apiGet<T>(pathname: string, params?: JsonRecord) {
  return apiRequest<T>(pathname, {}, params);
}

function apiPost<T>(pathname: string, body: JsonRecord = {}) {
  return apiRequest<T>(pathname, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

function apiPut<T>(pathname: string, body: JsonRecord = {}) {
  return apiRequest<T>(pathname, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

function apiDelete<T>(pathname: string) {
  return apiRequest<T>(pathname, { method: 'DELETE' });
}

function apiUpload<T>(pathname: string, file: File) {
  const formData = new FormData();
  formData.set('file', file);
  return apiRequest<T>(pathname, {
    method: 'POST',
    body: formData,
  });
}

function normalizeLoadedValue<T>(key: string, fallback: T, value: T, errors: LoadErrors): T {
  if (Array.isArray(fallback)) {
    if (Array.isArray(value)) return value;
    errors[key] = '数据格式异常';
    return fallback;
  }

  if (fallback && typeof fallback === 'object') {
    if (value && typeof value === 'object' && !Array.isArray(value)) return value;
    errors[key] = '数据格式异常';
    return fallback;
  }

  return value ?? fallback;
}

async function loadWithFallback<T>(
  key: string,
  fallback: T,
  errors: LoadErrors,
  loader: () => Promise<T>,
) {
  try {
    return normalizeLoadedValue(key, fallback, await loader(), errors);
  } catch (error) {
    errors[key] = error instanceof Error ? error.message : '加载失败';
    return fallback;
  }
}

async function fetchDashboardData(
  productFilters: MallFilterState = initialProductFilters,
  categoryFilters: MallFilterState = initialCategoryFilters,
  inventoryFilters: MallFilterState = initialInventoryFilters,
  campaignFilters: MallFilterState = initialProductFilters,
  couponFilters: MallFilterState = initialProductFilters,
  homeBannerFilters: MallFilterState = initialProductFilters,
  permissionFilters: MallPermissionFilterState = initialPermissionFilters,
  pickupPointFilters: PickupPointFilterState = initialPickupPointFilters,
  groupLeaderFilters: GroupLeaderFilterState = initialGroupLeaderFilters,
) {
  const errors: LoadErrors = {};
  const [
    adminStats,
    users,
    vehicles,
    transportOrders,
    commissionPending,
    commissionSummary,
    mallOverview,
    mallCategories,
    mallProducts,
    mallProcurementBuyers,
    mallInventoryAlerts,
    mallOrders,
    mallAfterSales,
    mallOpsOverview,
    mallDeliverySheets,
    mallPickupPoints,
    mallGroupLeaders,
    mallFinanceBills,
    mallSettlementRecords,
    mallWithdrawalRequests,
    mallSalesStats,
    campaigns,
    fixedPriceCampaigns,
    promotionVenues,
    mallGroupBuys,
    mallCoupons,
    mallHomeBanners,
    mallHomeSections,
    mallPermissions,
    mallSettings,
    supportMetrics,
    supportSessions,
    supportTickets,
    supportKnowledge,
    enterprises,
    demands,
    cancellations,
    ownerWithdrawals,
    trips,
    undispatchedOrders,
    allOrders,
    availableVehicles,
  ] = await Promise.all([
    loadWithFallback('平台统计', {}, errors, () => apiGet<JsonRecord>('/api/admin/statistics')),
    loadWithFallback('账号列表', [], errors, () => apiGet<JsonRecord[]>('/api/admin/users', { limit: 80 })),
    loadWithFallback('车辆列表', [], errors, () => apiGet<JsonRecord[]>('/api/vehicles', { limit: 80 })),
    loadWithFallback('运力订单', [], errors, () => apiGet<JsonRecord[]>('/api/admin/orders', { limit: 80 })),
    loadWithFallback('佣金待审', [], errors, () => apiGet<JsonRecord[]>('/api/orders/commission-pending')),
    loadWithFallback('佣金统计', {}, errors, () => apiGet<JsonRecord>('/api/orders/commission-summary')),
    loadWithFallback('商城概览', {}, errors, () => apiGet<JsonRecord>('/api/admin/mall/overview')),
    loadWithFallback('商城类目', [], errors, () => apiGet<JsonRecord[]>('/api/admin/mall/categories', {
      keyword: categoryFilters.keyword,
      status: categoryFilters.status,
    })),
    loadWithFallback('商城商品', [], errors, () => apiGet<JsonRecord[]>('/api/admin/mall/products', {
      keyword: productFilters.keyword,
      categoryCode: productFilters.categoryCode,
      status: productFilters.status,
      stockStatus: productFilters.stockStatus,
      sort: productFilters.sort,
      page: productFilters.page,
      pageSize: productFilters.pageSize,
    })),
    loadWithFallback('采购商', [], errors, () => apiGet<JsonRecord[]>('/api/admin/mall/procurement-buyers')),
    loadWithFallback('库存预警', [], errors, () => apiGet<JsonRecord[]>('/api/admin/mall/inventory-alerts', {
      keyword: inventoryFilters.keyword,
      categoryCode: inventoryFilters.categoryCode,
      status: inventoryFilters.status,
      stockStatus: inventoryFilters.stockStatus,
    })),
    loadWithFallback('商城订单', [], errors, () => apiGet<JsonRecord[]>('/api/admin/mall/orders')),
    loadWithFallback('售后申请', [], errors, () => apiGet<JsonRecord[]>('/api/admin/mall/after-sales')),
    loadWithFallback('商城运营概览', {}, errors, () => apiGet<JsonRecord>('/api/admin/mall/ops/overview')),
    loadWithFallback('配送单', [], errors, () => apiGet<JsonRecord[]>('/api/admin/mall/delivery-sheets', { limit: 100 })),
    loadWithFallback('自提点', [], errors, () => apiGet<JsonRecord[]>('/api/admin/mall/pickup-points', {
      limit: 100,
      keyword: pickupPointFilters.keyword,
      status: pickupPointFilters.status,
      community: pickupPointFilters.community,
    })),
    loadWithFallback('团长', [], errors, () => apiGet<JsonRecord[]>('/api/admin/mall/group-leaders', {
      limit: 100,
      keyword: groupLeaderFilters.keyword,
      status: groupLeaderFilters.status,
      pickupPointId: groupLeaderFilters.pickupPointId,
    })),
    loadWithFallback('账单明细', [], errors, () => apiGet<JsonRecord[]>('/api/admin/mall/finance/bills', { limit: 100 })),
    loadWithFallback('结算记录', [], errors, () => apiGet<JsonRecord[]>('/api/admin/mall/finance/settlements', { limit: 100 })),
    loadWithFallback('提现申请', [], errors, () => apiGet<JsonRecord[]>('/api/admin/mall/finance/withdrawals', { limit: 100 })),
    loadWithFallback('销量统计', {}, errors, () => apiGet<JsonRecord>('/api/admin/mall/stats/sales', { period: '30d' })),
    loadWithFallback('营销活动', [], errors, () => apiGet<JsonRecord[]>('/api/admin/mall/campaigns', {
      keyword: campaignFilters.keyword,
      status: campaignFilters.status,
      categoryCode: campaignFilters.categoryCode,
      campaignType: campaignFilters.categoryCode,
    })),
    loadWithFallback('一口价活动', [], errors, () => apiGet<JsonRecord[]>('/api/admin/mall/campaigns', {
      campaignType: 'fixed_price',
      limit: 200,
    })),
    loadWithFallback('大促会场', [], errors, () => apiGet<JsonRecord[]>('/api/admin/mall/campaigns', {
      campaignType: 'promotion_venue',
      limit: 200,
    })),
    loadWithFallback('集采预售', [], errors, () => apiGet<JsonRecord[]>('/api/admin/mall/group-buys')),
    loadWithFallback('优惠券', [], errors, () => apiGet<JsonRecord[]>('/api/admin/mall/coupons', {
      keyword: couponFilters.keyword,
      status: couponFilters.status,
      couponType: couponFilters.categoryCode,
    })),
    loadWithFallback('首页配置', [], errors, () => apiGet<JsonRecord[]>('/api/admin/mall/home-banners', {
      keyword: homeBannerFilters.keyword,
      status: homeBannerFilters.status,
    })),
    loadWithFallback('首页专区', [], errors, () => apiGet<JsonRecord[]>('/api/admin/mall/home-sections')),
    loadWithFallback('运营权限', [], errors, () => apiGet<JsonRecord[]>('/api/admin/mall/permissions', {
      keyword: permissionFilters.keyword,
      status: permissionFilters.status,
      module: permissionFilters.module,
    })),
    loadWithFallback('商城设置', {}, errors, () => apiGet<JsonRecord>('/api/admin/mall/settings')),
    loadWithFallback('客服指标', {}, errors, () => apiGet<JsonRecord>('/api/support/metrics')),
    loadWithFallback('客服会话', [], errors, () => apiGet<JsonRecord[]>('/api/support/sessions')),
    loadWithFallback('客服工单', [], errors, () => apiGet<JsonRecord[]>('/api/support/tickets')),
    loadWithFallback('知识库', [], errors, () => apiGet<JsonRecord[]>('/api/support/knowledge')),
    loadWithFallback('企业列表', [], errors, () => apiGet<JsonRecord[]>('/api/enterprise', { limit: 100 }).catch(() => apiGet<JsonRecord[]>('/api/enterprise/admin/' + (getStoredAdminSession()?.user?.id || ''), { limit: 100 }))),
    loadWithFallback('需求列表', [], errors, () => apiGet<JsonRecord[]>('/api/demands', { limit: 100 })),
    loadWithFallback('取消申请', [], errors, () => apiGet<JsonRecord[]>('/api/cancellations/pending')),
    loadWithFallback('提现记录', [], errors, () => apiGet<JsonRecord[]>('/api/admin/owner-withdrawals')),
    loadWithFallback('行程列表', [], errors, () => apiGet<JsonRecord[]>('/api/trips', { limit: 100 })),
    loadWithFallback('未分配订单', [], errors, () => apiGet<JsonRecord[]>('/api/trips/undispatched-orders')),
    loadWithFallback('全部订单', [], errors, () => apiGet<JsonRecord[]>('/api/trips/all-orders')),
    loadWithFallback('可用车辆', [], errors, () => apiGet<JsonRecord[]>('/api/trips/available-vehicles')),
  ]);

  return {
    data: {
      adminStats,
      users,
      vehicles,
      transportOrders,
      commissionPending,
      commissionSummary,
      mallOverview,
      mallCategories,
      mallProducts,
      mallProcurementBuyers,
      mallInventoryAlerts,
      mallOrders,
      mallAfterSales,
      mallOpsOverview,
      mallDeliverySheets,
      mallPickupPoints,
      mallGroupLeaders,
      mallFinanceBills,
      mallSettlementRecords,
      mallWithdrawalRequests,
      mallSalesStats,
      campaigns,
      fixedPriceCampaigns,
      promotionVenues,
      mallGroupBuys,
      mallCoupons,
      mallHomeBanners,
      mallHomeSections,
      mallPermissions,
      mallSettings,
      supportMetrics,
      supportSessions,
      supportTickets,
      supportKnowledge,
      enterprises,
      demands,
      cancellations,
      ownerWithdrawals,
      trips,
      undispatchedOrders,
      allOrders,
      availableVehicles,
    },
    errors,
  };
}

function stringValue(record: JsonRecord | undefined, key: string, fallback = '') {
  const value = record?.[key];
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
}

function numberValue(record: JsonRecord | undefined, key: string, fallback = 0) {
  const value = record?.[key];
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function boolValue(record: JsonRecord | undefined, key: string, fallback = false) {
  const value = record?.[key];
  return typeof value === 'boolean' ? value : fallback;
}

function arrayValue(record: JsonRecord | undefined, key: string) {
  const value = record?.[key];
  return Array.isArray(value) ? value : [];
}

function recordValue(record: JsonRecord | undefined, key: string) {
  const value = record?.[key];
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function yuan(cents: number) {
  return `¥${(cents / 100).toFixed(2)}`;
}

function moneyFromYuan(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

function optionalNumber(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function numberTextValue(record: JsonRecord | undefined, key: string, fallback = '') {
  const value = record?.[key];
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'string') return value;
  return fallback;
}

function parseDeliveryFeeTiers(text: string) {
  return text
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const match = line.match(/^(\d+(?:\.\d+)?)\s*(?:-|~|至)\s*(\d+(?:\.\d+)?)\s*(?:公里|km)?\s*(?:=|:|：|\s+)\s*(\d+(?:\.\d+)?)\s*(?:元\/公里|元每公里|元|\/km)?$/i);
      if (!match) {
        throw new Error(`阶梯运费格式不正确：${line}`);
      }
      const [, minValue, maxValue, feeValue] = match;
      const minKm = Number(minValue);
      const maxKm = Number(maxValue);
      const feeYuanPerKm = Number(feeValue);
      if (!Number.isFinite(minKm) || !Number.isFinite(maxKm) || !Number.isFinite(feeYuanPerKm) || maxKm <= minKm || feeYuanPerKm < 0) {
        throw new Error(`阶梯运费数值不正确：${line}`);
      }
      return {
        minKm,
        maxKm,
        feeYuanPerKm,
        feeCentsPerKm: Math.round(feeYuanPerKm * 100),
      };
    });
}

function formatDeliveryFeeTiers(value: unknown) {
  if (!Array.isArray(value)) return initialSettingsForm.deliveryFeeTiersText;
  const lines = value
    .map(item => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return '';
      const record = item as JsonRecord;
      const minKm = numberValue(record, 'minKm', Number.NaN);
      const maxKm = numberValue(record, 'maxKm', Number.NaN);
      const feeYuanPerKm = numberValue(record, 'feeYuanPerKm', numberValue(record, 'feeCentsPerKm', 0) / 100);
      if (!Number.isFinite(minKm) || !Number.isFinite(maxKm) || !Number.isFinite(feeYuanPerKm)) return '';
      return `${minKm}-${maxKm}=${feeYuanPerKm}`;
    })
    .filter(Boolean);
  return lines.length ? lines.join('\n') : initialSettingsForm.deliveryFeeTiersText;
}

function deliveryFeeTierSummary(text: string) {
  try {
    const tiers = parseDeliveryFeeTiers(text);
    if (!tiers.length) return '未设置';
    return tiers.map(tier => `${tier.minKm}-${tier.maxKm}km ¥${tier.feeYuanPerKm}/km`).join('，');
  } catch {
    return '格式待修正';
  }
}

function deliveryFeeTierCount(text: string) {
  try {
    return parseDeliveryFeeTiers(text).length;
  } catch {
    return 0;
  }
}

function parseDeliveryRangePolygon(text: string) {
  const raw = text.trim();
  if (!raw) return [];
  const normalizePoint = (item: unknown) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    const record = item as JsonRecord;
    const latitude = numberValue(record, 'latitude', Number.NaN);
    const longitude = numberValue(record, 'longitude', Number.NaN);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return { latitude, longitude };
  };

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      throw new Error('范围坐标 JSON 必须是数组');
    }
    const points = parsed.map(normalizePoint).filter(Boolean) as Array<{ latitude: number; longitude: number }>;
    if (points.length !== parsed.length || (points.length > 0 && points.length < 3)) {
      throw new Error('范围坐标至少需要 3 个点');
    }
    return points;
  } catch (error) {
    if (raw.startsWith('[')) {
      throw error instanceof Error ? error : new Error('范围坐标格式不正确');
    }
  }

  const points = raw
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const [latitudeText, longitudeText] = line.split(/[,，\s]+/);
      const latitude = Number(latitudeText);
      const longitude = Number(longitudeText);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        throw new Error(`范围坐标格式不正确：${line}`);
      }
      return { latitude, longitude };
    });
  if (points.length > 0 && points.length < 3) {
    throw new Error('范围坐标至少需要 3 个点');
  }
  return points;
}

function formatDeliveryRangePolygon(value: unknown) {
  if (!Array.isArray(value)) return '';
  return value
    .map(item => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return '';
      const record = item as JsonRecord;
      const latitude = numberValue(record, 'latitude', Number.NaN);
      const longitude = numberValue(record, 'longitude', Number.NaN);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return '';
      return `${latitude},${longitude}`;
    })
    .filter(Boolean)
    .join('\n');
}

function validateProductForm(form: ProductForm) {
  const images = productFormImages(form);
  if (images.length > productImageLimit) {
    throw new Error(`单个商品最多上传 ${productImageLimit} 张图片`);
  }
  for (const [label, value] of [
    ['名称', form.name],
    ['类目', form.categoryCode],
    ['状态', form.status],
    ['商品说明', form.description],
  ]) {
    if (!String(value).trim()) {
      throw new Error(`${label}不能为空`);
    }
  }
  if (!form.variants.length) {
    throw new Error('至少需要一个商品规格');
  }
  if (form.variants.length > productVariantLimit) {
    throw new Error(`单个商品最多配置 ${productVariantLimit} 个规格`);
  }
  form.variants.forEach((variant, index) => {
    if (!variant.name.trim()) {
      throw new Error(`第 ${index + 1} 个规格名称不能为空`);
    }
    if (!variant.specification.trim()) {
      throw new Error(`第 ${index + 1} 个规格不能为空`);
    }
    if (!variant.saleMethod.trim()) {
      throw new Error(`第 ${index + 1} 个售卖方式不能为空`);
    }
    if (moneyFromYuan(variant.priceYuan) <= 0) {
      throw new Error(`第 ${index + 1} 个规格售价必须大于0`);
    }
    if (moneyFromYuan(variant.supplyPriceYuan) <= 0) {
      throw new Error(`第 ${index + 1} 个规格进货价必须大于0`);
    }
    const variantStock = Number(variant.stock);
    if (!Number.isFinite(variantStock) || variantStock < 0) {
      throw new Error(`第 ${index + 1} 个规格库存不能小于0`);
    }
    const variantMinimumOrderQuantity = Number(variant.minimumOrderQuantity);
    if (!Number.isFinite(variantMinimumOrderQuantity) || variantMinimumOrderQuantity <= 0) {
      throw new Error(`第 ${index + 1} 个规格起订量必须大于0`);
    }
    if (variant.pricingMode === 'weighed') {
      const unitGrams = Number(variant.weightUnitGrams);
      const tolerance = Number(variant.weightTolerancePercent);
      if (!Number.isFinite(unitGrams) || unitGrams <= 0) {
        throw new Error(`第 ${index + 1} 个规格称重单位必须大于0克`);
      }
      if (!Number.isFinite(tolerance) || tolerance < 0 || tolerance > 50) {
        throw new Error(`第 ${index + 1} 个规格称重浮动范围需在0%-50%之间`);
      }
    }
  });
  form.qualificationReports.forEach((report, index) => {
    const hasAnyValue = [
      report.buyerId,
      report.reportName,
      report.reportType,
      report.reportUrl,
      report.issuer,
      report.issuedAt,
      report.expiresAt,
    ].some(value => String(value || '').trim());
    if (!hasAnyValue) return;
    if (!report.reportName.trim()) {
      throw new Error(`第 ${index + 1} 个资质报告名称不能为空`);
    }
    if (!report.reportUrl.trim()) {
      throw new Error(`第 ${index + 1} 个资质报告文件不能为空`);
    }
  });
}

function shortId(value: string) {
  if (!value) return '-';
  return value.length > 10 ? `${value.slice(0, 6)}...${value.slice(-4)}` : value;
}

function formatDate(value: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatMessageTime(value: number) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
}

function resolveImage(url: string) {
  if (!url) return '';
  if (/^(https?:|data:|blob:)/.test(url)) return url;
  if (url.startsWith('/')) return `${API_BASE}${url}`;
  return `${API_BASE}/api/uploads/${url}`;
}

function compactProductImages(values: string[]) {
  const seen = new Set<string>();
  return values
    .map(value => String(value || '').trim())
    .filter(Boolean)
    .filter(value => {
      if (seen.has(value)) return false;
      seen.add(value);
      return true;
    })
    .slice(0, productImageLimit);
}

function productImagesFromRecord(record: JsonRecord) {
  const imageKeys = arrayValue(record, 'imageKeys').map(item => String(item));
  const images = imageKeys.length ? imageKeys : arrayValue(record, 'images').map(item => String(item));
  const legacyImage = stringValue(record, 'imageKey', stringValue(record, 'imageUrl'));
  return compactProductImages(legacyImage ? [legacyImage, ...images] : images);
}

function productDisplayImagesFromRecord(record: JsonRecord) {
  const images = arrayValue(record, 'images').map(item => String(item));
  const imageUrl = stringValue(record, 'imageUrl');
  const resolvedImages = compactProductImages(imageUrl ? [imageUrl, ...images] : images);
  return resolvedImages.length ? resolvedImages : productImagesFromRecord(record);
}

function productFormImages(form: ProductForm) {
  return compactProductImages(form.imageUrl ? [form.imageUrl, ...form.images] : form.images);
}

function productProcurementBuyerIdsFromRecord(record: JsonRecord) {
  return arrayValue(record, 'procurementBuyers')
    .filter((item): item is JsonRecord => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    .map(buyer => stringValue(buyer, 'id'))
    .filter(Boolean);
}

function productQualificationReportsFromRecord(record: JsonRecord): ProductQualificationReportForm[] {
  return arrayValue(record, 'qualificationReports')
    .filter((item): item is JsonRecord => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    .map((report, index) => ({
      id: stringValue(report, 'id', `report-${index + 1}`),
      buyerId: stringValue(report, 'buyerId'),
      reportName: stringValue(report, 'reportName', stringValue(report, 'name', `资质报告${index + 1}`)),
      reportType: stringValue(report, 'reportType', stringValue(report, 'type')),
      reportUrl: stringValue(report, 'reportUrl', stringValue(report, 'url')),
      issuer: stringValue(report, 'issuer'),
      issuedAt: stringValue(report, 'issuedAt'),
      expiresAt: stringValue(report, 'expiresAt'),
    }));
}

function productQualificationReportsPayload(form: ProductForm) {
  return form.qualificationReports
    .map(report => ({
      id: report.id,
      buyerId: report.buyerId || undefined,
      reportName: report.reportName.trim(),
      reportType: report.reportType.trim() || undefined,
      reportUrl: report.reportUrl.trim(),
      issuer: report.issuer.trim() || undefined,
      issuedAt: report.issuedAt || undefined,
      expiresAt: report.expiresAt || undefined,
      hideSupplier: form.hideSupplier,
      status: 'active',
    }))
    .filter(report => report.reportName || report.reportUrl);
}

function procurementBuyerToForm(record: JsonRecord): ProcurementBuyerForm {
  return {
    id: stringValue(record, 'id'),
    name: stringValue(record, 'name'),
    contactName: stringValue(record, 'contactName'),
    contactPhone: stringValue(record, 'contactPhone'),
    licenseUrl: stringValue(record, 'licenseUrl'),
    status: stringValue(record, 'status', 'active'),
    remark: stringValue(record, 'remark'),
  };
}

function productVariantsFromRecord(record: JsonRecord): ProductVariantForm[] {
  const variants = arrayValue(record, 'variants')
    .filter((item): item is JsonRecord => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    .map((variant, index) => ({
      id: stringValue(variant, 'id', index === 0 ? 'default' : `variant-${index + 1}`),
      name: stringValue(variant, 'name', stringValue(variant, 'saleMethod', `规格${index + 1}`)),
      sku: stringValue(variant, 'sku'),
      specification: stringValue(variant, 'specification', stringValue(record, 'specification', stringValue(record, 'subtitle'))),
      saleMethod: stringValue(variant, 'saleMethod', stringValue(record, 'saleMethod', stringValue(record, 'specification', '按份'))),
      priceYuan: (numberValue(variant, 'priceCents', numberValue(record, 'priceCents')) / 100).toFixed(2),
      originalPriceYuan: numberValue(variant, 'originalPriceCents')
        ? (numberValue(variant, 'originalPriceCents') / 100).toFixed(2)
        : '',
      supplyPriceYuan: numberValue(variant, 'supplyPriceCents')
        ? (numberValue(variant, 'supplyPriceCents') / 100).toFixed(2)
        : '',
      stock: String(numberValue(variant, 'stock', numberValue(record, 'stock'))),
      minimumOrderQuantity: String(numberValue(variant, 'minimumOrderQuantity', numberValue(record, 'minimumOrderQuantity', 1))),
      status: stringValue(variant, 'status', stringValue(record, 'status', 'on_sale')),
      sortOrder: String(numberValue(variant, 'sortOrder', index + 1)),
      pricingMode: stringValue(variant, 'pricingMode', 'fixed'),
      weightUnitLabel: stringValue(variant, 'weightUnitLabel', '斤'),
      weightUnitGrams: String(numberValue(variant, 'weightUnitGrams', 500)),
      weightTolerancePercent: (numberValue(variant, 'weightToleranceBps', 500) / 100).toString(),
      lengthCm: stringValue(variant, 'lengthCm', stringValue(record, 'lengthCm')),
      widthCm: stringValue(variant, 'widthCm', stringValue(record, 'widthCm')),
      heightCm: stringValue(variant, 'heightCm', stringValue(record, 'heightCm')),
      volumeLiters: stringValue(variant, 'volumeLiters', stringValue(record, 'volumeLiters')),
      weightKg: stringValue(variant, 'weightKg', stringValue(record, 'weightKg')),
    }));
  if (variants.length) return variants.slice(0, productVariantLimit);
  return [{
    id: 'default',
    name: stringValue(record, 'saleMethod', stringValue(record, 'specification', '默认规格')),
    sku: stringValue(record, 'sku'),
    specification: stringValue(record, 'specification', stringValue(record, 'subtitle', '单份')),
    saleMethod: stringValue(record, 'saleMethod', stringValue(record, 'specification', '按份')),
    priceYuan: (numberValue(record, 'priceCents') / 100).toFixed(2),
    originalPriceYuan: numberValue(record, 'originalPriceCents')
      ? (numberValue(record, 'originalPriceCents') / 100).toFixed(2)
      : '',
    supplyPriceYuan: numberValue(record, 'supplyPriceCents')
      ? (numberValue(record, 'supplyPriceCents') / 100).toFixed(2)
      : '',
    stock: String(numberValue(record, 'stock')),
    minimumOrderQuantity: String(numberValue(record, 'minimumOrderQuantity', 1)),
    status: stringValue(record, 'status', 'on_sale'),
    sortOrder: '1',
    pricingMode: 'fixed',
    weightUnitLabel: '斤',
    weightUnitGrams: '500',
    weightTolerancePercent: '5',
    lengthCm: stringValue(record, 'lengthCm'),
    widthCm: stringValue(record, 'widthCm'),
    heightCm: stringValue(record, 'heightCm'),
    volumeLiters: stringValue(record, 'volumeLiters'),
    weightKg: stringValue(record, 'weightKg'),
  }];
}

function productVariantPayload(form: ProductForm) {
  return form.variants.slice(0, productVariantLimit).map((variant, index) => ({
    id: variant.id.trim() || (index === 0 ? 'default' : `variant-${index + 1}`),
    name: variant.name.trim() || variant.saleMethod.trim() || `规格${index + 1}`,
    sku: variant.sku.trim() || `${form.sku || 'SKU'}-${index + 1}`,
    specification: variant.specification.trim() || form.specification,
    saleMethod: variant.saleMethod.trim() || form.saleMethod,
    priceCents: moneyFromYuan(variant.priceYuan || form.priceYuan),
    originalPriceCents: variant.originalPriceYuan.trim() ? moneyFromYuan(variant.originalPriceYuan) : undefined,
    supplyPriceCents: variant.supplyPriceYuan.trim() ? moneyFromYuan(variant.supplyPriceYuan) : undefined,
    stock: Number(variant.stock) || 0,
    minimumOrderQuantity: Number(variant.minimumOrderQuantity) || 1,
    status: variant.status || 'on_sale',
    sortOrder: Number(variant.sortOrder) || index + 1,
    pricingMode: variant.pricingMode === 'weighed' ? 'weighed' : 'fixed',
    weightUnit: variant.weightUnitLabel.trim() === '公斤' ? 'kg' : variant.weightUnitLabel.trim() === '克' ? 'g' : 'jin',
    weightUnitLabel: variant.weightUnitLabel.trim() || '斤',
    weightUnitGrams: Number(variant.weightUnitGrams) || 500,
    weightToleranceBps: Math.round((Number(variant.weightTolerancePercent) || 0) * 100),
    lengthCm: optionalNumber(variant.lengthCm),
    widthCm: optionalNumber(variant.widthCm),
    heightCm: optionalNumber(variant.heightCm),
    volumeLiters: optionalNumber(variant.volumeLiters),
    weightKg: optionalNumber(variant.weightKg),
  }));
}

function primaryProductVariant(form: ProductForm) {
  return form.variants[0] || createDefaultProductVariantForm();
}

function productCompatibilityFields(form: ProductForm) {
  const primaryVariant = primaryProductVariant(form);
  return {
    specification: primaryVariant.specification,
    saleMethod: primaryVariant.saleMethod,
    priceYuan: primaryVariant.priceYuan,
    supplyPriceYuan: primaryVariant.supplyPriceYuan,
    stock: primaryVariant.stock,
    minimumOrderQuantity: primaryVariant.minimumOrderQuantity,
    lengthCm: primaryVariant.lengthCm,
    widthCm: primaryVariant.widthCm,
    heightCm: primaryVariant.heightCm,
    volumeLiters: primaryVariant.volumeLiters,
    weightKg: primaryVariant.weightKg,
  };
}

function tagsText(record: JsonRecord) {
  const tags = arrayValue(record, 'tags')
    .map(item => String(item))
    .filter(Boolean);
  return tags.length ? tags.join(' / ') : '-';
}

function productToForm(product: JsonRecord, fallbackCategoryCode = 'fruit'): ProductForm {
  const images = productImagesFromRecord(product);
  const variants = productVariantsFromRecord(product);
  const primaryVariant = variants[0] || createDefaultProductVariantForm();
  return {
    name: stringValue(product, 'name'),
    sku: stringValue(product, 'sku'),
    categoryCode: stringValue(product, 'categoryCode', fallbackCategoryCode),
    subtitle: stringValue(product, 'subtitle'),
    description: stringValue(product, 'description'),
    imageUrl: images[0] || '',
    images,
    specification: primaryVariant.specification || stringValue(product, 'specification', stringValue(product, 'subtitle')),
    saleMethod: primaryVariant.saleMethod || stringValue(product, 'saleMethod', stringValue(product, 'specification', stringValue(product, 'subtitle'))),
    priceYuan: primaryVariant.priceYuan || (numberValue(product, 'priceCents') / 100).toFixed(2),
    supplyPriceYuan: numberValue(product, 'supplyPriceCents')
      ? (numberValue(product, 'supplyPriceCents') / 100).toFixed(2)
      : primaryVariant.supplyPriceYuan,
    stock: primaryVariant.stock || String(numberValue(product, 'stock')),
    stockAlertThreshold: String(numberValue(product, 'stockAlertThreshold', 15)),
    minimumOrderQuantity: String(numberValue(product, 'minimumOrderQuantity', 1)),
    lengthCm: stringValue(product, 'lengthCm'),
    widthCm: stringValue(product, 'widthCm'),
    heightCm: stringValue(product, 'heightCm'),
    volumeLiters: stringValue(product, 'volumeLiters'),
    weightKg: stringValue(product, 'weightKg'),
    tags: arrayValue(product, 'tags').map(item => String(item)).join(','),
    status: stringValue(product, 'status', 'on_sale'),
    deliveryMinutes: String(numberValue(product, 'deliveryMinutes', 18)),
    coldChainRequired: boolValue(product, 'coldChainRequired'),
    variants,
    procurementBuyerIds: productProcurementBuyerIdsFromRecord(product),
    qualificationReports: productQualificationReportsFromRecord(product),
    hideSupplier: arrayValue(product, 'procurementBuyers')
      .some(item => Boolean(item) && typeof item === 'object' && boolValue(item as JsonRecord, 'hideSupplier')),
  };
}

function categoryToForm(category: JsonRecord): CategoryForm {
  return {
    id: stringValue(category, 'id'),
    code: stringValue(category, 'code'),
    name: stringValue(category, 'name'),
    sortOrder: String(numberValue(category, 'sortOrder')),
    status: stringValue(category, 'status', 'active'),
  };
}

function pickupPointToForm(point: JsonRecord): PickupPointForm {
  return {
    id: stringValue(point, 'id'),
    name: stringValue(point, 'name', recordPickupPointName(point)),
    addressText: stringValue(point, 'addressText', recordAddress(point)),
    latitude: stringValue(point, 'latitude'),
    longitude: stringValue(point, 'longitude'),
    businessHours: stringValue(point, 'businessHours'),
    status: stringValue(point, 'status', 'active'),
    communityName: recordCommunityName(point),
    leaderName: recordLeaderName(point),
    leaderPhone: recordLeaderPhone(point),
    sortOrder: String(numberValue(point, 'sortOrder')),
  };
}

function groupLeaderToForm(leader: JsonRecord): GroupLeaderForm {
  return {
    id: stringValue(leader, 'id'),
    pickupPointId: stringValue(leader, 'pickupPointId'),
    userId: stringValue(leader, 'userId'),
    name: stringValue(leader, 'name', recordLeaderName(leader)),
    phone: stringValue(leader, 'phone', recordLeaderPhone(leader)),
    status: stringValue(leader, 'status', 'active'),
    serviceNote: stringValue(leader, 'serviceNote'),
  };
}

function validatePickupPointForm(form: PickupPointForm) {
  for (const [label, value] of [
    ['自提点名称', form.name],
    ['自提点地址', form.addressText],
    ['状态', form.status],
  ]) {
    if (!String(value).trim()) {
      throw new Error(`${label}不能为空`);
    }
  }
  const sortOrder = Number(form.sortOrder);
  if (!Number.isFinite(sortOrder) || sortOrder < 0) {
    throw new Error('排序不能小于0');
  }
}

function validateGroupLeaderForm(form: GroupLeaderForm) {
  for (const [label, value] of [
    ['绑定自提点', form.pickupPointId],
    ['团长姓名', form.name],
    ['状态', form.status],
  ]) {
    if (!String(value).trim()) {
      throw new Error(`${label}不能为空`);
    }
  }
}

function stockLevelLabel(product: JsonRecord) {
  const stock = numberValue(product, 'stock');
  const threshold = numberValue(product, 'stockAlertThreshold', 15);
  if (stock <= 0) return '缺货';
  if (stock <= threshold) return '低库存';
  return '正常';
}

function couponTypeLabel(value: string) {
  const labels: Record<string, string> = {
    full_reduction: '满减券',
    cash: '现金券',
    delivery: '配送券',
    new_user: '新人券',
  };
  return labels[value] || value || '-';
}

function campaignTypeLabel(value: string) {
  const labels: Record<string, string> = {
    discount: '满减',
    full_reduction: '满减',
    full_discount: '满折',
    free_delivery: '免运费',
    delivery_reduction: '减运费',
    delivery_subsidy: '减运费',
    fixed_price: '一口价',
    promotion_venue: '大促会场',
  };
  return labels[value] || value || '-';
}

function campaignDisplayDefaults(campaignType: string, name = ''): CampaignDisplayConfig {
  const defaults: Record<string, Omit<CampaignDisplayConfig, 'title' | 'ruleExplanation' | 'limitText' | 'iconUrl'>> = {
    discount: { tagText: '满减', iconText: '减', backgroundColor: '#FFF1E5', textColor: '#E85D04' },
    full_reduction: { tagText: '满减', iconText: '减', backgroundColor: '#FFF1E5', textColor: '#E85D04' },
    full_discount: { tagText: '满折', iconText: '折', backgroundColor: '#FEE2E2', textColor: '#B91C1C' },
    free_delivery: { tagText: '免运费', iconText: '免', backgroundColor: '#EAF7EE', textColor: '#2F7E43' },
    delivery_reduction: { tagText: '减运费', iconText: '运', backgroundColor: '#EAF2FF', textColor: '#2563EB' },
    delivery_subsidy: { tagText: '减运费', iconText: '运', backgroundColor: '#EAF2FF', textColor: '#2563EB' },
    fixed_price: { tagText: '一口价', iconText: '¥', backgroundColor: '#FF9238', textColor: '#FFFFFF' },
    promotion_venue: { tagText: '大促', iconText: '促', backgroundColor: '#F4FBF5', textColor: '#153A24' },
  };
  const fallback = defaults[normalizeCampaignTypeForForm(campaignType)] || defaults.full_reduction;
  return {
    title: name || '优惠活动',
    tagText: fallback.tagText,
    iconText: fallback.iconText,
    iconUrl: '',
    backgroundColor: fallback.backgroundColor,
    textColor: fallback.textColor,
    ruleExplanation: '',
    limitText: '',
  };
}

function campaignDisplayFromRules(campaignType: string, name: string, rules: JsonRecord): CampaignDisplayConfig {
  const defaults = campaignDisplayDefaults(campaignType, name);
  const display = recordValue(rules, 'display');
  return {
    title: stringValue(display, 'title', defaults.title),
    tagText: stringValue(display, 'tagText', defaults.tagText),
    iconText: stringValue(display, 'iconText', defaults.iconText),
    iconUrl: stringValue(display, 'iconUrl', defaults.iconUrl),
    backgroundColor: stringValue(display, 'backgroundColor', defaults.backgroundColor),
    textColor: stringValue(display, 'textColor', defaults.textColor),
    ruleExplanation: stringValue(display, 'ruleExplanation', defaults.ruleExplanation),
    limitText: stringValue(display, 'limitText', defaults.limitText),
  };
}

function campaignDisplayFromForm(form: CampaignForm): CampaignDisplayConfig {
  const defaults = campaignDisplayDefaults(form.campaignType, form.name);
  return {
    title: form.displayTitle.trim() || form.name.trim() || defaults.title,
    tagText: form.tagText.trim() || defaults.tagText,
    iconText: form.iconText.trim(),
    iconUrl: form.iconUrl.trim(),
    backgroundColor: form.tagBackgroundColor || defaults.backgroundColor,
    textColor: form.tagTextColor || defaults.textColor,
    ruleExplanation: form.ruleExplanation.trim(),
    limitText: form.limitText.trim(),
  };
}

function fixedPriceBadgePositionLabel(value: string) {
  return fixedPriceBadgePositionOptions.find(option => option.value === value)?.label || value || '-';
}

const promotionVenueEntryPositionOptions = [
  { value: 'home_top', label: '首页顶部' },
  { value: 'home_after_banner', label: '轮播下方' },
  { value: 'home_after_flash', label: '秒杀下方' },
  { value: 'category_top', label: '商品列表顶部' },
];

function promotionVenueEntryPositionLabel(value: string) {
  return promotionVenueEntryPositionOptions.find(option => option.value === value)?.label || value || '-';
}

function linkTypeLabel(value: string) {
  const labels: Record<string, string> = {
    none: '不跳转',
    category: '品类',
    product: '商品',
    search: '搜索',
    activity: '活动',
    url: '链接',
  };
  return labels[value] || value || '-';
}

function homeSectionTypeLabel(value: string) {
  const labels: Record<string, string> = {
    announcement: '公告栏',
    flash_sale: '秒杀专区',
    new_arrival: '新上专区',
    best_seller: '爆款推荐',
  };
  return labels[value] || value || '-';
}

function supportCategoryLabel(value: string) {
  const labels: Record<string, string> = {
    delivery: '配送',
    after_sales: '售后',
    payment: '支付',
    product: '商品',
    account: '账号',
  };
  return labels[value] || value || '-';
}

function priorityLabel(value: string) {
  const labels: Record<string, string> = {
    urgent: '紧急',
    high: '高',
    normal: '普通',
    low: '低',
  };
  return labels[value] || value || '-';
}

function datetimeLocalValue(value: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().slice(0, 16);
}

function homeBannerToForm(banner: JsonRecord): HomeBannerForm {
  const metadata = recordValue(banner, 'metadata');
  return {
    id: stringValue(banner, 'id'),
    title: stringValue(banner, 'title'),
    subtitle: stringValue(banner, 'subtitle'),
    imageUrl: stringValue(banner, 'imageUrl'),
    linkType: stringValue(banner, 'linkType', 'none'),
    linkTarget: stringValue(banner, 'linkTarget'),
    sortOrder: String(numberValue(banner, 'sortOrder')),
    status: stringValue(banner, 'status', 'draft'),
    startsAt: datetimeLocalValue(stringValue(banner, 'startsAt')),
    endsAt: datetimeLocalValue(stringValue(banner, 'endsAt')),
    tag: stringValue(metadata, 'tag'),
  };
}

function homeSectionToForm(section: JsonRecord): HomeSectionForm {
  return {
    id: stringValue(section, 'id'),
    sectionType: stringValue(section, 'sectionType', 'announcement'),
    title: stringValue(section, 'title'),
    subtitle: stringValue(section, 'subtitle'),
    content: stringValue(section, 'content'),
    imageUrl: stringValue(section, 'imageUrl'),
    linkType: stringValue(section, 'linkType', 'none'),
    linkTarget: stringValue(section, 'linkTarget'),
    productIds: arrayValue(section, 'productIds').map(item => String(item)).join(','),
    rules: JSON.stringify(recordValue(section, 'rules'), null, 2),
    sortOrder: String(numberValue(section, 'sortOrder')),
    status: stringValue(section, 'status', 'draft'),
    startsAt: datetimeLocalValue(stringValue(section, 'startsAt')),
    endsAt: datetimeLocalValue(stringValue(section, 'endsAt')),
  };
}

function normalizeCampaignTypeForForm(value: string) {
  if (value === 'discount') return 'full_reduction';
  if (value === 'delivery_subsidy' || value === 'subsidy') return 'delivery_reduction';
  if (campaignTypeOptions.some(option => option.value === value)) return value;
  return 'full_reduction';
}

function idListFromText(value: string) {
  return value
    .split(/[\s,，、]+/)
    .map(item => item.trim())
    .filter(Boolean);
}

function idTextFromArray(values: unknown[]) {
  return values
    .map(item => String(item || '').trim())
    .filter(Boolean)
    .join('\n');
}

function campaignTiersFromRules(rules: JsonRecord, campaignType: string): CampaignTierForm[] {
  const tierRecords = arrayValue(rules, 'tiers')
    .filter((item): item is JsonRecord => Boolean(item) && typeof item === 'object' && !Array.isArray(item));
  const source = tierRecords.length ? tierRecords : [rules];
  const tiers = source
    .map((tier, index) => {
      const thresholdCents = numberValue(tier, 'thresholdCents', index === 0 ? numberValue(rules, 'thresholdCents', 4900) : 0);
      const discountCents = numberValue(tier, 'discountCents', index === 0 ? numberValue(rules, 'discountCents', 600) : 0);
      const discountRateBps = numberValue(tier, 'discountRateBps', numberValue(tier, 'discountBps', 9500));
      return createCampaignTierForm({
        id: stringValue(tier, 'id', `tier-${index + 1}`),
        thresholdYuan: (thresholdCents / 100).toFixed(2).replace(/\.00$/, ''),
        discountYuan: (discountCents / 100).toFixed(2).replace(/\.00$/, ''),
        discountPercent: campaignType === 'full_discount'
          ? (discountRateBps / 100).toFixed(1).replace(/\.0$/, '')
          : '95',
      });
    })
    .filter(tier => Number(tier.thresholdYuan) >= 0);
  return tiers.length ? tiers : [createCampaignTierForm()];
}

function campaignProductGroupsFromRules(rules: JsonRecord): CampaignProductGroupForm[] {
  return arrayValue(rules, 'productGroups')
    .filter((item): item is JsonRecord => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    .map((group, index) => createCampaignProductGroupForm({
      id: stringValue(group, 'id', `group-${index + 1}`),
      name: stringValue(group, 'name', `商品组${index + 1}`),
      productIds: idTextFromArray(arrayValue(group, 'productIds')),
    }));
}

function campaignRulesFromForm(form: CampaignForm, products: JsonRecord[]) {
  const productById = new Map(products.map(product => [stringValue(product, 'id'), product]));
  const campaignType = normalizeCampaignTypeForForm(form.campaignType);
  const tiers = form.tiers
    .map((tier, index) => {
      const thresholdCents = moneyFromYuan(tier.thresholdYuan);
      const base = {
        id: tier.id || `tier-${index + 1}`,
        thresholdCents,
      };
      if (campaignType === 'free_delivery') {
        return {
          ...base,
          discountCents: 0,
        };
      }
      if (campaignType === 'full_discount') {
        const discountRateBps = Math.round((Number(tier.discountPercent) || 100) * 100);
        return {
          ...base,
          discountRateBps: Math.min(Math.max(discountRateBps, 1), 10_000),
        };
      }
      return {
        ...base,
        discountCents: moneyFromYuan(tier.discountYuan),
      };
    })
    .filter(tier => {
      if (tier.thresholdCents < 0) return false;
      if (campaignType === 'free_delivery') return tier.thresholdCents > 0;
      return 'discountCents' in tier ? tier.discountCents > 0 : tier.discountRateBps > 0;
    });
  const productIds = idListFromText(form.productIds);
  const productGroups = form.productGroups
    .map((group, index) => {
      const groupProductIds = idListFromText(group.productIds);
      return {
        id: group.id || `group-${index + 1}`,
        name: group.name.trim() || `商品组${index + 1}`,
        productIds: groupProductIds,
        products: groupProductIds.map(productId => {
          const product = productById.get(productId);
          return {
            productId,
            sku: product ? stringValue(product, 'sku') : '',
            productName: product ? stringValue(product, 'name') : '',
          };
        }),
      };
    })
    .filter(group => group.productIds.length);
  const firstTier = tiers[0];
  const firstTierDiscountCents = firstTier && 'discountCents' in firstTier ? firstTier.discountCents : undefined;
  const firstTierDiscountRateBps = firstTier && 'discountRateBps' in firstTier ? firstTier.discountRateBps : undefined;
  return {
    activityType: campaignType,
    display: campaignDisplayFromForm(form),
    scope: {
      type: form.scopeType || 'all',
      productIds,
      productGroups,
    },
    productIds,
    productGroups,
    audience: {
      type: form.audienceType || 'all',
      newCustomerRule: form.audienceType === 'new_customer' ? form.newCustomerRule : '',
    },
    tiers,
    thresholdCents: firstTier?.thresholdCents,
    discountCents: campaignType === 'full_discount' ? undefined : firstTierDiscountCents,
    discountRateBps: campaignType === 'full_discount' ? firstTierDiscountRateBps : undefined,
  };
}

function campaignTierSummary(campaign: JsonRecord) {
  const rules = recordValue(campaign, 'rules');
  const type = normalizeCampaignTypeForForm(stringValue(campaign, 'campaignType', stringValue(rules, 'activityType')));
  const tiers = arrayValue(rules, 'tiers')
    .filter((item): item is JsonRecord => Boolean(item) && typeof item === 'object' && !Array.isArray(item));
  const source = tiers.length ? tiers : [rules];
  return source
    .map(tier => {
      const threshold = yuan(numberValue(tier, 'thresholdCents'));
      if (type === 'free_delivery') {
        return `满 ${threshold} 免运费`;
      }
      if (type === 'full_discount') {
        const rate = numberValue(tier, 'discountRateBps', numberValue(tier, 'discountBps', 10000)) / 1000;
        return `满 ${threshold} 打 ${rate.toFixed(1).replace(/\.0$/, '')} 折`;
      }
      if (type === 'delivery_reduction') {
        return `满 ${threshold} 减运费 ${yuan(numberValue(tier, 'discountCents'))}`;
      }
      return `满 ${threshold} 减 ${yuan(numberValue(tier, 'discountCents'))}`;
    })
    .filter(Boolean)
    .join('，') || '-';
}

function campaignScopeSummary(campaign: JsonRecord) {
  const rules = recordValue(campaign, 'rules');
  const scope = recordValue(rules, 'scope');
  const scopeType = stringValue(scope, 'type', arrayValue(rules, 'productGroups').length ? 'product_group' : arrayValue(rules, 'productIds').length ? 'partial' : 'all');
  if (scopeType === 'all') return '全部商品';
  if (scopeType === 'product_group') return `${arrayValue(rules, 'productGroups').length || arrayValue(scope, 'productGroups').length} 个商品组`;
  return `${arrayValue(rules, 'productIds').length || arrayValue(scope, 'productIds').length} 个商品`;
}

function campaignAudienceSummary(campaign: JsonRecord) {
  const rules = recordValue(campaign, 'rules');
  const audience = recordValue(rules, 'audience');
  const audienceType = stringValue(audience, 'type', 'all');
  if (audienceType !== 'new_customer') return '全部用户';
  const rule = stringValue(audience, 'newCustomerRule', 'first_platform_order');
  return `新客专享：${newCustomerRuleOptions.find(option => option.value === rule)?.label || rule}`;
}

function campaignToForm(campaign: JsonRecord): CampaignForm {
  const rules = recordValue(campaign, 'rules');
  const campaignType = normalizeCampaignTypeForForm(stringValue(campaign, 'campaignType', stringValue(rules, 'activityType', 'full_reduction')));
  const scope = recordValue(rules, 'scope');
  const audience = recordValue(rules, 'audience');
  const display = campaignDisplayFromRules(campaignType, stringValue(campaign, 'name'), rules);
  const productGroups = campaignProductGroupsFromRules(rules);
  const productIds = idTextFromArray(arrayValue(rules, 'productIds').length ? arrayValue(rules, 'productIds') : arrayValue(scope, 'productIds'));
  return {
    id: stringValue(campaign, 'id'),
    name: stringValue(campaign, 'name'),
    campaignType,
    budgetYuan: String((numberValue(campaign, 'budgetCents') / 100).toFixed(2)),
    status: stringValue(campaign, 'status', 'draft'),
    startsAt: datetimeLocalValue(stringValue(campaign, 'startsAt')),
    endsAt: datetimeLocalValue(stringValue(campaign, 'endsAt')),
    displayTitle: display.title,
    tagText: display.tagText,
    iconText: display.iconText,
    iconUrl: display.iconUrl,
    tagBackgroundColor: display.backgroundColor,
    tagTextColor: display.textColor,
    ruleExplanation: display.ruleExplanation,
    limitText: display.limitText,
    scopeType: stringValue(scope, 'type', productGroups.length ? 'product_group' : productIds ? 'partial' : 'all'),
    productIds,
    productGroups,
    audienceType: stringValue(audience, 'type', 'all'),
    newCustomerRule: stringValue(audience, 'newCustomerRule', 'first_platform_order'),
    tiers: campaignTiersFromRules(rules, campaignType),
  };
}

function fixedPriceCampaignToForm(campaign: JsonRecord): FixedPriceCampaignForm {
  const rules = recordValue(campaign, 'rules');
  const badge = recordValue(rules, 'badge');
  const legacyItems = arrayValue(rules, 'items')
    .map(item => {
      const record = item && typeof item === 'object' && !Array.isArray(item) ? item as JsonRecord : {};
      const productId = stringValue(record, 'productId', stringValue(record, 'id'));
      if (!productId) return null;
      return {
        productId,
        fixedPriceYuan: (numberValue(record, 'fixedPriceCents', numberValue(record, 'priceCents')) / 100).toFixed(2),
      };
    })
    .filter((item): item is FixedPriceCampaignItemForm => Boolean(item));
  const groups = arrayValue(rules, 'groups')
    .filter((item): item is JsonRecord => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    .map((group, index) => {
      const groupItems = arrayValue(group, 'items')
        .filter((item): item is JsonRecord => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
        .map(item => {
          const productId = stringValue(item, 'productId', stringValue(item, 'id'));
          if (!productId) return null;
          return {
            productId,
            fixedPriceYuan: (numberValue(item, 'fixedPriceCents', numberValue(item, 'priceCents')) / 100).toFixed(2),
          };
        })
        .filter((item): item is FixedPriceCampaignItemForm => Boolean(item));
      return createFixedPriceGroupForm({
        id: stringValue(group, 'id', `group-${index + 1}`),
        name: stringValue(group, 'name', `商品组${index + 1}`),
        startsAt: datetimeLocalValue(stringValue(group, 'startsAt')),
        endsAt: datetimeLocalValue(stringValue(group, 'endsAt')),
        items: groupItems,
      });
    })
    .filter(group => group.items.length);

  return {
    id: stringValue(campaign, 'id'),
    name: stringValue(campaign, 'name', '本周一口价'),
    status: stringValue(campaign, 'status', 'active'),
    startsAt: datetimeLocalValue(stringValue(campaign, 'startsAt')),
    endsAt: datetimeLocalValue(stringValue(campaign, 'endsAt')),
    badgeText: stringValue(badge, 'text', stringValue(rules, 'badgeText', '一口价')),
    badgeIcon: stringValue(badge, 'icon', stringValue(rules, 'badgeIcon', '¥')),
    badgeIconUrl: stringValue(badge, 'iconUrl', stringValue(rules, 'badgeIconUrl')),
    badgeBackgroundColor: stringValue(badge, 'backgroundColor', stringValue(rules, 'badgeBackgroundColor', '#FF9238')),
    badgeTextColor: stringValue(badge, 'textColor', stringValue(rules, 'badgeTextColor', '#FFFFFF')),
    badgePosition: stringValue(badge, 'position', stringValue(rules, 'badgePosition', 'top_left')),
    groups: groups.length ? groups : [createFixedPriceGroupForm({ items: legacyItems })],
  };
}

function fixedPriceCampaignRules(form: FixedPriceCampaignForm, products: JsonRecord[]) {
  const productById = new Map(products.map(product => [stringValue(product, 'id'), product]));
  const groups = form.groups
    .map((group, groupIndex) => {
      const items = group.items
        .map(item => {
          const product = productById.get(item.productId);
          return {
            productId: item.productId,
            sku: product ? stringValue(product, 'sku') : '',
            productName: product ? stringValue(product, 'name') : '',
            imageUrl: product ? productDisplayImagesFromRecord(product)[0] || stringValue(product, 'imageUrl') : '',
            fixedPriceCents: moneyFromYuan(item.fixedPriceYuan),
          };
        })
        .filter(item => item.productId && item.fixedPriceCents > 0);
      return {
        id: group.id || `group-${groupIndex + 1}`,
        name: group.name.trim() || `商品组${groupIndex + 1}`,
        startsAt: group.startsAt || form.startsAt,
        endsAt: group.endsAt || form.endsAt,
        items,
      };
    })
    .filter(group => group.items.length);
  const flattenedItems = groups.flatMap(group => group.items.map(item => ({
    ...item,
    groupId: group.id,
    groupName: group.name,
    startsAt: group.startsAt,
    endsAt: group.endsAt,
  })));
  return {
    activityType: 'fixed_price',
    startsAt: form.startsAt,
    endsAt: form.endsAt,
    badge: {
      text: form.badgeText.trim() || '一口价',
      icon: form.badgeIcon.trim(),
      iconUrl: form.badgeIconUrl.trim(),
      backgroundColor: form.badgeBackgroundColor || '#FF9238',
      textColor: form.badgeTextColor || '#FFFFFF',
      position: form.badgePosition || 'top_left',
    },
    display: {
      title: form.name.trim() || '本周一口价',
      tagText: form.badgeText.trim() || '一口价',
      iconText: form.badgeIcon.trim(),
      iconUrl: form.badgeIconUrl.trim(),
      backgroundColor: form.badgeBackgroundColor || '#FF9238',
      textColor: form.badgeTextColor || '#FFFFFF',
      ruleExplanation: `活动期间，参与商品按${form.badgeText.trim() || '一口价'}结算。`,
      limitText: '限所选商品参与，具体价格以下单页为准。',
    },
    groups,
    items: flattenedItems,
  };
}

function promotionVenueToForm(campaign: JsonRecord): PromotionVenueForm {
  const rules = recordValue(campaign, 'rules');
  const display = campaignDisplayFromRules('promotion_venue', stringValue(campaign, 'name', '周末大促会场'), rules);
  const items = arrayValue(rules, 'items')
    .map(item => {
      const record = item && typeof item === 'object' && !Array.isArray(item) ? item as JsonRecord : {};
      const productId = stringValue(record, 'productId', stringValue(record, 'id'));
      if (!productId) return null;
      return { productId };
    })
    .filter((item): item is PromotionVenueItemForm => Boolean(item));

  return {
    id: stringValue(campaign, 'id'),
    name: stringValue(campaign, 'name', '周末大促会场'),
    status: stringValue(campaign, 'status', 'active'),
    title: stringValue(rules, 'title', stringValue(campaign, 'name', '周末大促')),
    tagText: display.tagText,
    subtitle: stringValue(rules, 'subtitle', '限时精选'),
    copy: stringValue(rules, 'copy', '生鲜好货集中上新'),
    limitText: display.limitText,
    buttonText: stringValue(rules, 'buttonText', '进入会场'),
    iconText: stringValue(rules, 'iconText', '促'),
    iconUrl: stringValue(rules, 'iconUrl'),
    backgroundImageUrl: stringValue(rules, 'backgroundImageUrl'),
    backgroundColor: stringValue(rules, 'backgroundColor', '#F4FBF5'),
    textColor: stringValue(rules, 'textColor', '#153A24'),
    entryPosition: stringValue(rules, 'entryPosition', 'home_after_banner'),
    sortOrder: String(numberValue(rules, 'sortOrder', 10)),
    items,
  };
}

function promotionVenueRules(form: PromotionVenueForm, products: JsonRecord[]) {
  const productById = new Map(products.map(product => [stringValue(product, 'id'), product]));
  return {
    title: form.title.trim() || form.name.trim(),
    subtitle: form.subtitle.trim(),
    copy: form.copy.trim(),
    display: {
      title: form.title.trim() || form.name.trim() || '周末大促',
      tagText: form.tagText.trim() || '大促',
      iconText: form.iconText.trim(),
      iconUrl: form.iconUrl.trim(),
      backgroundColor: form.backgroundColor || '#F4FBF5',
      textColor: form.textColor || '#153A24',
      ruleExplanation: form.copy.trim() || '活动期间，会场内商品按页面活动规则享受优惠。',
      limitText: form.limitText.trim(),
    },
    buttonText: form.buttonText.trim() || '进入会场',
    iconText: form.iconText.trim(),
    iconUrl: form.iconUrl.trim(),
    backgroundImageUrl: form.backgroundImageUrl.trim(),
    backgroundColor: form.backgroundColor || '#F4FBF5',
    textColor: form.textColor || '#153A24',
    entryPosition: form.entryPosition || 'home_after_banner',
    sortOrder: Number(form.sortOrder) || 0,
    items: form.items
      .map((item, index) => {
        const product = productById.get(item.productId);
        return {
          productId: item.productId,
          sku: product ? stringValue(product, 'sku') : '',
          productName: product ? stringValue(product, 'name') : '',
          sortOrder: index + 1,
        };
      })
      .filter(item => item.productId),
  };
}

const groupBuyDepositTypeOptions = [
  { value: 'percent', label: '按比例' },
  { value: 'unit_fixed', label: '按单位固定' },
  { value: 'order_fixed', label: '按单固定' },
];

const groupBuyActionOptions = [
  { action: 'publish', label: '发布', icon: 'check' as IconName },
  { action: 'offline', label: '下线', icon: 'x' as IconName },
  { action: 'force-form', label: '强制成团', icon: 'check' as IconName },
  { action: 'extend', label: '延期', icon: 'refresh' as IconName },
  { action: 'cancel', label: '取消', icon: 'x' as IconName },
  { action: 'confirm-procurement', label: '确认采购', icon: 'shopping-bag' as IconName },
];

function groupBuyStatusLabel(value: string) {
  const labels: Record<string, string> = {
    draft: '草稿',
    published: '已发布',
    enrolling: '报名中',
    formed: '已成团',
    formed_pending_balance: '已成团待尾款',
    balance_closing: '尾款处理中',
    ops_review: '待运营确认',
    procuring: '采购中',
    completed: '已完成',
    offline: '已下线',
    failed_refunding: '未成团退款中',
    failed_refunded: '未成团已退款',
    cancelled_refunding: '取消退款中',
    cancelled: '已取消',
    pending_deposit: '待付定金',
    deposit_paid: '已付定金',
    pending_balance: '待付尾款',
    balance_paid: '已付尾款',
    order_created: '已生成订单',
    deposit_refunding: '定金退款中',
    deposit_refunded: '定金已退',
    balance_overdue_cancelled: '尾款逾期取消',
    activity_cancel_refunding: '活动取消退款中',
    refunded: '已退款',
  };
  return labels[value] || statusLabel(value);
}

function groupBuyDepositTypeLabel(value: string) {
  return groupBuyDepositTypeOptions.find(option => option.value === value)?.label || value || '-';
}

function groupBuyDepositValueToForm(depositType: string, depositValue: number) {
  if (depositType === 'unit_fixed' || depositType === 'order_fixed') {
    return (depositValue / 100).toFixed(2);
  }
  return String(depositValue);
}

function groupBuyDepositValueFromForm(depositType: string, depositValue: string) {
  if (depositType === 'unit_fixed' || depositType === 'order_fixed') {
    return moneyFromYuan(depositValue);
  }
  return Number(depositValue) || 0;
}

function groupBuyDepositValueLabel(depositType: string) {
  if (depositType === 'unit_fixed') return '每单位定金（元）';
  if (depositType === 'order_fixed') return '每单定金（元）';
  return '定金比例（%）';
}

function groupBuyDepositSummary(groupBuy: JsonRecord) {
  const depositType = stringValue(groupBuy, 'depositType', 'percent');
  const depositValue = numberValue(groupBuy, 'depositValue');
  if (depositType === 'unit_fixed') return `每单位 ${yuan(depositValue)}`;
  if (depositType === 'order_fixed') return `每单 ${yuan(depositValue)}`;
  return `${depositValue}%`;
}

function groupBuyTiersFromRecord(groupBuy: JsonRecord): GroupBuyTierForm[] {
  const tiers = arrayValue(groupBuy, 'tiers')
    .filter((item): item is JsonRecord => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    .map((tier, index) => createGroupBuyTierForm({
      id: stringValue(tier, 'id', `tier-${index + 1}`),
      quantity: String(numberValue(tier, 'quantity', index === 0 ? numberValue(groupBuy, 'minGroupQuantity', 20) : 0)),
      priceYuan: (numberValue(tier, 'priceCents', numberValue(tier, 'unitPriceCents')) / 100).toFixed(2),
    }))
    .filter(tier => Number(tier.quantity) > 0);
  return tiers.length ? tiers : [createGroupBuyTierForm({
    quantity: String(numberValue(groupBuy, 'minGroupQuantity', 20)),
    priceYuan: (numberValue(groupBuy, 'finalUnitPriceCents', numberValue(groupBuy, 'priceCents')) / 100 || 19.9).toFixed(2),
  })];
}

function groupBuyToForm(groupBuy: JsonRecord): GroupBuyForm {
  const depositType = stringValue(groupBuy, 'depositType', 'percent');
  return {
    id: stringValue(groupBuy, 'id'),
    name: stringValue(groupBuy, 'name'),
    productId: stringValue(groupBuy, 'productId'),
    variantId: stringValue(groupBuy, 'variantId'),
    startsAt: datetimeLocalValue(stringValue(groupBuy, 'startsAt')),
    endsAt: datetimeLocalValue(stringValue(groupBuy, 'endsAt')),
    balanceDueAt: datetimeLocalValue(stringValue(groupBuy, 'balanceDueAt')),
    minGroupQuantity: String(numberValue(groupBuy, 'minGroupQuantity', 20)),
    maxQuantityPerUser: numberValue(groupBuy, 'maxQuantityPerUser') ? String(numberValue(groupBuy, 'maxQuantityPerUser')) : '',
    minCreditScore: String(numberValue(groupBuy, 'minCreditScore', 80)),
    overdueCreditPenalty: String(numberValue(groupBuy, 'overdueCreditPenalty', 10)),
    depositType,
    depositValue: groupBuyDepositValueToForm(depositType, numberValue(groupBuy, 'depositValue', 20)),
    tiers: groupBuyTiersFromRecord(groupBuy),
  };
}

function groupBuyProduct(groupBuy: JsonRecord, products: JsonRecord[]) {
  const embeddedProduct = recordValue(groupBuy, 'product');
  if (stringValue(embeddedProduct, 'id')) return embeddedProduct;
  const productId = stringValue(groupBuy, 'productId');
  return products.find(product => stringValue(product, 'id') === productId);
}

function groupBuyProductName(groupBuy: JsonRecord, products: JsonRecord[]) {
  const product = groupBuyProduct(groupBuy, products);
  return stringValue(groupBuy, 'productName', product ? stringValue(product, 'name', '未命名商品') : '未命名商品');
}

function groupBuyVariantName(groupBuy: JsonRecord, products: JsonRecord[]) {
  const variantId = stringValue(groupBuy, 'variantId');
  const product = groupBuyProduct(groupBuy, products);
  if (!product) return stringValue(groupBuy, 'variantName', stringValue(groupBuy, 'unitName', '-'));
  const variant = productVariantsFromRecord(product).find(item => item.id === variantId);
  return stringValue(groupBuy, 'variantName', variant?.specification || variant?.name || stringValue(groupBuy, 'unitName', stringValue(product, 'specification', '-')));
}

function groupBuyCurrentQuantity(groupBuy: JsonRecord) {
  return numberValue(groupBuy, 'currentQuantity', numberValue(groupBuy, 'formedQuantity', numberValue(groupBuy, 'subscriptionQuantity', numberValue(groupBuy, 'subscribedQuantity'))));
}

function groupBuyFinalTierSummary(groupBuy: JsonRecord) {
  const finalQuantity = numberValue(groupBuy, 'finalTierQuantity');
  const finalPriceCents = numberValue(groupBuy, 'finalUnitPriceCents');
  const unitName = stringValue(groupBuy, 'unitName', '件');
  if (finalQuantity > 0 && finalPriceCents > 0) {
    return `${finalQuantity}${unitName}档 / ${yuan(finalPriceCents)}`;
  }
  const tiers = arrayValue(groupBuy, 'tiers')
    .filter((item): item is JsonRecord => Boolean(item) && typeof item === 'object' && !Array.isArray(item));
  if (!tiers.length) return '-';
  const currentQuantity = groupBuyCurrentQuantity(groupBuy);
  const matched = tiers
    .map(tier => ({
      quantity: numberValue(tier, 'quantity'),
      priceCents: numberValue(tier, 'priceCents', numberValue(tier, 'unitPriceCents')),
    }))
    .filter(tier => tier.quantity > 0 && tier.priceCents > 0 && tier.quantity <= currentQuantity)
    .sort((a, b) => b.quantity - a.quantity)[0];
  return matched ? `${matched.quantity}${unitName}档 / ${yuan(matched.priceCents)}` : '未成档';
}

function groupBuyBalanceSummary(groupBuy: JsonRecord) {
  const paid = numberValue(groupBuy, 'balancePaidQuantity', numberValue(groupBuy, 'balancePaidCount'));
  const due = numberValue(groupBuy, 'balanceDueQuantity', numberValue(groupBuy, 'formedQuantity'));
  if (!paid && !due) return '-';
  return `尾款 ${paid}/${due || groupBuyCurrentQuantity(groupBuy)}`;
}

function groupBuyPaymentProgressSummary(groupBuy: JsonRecord) {
  const depositPaidCount = numberValue(groupBuy, 'depositPaidCount');
  const subscriptionCount = numberValue(groupBuy, 'subscriptionCount');
  const balancePaidCount = numberValue(groupBuy, 'balancePaidCount');
  const balanceBase = Math.max(depositPaidCount, subscriptionCount, balancePaidCount, 1);
  const balanceRate = Math.round((balancePaidCount / balanceBase) * 100);
  return `定金 ${depositPaidCount} 人 · 尾款 ${balanceRate}%`;
}

function groupBuyPayload(form: GroupBuyForm) {
  const tiers = form.tiers
    .map(tier => ({
      quantity: Number(tier.quantity) || 0,
      priceCents: moneyFromYuan(tier.priceYuan),
    }))
    .filter(tier => tier.quantity > 0 && tier.priceCents > 0)
    .sort((a, b) => a.quantity - b.quantity);
  if (!form.name.trim()) throw new Error('活动名称不能为空');
  if (!form.productId) throw new Error('请选择商品');
  if (!form.startsAt || !form.endsAt || !form.balanceDueAt) throw new Error('请填写活动开始、结束和尾款截止时间');
  if ((Number(form.minGroupQuantity) || 0) <= 0) throw new Error('成团门槛必须大于0');
  if ((Number(form.minCreditScore) || 0) < 0) throw new Error('最低信用分不能为空');
  if ((Number(form.overdueCreditPenalty) || 0) < 0) throw new Error('逾期扣分不能为空');
  if (!form.depositType || !form.depositValue.trim()) throw new Error('定金方式和数值不能为空');
  if (!tiers.length) throw new Error('请至少配置一档阶梯价');
  return {
    name: form.name.trim(),
    productId: form.productId,
    variantId: form.variantId || undefined,
    startsAt: datetimeLocalToIso(form.startsAt),
    endsAt: datetimeLocalToIso(form.endsAt),
    balanceDueAt: datetimeLocalToIso(form.balanceDueAt),
    minGroupQuantity: Number(form.minGroupQuantity) || 0,
    maxQuantityPerUser: form.maxQuantityPerUser.trim() ? Number(form.maxQuantityPerUser) || undefined : undefined,
    minCreditScore: Number(form.minCreditScore) || 0,
    overdueCreditPenalty: Number(form.overdueCreditPenalty) || 0,
    depositType: form.depositType,
    depositValue: groupBuyDepositValueFromForm(form.depositType, form.depositValue),
    tiers,
  };
}

function datetimeLocalToIso(value: string) {
  if (!value) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

function groupBuyActionResultActivity(result: JsonRecord) {
  if (stringValue(result, 'id')) return result;
  const activity = recordValue(result, 'activity');
  return stringValue(activity, 'id') ? activity : null;
}

function groupBuyActionUnavailableReason(groupBuy: JsonRecord, action: string) {
  const status = stringValue(groupBuy, 'status');
  if (action === 'publish' && status !== 'draft') return '只有草稿活动可以发布';
  if (action === 'offline') {
    if (!['draft', 'published'].includes(status)) return '当前状态不能直接下线';
    if (numberValue(groupBuy, 'depositPaidCount') > 0) return '已有用户支付定金，请走取消退款流程';
  }
  if (action === 'force-form' && !['published', 'enrolling'].includes(status)) return '当前状态不能强制成团';
  if (action === 'extend' && !['published', 'enrolling', 'formed', 'ops_review'].includes(status)) return '当前状态不能延期';
  if (action === 'confirm-procurement' && !['formed', 'ops_review', 'procuring'].includes(status)) return '当前状态不能确认采购';
  if (action === 'cancel' && ['offline', 'cancelled', 'cancelled_refunding', 'procuring', 'completed', 'failed_refunded'].includes(status)) {
    return '当前状态不能取消';
  }
  return '';
}

function groupBuyActionConfirmText(groupBuy: JsonRecord, action: string) {
  const name = stringValue(groupBuy, 'name', '该集采活动');
  const texts: Record<string, string> = {
    offline: `确认下线「${name}」？下线后用户端将不可见。`,
    'force-form': `确认将「${name}」强制成团？系统会锁定当前档位并进入尾款流程。`,
    cancel: `确认取消「${name}」并进入退款流程？该操作会影响已支付用户。`,
    'confirm-procurement': `确认「${name}」继续采购？系统会为已付尾款用户生成普通商城订单。`,
  };
  return texts[action] || '';
}

function groupBuyProcurementMessage(result: JsonRecord) {
  const summary = recordValue(result, 'orderCreation');
  if (!Object.keys(summary).length) return '集采活动确认采购成功';
  const created = numberValue(summary, 'createdCount');
  const existing = numberValue(summary, 'existingCount');
  const missingAddress = numberValue(summary, 'missingAddressCount');
  const stockFailed = numberValue(summary, 'stockFailedCount');
  return `确认采购完成：新建 ${created} 单，已有 ${existing} 单，缺地址 ${missingAddress} 单，库存不足 ${stockFailed} 单`;
}

function couponToForm(coupon: JsonRecord): CouponForm {
  return {
    id: stringValue(coupon, 'id'),
    name: stringValue(coupon, 'name'),
    code: stringValue(coupon, 'code', `COUPON-${Date.now().toString().slice(-6)}`),
    couponType: stringValue(coupon, 'couponType', 'full_reduction'),
    thresholdYuan: String((numberValue(coupon, 'thresholdCents') / 100).toFixed(2)),
    discountYuan: String((numberValue(coupon, 'discountCents') / 100).toFixed(2)),
    totalQuantity: String(numberValue(coupon, 'totalQuantity')),
    perUserLimit: String(numberValue(coupon, 'perUserLimit', 1)),
    status: stringValue(coupon, 'status', 'draft'),
    startsAt: datetimeLocalValue(stringValue(coupon, 'startsAt')),
    endsAt: datetimeLocalValue(stringValue(coupon, 'endsAt')),
    description: stringValue(coupon, 'description'),
  };
}

function permissionModuleLabel(value: string) {
  return permissionModuleOptions.find(([key]) => key === value)?.[1] || value || '-';
}

function permissionActionLabel(value: string) {
  return permissionActionOptions.find(([key]) => key === value)?.[1] || value || '-';
}

function permissionTextList(record: JsonRecord, key: string, labelFn: (value: string) => string) {
  const values = arrayValue(record, key)
    .map(item => labelFn(String(item)))
    .filter(Boolean);
  return values.length ? values.join(' / ') : '-';
}

function mallPermissionToForm(permission: JsonRecord): MallPermissionForm {
  return {
    id: stringValue(permission, 'id'),
    name: stringValue(permission, 'name'),
    roleKey: stringValue(permission, 'roleKey'),
    description: stringValue(permission, 'description'),
    modules: arrayValue(permission, 'modules').map(item => String(item)),
    actions: arrayValue(permission, 'actions').map(item => String(item)),
    status: stringValue(permission, 'status', 'active'),
  };
}

function statusLabel(value: string) {
  const labels: Record<string, string> = {
    active: '启用',
    inactive: '停用',
    deleted: '已删除',
    pending: '待审核',
    none: '无需处理',
    confirmed: '已确认',
    approved: '已通过',
    rejected: '已拒绝',
    on_sale: '在售',
    off_sale: '下架',
    draft: '草稿',
    paid: '已支付',
    pending_payment: '待支付',
    dispatching: '派送中',
    delivering: '配送中',
    generated: '已生成',
    shipping: '已发货',
    shipped: '已发货',
    delivered: '已送达',
    completed: '已完成',
    cancelled: '已取消',
    refund_pending: '待退款',
    after_sales: '售后中',
    exception: '异常',
    failed: '失败',
    open: '处理中',
    closed: '已关闭',
    resolved: '已解决',
    published: '已发布',
    submitted: '已提交',
    negotiating: '协商中',
    processing: '处理中',
    return_pending: '待退货',
    returning: '退货中',
    exchange_processing: '换货中',
    replacement_sent: '换货已发出',
    refunding: '退款中',
    refunded: '已退款',
    return_refund: '退货退款',
    refund_only: '仅退款',
    exchange: '换货',
    agreed: '已协商一致',
    commission_pending: '佣金待审',
    expired: '已过期',
  };
  return labels[value] || value || '-';
}

function roleLabel(value: string) {
  const labels: Record<string, string> = {
    admin: '管理员',
    agent: '客服',
    support: '客服',
    merchant: '商家',
    owner: '车主',
    enterprise: '企业',
    user: '用户',
    customer: '用户',
    member: '用户',
  };
  return labels[value] || value || '-';
}

function badgeClass(status: string) {
  if (['active', 'on_sale', 'paid', 'completed', 'approved', 'published', 'resolved', 'delivered', 'shipped', 'refunded', 'agreed'].includes(status)) {
    return 'badge badge-green';
  }
  if (['pending', 'pending_payment', 'dispatching', 'delivering', 'generated', 'shipping', 'open', 'submitted', 'negotiating', 'processing', 'return_pending', 'returning', 'exchange_processing', 'replacement_sent', 'refunding', 'refund_pending', 'commission_pending'].includes(status)) {
    return 'badge badge-blue';
  }
  if (['rejected', 'cancelled', 'off_sale', 'inactive', 'closed', 'expired', 'failed', 'deleted'].includes(status)) {
    return 'badge badge-gray';
  }
  return 'badge badge-amber';
}

function updateRecordList(list: JsonRecord[], id: string, patch: JsonRecord) {
  return list.map(item => (stringValue(item, 'id') === id ? { ...item, ...patch } : item));
}

function isOpenSupportStatus(status: string) {
  return ['open', 'submitted', 'negotiating', 'approved', 'processing', 'return_pending', 'returning', 'exchange_processing', 'replacement_sent', 'refunding', 'pending'].includes(status);
}

function supportSearchText(record: JsonRecord, keys: string[]) {
  return keys.map(key => stringValue(record, key)).join(' ').toLowerCase();
}

function filterSupportRecords(records: JsonRecord[], filters: SupportFilterState, keys: string[]) {
  const keyword = filters.keyword.trim().toLowerCase();
  return records.filter(record => {
    const status = stringValue(record, 'status');
    if (filters.status === 'open' && !isOpenSupportStatus(status)) return false;
    if (filters.status && filters.status !== 'open' && filters.status !== status) return false;
    if (filters.category && stringValue(record, 'category') !== filters.category) return false;
    if (filters.priority && stringValue(record, 'priority') !== filters.priority) return false;
    if (keyword && !supportSearchText(record, keys).includes(keyword)) return false;
    return true;
  });
}

function buildAfterSalesQueue(orders: JsonRecord[]) {
  return orders
    .flatMap(order => {
      const orderId = stringValue(order, 'id');
      const orderNo = stringValue(order, 'orderNo', shortId(orderId));
      const items = arrayValue(order, 'items');
      const firstItem = items[0] && typeof items[0] === 'object' ? (items[0] as JsonRecord) : {};
      return arrayValue(order, 'afterSales').map((sale, index) => {
        const record = sale && typeof sale === 'object' && !Array.isArray(sale) ? (sale as JsonRecord) : {};
        return {
          ...record,
          id: stringValue(record, 'id', `${orderId}-after-sale-${index}`),
          orderId,
          orderNo,
          userId: stringValue(order, 'userId'),
          recipientName: stringValue(order, 'recipientName'),
          productName: stringValue(firstItem, 'productName', `${items.length} 件商品`),
          category: 'after_sales',
          priority: numberValue(record, 'amountCents') >= 10000 ? 'high' : 'normal',
        };
      });
    })
    .sort((left, right) => new Date(stringValue(right, 'createdAt')).getTime() - new Date(stringValue(left, 'createdAt')).getTime());
}

function afterSaleTypeLabel(value: string) {
  if (value === 'return_refund') return '退货退款';
  if (value === 'exchange') return '换货';
  if (value === 'refund_only') return '仅退款';
  return value || '售后';
}

function afterSaleSelectedItemsText(item: JsonRecord) {
  const selectedItems = arrayValue(item, 'selectedItems');
  if (!selectedItems.length) return stringValue(item, 'productName', '订单商品');
  return selectedItems
    .map(selected => {
      const record = selected && typeof selected === 'object' && !Array.isArray(selected) ? selected as JsonRecord : {};
      const name = stringValue(record, 'productName', stringValue(item, 'productName', '订单商品'));
      const variant = stringValue(record, 'variantName');
      const quantity = numberValue(record, 'quantity') || 1;
      return `${name}${variant ? `/${variant}` : ''} x${quantity}`;
    })
    .join('、');
}

function supportDashboardStats(data: DashboardData, afterSales: JsonRecord[]) {
  const openSessions = data.supportSessions.filter(session => isOpenSupportStatus(orderStatus(session))).length;
  const openTickets = data.supportTickets.filter(ticket => isOpenSupportStatus(orderStatus(ticket))).length;
  const pendingAfterSales = afterSales.filter(item => isOpenSupportStatus(orderStatus(item))).length;
  const refundingAfterSales = afterSales.filter(item => ['approved', 'refunding'].includes(orderStatus(item))).length;
  const afterSalesAmountCents = afterSales.reduce((total, item) => total + numberValue(item, 'amountCents'), 0);
  const resolvedTickets = data.supportTickets.filter(ticket => ['resolved', 'closed'].includes(orderStatus(ticket))).length;
  const ticketTotal = Math.max(data.supportTickets.length, 1);

  return {
    openSessions,
    openTickets,
    pendingAfterSales,
    refundingAfterSales,
    afterSalesAmountCents,
    knowledgeArticles: data.supportKnowledge.length,
    avgFirstResponseMinutes: numberValue(data.supportMetrics, 'avgFirstResponseMinutes'),
    satisfaction: numberValue(data.supportMetrics, 'satisfaction'),
    ticketResolutionRate: percentValue(resolvedTickets, ticketTotal),
  };
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function percentValue(value: number, total: number) {
  return total > 0 ? clampPercent((value / total) * 100) : 0;
}

function amountCentsFromRecord(record: JsonRecord, centsKeys: string[], yuanKeys: string[] = []) {
  for (const key of centsKeys) {
    const value = numberValue(record, key);
    if (value > 0) return value;
  }

  for (const key of yuanKeys) {
    const value = numberValue(record, key);
    if (value > 0) return Math.round(value * 100);
  }

  return 0;
}

function mallOrderRevenueCents(order: JsonRecord) {
  const explicitAmount = amountCentsFromRecord(order, [
    'payableAmountCents',
    'paidAmountCents',
    'totalAmountCents',
    'amountCents',
  ]);
  if (explicitAmount > 0) return explicitAmount;

  return arrayValue(order, 'items').reduce((total, item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return total;
    return total + itemLineTotal(item as JsonRecord);
  }, 0);
}

function transportOrderRevenueCents(order: JsonRecord) {
  return amountCentsFromRecord(order, ['farePriceCents', 'fare_price_cents'], ['farePrice', 'fare_price']);
}

function combinedOrderRevenueCents(order: JsonRecord) {
  return mallOrderRevenueCents(order) || transportOrderRevenueCents(order);
}

function orderStatus(record: JsonRecord) {
  return stringValue(record, 'status', stringValue(record, 'orderStatus', stringValue(record, 'order_status')));
}

function orderPaymentStatus(record: JsonRecord) {
  return stringValue(record, 'paymentStatus', stringValue(record, 'payment_status'));
}

function isPaidBusinessOrder(record: JsonRecord) {
  const status = orderStatus(record);
  const payStatus = orderPaymentStatus(record);
  return payStatus === 'paid' || ['paid', 'dispatching', 'delivering', 'completed'].includes(status);
}

function isFulfillmentOrder(record: JsonRecord) {
  return ['dispatching', 'delivering', 'processing'].includes(orderStatus(record));
}

function isCompletedBusinessOrder(record: JsonRecord) {
  return orderStatus(record) === 'completed';
}

function businessOrderTime(record: JsonRecord) {
  const value = stringValue(record, 'createdAt', stringValue(record, 'created_at', stringValue(record, 'paidAt', stringValue(record, 'updatedAt'))));
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dayKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function recentDaySlots(count: number) {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (count - index - 1));
    return {
      key: dayKey(date),
      label: `${date.getMonth() + 1}/${date.getDate()}`,
      orders: 0,
      revenueCents: 0,
    };
  });
}

function recordDateKey(record: JsonRecord, ...keys: string[]) {
  for (const key of keys) {
    const value = stringValue(record, key);
    if (!value) continue;
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return dayKey(date);
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  }
  return '';
}

function recordCommunityName(record: JsonRecord) {
  return stringValue(
    record,
    'communityName',
    stringValue(record, 'community', stringValue(record, 'neighborhoodName', stringValue(record, 'areaName'))),
  );
}

function recordPickupPointName(record: JsonRecord) {
  return stringValue(
    record,
    'pickupPointName',
    stringValue(record, 'pickupName', stringValue(record, 'stationName', stringValue(record, 'selfPickupPointName'))),
  );
}

function recordLeaderName(record: JsonRecord) {
  return stringValue(record, 'groupLeaderName', stringValue(record, 'leaderName', stringValue(record, 'contactName')));
}

function recordLeaderPhone(record: JsonRecord) {
  return stringValue(record, 'groupLeaderPhone', stringValue(record, 'leaderPhone', stringValue(record, 'contactPhone')));
}

function recordAddress(record: JsonRecord) {
  return stringValue(record, 'address', stringValue(record, 'addressText', stringValue(record, 'pickupAddress')));
}

function orderItemCount(order: JsonRecord) {
  const explicit = numberValue(order, 'itemCount', numberValue(order, 'itemsCount'));
  if (explicit) return explicit;
  return arrayValue(order, 'items').reduce((total, item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return total;
    return total + numberValue(item as JsonRecord, 'quantity', 1);
  }, 0);
}

function mallOrderPayableCents(order: JsonRecord) {
  return amountCentsFromRecord(order, [
    'payableCents',
    'payableAmountCents',
    'paidAmountCents',
    'totalAmountCents',
    'amountCents',
  ]);
}

function mallOpsRecordSearchText(record: JsonRecord, keys: string[]) {
  return keys
    .map(key => {
      const direct = stringValue(record, key);
      if (direct) return direct;
      const nested = recordValue(record, key);
      return Object.values(nested).map(value => String(value)).join(' ');
    })
    .join(' ')
    .toLowerCase();
}

function filterMallOpsRecords(records: JsonRecord[], filters: MallOpsFilterState, keys: string[], dateKeys: string[] = []) {
  const keyword = filters.keyword.trim().toLowerCase();
  const community = filters.community.trim().toLowerCase();
  return records.filter(record => {
    const status = orderStatus(record) || stringValue(record, 'status');
    if (filters.status && status !== filters.status) return false;
    if (filters.date && recordDateKey(record, ...dateKeys) !== filters.date) return false;
    if (community && !recordCommunityName(record).toLowerCase().includes(community)) return false;
    if (keyword && !mallOpsRecordSearchText(record, keys).includes(keyword)) return false;
    return true;
  });
}

function isTodayMallOrder(order: JsonRecord, dateFilter = '') {
  const date = businessOrderTime(order);
  if (!date) return false;
  return dayKey(date) === (dateFilter || dayKey(new Date()));
}

function isAbnormalMallOrder(order: JsonRecord) {
  const status = orderStatus(order);
  const afterSales = arrayValue(order, 'afterSales');
  return (
    ['cancelled', 'refunding', 'refund_pending', 'after_sales', 'exception', 'failed'].includes(status)
    || afterSales.length > 0
    || numberValue(order, 'refundCents') > 0
    || numberValue(order, 'refundAmountCents') > 0
  );
}

function filterMallOrdersByMode(orders: JsonRecord[], mode: 'today' | 'history' | 'abnormal', filters: MallOpsFilterState) {
  const scoped = orders.filter(order => {
    if (mode === 'today') return isTodayMallOrder(order, filters.date);
    if (mode === 'abnormal') return isAbnormalMallOrder(order);
    return true;
  });
  return filterMallOpsRecords(
    scoped,
    filters,
    ['id', 'orderNo', 'recipientName', 'recipientPhone', 'addressText', 'pickupPointName', 'groupLeaderName', 'status'],
    ['createdAt', 'created_at', 'paidAt', 'updatedAt'],
  );
}

function buildCommunityOrderSummaries(orders: JsonRecord[]) {
  const map = new Map<string, {
    community: string;
    pickupPoint: string;
    leader: string;
    phone: string;
    orderCount: number;
    itemCount: number;
    amountCents: number;
  }>();

  orders.forEach(order => {
    const community = recordCommunityName(order) || '未分配小区';
    const current = map.get(community) || {
      community,
      pickupPoint: recordPickupPointName(order) || '-',
      leader: recordLeaderName(order) || '-',
      phone: recordLeaderPhone(order) || '-',
      orderCount: 0,
      itemCount: 0,
      amountCents: 0,
    };
    current.orderCount += 1;
    current.itemCount += orderItemCount(order);
    current.amountCents += mallOrderPayableCents(order) || mallOrderRevenueCents(order);
    map.set(community, current);
  });

  return Array.from(map.values()).sort((left, right) => right.orderCount - left.orderCount);
}

function derivePickupPoints(points: JsonRecord[], orders: JsonRecord[], deliverySheets: JsonRecord[]) {
  if (points.length) return points;
  const map = new Map<string, JsonRecord>();
  [...orders, ...deliverySheets].forEach(record => {
    const name = recordPickupPointName(record);
    if (!name) return;
    const key = `${name}-${recordCommunityName(record)}`;
    if (!map.has(key)) {
      map.set(key, {
        id: key,
        name,
        communityName: recordCommunityName(record),
        leaderName: recordLeaderName(record),
        leaderPhone: recordLeaderPhone(record),
        address: recordAddress(record),
        status: stringValue(record, 'status', 'active'),
      });
    }
  });
  return Array.from(map.values());
}

function salesStatsArray(stats: JsonRecord, ...keys: string[]) {
  for (const key of keys) {
    const value = arrayValue(stats, key);
    if (value.length) return value.filter(item => item && typeof item === 'object' && !Array.isArray(item)) as JsonRecord[];
  }
  return [];
}

function buildProductSalesRows(stats: JsonRecord, orders: JsonRecord[]) {
  const rows = salesStatsArray(stats, 'productStats', 'productSales', 'salesByProduct', 'products', 'topProducts');
  if (rows.length) {
    return rows.map(row => ({
      ...row,
      revenueCents: numberValue(row, 'revenueCents', numberValue(row, 'salesCents', numberValue(row, 'amountCents'))),
    }));
  }
  const map = new Map<string, JsonRecord>();
  orders.forEach(order => {
    arrayValue(order, 'items').forEach(item => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return;
      const row = item as JsonRecord;
      const key = stringValue(row, 'productId', stringValue(row, 'sku', stringValue(row, 'productName')));
      const current = map.get(key) || {
        id: key,
        productName: stringValue(row, 'productName', '-'),
        categoryName: stringValue(row, 'categoryName', stringValue(row, 'categoryCode')),
        quantity: 0,
        revenueCents: 0,
      };
      current.quantity = numberValue(current, 'quantity') + numberValue(row, 'quantity', 1);
      current.revenueCents = numberValue(current, 'revenueCents') + itemLineTotal(row);
      map.set(key, current);
    });
  });
  return Array.from(map.values()).sort((left, right) => numberValue(right, 'revenueCents') - numberValue(left, 'revenueCents'));
}

function buildCategorySalesRows(stats: JsonRecord, orders: JsonRecord[]) {
  const rows = salesStatsArray(stats, 'categoryStats', 'categorySales', 'salesByCategory', 'categories');
  if (rows.length) {
    return rows.map(row => ({
      ...row,
      revenueCents: numberValue(row, 'revenueCents', numberValue(row, 'salesCents', numberValue(row, 'amountCents'))),
    }));
  }
  const map = new Map<string, JsonRecord>();
  orders.forEach(order => {
    arrayValue(order, 'items').forEach(item => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return;
      const row = item as JsonRecord;
      const key = stringValue(row, 'categoryName', stringValue(row, 'categoryCode', '未分类'));
      const current = map.get(key) || { id: key, categoryName: key, quantity: 0, revenueCents: 0 };
      current.quantity = numberValue(current, 'quantity') + numberValue(row, 'quantity', 1);
      current.revenueCents = numberValue(current, 'revenueCents') + itemLineTotal(row);
      map.set(key, current);
    });
  });
  return Array.from(map.values()).sort((left, right) => numberValue(right, 'revenueCents') - numberValue(left, 'revenueCents'));
}

function buildRevenueRows(stats: JsonRecord, orders: JsonRecord[]) {
  const rows = salesStatsArray(stats, 'trend', 'revenueTrend', 'dailyRevenue', 'revenue');
  if (rows.length) {
    return rows.map(row => ({
      ...row,
      key: stringValue(row, 'key', stringValue(row, 'bucket')),
      label: stringValue(row, 'label', stringValue(row, 'bucket')),
      orders: numberValue(row, 'orders', numberValue(row, 'orderCount')),
      revenueCents: numberValue(row, 'revenueCents', numberValue(row, 'salesCents', numberValue(row, 'amountCents'))),
    }));
  }
  const slots = recentDaySlots(14);
  const slotMap = new Map(slots.map(slot => [slot.key, { ...slot }]));
  orders.forEach(order => {
    const date = businessOrderTime(order);
    if (!date) return;
    const slot = slotMap.get(dayKey(date));
    if (!slot) return;
    slot.orders += 1;
    slot.revenueCents += mallOrderPayableCents(order) || mallOrderRevenueCents(order);
  });
  return Array.from(slotMap.values());
}

function operationsTrendBars(data: DashboardData): OperationsTrendBar[] {
  const slots = recentDaySlots(7);
  const slotMap = new Map(slots.map(slot => [slot.key, slot]));
  [...data.mallOrders, ...data.transportOrders].forEach(order => {
    const date = businessOrderTime(order);
    if (!date) return;
    const slot = slotMap.get(dayKey(date));
    if (!slot) return;
    slot.orders += 1;
    slot.revenueCents += combinedOrderRevenueCents(order);
  });

  const maxRevenue = Math.max(...slots.map(slot => slot.revenueCents), 0);
  const maxOrders = Math.max(...slots.map(slot => slot.orders), 0);
  return slots.map(slot => ({
    ...slot,
    percentage: maxRevenue > 0
      ? percentValue(slot.revenueCents, maxRevenue)
      : percentValue(slot.orders, maxOrders),
  }));
}

function operationsFunnelSteps(data: DashboardData): OperationsFunnelStep[] {
  const orders = [...data.mallOrders, ...data.transportOrders];
  const created = orders.length;
  const paid = orders.filter(isPaidBusinessOrder).length;
  const fulfilling = orders.filter(isFulfillmentOrder).length;
  const completed = orders.filter(isCompletedBusinessOrder).length;
  const afterSales = buildAfterSalesQueue(data.mallOrders).length;
  const base = Math.max(created, 1);

  return [
    { label: '订单创建', value: created, detail: '商城订单 + 运力订单', percentage: percentValue(created, base) },
    { label: '支付完成', value: paid, detail: '已支付或进入履约', percentage: percentValue(paid, base) },
    { label: '履约中', value: fulfilling, detail: '派送、配送、处理中', percentage: percentValue(fulfilling, base) },
    { label: '已完成', value: completed, detail: '完成闭环订单', percentage: percentValue(completed, base) },
    { label: '售后处理', value: afterSales, detail: '退款/售后申请', percentage: percentValue(afterSales, base) },
  ];
}

function operationsModuleCards(data: DashboardData, errors: LoadErrors): OperationsModuleCard[] {
  const paidOrders = [...data.mallOrders, ...data.transportOrders].filter(isPaidBusinessOrder).length;
  const orderTotal = data.mallOrders.length + data.transportOrders.length;
  const activeVehicles = data.vehicles.filter(vehicle => ['active', 'approved', 'online'].includes(orderStatus(vehicle) || stringValue(vehicle, 'status'))).length;
  const openTickets = data.supportTickets.filter(ticket => isOpenSupportStatus(orderStatus(ticket))).length;
  const ticketTotal = data.supportTickets.length;
  const errorCount = Object.keys(errors).length;

  return [
    {
      label: '商城交易',
      value: yuan(numberValue(data.mallOverview, 'todayRevenueCents') || data.mallOrders.reduce((total, order) => total + mallOrderRevenueCents(order), 0)),
      detail: `${data.mallOrders.length} 单 · ${data.mallProducts.length} 个商品`,
      status: data.mallOrders.length ? '运行中' : '待拉新',
      progress: percentValue(paidOrders, Math.max(orderTotal, 1)),
    },
    {
      label: '无人车履约',
      value: `${activeVehicles}/${data.vehicles.length}`,
      detail: `${data.transportOrders.length} 个运力订单 · ${data.commissionPending.length} 个佣金待审`,
      status: data.vehicles.length ? '资产在线' : '待接入',
      progress: percentValue(activeVehicles, Math.max(data.vehicles.length, 1)),
    },
    {
      label: '客服售后',
      value: metricValue(data.supportMetrics, ['openSessions']),
      detail: `${openTickets} 个未结工单 · ${buildAfterSalesQueue(data.mallOrders).length} 个售后`,
      status: openTickets ? '需跟进' : '稳定',
      progress: ticketTotal ? percentValue(ticketTotal - openTickets, ticketTotal) : 100,
    },
    {
      label: '公共服务',
      value: errorCount ? `${errorCount} 项异常` : '在线',
      detail: '支付、分账、文件上传和日志服务',
      status: errorCount ? '需处理' : '健康',
      progress: errorCount ? 58 : 100,
    },
  ];
}

function operationsRiskItems(data: DashboardData, errors: LoadErrors): OperationsRiskItem[] {
  const openTickets = data.supportTickets.filter(ticket => isOpenSupportStatus(orderStatus(ticket))).length;
  const pendingOrders = numberValue(data.mallOverview, 'pendingOrders');
  const afterSales = buildAfterSalesQueue(data.mallOrders).length;
  const errorCount = Object.keys(errors).length;
  const risks: OperationsRiskItem[] = [
    {
      label: '待履约订单',
      value: String(pendingOrders || data.mallOrders.filter(isFulfillmentOrder).length),
      detail: '需要派车、核销或客服确认',
      tone: pendingOrders ? 'amber' : 'green',
    },
    {
      label: '库存预警',
      value: String(data.mallInventoryAlerts.length || numberValue(data.mallOverview, 'stockAlerts')),
      detail: '低库存商品需要运营补货',
      tone: data.mallInventoryAlerts.length ? 'amber' : 'green',
    },
    {
      label: '售后队列',
      value: String(afterSales),
      detail: '坏果包赔、退款和补偿待处理',
      tone: afterSales ? 'amber' : 'green',
    },
    {
      label: '客服工单',
      value: String(openTickets),
      detail: '未解决工单影响用户体验',
      tone: openTickets ? 'blue' : 'green',
    },
    {
      label: '公共服务',
      value: errorCount ? `${errorCount} 项` : '正常',
      detail: errorCount ? '部分公共服务需要处理' : '关键服务运行正常',
      tone: errorCount ? 'gray' : 'green',
    },
  ];

  return risks;
}

function operationsInsightCards(data: DashboardData): OperationsInsightCard[] {
  const openSupport = data.supportTickets.filter(ticket => isOpenSupportStatus(orderStatus(ticket))).length;
  const afterSalesQueue = buildAfterSalesQueue(data.mallOrders).length || data.mallAfterSales.filter(item => isOpenSupportStatus(orderStatus(item))).length;
  const pendingDeliverySheets = data.mallDeliverySheets.filter(sheet => {
    const status = orderStatus(sheet) || stringValue(sheet, 'status');
    return ['generated', 'dispatching', 'shipping', 'delivering'].includes(status);
  }).length;
  const pendingWithdrawals = data.mallWithdrawalRequests.filter(item => {
    const status = orderStatus(item) || stringValue(item, 'status');
    return ['pending', 'reviewing', 'processing'].includes(status);
  }).length;

  return [
    {
      label: '履约配送看板',
      value: `${pendingDeliverySheets} 单`,
      detail: `${data.mallDeliverySheets.length} 张配送单 · ${data.mallPickupPoints.length} 个自提点`,
    },
    {
      label: '客服售后看板',
      value: `${afterSalesQueue} 件`,
      detail: `${openSupport} 个工单待处理 · ${metricValue(data.supportMetrics, ['openSessions'])} 个会话`,
    },
    {
      label: '库存供给',
      value: `${data.mallInventoryAlerts.length || numberValue(data.mallOverview, 'stockAlerts')} 个`,
      detail: `${data.mallProducts.length} 个商品 · ${data.mallCategories.length} 个类目`,
    },
    {
      label: '财务结算',
      value: `${pendingWithdrawals} 笔`,
      detail: `${data.mallFinanceBills.length} 条账单 · ${data.mallSettlementRecords.length} 条结算记录`,
    },
  ];
}

function operationsCategorySales(data: DashboardData): OperationsCategorySale[] {
  const rows = buildCategorySalesRows(data.mallSalesStats, data.mallOrders).slice(0, 6);
  const maxRevenue = Math.max(...rows.map(row => numberValue(row, 'revenueCents')), 0);
  return rows.map(row => {
    const revenueCents = numberValue(row, 'revenueCents');
    return {
      name: stringValue(row, 'categoryName', stringValue(row, 'name', stringValue(row, 'categoryCode', '未分类'))),
      quantity: numberValue(row, 'quantity', numberValue(row, 'salesCount')),
      revenueCents,
      percentage: percentValue(revenueCents, Math.max(maxRevenue, 1)),
    };
  });
}

function operationsHotProducts(data: DashboardData): OperationsHotProduct[] {
  const statRows = buildProductSalesRows(data.mallSalesStats, data.mallOrders);
  const productRows = statRows.length
    ? statRows
    : [...data.mallProducts].sort((left, right) => numberValue(right, 'soldCount') - numberValue(left, 'soldCount'));

  return productRows.slice(0, 8).map(row => ({
    name: stringValue(row, 'productName', stringValue(row, 'name', '未命名商品')),
    category: stringValue(row, 'categoryName', stringValue(row, 'categoryCode', '未分类')),
    quantity: numberValue(row, 'quantity', numberValue(row, 'salesCount', numberValue(row, 'soldCount'))),
    revenueCents: numberValue(row, 'revenueCents', numberValue(row, 'priceCents') * numberValue(row, 'soldCount')),
  }));
}

function buildOperationsScreenModel(data: DashboardData, errors: LoadErrors = {}): OperationsScreenModel {
  const trends = operationsTrendBars(data);
  const todayTrend = trends[trends.length - 1];
  const orders = [...data.mallOrders, ...data.transportOrders];
  const paidOrders = orders.filter(isPaidBusinessOrder).length;
  const completedOrders = orders.filter(isCompletedBusinessOrder).length;
  const todayRevenueCents = numberValue(data.mallOverview, 'todayRevenueCents') || todayTrend?.revenueCents || 0;
  const supportSatisfaction = metricValue(data.supportMetrics, ['satisfaction']);
  const totalOrders = orders.length || numberValue(data.adminStats, 'orderCount', numberValue(data.adminStats, 'orders'));
  const fulfillmentRate = percentValue(completedOrders, Math.max(paidOrders, 1));

  return {
    kpis: [
      {
        label: '今日交易额',
        value: yuan(todayRevenueCents),
        detail: `${todayTrend?.orders || 0} 单新增`,
        trend: '实时交易',
      },
      {
        label: '订单总量',
        value: String(totalOrders),
        detail: `${paidOrders} 单已支付`,
        trend: `${fulfillmentRate}% 完成率`,
      },
      {
        label: '在售商品',
        value: metricValue(data.mallOverview, ['onSaleProducts']) || String(data.mallProducts.length),
        detail: `${data.mallInventoryAlerts.length || numberValue(data.mallOverview, 'stockAlerts')} 个库存预警`,
        trend: '商城供给',
      },
      {
        label: '客服满意度',
        value: `${supportSatisfaction}%`,
        detail: `${metricValue(data.supportMetrics, ['openSessions'])} 个会话待跟进`,
        trend: '服务体验',
      },
    ],
    trends,
    funnel: operationsFunnelSteps(data),
    modules: operationsModuleCards(data, errors),
    risks: operationsRiskItems(data, errors),
    insights: operationsInsightCards(data),
    categorySales: operationsCategorySales(data),
    hotProducts: operationsHotProducts(data),
  };
}

function upsertRecordList(list: JsonRecord[], record: JsonRecord) {
  const id = stringValue(record, 'id');
  if (!id) return list;
  return list.some(item => stringValue(item, 'id') === id)
    ? list.map(item => (stringValue(item, 'id') === id ? record : item))
    : [record, ...list];
}

function positiveFilterNumber(value: string, fallback: number) {
  const next = Number(value);
  return Number.isFinite(next) && next > 0 ? Math.floor(next) : fallback;
}

function metricValue(record: JsonRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' || typeof value === 'string') return String(value);
  }
  return '0';
}

function orderEventTime(record: JsonRecord) {
  return stringValue(record, 'eventTime', stringValue(record, 'createdAt'));
}

function itemLineTotal(item: JsonRecord) {
  const explicitTotal = numberValue(item, 'lineTotalCents', numberValue(item, 'totalPriceCents'));
  if (explicitTotal) return explicitTotal;
  return numberValue(item, 'unitPriceCents') * numberValue(item, 'quantity', 1);
}

function itemWeightText(item: JsonRecord, key = 'estimatedWeightGrams') {
  const grams = numberValue(item, key);
  if (!grams) return '-';
  const unitGrams = numberValue(item, 'weightUnitGrams', 500) || 500;
  const label = stringValue(item, 'weightUnitLabel', '斤');
  const value = grams / unitGrams;
  return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(2)}${label}`;
}

function orderHasWeightedItems(order: JsonRecord | null) {
  return arrayValue(order || {}, 'items').some((item) => (
    item && typeof item === 'object' && !Array.isArray(item)
      ? stringValue(item as JsonRecord, 'pricingMode') === 'weighed'
      : false
  ));
}

function Icon({ name }: { name: IconName }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 1.8,
  };
  const paths: Record<IconName, ReactNode> = {
    dashboard: (
      <>
        <path d="M4 13h7V4H4z" />
        <path d="M13 20h7V4h-7z" />
        <path d="M4 20h7v-5H4z" />
      </>
    ),
    users: (
      <>
        <path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
        <path d="M3.5 20a6.5 6.5 0 0 1 13 0" />
        <path d="M17 11a2.5 2.5 0 0 0 0-5" />
        <path d="M18.5 15.5A5 5 0 0 1 21 20" />
      </>
    ),
    truck: (
      <>
        <path d="M3 7h11v10H3z" />
        <path d="M14 11h3l3 3v3h-6z" />
        <path d="M6.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z" />
        <path d="M17.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z" />
      </>
    ),
    orders: (
      <>
        <path d="M6 3h12v18H6z" />
        <path d="M9 8h6" />
        <path d="M9 12h6" />
        <path d="M9 16h4" />
      </>
    ),
    shop: (
      <>
        <path d="M4 10h16l-2-6H6z" />
        <path d="M6 10v10h12V10" />
        <path d="M9 20v-6h6v6" />
      </>
    ),
    'shopping-bag': (
      <>
        <path d="M6 8h12l-1 12H7z" />
        <path d="M9 8a3 3 0 0 1 6 0" />
        <path d="M9 13h6" />
      </>
    ),
    route: (
      <>
        <path d="M5 6a2 2 0 1 0 4 0 2 2 0 0 0-4 0z" />
        <path d="M15 18a2 2 0 1 0 4 0 2 2 0 0 0-4 0z" />
        <path d="M7 8v3a3 3 0 0 0 3 3h4a3 3 0 0 1 3 3v1" />
      </>
    ),
    megaphone: (
      <>
        <path d="M4 13h4l9 4V5L8 9H4z" />
        <path d="M8 13l2 5" />
      </>
    ),
    support: (
      <>
        <path d="M5 12a7 7 0 0 1 14 0v4a2 2 0 0 1-2 2h-2" />
        <path d="M8 12v4H5v-4z" />
        <path d="M19 12v4h-3v-4z" />
        <path d="M11 19h4" />
      </>
    ),
    refresh: (
      <>
        <path d="M20 7v5h-5" />
        <path d="M4 17v-5h5" />
        <path d="M19 12a7 7 0 0 0-12-4" />
        <path d="M5 12a7 7 0 0 0 12 4" />
      </>
    ),
    check: (
      <>
        <path d="M20 6 9 17l-5-5" />
      </>
    ),
    x: (
      <>
        <path d="m6 6 12 12" />
        <path d="m18 6-12 12" />
      </>
    ),
    send: (
      <>
        <path d="M4 12 20 4l-6 16-3-7z" />
        <path d="m11 13 4-4" />
      </>
    ),
    save: (
      <>
        <path d="M5 4h12l2 2v16H5z" />
        <path d="M8 4v7h8V4" />
        <path d="M8 18h8" />
      </>
    ),
    plus: (
      <>
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </>
    ),
    refund: (
      <>
        <path d="M7 7h10a5 5 0 0 1 0 10H9" />
        <path d="m10 4-4 3 4 3" />
        <path d="M12 12h4" />
      </>
    ),
    lock: (
      <>
        <rect x="5" y="11" width="14" height="9" rx="2" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      </>
    ),
    unlock: (
      <>
        <rect x="5" y="11" width="14" height="9" rx="2" />
        <path d="M8 11V7a4 4 0 0 1 7-2" />
      </>
    ),
    menu: (
      <>
        <path d="M4 7h16" />
        <path d="M4 12h16" />
        <path d="M4 17h16" />
      </>
    ),
    logout: (
      <>
        <path d="M10 6H6v12h4" />
        <path d="M14 8l4 4-4 4" />
        <path d="M8 12h10" />
      </>
    ),
  };

  return (
    <svg aria-hidden="true" className="icon" viewBox="0 0 24 24" {...common}>
      {paths[name]}
    </svg>
  );
}

function StatCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <section className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </section>
  );
}

function Panel({
  title,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>{title}</h2>
        </div>
        {action ? <div className="panel-action">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="empty-state">{text}</div>;
}

function ErrorStrip({ errors }: { errors: LoadErrors }) {
  const entries = Object.entries(errors);
  if (!entries.length) return null;
  return (
    <div className="error-strip">
      <strong>部分数据加载失败</strong>
      <span>{entries.map(([key, value]) => `${key}: ${value}`).join('；')}</span>
    </div>
  );
}

function moduleGroups(module: AdminModuleSpec) {
  return Array.from(new Set(module.pages.map(page => page.group)));
}

function designMetrics(page: AdminPageSpec, data: DashboardData) {
  if (page.key.startsWith('mall.')) {
    return [
      ['今日销售', yuan(numberValue(data.mallOverview, 'todayRevenueCents')), '商城实时交易'],
      ['待处理', metricValue(data.mallOverview, ['pendingOrders', 'afterSales']), '订单/售后事项'],
      ['在售商品', metricValue(data.mallOverview, ['onSaleProducts']), '商品池'],
      ['客服会话', metricValue(data.supportMetrics, ['openSessions']), '待响应'],
    ];
  }
  if (page.key.startsWith('vehicle.')) {
    return [
      ['车辆资产', String(data.vehicles.length), '无人车档案'],
      ['运单工单', String(data.transportOrders.length), '履约中'],
      ['待审佣金', String(data.commissionPending.length), '财务处理'],
      ['客服工单', String(data.supportTickets.length), '运维跟进'],
    ];
  }
  return [
    ['账号', String(data.users.length), '平台成员'],
    ['车辆', String(data.vehicles.length), '资产接入'],
    ['订单', String(data.transportOrders.length + data.mallOrders.length), '跨业务订单'],
    ['服务', Object.keys(data.adminStats).length ? '在线' : '待连接', '公共服务'],
  ];
}

function recordsForDesignPage(page: AdminPageSpec, data: DashboardData) {
  if (page.key.includes('account') || page.key.includes('roles') || page.key.includes('permissions')) {
    return data.users;
  }
  if (page.key.startsWith('vehicle') || page.key.includes('vehicle') || page.key.includes('owner')) {
    return data.vehicles.length ? data.vehicles : data.transportOrders;
  }
  if (page.key.includes('transport') || page.key.includes('commission')) {
    return data.commissionPending.length ? data.commissionPending : data.transportOrders;
  }
  if (page.key.includes('product') || page.key.includes('inventory') || page.key.includes('images')) {
    return data.mallProducts;
  }
  if (page.key.includes('order') || page.key.includes('refund') || page.key.includes('fulfillment') || page.key.includes('afterSales')) {
    return data.mallOrders;
  }
  if (page.key.includes('coupon')) {
    return data.mallCoupons;
  }
  if (page.key.includes('banner')) {
    return data.mallHomeBanners;
  }
  if (page.key.includes('campaign') || page.key.includes('community')) {
    return data.campaigns;
  }
  if (page.key.includes('support') || page.key.includes('knowledge')) {
    return data.supportSessions.length ? data.supportSessions : data.supportTickets;
  }
  return [];
}

function fallbackDesignRows(page: AdminPageSpec): JsonRecord[] {
  return [
    {
      id: `${page.key}-1`,
      name: `${page.label}待处理事项`,
      owner: page.key.startsWith('mall.') ? '叁友运营' : page.key.startsWith('vehicle.') ? '锐途运维' : '平台管理员',
      status: 'pending',
      updatedAt: '2026-06-05 10:30',
    },
    {
      id: `${page.key}-2`,
      name: `${page.label}已通过记录`,
      owner: '系统同步',
      status: 'active',
      updatedAt: '2026-06-05 09:15',
    },
    {
      id: `${page.key}-3`,
      name: `${page.label}异常复核`,
      owner: '客服工作台',
      status: 'open',
      updatedAt: '2026-06-04 18:22',
    },
  ];
}

function EnterpriseSection({
  enterprises,
  onUpdateStatus,
}: {
  enterprises: JsonRecord[];
  onUpdateStatus: (id: string, status: string) => Promise<void>;
}) {
  return (
    <Panel title="企业管理" description="管理入驻企业主体、认证状态和运营信息">
      <div className="stat-grid compact">
        <StatCard label="企业总数" value={String(enterprises.length)} detail="已注册企业" />
        <StatCard label="已认证" value={String(enterprises.filter(e => stringValue(e, 'status') === 'active' || stringValue(e, 'verified') === 'true').length)} detail="通过审核" />
        <StatCard label="待审核" value={String(enterprises.filter(e => stringValue(e, 'status') === 'pending').length)} detail="等待审核" />
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>企业名称</th>
              <th>联系人</th>
              <th>联系电话</th>
              <th>状态</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {enterprises.map(enterprise => {
              const id = stringValue(enterprise, 'id');
              const status = stringValue(enterprise, 'status', 'pending');
              return (
                <tr key={id}>
                  <td>
                    <strong>{stringValue(enterprise, 'name', stringValue(enterprise, 'companyName', '未填写'))}</strong>
                    <small>{stringValue(enterprise, 'unifiedSocialCode', stringValue(enterprise, 'creditCode', ''))}</small>
                  </td>
                  <td>{stringValue(enterprise, 'contactName', stringValue(enterprise, 'legalPerson', '-'))}</td>
                  <td>{stringValue(enterprise, 'contactPhone', stringValue(enterprise, 'phone', '-'))}</td>
                  <td>
                    <span className={badgeClass(status)}>{statusLabel(status)}</span>
                  </td>
                  <td>{formatDate(stringValue(enterprise, 'created_at', stringValue(enterprise, 'createdAt')))}</td>
                  <td className="actions">
                    {status === 'pending' ? (
                      <>
                        <button className="ghost-button" type="button" onClick={() => onUpdateStatus(id, 'active')}>
                          <Icon name="check" />通过
                        </button>
                        <button className="ghost-button danger" type="button" onClick={() => onUpdateStatus(id, 'rejected')}>
                          <Icon name="x" />拒绝
                        </button>
                      </>
                    ) : status === 'active' ? (
                      <button className="ghost-button danger" type="button" onClick={() => onUpdateStatus(id, 'disabled')}>
                        <Icon name="x" />停用
                      </button>
                    ) : (
                      <button className="ghost-button" type="button" onClick={() => onUpdateStatus(id, 'active')}>
                        <Icon name="check" />启用
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!enterprises.length ? <EmptyState text="暂无企业数据" /> : null}
    </Panel>
  );
}

function DemandsSection({
  demands,
  vehicles,
}: {
  demands: JsonRecord[];
  vehicles: JsonRecord[];
}) {
  const [demandFilter, setDemandFilter] = useState('');
  const filtered = demandFilter ? demands.filter(d => stringValue(d, 'status') === demandFilter) : demands;
  const activeVehicles = vehicles.filter(v => stringValue(v, 'status') === 'active' && boolValue(v, 'is_available', true));

  return (
    <div className="page-grid">
      <div className="stat-grid compact">
        <StatCard label="需求总数" value={String(demands.length)} detail="全部需求" />
        <StatCard label="待接单" value={String(demands.filter(d => stringValue(d, 'status') === 'pending').length)} detail="等待运力" />
        <StatCard label="运输中" value={String(demands.filter(d => stringValue(d, 'status') === 'in_transit').length)} detail="正在配送" />
        <StatCard label="可用车辆" value={String(activeVehicles.length)} detail="在线可调度" />
      </div>

      <div className="admin-filterbar">
        <select value={demandFilter} onChange={e => setDemandFilter(e.target.value)}>
          <option value="">全部状态</option>
          <option value="pending">待接单</option>
          <option value="accepted">已接单</option>
          <option value="in_transit">运输中</option>
          <option value="completed">已完成</option>
          <option value="cancelled">已取消</option>
        </select>
      </div>

      <Panel title="需求列表" description="查看所有运输需求，监控需求和运力匹配状态">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>货品</th>
                <th>发货地址</th>
                <th>收货地址</th>
                <th>重量/体积</th>
                <th>需求方</th>
                <th>状态</th>
                <th>创建时间</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 50).map(demand => {
                const id = stringValue(demand, 'id');
                return (
                  <tr key={id}>
                    <td>
                      <strong>{stringValue(demand, 'cargo_name', stringValue(demand, 'cargoName', '未填写'))}</strong>
                      <small>{stringValue(demand, 'cargo_type', stringValue(demand, 'cargoType', ''))}</small>
                    </td>
                    <td>{stringValue(demand, 'pickup_address', stringValue(demand, 'pickupAddress', '-'))}</td>
                    <td>{stringValue(demand, 'delivery_address', stringValue(demand, 'deliveryAddress', '-'))}</td>
                    <td>
                      <span>{numberValue(demand, 'weight', numberValue(demand, 'cargoWeight'))}kg</span>
                      <small>{numberValue(demand, 'volume', numberValue(demand, 'cargoVolume'))}m³</small>
                    </td>
                    <td>{shortId(stringValue(demand, 'merchant_id', stringValue(demand, 'merchantId', stringValue(demand, 'enterprise_id', '-'))))}</td>
                    <td>
                      <span className={badgeClass(stringValue(demand, 'status'))}>{statusLabel(stringValue(demand, 'status'))}</span>
                    </td>
                    <td>{formatDate(stringValue(demand, 'created_at', stringValue(demand, 'createdAt')))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!filtered.length ? <EmptyState text="暂无需求数据" /> : null}
      </Panel>
    </div>
  );
}

function CancellationsSection({
  cancellations,
  onHandle,
}: {
  cancellations: JsonRecord[];
  onHandle: (id: string, action: string, reason?: string) => Promise<void>;
}) {
  return (
    <Panel title="取消申请" description="处理需求方和车主的订单取消申请，审核赔付和协商结果">
      <div className="stat-grid compact">
        <StatCard label="待处理" value={String(cancellations.filter(c => stringValue(c, 'status') === 'pending' || stringValue(c, 'status') === 'open').length)} detail="等待审核" />
        <StatCard label="已处理" value={String(cancellations.filter(c => stringValue(c, 'status') === 'approved' || stringValue(c, 'status') === 'resolved').length)} detail="已完结" />
        <StatCard label="总申请" value={String(cancellations.length)} detail="全部取消记录" />
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>申请方</th>
              <th>订单</th>
              <th>取消原因</th>
              <th>状态</th>
              <th>申请时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {cancellations.map(cancel => {
              const id = stringValue(cancel, 'id');
              const status = stringValue(cancel, 'status', 'pending');
              const isPending = status === 'pending' || status === 'open';
              return (
                <tr key={id}>
                  <td>
                    <strong>{stringValue(cancel, 'requester_role', stringValue(cancel, 'requesterRole', stringValue(cancel, 'cancelled_by', '未知')))}</strong>
                    <small>{shortId(stringValue(cancel, 'requester_id', stringValue(cancel, 'requesterId', '')))}</small>
                  </td>
                  <td>{shortId(stringValue(cancel, 'order_id', stringValue(cancel, 'orderId', '')))}</td>
                  <td>{stringValue(cancel, 'reason', stringValue(cancel, 'cancel_reason', '-'))}</td>
                  <td>
                    <span className={badgeClass(status)}>{statusLabel(status)}</span>
                  </td>
                  <td>{formatDate(stringValue(cancel, 'created_at', stringValue(cancel, 'createdAt')))}</td>
                  <td className="actions">
                    {isPending ? (
                      <>
                        <button className="ghost-button" type="button" onClick={() => onHandle(id, 'approve')}>
                          <Icon name="check" />同意
                        </button>
                        <button className="ghost-button danger" type="button" onClick={() => onHandle(id, 'reject', '平台审核不通过')}>
                          <Icon name="x" />拒绝
                        </button>
                      </>
                    ) : (
                      <span className="badge badge-gray">已处理</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!cancellations.length ? <EmptyState text="暂无取消申请" /> : null}
    </Panel>
  );
}

function OwnerWalletSection({
  withdrawals,
  onManualComplete,
  onManualFail,
}: {
  withdrawals: JsonRecord[];
  onManualComplete: (id: string) => Promise<void>;
  onManualFail: (id: string) => Promise<void>;
}) {
  const pending = withdrawals.filter(w => stringValue(w, 'status') === 'pending' || stringValue(w, 'status') === 'processing');
  const completed = withdrawals.filter(w => stringValue(w, 'status') === 'completed' || stringValue(w, 'status') === 'success');
  const failed = withdrawals.filter(w => stringValue(w, 'status') === 'failed');

  return (
    <div className="page-grid">
      <div className="stat-grid compact">
        <StatCard label="待处理提现" value={String(pending.length)} detail="等待平台确认" />
        <StatCard label="已完成" value={String(completed.length)} detail="提现成功" />
        <StatCard label="失败/异常" value={String(failed.length)} detail="需人工处理" />
      </div>

      <Panel title="车主提现记录" description="管理车主钱包提现申请，处理微信转账失败和人工确认">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>车主</th>
                <th>提现金额</th>
                <th>状态</th>
                <th>微信交易号</th>
                <th>申请时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {withdrawals.map(withdrawal => {
                const id = stringValue(withdrawal, 'id');
                const status = stringValue(withdrawal, 'status', 'pending');
                const isPending = status === 'pending' || status === 'processing';
                const isFailed = status === 'failed';
                return (
                  <tr key={id}>
                    <td>
                      <strong>{stringValue(withdrawal, 'owner_name', stringValue(withdrawal, 'ownerName', '车主'))}</strong>
                      <small>{shortId(stringValue(withdrawal, 'owner_id', stringValue(withdrawal, 'ownerId', '')))}</small>
                    </td>
                    <td>{yuan(Math.round(numberValue(withdrawal, 'amount', numberValue(withdrawal, 'amountCents', 0)) * (numberValue(withdrawal, 'amountCents') > 0 ? 1 : 100)))}</td>
                    <td>
                      <span className={badgeClass(status)}>{statusLabel(status)}</span>
                    </td>
                    <td>{stringValue(withdrawal, 'wechat_transaction_id', stringValue(withdrawal, 'transactionId', '-'))}</td>
                    <td>{formatDate(stringValue(withdrawal, 'created_at', stringValue(withdrawal, 'createdAt')))}</td>
                    <td className="actions">
                      {isPending && (
                        <button className="primary-button small" type="button" onClick={() => onManualComplete(id)}>
                          <Icon name="check" />确认完成
                        </button>
                      )}
                      {isFailed && (
                        <button className="ghost-button" type="button" onClick={() => onManualFail(id)}>
                          <Icon name="refresh" />标记失败
                        </button>
                      )}
                      {!isPending && !isFailed && (
                        <span className="badge badge-gray">已处理</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!withdrawals.length ? <EmptyState text="暂无提现记录" /> : null}
      </Panel>
    </div>
  );
}

function DispatchSection({
  trips,
  undispatchedOrders,
  allOrders,
  availableVehicles,
  onCreateTrip,
  onAssignOrders,
  onRemoveOrder,
  onLockTrip,
  onUnlockTrip,
  onStartTrip,
  onCompleteTrip,
  onReorderStops: _onReorderStops,
  onAutoAssign,
}: {
  trips: JsonRecord[];
  undispatchedOrders: JsonRecord[];
  allOrders: JsonRecord[];
  availableVehicles: JsonRecord[];
  onCreateTrip: (vehicleId: string, orderIds: string[]) => Promise<void>;
  onAssignOrders: (tripId: string, orderIds: string[]) => Promise<void>;
  onRemoveOrder: (tripId: string, orderId: string) => Promise<void>;
  onLockTrip: (tripId: string) => Promise<void>;
  onUnlockTrip: (tripId: string) => Promise<void>;
  onStartTrip: (tripId: string) => Promise<void>;
  onCompleteTrip: (tripId: string) => Promise<void>;
  onReorderStops: (_tripId: string, _stopIds: string[]) => Promise<void>;
  onAutoAssign: (orderIds: string[], maxOrdersPerSlot: number, dryRun: boolean) => Promise<void>;
}) {
  const [activeTab, setActiveTab] = useState<'orders' | 'trips'>('orders');
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [selectedTripId, setSelectedTripId] = useState('');
  const [tripFilter, setTripFilter] = useState('');
  const [tripTimeSlotFilter, setTripTimeSlotFilter] = useState('all');
  const [expandedTrip, setExpandedTrip] = useState<string | null>(null);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [maxOrdersPerSlot, setMaxOrdersPerSlot] = useState(5);
  const [orderSearchType, setOrderSearchType] = useState('order_no');
  const [orderSearchKeyword, setOrderSearchKeyword] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('all');
  const [orderTimeSlotFilter, setOrderTimeSlotFilter] = useState('all');
  const [orderCurrentPage, setOrderCurrentPage] = useState(1);
  const [orderPageSize, setOrderPageSize] = useState(10);
  const [dispatchMode, setDispatchMode] = useState<'new_trip' | 'existing_trip'>('new_trip');

  const toggleOrder = (id: string) => {
    setSelectedOrders(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleDispatch = async () => {
    if (selectedOrders.size === 0) return;
    const orderIds = Array.from(selectedOrders);
    if (dispatchMode === 'new_trip') {
      if (!selectedVehicle) return;
      await onCreateTrip(selectedVehicle, orderIds);
      setSelectedVehicle('');
    } else {
      if (!selectedTripId) return;
      await onAssignOrders(selectedTripId, orderIds);
      setSelectedTripId('');
    }
    setSelectedOrders(new Set());
  };

  const filteredTrips = trips.filter(t => {
    if (tripFilter && stringValue(t, 'status') !== tripFilter) return false;
    if (tripTimeSlotFilter !== 'all') {
      const slot = stringValue(t, 'delivery_time_slot', stringValue(t, 'deliveryTimeSlot', ''));
      if (slot !== tripTimeSlotFilter) return false;
    }
    return true;
  });
  const inProgressTrips = trips.filter(t => stringValue(t, 'status') === 'in_progress');
  const editableTrips = trips.filter(t => stringValue(t, 'status') === 'planned' || stringValue(t, 'status') === 'locked');
  const dispatchedOrders = allOrders.filter(o => stringValue(o, 'trip_id'));
  const undispatchedCount = allOrders.filter(o => !stringValue(o, 'trip_id')).length;

  const filteredAllOrders = useMemo(() => {
    let result = allOrders;
    if (orderStatusFilter === 'undispatched') {
      result = result.filter(o => !stringValue(o, 'trip_id'));
    } else if (orderStatusFilter === 'dispatched') {
      result = result.filter(o => stringValue(o, 'trip_id'));
    }
    if (orderTimeSlotFilter !== 'all') {
      result = result.filter(o => {
        const slot = stringValue(o, 'delivery_time_slot', stringValue(o, 'deliveryTimeSlot', ''));
        return slot === orderTimeSlotFilter;
      });
    }
    if (!orderSearchKeyword.trim()) return result;
    const keyword = orderSearchKeyword.trim().toLowerCase();
    return result.filter(order => {
      switch (orderSearchType) {
        case 'order_no':
          return stringValue(order, 'order_no', stringValue(order, 'orderNo', '')).toLowerCase().includes(keyword);
        case 'recipient':
          return stringValue(order, 'recipient_name', stringValue(order, 'recipientName', '')).toLowerCase().includes(keyword)
            || stringValue(order, 'recipient_phone', stringValue(order, 'recipientPhone', '')).toLowerCase().includes(keyword);
        case 'product': {
          const items = (order as Record<string, unknown>).items as JsonRecord[] | undefined;
          if (!items || items.length === 0) return false;
          return items.some(item => stringValue(item, 'productName', '').toLowerCase().includes(keyword));
        }
        case 'vehicle':
          return stringValue(order, 'vehicle_code', '').toLowerCase().includes(keyword)
            || stringValue(order, 'license_plate', '').toLowerCase().includes(keyword);
        case 'status':
          return statusLabel(stringValue(order, 'status')).toLowerCase().includes(keyword);
        case 'time_slot':
          return stringValue(order, 'delivery_time_slot', stringValue(order, 'deliveryTimeSlot', '')).toLowerCase().includes(keyword);
        default:
          return true;
      }
    });
  }, [allOrders, orderSearchType, orderSearchKeyword, orderStatusFilter, orderTimeSlotFilter]);

  const selectableOrders = useMemo(() => {
    return filteredAllOrders.filter(o => !stringValue(o, 'trip_id')).map(o => stringValue(o, 'id'));
  }, [filteredAllOrders]);

  const orderTotalPages = Math.max(1, Math.ceil(filteredAllOrders.length / orderPageSize));
  const safeOrderCurrentPage = Math.min(orderCurrentPage, orderTotalPages);
  const paginatedOrders = useMemo(() => {
    const start = (safeOrderCurrentPage - 1) * orderPageSize;
    return filteredAllOrders.slice(start, start + orderPageSize);
  }, [filteredAllOrders, safeOrderCurrentPage, orderPageSize]);

  const handleOrderSearch = () => {
    setOrderCurrentPage(1);
  };

  const handleOrderPageChange = (page: number) => {
    setOrderCurrentPage(Math.max(1, Math.min(page, orderTotalPages)));
  };

  const tripStatusLabel: Record<string, string> = { planned: '未锁定', locked: '已锁定', in_progress: '运输中', completed: '已完成', cancelled: '已取消' };
  const tripStatusColor: Record<string, string> = { planned: 'badge-yellow', locked: 'badge-blue', in_progress: 'badge-green', completed: 'badge-gray', cancelled: 'badge-red' };
  const tripStatusBg: Record<string, string> = { planned: '#fef9c3', locked: '#dbeafe', in_progress: '#dcfce7', completed: '#f3f4f6', cancelled: '#fee2e2' };
  const tripStatusBorder: Record<string, string> = { planned: '#facc15', locked: '#3b82f6', in_progress: '#22c55e', completed: '#9ca3af', cancelled: '#ef4444' };

  return (
    <div className="page-grid">
      {/* 统计卡片 */}
      <div className="stat-grid compact">
        <StatCard label="总订单" value={String(allOrders.length)} detail="全部配送订单" />
        <StatCard label="待分配" value={String(undispatchedCount)} detail="等待安排车辆" />
        <StatCard label="已分配" value={String(dispatchedOrders.length)} detail="已安排行程" />
        <StatCard label="可用车辆" value={String(availableVehicles.length)} detail="空闲可调度" />
        <StatCard label="运输中" value={String(inProgressTrips.length)} detail="正在配送" />
      </div>

      {/* 主 Tab 切换 */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', borderBottom: '1px solid #e5e7eb', paddingBottom: '0' }}>
        <button
          type="button"
          onClick={() => setActiveTab('orders')}
          style={{
            padding: '12px 20px',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            fontSize: '15px',
            fontWeight: activeTab === 'orders' ? 600 : 500,
            color: activeTab === 'orders' ? '#1d4ed8' : '#6b7280',
            borderBottom: activeTab === 'orders' ? '2px solid #1d4ed8' : '2px solid transparent',
            marginBottom: '-1px',
          }}
        >
          📦 订单视角
          <span style={{ marginLeft: '8px', padding: '2px 8px', fontSize: '12px', background: activeTab === 'orders' ? '#dbeafe' : '#f3f4f6', color: activeTab === 'orders' ? '#1d4ed8' : '#6b7280', borderRadius: '10px', fontWeight: 500 }}>
            {allOrders.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('trips')}
          style={{
            padding: '12px 20px',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            fontSize: '15px',
            fontWeight: activeTab === 'trips' ? 600 : 500,
            color: activeTab === 'trips' ? '#1d4ed8' : '#6b7280',
            borderBottom: activeTab === 'trips' ? '2px solid #1d4ed8' : '2px solid transparent',
            marginBottom: '-1px',
          }}
        >
          🚗 行程视角
          <span style={{ marginLeft: '8px', padding: '2px 8px', fontSize: '12px', background: activeTab === 'trips' ? '#dbeafe' : '#f3f4f6', color: activeTab === 'trips' ? '#1d4ed8' : '#6b7280', borderRadius: '10px', fontWeight: 500 }}>
            {trips.length}
          </span>
        </button>
      </div>

      {/* 订单视角 */}
      {activeTab === 'orders' && (
        <Panel title="订单管理" description="查看所有订单，分配到行程或从行程中移除">
          {/* 分配操作栏 */}
          <div style={{ padding: '12px 16px', background: '#f0f9ff', borderRadius: '8px', border: '1px solid #bae6fd', marginBottom: '16px' }}>
            {/* 模式切换 Tab */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '12px', borderBottom: '1px solid #bae6fd', paddingBottom: '0' }}>
              <button
                type="button"
                onClick={() => { setDispatchMode('new_trip'); setSelectedTripId(''); }}
                style={{
                  padding: '8px 14px',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: dispatchMode === 'new_trip' ? 600 : 400,
                  color: dispatchMode === 'new_trip' ? '#0369a1' : '#6b7280',
                  borderBottom: dispatchMode === 'new_trip' ? '2px solid #0369a1' : '2px solid transparent',
                  marginBottom: '-1px',
                }}
              >
                🚗 分配到新车程
              </button>
              <button
                type="button"
                onClick={() => { setDispatchMode('existing_trip'); setSelectedVehicle(''); }}
                style={{
                  padding: '8px 14px',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: dispatchMode === 'existing_trip' ? 600 : 400,
                  color: dispatchMode === 'existing_trip' ? '#0369a1' : '#6b7280',
                  borderBottom: dispatchMode === 'existing_trip' ? '2px solid #0369a1' : '2px solid transparent',
                  marginBottom: '-1px',
                }}
              >
                📋 追加到已有行程
                {editableTrips.length > 0 && (
                  <span style={{ marginLeft: '6px', padding: '1px 6px', fontSize: '11px', background: '#e0e7ff', color: '#4338ca', borderRadius: '10px' }}>
                    {editableTrips.length}
                  </span>
                )}
              </button>
            </div>

            {/* 目标选择器 */}
            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              {dispatchMode === 'new_trip' ? (
                <div style={{ flex: '1 1 240px' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>选择车辆</label>
                  <select
                    value={selectedVehicle}
                    onChange={e => {
                      const vehicleId = e.target.value;
                      setSelectedVehicle(vehicleId);
                      // 检测该车辆当天是否已有进行中的行程
                      if (vehicleId) {
                        const today = new Date().toISOString().split('T')[0];
                        const existingTrip = trips.find(t =>
                          stringValue(t, 'vehicle_id', stringValue(t, 'vehicleId', '')) === vehicleId &&
                          stringValue(t, 'status') !== 'completed' &&
                          stringValue(t, 'status') !== 'cancelled' &&
                          (stringValue(t, 'delivery_date', stringValue(t, 'deliveryDate', '')).split('T')[0] === today ||
                            new Date(stringValue(t, 'created_at', stringValue(t, 'createdAt', ''))).toISOString().split('T')[0] === today)
                        );
                        if (existingTrip) {
                          setDispatchMode('existing_trip');
                          setSelectedTripId(stringValue(existingTrip, 'id'));
                          setSelectedVehicle('');
                        }
                      }
                    }}
                  >
                    <option value="">-- 选择车辆 --</option>
                    {availableVehicles.map(v => (
                      <option key={stringValue(v, 'id')} value={stringValue(v, 'id')}>
                        {stringValue(v, 'vehicle_code', stringValue(v, 'vehicleCode', ''))} - {stringValue(v, 'license_plate', stringValue(v, 'licensePlate', ''))} ({stringValue(v, 'vehicle_type', stringValue(v, 'vehicleType', ''))})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div style={{ flex: '1 1 240px' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>选择行程</label>
                  <select value={selectedTripId} onChange={e => setSelectedTripId(e.target.value)}>
                    <option value="">-- 选择行程 --</option>
                    {editableTrips.map(t => {
                      const ts = stringValue(t, 'status');
                      return (
                        <option key={stringValue(t, 'id')} value={stringValue(t, 'id')}>
                          #{stringValue(t, 'trip_no', stringValue(t, 'tripNo', '-'))} {stringValue(t, 'vehicle_code', stringValue(t, 'vehicleCode', ''))} - {stringValue(t, 'license_plate', stringValue(t, 'licensePlate', ''))} [{tripStatusLabel[ts] || ts}] ({stringValue(t, 'total_orders', stringValue(t, 'totalOrders', '0'))}单)
                        </option>
                      );
                    })}
                  </select>
                  {editableTrips.length === 0 && (
                    <div style={{ fontSize: '12px', color: '#f59e0b', marginTop: '4px' }}>暂无可用行程，请选择「分配到新车程」</div>
                  )}
                </div>
              )}
              <div>
                <span style={{ fontSize: '12px', color: '#6b7280' }}>已选 {selectedOrders.size} 个订单</span>
              </div>
              <button
                className="primary-button"
                type="button"
                disabled={selectedOrders.size === 0 || (dispatchMode === 'new_trip' ? !selectedVehicle : !selectedTripId)}
                onClick={handleDispatch}
              >
                分配选中订单
              </button>
            </div>
          </div>

          {/* 智能调度 */}
          <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', alignItems: 'center', flexWrap: 'wrap', padding: '12px 16px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#166534' }}>✨ 智能调度</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ fontSize: '12px', color: '#6b7280' }}>每车每时段最多</label>
              <input
                type="number"
                value={maxOrdersPerSlot}
                onChange={e => setMaxOrdersPerSlot(Math.max(1, parseInt(e.target.value, 10) || 5))}
                style={{ width: '60px', padding: '4px 8px', borderRadius: '4px', border: '1px solid #d1d5db', textAlign: 'center' }}
                min={1}
                max={20}
              />
              <span style={{ fontSize: '12px', color: '#6b7280' }}>单</span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #22c55e', background: '#fff', color: '#22c55e', cursor: 'pointer', fontSize: '13px' }}
                onClick={() => onAutoAssign(Array.from(selectedOrders), maxOrdersPerSlot, true)}
                disabled={selectedOrders.size === 0}
              >
                预览分配
              </button>
              <button
                type="button"
                style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', background: '#22c55e', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 500 }}
                onClick={() => onAutoAssign(selectedOrders.size > 0 ? Array.from(selectedOrders) : undispatchedOrders.map(o => stringValue(o, 'id')), maxOrdersPerSlot, false)}
              >
                {selectedOrders.size > 0 ? `分配选中 ${selectedOrders.size} 单` : '一键分配全部待分配'}
              </button>
            </div>
          </div>

          {/* 筛选栏 */}
          <div className="admin-filterbar" style={{ marginBottom: '12px', gridTemplateColumns: 'minmax(120px, 0.7fr) minmax(140px, 0.8fr) minmax(120px, 0.7fr) minmax(200px, 1.2fr) auto auto auto' }}>
            <select
              value={orderStatusFilter}
              onChange={e => { setOrderStatusFilter(e.target.value); setOrderCurrentPage(1); setSelectedOrders(new Set()); }}
            >
              <option value="all">全部订单</option>
              <option value="undispatched">未分配</option>
              <option value="dispatched">已分配</option>
            </select>
            <select
              value={orderTimeSlotFilter}
              onChange={e => { setOrderTimeSlotFilter(e.target.value); setOrderCurrentPage(1); setSelectedOrders(new Set()); }}
            >
              <option value="all">全部时段</option>
              <option value="08:00-09:00">08:00-09:00</option>
              <option value="09:00-10:00">09:00-10:00</option>
              <option value="10:00-11:00">10:00-11:00</option>
              <option value="11:00-12:00">11:00-12:00</option>
              <option value="12:00-13:00">12:00-13:00</option>
              <option value="13:00-14:00">13:00-14:00</option>
              <option value="14:00-15:00">14:00-15:00</option>
              <option value="15:00-16:00">15:00-16:00</option>
              <option value="16:00-17:00">16:00-17:00</option>
              <option value="17:00-18:00">17:00-18:00</option>
              <option value="18:00-19:00">18:00-19:00</option>
              <option value="19:00-20:00">19:00-20:00</option>
            </select>
            <select
              value={orderSearchType}
              onChange={e => { setOrderSearchType(e.target.value); setOrderCurrentPage(1); }}
            >
              <option value="order_no">订单号</option>
              <option value="recipient">收货人</option>
              <option value="product">商品</option>
              <option value="vehicle">车辆</option>
              <option value="status">状态</option>
            </select>
            <input
              type="text"
              value={orderSearchKeyword}
              onChange={e => setOrderSearchKeyword(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleOrderSearch(); }}
              placeholder="输入关键词搜索..."
            />
            <button className="primary-button small" type="button" onClick={handleOrderSearch}>
              搜索
            </button>
            {orderSearchKeyword && (
              <button className="ghost-button small" type="button" onClick={() => { setOrderSearchKeyword(''); setOrderCurrentPage(1); }}>
                重置
              </button>
            )}
            <span style={{ fontSize: '13px', color: '#667085' }}>
              共 {filteredAllOrders.length} 条
            </span>
          </div>

          {/* 订单列表 - 带详情展开 */}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>
                    {orderStatusFilter !== 'dispatched' && (
                      <input
                        type="checkbox"
                        checked={selectableOrders.length > 0 && selectableOrders.every(id => selectedOrders.has(id))}
                        ref={input => { if (input) input.indeterminate = selectedOrders.size > 0 && selectedOrders.size < selectableOrders.length; }}
                        onChange={e => {
                          if (e.target.checked) {
                            setSelectedOrders(new Set(selectableOrders));
                          } else {
                            setSelectedOrders(new Set());
                          }
                        }}
                      />
                    )}
                  </th>
                  <th>订单号</th>
                  <th>收货人</th>
                  <th>收货地址</th>
                  <th>商品</th>
                  <th>金额</th>
                  <th>状态</th>
                  <th>配送时段</th>
                  <th>分配车辆</th>
                  <th style={{ width: '60px' }}></th>
                </tr>
              </thead>
              <tbody>
                {paginatedOrders.map(order => {
                  const id = stringValue(order, 'id');
                  const items = (order as Record<string, unknown>).items as JsonRecord[] | undefined;
                  const isExpanded = expandedOrder === id;
                  const tripId = stringValue(order, 'trip_id');
                  const vehicleCode = stringValue(order, 'vehicle_code', '');
                  const licensePlate = stringValue(order, 'license_plate', '');
                  const tripStatus = stringValue(order, 'trip_status', '');
                  const isDispatched = !!tripId;
                  return (
                    <>
                      <tr key={id} style={{ background: selectedOrders.has(id) ? '#eff6ff' : undefined }}>
                        <td>
                          {!isDispatched ? (
                            <input type="checkbox" checked={selectedOrders.has(id)} onChange={() => toggleOrder(id)} />
                          ) : (
                            <span style={{ color: '#9ca3af', fontSize: '12px' }}>—</span>
                          )}
                        </td>
                        <td><strong>{stringValue(order, 'order_no', stringValue(order, 'orderNo', shortId(id)))}</strong></td>
                      <td>
                        <div>{stringValue(order, 'recipient_name', stringValue(order, 'recipientName', '-'))}</div>
                        <div style={{ fontSize: '11px', color: '#9ca3af' }}>{stringValue(order, 'recipient_phone', stringValue(order, 'recipientPhone', ''))}</div>
                      </td>
                      <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stringValue(order, 'address_text', stringValue(order, 'addressText', '-'))}</td>
                      <td>
                        {items && items.length > 0
                          ? items.map(i => stringValue(i, 'productName', '')).filter(Boolean).join(', ') || '-'
                          : '-'}
                      </td>
                      <td>{yuan(Math.round(numberValue(order, 'payable_cents', numberValue(order, 'payableCents', 0)) / 100))}</td>
                      <td><span className={badgeClass(stringValue(order, 'status'))}>{statusLabel(stringValue(order, 'status'))}</span></td>
                      <td>
                        {(() => {
                          const slot = stringValue(order, 'delivery_time_slot', stringValue(order, 'deliveryTimeSlot', ''));
                          if (!slot) return <span style={{ fontSize: '12px', color: '#9ca3af' }}>-</span>;
                          const slotColors: Record<string, { bg: string; text: string; border: string }> = {
                            '08:00-09:00': { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' },
                            '09:00-10:00': { bg: '#dbeafe', text: '#1e40af', border: '#93c5fd' },
                            '10:00-11:00': { bg: '#dcfce7', text: '#166534', border: '#86efac' },
                            '11:00-12:00': { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' },
                            '12:00-13:00': { bg: '#fce7f3', text: '#9d174d', border: '#f9a8d4' },
                            '13:00-14:00': { bg: '#f3e8ff', text: '#6b21a8', border: '#d8b4fe' },
                            '14:00-15:00': { bg: '#ede9fe', text: '#5b21b6', border: '#c4b5fd' },
                            '15:00-16:00': { bg: '#e0f2fe', text: '#075985', border: '#7dd3fc' },
                            '16:00-17:00': { bg: '#f0fdf4', text: '#166534', border: '#86efac' },
                            '17:00-18:00': { bg: '#fff7ed', text: '#9a3412', border: '#fdba74' },
                            '18:00-19:00': { bg: '#f1f5f9', text: '#334155', border: '#cbd5e1' },
                            '19:00-20:00': { bg: '#fef9c3', text: '#854d0e', border: '#fde047' },
                          };
                          const style = slotColors[slot] || { bg: '#f3f4f6', text: '#4b5563', border: '#d1d5db' };
                          return (
                            <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: style.bg, color: style.text, fontWeight: 600, border: `1px solid ${style.border}`, whiteSpace: 'nowrap' }}>
                              🕐 {slot}
                            </span>
                          );
                        })()}
                      </td>
                      <td>
                        {isDispatched ? (
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 500, color: '#1f2937' }}>{vehicleCode || '-'}</div>
                            <div style={{ fontSize: '11px', color: '#6b7280' }}>{licensePlate} · {tripStatusLabel[tripStatus] || tripStatus}</div>
                          </div>
                        ) : (
                          <span style={{ fontSize: '12px', color: '#9ca3af' }}>未分配</span>
                        )}
                      </td>
                      <td style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        <button className="ghost-button" style={{ fontSize: '12px', padding: '2px 6px' }} type="button" onClick={() => setExpandedOrder(isExpanded ? null : id)}>
                          {isExpanded ? '收起' : '详情'}
                        </button>
                        {isDispatched && (tripStatus === 'planned' || tripStatus === 'locked') && (
                          <button
                            className="ghost-button"
                            style={{ fontSize: '12px', padding: '2px 6px', color: '#ef4444' }}
                            type="button"
                            onClick={() => { if (tripId) onRemoveOrder(tripId, id); }}
                          >
                            移除
                          </button>
                        )}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${id}-detail`}>
                        <td colSpan={10} style={{ padding: '0', background: '#f9fafb' }}>
                          <div style={{ padding: '12px 16px', display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                            {/* 商品明细 */}
                            <div style={{ flex: '1 1 300px' }}>
                              <div style={{ fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>商品明细</div>
                              {items && items.length > 0 ? items.map((item, idx) => (
                                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', fontSize: '13px' }}>
                                  {stringValue(item, 'imageUrl', '') && (
                                    <img src={stringValue(item, 'imageUrl', '')} alt="" style={{ width: '32px', height: '32px', borderRadius: '4px', objectFit: 'cover' }} />
                                  )}
                                  <span>{stringValue(item, 'productName', '')}</span>
                                  <span style={{ color: '#6b7280' }}>x{numberValue(item, 'quantity', 1)}</span>
                                  <span style={{ color: '#059669' }}>{yuan(Math.round(numberValue(item, 'lineTotalCents', 0) / 100))}</span>
                                </div>
                              )) : <div style={{ fontSize: '12px', color: '#9ca3af' }}>无商品信息</div>}
                            </div>
                            {/* 配送目的地 */}
                            <div style={{ flex: '1 1 250px' }}>
                              <div style={{ fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>配送目的地</div>
                              <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <div><span style={{ color: '#6b7280' }}>地址：</span>{stringValue(order, 'address_text', stringValue(order, 'addressText', '-'))}</div>
                                <div><span style={{ color: '#6b7280' }}>收货人：</span>{stringValue(order, 'recipient_name', stringValue(order, 'recipientName', '-'))}</div>
                                <div><span style={{ color: '#6b7280' }}>电话：</span>{stringValue(order, 'recipient_phone', stringValue(order, 'recipientPhone', '-'))}</div>
                                <div><span style={{ color: '#6b7280' }}>期望送达：</span>{[
                                  stringValue(order, 'delivery_date', stringValue(order, 'deliveryDate', '')),
                                  stringValue(order, 'delivery_time_slot', stringValue(order, 'deliveryTimeSlot', stringValue(order, 'expected_delivery_window', stringValue(order, 'expectedDeliveryWindow', ''))))
                                ].filter(Boolean).join(' ') || '无'}</div>
                              </div>
                            </div>
                            {/* 行程信息 */}
                            {isDispatched && (
                              <div style={{ flex: '1 1 200px' }}>
                                <div style={{ fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>行程信息</div>
                                <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  <div><span style={{ color: '#6b7280' }}>车辆：</span>{vehicleCode} {licensePlate}</div>
                                  <div><span style={{ color: '#6b7280' }}>状态：</span>{tripStatusLabel[tripStatus] || tripStatus}</div>
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>

          {/* 分页控件 */}
          {filteredAllOrders.length > 0 && (
            <div className="product-pagination">
              <span>
                第 {safeOrderCurrentPage} 页 · 每页 {orderPageSize} 条 · 共 {filteredAllOrders.length} 条
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <select
                  value={orderPageSize}
                  onChange={e => { setOrderPageSize(Number(e.target.value)); setOrderCurrentPage(1); }}
                  style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' }}
                >
                  <option value={5}>5条/页</option>
                  <option value={10}>10条/页</option>
                  <option value={20}>20条/页</option>
                  <option value={50}>50条/页</option>
                </select>
                <button className="ghost-button small" type="button" disabled={safeOrderCurrentPage === 1} onClick={() => handleOrderPageChange(1)}>
                  首页
                </button>
                <button className="ghost-button small" type="button" disabled={safeOrderCurrentPage === 1} onClick={() => handleOrderPageChange(safeOrderCurrentPage - 1)}>
                  上一页
                </button>
                <span style={{ fontSize: '13px', color: '#667085' }}>{safeOrderCurrentPage} / {orderTotalPages}</span>
                <button className="ghost-button small" type="button" disabled={safeOrderCurrentPage === orderTotalPages} onClick={() => handleOrderPageChange(safeOrderCurrentPage + 1)}>
                  下一页
                </button>
                <button className="ghost-button small" type="button" disabled={safeOrderCurrentPage === orderTotalPages} onClick={() => handleOrderPageChange(orderTotalPages)}>
                  末页
                </button>
              </div>
            </div>
          )}

          {!filteredAllOrders.length ? <EmptyState text={orderSearchKeyword ? '未找到匹配的订单' : '暂无订单数据'} /> : null}
        </Panel>
      )}

      {/* 行程视角 */}
      {activeTab === 'trips' && (
        <Panel title="行程列表" description="管理所有配送行程，锁定后可出发，发车前可增减订单">
          <div className="admin-filterbar" style={{ gridTemplateColumns: 'minmax(120px, 0.7fr) minmax(140px, 0.8fr) 1fr' }}>
            <select value={tripFilter} onChange={e => setTripFilter(e.target.value)}>
              <option value="">全部状态</option>
              <option value="planned">未锁定</option>
              <option value="locked">已锁定</option>
              <option value="in_progress">运输中</option>
              <option value="completed">已完成</option>
              <option value="cancelled">已取消</option>
            </select>
            <select
              value={tripTimeSlotFilter}
              onChange={e => setTripTimeSlotFilter(e.target.value)}
            >
              <option value="all">全部时段</option>
              <option value="08:00-09:00">08:00-09:00</option>
              <option value="09:00-10:00">09:00-10:00</option>
              <option value="10:00-11:00">10:00-11:00</option>
              <option value="11:00-12:00">11:00-12:00</option>
              <option value="12:00-13:00">12:00-13:00</option>
              <option value="13:00-14:00">13:00-14:00</option>
              <option value="14:00-15:00">14:00-15:00</option>
              <option value="15:00-16:00">15:00-16:00</option>
              <option value="16:00-17:00">16:00-17:00</option>
              <option value="17:00-18:00">17:00-18:00</option>
              <option value="18:00-19:00">18:00-19:00</option>
              <option value="19:00-20:00">19:00-20:00</option>
            </select>
            <div></div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filteredTrips.map(trip => {
              const tripId = stringValue(trip, 'id');
              const status = stringValue(trip, 'status');
              const stops = ((trip as Record<string, unknown>).stops as JsonRecord[] | undefined) || [];
              const isExpanded = expandedTrip === tripId;
              const sortedStops = [...stops].sort((a, b) => {
                const slotA = stringValue(a, 'deliveryTimeSlot', stringValue(a, 'delivery_time_slot', ''));
                const slotB = stringValue(b, 'deliveryTimeSlot', stringValue(b, 'delivery_time_slot', ''));
                if (slotA && slotB) return slotA.localeCompare(slotB);
                if (slotA) return -1;
                if (slotB) return 1;
                return numberValue(a, 'stopSequence', 0) - numberValue(b, 'stopSequence', 0);
              });

              const timeSlotColors: Record<string, { bg: string; text: string; border: string }> = {
                '08:00-09:00': { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' },
                '09:00-10:00': { bg: '#dbeafe', text: '#1e40af', border: '#93c5fd' },
                '10:00-11:00': { bg: '#dcfce7', text: '#166534', border: '#86efac' },
                '11:00-12:00': { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' },
                '12:00-13:00': { bg: '#fce7f3', text: '#9d174d', border: '#f9a8d4' },
                '13:00-14:00': { bg: '#f3e8ff', text: '#6b21a8', border: '#d8b4fe' },
                '14:00-15:00': { bg: '#ede9fe', text: '#5b21b6', border: '#c4b5fd' },
                '15:00-16:00': { bg: '#e0f2fe', text: '#075985', border: '#7dd3fc' },
                '16:00-17:00': { bg: '#f0fdf4', text: '#166534', border: '#86efac' },
                '17:00-18:00': { bg: '#fff7ed', text: '#9a3412', border: '#fdba74' },
                '18:00-19:00': { bg: '#f1f5f9', text: '#334155', border: '#cbd5e1' },
                '19:00-20:00': { bg: '#fef9c3', text: '#854d0e', border: '#fde047' },
              };

              const getTimeSlotStyle = (slot: string) => {
                return timeSlotColors[slot] || { bg: '#f3f4f6', text: '#4b5563', border: '#d1d5db' };
              };
              return (
                <div key={tripId} style={{ border: `2px solid ${tripStatusBorder[status] || '#d1d5db'}`, borderRadius: '8px', overflow: 'hidden', background: '#fff' }}>
                  {/* 行程头部 */}
                  <div
                    style={{ padding: '12px 16px', background: tripStatusBg[status] || '#f9fafb', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
                    onClick={() => setExpandedTrip(isExpanded ? null : tripId)}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: '#0369a1' }}>
                          #{stringValue(trip, 'trip_no', stringValue(trip, 'tripNo', '-'))}
                        </span>
                        <strong style={{ fontSize: '15px' }}>{stringValue(trip, 'vehicle_code', stringValue(trip, 'vehicleCode', '-'))}</strong>
                        <span style={{ fontSize: '13px', color: '#6b7280' }}>{stringValue(trip, 'license_plate', stringValue(trip, 'licensePlate', ''))}</span>
                        <span style={{ fontSize: '12px', color: '#6b7280' }}>({stringValue(trip, 'vehicle_type', stringValue(trip, 'vehicleType', ''))})</span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>
                        {stringValue(trip, 'total_orders', stringValue(trip, 'totalOrders', '0'))} 个订单 · {stops.length} 个站点
                        {(() => {
                          const deliveryDate = stringValue(trip, 'delivery_date', stringValue(trip, 'deliveryDate', ''));
                          const timeSlot = stringValue(trip, 'delivery_time_slot', stringValue(trip, 'deliveryTimeSlot', ''));
                          if (deliveryDate || timeSlot) {
                            return ` · 配送: ${[deliveryDate, timeSlot].filter(Boolean).join(' ')}`;
                          }
                          return '';
                        })()}
                      </div>
                    </div>
                    <span className={tripStatusColor[status] || 'badge-gray'} style={{ fontSize: '13px', padding: '4px 12px', borderRadius: '12px', fontWeight: 600 }}>
                      {tripStatusLabel[status] || status}
                    </span>
                    <div style={{ display: 'flex', gap: '6px' }} onClick={e => e.stopPropagation()}>
                      {status === 'planned' && (
                        <button className="primary-button small" type="button" onClick={() => onLockTrip(tripId)} title="锁定后不可增减订单，可出发">
                          <Icon name="lock" /> 锁定
                        </button>
                      )}
                      {status === 'locked' && (
                        <>
                          <button className="ghost-button small" type="button" onClick={() => onUnlockTrip(tripId)} title="解锁后可继续增减订单">
                            <Icon name="unlock" /> 解锁
                          </button>
                          <button className="primary-button small" type="button" onClick={() => onStartTrip(tripId)} title="出发开始配送">
                            <Icon name="send" /> 出发
                          </button>
                        </>
                      )}
                      {status === 'in_progress' && (
                        <button className="primary-button small" type="button" onClick={() => onCompleteTrip(tripId)}>
                          <Icon name="check" /> 完成
                        </button>
                      )}
                      <span style={{ fontSize: '12px', color: '#6b7280', alignSelf: 'center' }}>{isExpanded ? '收起 ▲' : '展开 ▼'}</span>
                    </div>
                  </div>

                  {/* 展开的站点详情 */}
                  {isExpanded && (
                    <div style={{ padding: '12px 16px', borderTop: `1px solid ${tripStatusBorder[status] || '#e5e7eb'}` }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '10px', color: '#374151' }}>配送站点（按时间段排序）</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {sortedStops.map((stop, idx) => {
                          const stopId = stringValue(stop, 'id');
                          const stopStatus = stringValue(stop, 'status');
                          const stopType = stringValue(stop, 'stopType');
                          const orderId = stringValue(stop, 'mallOrderId');
                          const timeSlot = stringValue(stop, 'deliveryTimeSlot', stringValue(stop, 'delivery_time_slot', ''));
                          const slotStyle = getTimeSlotStyle(timeSlot);
                          const orderItems = (stop as Record<string, unknown>).orderItems as JsonRecord[] | undefined;
                          return (
                            <div key={stopId} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '10px 14px', background: '#f9fafb', borderRadius: '6px', border: `1px solid ${timeSlot ? slotStyle.border : '#e5e7eb'}`, borderLeftWidth: timeSlot ? '4px' : '1px' }}>
                              {/* 序号圆点 + 时间段色条 */}
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', flexShrink: 0, paddingTop: '2px' }}>
                                <span style={{ width: '28px', height: '28px', borderRadius: '50%', background: stopStatus === 'completed' ? '#10b981' : timeSlot ? slotStyle.bg : stopType === 'pickup' ? '#3b82f6' : '#f59e0b', color: stopStatus === 'completed' ? '#fff' : timeSlot ? slotStyle.text : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 600, border: timeSlot ? `2px solid ${slotStyle.border}` : 'none' }}>
                                  {idx + 1}
                                </span>
                                {idx < sortedStops.length - 1 && <span style={{ width: '2px', height: '12px', background: timeSlot ? slotStyle.border : '#d1d5db' }}></span>}
                              </div>
                              {/* 站点信息 */}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                                  <span style={{ fontSize: '12px', padding: '1px 8px', borderRadius: '3px', background: stopType === 'pickup' ? '#dbeafe' : '#fef3c7', color: stopType === 'pickup' ? '#1d4ed8' : '#92400e', fontWeight: 500 }}>
                                    {stopType === 'pickup' ? '取货' : '送货'}
                                  </span>
                                  <span style={{ fontSize: '14px', fontWeight: 500 }}>{stringValue(stop, 'address', '-')}</span>
                                </div>
                                {orderId && (
                                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                                    订单: <strong>{shortId(orderId)}</strong>
                                  </div>
                                )}
                                {orderItems && orderItems.length > 0 && (
                                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                                    {orderItems.map((i, iidx) => (
                                      <span key={iidx} style={{ fontSize: '12px', padding: '2px 8px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '4px' }}>
                                        {stringValue(i, 'productName', '')} x{numberValue(i, 'quantity', 1)}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                <div style={{ fontSize: '12px', color: '#9ca3af' }}>
                                  {stringValue(stop, 'contactName', '')} {stringValue(stop, 'contactPhone', '')}
                                  {stringValue(stop, 'notes', '') && <span> · 备注: {stringValue(stop, 'notes', '')}</span>}
                                </div>
                              </div>
                              {/* 时间段和状态 */}
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
                                {timeSlot && (
                                  <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: slotStyle.bg, color: slotStyle.text, fontWeight: 600, border: `1px solid ${slotStyle.border}`, whiteSpace: 'nowrap' }}>
                                    🕐 {timeSlot}
                                  </span>
                                )}
                                <span className={stopStatus === 'completed' ? 'badge badge-green' : stopStatus === 'arrived' ? 'badge badge-yellow' : 'badge badge-blue'}>
                                  {stopStatus === 'completed' ? '已完成' : stopStatus === 'arrived' ? '已到达' : '待配送'}
                                </span>
                                {(status === 'planned' || status === 'locked') && orderId && (
                                  <button className="ghost-button" style={{ fontSize: '11px', padding: '2px 8px', color: '#ef4444' }} type="button" onClick={() => onRemoveOrder(tripId, orderId)}>
                                    移除
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        {!sortedStops.length && <div style={{ fontSize: '13px', color: '#9ca3af' }}>暂无站点</div>}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {!filteredTrips.length ? <EmptyState text="暂无行程数据" /> : null}
        </Panel>
      )}
    </div>
  );
}

function DesignPlaceholderPage({
  module,
  page,
  data,
}: {
  module: AdminModuleSpec;
  page: AdminPageSpec;
  data: DashboardData;
}) {
  const rows = recordsForDesignPage(page, data);
  const visibleRows = (rows.length ? rows : fallbackDesignRows(page)).slice(0, 6);
  const metrics = designMetrics(page, data);

  return (
    <div className="design-page">
      <div className="design-stat-grid">
        {metrics.map(([label, value, detail]) => (
          <section className="design-stat-card" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{detail}</small>
          </section>
        ))}
      </div>

      <div className="design-filterbar">
        <button type="button">全部状态</button>
        <button type="button">待处理</button>
        <button type="button">近 7 天</button>
        <div className="design-search">搜索 {page.label}</div>
        <button className="primary-button small" type="button">
          <Icon name={page.icon} />
          新建/处理
        </button>
      </div>

      <div className="design-content-grid">
        <section className="design-table-panel">
          <div className="design-panel-head">
            <div>
              <h2>{page.tableTitle}</h2>
            </div>
            <span>{visibleRows.length} 条</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>对象</th>
                  <th>负责人</th>
                  <th>状态</th>
                  <th>更新时间</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map(row => {
                  const id = stringValue(row, 'id', `${page.key}-${stringValue(row, 'name')}`);
                  const name = stringValue(row, 'name', stringValue(row, 'title', stringValue(row, 'orderNo', shortId(id))));
                  const owner = stringValue(row, 'owner', stringValue(row, 'contactName', stringValue(row, 'phone', stringValue(row, 'userId', '运营'))));
                  const status = stringValue(row, 'status', stringValue(row, 'paymentStatus', 'pending'));
                  return (
                    <tr key={id}>
                      <td>
                        <strong>{name || page.label}</strong>
                        <small>{shortId(id)}</small>
                      </td>
                      <td>{owner || '-'}</td>
                      <td>
                        <span className={badgeClass(status)}>{statusLabel(status)}</span>
                      </td>
                      <td>{formatDate(stringValue(row, 'updatedAt', stringValue(row, 'updated_at', stringValue(row, 'createdAt'))))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="design-detail-panel">
          <div className="detail-card-head">
            <span>{module.brand}</span>
            <strong>{page.detailTitle}</strong>
            <small>{page.group}</small>
          </div>
          <div className="detail-steps">
            {page.workflow?.map((step, index) => (
              <div className="detail-step" key={step}>
                <span>{index + 1}</span>
                <strong>{step}</strong>
                <small>{index === 0 ? '当前环节' : '待联动'}</small>
              </div>
            ))}
          </div>
          <button className="primary-button" type="button">
            <Icon name="check" />
            执行处理
          </button>
        </aside>
      </div>
    </div>
  );
}

function MallProductDesignSection({
  categories,
  procurementBuyers,
  products,
  form,
  onChange,
  onSubmit,
  onUploadImage,
  onUploadQualificationFile,
}: {
  categories: JsonRecord[];
  procurementBuyers: JsonRecord[];
  products: JsonRecord[];
  form: ProductForm;
  onChange: (patch: Partial<ProductForm>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onUploadImage: (file: File) => Promise<string>;
  onUploadQualificationFile: (file: File) => Promise<string>;
}) {
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const alertCount = products.filter(product => numberValue(product, 'stock') <= numberValue(product, 'stockAlertThreshold', 15)).length;
  const completeCount = products.filter(product => productDisplayImagesFromRecord(product).length && stringValue(product, 'specification') && stringValue(product, 'saleMethod')).length;

  return (
    <div className="mall-admin-design-page">
      <div className="mall-admin-toolbar">
        <button className="mall-admin-submit" type="button" onClick={() => setCreateModalOpen(true)}>新增上架商品</button>
      </div>

      <div className="mall-admin-kpis">
        <StatCard label="商品总数" value={String(products.length)} detail="全部商品" />
        <StatCard label="库存预警" value={String(alertCount)} detail="低库存商品" />
        <StatCard label="报价资料完整" value={String(completeCount)} detail="含图片、规格和售卖方式" />
      </div>

      {createModalOpen ? (
        <ProductCreateModal
          categories={categories}
          procurementBuyers={procurementBuyers}
          form={form}
          onChange={onChange}
          onClose={() => setCreateModalOpen(false)}
          onSubmit={onSubmit}
          onUploadImage={onUploadImage}
          onUploadQualificationFile={onUploadQualificationFile}
        />
      ) : null}
    </div>
  );
}

function ProductFormFields({
  categories,
  procurementBuyers,
  form,
  layout = 'grid',
  onChange,
  onUploadImage,
  onUploadQualificationFile,
}: {
  categories: JsonRecord[];
  procurementBuyers: JsonRecord[];
  form: ProductForm;
  layout?: 'grid' | 'tiles';
  onChange: (patch: Partial<ProductForm>) => void;
  onUploadImage: (file: File) => Promise<string>;
  onUploadQualificationFile: (file: File) => Promise<string>;
}) {
  const fieldClass = layout === 'tiles' ? 'mall-admin-tile' : undefined;
  const wrapperClass = layout === 'tiles' ? 'mall-admin-tile-grid' : 'form-grid';

  return (
    <div className={`${wrapperClass} product-form-scroll-guard`}>
      <div className="product-form-grid product-base-grid">
        <label className={fieldClass}>
          <span className="field-label">商品名称<span className="required-mark">*</span></span>
          <input required value={form.name} onChange={event => onChange({ name: event.target.value })} placeholder="例如 恒大苏打水" />
        </label>
        <label className={fieldClass}>
          SKU
          <input value={form.sku} onChange={event => onChange({ sku: event.target.value })} placeholder="不填自动生成" />
        </label>
        <label className={fieldClass}>
          <span className="field-label">类目<span className="required-mark">*</span></span>
          <select required value={form.categoryCode} onChange={event => onChange({ categoryCode: event.target.value })}>
            {categories.map(category => (
              <option key={stringValue(category, 'code')} value={stringValue(category, 'code')}>
                {stringValue(category, 'name', stringValue(category, 'code'))}
              </option>
            ))}
            {!categories.length ? <option value="fruit">水果鲜选</option> : null}
          </select>
        </label>
        <ProductImageGalleryInput
          className={fieldClass}
          form={form}
          onChange={onChange}
          onUploadImage={onUploadImage}
        />
        <label className={fieldClass}>
          <span className="field-label">状态<span className="required-mark">*</span></span>
          <select required value={form.status} onChange={event => onChange({ status: event.target.value })}>
            <option value="on_sale">在售</option>
            <option value="off_sale">下架</option>
            <option value="draft">草稿</option>
          </select>
        </label>
        <label className={fieldClass}>
          标签
          <input value={form.tags} onChange={event => onChange({ tags: event.target.value })} placeholder="逗号分隔" />
        </label>
        <label className={fieldClass}>
          库存预警
          <input value={form.stockAlertThreshold} type="number" min="0" onChange={event => onChange({ stockAlertThreshold: event.target.value })} />
        </label>
        <label className={fieldClass}>
          配送分钟
          <input value={form.deliveryMinutes} type="number" min="1" onChange={event => onChange({ deliveryMinutes: event.target.value })} />
        </label>
        <label className={fieldClass}>
          冷链
          <span className="toggle-line compact-toggle">
            <input checked={form.coldChainRequired} type="checkbox" onChange={event => onChange({ coldChainRequired: event.target.checked })} />
            需要
          </span>
        </label>
        <label className={layout === 'tiles' ? 'mall-admin-tile' : 'wide'}>
          副标题
          <input value={form.subtitle} onChange={event => onChange({ subtitle: event.target.value })} placeholder="规格、配送卖点" />
        </label>
        <label className={layout === 'tiles' ? 'mall-admin-tile' : 'wide'}>
          <span className="field-label">商品说明<span className="required-mark">*</span></span>
          <textarea required value={form.description} onChange={event => onChange({ description: event.target.value })} placeholder="商品卖点、包装、保存方式、售后说明等" />
        </label>
      </div>
      <ProductVariantSubtable form={form} layout={layout} onChange={onChange} />
      <ProductQualificationSubtable
        form={form}
        layout={layout}
        procurementBuyers={procurementBuyers}
        onChange={onChange}
        onUploadQualificationFile={onUploadQualificationFile}
      />
    </div>
  );
}

function ProductImageGalleryInput({
  className,
  form,
  onChange,
  onUploadImage,
}: {
  className?: string;
  form: ProductForm;
  onChange: (patch: Partial<ProductForm>) => void;
  onUploadImage: (file: File) => Promise<string>;
}) {
  const images = productFormImages(form);
  const showMessage = useAdminMessage();
  const updateImages = (nextImages: string[]) => {
    const normalized = compactProductImages(nextImages);
    onChange({ images: normalized, imageUrl: normalized[0] || '' });
  };
  const upload = async (files: FileList | null | undefined) => {
    if (!files?.length) return;
    const fileList = Array.from(files);
    if (images.length + fileList.length > productImageLimit) {
      showMessage('warning', `单个商品最多上传 ${productImageLimit} 张图片`);
      return;
    }
    const uploadedImages: string[] = [];
    for (const file of fileList) {
      uploadedImages.push(await onUploadImage(file));
    }
    updateImages([...images, ...uploadedImages]);
  };
  const updatePrimaryUrl = (value: string) => {
    const currentImages = images.filter(image => image !== form.imageUrl);
    updateImages(value ? [value, ...currentImages] : currentImages);
  };

  return (
    <section className={className ? `${className} product-image-gallery-input` : 'product-image-gallery-input'}>
      <div className="field-label-row">
        <span>商品图片</span>
        <small>{images.length}/{productImageLimit}</small>
      </div>
      <input accept="image/*" multiple type="file" onChange={event => void upload(event.currentTarget.files)} />
      <input value={form.imageUrl} onChange={event => updatePrimaryUrl(event.target.value)} placeholder="主图地址" />
      {images.length ? (
        <div className="product-image-gallery-list">
          {images.map((image, index) => (
            <div className={index === 0 ? 'product-image-gallery-item active' : 'product-image-gallery-item'} key={image}>
              <img alt="" src={resolveImage(image)} />
              <span>{index === 0 ? '主图' : `图 ${index + 1}`}</span>
              <div>
                {index > 0 ? (
                  <button type="button" onClick={() => updateImages([image, ...images.filter(item => item !== image)])}>设为主图</button>
                ) : null}
                <button type="button" onClick={() => updateImages(images.filter(item => item !== image))}>移除</button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function ProductVariantSubtable({
  form,
  layout,
  onChange,
}: {
  form: ProductForm;
  layout: 'grid' | 'tiles';
  onChange: (patch: Partial<ProductForm>) => void;
}) {
  const showMessage = useAdminMessage();
  const updateProductVariant = (index: number, patch: Partial<ProductVariantForm>) => {
    onChange({
      variants: form.variants.map((variant, currentIndex) => (
        currentIndex === index ? { ...variant, ...patch } : variant
      )),
    });
  };
  const variantLoadingPatch = (index: number, patch: Partial<ProductVariantForm>) => {
    updateProductVariant(index, patch);
  };
  const addProductVariant = () => {
    if (form.variants.length >= productVariantLimit) {
      showMessage('warning', `单个商品最多配置 ${productVariantLimit} 个规格`);
      return;
    }
    const nextIndex = form.variants.length;
    onChange({ variants: [...form.variants, createDefaultProductVariantForm(nextIndex)] });
  };
  const removeProductVariant = (index: number) => {
    if (form.variants.length <= 1) {
      showMessage('warning', '至少保留一个规格');
      return;
    }
    onChange({ variants: form.variants.filter((_, currentIndex) => currentIndex !== index) });
  };

  return (
    <section className={layout === 'tiles' ? 'mall-admin-spec-subtable mall-admin-tile wide' : 'product-variant-subtable wide'}>
      <div className="spec-subtable-head">
        <strong>售卖规格</strong>
        <span>{form.variants.length}/{productVariantLimit}</span>
        <button className="ghost-button compact-action" type="button" onClick={addProductVariant}>新增规格</button>
      </div>
      <div className="variant-card-list">
        {form.variants.map((variant, index) => (
          <article className="variant-card" key={`${variant.id}-${index}`}>
            <div className="variant-card-head">
              <strong>规格 {index + 1}</strong>
              <button className="ghost-button compact-action" type="button" onClick={() => removeProductVariant(index)}>删除</button>
            </div>
            <div className="variant-form-grid">
              <label>
                规格名
                <input value={variant.name} onChange={event => updateProductVariant(index, { name: event.target.value })} />
              </label>
              <label>
                SKU
                <input value={variant.sku} onChange={event => updateProductVariant(index, { sku: event.target.value })} />
              </label>
              <label data-variant-required="规格">
                <span className="field-label">规格<span className="required-mark">*</span></span>
                <input required value={variant.specification} onChange={event => updateProductVariant(index, { specification: event.target.value })} placeholder="1瓶 / 1箱 / 30斤" />
              </label>
              <label data-variant-required="单份售卖方式">
                <span className="field-label">单份售卖方式<span className="required-mark">*</span></span>
                <input required value={variant.saleMethod} onChange={event => updateProductVariant(index, { saleMethod: event.target.value })} placeholder="按份 / 按斤 / 整件" />
              </label>
              <label data-variant-required="售价">
                <span className="field-label">售价<span className="required-mark">*</span></span>
                <input min="0.01" step="0.01" required type="number" value={variant.priceYuan} onChange={event => updateProductVariant(index, { priceYuan: event.target.value })} />
              </label>
              <label>
                划线价
                <input min="0" step="0.01" type="number" value={variant.originalPriceYuan} onChange={event => updateProductVariant(index, { originalPriceYuan: event.target.value })} />
              </label>
              <label data-variant-required="进货价">
                <span className="field-label">进货价<span className="required-mark">*</span></span>
                <input min="0.01" step="0.01" required type="number" value={variant.supplyPriceYuan} onChange={event => updateProductVariant(index, { supplyPriceYuan: event.target.value })} />
              </label>
              <label data-variant-required="库存">
                <span className="field-label">库存<span className="required-mark">*</span></span>
                <input min="0" required type="number" value={variant.stock} onChange={event => updateProductVariant(index, { stock: event.target.value })} />
              </label>
              <label data-variant-required="最小起订量">
                <span className="field-label">最小起订量<span className="required-mark">*</span></span>
                <input min="1" required type="number" value={variant.minimumOrderQuantity} onChange={event => updateProductVariant(index, { minimumOrderQuantity: event.target.value })} />
              </label>
              <label>
                计价方式
                <select value={variant.pricingMode} onChange={event => updateProductVariant(index, { pricingMode: event.target.value })}>
                  <option value="fixed">固定计价</option>
                  <option value="weighed">称重计价</option>
                </select>
              </label>
              {variant.pricingMode === 'weighed' && (
                <>
                  <label>
                    重量单位
                    <select
                      value={variant.weightUnitLabel}
                      onChange={event => updateProductVariant(index, {
                        weightUnitLabel: event.target.value,
                        weightUnitGrams: event.target.value === '公斤' ? '1000' : event.target.value === '克' ? '1' : '500',
                      })}
                    >
                      <option value="斤">斤</option>
                      <option value="公斤">公斤</option>
                      <option value="克">克</option>
                    </select>
                  </label>
                  <label>
                    浮动范围 %
                    <input
                      min="0"
                      max="50"
                      step="0.1"
                      type="number"
                      value={variant.weightTolerancePercent}
                      onChange={event => updateProductVariant(index, { weightTolerancePercent: event.target.value })}
                    />
                  </label>
                </>
              )}
              <label>
                状态
                <select value={variant.status} onChange={event => updateProductVariant(index, { status: event.target.value })}>
                  <option value="on_sale">在售</option>
                  <option value="off_sale">下架</option>
                  <option value="draft">草稿</option>
                </select>
              </label>
            </div>
            <div className="variant-loading-spec-grid">
              <label>
                长 cm
                <input min="0" step="0.1" type="number" value={variant.lengthCm} onChange={event => variantLoadingPatch(index, { lengthCm: event.target.value })} />
              </label>
              <label>
                宽 cm
                <input min="0" step="0.1" type="number" value={variant.widthCm} onChange={event => variantLoadingPatch(index, { widthCm: event.target.value })} />
              </label>
              <label>
                高 cm
                <input min="0" step="0.1" type="number" value={variant.heightCm} onChange={event => variantLoadingPatch(index, { heightCm: event.target.value })} />
              </label>
              <label>
                体积 L
                <input min="0" step="0.01" type="number" value={variant.volumeLiters} onChange={event => variantLoadingPatch(index, { volumeLiters: event.target.value })} />
              </label>
              <label>
                重量 kg
                <input min="0" step="0.001" type="number" value={variant.weightKg} onChange={event => variantLoadingPatch(index, { weightKg: event.target.value })} />
              </label>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ProductQualificationSubtable({
  form,
  layout,
  procurementBuyers,
  onChange,
  onUploadQualificationFile,
}: {
  form: ProductForm;
  layout: 'grid' | 'tiles';
  procurementBuyers: JsonRecord[];
  onChange: (patch: Partial<ProductForm>) => void;
  onUploadQualificationFile: (file: File) => Promise<string>;
}) {
  const showMessage = useAdminMessage();
  const selectedBuyerIds = new Set(form.procurementBuyerIds);
  const updateReport = (index: number, patch: Partial<ProductQualificationReportForm>) => {
    onChange({
      qualificationReports: form.qualificationReports.map((report, currentIndex) => (
        currentIndex === index ? { ...report, ...patch } : report
      )),
    });
  };
  const addReport = () => {
    onChange({
      qualificationReports: [
        ...form.qualificationReports,
        {
          id: `report-${Date.now()}`,
          buyerId: form.procurementBuyerIds[0] || '',
          reportName: '',
          reportType: '',
          reportUrl: '',
          issuer: '',
          issuedAt: '',
          expiresAt: '',
        },
      ],
    });
  };
  const removeReport = (index: number) => {
    onChange({ qualificationReports: form.qualificationReports.filter((_, currentIndex) => currentIndex !== index) });
  };
  const toggleBuyer = (buyerId: string, checked: boolean) => {
    const nextBuyerIds = checked
      ? [...form.procurementBuyerIds, buyerId]
      : form.procurementBuyerIds.filter(id => id !== buyerId);
    onChange({ procurementBuyerIds: Array.from(new Set(nextBuyerIds)) });
  };
  const uploadReport = async (index: number, files: FileList | null | undefined) => {
    const file = files?.[0];
    if (!file) return;
    try {
      const fileUrl = await onUploadQualificationFile(file);
      updateReport(index, { reportUrl: fileUrl });
    } catch {
      showMessage('error', '资质文件上传失败');
    }
  };

  return (
    <section className={layout === 'tiles' ? 'mall-admin-spec-subtable mall-admin-tile wide' : 'product-qualification-subtable wide'}>
      <div className="spec-subtable-head">
        <strong>采购商与资质</strong>
        <span>{form.qualificationReports.length ? `${form.qualificationReports.length} 份报告` : '无资质报告'}</span>
        <button className="ghost-button compact-action" type="button" onClick={addReport}>新增资质报告</button>
      </div>
      <label className="toggle-line compact-toggle">
        <input checked={form.hideSupplier} type="checkbox" onChange={event => onChange({ hideSupplier: event.target.checked })} />
        App 端隐藏供货商名称
      </label>
      <div className="buyer-check-grid">
        {procurementBuyers.map(buyer => {
          const buyerId = stringValue(buyer, 'id');
          return (
            <label key={buyerId}>
              <input
                checked={selectedBuyerIds.has(buyerId)}
                type="checkbox"
                onChange={event => toggleBuyer(buyerId, event.target.checked)}
              />
              <span>{stringValue(buyer, 'name', '未命名采购商')}</span>
            </label>
          );
        })}
        {!procurementBuyers.length ? <small>请先在采购商管理新增采购商</small> : null}
      </div>
      <div className="spec-subtable-scroll">
        <table className="spec-subtable qualification-report-table">
          <thead>
            <tr>
              <th>报告名称</th>
              <th>类型</th>
              <th>采购商</th>
              <th>文件</th>
              <th>出具机构</th>
              <th>出具日期</th>
              <th>有效期至</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {form.qualificationReports.map((report, index) => (
              <tr key={`${report.id}-${index}`}>
                <td><input value={report.reportName} onChange={event => updateReport(index, { reportName: event.target.value })} placeholder="检验报告 / 疫检报告" /></td>
                <td><input value={report.reportType} onChange={event => updateReport(index, { reportType: event.target.value })} placeholder="检验 / 检疫 / 产地" /></td>
                <td>
                  <select value={report.buyerId} onChange={event => updateReport(index, { buyerId: event.target.value })}>
                    <option value="">不指定</option>
                    {procurementBuyers.map(buyer => (
                      <option key={stringValue(buyer, 'id')} value={stringValue(buyer, 'id')}>
                        {stringValue(buyer, 'name')}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input accept="image/*,application/pdf" type="file" onChange={event => void uploadReport(index, event.currentTarget.files)} />
                  <input value={report.reportUrl} onChange={event => updateReport(index, { reportUrl: event.target.value })} placeholder="资质文件地址" />
                </td>
                <td><input value={report.issuer} onChange={event => updateReport(index, { issuer: event.target.value })} /></td>
                <td><input type="date" value={report.issuedAt} onChange={event => updateReport(index, { issuedAt: event.target.value })} /></td>
                <td><input type="date" value={report.expiresAt} onChange={event => updateReport(index, { expiresAt: event.target.value })} /></td>
                <td>
                  <button className="ghost-button compact-action" type="button" onClick={() => removeReport(index)}>删除</button>
                </td>
              </tr>
            ))}
            {!form.qualificationReports.length ? (
              <tr>
                <td colSpan={8}>暂无资质报告</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ProductImage({ record }: { record: JsonRecord }) {
  const imageUrl = resolveImage(productDisplayImagesFromRecord(record)[0] || stringValue(record, 'imageUrl'));
  return (
    <div className="product-cell">
      {imageUrl ? <img alt="" src={imageUrl} /> : <span className="image-placeholder">无图</span>}
      <div>
        <strong>{stringValue(record, 'name', '未命名商品')}</strong>
        <small>{stringValue(record, 'specification', stringValue(record, 'subtitle', stringValue(record, 'sku')))}</small>
      </div>
    </div>
  );
}

function FixedPriceProductBadgePreview({
  badgeBackgroundColor,
  badgeIcon,
  badgeIconUrl,
  badgePosition,
  badgeText,
  badgeTextColor,
  large = false,
  product,
}: {
  badgeBackgroundColor: string;
  badgeIcon: string;
  badgeIconUrl: string;
  badgePosition: string;
  badgeText: string;
  badgeTextColor: string;
  large?: boolean;
  product?: JsonRecord;
}) {
  const imageUrl = product ? resolveImage(productDisplayImagesFromRecord(product)[0] || stringValue(product, 'imageUrl')) : '';
  return (
    <div className={large ? 'fixed-price-product-preview large' : 'fixed-price-product-preview'}>
      <div className="fixed-price-product-preview-image">
        {imageUrl ? <img alt="" src={imageUrl} /> : <span className="image-placeholder">商品图</span>}
        <span
          className={`fixed-price-product-corner fixed-price-product-corner-${badgePosition || 'top_left'}`}
          style={{ background: badgeBackgroundColor || '#FF9238', color: badgeTextColor || '#FFFFFF' }}
        >
          {badgeIconUrl ? <img alt="" src={resolveImage(badgeIconUrl)} /> : badgeIcon ? <i>{badgeIcon}</i> : null}
          {badgeText || '一口价'}
        </span>
      </div>
      {large ? (
        <div>
          <strong>{product ? stringValue(product, 'name', '商品预览') : '商品预览'}</strong>
          <small>{fixedPriceBadgePositionLabel(badgePosition)}</small>
        </div>
      ) : null}
    </div>
  );
}

function ProcurementBuyersSection({
  buyers,
  form,
  onFormChange,
  onSave,
  onDelete,
  onUploadLicense,
}: {
  buyers: JsonRecord[];
  form: ProcurementBuyerForm;
  onFormChange: (patch: Partial<ProcurementBuyerForm>) => void;
  onSave: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onUploadLicense: (file: File) => Promise<string>;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const openCreate = () => {
    onFormChange(initialProcurementBuyerForm);
    setModalOpen(true);
  };
  const openEdit = (buyer: JsonRecord) => {
    onFormChange(procurementBuyerToForm(buyer));
    setModalOpen(true);
  };
  const uploadLicense = async (files: FileList | null | undefined) => {
    const file = files?.[0];
    if (!file) return;
    const fileUrl = await onUploadLicense(file);
    onFormChange({ licenseUrl: fileUrl });
  };

  return (
    <div className="page-grid">
      <div className="mall-admin-toolbar">
        <button className="mall-admin-submit" type="button" onClick={openCreate}>新增采购商</button>
      </div>

      <Panel title="采购商管理" description="采购商营业执照和供货资质归档">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>采购商</th>
                <th>联系人</th>
                <th>营业执照</th>
                <th>状态</th>
                <th>最近编辑</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {buyers.map(buyer => {
                const id = stringValue(buyer, 'id');
                const licenseUrl = stringValue(buyer, 'licenseUrl');
                const status = stringValue(buyer, 'status');
                return (
                  <tr key={id}>
                    <td>
                      <strong>{stringValue(buyer, 'name', '未命名采购商')}</strong>
                      <small>{stringValue(buyer, 'remark') || shortId(id)}</small>
                    </td>
                    <td>
                      <span>{stringValue(buyer, 'contactName', '-')}</span>
                      <small>{stringValue(buyer, 'contactPhone', '-')}</small>
                    </td>
                    <td>
                      {licenseUrl ? <a href={resolveImage(licenseUrl)} rel="noreferrer" target="_blank">查看营业执照</a> : '-'}
                    </td>
                    <td><span className={badgeClass(status)}>{statusLabel(status)}</span></td>
                    <td>{formatDate(stringValue(buyer, 'updatedAt', stringValue(buyer, 'createdAt')))}</td>
                    <td className="actions">
                      <button className="ghost-button" type="button" onClick={() => openEdit(buyer)}>
                        <Icon name="save" />
                        编辑
                      </button>
                      <button className="ghost-button" type="button" onClick={() => void onDelete(id)}>
                        <Icon name="x" />
                        删除
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!buyers.length ? <EmptyState text="暂无采购商" /> : null}
      </Panel>

      {modalOpen ? (
        <div className="modal-backdrop">
          <section className="modal-panel">
            <div className="panel-head">
              <div>
                <h2>{form.id ? '编辑采购商' : '新增采购商'}</h2>
              </div>
              <button className="ghost-button" type="button" onClick={() => setModalOpen(false)}>
                <Icon name="x" />
                关闭
              </button>
            </div>
            <form
              onSubmit={async event => {
                await onSave(event);
                setModalOpen(false);
              }}
            >
              <div className="form-grid">
                <label>
                  <span className="field-label">采购商名称<span className="required-mark">*</span></span>
                  <input required value={form.name} onChange={event => onFormChange({ name: event.target.value })} />
                </label>
                <label>
                  联系人
                  <input value={form.contactName} onChange={event => onFormChange({ contactName: event.target.value })} />
                </label>
                <label>
                  联系电话
                  <input value={form.contactPhone} onChange={event => onFormChange({ contactPhone: event.target.value })} />
                </label>
                <label>
                  状态
                  <select value={form.status} onChange={event => onFormChange({ status: event.target.value })}>
                    <option value="active">启用</option>
                    <option value="inactive">停用</option>
                  </select>
                </label>
                <label className="wide">
                  营业执照
                  <input accept="image/*,application/pdf" type="file" onChange={event => void uploadLicense(event.currentTarget.files)} />
                  <input value={form.licenseUrl} onChange={event => onFormChange({ licenseUrl: event.target.value })} placeholder="营业执照文件地址" />
                </label>
                <label className="wide">
                  备注
                  <textarea value={form.remark} onChange={event => onFormChange({ remark: event.target.value })} />
                </label>
              </div>
              <div className="modal-actions">
                <button className="ghost-button" type="button" onClick={() => setModalOpen(false)}>取消</button>
                <button className="primary-button" type="submit">
                  <Icon name="save" />
                  保存采购商
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function OperationsDataScreen({ data, errors = {} }: { data: DashboardData; errors?: LoadErrors }) {
  const model = useMemo(() => buildOperationsScreenModel(data, errors), [data, errors]);
  const peakTrend = Math.max(...model.trends.map(trend => trend.revenueCents), 0);

  return (
    <div className="operations-screen">
      <section className="operations-hero">
        <div>
          <span className="operations-eyebrow">运营数据大屏</span>
          <h2>平台实时运营中心</h2>
          <p>聚合商城交易、无人车履约、客服售后和平台运行状态，帮助运营判断当天重点事项。</p>
        </div>
        <div className="operations-clock">
          <span>数据来源</span>
          <strong>运营实时数据</strong>
          <small>近 7 日趋势 · 当前数据</small>
        </div>
      </section>

      <div className="operations-kpi-grid">
        {model.kpis.map(kpi => (
          <section className="operations-kpi" key={kpi.label}>
            <span>{kpi.label}</span>
            <strong>{kpi.value}</strong>
            <small>{kpi.detail}</small>
            <em>{kpi.trend}</em>
          </section>
        ))}
      </div>

      <div className="operations-insight-grid">
        {model.insights.map(item => (
          <section className="operations-insight-card" key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.detail}</small>
          </section>
        ))}
      </div>

      <div className="operations-main-grid">
        <section className="operations-panel operations-trend-panel">
          <div className="operations-panel-head">
            <div>
              <h3>交易趋势</h3>
              <p>展示近 7 日订单量和交易额变化</p>
            </div>
            <span>{peakTrend ? `峰值 ${yuan(peakTrend)}` : '暂无交易峰值'}</span>
          </div>
          <div className="operations-trend-bars">
            {model.trends.map(trend => (
              <div className="operations-trend-item" key={trend.key}>
                <div className="operations-bar-track">
                  <span style={{ height: `${trend.percentage ? Math.max(trend.percentage, 8) : 4}%` }} />
                </div>
                <strong>{trend.orders}</strong>
                <small>{trend.label}</small>
              </div>
            ))}
          </div>
        </section>

        <section className="operations-panel">
          <div className="operations-panel-head">
            <div>
              <h3>业务漏斗</h3>
              <p>从下单、支付、履约到售后，快速看转化和堆积位置</p>
            </div>
          </div>
          <div className="operations-funnel">
            {model.funnel.map(step => (
              <article className="operations-funnel-step" key={step.label}>
                <div>
                  <strong>{step.label}</strong>
                  <small>{step.detail}</small>
                </div>
                <span>{step.value}</span>
                <div className="operations-progress">
                  <i style={{ width: `${step.percentage}%` }} />
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      <div className="operations-chart-grid">
        <section className="operations-panel">
          <div className="operations-panel-head">
            <div>
              <h3>品类销售</h3>
              <p>按品类汇总销量和销售额，帮助运营判断补货和首页露出顺序</p>
            </div>
          </div>
          <div className="operations-category-bars">
            {model.categorySales.map(category => (
              <article className="operations-category-row" key={category.name}>
                <div>
                  <strong>{category.name}</strong>
                  <small>{category.quantity} 件 · {yuan(category.revenueCents)}</small>
                </div>
                <div className="operations-progress">
                  <i style={{ width: `${category.percentage}%` }} />
                </div>
              </article>
            ))}
            {!model.categorySales.length ? <EmptyState text="暂无品类销售数据" /> : null}
          </div>
        </section>

        <section className="operations-panel">
          <div className="operations-panel-head">
            <div>
              <h3>热销商品排行</h3>
              <p>按销量和销售额排序，帮助运营优先关注重点商品</p>
            </div>
          </div>
          <div className="operations-rank-table">
            {model.hotProducts.map((product, index) => (
              <article className="operations-rank-row" key={`${product.name}-${index}`}>
                <em>{index + 1}</em>
                <div>
                  <strong>{product.name}</strong>
                  <small>{product.category} · {product.quantity} 件</small>
                </div>
                <span>{yuan(product.revenueCents)}</span>
              </article>
            ))}
            {!model.hotProducts.length ? <EmptyState text="暂无热销商品数据" /> : null}
          </div>
        </section>
      </div>

      <div className="operations-bottom-grid">
        <section className="operations-panel">
          <div className="operations-panel-head">
            <div>
              <h3>模块健康</h3>
              <p>按商城、无人车、客服和公共服务拆开看运行状态</p>
            </div>
          </div>
          <div className="operations-module-grid">
            {model.modules.map(module => (
              <article className="operations-module-card" key={module.label}>
                <div>
                  <span>{module.label}</span>
                  <strong>{module.value}</strong>
                </div>
                <em>{module.status}</em>
                <small>{module.detail}</small>
                <div className="operations-progress">
                  <i style={{ width: `${module.progress}%` }} />
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="operations-panel">
          <div className="operations-panel-head">
            <div>
              <h3>风险队列</h3>
              <p>把需要运营介入的售后、库存和履约事项集中展示</p>
            </div>
          </div>
          <div className="operations-risk-list">
            {model.risks.map(item => (
              <article className={`operations-risk-item ${item.tone}`} key={item.label}>
                <div>
                  <strong>{item.label}</strong>
                  <small>{item.detail}</small>
                </div>
                <span>{item.value}</span>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function UsersSection({
  users,
  onUpdateStatus,
}: {
  users: JsonRecord[];
  onUpdateStatus: (id: string, status: string) => Promise<void>;
}) {
  return (
    <Panel title="账号角色管理" description="管理平台用户、商家、车主和企业账号的启停状态">
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>账号</th>
              <th>角色</th>
              <th>手机号</th>
              <th>状态</th>
              <th>注册时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => {
              const id = stringValue(user, 'id');
              const status = stringValue(user, 'status', 'active');
              return (
                <tr key={id}>
                  <td>
                    <strong>{stringValue(user, 'name', stringValue(user, 'username', shortId(id)))}</strong>
                    <small>{shortId(id)}</small>
                  </td>
                  <td>{roleLabel(stringValue(user, 'role'))}</td>
                  <td>{stringValue(user, 'phone', '-')}</td>
                  <td>
                    <span className={badgeClass(status)}>{statusLabel(status)}</span>
                  </td>
                  <td>{formatDate(stringValue(user, 'created_at', stringValue(user, 'createdAt')))}</td>
                  <td className="actions">
                    <button className="ghost-button" type="button" onClick={() => onUpdateStatus(id, status === 'active' ? 'inactive' : 'active')}>
                      <Icon name={status === 'active' ? 'x' : 'check'} />
                      {status === 'active' ? '停用' : '启用'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!users.length ? <EmptyState text="暂无账号数据" /> : null}
    </Panel>
  );
}

function VehiclesSection({
  vehicles,
  onReview,
}: {
  vehicles: JsonRecord[];
  onReview: (id: string, action: string, reason?: string) => Promise<void>;
}) {
  return (
    <Panel title="车辆审核" description="审核车辆资质、冷链能力、运营状态和车主信息">
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>车辆</th>
              <th>车主</th>
              <th>能力</th>
              <th>状态</th>
              <th>更新时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {vehicles.map(vehicle => {
              const id = stringValue(vehicle, 'id');
              const status = stringValue(vehicle, 'status', 'pending');
              return (
                <tr key={id}>
                  <td>
                    <strong>{stringValue(vehicle, 'license_plate', stringValue(vehicle, 'licensePlate', '未填写车牌'))}</strong>
                    <small>{stringValue(vehicle, 'vehicle_type', stringValue(vehicle, 'vehicleType', '无人车'))}</small>
                  </td>
                  <td>{shortId(stringValue(vehicle, 'owner_id', stringValue(vehicle, 'ownerId')))}</td>
                  <td>
                    <span>{numberValue(vehicle, 'load_capacity', numberValue(vehicle, 'loadCapacity'))}kg</span>
                    <small>{boolValue(vehicle, 'has_cold_chain', boolValue(vehicle, 'hasColdChain')) ? '冷链' : '常温'}</small>
                  </td>
                  <td>
                    <span className={badgeClass(status)}>{statusLabel(status)}</span>
                  </td>
                  <td>{formatDate(stringValue(vehicle, 'updated_at', stringValue(vehicle, 'updatedAt')))}</td>
                  <td className="actions">
                    <button className="ghost-button" type="button" onClick={() => onReview(id, 'approve')}>
                      <Icon name="check" />
                      通过
                    </button>
                    <button className="ghost-button danger" type="button" onClick={() => onReview(id, 'reject', '管理端审核不通过，请补充资料')}>
                      <Icon name="x" />
                      拒绝
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!vehicles.length ? <EmptyState text="暂无车辆数据" /> : null}
    </Panel>
  );
}

function TransportOrdersSection({
  orders,
  commissionPending,
  commissionSummary,
  onConfirmCommission,
}: {
  orders: JsonRecord[];
  commissionPending: JsonRecord[];
  commissionSummary: JsonRecord;
  onConfirmCommission: (id: string) => Promise<void>;
}) {
  return (
    <div className="page-grid">
      <div className="stat-grid compact">
        <StatCard label="待结算佣金" value={metricValue(commissionSummary, ['pendingCount', 'pendingOrders'])} detail="已支付佣金待平台审核" />
        <StatCard label="佣金总额" value={yuan(numberValue(commissionSummary, 'totalCommissionCents'))} detail="平台佣金池" />
        <StatCard label="已完成订单" value={metricValue(commissionSummary, ['completedCount'])} detail="佣金审核通过后完成" />
      </div>

      <Panel title="运力订单" description="管理普通运输订单、收款状态与佣金流程">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>订单</th>
                <th>货品</th>
                <th>路线</th>
                <th>运费</th>
                <th>状态</th>
                <th>创建时间</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(order => {
                const id = stringValue(order, 'id');
                const demand = recordValue(order, 'demand');
                return (
                  <tr key={id}>
                    <td>
                      <strong>{shortId(id)}</strong>
                      <small>{stringValue(order, 'payment_status', stringValue(order, 'paymentStatus'))}</small>
                    </td>
                    <td>{stringValue(demand, 'cargo_name', stringValue(demand, 'cargoName', '-'))}</td>
                    <td>
                      <span>{stringValue(order, 'pickup_address', stringValue(demand, 'pickup_address', '-'))}</span>
                      <small>{stringValue(order, 'delivery_address', stringValue(demand, 'delivery_address', '-'))}</small>
                    </td>
                    <td>{yuan(Math.round(numberValue(order, 'fare_price', numberValue(order, 'farePrice')) * 100))}</td>
                    <td>
                      <span className={badgeClass(stringValue(order, 'status'))}>{statusLabel(stringValue(order, 'status'))}</span>
                    </td>
                    <td>{formatDate(stringValue(order, 'created_at', stringValue(order, 'createdAt')))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!orders.length ? <EmptyState text="暂无运力订单" /> : null}
      </Panel>

      <Panel title="佣金审核" description="确认车主已支付的平台佣金，并完成订单">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>订单</th>
                <th>货品</th>
                <th>车主</th>
                <th>佣金</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {commissionPending.map(order => {
                const id = stringValue(order, 'id');
                return (
                  <tr key={id}>
                    <td>{shortId(id)}</td>
                    <td>{stringValue(order, 'cargoName', stringValue(order, 'cargo_name', '-'))}</td>
                    <td>{stringValue(order, 'ownerName', stringValue(order, 'owner_name', '-'))}</td>
                    <td>{yuan(Math.round(numberValue(order, 'commissionAmount', numberValue(order, 'commission_amount')) * 100))}</td>
                    <td>
                      <span className={badgeClass(stringValue(order, 'commissionPaymentStatus', stringValue(order, 'commission_payment_status')))}>
                        {statusLabel(stringValue(order, 'commissionPaymentStatus', stringValue(order, 'commission_payment_status')))}
                      </span>
                    </td>
                    <td className="actions">
                      <button className="primary-button small" type="button" onClick={() => onConfirmCommission(id)}>
                        <Icon name="check" />
                        确认佣金
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!commissionPending.length ? <EmptyState text="暂无待审核佣金" /> : null}
      </Panel>
    </div>
  );
}

function MallProductsSection({
  categories,
  procurementBuyers,
  products,
  filters,
  onFiltersChange,
  onApplyFilters,
  onSearch,
  onStatus,
  onUpdate,
  onUploadImage,
  onUploadQualificationFile,
}: {
  categories: JsonRecord[];
  procurementBuyers: JsonRecord[];
  products: JsonRecord[];
  filters: MallFilterState;
  onFiltersChange: (patch: Partial<MallFilterState>) => void;
  onApplyFilters: (patch: Partial<MallFilterState>) => Promise<void>;
  onSearch: () => Promise<void>;
  onStatus: (id: string, status: string) => Promise<void>;
  onUpdate: (id: string, form: ProductForm) => Promise<void>;
  onUploadImage: (file: File) => Promise<string>;
  onUploadQualificationFile: (file: File) => Promise<string>;
}) {
  const [editingProduct, setEditingProduct] = useState<JsonRecord | null>(null);
  const currentPage = positiveFilterNumber(filters.page, 1);
  const currentPageSize = positiveFilterNumber(filters.pageSize, 20);
  const canGoPrevious = currentPage > 1;
  const canGoNext = products.length >= currentPageSize;

  return (
    <div className="page-grid">
      <div className="admin-filterbar product-filterbar">
        <input value={filters.keyword} onChange={event => onFiltersChange({ keyword: event.target.value, page: '1' })} placeholder="搜索商品名称/SKU" />
        <select value={filters.categoryCode} onChange={event => onFiltersChange({ categoryCode: event.target.value, page: '1' })}>
          <option value="">全部品类</option>
          {categories.map(category => (
            <option key={stringValue(category, 'code')} value={stringValue(category, 'code')}>
              {stringValue(category, 'name', stringValue(category, 'code'))}
            </option>
          ))}
        </select>
        <select value={filters.status} onChange={event => onFiltersChange({ status: event.target.value, page: '1' })}>
          <option value="">全部状态</option>
          <option value="on_sale">在售</option>
          <option value="off_sale">下架</option>
          <option value="draft">草稿</option>
        </select>
        <select value={filters.stockStatus} onChange={event => onFiltersChange({ stockStatus: event.target.value, page: '1' })}>
          <option value="">全部库存</option>
          <option value="alert">库存预警</option>
          <option value="low">低库存</option>
          <option value="out">缺货</option>
        </select>
        <select value={filters.sort} onChange={event => void onApplyFilters({ sort: event.target.value, page: '1' })}>
          {productSortOptions.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <select value={filters.pageSize} onChange={event => void onApplyFilters({ pageSize: event.target.value, page: '1' })}>
          {productPageSizeOptions.map(pageSize => (
            <option key={pageSize} value={pageSize}>每页 {pageSize} 条</option>
          ))}
        </select>
        <button className="primary-button" type="button" onClick={() => void onSearch()}>
          <Icon name="refresh" />
          搜索
        </button>
      </div>

      <Panel title="商品列表" description="商品上下架、库存和冷链状态">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>商品</th>
                <th>类目</th>
                <th>价格</th>
                <th>库存</th>
                <th>规格</th>
                <th>状态</th>
                <th>最近编辑</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {products.map(product => {
                const id = stringValue(product, 'id');
                const status = stringValue(product, 'status');
                return (
                  <tr key={id}>
                    <td>
                      <ProductImage record={product} />
                    </td>
                    <td>
                      <span>{stringValue(product, 'categoryName', stringValue(product, 'categoryCode'))}</span>
                      <small>{boolValue(product, 'qualityGuaranteed') ? `品质保证 · ${tagsText(product)}` : tagsText(product)}</small>
                    </td>
                    <td>
                      <strong>{yuan(numberValue(product, 'priceCents'))}</strong>
                      <small>进货价 {numberValue(product, 'supplyPriceCents') ? yuan(numberValue(product, 'supplyPriceCents')) : '-'}</small>
                    </td>
                    <td>{numberValue(product, 'stock')}</td>
                    <td>
                      <span>{stringValue(product, 'specification', stringValue(product, 'subtitle', '-'))}</span>
                      <small>{stringValue(product, 'saleMethod', '-')} · {arrayValue(product, 'variants').length || 1} 规格 · 起订 {numberValue(product, 'minimumOrderQuantity', 1)} · 阈值 {numberValue(product, 'stockAlertThreshold', 15)}</small>
                    </td>
                    <td>
                      <span className={badgeClass(status)}>{statusLabel(status)}</span>
                    </td>
                    <td>{formatDate(stringValue(product, 'updatedAt', stringValue(product, 'createdAt')))}</td>
                    <td className="actions">
                      <button className="ghost-button" type="button" onClick={() => setEditingProduct(product)}>
                        <Icon name="save" />
                        编辑
                      </button>
                      <button className="ghost-button" type="button" onClick={() => onStatus(id, status === 'on_sale' ? 'off_sale' : 'on_sale')}>
                        <Icon name={status === 'on_sale' ? 'x' : 'check'} />
                        {status === 'on_sale' ? '下架' : '上架'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!products.length ? <EmptyState text="暂无商品数据" /> : null}
        <div className="product-pagination">
          <span>第 {currentPage} 页 · 每页 {currentPageSize} 条 · 当前 {products.length} 条</span>
          <div>
            <button className="ghost-button" type="button" disabled={!canGoPrevious} onClick={() => void onApplyFilters({ page: String(currentPage - 1) })}>
              上一页
            </button>
            <button className="ghost-button" type="button" disabled={!canGoNext} onClick={() => void onApplyFilters({ page: String(currentPage + 1) })}>
              下一页
            </button>
          </div>
        </div>
      </Panel>

      {editingProduct ? (
        <ProductEditModal
          categories={categories}
          procurementBuyers={procurementBuyers}
          product={editingProduct}
          onClose={() => setEditingProduct(null)}
          onSave={async (id, nextForm) => {
            await onUpdate(id, nextForm);
            setEditingProduct(null);
          }}
          onUploadImage={onUploadImage}
          onUploadQualificationFile={onUploadQualificationFile}
        />
      ) : null}
    </div>
  );
}

function ProductCreateModal({
  categories,
  procurementBuyers,
  form,
  onChange,
  onClose,
  onSubmit,
  onUploadImage,
  onUploadQualificationFile,
}: {
  categories: JsonRecord[];
  procurementBuyers: JsonRecord[];
  form: ProductForm;
  onChange: (patch: Partial<ProductForm>) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onUploadImage: (file: File) => Promise<string>;
  onUploadQualificationFile: (file: File) => Promise<string>;
}) {
  return (
    <div className="modal-backdrop">
      <section className="modal-panel product-modal product-modal-wide">
        <div className="panel-head">
          <div>
            <h2>新增上架商品</h2>
          </div>
          <button className="ghost-button" type="button" onClick={onClose}>
            <Icon name="x" />
            关闭
          </button>
        </div>
        <form className="product-form-scroll-guard" onSubmit={onSubmit}>
          <ProductFormFields
            categories={categories}
            procurementBuyers={procurementBuyers}
            form={form}
            onChange={onChange}
            onUploadImage={onUploadImage}
            onUploadQualificationFile={onUploadQualificationFile}
          />
          <div className="modal-actions">
            <button className="ghost-button" type="button" onClick={onClose}>取消</button>
            <button className="primary-button" type="submit">
              <Icon name="plus" />
              创建商品
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function ProductEditModal({
  categories,
  procurementBuyers,
  product,
  onClose,
  onSave,
  onUploadImage,
  onUploadQualificationFile,
}: {
  categories: JsonRecord[];
  procurementBuyers: JsonRecord[];
  product: JsonRecord;
  onClose: () => void;
  onSave: (id: string, form: ProductForm) => Promise<void>;
  onUploadImage: (file: File) => Promise<string>;
  onUploadQualificationFile: (file: File) => Promise<string>;
}) {
  const [draft, setDraft] = useState<ProductForm>(() => productToForm(product, stringValue(categories[0], 'code', 'fruit')));
  const id = stringValue(product, 'id');

  return (
    <div className="modal-backdrop">
      <section className="modal-panel product-modal product-modal-wide">
        <div className="panel-head">
          <div>
            <h2>编辑商品</h2>
          </div>
          <button className="ghost-button" type="button" onClick={onClose}>
            <Icon name="x" />
            关闭
          </button>
        </div>
        <div className="product-form-scroll-guard">
          <ProductFormFields
            categories={categories}
            procurementBuyers={procurementBuyers}
            form={draft}
            onChange={patch => setDraft(current => ({ ...current, ...patch }))}
            onUploadImage={onUploadImage}
            onUploadQualificationFile={onUploadQualificationFile}
          />
        </div>
        <div className="modal-actions">
          <button className="ghost-button" type="button" onClick={onClose}>取消</button>
          <button className="primary-button" type="button" onClick={() => void onSave(id, draft)}>
            <Icon name="save" />
            保存商品
          </button>
        </div>
      </section>
    </div>
  );
}

function MallCategoriesSection({
  categories,
  filters,
  form,
  onFormChange,
  onFiltersChange,
  onSearch,
  onSave,
  onDelete,
  onSaveCategoryOrder,
}: {
  categories: JsonRecord[];
  filters: MallFilterState;
  form: CategoryForm;
  onFormChange: (patch: Partial<CategoryForm>) => void;
  onFiltersChange: (patch: Partial<MallFilterState>) => void;
  onSearch: () => Promise<void>;
  onSave: (form: CategoryForm) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onSaveCategoryOrder: (orderedCategories: JsonRecord[]) => Promise<void>;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [categorySortEditing, setCategorySortEditing] = useState(false);
  const [categorySortDraft, setCategorySortDraft] = useState<JsonRecord[]>([]);
  const [draggingCategoryId, setDraggingCategoryId] = useState('');
  const sortedCategories = useMemo(
    () => [...categories].sort((left, right) => numberValue(left, 'sortOrder') - numberValue(right, 'sortOrder')),
    [categories],
  );
  const visibleCategories = categorySortEditing ? categorySortDraft : sortedCategories;

  useEffect(() => {
    if (!categorySortEditing) {
      setCategorySortDraft(sortedCategories);
    }
  }, [categorySortEditing, sortedCategories]);

  const openCreate = () => {
    onFormChange(initialCategoryForm);
    setModalOpen(true);
  };
  const openEdit = (category: JsonRecord) => {
    onFormChange(categoryToForm(category));
    setModalOpen(true);
  };
  const startSortEditing = () => {
    setCategorySortDraft(sortedCategories);
    setCategorySortEditing(true);
  };
  const cancelSortEditing = () => {
    setCategorySortDraft(sortedCategories);
    setDraggingCategoryId('');
    setCategorySortEditing(false);
  };
  const handleDragStart = (event: DragEvent<HTMLTableRowElement>, id: string) => {
    if (!categorySortEditing) return;
    setDraggingCategoryId(id);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', id);
  };
  const handleDrop = (event: DragEvent<HTMLTableRowElement>, targetId: string) => {
    if (!categorySortEditing) return;
    event.preventDefault();
    const draggedId = event.dataTransfer.getData('text/plain') || draggingCategoryId;
    setDraggingCategoryId('');
    if (!draggedId || draggedId === targetId) return;
    setCategorySortDraft(current => {
      const fromIndex = current.findIndex(category => stringValue(category, 'id') === draggedId);
      const toIndex = current.findIndex(category => stringValue(category, 'id') === targetId);
      if (fromIndex < 0 || toIndex < 0) return current;
      const next = [...current];
      const [dragged] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, dragged);
      return next.map((category, index) => ({
        ...category,
        sortOrder: (index + 1) * 10,
      }));
    });
  };
  const saveSortEditing = async () => {
    await onSaveCategoryOrder(categorySortDraft);
    setCategorySortEditing(false);
  };

  return (
    <div className="page-grid">
      <div className="admin-filterbar">
        <input value={filters.keyword} onChange={event => onFiltersChange({ keyword: event.target.value })} placeholder="搜索品类名称/编码" />
        <select value={filters.status} onChange={event => onFiltersChange({ status: event.target.value })}>
          <option value="">全部状态</option>
          <option value="active">启用</option>
          <option value="inactive">停用</option>
        </select>
        <button className="primary-button" type="button" onClick={() => void onSearch()}>
          <Icon name="refresh" />
          搜索
        </button>
        <button className="primary-button" type="button" onClick={openCreate}>
          <Icon name="plus" />
          新增品类
        </button>
        {categorySortEditing ? (
          <>
            <button className="primary-button" type="button" onClick={() => void saveSortEditing()}>
              <Icon name="save" />
              保存排序
            </button>
            <button className="ghost-button" type="button" onClick={cancelSortEditing}>
              <Icon name="x" />
              取消排序
            </button>
          </>
        ) : (
          <button className="ghost-button" type="button" onClick={startSortEditing}>
            <Icon name="route" />
            编辑排序
          </button>
        )}
      </div>
      <Panel title="品类管理" description="维护社区团购商品品类、排序和上下架状态；拖拽行可调整前台展示顺序">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>拖拽排序</th>
                <th>品类</th>
                <th>编码</th>
                <th>排序</th>
                <th>状态</th>
                <th>更新时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {visibleCategories.map(category => {
                const id = stringValue(category, 'id');
                return (
                  <tr
                    className={[
                      'sortable-row',
                      categorySortEditing ? 'sortable-row-editing' : '',
                      draggingCategoryId === id ? 'dragging' : '',
                    ].filter(Boolean).join(' ')}
                    draggable={categorySortEditing}
                    key={id}
                    onDragEnd={() => setDraggingCategoryId('')}
                    onDragOver={event => {
                      if (categorySortEditing) event.preventDefault();
                    }}
                    onDragStart={event => handleDragStart(event, id)}
                    onDrop={event => handleDrop(event, id)}
                  >
                    <td><span className="drag-handle" aria-label={categorySortEditing ? '拖拽排序' : '排序'}>↕</span></td>
                    <td><strong>{stringValue(category, 'name')}</strong></td>
                    <td>{stringValue(category, 'code')}</td>
                    <td>{numberValue(category, 'sortOrder')}</td>
                    <td><span className={badgeClass(stringValue(category, 'status'))}>{statusLabel(stringValue(category, 'status'))}</span></td>
                    <td>{formatDate(stringValue(category, 'updatedAt'))}</td>
                    <td className="actions">
                      <button className="ghost-button" type="button" onClick={() => openEdit(category)}>
                        <Icon name="save" />
                        编辑
                      </button>
                      <button className="ghost-button danger" type="button" onClick={() => void onDelete(id)}>
                        <Icon name="x" />
                        删除
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!categories.length ? <EmptyState text="暂无品类数据" /> : null}
      </Panel>

      {modalOpen ? (
        <div className="modal-backdrop">
          <section className="modal-panel">
            <div className="panel-head">
              <div>
                <h2>{form.id ? '编辑品类' : '新增品类'}</h2>
              </div>
              <button className="ghost-button" type="button" onClick={() => setModalOpen(false)}>
                <Icon name="x" />
                关闭
              </button>
            </div>
            <div className="form-grid">
              <label>
                编码
                <input value={form.code} onChange={event => onFormChange({ code: event.target.value })} placeholder="fruit" />
              </label>
              <label>
                名称
                <input value={form.name} onChange={event => onFormChange({ name: event.target.value })} placeholder="水果鲜选" />
              </label>
              <label>
                排序
                <input value={form.sortOrder} type="number" onChange={event => onFormChange({ sortOrder: event.target.value })} />
              </label>
              <label>
                状态
                <select value={form.status} onChange={event => onFormChange({ status: event.target.value })}>
                  <option value="active">启用</option>
                  <option value="inactive">停用</option>
                </select>
              </label>
            </div>
            <div className="modal-actions">
              <button className="ghost-button" type="button" onClick={() => setModalOpen(false)}>取消</button>
              <button
                className="primary-button"
                type="button"
                onClick={() => {
                  void onSave(form).then(() => setModalOpen(false));
                }}
              >
                <Icon name="save" />
                保存品类
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function MallInventorySection({
  allProducts,
  categories,
  products,
  filters,
  onCreateInventoryAlert,
  onDeleteInventoryAlert,
  onEditInventoryAlert,
  onFiltersChange,
  onSearch,
}: {
  allProducts: JsonRecord[];
  categories: JsonRecord[];
  products: JsonRecord[];
  filters: MallFilterState;
  onCreateInventoryAlert: (id: string, stock: number, stockAlertThreshold: number) => Promise<void>;
  onDeleteInventoryAlert: (id: string) => Promise<void>;
  onEditInventoryAlert: (id: string, stock: number, stockAlertThreshold: number) => Promise<void>;
  onFiltersChange: (patch: Partial<MallFilterState>) => void;
  onSearch: () => Promise<void>;
}) {
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [draft, setDraft] = useState({ productId: '', stock: '0', stockAlertThreshold: '15' });
  const candidateProducts = allProducts.length ? allProducts : products;
  const openCreate = () => {
    const firstProduct = candidateProducts[0];
    setDraft({
      productId: stringValue(firstProduct, 'id'),
      stock: String(numberValue(firstProduct, 'stock')),
      stockAlertThreshold: String(numberValue(firstProduct, 'stockAlertThreshold', 15)),
    });
    setModalMode('create');
  };
  const openEdit = (product: JsonRecord) => {
    setDraft({
      productId: stringValue(product, 'id'),
      stock: String(numberValue(product, 'stock')),
      stockAlertThreshold: String(numberValue(product, 'stockAlertThreshold', 15)),
    });
    setModalMode('edit');
  };
  const saveDraft = async () => {
    const productId = draft.productId;
    if (!productId) return;
    const stock = Number(draft.stock) || 0;
    const stockAlertThreshold = Number(draft.stockAlertThreshold) || 0;
    if (modalMode === 'create') {
      await onCreateInventoryAlert(productId, stock, stockAlertThreshold);
    } else {
      await onEditInventoryAlert(productId, stock, stockAlertThreshold);
    }
    setModalMode(null);
  };

  return (
    <div className="page-grid">
      <div className="admin-filterbar">
        <input value={filters.keyword} onChange={event => onFiltersChange({ keyword: event.target.value })} placeholder="搜索低库存商品" />
        <select value={filters.categoryCode} onChange={event => onFiltersChange({ categoryCode: event.target.value })}>
          <option value="">全部品类</option>
          {categories.map(category => (
            <option key={stringValue(category, 'code')} value={stringValue(category, 'code')}>
              {stringValue(category, 'name', stringValue(category, 'code'))}
            </option>
          ))}
        </select>
        <select value={filters.status} onChange={event => onFiltersChange({ status: event.target.value })}>
          <option value="">全部商品状态</option>
          <option value="on_sale">在售</option>
          <option value="off_sale">下架</option>
          <option value="draft">草稿</option>
        </select>
        <select value={filters.stockStatus} onChange={event => onFiltersChange({ stockStatus: event.target.value })}>
          <option value="alert">全部预警</option>
          <option value="low">低库存</option>
          <option value="out">缺货</option>
        </select>
        <button className="primary-button" type="button" onClick={() => void onSearch()}>
          <Icon name="refresh" />
          搜索
        </button>
        <button className="primary-button" type="button" onClick={openCreate}>
          <Icon name="plus" />
          新增预警
        </button>
      </div>
      <Panel title="库存预警" description="按商品级阈值检查库存，运营可新增、编辑或删除商品库存预警规则">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>商品</th>
                <th>品类</th>
                <th>库存状态</th>
                <th>当前库存</th>
                <th>预警阈值</th>
                <th>装载规格</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {products.map(product => {
                const id = stringValue(product, 'id');
                const stock = numberValue(product, 'stock');
                const threshold = numberValue(product, 'stockAlertThreshold', 15);
                return (
                  <tr key={id}>
                    <td><ProductImage record={product} /></td>
                    <td>{stringValue(product, 'categoryName', stringValue(product, 'categoryCode'))}</td>
                    <td><span className={stock <= 0 ? 'badge badge-amber' : 'badge badge-blue'}>{stockLevelLabel(product)}</span></td>
                    <td>{stock}</td>
                    <td>{threshold}</td>
                    <td>
                      <span>{numberValue(product, 'lengthCm')}×{numberValue(product, 'widthCm')}×{numberValue(product, 'heightCm')} cm</span>
                      <small>{numberValue(product, 'volumeLiters')}L · {numberValue(product, 'weightKg')}kg</small>
                    </td>
                    <td className="actions">
                      <button className="ghost-button" type="button" onClick={() => openEdit(product)}>
                        <Icon name="save" />
                        编辑
                      </button>
                      <button className="ghost-button danger" type="button" onClick={() => void onDeleteInventoryAlert(id)}>
                        <Icon name="x" />
                        删除
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!products.length ? <EmptyState text="暂无库存预警" /> : null}
      </Panel>

      {modalMode ? (
        <div className="modal-backdrop">
          <section className="modal-panel">
            <div className="panel-head">
              <div>
                <h2>{modalMode === 'create' ? '新增库存预警' : '编辑库存预警'}</h2>
              </div>
              <button className="ghost-button" type="button" onClick={() => setModalMode(null)}>
                <Icon name="x" />
                关闭
              </button>
            </div>
            <div className="form-grid">
              <label className="wide">
                商品
                <select
                  disabled={modalMode === 'edit'}
                  value={draft.productId}
                  onChange={event => {
                    const product = candidateProducts.find(item => stringValue(item, 'id') === event.target.value);
                    setDraft({
                      productId: event.target.value,
                      stock: String(numberValue(product, 'stock')),
                      stockAlertThreshold: String(numberValue(product, 'stockAlertThreshold', 15)),
                    });
                  }}
                >
                  <option value="">请选择商品</option>
                  {candidateProducts.map(product => (
                    <option key={stringValue(product, 'id')} value={stringValue(product, 'id')}>
                      {stringValue(product, 'name', stringValue(product, 'sku'))}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                当前库存
                <input value={draft.stock} type="number" min="0" onChange={event => setDraft(current => ({ ...current, stock: event.target.value }))} />
              </label>
              <label>
                预警阈值
                <input value={draft.stockAlertThreshold} type="number" min="0" onChange={event => setDraft(current => ({ ...current, stockAlertThreshold: event.target.value }))} />
              </label>
            </div>
            <div className="modal-actions">
              <button className="ghost-button" type="button" onClick={() => setModalMode(null)}>取消</button>
              <button className="primary-button" type="button" onClick={() => void saveDraft()} disabled={!draft.productId}>
                <Icon name="save" />
                保存预警
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function MallOrderDetailView({
  order,
  onAdjustWeight,
}: {
  order: JsonRecord;
  onAdjustWeight: (item: JsonRecord) => void;
}) {
  const status = stringValue(order, 'status');
  const paymentStatus = stringValue(order, 'paymentStatus');
  const fulfillmentCode = recordValue(order, 'fulfillmentCode');
  const items = arrayValue(order, 'items');
  const events = arrayValue(order, 'events');
  const fulfillmentEvents = arrayValue(order, 'fulfillmentEvents');
  const afterSales = arrayValue(order, 'afterSales');
  const pickupPoint = stringValue(order, 'pickupPointName');
  const groupLeader = stringValue(order, 'groupLeaderName');
  const groupLeaderPhone = stringValue(order, 'groupLeaderPhone');
  const fulfillmentCodeText = stringValue(fulfillmentCode, 'code');

  return (
    <div className="order-detail-view">
      <div className="order-detail-head">
        <div>
          <span>订单号</span>
          <strong>{stringValue(order, 'orderNo', shortId(stringValue(order, 'id')))}</strong>
          <small>{formatDate(stringValue(order, 'createdAt'))}</small>
        </div>
        <div className="order-detail-statuses">
          <span className={badgeClass(status)}>{statusLabel(status)}</span>
          <span className={badgeClass(paymentStatus)}>{statusLabel(paymentStatus)}</span>
        </div>
      </div>

      <div className="order-detail-grid">
        <div>
          <span>收货人</span>
          <strong>{stringValue(order, 'recipientName', '-')}</strong>
          <small>{stringValue(order, 'recipientPhone', '-')}</small>
        </div>
        <div>
          <span>收货地址</span>
          <strong>{stringValue(order, 'addressText', '-')}</strong>
          <small>{stringValue(order, 'expectedDeliveryWindow', '-')}</small>
        </div>
        <div>
          <span>自提点</span>
          <strong>{pickupPoint || '-'}</strong>
          <small>{groupLeader ? `${groupLeader} ${groupLeaderPhone}` : '-'}</small>
        </div>
        <div>
          <span>商家ID</span>
          <strong>{stringValue(order, 'merchantId', '-')}</strong>
          <small>用户手机号 {stringValue(order, 'userPhone', stringValue(order, 'recipientPhone', '-'))}</small>
        </div>
        <div>
          <span>履约</span>
          <strong>{statusLabel(stringValue(order, 'fulfillmentStatus'))}</strong>
          <small>舱位 {stringValue(order, 'cabinCode', '-')} · 核销码 {fulfillmentCodeText || '-'}</small>
        </div>
        <div>
          <span>商品金额</span>
          <strong>{yuan(numberValue(order, 'subtotalCents'))}</strong>
          <small>配送 {yuan(numberValue(order, 'deliveryFeeCents'))} · 优惠 {yuan(numberValue(order, 'couponCents'))}</small>
        </div>
        <div>
          <span>实付金额</span>
          <strong>{yuan(numberValue(order, 'payableCents'))}</strong>
          <small>
            {orderHasWeightedItems(order)
              ? `称重${statusLabel(stringValue(order, 'weightAdjustmentStatus'))} · 差额 ${yuan(numberValue(order, 'weightAdjustmentCents'))}`
              : stringValue(order, 'remark', '-')}
          </small>
        </div>
      </div>

      <section className="order-detail-block">
        <h3>商品明细</h3>
        <div className="table-wrap order-detail-items">
          <table>
            <thead>
              <tr>
                <th>商品</th>
                <th>规格</th>
                <th>单价</th>
                <th>数量</th>
                <th>称重</th>
                <th>小计</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const row = item && typeof item === 'object' && !Array.isArray(item) ? (item as JsonRecord) : {};
                return (
                  <tr key={stringValue(row, 'id', `${index}`)}>
                    <td>
                      <strong>{stringValue(row, 'productName', '-')}</strong>
                      <small>{stringValue(row, 'sku', '-')}</small>
                    </td>
                    <td>
                      <span>{stringValue(row, 'categoryCode', '-')}</span>
                      <small>{stringValue(row, 'specName', stringValue(row, 'specification', '-'))}</small>
                    </td>
                    <td>{yuan(numberValue(row, 'unitPriceCents'))}</td>
                    <td>{numberValue(row, 'quantity')}</td>
                    <td>
                      {stringValue(row, 'pricingMode') === 'weighed' ? (
                        <span>
                          预估 {itemWeightText(row)}
                          <small>实际 {itemWeightText(row, 'actualWeightGrams')}</small>
                        </span>
                      ) : '-'}
                    </td>
                    <td>{yuan(itemLineTotal(row))}</td>
                    <td>
                      {stringValue(row, 'pricingMode') === 'weighed' ? (
                        <button className="ghost-button compact-action" type="button" onClick={() => onAdjustWeight(row)}>
                          称重改价
                        </button>
                      ) : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!items.length ? <EmptyState text="暂无商品明细" /> : null}
      </section>

      <div className="order-detail-columns">
        <section className="order-detail-block">
          <h3>订单轨迹</h3>
          <div className="order-detail-timeline">
            {events.map((event, index) => {
              const row = event && typeof event === 'object' && !Array.isArray(event) ? (event as JsonRecord) : {};
              return (
                <div key={stringValue(row, 'id', `${index}`)}>
                  <strong>{stringValue(row, 'title', statusLabel(stringValue(row, 'stage')))}</strong>
                  <span>{stringValue(row, 'description', '-')}</span>
                  <small>{formatDate(orderEventTime(row))}</small>
                </div>
              );
            })}
            {!events.length ? <EmptyState text="暂无订单轨迹" /> : null}
          </div>
        </section>

        <section className="order-detail-block">
          <h3>履约与售后</h3>
          <div className="order-detail-timeline">
            {fulfillmentEvents.map((event, index) => {
              const row = event && typeof event === 'object' && !Array.isArray(event) ? (event as JsonRecord) : {};
              return (
                <div key={stringValue(row, 'id', `fulfillment-${index}`)}>
                  <strong>{stringValue(row, 'title', statusLabel(stringValue(row, 'eventType')))}</strong>
                  <span>{stringValue(row, 'description', '-')}</span>
                  <small>{formatDate(orderEventTime(row))}</small>
                </div>
              );
            })}
            {afterSales.map((sale, index) => {
              const row = sale && typeof sale === 'object' && !Array.isArray(sale) ? (sale as JsonRecord) : {};
              return (
                <div key={stringValue(row, 'id', `after-sale-${index}`)}>
                  <strong>{statusLabel(stringValue(row, 'status'))} · {yuan(numberValue(row, 'amountCents'))}</strong>
                  <span>{stringValue(row, 'reason', stringValue(row, 'description', '-'))}</span>
                  <small>{formatDate(stringValue(row, 'createdAt'))}</small>
                </div>
              );
            })}
            {!fulfillmentEvents.length && !afterSales.length ? <EmptyState text="暂无履约或售后记录" /> : null}
          </div>
        </section>
      </div>
    </div>
  );
}

function MallOrderDetailModal({
  open,
  order,
  loading,
  error,
  onClose,
  onAdjustWeight,
}: {
  open: boolean;
  order: JsonRecord | null;
  loading: boolean;
  error: string;
  onClose: () => void;
  onAdjustWeight: (item: JsonRecord) => void;
}) {
  if (!open) return null;

  return (
    <div className="modal-backdrop">
      <section className="modal-panel order-detail-modal">
        <div className="modal-title-row">
          <div>
            <h2>订单详情</h2>
            <p>{order ? stringValue(order, 'orderNo', shortId(stringValue(order, 'id'))) : '正在加载订单详情'}</p>
          </div>
          <button className="ghost-button small" type="button" onClick={onClose}>
            <Icon name="x" />
            关闭
          </button>
        </div>
        {loading ? <div className="loading-panel">正在加载订单详情...</div> : null}
        {error ? <div className="detail-error">{error}</div> : null}
        {!loading && !error && order ? <MallOrderDetailView order={order} onAdjustWeight={onAdjustWeight} /> : null}
      </section>
    </div>
  );
}

function WeightAdjustmentModal({
  item,
  saving,
  onClose,
  onSubmit,
}: {
  item: JsonRecord | null;
  saving: boolean;
  onClose: () => void;
  onSubmit: (actualWeightJin: string, note: string) => Promise<void>;
}) {
  const [actualWeightJin, setActualWeightJin] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!item) return;
    setActualWeightJin('');
    setNote(stringValue(item, 'weightAdjustmentNote'));
  }, [item]);

  if (!item) return null;

  return (
    <div className="modal-backdrop">
      <section className="modal-panel weight-adjustment-modal">
        <div className="modal-title-row">
          <div>
            <h2>称重改价</h2>
            <p>{stringValue(item, 'productName', '-')} · 预估 {itemWeightText(item)}</p>
          </div>
          <button className="ghost-button small" type="button" onClick={onClose}>
            <Icon name="x" />
            关闭
          </button>
        </div>
        <div className="form-grid">
          <label>
            实际重量（斤）
            <input
              autoFocus
              min="0.01"
              step="0.01"
              type="number"
              value={actualWeightJin}
              onChange={event => setActualWeightJin(event.target.value)}
              placeholder="例如 30.1"
            />
          </label>
          <label>
            改价备注
            <input value={note} onChange={event => setNote(event.target.value)} placeholder="称重员、批次或异常说明" />
          </label>
        </div>
        <div className="modal-actions">
          <button className="ghost-button" type="button" onClick={onClose}>取消</button>
          <button className="primary-button" type="button" disabled={saving || !actualWeightJin.trim()} onClick={() => void onSubmit(actualWeightJin, note)}>
            <Icon name="save" />
            {saving ? '保存中' : '保存改价'}
          </button>
        </div>
      </section>
    </div>
  );
}

function MallOrderDetailSearchSection({
  filters,
  orders,
  loading,
  error,
  onFiltersChange,
  onSearch,
  onClear,
  onViewDetail,
}: {
  filters: MallOrderDetailSearchFilters;
  orders: JsonRecord[];
  loading: boolean;
  error: string;
  onFiltersChange: (patch: Partial<MallOrderDetailSearchFilters>) => void;
  onSearch: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onClear: () => void;
  onViewDetail: (id: string) => Promise<void>;
}) {
  return (
    <Panel
      title="订单详情"
      description="按订单号、用户手机号、商家ID和日期范围定位订单，再打开弹窗查看明细"
      action={
        orders.length || Object.values(filters).some(value => value.trim()) ? (
          <button className="ghost-button small" type="button" onClick={onClear}>
            <Icon name="x" />
            清空
          </button>
        ) : null
      }
    >
      <form className="order-search-form" onSubmit={onSearch}>
        <label>
          订单号
          <input
            placeholder="输入订单号"
            value={filters.orderNo}
            onChange={event => onFiltersChange({ orderNo: event.target.value })}
          />
        </label>
        <label>
          用户手机号
          <input
            inputMode="tel"
            placeholder="输入用户手机号"
            value={filters.userPhone}
            onChange={event => onFiltersChange({ userPhone: event.target.value })}
          />
        </label>
        <label>
          商家ID
          <input
            placeholder="输入商家ID"
            value={filters.merchantId}
            onChange={event => onFiltersChange({ merchantId: event.target.value })}
          />
        </label>
        <label>
          开始日期
          <input
            type="date"
            value={filters.startDate}
            onChange={event => onFiltersChange({ startDate: event.target.value })}
          />
        </label>
        <label>
          结束日期
          <input
            type="date"
            value={filters.endDate}
            onChange={event => onFiltersChange({ endDate: event.target.value })}
          />
        </label>
        <button className="primary-button" type="submit" disabled={loading}>
          <Icon name="orders" />
          搜索订单
        </button>
      </form>
      {loading ? <div className="loading-panel">正在加载订单详情...</div> : null}
      {error ? <div className="detail-error">{error}</div> : null}
      {!loading && !error && orders.length ? (
        <div className="table-wrap order-detail-results">
          <table>
            <thead>
              <tr>
                <th>订单</th>
                <th>用户</th>
                <th>商家ID</th>
                <th>金额</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(order => {
                const id = stringValue(order, 'id');
                const status = stringValue(order, 'status');
                return (
                  <tr key={id}>
                    <td>
                      <strong>{stringValue(order, 'orderNo', shortId(id))}</strong>
                      <small>{formatDate(stringValue(order, 'createdAt'))}</small>
                    </td>
                    <td>
                      <span>{stringValue(order, 'recipientName', stringValue(order, 'userId'))}</span>
                      <small>{stringValue(order, 'recipientPhone', stringValue(order, 'userPhone', '-'))}</small>
                    </td>
                    <td>{stringValue(order, 'merchantId', '-')}</td>
                    <td>
                      <strong>{yuan(numberValue(order, 'payableCents'))}</strong>
                      <small>{statusLabel(stringValue(order, 'paymentStatus'))}</small>
                    </td>
                    <td><span className={badgeClass(status)}>{statusLabel(status)}</span></td>
                    <td>
                      <button className="ghost-button" type="button" onClick={() => onViewDetail(id)}>
                        <Icon name="orders" />
                        查看详情
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
      {!loading && !error && !orders.length ? <EmptyState text="暂无订单详情搜索结果" /> : null}
    </Panel>
  );
}

function MallOrdersSection({
  orders,
  onDispatch,
  onStatus,
  onRefund,
  onViewDetail,
}: {
  orders: JsonRecord[];
  onDispatch: (id: string) => Promise<void>;
  onStatus: (id: string, status: string) => Promise<void>;
  onRefund: (id: string, amountCents: number) => Promise<void>;
  onViewDetail: (id: string) => Promise<void>;
}) {
  return (
    <Panel title="商城订单" description="处理支付、派车、配送、售后与退款">
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>订单</th>
              <th>收货信息</th>
              <th>商品</th>
              <th>金额</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {orders.map(order => {
              const id = stringValue(order, 'id');
              const status = stringValue(order, 'status');
              const items = arrayValue(order, 'items');
              const firstItem = items[0] && typeof items[0] === 'object' ? (items[0] as JsonRecord) : {};
              return (
                <tr key={id}>
                  <td>
                    <strong>{stringValue(order, 'orderNo', shortId(id))}</strong>
                    <small>{formatDate(stringValue(order, 'createdAt'))}</small>
                  </td>
                  <td>
                    <span>{stringValue(order, 'recipientName', stringValue(order, 'userId'))}</span>
                    <small>{stringValue(order, 'addressText')}</small>
                  </td>
                  <td>
                    <span>{stringValue(firstItem, 'productName', `${items.length} 件商品`)}</span>
                    <small>{items.length} 个条目 · 舱位 {stringValue(order, 'cabinCode', '-')}</small>
                  </td>
                  <td>
                    <strong>{yuan(numberValue(order, 'payableCents'))}</strong>
                    <small>{statusLabel(stringValue(order, 'paymentStatus'))}</small>
                  </td>
                  <td>
                    <span className={badgeClass(status)}>{statusLabel(status)}</span>
                  </td>
                  <td className="actions column-actions">
                    <button className="ghost-button" type="button" onClick={() => onViewDetail(id)}>
                      <Icon name="orders" />
                      详情
                    </button>
                    <button className="ghost-button" type="button" onClick={() => onDispatch(id)}>
                      <Icon name="truck" />
                      派车
                    </button>
                    <button className="ghost-button" type="button" onClick={() => onStatus(id, status === 'completed' ? 'delivering' : 'completed')}>
                      <Icon name="check" />
                      {status === 'completed' ? '改配送中' : '完成'}
                    </button>
                    <button className="ghost-button danger" type="button" onClick={() => onRefund(id, numberValue(order, 'payableCents'))}>
                      <Icon name="refund" />
                      退款
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!orders.length ? <EmptyState text="暂无商城订单" /> : null}
    </Panel>
  );
}

function MallOpsFilterbar({
  filters,
  placeholder,
  statusOptions = [
    ['pending', '待处理'],
    ['approved', '已通过'],
    ['rejected', '已拒绝'],
    ['completed', '已完成'],
  ],
  onFiltersChange,
  onSearch,
}: {
  filters: MallOpsFilterState;
  placeholder: string;
  statusOptions?: Array<[string, string]>;
  onFiltersChange: (patch: Partial<MallOpsFilterState>) => void;
  onSearch: () => Promise<void>;
}) {
  return (
    <div className="ops-filterbar">
      <label>
        关键词
        <input value={filters.keyword} onChange={event => onFiltersChange({ keyword: event.target.value })} placeholder={placeholder} />
      </label>
      <label>
        状态
        <select value={filters.status} onChange={event => onFiltersChange({ status: event.target.value })}>
          <option value="">全部状态</option>
          {statusOptions.map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </label>
      <label>
        日期
        <input type="date" value={filters.date} onChange={event => onFiltersChange({ date: event.target.value })} />
      </label>
      <label>
        小区
        <input value={filters.community} onChange={event => onFiltersChange({ community: event.target.value })} placeholder="小区/自提点" />
      </label>
      <button className="primary-button" type="button" onClick={() => void onSearch()}>
        <Icon name="refresh" />
        查询
      </button>
    </div>
  );
}

function MallOrderOpsSection({
  mode,
  orders,
  filters,
  onDispatch,
  onFiltersChange,
  onRefund,
  onSearch,
  onStatus,
  onViewDetail,
}: {
  mode: MallOrderOpsMode;
  orders: JsonRecord[];
  filters: MallOpsFilterState;
  onDispatch: (id: string) => Promise<void>;
  onFiltersChange: (patch: Partial<MallOpsFilterState>) => void;
  onRefund: (id: string, amountCents: number) => Promise<void>;
  onSearch: () => Promise<void>;
  onStatus: (id: string, status: string) => Promise<void>;
  onViewDetail: (id: string) => Promise<void>;
}) {
  const visibleOrders = filterMallOrdersByMode(orders, mode, filters);
  const summaries = buildCommunityOrderSummaries(visibleOrders);
  const title = mode === 'today' ? '今日订单' : mode === 'abnormal' ? '异常订单' : '历史订单';
  const description = mode === 'today'
    ? '按小区汇总今日订单，可直接打印分拣单'
    : mode === 'abnormal'
      ? '集中处理退款、售后和履约异常'
      : '查看全部历史订单明细和履约状态';

  return (
    <div className="page-grid ops-page">
      <MallOpsFilterbar
        filters={filters}
        placeholder="搜索订单号、收货人、电话"
        statusOptions={[
          ['pending_payment', '待支付'],
          ['paid', '已支付'],
          ['dispatching', '派送中'],
          ['delivering', '配送中'],
          ['completed', '已完成'],
          ['refunding', '退款中'],
          ['cancelled', '已取消'],
        ]}
        onFiltersChange={onFiltersChange}
        onSearch={onSearch}
      />

      {mode === 'today' ? (
        <Panel title="小区分拣汇总" description="按小区、自提点和团长汇总今日订单">
          <div className="ops-summary-list">
            {summaries.map(summary => (
              <article className="ops-summary-row" key={summary.community}>
                <div>
                  <strong>{summary.community}</strong>
                  <small>{summary.pickupPoint} · {summary.leader} {summary.phone}</small>
                </div>
                <span>{summary.orderCount} 单</span>
                <span>{summary.itemCount} 件</span>
                <span>{yuan(summary.amountCents)}</span>
                <button className="ghost-button" type="button" onClick={() => window.print()}>
                  <Icon name="orders" />
                  打印分拣单
                </button>
              </article>
            ))}
            {!summaries.length ? <EmptyState text="暂无今日小区汇总" /> : null}
          </div>
        </Panel>
      ) : null}

      <Panel title={title} description={description}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>订单</th>
                <th>小区/自提点</th>
                <th>团长</th>
                <th>件数</th>
                <th>金额</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {visibleOrders.map(order => {
                const id = stringValue(order, 'id');
                const status = orderStatus(order);
                return (
                  <tr key={id}>
                    <td>
                      <strong>{stringValue(order, 'orderNo', shortId(id))}</strong>
                      <small>{formatDate(stringValue(order, 'createdAt'))}</small>
                    </td>
                    <td>
                      <span>{recordCommunityName(order) || '-'}</span>
                      <small>{recordPickupPointName(order) || recordAddress(order) || '-'}</small>
                    </td>
                    <td>
                      <span>{recordLeaderName(order) || '-'}</span>
                      <small>{recordLeaderPhone(order) || '-'}</small>
                    </td>
                    <td>{orderItemCount(order)}</td>
                    <td>
                      <strong>{yuan(mallOrderPayableCents(order) || mallOrderRevenueCents(order))}</strong>
                      <small>{statusLabel(orderPaymentStatus(order))}</small>
                    </td>
                    <td><span className={badgeClass(status)}>{statusLabel(status)}</span></td>
                    <td className="actions column-actions">
                      <button className="ghost-button" type="button" onClick={() => void onViewDetail(id)}>
                        <Icon name="orders" />
                        详情
                      </button>
                      {mode !== 'history' ? (
                        <button className="ghost-button" type="button" onClick={() => void onDispatch(id)}>
                          <Icon name="truck" />
                          派送
                        </button>
                      ) : null}
                      <button className="ghost-button" type="button" onClick={() => void onStatus(id, status === 'completed' ? 'delivering' : 'completed')}>
                        <Icon name="check" />
                        {status === 'completed' ? '改配送中' : '完成'}
                      </button>
                      {mode === 'abnormal' ? (
                        <button className="ghost-button danger" type="button" onClick={() => void onRefund(id, mallOrderPayableCents(order) || mallOrderRevenueCents(order))}>
                          <Icon name="refund" />
                          退款
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!visibleOrders.length ? <EmptyState text={`暂无${title}`} /> : null}
      </Panel>
    </div>
  );
}

function MallDeliveryOpsSection({
  mode,
  deliverySheets,
  filters,
  orders,
  pickupPoints,
  onFiltersChange,
  onGenerate,
  onSearch,
  onUpdateStatus,
}: {
  mode: MallDeliveryOpsMode;
  deliverySheets: JsonRecord[];
  filters: MallOpsFilterState;
  orders: JsonRecord[];
  pickupPoints: JsonRecord[];
  onFiltersChange: (patch: Partial<MallOpsFilterState>) => void;
  onGenerate: () => Promise<void>;
  onSearch: () => Promise<void>;
  onUpdateStatus: (id: string, status: string) => Promise<void>;
}) {
  const visibleSheets = filterMallOpsRecords(
    deliverySheets,
    filters,
    ['id', 'sheetNo', 'communityName', 'pickupPointName', 'leaderName', 'status'],
    ['sheetDate', 'generatedAt', 'createdAt'],
  );
  const contacts = filterMallOpsRecords(
    derivePickupPoints(pickupPoints, orders, deliverySheets),
    filters,
    ['id', 'name', 'pickupPointName', 'communityName', 'leaderName', 'leaderPhone', 'address', 'status'],
    ['createdAt', 'updatedAt'],
  );
  const isPickup = mode === 'pickup';
  const title = mode === 'sheets' ? '配送单生成' : mode === 'tracking' ? '配送状态跟踪' : '自提点对接';

  return (
    <div className="page-grid ops-page">
      <MallOpsFilterbar
        filters={filters}
        placeholder={isPickup ? '搜索自提点、团长、地址' : '搜索配送单、小区、自提点'}
        statusOptions={[
          ['generated', '已生成'],
          ['shipping', '已发货'],
          ['shipped', '已发货'],
          ['delivered', '已送达'],
          ['completed', '已完成'],
        ]}
        onFiltersChange={onFiltersChange}
        onSearch={onSearch}
      />

      {isPickup ? (
        <Panel title={title} description="查看各团长联系方式和自提点地址">
          <div className="ops-contact-grid">
            {contacts.map(point => {
              const id = stringValue(point, 'id', `${recordPickupPointName(point)}-${recordLeaderPhone(point)}`);
              const phone = recordLeaderPhone(point);
              return (
                <article className="ops-contact-card" key={id}>
                  <div>
                    <strong>{stringValue(point, 'name', recordPickupPointName(point)) || '-'}</strong>
                    <small>{recordCommunityName(point) || '未配置小区'}</small>
                  </div>
                  <span>{recordLeaderName(point) || '-'}</span>
                  <small>{phone || '-'}</small>
                  <p>{recordAddress(point) || '-'}</p>
                  <button className="ghost-button" type="button" disabled={!phone} onClick={() => void navigator.clipboard?.writeText(phone)}>
                    <Icon name="send" />
                    复制电话
                  </button>
                </article>
              );
            })}
            {!contacts.length ? <EmptyState text="暂无自提点数据" /> : null}
          </div>
        </Panel>
      ) : (
        <Panel
          title={title}
          description={mode === 'sheets' ? '每日固定时间或手动生成当日配送单' : '标记配送单已发货、已送达'}
          action={mode === 'sheets' ? (
            <button className="primary-button" type="button" onClick={() => void onGenerate()}>
              <Icon name="plus" />
              生成配送单
            </button>
          ) : null}
        >
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>配送单</th>
                  <th>小区/自提点</th>
                  <th>订单</th>
                  <th>金额</th>
                  <th>状态</th>
                  <th>生成时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {visibleSheets.map(sheet => {
                  const id = stringValue(sheet, 'id');
                  const status = stringValue(sheet, 'status');
                  return (
                    <tr key={id}>
                      <td>
                        <strong>{stringValue(sheet, 'sheetNo', shortId(id))}</strong>
                        <small>{stringValue(sheet, 'sheetDate', '-')}</small>
                      </td>
                      <td>
                        <span>{recordCommunityName(sheet) || '-'}</span>
                        <small>{recordPickupPointName(sheet) || '-'}</small>
                      </td>
                      <td>
                        <span>{numberValue(sheet, 'orderCount')} 单</span>
                        <small>{numberValue(sheet, 'itemCount')} 件</small>
                      </td>
                      <td>{yuan(numberValue(sheet, 'totalPayableCents', numberValue(sheet, 'amountCents')))}</td>
                      <td><span className={badgeClass(status)}>{statusLabel(status)}</span></td>
                      <td>{formatDate(stringValue(sheet, 'generatedAt', stringValue(sheet, 'createdAt')))}</td>
                      <td className="actions">
                        <button className="ghost-button" type="button" onClick={() => void onUpdateStatus(id, 'shipped')}>
                          <Icon name="truck" />
                          已发货
                        </button>
                        <button className="ghost-button" type="button" onClick={() => void onUpdateStatus(id, 'delivered')}>
                          <Icon name="check" />
                          已送达
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!visibleSheets.length ? <EmptyState text="暂无配送单" /> : null}
        </Panel>
      )}
    </div>
  );
}

function MallPickupPointsSection({
  filters,
  pickupPoints,
  onDelete,
  onFiltersChange,
  onSave,
  onSearch,
  onStatus,
}: {
  filters: PickupPointFilterState;
  pickupPoints: JsonRecord[];
  onDelete: (id: string) => Promise<void>;
  onFiltersChange: (patch: Partial<PickupPointFilterState>) => void;
  onSave: (form: PickupPointForm) => Promise<void>;
  onSearch: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onStatus: (id: string, status: string) => Promise<void>;
}) {
  const [editingForm, setEditingForm] = useState<PickupPointForm | null>(null);
  const activeCount = pickupPoints.filter(point => stringValue(point, 'status') === 'active').length;
  const communities = new Set(pickupPoints.map(recordCommunityName).filter(Boolean));
  const leaderReadyCount = pickupPoints.filter(point => recordLeaderName(point) || recordLeaderPhone(point)).length;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingForm) return;
    await onSave(editingForm);
    setEditingForm(null);
  };

  return (
    <div className="page-grid pickup-leader-admin-page">
      <div className="stat-grid compact">
        <StatCard label="自提点" value={String(pickupPoints.length)} detail="当前管理范围" />
        <StatCard label="启用中" value={String(activeCount)} detail="用户端可选择" />
        <StatCard label="覆盖小区" value={String(communities.size)} detail="按小区聚合配送" />
        <StatCard label="团长信息" value={String(leaderReadyCount)} detail="已配置联系方式" />
      </div>

      <Panel
        title="自提点管理"
        description="维护自提点名称、地址、小区、营业时间和团长联系方式，启用状态会影响用户下单可选范围"
        action={(
          <button className="primary-button" type="button" onClick={() => setEditingForm(initialPickupPointForm)}>
            <Icon name="plus" />
            新增自提点
          </button>
        )}
      >
        <form className="admin-filterbar pickup-admin-filterbar" onSubmit={event => void onSearch(event)}>
          <input
            value={filters.keyword}
            placeholder="搜索自提点名称、地址、团长手机号"
            onChange={event => onFiltersChange({ keyword: event.target.value })}
          />
          <input
            value={filters.community}
            placeholder="小区"
            onChange={event => onFiltersChange({ community: event.target.value })}
          />
          <select value={filters.status} onChange={event => onFiltersChange({ status: event.target.value })}>
            <option value="">全部状态</option>
            <option value="active">启用</option>
            <option value="inactive">停用</option>
          </select>
          <button className="primary-button" type="submit">
            <Icon name="route" />
            搜索
          </button>
          <button className="ghost-button" type="button" onClick={() => onFiltersChange(initialPickupPointFilters)}>
            <Icon name="refresh" />
            重置
          </button>
        </form>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>自提点名称</th>
                <th>小区/地址</th>
                <th>营业时间</th>
                <th>团长</th>
                <th>排序</th>
                <th>状态</th>
                <th>更新时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {pickupPoints.map(point => {
                const id = stringValue(point, 'id');
                const status = stringValue(point, 'status', 'active');
                return (
                  <tr key={id}>
                    <td>
                      <strong>{stringValue(point, 'name', recordPickupPointName(point))}</strong>
                      <small>{shortId(id)}</small>
                    </td>
                    <td>
                      <span>{recordCommunityName(point) || '-'}</span>
                      <small>{recordAddress(point) || '-'}</small>
                    </td>
                    <td>{stringValue(point, 'businessHours', '-')}</td>
                    <td>
                      <span>{recordLeaderName(point) || '-'}</span>
                      <small>{recordLeaderPhone(point) || '-'}</small>
                    </td>
                    <td>{numberValue(point, 'sortOrder')}</td>
                    <td><span className={badgeClass(status)}>{statusLabel(status)}</span></td>
                    <td>{formatDate(stringValue(point, 'updatedAt', stringValue(point, 'createdAt')))}</td>
                    <td className="actions column-actions">
                      <button className="ghost-button" type="button" onClick={() => setEditingForm(pickupPointToForm(point))}>
                        <Icon name="save" />
                        编辑
                      </button>
                      <button className="ghost-button" type="button" onClick={() => void onStatus(id, status === 'active' ? 'inactive' : 'active')}>
                        <Icon name={status === 'active' ? 'x' : 'check'} />
                        {status === 'active' ? '停用' : '启用'}
                      </button>
                      <button className="ghost-button danger" type="button" onClick={() => void onDelete(id)}>
                        <Icon name="x" />
                        删除
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!pickupPoints.length ? <EmptyState text="暂无自提点数据" /> : null}
      </Panel>

      {editingForm ? (
        <div className="modal-backdrop">
          <form className="modal-panel" onSubmit={submit}>
            <div className="modal-title-row">
              <div>
                <h2>{editingForm.id ? '编辑自提点' : '新增自提点'}</h2>
                <p>必填项：自提点名称、地址、状态。团长联系方式可在团长管理中同步维护。</p>
              </div>
              <button className="ghost-button icon-only" type="button" onClick={() => setEditingForm(null)}>
                <Icon name="x" />
              </button>
            </div>
            <div className="form-grid">
              <label>
                <span className="field-label">自提点名称<span className="required-mark">*</span></span>
                <input required value={editingForm.name} onChange={event => setEditingForm(current => current ? { ...current, name: event.target.value } : current)} />
              </label>
              <label>
                小区
                <input value={editingForm.communityName} onChange={event => setEditingForm(current => current ? { ...current, communityName: event.target.value } : current)} />
              </label>
              <label className="wide">
                <span className="field-label">自提点地址<span className="required-mark">*</span></span>
                <input required value={editingForm.addressText} onChange={event => setEditingForm(current => current ? { ...current, addressText: event.target.value } : current)} />
              </label>
              <label>
                营业时间
                <input value={editingForm.businessHours} onChange={event => setEditingForm(current => current ? { ...current, businessHours: event.target.value } : current)} placeholder="08:00-20:00" />
              </label>
              <label>
                状态
                <select required value={editingForm.status} onChange={event => setEditingForm(current => current ? { ...current, status: event.target.value } : current)}>
                  <option value="active">启用</option>
                  <option value="inactive">停用</option>
                </select>
              </label>
              <label>
                团长姓名
                <input value={editingForm.leaderName} onChange={event => setEditingForm(current => current ? { ...current, leaderName: event.target.value } : current)} />
              </label>
              <label>
                团长手机号
                <input value={editingForm.leaderPhone} onChange={event => setEditingForm(current => current ? { ...current, leaderPhone: event.target.value } : current)} />
              </label>
              <label>
                纬度
                <input value={editingForm.latitude} type="number" step="0.000001" onChange={event => setEditingForm(current => current ? { ...current, latitude: event.target.value } : current)} />
              </label>
              <label>
                经度
                <input value={editingForm.longitude} type="number" step="0.000001" onChange={event => setEditingForm(current => current ? { ...current, longitude: event.target.value } : current)} />
              </label>
              <label>
                排序
                <input required value={editingForm.sortOrder} type="number" min="0" onChange={event => setEditingForm(current => current ? { ...current, sortOrder: event.target.value } : current)} />
              </label>
            </div>
            <div className="modal-actions">
              <button className="ghost-button" type="button" onClick={() => setEditingForm(null)}>取消</button>
              <button className="primary-button" type="submit">
                <Icon name="save" />
                保存自提点
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function MallGroupLeadersSection({
  filters,
  leaders,
  pickupPoints,
  onDelete,
  onFiltersChange,
  onSave,
  onSearch,
  onStatus,
}: {
  filters: GroupLeaderFilterState;
  leaders: JsonRecord[];
  pickupPoints: JsonRecord[];
  onDelete: (id: string) => Promise<void>;
  onFiltersChange: (patch: Partial<GroupLeaderFilterState>) => void;
  onSave: (form: GroupLeaderForm) => Promise<void>;
  onSearch: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onStatus: (id: string, status: string) => Promise<void>;
}) {
  const [editingForm, setEditingForm] = useState<GroupLeaderForm | null>(null);
  const activeCount = leaders.filter(leader => stringValue(leader, 'status') === 'active').length;
  const boundPickupCount = new Set(leaders.map(leader => stringValue(leader, 'pickupPointId')).filter(Boolean)).size;
  const phoneReadyCount = leaders.filter(leader => stringValue(leader, 'phone', recordLeaderPhone(leader))).length;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingForm) return;
    await onSave(editingForm);
    setEditingForm(null);
  };

  const openCreate = () => setEditingForm({
    ...initialGroupLeaderForm,
    pickupPointId: stringValue(pickupPoints[0], 'id'),
  });

  return (
    <div className="page-grid pickup-leader-admin-page">
      <div className="stat-grid compact">
        <StatCard label="团长" value={String(leaders.length)} detail="已建档团长" />
        <StatCard label="启用中" value={String(activeCount)} detail="可进入团长中心" />
        <StatCard label="绑定自提点" value={String(boundPickupCount)} detail="核销权限范围" />
        <StatCard label="联系方式" value={String(phoneReadyCount)} detail="可联系团长" />
      </div>

      <Panel
        title="团长管理"
        description="维护团长账号、绑定自提点和服务说明；绑定后团长可在小程序团长中心查看订单并核销取货"
        action={(
          <button className="primary-button" type="button" onClick={openCreate}>
            <Icon name="plus" />
            新增团长
          </button>
        )}
      >
        <form className="admin-filterbar pickup-admin-filterbar" onSubmit={event => void onSearch(event)}>
          <input
            value={filters.keyword}
            placeholder="搜索团长姓名、手机号、自提点"
            onChange={event => onFiltersChange({ keyword: event.target.value })}
          />
          <select value={filters.pickupPointId} onChange={event => onFiltersChange({ pickupPointId: event.target.value })}>
            <option value="">全部自提点</option>
            {pickupPoints.map(point => (
              <option key={stringValue(point, 'id')} value={stringValue(point, 'id')}>
                {stringValue(point, 'name', recordPickupPointName(point))}
              </option>
            ))}
          </select>
          <select value={filters.status} onChange={event => onFiltersChange({ status: event.target.value })}>
            <option value="">全部状态</option>
            <option value="active">启用</option>
            <option value="inactive">停用</option>
          </select>
          <button className="primary-button" type="submit">
            <Icon name="users" />
            搜索
          </button>
          <button className="ghost-button" type="button" onClick={() => onFiltersChange(initialGroupLeaderFilters)}>
            <Icon name="refresh" />
            重置
          </button>
        </form>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>团长</th>
                <th>绑定自提点</th>
                <th>小区/地址</th>
                <th>服务说明</th>
                <th>状态</th>
                <th>更新时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {leaders.map(leader => {
                const id = stringValue(leader, 'id');
                const status = stringValue(leader, 'status', 'active');
                return (
                  <tr key={id}>
                    <td>
                      <strong>{stringValue(leader, 'name', recordLeaderName(leader))}</strong>
                      <small>{stringValue(leader, 'phone', recordLeaderPhone(leader)) || '-'}</small>
                    </td>
                    <td>
                      <span>{stringValue(leader, 'pickupPointName', '-')}</span>
                      <small>{shortId(stringValue(leader, 'pickupPointId'))}</small>
                    </td>
                    <td>
                      <span>{recordCommunityName(leader) || '-'}</span>
                      <small>{stringValue(leader, 'pickupPointAddress', '-')}</small>
                    </td>
                    <td>{stringValue(leader, 'serviceNote', '-')}</td>
                    <td><span className={badgeClass(status)}>{statusLabel(status)}</span></td>
                    <td>{formatDate(stringValue(leader, 'updatedAt', stringValue(leader, 'createdAt')))}</td>
                    <td className="actions column-actions">
                      <button className="ghost-button" type="button" onClick={() => setEditingForm(groupLeaderToForm(leader))}>
                        <Icon name="save" />
                        编辑
                      </button>
                      <button className="ghost-button" type="button" onClick={() => void onStatus(id, status === 'active' ? 'inactive' : 'active')}>
                        <Icon name={status === 'active' ? 'x' : 'check'} />
                        {status === 'active' ? '停用' : '启用'}
                      </button>
                      <button className="ghost-button danger" type="button" onClick={() => void onDelete(id)}>
                        <Icon name="x" />
                        删除
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!leaders.length ? <EmptyState text="暂无团长数据" /> : null}
      </Panel>

      {editingForm ? (
        <div className="modal-backdrop">
          <form className="modal-panel" onSubmit={submit}>
            <div className="modal-title-row">
              <div>
                <h2>{editingForm.id ? '编辑团长' : '新增团长'}</h2>
                <p>必填项：绑定自提点、团长姓名、状态。手机号用于联系和匹配小程序团长身份。</p>
              </div>
              <button className="ghost-button icon-only" type="button" onClick={() => setEditingForm(null)}>
                <Icon name="x" />
              </button>
            </div>
            <div className="form-grid">
              <label>
                <span className="field-label">绑定自提点<span className="required-mark">*</span></span>
                <select required value={editingForm.pickupPointId} onChange={event => setEditingForm(current => current ? { ...current, pickupPointId: event.target.value } : current)}>
                  <option value="">请选择自提点</option>
                  {pickupPoints.map(point => (
                    <option key={stringValue(point, 'id')} value={stringValue(point, 'id')}>
                      {stringValue(point, 'name', recordPickupPointName(point))}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                状态
                <select required value={editingForm.status} onChange={event => setEditingForm(current => current ? { ...current, status: event.target.value } : current)}>
                  <option value="active">启用</option>
                  <option value="inactive">停用</option>
                </select>
              </label>
              <label>
                <span className="field-label">团长姓名<span className="required-mark">*</span></span>
                <input required value={editingForm.name} onChange={event => setEditingForm(current => current ? { ...current, name: event.target.value } : current)} />
              </label>
              <label>
                团长手机号
                <input value={editingForm.phone} onChange={event => setEditingForm(current => current ? { ...current, phone: event.target.value } : current)} />
              </label>
              <label>
                关联用户ID（可选）
                <input value={editingForm.userId} onChange={event => setEditingForm(current => current ? { ...current, userId: event.target.value } : current)} />
              </label>
              <label className="wide">
                服务说明
                <textarea value={editingForm.serviceNote} onChange={event => setEditingForm(current => current ? { ...current, serviceNote: event.target.value } : current)} placeholder="例如 负责晚间自提、坏果登记和取货核销" />
              </label>
            </div>
            <div className="modal-actions">
              <button className="ghost-button" type="button" onClick={() => setEditingForm(null)}>取消</button>
              <button className="primary-button" type="submit">
                <Icon name="save" />
                保存团长
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function MallFinanceOpsSection({
  mode,
  bills,
  filters,
  settlements,
  withdrawalForm,
  withdrawals,
  onCreateWithdrawal,
  onFiltersChange,
  onSearch,
  onWithdrawalChange,
}: {
  mode: MallFinanceOpsMode;
  bills: JsonRecord[];
  filters: MallOpsFilterState;
  settlements: JsonRecord[];
  withdrawalForm: WithdrawalForm;
  withdrawals: JsonRecord[];
  onCreateWithdrawal: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onFiltersChange: (patch: Partial<MallOpsFilterState>) => void;
  onSearch: () => Promise<void>;
  onWithdrawalChange: (patch: Partial<WithdrawalForm>) => void;
}) {
  const records = mode === 'bills' ? bills : mode === 'settlements' ? settlements : withdrawals;
  const visibleRecords = filterMallOpsRecords(
    records,
    filters,
    ['id', 'billNo', 'settlementNo', 'requestNo', 'periodType', 'supplierName', 'status', 'note'],
    ['billDate', 'periodStart', 'periodEnd', 'createdAt', 'paidAt'],
  );
  const title = mode === 'bills' ? '账单明细' : mode === 'settlements' ? '结算记录' : '提现申请';
  const totalSettlementCents = visibleRecords.reduce((total, record) => total + numberValue(record, 'settlementAmountCents', numberValue(record, 'amountCents')), 0);

  return (
    <div className="page-grid ops-page">
      <MallOpsFilterbar
        filters={filters}
        placeholder="搜索账单号、结算号、备注"
        statusOptions={[
          ['pending', '待处理'],
          ['submitted', '已提交'],
          ['approved', '已通过'],
          ['paid', '已打款'],
          ['rejected', '已拒绝'],
        ]}
        onFiltersChange={onFiltersChange}
        onSearch={onSearch}
      />
      <div className="ops-summary-grid">
        <StatCard label={title} value={String(visibleRecords.length)} detail="当前筛选结果" />
        <StatCard label="实际结算" value={yuan(totalSettlementCents)} detail="按筛选记录合计" />
        <StatCard label="退款抵扣" value={yuan(visibleRecords.reduce((total, record) => total + numberValue(record, 'refundAmountCents'), 0))} detail="账单退款金额" />
      </div>

      {mode === 'withdrawals' ? (
        <Panel title="提交提现申请" description="填写提现金额并提交审核">
          <form className="ops-withdrawal-form" onSubmit={onCreateWithdrawal}>
            <label>
              提现金额
              <input value={withdrawalForm.amountYuan} type="number" min="0.01" step="0.01" onChange={event => onWithdrawalChange({ amountYuan: event.target.value })} />
            </label>
            <label>
              备注
              <input value={withdrawalForm.note} onChange={event => onWithdrawalChange({ note: event.target.value })} />
            </label>
            <button className="primary-button" type="submit" disabled={moneyFromYuan(withdrawalForm.amountYuan) <= 0}>
              <Icon name="send" />
              提交申请
            </button>
          </form>
        </Panel>
      ) : null}

      <Panel title={title} description="查看账单、结算和打款凭证状态">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>编号</th>
                <th>周期</th>
                <th>供货金额</th>
                <th>退款金额</th>
                <th>实际结算</th>
                <th>状态</th>
                <th>凭证</th>
              </tr>
            </thead>
            <tbody>
              {visibleRecords.map(record => {
                const id = stringValue(record, 'id');
                const voucherUrl = stringValue(record, 'voucherUrl', stringValue(record, 'paymentVoucherUrl'));
                return (
                  <tr key={id}>
                    <td>
                      <strong>{stringValue(record, 'billNo', stringValue(record, 'settlementNo', stringValue(record, 'requestNo', shortId(id))))}</strong>
                      <small>{stringValue(record, 'periodType', stringValue(record, 'requesterRole', 'platform'))}</small>
                    </td>
                    <td>
                      <span>{stringValue(record, 'periodStart', stringValue(record, 'billDate', '-'))}</span>
                      <small>{stringValue(record, 'periodEnd', formatDate(stringValue(record, 'createdAt')))}</small>
                    </td>
                    <td>{yuan(numberValue(record, 'supplyAmountCents'))}</td>
                    <td>{yuan(numberValue(record, 'refundAmountCents'))}</td>
                    <td><strong>{yuan(numberValue(record, 'settlementAmountCents', numberValue(record, 'amountCents')))}</strong></td>
                    <td><span className={badgeClass(stringValue(record, 'status'))}>{statusLabel(stringValue(record, 'status'))}</span></td>
                    <td>{voucherUrl ? <a href={resolveImage(voucherUrl)} target="_blank" rel="noreferrer">查看凭证</a> : '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!visibleRecords.length ? <EmptyState text={`暂无${title}`} /> : null}
      </Panel>
    </div>
  );
}

function MallStatsOpsSection({
  mode,
  orders,
  stats,
  filters,
  onFiltersChange,
  onSearch,
}: {
  mode: MallStatsOpsMode;
  orders: JsonRecord[];
  stats: JsonRecord;
  filters: MallOpsFilterState;
  onFiltersChange: (patch: Partial<MallOpsFilterState>) => void;
  onSearch: () => Promise<void>;
}) {
  const productRows = buildProductSalesRows(stats, orders);
  const categoryRows = buildCategorySalesRows(stats, orders);
  const revenueRows = buildRevenueRows(stats, orders);
  const hotRows = productRows.slice(0, 10);
  const title = mode === 'sales' ? '销量统计' : mode === 'revenue' ? '收益统计' : '热销商品排行';

  return (
    <div className="page-grid ops-page">
      <MallOpsFilterbar
        filters={filters}
        placeholder="搜索商品、分类、日期"
        statusOptions={[
          ['paid', '已支付'],
          ['completed', '已完成'],
          ['refunding', '退款中'],
        ]}
        onFiltersChange={onFiltersChange}
        onSearch={onSearch}
      />
      {mode === 'sales' ? (
        <div className="ops-split-grid">
          <Panel title="按商品销量" description="商品维度销量、销售额和分类贡献">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>商品</th>
                    <th>分类</th>
                    <th>销量</th>
                    <th>销售额</th>
                  </tr>
                </thead>
                <tbody>
                  {productRows.map(row => (
                    <tr key={stringValue(row, 'id', stringValue(row, 'productName'))}>
                      <td><strong>{stringValue(row, 'productName', stringValue(row, 'name'))}</strong></td>
                      <td>{stringValue(row, 'categoryName', stringValue(row, 'categoryCode'))}</td>
                      <td>{numberValue(row, 'quantity', numberValue(row, 'salesCount'))}</td>
                      <td>{yuan(numberValue(row, 'revenueCents', numberValue(row, 'amountCents')))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!productRows.length ? <EmptyState text="暂无商品销量" /> : null}
          </Panel>
          <Panel title="按分类销量" description="分类维度销售结构">
            <div className="ops-rank-list">
              {categoryRows.map(row => (
                <article className="ops-rank-row" key={stringValue(row, 'id', stringValue(row, 'categoryName'))}>
                  <div>
                    <strong>{stringValue(row, 'categoryName', stringValue(row, 'categoryCode'))}</strong>
                    <small>{numberValue(row, 'quantity', numberValue(row, 'salesCount'))} 件</small>
                  </div>
                  <span>{yuan(numberValue(row, 'revenueCents', numberValue(row, 'amountCents')))}</span>
                </article>
              ))}
              {!categoryRows.length ? <EmptyState text="暂无分类销量" /> : null}
            </div>
          </Panel>
        </div>
      ) : null}

      {mode === 'revenue' ? (
        <Panel title={title} description="按时间查看收益变化">
          <div className="ops-revenue-bars">
            {revenueRows.map(row => {
              const revenue = numberValue(row, 'revenueCents', numberValue(row, 'amountCents'));
              const maxRevenue = Math.max(...revenueRows.map(item => numberValue(item, 'revenueCents', numberValue(item, 'amountCents'))), 1);
              return (
                <article className="ops-revenue-row" key={stringValue(row, 'key', stringValue(row, 'date', stringValue(row, 'label')))}>
                  <span>{stringValue(row, 'label', stringValue(row, 'date', stringValue(row, 'key')))}</span>
                  <div><i style={{ width: `${percentValue(revenue, maxRevenue)}%` }} /></div>
                  <strong>{yuan(revenue)}</strong>
                  <small>{numberValue(row, 'orders', numberValue(row, 'orderCount'))} 单</small>
                </article>
              );
            })}
          </div>
        </Panel>
      ) : null}

      {mode === 'hot' ? (
        <Panel title={title} description="平台销量 TOP10 自动更新">
          <div className="ops-rank-list">
            {hotRows.map((row, index) => (
              <article className="ops-rank-row hot" key={stringValue(row, 'id', stringValue(row, 'productName'))}>
                <em>{index + 1}</em>
                <div>
                  <strong>{stringValue(row, 'productName', stringValue(row, 'name'))}</strong>
                  <small>{stringValue(row, 'categoryName', stringValue(row, 'categoryCode'))} · {numberValue(row, 'quantity', numberValue(row, 'salesCount'))} 件</small>
                </div>
                <span>{yuan(numberValue(row, 'revenueCents', numberValue(row, 'amountCents')))}</span>
              </article>
            ))}
            {!hotRows.length ? <EmptyState text="暂无热销商品" /> : null}
          </div>
        </Panel>
      ) : null}
    </div>
  );
}

function MallCouponCenterSection({
  coupons,
  filters,
  form,
  onChange,
  onDelete,
  onEdit,
  onFiltersChange,
  onReset,
  onSearch,
  onStatus,
  onSubmit,
}: {
  coupons: JsonRecord[];
  filters: MallFilterState;
  form: CouponForm;
  onChange: (patch: Partial<CouponForm>) => void;
  onDelete: (id: string) => Promise<void>;
  onEdit: (coupon: JsonRecord) => void;
  onFiltersChange: (patch: Partial<MallFilterState>) => void;
  onReset: () => void;
  onSearch: () => Promise<void>;
  onStatus: (id: string, status: string) => Promise<void>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const openCreate = () => {
    onReset();
    setModalOpen(true);
  };
  const openEdit = (coupon: JsonRecord) => {
    onEdit(coupon);
    setModalOpen(true);
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    await onSubmit(event);
    setModalOpen(false);
  };

  return (
    <div className="page-grid">
      <div className="admin-filterbar marketing-filterbar">
        <input value={filters.keyword} onChange={event => onFiltersChange({ keyword: event.target.value })} placeholder="搜索券名或券码" />
        <select value={filters.categoryCode} onChange={event => onFiltersChange({ categoryCode: event.target.value })}>
          <option value="">全部类型</option>
          <option value="full_reduction">满减券</option>
          <option value="cash">现金券</option>
          <option value="delivery">配送券</option>
          <option value="new_user">新人券</option>
        </select>
        <select value={filters.status} onChange={event => onFiltersChange({ status: event.target.value })}>
          <option value="">全部状态</option>
          <option value="active">启用</option>
          <option value="draft">草稿</option>
          <option value="inactive">停用</option>
          <option value="expired">过期</option>
        </select>
        <button className="primary-button" type="button" onClick={() => void onSearch()}>
          <Icon name="refresh" />
          搜索
        </button>
        <button className="primary-button" type="button" onClick={openCreate}>
          <Icon name="plus" />
          创建券
        </button>
      </div>

      <Panel title="券中心" description="统一维护优惠券创建、编辑、发放量、核销状态和启停">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>优惠券</th>
                <th>规则</th>
                <th>发放/领取/核销</th>
                <th>有效期</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {coupons.map(coupon => {
                const id = stringValue(coupon, 'id');
                const status = stringValue(coupon, 'status');
                return (
                  <tr key={id}>
                    <td>
                      <strong>{stringValue(coupon, 'name')}</strong>
                      <small>{stringValue(coupon, 'code')} · {couponTypeLabel(stringValue(coupon, 'couponType'))}</small>
                    </td>
                    <td>
                      <span>满 {yuan(numberValue(coupon, 'thresholdCents'))} 减 {yuan(numberValue(coupon, 'discountCents'))}</span>
                      <small>{stringValue(coupon, 'description', '-')}</small>
                    </td>
                    <td>
                      <span>{numberValue(coupon, 'totalQuantity')} / {numberValue(coupon, 'claimedCount')} / {numberValue(coupon, 'usedCount')}</span>
                      <small>每人限领 {numberValue(coupon, 'perUserLimit', 1)} 张</small>
                    </td>
                    <td>
                      <span>{formatDate(stringValue(coupon, 'startsAt'))}</span>
                      <small>{formatDate(stringValue(coupon, 'endsAt'))}</small>
                    </td>
                    <td>
                      <span className={badgeClass(status)}>{statusLabel(status)}</span>
                    </td>
                    <td className="actions">
                      <button className="ghost-button" type="button" onClick={() => openEdit(coupon)}>
                        <Icon name="save" />
                        编辑
                      </button>
                      <button className="ghost-button" type="button" onClick={() => void onStatus(id, status === 'active' ? 'inactive' : 'active')}>
                        <Icon name={status === 'active' ? 'x' : 'check'} />
                        {status === 'active' ? '停用' : '启用'}
                      </button>
                      <button className="ghost-button danger" type="button" onClick={() => void onDelete(id)}>
                        <Icon name="x" />
                        删除
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!coupons.length ? <EmptyState text="暂无优惠券数据" /> : null}
      </Panel>

      {modalOpen ? (
        <div className="modal-backdrop">
          <form className="modal-panel" onSubmit={submit}>
            <div className="modal-title-row">
              <div>
                <h2>{form.id ? '编辑券' : '新建券'}</h2>
              </div>
              <button className="ghost-button" type="button" onClick={() => setModalOpen(false)}>
                <Icon name="x" />
                关闭
              </button>
            </div>
            <div className="form-grid coupon-form">
              <label>
                优惠券名称
                <input value={form.name} onChange={event => onChange({ name: event.target.value })} />
              </label>
              <label>
                券码
                <input value={form.code} onChange={event => onChange({ code: event.target.value })} />
              </label>
              <label>
                类型
                <select value={form.couponType} onChange={event => onChange({ couponType: event.target.value })}>
                  <option value="full_reduction">满减券</option>
                  <option value="cash">现金券</option>
                  <option value="delivery">配送券</option>
                  <option value="new_user">新人券</option>
                </select>
              </label>
              <label>
                状态
                <select value={form.status} onChange={event => onChange({ status: event.target.value })}>
                  <option value="active">启用</option>
                  <option value="draft">草稿</option>
                  <option value="inactive">停用</option>
                  <option value="expired">过期</option>
                </select>
              </label>
              <label>
                使用门槛
                <input value={form.thresholdYuan} type="number" min="0" step="0.01" onChange={event => onChange({ thresholdYuan: event.target.value })} />
              </label>
              <label>
                优惠金额
                <input value={form.discountYuan} type="number" min="0.01" step="0.01" onChange={event => onChange({ discountYuan: event.target.value })} />
              </label>
              <label>
                发放数量
                <input value={form.totalQuantity} type="number" min="0" onChange={event => onChange({ totalQuantity: event.target.value })} />
              </label>
              <label>
                每人限领
                <input value={form.perUserLimit} type="number" min="1" onChange={event => onChange({ perUserLimit: event.target.value })} />
              </label>
              <label>
                开始时间
                <input value={form.startsAt} type="datetime-local" onChange={event => onChange({ startsAt: event.target.value })} />
              </label>
              <label>
                结束时间
                <input value={form.endsAt} type="datetime-local" onChange={event => onChange({ endsAt: event.target.value })} />
              </label>
              <label className="wide">
                说明
                <textarea value={form.description} onChange={event => onChange({ description: event.target.value })} />
              </label>
            </div>
            <div className="modal-actions">
              <button className="ghost-button" type="button" onClick={() => setModalOpen(false)}>取消</button>
              <button className="primary-button" type="submit">
                <Icon name="save" />
                {form.id ? '保存券' : '创建券'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function HomePreviewShell({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop">
      <section className="modal-panel home-preview-modal">
        <div className="modal-title-row">
          <div>
            <h2>{title}</h2>
          </div>
          <button className="ghost-button" type="button" onClick={onClose}>
            <Icon name="x" />
            关闭
          </button>
        </div>
        <div className="home-phone-preview">
          {children}
        </div>
      </section>
    </div>
  );
}

function HomeBannerPreview({ banner }: { banner: HomeBannerForm }) {
  const imageUrl = resolveImage(banner.imageUrl);
  return (
    <div className="home-preview-banner" style={imageUrl ? { backgroundImage: `url(${imageUrl})` } : undefined}>
      <span>{banner.tag || '叁友甄选'}</span>
      <strong>{banner.title || '未填写标题'}</strong>
      <small>{banner.subtitle || '未填写副标题'}</small>
      <em>{linkTypeLabel(banner.linkType)} · {banner.linkTarget || '无跳转目标'}</em>
    </div>
  );
}

function HomeSectionPreview({
  section,
  products,
}: {
  section: HomeSectionForm;
  products: JsonRecord[];
}) {
  const productIds = section.productIds
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
  const selectedProducts = productIds
    .map(productId => products.find(product => stringValue(product, 'id') === productId || stringValue(product, 'sku') === productId))
    .filter((product): product is JsonRecord => Boolean(product));
  const previewProducts = (selectedProducts.length ? selectedProducts : products).slice(0, section.sectionType === 'best_seller' ? 4 : 3);
  const imageUrl = resolveImage(section.imageUrl);

  if (section.sectionType === 'announcement') {
    return (
      <div className="home-preview-section">
        <div className="home-preview-notice">
          <span>公告</span>
          <strong>{section.title || '公告栏配置'}</strong>
          <small>{section.content || section.subtitle || '暂无公告内容'}</small>
        </div>
      </div>
    );
  }

  return (
    <div className={`home-preview-section home-preview-${section.sectionType}`}>
      {imageUrl ? <div className="home-preview-section-image" style={{ backgroundImage: `url(${imageUrl})` }} /> : null}
      <div className="home-preview-section-head">
        <div>
          <strong>{section.title || homeSectionTypeLabel(section.sectionType)}</strong>
          <small>{section.subtitle || section.content || '-'}</small>
        </div>
        <span>{section.content || (section.sectionType === 'flash_sale' ? '限时抢' : '查看')}</span>
      </div>
      <div className="home-preview-products">
        {previewProducts.map((product, index) => (
          <article key={stringValue(product, 'id', String(index))}>
            <ProductImage record={product} />
            <strong>{stringValue(product, 'name', `商品 ${index + 1}`)}</strong>
            <span>{yuan(numberValue(product, 'priceCents'))}</span>
          </article>
        ))}
        {!previewProducts.length ? <div className="home-preview-empty">暂无商品</div> : null}
      </div>
    </div>
  );
}

function CampaignDisplayPreview({ display }: { display: CampaignDisplayConfig }) {
  const iconUrl = display.iconUrl.trim();
  const tagTooLong = display.tagText.trim().length > 8;
  return (
    <div className="wide campaign-display-preview">
      <div>
        <span>商品列表 tag 预览</span>
        <strong
          className="campaign-display-tag"
          style={{ background: display.backgroundColor, color: display.textColor }}
        >
          {iconUrl ? <img alt="" src={resolveImage(iconUrl)} /> : display.iconText ? <i>{display.iconText}</i> : null}
          {display.tagText || '优惠'}
        </strong>
        {tagTooLong ? <small className="campaign-display-warning">tag 文案偏长，商品卡会优先展示前 2-3 个活动</small> : null}
      </div>
      <div className="campaign-display-detail">
        <span>商品详情优惠活动预览</span>
        <b>{display.title || '优惠活动'}</b>
        <p>{display.ruleExplanation || '活动规则解释将展示在这里。'}</p>
        <small>{display.limitText || '使用限制未填写时前台不展示该行。'}</small>
      </div>
    </div>
  );
}

function MallHomeBannersSection({
  banners,
  filters,
  form,
  onChange,
  onEdit,
  onFiltersChange,
  onReset,
  onSearch,
  onStatus,
  onSubmit,
  onUploadImage,
}: {
  banners: JsonRecord[];
  filters: MallFilterState;
  form: HomeBannerForm;
  onChange: (patch: Partial<HomeBannerForm>) => void;
  onEdit: (banner: JsonRecord) => void;
  onFiltersChange: (patch: Partial<MallFilterState>) => void;
  onReset: () => void;
  onSearch: () => Promise<void>;
  onStatus: (id: string, status: string) => Promise<void>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onUploadImage: (file: File) => Promise<string>;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [preview, setPreview] = useState<HomeBannerForm | null>(null);
  const openCreate = () => {
    onReset();
    setModalOpen(true);
  };
  const openEdit = (banner: JsonRecord) => {
    onEdit(banner);
    setModalOpen(true);
  };
  const closeModal = () => {
    onReset();
    setModalOpen(false);
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    await onSubmit(event);
    setModalOpen(false);
  };

  return (
    <div className="page-grid">
      <Panel title="首页配置列表" description="运营位按排序升序展示，启用后供商城首页读取">
        <div className="admin-filterbar marketing-filterbar compact">
          <input value={filters.keyword} onChange={event => onFiltersChange({ keyword: event.target.value })} placeholder="搜索标题或副标题" />
          <select value={filters.status} onChange={event => onFiltersChange({ status: event.target.value })}>
            <option value="">全部状态</option>
            <option value="active">启用</option>
            <option value="draft">草稿</option>
            <option value="inactive">停用</option>
          </select>
          <button className="primary-button" type="button" onClick={() => void onSearch()}>
            <Icon name="refresh" />
            搜索
          </button>
          <button className="primary-button" type="button" onClick={openCreate}>
            <Icon name="plus" />
            新增首页配置
          </button>
        </div>
        <div className="list-stack">
          {banners.map(banner => {
            const id = stringValue(banner, 'id');
            const status = stringValue(banner, 'status');
            return (
              <article className="list-row banner-row" key={id}>
                <div>
                  <strong>{numberValue(banner, 'sortOrder')} · {stringValue(banner, 'title')}</strong>
                  <small>{stringValue(banner, 'subtitle', '-')}</small>
                  <small>{linkTypeLabel(stringValue(banner, 'linkType'))} · {stringValue(banner, 'linkTarget', '-')}</small>
                </div>
                <span className={badgeClass(status)}>{statusLabel(status)}</span>
                <div className="actions">
                  <button className="ghost-button" type="button" onClick={() => setPreview(homeBannerToForm(banner))}>
                    <Icon name="dashboard" />
                    预览
                  </button>
                  <button className="ghost-button" type="button" onClick={() => openEdit(banner)}>
                    <Icon name="save" />
                    编辑
                  </button>
                  <button className="ghost-button" type="button" onClick={() => onStatus(id, status === 'active' ? 'inactive' : 'active')}>
                    <Icon name={status === 'active' ? 'x' : 'check'} />
                    {status === 'active' ? '停用' : '启用'}
                  </button>
                </div>
              </article>
            );
          })}
          {!banners.length ? <EmptyState text="暂无首页配置" /> : null}
        </div>
      </Panel>

      {modalOpen ? (
        <div className="modal-backdrop">
          <form className="modal-panel" onSubmit={submit}>
            <div className="modal-title-row">
              <div>
                <h2>{form.id ? '编辑首页配置' : '新增首页配置'}</h2>
              </div>
              <button className="ghost-button" type="button" onClick={closeModal}>
                <Icon name="x" />
                关闭
              </button>
            </div>
            <div className="form-grid">
              <label>
                标题
                <input value={form.title} onChange={event => onChange({ title: event.target.value })} />
              </label>
              <label>
                标签
                <input value={form.tag} onChange={event => onChange({ tag: event.target.value })} />
              </label>
              <label className="wide">
                副标题
                <input value={form.subtitle} onChange={event => onChange({ subtitle: event.target.value })} />
              </label>
              <label className="wide">
                图片
                <input value={form.imageUrl} placeholder="可粘贴图片地址或上传图片" onChange={event => onChange({ imageUrl: event.target.value })} />
                <input
                  accept="image/*"
                  type="file"
                  onChange={event => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    void onUploadImage(file).then(imageUrl => onChange({ imageUrl }));
                    event.target.value = '';
                  }}
                />
              </label>
              <label>
                跳转类型
                <select value={form.linkType} onChange={event => onChange({ linkType: event.target.value })}>
                  <option value="none">不跳转</option>
                  <option value="category">品类</option>
                  <option value="product">商品</option>
                  <option value="search">搜索</option>
                  <option value="activity">活动</option>
                  <option value="url">链接</option>
                </select>
              </label>
              <label>
                跳转目标
                <input value={form.linkTarget} onChange={event => onChange({ linkTarget: event.target.value })} />
              </label>
              <label>
                排序
                <input value={form.sortOrder} type="number" onChange={event => onChange({ sortOrder: event.target.value })} />
              </label>
              <label>
                状态
                <select value={form.status} onChange={event => onChange({ status: event.target.value })}>
                  <option value="active">启用</option>
                  <option value="draft">草稿</option>
                  <option value="inactive">停用</option>
                </select>
              </label>
              <label>
                开始时间
                <input value={form.startsAt} type="datetime-local" onChange={event => onChange({ startsAt: event.target.value })} />
              </label>
              <label>
                结束时间
                <input value={form.endsAt} type="datetime-local" onChange={event => onChange({ endsAt: event.target.value })} />
              </label>
            </div>
            <div className="modal-actions">
              <button className="ghost-button" type="button" onClick={closeModal}>取消</button>
              <button className="ghost-button" type="button" onClick={() => setPreview({ ...form })}>
                <Icon name="dashboard" />
                预览
              </button>
              <button className="primary-button" type="submit">
                <Icon name="save" />
                {form.id ? '保存配置' : '创建配置'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
      {preview ? (
        <HomePreviewShell title="首页轮播预览" onClose={() => setPreview(null)}>
          <HomeBannerPreview banner={preview} />
        </HomePreviewShell>
      ) : null}
    </div>
  );
}

function MallHomeSectionsSection({
  description,
  form,
  products,
  sectionType,
  sections,
  title,
  onChange,
  onDelete,
  onEdit,
  onReset,
  onStatus,
  onSubmit,
  onUploadImage,
}: {
  description: string;
  form: HomeSectionForm;
  products: JsonRecord[];
  sectionType: string;
  sections: JsonRecord[];
  title: string;
  onChange: (patch: Partial<HomeSectionForm>) => void;
  onDelete: (id: string) => Promise<void>;
  onEdit: (section: JsonRecord) => void;
  onReset: () => void;
  onStatus: (id: string, status: string) => Promise<void>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onUploadImage: (file: File) => Promise<string>;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [preview, setPreview] = useState<HomeSectionForm | null>(null);
  const visibleSections = sections
    .filter(section => stringValue(section, 'sectionType') === sectionType)
    .sort((a, b) => numberValue(a, 'sortOrder') - numberValue(b, 'sortOrder'));
  const isAnnouncement = sectionType === 'announcement';
  const openCreate = () => {
    onReset();
    setModalOpen(true);
  };
  const openEdit = (section: JsonRecord) => {
    onEdit(section);
    setModalOpen(true);
  };
  const closeModal = () => {
    onReset();
    setModalOpen(false);
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    await onSubmit(event);
    setModalOpen(false);
  };

  return (
    <div className="page-grid">
      <Panel title={`${title}列表`} description={description}>
        <div className="admin-filterbar marketing-filterbar compact">
          <button className="primary-button" type="button" onClick={openCreate}>
            <Icon name="plus" />
            {`新增${title}`}
          </button>
        </div>
        <div className="list-stack">
          {visibleSections.map(section => {
            const id = stringValue(section, 'id');
            const status = stringValue(section, 'status');
            const productIds = arrayValue(section, 'productIds').map(item => String(item));
            const productNames = productIds
              .map(productId => products.find(product => stringValue(product, 'id') === productId || stringValue(product, 'sku') === productId))
              .filter((product): product is JsonRecord => Boolean(product))
              .map(product => stringValue(product, 'name'))
              .join(' / ');
            return (
              <article className="list-row banner-row" key={id}>
                <div>
                  <strong>{numberValue(section, 'sortOrder')} · {stringValue(section, 'title')}</strong>
                  <small>{stringValue(section, 'content', stringValue(section, 'subtitle', '-'))}</small>
                  <small>
                    {homeSectionTypeLabel(stringValue(section, 'sectionType'))}
                    {productNames ? ` · ${productNames}` : ''}
                  </small>
                </div>
                <span className={badgeClass(status)}>{statusLabel(status)}</span>
                <div className="actions">
                  <button className="ghost-button" type="button" onClick={() => setPreview(homeSectionToForm(section))}>
                    <Icon name="dashboard" />
                    预览
                  </button>
                  <button className="ghost-button" type="button" onClick={() => openEdit(section)}>
                    <Icon name="save" />
                    编辑
                  </button>
                  <button className="ghost-button" type="button" onClick={() => void onStatus(id, status === 'active' ? 'inactive' : 'active')}>
                    <Icon name={status === 'active' ? 'x' : 'check'} />
                    {status === 'active' ? '停用' : '启用'}
                  </button>
                  <button className="ghost-button danger" type="button" onClick={() => void onDelete(id)}>
                    <Icon name="x" />
                    删除
                  </button>
                </div>
              </article>
            );
          })}
          {!visibleSections.length ? <EmptyState text={`暂无${title}配置`} /> : null}
        </div>
      </Panel>

      {modalOpen ? (
        <div className="modal-backdrop">
          <form className="modal-panel" onSubmit={submit}>
            <div className="modal-title-row">
              <div>
                <h2>{form.id ? `编辑${title}` : `新增${title}`}</h2>
              </div>
              <button className="ghost-button" type="button" onClick={closeModal}>
                <Icon name="x" />
                关闭
              </button>
            </div>
            <div className="form-grid">
              <label>
                标题
                <input value={form.title} onChange={event => onChange({ title: event.target.value })} />
              </label>
              <label>
                状态
                <select value={form.status} onChange={event => onChange({ status: event.target.value })}>
                  <option value="active">启用</option>
                  <option value="draft">草稿</option>
                  <option value="inactive">停用</option>
                </select>
              </label>
              <label className="wide">
                副标题
                <input value={form.subtitle} placeholder={isAnnouncement ? '可不填' : '例：早 8 点 / 晚 6 点，每日两场'} onChange={event => onChange({ subtitle: event.target.value })} />
              </label>
              <label className="wide">
                {isAnnouncement ? '公告内容' : '角标/行动文案'}
                <textarea value={form.content} placeholder={isAnnouncement ? '例：草莓、鲜奶、鸡蛋 16:00 后可提' : '例：今日刚到 / TOP10'} onChange={event => onChange({ content: event.target.value })} />
              </label>
              <label>
                跳转类型
                <select value={form.linkType} onChange={event => onChange({ linkType: event.target.value })}>
                  <option value="none">不跳转</option>
                  <option value="category">品类</option>
                  <option value="product">商品</option>
                  <option value="search">搜索</option>
                  <option value="activity">活动</option>
                  <option value="url">链接</option>
                </select>
              </label>
              <label>
                跳转目标
                <input value={form.linkTarget} onChange={event => onChange({ linkTarget: event.target.value })} />
              </label>
              {!isAnnouncement ? (
                <label className="wide">
                  商品编号
                  <input value={form.productIds} placeholder="按展示顺序填写，英文逗号分隔；为空则按规则自动选品" onChange={event => onChange({ productIds: event.target.value })} />
                </label>
              ) : null}
              <label className="wide">
                图片
                <input value={form.imageUrl} placeholder="可粘贴图片地址或上传图片" onChange={event => onChange({ imageUrl: event.target.value })} />
                <input
                  accept="image/*"
                  type="file"
                  onChange={event => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    void onUploadImage(file).then(imageUrl => onChange({ imageUrl }));
                    event.target.value = '';
                  }}
                />
              </label>
              <label>
                排序
                <input value={form.sortOrder} type="number" onChange={event => onChange({ sortOrder: event.target.value })} />
              </label>
              <label>
                开始时间
                <input value={form.startsAt} type="datetime-local" onChange={event => onChange({ startsAt: event.target.value })} />
              </label>
              <label>
                结束时间
                <input value={form.endsAt} type="datetime-local" onChange={event => onChange({ endsAt: event.target.value })} />
              </label>
              {!isAnnouncement ? (
                <label className="wide">
                  展示规则
                  <textarea value={form.rules} onChange={event => onChange({ rules: event.target.value })} />
                </label>
              ) : null}
            </div>
            <div className="modal-actions">
              <button className="ghost-button" type="button" onClick={closeModal}>取消</button>
              <button className="ghost-button" type="button" onClick={() => setPreview({ ...form })}>
                <Icon name="dashboard" />
                预览
              </button>
              <button className="primary-button" type="submit">
                <Icon name="save" />
                {form.id ? '保存配置' : '创建配置'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
      {preview ? (
        <HomePreviewShell title={`${title}预览`} onClose={() => setPreview(null)}>
          <HomeSectionPreview products={products} section={preview} />
        </HomePreviewShell>
      ) : null}
    </div>
  );
}

const editableCampaignTypes = ['full_reduction', 'full_discount', 'free_delivery', 'delivery_reduction'];

function CampaignBusinessFields({
  form,
  onChange,
  onOpenFixedPriceCampaign,
  onOpenPromotionVenue,
  updateTier,
}: {
  form: CampaignForm;
  onChange: (patch: Partial<CampaignForm>) => void;
  onOpenFixedPriceCampaign: () => void;
  onOpenPromotionVenue: () => void;
  updateTier: (id: string, patch: Partial<CampaignTierForm>) => void;
}) {
  const campaignType = normalizeCampaignTypeForForm(form.campaignType);
  const tiers = form.tiers.length ? form.tiers : [createCampaignTierForm()];
  const firstTier = tiers[0];
  const updateFirstTier = (patch: Partial<CampaignTierForm>) => {
    onChange({ tiers: [{ ...firstTier, ...patch }] });
  };

  if (campaignType === 'fixed_price') {
    return (
      <section className="campaign-rule-card">
        <div className="campaign-rule-card-head">
          <strong>一口价活动</strong>
        </div>
        <p className="form-hint">进入一口价页面配置商品、商品组、角标和活动时间。</p>
        <button className="primary-button" type="button" onClick={onOpenFixedPriceCampaign}>
          <Icon name="megaphone" />
          进入一口价页面
        </button>
      </section>
    );
  }

  if (campaignType === 'promotion_venue') {
    return (
      <section className="campaign-rule-card">
        <div className="campaign-rule-card-head">
          <strong>大促会场</strong>
        </div>
        <p className="form-hint">进入大促会场页面配置会场入口、背景、文案和参与商品。</p>
        <button className="primary-button" type="button" onClick={onOpenPromotionVenue}>
          <Icon name="megaphone" />
          进入大促会场页面
        </button>
      </section>
    );
  }

  if (campaignType === 'free_delivery') {
    return (
      <section className="campaign-rule-card">
        <div className="campaign-rule-card-head">
          <strong>免运费规则</strong>
        </div>
        <div className="campaign-tier-list">
          <div className="campaign-tier-row">
            <label>
              包邮门槛
              <input
                min="0.01"
                required
                step="0.01"
                type="number"
                value={firstTier.thresholdYuan}
                onChange={event => updateFirstTier({ thresholdYuan: event.target.value })}
              />
            </label>
          </div>
        </div>
      </section>
    );
  }

  if (!editableCampaignTypes.includes(campaignType)) {
    return null;
  }

  const valueLabel = campaignType === 'full_discount'
    ? '折扣力度'
    : campaignType === 'delivery_reduction'
      ? '运费减免金额'
      : '满减金额';
  const title = campaignType === 'delivery_reduction'
    ? '运费减免规则'
    : campaignType === 'full_discount'
      ? '满折规则'
      : '满减规则';

  return (
    <section className="campaign-rule-card">
      <div className="campaign-rule-card-head">
        <strong>{title}</strong>
        <button className="ghost-button" type="button" onClick={() => onChange({ tiers: [...tiers, createCampaignTierForm()] })}>
          <Icon name="plus" />
          新增阶梯
        </button>
      </div>
      <div className="campaign-tier-list">
        {tiers.map((tier, index) => (
          <div className="campaign-tier-row" key={tier.id}>
            <span>阶梯 {index + 1}</span>
            <label>
              门槛金额
              <input min="0" required step="0.01" type="number" value={tier.thresholdYuan} onChange={event => updateTier(tier.id, { thresholdYuan: event.target.value })} />
            </label>
            {campaignType === 'full_discount' ? (
              <label>
                {valueLabel}
                <input min="1" max="100" required step="0.1" type="number" value={tier.discountPercent} onChange={event => updateTier(tier.id, { discountPercent: event.target.value })} />
              </label>
            ) : (
              <label>
                {valueLabel}
                <input min="0.01" required step="0.01" type="number" value={tier.discountYuan} onChange={event => updateTier(tier.id, { discountYuan: event.target.value })} />
              </label>
            )}
            <button
              className="ghost-button danger"
              disabled={tiers.length <= 1}
              type="button"
              onClick={() => onChange({ tiers: tiers.filter(item => item.id !== tier.id) })}
            >
              删除
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function MallCampaignsSection({
  campaigns,
  filters,
  form,
  products,
  onChange,
  onCampaignStatus,
  onDelete,
  onEdit,
  onFiltersChange,
  onOpenFixedPriceCampaign,
  onOpenPromotionVenue,
  onReset,
  onSearch,
  onSubmit,
}: {
  campaigns: JsonRecord[];
  filters: MallFilterState;
  form: CampaignForm;
  products: JsonRecord[];
  onChange: (patch: Partial<CampaignForm>) => void;
  onCampaignStatus: (id: string, status: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onEdit: (campaign: JsonRecord) => void;
  onFiltersChange: (patch: Partial<MallFilterState>) => void;
  onOpenFixedPriceCampaign: (campaign?: JsonRecord) => void;
  onOpenPromotionVenue: (campaign?: JsonRecord) => void;
  onReset: () => void;
  onSearch: () => Promise<void>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [productKeyword, setProductKeyword] = useState('');
  const visibleProducts = products
    .filter(product => {
      const keyword = productKeyword.trim().toLowerCase();
      if (!keyword) return true;
      return [
        stringValue(product, 'name'),
        stringValue(product, 'sku'),
        stringValue(product, 'categoryName'),
        stringValue(product, 'categoryCode'),
      ].some(value => value.toLowerCase().includes(keyword));
    })
    .slice(0, 100);
  const selectedProductIds = new Set(idListFromText(form.productIds));
  const openCreate = () => {
    onReset();
    setProductKeyword('');
    setModalOpen(true);
  };
  const openEdit = (campaign: JsonRecord) => {
    const campaignType = normalizeCampaignTypeForForm(stringValue(campaign, 'campaignType', stringValue(recordValue(campaign, 'rules'), 'activityType')));
    if (campaignType === 'fixed_price') {
      setModalOpen(false);
      onOpenFixedPriceCampaign(campaign);
      return;
    }
    if (campaignType === 'promotion_venue') {
      setModalOpen(false);
      onOpenPromotionVenue(campaign);
      return;
    }
    onEdit(campaign);
    setProductKeyword('');
    setModalOpen(true);
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    const campaignType = normalizeCampaignTypeForForm(form.campaignType);
    if (campaignType === 'fixed_price') {
      event.preventDefault();
      setModalOpen(false);
      onOpenFixedPriceCampaign();
      return;
    }
    if (campaignType === 'promotion_venue') {
      event.preventDefault();
      setModalOpen(false);
      onOpenPromotionVenue();
      return;
    }
    await onSubmit(event);
    setModalOpen(false);
  };
  const updateTier = (id: string, patch: Partial<CampaignTierForm>) => {
    onChange({ tiers: form.tiers.map(tier => tier.id === id ? { ...tier, ...patch } : tier) });
  };
  const toggleProduct = (productId: string, checked: boolean) => {
    const next = new Set(selectedProductIds);
    if (checked) {
      next.add(productId);
    } else {
      next.delete(productId);
    }
    onChange({ productIds: Array.from(next).join('\n') });
  };
  const updateGroup = (id: string, patch: Partial<CampaignProductGroupForm>) => {
    onChange({ productGroups: form.productGroups.map(group => group.id === id ? { ...group, ...patch } : group) });
  };
  const toggleGroupProduct = (groupId: string, productId: string, checked: boolean) => {
    const group = form.productGroups.find(item => item.id === groupId);
    if (!group) return;
    const next = new Set(idListFromText(group.productIds));
    if (checked) {
      next.add(productId);
    } else {
      next.delete(productId);
    }
    updateGroup(groupId, { productIds: Array.from(next).join('\n') });
  };
  const previewDisplay = campaignDisplayFromForm(form);

  return (
    <div className="page-grid">
      <div className="admin-filterbar marketing-filterbar">
        <input value={filters.keyword} onChange={event => onFiltersChange({ keyword: event.target.value })} placeholder="搜索活动名称或类型" />
        <select value={filters.categoryCode} onChange={event => onFiltersChange({ categoryCode: event.target.value })}>
          <option value="">全部类型</option>
          {campaignTypeOptions.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <select value={filters.status} onChange={event => onFiltersChange({ status: event.target.value })}>
          <option value="">全部状态</option>
          <option value="active">启用</option>
          <option value="draft">草稿</option>
          <option value="inactive">停用</option>
          <option value="expired">过期</option>
        </select>
        <button className="primary-button" type="button" onClick={() => void onSearch()}>
          <Icon name="refresh" />
          搜索
        </button>
        <button className="primary-button" type="button" onClick={openCreate}>
          <Icon name="plus" />
          创建活动
        </button>
      </div>

      <Panel title="营销活动">
        <div className="list-stack">
          {campaigns.map(campaign => {
            const id = stringValue(campaign, 'id');
            const status = stringValue(campaign, 'status');
            return (
              <article className="list-row" key={id}>
                <div>
                  <strong>{stringValue(campaign, 'name')}</strong>
                  <small>{campaignTypeLabel(stringValue(campaign, 'campaignType'))} · {campaignScopeSummary(campaign)} · {campaignAudienceSummary(campaign)}</small>
                  <small>{campaignTierSummary(campaign)} · {formatDate(stringValue(campaign, 'startsAt'))} 至 {formatDate(stringValue(campaign, 'endsAt'))}</small>
                </div>
                <span className={badgeClass(status)}>{statusLabel(status)}</span>
                <div className="actions">
                  <button className="ghost-button" type="button" onClick={() => openEdit(campaign)}>
                    <Icon name="save" />
                    {normalizeCampaignTypeForForm(stringValue(campaign, 'campaignType', stringValue(recordValue(campaign, 'rules'), 'activityType'))) === 'fixed_price'
                      ? '编辑一口价'
                      : normalizeCampaignTypeForForm(stringValue(campaign, 'campaignType', stringValue(recordValue(campaign, 'rules'), 'activityType'))) === 'promotion_venue'
                        ? '编辑会场'
                        : '编辑'}
                  </button>
                  <button className="ghost-button" type="button" onClick={() => void onCampaignStatus(id, status === 'active' ? 'inactive' : 'active')}>
                    <Icon name={status === 'active' ? 'x' : 'check'} />
                    {status === 'active' ? '停用' : '启用'}
                  </button>
                  <button className="ghost-button danger" type="button" onClick={() => void onDelete(id)}>
                    <Icon name="x" />
                    删除
                  </button>
                </div>
              </article>
            );
          })}
          {!campaigns.length ? <EmptyState text="暂无活动数据" /> : null}
        </div>
      </Panel>

      {modalOpen ? (
        <div className="modal-backdrop">
          <form className="modal-panel" onSubmit={submit}>
            <div className="modal-title-row">
              <div>
                <h2>{form.id ? '编辑营销活动' : '新建营销活动'}</h2>
              </div>
              <button className="ghost-button" type="button" onClick={() => setModalOpen(false)}>
                <Icon name="x" />
                关闭
              </button>
            </div>
            <div className="form-grid campaign-form-grid">
              <label>
                活动名称
                <input required value={form.name} onChange={event => onChange({ name: event.target.value })} />
              </label>
              <label>
                类型
                <select
                  value={form.campaignType}
                  onChange={event => {
                    const campaignType = event.target.value;
                    const defaults = campaignDisplayDefaults(campaignType, form.name);
                    onChange({
                      campaignType,
                      tagText: defaults.tagText,
                      iconText: defaults.iconText,
                      tagBackgroundColor: defaults.backgroundColor,
                      tagTextColor: defaults.textColor,
                    });
                  }}
                >
                  {campaignTypeOptions.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label>
                预算
                <input value={form.budgetYuan} type="number" min="0" step="0.01" onChange={event => onChange({ budgetYuan: event.target.value })} />
              </label>
              <label>
                状态
                <select value={form.status} onChange={event => onChange({ status: event.target.value })}>
                  <option value="active">启用</option>
                  <option value="draft">草稿</option>
                  <option value="inactive">停用</option>
                  <option value="expired">过期</option>
                </select>
              </label>
              <label>
                开始时间
                <input value={form.startsAt} type="datetime-local" onChange={event => onChange({ startsAt: event.target.value })} />
              </label>
              <label>
                结束时间
                <input value={form.endsAt} type="datetime-local" onChange={event => onChange({ endsAt: event.target.value })} />
              </label>
              <label>
                适用范围
                <select
                  value={form.scopeType}
                  onChange={event => {
                    const scopeType = event.target.value;
                    onChange({
                      scopeType,
                      productGroups: scopeType === 'product_group' && !form.productGroups.length
                        ? [createCampaignProductGroupForm()]
                        : form.productGroups,
                    });
                  }}
                >
                  {campaignScopeOptions.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label>
                用户范围
                <select value={form.audienceType} onChange={event => onChange({ audienceType: event.target.value })}>
                  {campaignAudienceOptions.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              {form.audienceType === 'new_customer' ? (
                <label>
                  新客规则
                  <select value={form.newCustomerRule} onChange={event => onChange({ newCustomerRule: event.target.value })}>
                    {newCustomerRuleOptions.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>

            <section className="campaign-rule-card">
              <div className="campaign-rule-card-head">
                <strong>前台展示</strong>
                <span>商品列表 tag 与详情页“优惠活动”共用此配置</span>
              </div>
              <div className="form-grid">
                <label>
                  展示标题
                  <input value={form.displayTitle} onChange={event => onChange({ displayTitle: event.target.value })} placeholder="商品详情优惠活动标题" />
                </label>
                <label>
                  tag 文案
                  <input value={form.tagText} onChange={event => onChange({ tagText: event.target.value })} placeholder="满49减6 / 免运费" />
                </label>
                <label>
                  icon 文本
                  <input value={form.iconText} onChange={event => onChange({ iconText: event.target.value })} placeholder="减 / 折 / 免" />
                </label>
                <label>
                  icon URL
                  <input value={form.iconUrl} onChange={event => onChange({ iconUrl: event.target.value })} placeholder="对象存储 icon 地址，可不填" />
                </label>
                <label>
                  tag 背景色
                  <input type="color" value={form.tagBackgroundColor} onChange={event => onChange({ tagBackgroundColor: event.target.value })} />
                </label>
                <label>
                  tag 文字色
                  <input type="color" value={form.tagTextColor} onChange={event => onChange({ tagTextColor: event.target.value })} />
                </label>
                <label className="wide">
                  活动规则解释
                  <textarea value={form.ruleExplanation} onChange={event => onChange({ ruleExplanation: event.target.value })} placeholder="展示给用户看的活动规则说明" />
                </label>
                <label className="wide">
                  使用限制
                  <textarea value={form.limitText} onChange={event => onChange({ limitText: event.target.value })} placeholder="适用商品、时期、退款、叠加限制等说明" />
                </label>
                <CampaignDisplayPreview display={previewDisplay} />
              </div>
            </section>

            <CampaignBusinessFields
              form={form}
              updateTier={updateTier}
              onChange={onChange}
              onOpenFixedPriceCampaign={() => {
                setModalOpen(false);
                onOpenFixedPriceCampaign();
              }}
              onOpenPromotionVenue={() => {
                setModalOpen(false);
                onOpenPromotionVenue();
              }}
            />

            {form.scopeType !== 'all' ? (
              <section className="campaign-rule-card">
                <div className="campaign-rule-card-head">
                  <strong>{form.scopeType === 'product_group' ? '商品组' : '选择商品'}</strong>
                  <input value={productKeyword} onChange={event => setProductKeyword(event.target.value)} placeholder="搜索商品名、SKU、类目" />
                  {form.scopeType === 'product_group' ? (
                    <button className="ghost-button" type="button" onClick={() => onChange({ productGroups: [...form.productGroups, createCampaignProductGroupForm()] })}>
                      <Icon name="plus" />
                      新增商品组
                    </button>
                  ) : null}
                </div>
                {form.scopeType === 'partial' ? (
                  <div className="campaign-product-picker">
                    {visibleProducts.map(product => {
                      const productId = stringValue(product, 'id');
                      return (
                        <label key={productId}>
                          <input checked={selectedProductIds.has(productId)} type="checkbox" onChange={event => toggleProduct(productId, event.target.checked)} />
                          <ProductImage record={product} />
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <div className="campaign-group-list">
                    {(form.productGroups.length ? form.productGroups : [createCampaignProductGroupForm()]).map(group => {
                      const groupProductIds = new Set(idListFromText(group.productIds));
                      return (
                        <article className="campaign-group-card" key={group.id}>
                          <div className="campaign-group-head">
                            <input value={group.name} onChange={event => updateGroup(group.id, { name: event.target.value })} placeholder="商品组名称" />
                            <span>已选 {groupProductIds.size} 个商品</span>
                            <button className="ghost-button danger" type="button" onClick={() => onChange({ productGroups: form.productGroups.filter(item => item.id !== group.id) })}>删除组</button>
                          </div>
                          <div className="campaign-product-picker compact">
                            {visibleProducts.map(product => {
                              const productId = stringValue(product, 'id');
                              return (
                                <label key={productId}>
                                  <input checked={groupProductIds.has(productId)} type="checkbox" onChange={event => toggleGroupProduct(group.id, productId, event.target.checked)} />
                                  <ProductImage record={product} />
                                </label>
                              );
                            })}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            ) : null}
            <div className="modal-actions">
              <button className="ghost-button" type="button" onClick={() => setModalOpen(false)}>取消</button>
              <button className="primary-button" type="submit">
                <Icon name={['fixed_price', 'promotion_venue'].includes(normalizeCampaignTypeForForm(form.campaignType)) ? 'megaphone' : 'save'} />
                {normalizeCampaignTypeForForm(form.campaignType) === 'fixed_price'
                  ? '进入一口价页面'
                  : normalizeCampaignTypeForForm(form.campaignType) === 'promotion_venue'
                    ? '进入大促会场页面'
                    : form.id ? '保存活动' : '创建活动'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function MallFixedPriceCampaignsSection({
  campaigns,
  products,
  form,
  onChange,
  onCampaignStatus,
  onDelete,
  onEdit,
  onReset,
  onSubmit,
  onUploadIcon,
}: {
  campaigns: JsonRecord[];
  products: JsonRecord[];
  form: FixedPriceCampaignForm;
  onChange: (patch: Partial<FixedPriceCampaignForm>) => void;
  onCampaignStatus: (id: string, status: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onEdit: (campaign: JsonRecord) => void;
  onReset: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onUploadIcon: (file: File) => Promise<string>;
}) {
  const showMessage = useAdminMessage();
  const [modalOpen, setModalOpen] = useState(false);
  const [productKeyword, setProductKeyword] = useState('');
  const [activeGroupId, setActiveGroupId] = useState(form.groups[0]?.id || '');
  const productById = useMemo(
    () => new Map(products.map(product => [stringValue(product, 'id'), product])),
    [products],
  );
  const activeGroup = form.groups.find(group => group.id === activeGroupId) || form.groups[0] || createFixedPriceGroupForm();
  const selectedItems = new Map(activeGroup.items.map(item => [item.productId, item]));
  const visibleProducts = products
    .filter(product => {
      const keyword = productKeyword.trim().toLowerCase();
      if (!keyword) return true;
      return [
        stringValue(product, 'name'),
        stringValue(product, 'sku'),
        stringValue(product, 'categoryName'),
        stringValue(product, 'categoryCode'),
      ].some(value => value.toLowerCase().includes(keyword));
    })
    .slice(0, 120);
  const previewProduct = activeGroup.items
    .map(item => productById.get(item.productId))
    .find(Boolean) || visibleProducts[0] || products[0];

  useEffect(() => {
    if (!form.groups.length) {
      const group = createFixedPriceGroupForm();
      onChange({ groups: [group] });
      setActiveGroupId(group.id);
      return;
    }
    if (!form.groups.some(group => group.id === activeGroupId)) {
      setActiveGroupId(form.groups[0].id);
    }
  }, [activeGroupId, form.groups, onChange]);

  const openCreate = () => {
    onReset();
    setProductKeyword('');
    setActiveGroupId(initialFixedPriceCampaignForm.groups[0]?.id || '');
    setModalOpen(true);
  };
  const openEdit = (campaign: JsonRecord) => {
    onEdit(campaign);
    setProductKeyword('');
    const nextForm = fixedPriceCampaignToForm(campaign);
    setActiveGroupId(nextForm.groups[0]?.id || '');
    setModalOpen(true);
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    await onSubmit(event);
    setModalOpen(false);
  };
  const toggleProduct = (product: JsonRecord, checked: boolean) => {
    const productId = stringValue(product, 'id');
    if (!productId) return;
    const currentItems = activeGroup.items || [];
    const nextItems = checked
      ? [
          ...currentItems,
          {
            productId,
            fixedPriceYuan: (numberValue(product, 'discountedPriceCents', numberValue(product, 'priceCents')) / 100).toFixed(2),
          },
        ]
      : currentItems.filter(item => item.productId !== productId);
    updateFixedPriceGroup(activeGroup.id, {
      items: Array.from(new Map(nextItems.map(item => [item.productId, item])).values()),
    });
  };
  const updateItemPrice = (productId: string, fixedPriceYuan: string) => {
    updateFixedPriceGroup(activeGroup.id, {
      items: activeGroup.items.map(item => item.productId === productId ? { ...item, fixedPriceYuan } : item),
    });
  };
  const updateFixedPriceGroup = (id: string, patch: Partial<FixedPriceCampaignGroupForm>) => {
    onChange({ groups: form.groups.map(group => group.id === id ? { ...group, ...patch } : group) });
  };
  const addFixedPriceGroup = () => {
    const group = createFixedPriceGroupForm({ name: `商品组${form.groups.length + 1}`, startsAt: form.startsAt, endsAt: form.endsAt });
    onChange({ groups: [...form.groups, group] });
    setActiveGroupId(group.id);
  };
  const removeFixedPriceGroup = (id: string) => {
    const nextGroups = form.groups.filter(group => group.id !== id);
    onChange({ groups: nextGroups.length ? nextGroups : [createFixedPriceGroupForm()] });
    setActiveGroupId(nextGroups[0]?.id || '');
  };
  const uploadIcon = async (files: FileList | null | undefined) => {
    const file = files?.[0];
    if (!file) return;
    try {
      const imageUrl = await onUploadIcon(file);
      onChange({ badgeIconUrl: imageUrl });
    } catch {
      showMessage('error', '角标 icon 上传失败');
    }
  };
  const fixedPricePreviewDisplay: CampaignDisplayConfig = {
    title: form.name.trim() || '本周一口价',
    tagText: form.badgeText.trim() || '一口价',
    iconText: form.badgeIcon.trim(),
    iconUrl: form.badgeIconUrl.trim(),
    backgroundColor: form.badgeBackgroundColor || '#FF9238',
    textColor: form.badgeTextColor || '#FFFFFF',
    ruleExplanation: `活动期间，参与商品按${form.badgeText.trim() || '一口价'}结算。`,
    limitText: '限所选商品参与，具体价格以下单页为准。',
  };

  return (
    <div className="page-grid">
      <div className="mall-admin-toolbar">
        <button className="mall-admin-submit" type="button" onClick={openCreate}>创建一口价</button>
      </div>

      <Panel title="一口价">
        <div className="list-stack">
          {campaigns.map(campaign => {
            const id = stringValue(campaign, 'id');
            const status = stringValue(campaign, 'status');
            const rules = recordValue(campaign, 'rules');
            const badge = recordValue(rules, 'badge');
            const items = arrayValue(rules, 'items');
            const groups = arrayValue(rules, 'groups');
            const badgeText = stringValue(badge, 'text', stringValue(rules, 'badgeText', '一口价'));
            const badgeIcon = stringValue(badge, 'icon', stringValue(rules, 'badgeIcon'));
            const badgeIconUrl = stringValue(badge, 'iconUrl', stringValue(rules, 'badgeIconUrl'));
            const badgeBackgroundColor = stringValue(badge, 'backgroundColor', stringValue(rules, 'badgeBackgroundColor', '#FF9238'));
            const badgeTextColor = stringValue(badge, 'textColor', stringValue(rules, 'badgeTextColor', '#FFFFFF'));
            const badgePosition = stringValue(badge, 'position', stringValue(rules, 'badgePosition', 'top_left'));
            const firstItem = items.find(item => Boolean(item) && typeof item === 'object' && !Array.isArray(item)) as JsonRecord | undefined;
            const previewProductRecord = productById.get(stringValue(firstItem || {}, 'productId'));
            return (
              <article className="list-row" key={id}>
                <div>
                  <strong>{stringValue(campaign, 'name', '一口价活动')}</strong>
                  <small>{groups.length || 1} 个商品组 · {items.length} 个商品 · {formatDate(stringValue(campaign, 'startsAt'))} 至 {formatDate(stringValue(campaign, 'endsAt'))}</small>
                  <small>角标位置：{fixedPriceBadgePositionLabel(badgePosition)}</small>
                </div>
                <FixedPriceProductBadgePreview
                  badgeBackgroundColor={badgeBackgroundColor}
                  badgeIcon={badgeIcon}
                  badgeIconUrl={badgeIconUrl}
                  badgePosition={badgePosition}
                  badgeText={badgeText}
                  badgeTextColor={badgeTextColor}
                  product={previewProductRecord}
                />
                <span className={badgeClass(status)}>{statusLabel(status)}</span>
                <div className="actions">
                  <button className="ghost-button" type="button" onClick={() => openEdit(campaign)}>
                    <Icon name="save" />
                    编辑
                  </button>
                  <button className="ghost-button" type="button" onClick={() => void onCampaignStatus(id, status === 'active' ? 'inactive' : 'active')}>
                    <Icon name={status === 'active' ? 'x' : 'check'} />
                    {status === 'active' ? '停用' : '启用'}
                  </button>
                  <button className="ghost-button danger" type="button" onClick={() => void onDelete(id)}>
                    <Icon name="x" />
                    删除
                  </button>
                </div>
              </article>
            );
          })}
          {!campaigns.length ? <EmptyState text="暂无一口价活动" /> : null}
        </div>
      </Panel>

      {modalOpen ? (
        <div className="modal-backdrop">
          <form className="modal-panel fixed-price-modal" onSubmit={submit}>
            <div className="modal-title-row">
              <div>
                <h2>{form.id ? '编辑一口价' : '创建一口价'}</h2>
              </div>
              <button className="ghost-button" type="button" onClick={() => setModalOpen(false)}>
                <Icon name="x" />
                关闭
              </button>
            </div>

            <div className="form-grid">
              <label>
                活动名称
                <input required value={form.name} onChange={event => onChange({ name: event.target.value })} />
              </label>
              <label>
                状态
                <select value={form.status} onChange={event => onChange({ status: event.target.value })}>
                  <option value="active">启用</option>
                  <option value="draft">草稿</option>
                  <option value="inactive">停用</option>
                </select>
              </label>
              <label>
                活动开始时间
                <input value={form.startsAt} type="datetime-local" onChange={event => onChange({ startsAt: event.target.value })} />
              </label>
              <label>
                活动结束时间
                <input value={form.endsAt} type="datetime-local" onChange={event => onChange({ endsAt: event.target.value })} />
              </label>
              <label>
                展示文字
                <input required value={form.badgeText} onChange={event => onChange({ badgeText: event.target.value })} />
              </label>
              <label>
                icon 文本
                <input value={form.badgeIcon} onChange={event => onChange({ badgeIcon: event.target.value })} placeholder="¥ / 限 / 惠" />
              </label>
              <label>
                背景色
                <input type="color" value={form.badgeBackgroundColor} onChange={event => onChange({ badgeBackgroundColor: event.target.value })} />
              </label>
              <label>
                文字颜色
                <input type="color" value={form.badgeTextColor} onChange={event => onChange({ badgeTextColor: event.target.value })} />
              </label>
              <label>
                角标位置
                <select value={form.badgePosition} onChange={event => onChange({ badgePosition: event.target.value })}>
                  {fixedPriceBadgePositionOptions.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="wide">
                icon 图片
                <input accept="image/*" type="file" onChange={event => void uploadIcon(event.currentTarget.files)} />
                <input value={form.badgeIconUrl} onChange={event => onChange({ badgeIconUrl: event.target.value })} placeholder="icon 图片地址，可不填" />
              </label>
              <div className="wide fixed-price-badge-editor">
                <span>商品图预览</span>
                <FixedPriceProductBadgePreview
                  badgeBackgroundColor={form.badgeBackgroundColor}
                  badgeIcon={form.badgeIcon}
                  badgeIconUrl={form.badgeIconUrl}
                  badgePosition={form.badgePosition}
                  badgeText={form.badgeText || '一口价'}
                  badgeTextColor={form.badgeTextColor}
                  product={previewProduct}
                  large
                />
              </div>
              <CampaignDisplayPreview display={fixedPricePreviewDisplay} />
            </div>

            <div className="fixed-price-group-tabs">
              {form.groups.map(group => (
                <button
                  className={group.id === activeGroup.id ? 'active' : ''}
                  key={group.id}
                  type="button"
                  onClick={() => setActiveGroupId(group.id)}
                >
                  {group.name || '商品组'} · {group.items.length}
                </button>
              ))}
              <button type="button" onClick={addFixedPriceGroup}>
                <Icon name="plus" />
                新增商品组
              </button>
            </div>

            <div className="fixed-price-group-editor">
              <label>
                商品组名称
                <input value={activeGroup.name} onChange={event => updateFixedPriceGroup(activeGroup.id, { name: event.target.value })} />
              </label>
              <label>
                组开始时间
                <input value={activeGroup.startsAt} type="datetime-local" onChange={event => updateFixedPriceGroup(activeGroup.id, { startsAt: event.target.value })} />
              </label>
              <label>
                组结束时间
                <input value={activeGroup.endsAt} type="datetime-local" onChange={event => updateFixedPriceGroup(activeGroup.id, { endsAt: event.target.value })} />
              </label>
              <button className="ghost-button danger" disabled={form.groups.length <= 1} type="button" onClick={() => removeFixedPriceGroup(activeGroup.id)}>删除商品组</button>
            </div>

            <div className="fixed-price-product-tools">
              <input value={productKeyword} onChange={event => setProductKeyword(event.target.value)} placeholder="搜索商品名、SKU、类目" />
              <span>当前组已选 {activeGroup.items.length} 个商品</span>
            </div>
            <div className="table-wrap fixed-price-product-table">
              <table>
                <thead>
                  <tr>
                    <th>选择</th>
                    <th>商品</th>
                    <th>当前售价</th>
                    <th>一口价</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleProducts.map(product => {
                    const productId = stringValue(product, 'id');
                    const selectedItem = selectedItems.get(productId);
                    return (
                      <tr key={productId}>
                        <td>
                          <input checked={Boolean(selectedItem)} type="checkbox" onChange={event => toggleProduct(product, event.target.checked)} />
                        </td>
                        <td>
                          <strong>{stringValue(product, 'name', '未命名商品')}</strong>
                          <small>{stringValue(product, 'sku') || shortId(productId)} · {stringValue(product, 'categoryName', stringValue(product, 'categoryCode'))}</small>
                        </td>
                        <td>{yuan(numberValue(product, 'priceCents'))}</td>
                        <td>
                          <input
                            disabled={!selectedItem}
                            min="0.01"
                            step="0.01"
                            type="number"
                            value={selectedItem?.fixedPriceYuan || ''}
                            onChange={event => updateItemPrice(productId, event.target.value)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                  {!visibleProducts.length ? (
                    <tr>
                      <td colSpan={4}>暂无商品</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="modal-actions">
              <button className="ghost-button" type="button" onClick={() => setModalOpen(false)}>取消</button>
              <button className="primary-button" type="submit">
                <Icon name="save" />
                保存一口价
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function MallPromotionVenuesSection({
  campaigns,
  products,
  form,
  onChange,
  onCampaignStatus,
  onDelete,
  onEdit,
  onReset,
  onSubmit,
  onUploadImage,
}: {
  campaigns: JsonRecord[];
  products: JsonRecord[];
  form: PromotionVenueForm;
  onChange: (patch: Partial<PromotionVenueForm>) => void;
  onCampaignStatus: (id: string, status: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onEdit: (campaign: JsonRecord) => void;
  onReset: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onUploadImage: (file: File) => Promise<string>;
}) {
  const showMessage = useAdminMessage();
  const [modalOpen, setModalOpen] = useState(false);
  const [productKeyword, setProductKeyword] = useState('');
  const selectedItems = new Map(form.items.map(item => [item.productId, item]));
  const visibleProducts = products
    .filter(product => {
      const keyword = productKeyword.trim().toLowerCase();
      if (!keyword) return true;
      return [
        stringValue(product, 'name'),
        stringValue(product, 'sku'),
        stringValue(product, 'categoryName'),
        stringValue(product, 'categoryCode'),
      ].some(value => value.toLowerCase().includes(keyword));
    })
    .slice(0, 160);

  const openCreate = () => {
    onReset();
    setProductKeyword('');
    setModalOpen(true);
  };
  const openEdit = (campaign: JsonRecord) => {
    onEdit(campaign);
    setProductKeyword('');
    setModalOpen(true);
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    await onSubmit(event);
    setModalOpen(false);
  };
  const toggleProduct = (product: JsonRecord, checked: boolean) => {
    const productId = stringValue(product, 'id');
    if (!productId) return;
    const nextItems = checked ? [...form.items, { productId }] : form.items.filter(item => item.productId !== productId);
    onChange({ items: Array.from(new Map(nextItems.map(item => [item.productId, item])).values()) });
  };
  const uploadField = async (files: FileList | null | undefined, key: 'iconUrl' | 'backgroundImageUrl') => {
    const file = files?.[0];
    if (!file) return;
    try {
      const imageUrl = await onUploadImage(file);
      onChange({ [key]: imageUrl });
    } catch {
      showMessage('error', key === 'iconUrl' ? '会场 icon 上传失败' : '会场背景上传失败');
    }
  };
  const promotionVenuePreviewDisplay: CampaignDisplayConfig = {
    title: form.title.trim() || form.name.trim() || '周末大促',
    tagText: form.tagText.trim() || '大促',
    iconText: form.iconText.trim(),
    iconUrl: form.iconUrl.trim(),
    backgroundColor: form.backgroundColor || '#F4FBF5',
    textColor: form.textColor || '#153A24',
    ruleExplanation: form.copy.trim() || '活动期间，会场内商品按页面活动规则享受优惠。',
    limitText: form.limitText.trim(),
  };

  return (
    <div className="page-grid">
      <div className="mall-admin-toolbar">
        <button className="mall-admin-submit" type="button" onClick={openCreate}>创建大促会场</button>
      </div>

      <Panel title="大促会场" description="管理会场入口、展示样式和参与商品">
        <div className="list-stack">
          {campaigns.map(campaign => {
            const id = stringValue(campaign, 'id');
            const status = stringValue(campaign, 'status');
            const rules = recordValue(campaign, 'rules');
            const items = arrayValue(rules, 'items');
            const iconUrl = stringValue(rules, 'iconUrl');
            return (
              <article className="list-row promotion-venue-row" key={id}>
                <div>
                  <strong>{stringValue(rules, 'title', stringValue(campaign, 'name', '大促会场'))}</strong>
                  <small>{promotionVenueEntryPositionLabel(stringValue(rules, 'entryPosition', 'home_after_banner'))} · {items.length} 个商品 · {stringValue(rules, 'copy', stringValue(rules, 'subtitle'))}</small>
                </div>
                <span
                  className="promotion-venue-preview"
                  style={{
                    background: stringValue(rules, 'backgroundColor', '#F4FBF5'),
                    color: stringValue(rules, 'textColor', '#153A24'),
                  }}
                >
                  {iconUrl ? <img alt="" src={resolveImage(iconUrl)} /> : <i>{stringValue(rules, 'iconText', '促')}</i>}
                  {stringValue(rules, 'buttonText', '进入会场')}
                </span>
                <span className={badgeClass(status)}>{statusLabel(status)}</span>
                <div className="actions">
                  <button className="ghost-button" type="button" onClick={() => openEdit(campaign)}>
                    <Icon name="save" />
                    编辑
                  </button>
                  <button className="ghost-button" type="button" onClick={() => void onCampaignStatus(id, status === 'active' ? 'inactive' : 'active')}>
                    <Icon name={status === 'active' ? 'x' : 'check'} />
                    {status === 'active' ? '停用' : '启用'}
                  </button>
                  <button className="ghost-button danger" type="button" onClick={() => void onDelete(id)}>
                    <Icon name="x" />
                    删除
                  </button>
                </div>
              </article>
            );
          })}
          {!campaigns.length ? <EmptyState text="暂无大促会场" /> : null}
        </div>
      </Panel>

      {modalOpen ? (
        <div className="modal-backdrop">
          <form className="modal-panel promotion-venue-modal" onSubmit={submit}>
            <div className="modal-title-row">
              <div>
                <h2>{form.id ? '编辑大促会场' : '创建大促会场'}</h2>
              </div>
              <button className="ghost-button" type="button" onClick={() => setModalOpen(false)}>
                <Icon name="x" />
                关闭
              </button>
            </div>

            <div className="form-grid">
              <label>
                会场名称
                <input required value={form.name} onChange={event => onChange({ name: event.target.value })} />
              </label>
              <label>
                状态
                <select value={form.status} onChange={event => onChange({ status: event.target.value })}>
                  <option value="active">启用</option>
                  <option value="draft">草稿</option>
                  <option value="inactive">停用</option>
                </select>
              </label>
              <label>
                入口位置
                <select value={form.entryPosition} onChange={event => onChange({ entryPosition: event.target.value })}>
                  {promotionVenueEntryPositionOptions.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label>
                排序
                <input value={form.sortOrder} type="number" step="1" onChange={event => onChange({ sortOrder: event.target.value })} />
              </label>
              <label>
                会场标题
                <input required value={form.title} onChange={event => onChange({ title: event.target.value })} />
              </label>
              <label>
                商品 tag 文案
                <input value={form.tagText} onChange={event => onChange({ tagText: event.target.value })} placeholder="大促 / 周末惠" />
              </label>
              <label>
                副标题
                <input value={form.subtitle} onChange={event => onChange({ subtitle: event.target.value })} />
              </label>
              <label>
                按钮文字
                <input value={form.buttonText} onChange={event => onChange({ buttonText: event.target.value })} />
              </label>
              <label>
                icon 文本
                <input value={form.iconText} onChange={event => onChange({ iconText: event.target.value })} placeholder="促 / 惠 / 鲜" />
              </label>
              <label>
                背景色
                <input type="color" value={form.backgroundColor} onChange={event => onChange({ backgroundColor: event.target.value })} />
              </label>
              <label>
                文字颜色
                <input type="color" value={form.textColor} onChange={event => onChange({ textColor: event.target.value })} />
              </label>
              <label className="wide">
                文案
                <textarea value={form.copy} onChange={event => onChange({ copy: event.target.value })} />
              </label>
              <label className="wide">
                使用限制
                <textarea value={form.limitText} onChange={event => onChange({ limitText: event.target.value })} placeholder="限会场商品参与，具体优惠以下单页为准" />
              </label>
              <label className="wide">
                会场 icon
                <input accept="image/*" type="file" onChange={event => void uploadField(event.currentTarget.files, 'iconUrl')} />
                <input value={form.iconUrl} onChange={event => onChange({ iconUrl: event.target.value })} placeholder="icon 图片地址，可不填" />
              </label>
              <label className="wide">
                背景图
                <input accept="image/*" type="file" onChange={event => void uploadField(event.currentTarget.files, 'backgroundImageUrl')} />
                <input value={form.backgroundImageUrl} onChange={event => onChange({ backgroundImageUrl: event.target.value })} placeholder="背景图地址，可不填" />
              </label>
              <div className="wide promotion-venue-card-preview">
                <span
                  style={{
                    background: form.backgroundImageUrl
                      ? `${form.backgroundColor} url(${resolveImage(form.backgroundImageUrl)}) center/cover no-repeat`
                      : form.backgroundColor,
                    color: form.textColor,
                  }}
                >
                  <strong>{form.iconUrl ? <img alt="" src={resolveImage(form.iconUrl)} /> : <i>{form.iconText || '促'}</i>}</strong>
                  <b>{form.title || form.name}</b>
                  <em>{form.copy || form.subtitle}</em>
                  <small>{form.buttonText || '进入会场'}</small>
                </span>
              </div>
              <CampaignDisplayPreview display={promotionVenuePreviewDisplay} />
            </div>

            <div className="fixed-price-product-tools">
              <input value={productKeyword} onChange={event => setProductKeyword(event.target.value)} placeholder="搜索商品名、SKU、类目" />
              <span>已选 {form.items.length} 个商品</span>
            </div>
            <div className="table-wrap fixed-price-product-table">
              <table>
                <thead>
                  <tr>
                    <th>选择</th>
                    <th>商品</th>
                    <th>售价</th>
                    <th>库存</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleProducts.map(product => {
                    const productId = stringValue(product, 'id');
                    return (
                      <tr key={productId}>
                        <td>
                          <input checked={selectedItems.has(productId)} type="checkbox" onChange={event => toggleProduct(product, event.target.checked)} />
                        </td>
                        <td>
                          <strong>{stringValue(product, 'name', '未命名商品')}</strong>
                          <small>{stringValue(product, 'sku') || shortId(productId)} · {stringValue(product, 'categoryName', stringValue(product, 'categoryCode'))}</small>
                        </td>
                        <td>{yuan(numberValue(product, 'priceCents'))}</td>
                        <td>{numberValue(product, 'stock')}</td>
                      </tr>
                    );
                  })}
                  {!visibleProducts.length ? (
                    <tr>
                      <td colSpan={4}>暂无商品</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="modal-actions">
              <button className="ghost-button" type="button" onClick={() => setModalOpen(false)}>取消</button>
              <button className="primary-button" type="submit">
                <Icon name="save" />
                保存会场
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function MallGroupBuyPresaleSection({
  groupBuys,
  products,
  form,
  modalOpen,
  subscriptions,
  detailOpen,
  detailActivity,
  onAction,
  onChange,
  onCloseDetail,
  onEdit,
  onModalOpenChange,
  onOpenDetail,
  onReset,
  onSubmit,
  onTiersChange,
}: {
  groupBuys: JsonRecord[];
  products: JsonRecord[];
  form: GroupBuyForm;
  modalOpen: boolean;
  subscriptions: JsonRecord[];
  detailOpen: boolean;
  detailActivity: JsonRecord | null;
  onAction: (groupBuy: JsonRecord, action: string) => Promise<void>;
  onChange: (patch: Partial<GroupBuyForm>) => void;
  onCloseDetail: () => void;
  onEdit: (groupBuy: JsonRecord) => void;
  onModalOpenChange: (open: boolean) => void;
  onOpenDetail: (groupBuy: JsonRecord) => Promise<void>;
  onReset: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onTiersChange: (updater: (tiers: GroupBuyTierForm[]) => GroupBuyTierForm[]) => void;
}) {
  const selectedProduct = products.find(product => stringValue(product, 'id') === form.productId);
  const productVariants = selectedProduct ? productVariantsFromRecord(selectedProduct) : [];
  const hasExplicitVariants = selectedProduct ? arrayValue(selectedProduct, 'variants').length > 0 : false;
  const updateTier = (id: string, patch: Partial<GroupBuyTierForm>) => {
    onTiersChange(tiers => tiers.map(tier => tier.id === id ? { ...tier, ...patch } : tier));
  };
  const removeTier = (id: string) => {
    onTiersChange(tiers => tiers.filter(tier => tier.id !== id));
  };
  const openCreate = () => {
    onReset();
    onModalOpenChange(true);
  };
  const openEdit = (groupBuy: JsonRecord) => {
    onEdit(groupBuy);
    onModalOpenChange(true);
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    if (hasExplicitVariants && !form.variantId) {
      event.preventDefault();
      return;
    }
    await onSubmit(event);
    onModalOpenChange(false);
  };

  return (
    <div className="page-grid">
      <div className="mall-admin-toolbar">
        <button className="mall-admin-submit" type="button" onClick={openCreate}>
          新建集采预售
        </button>
      </div>

      <Panel title="集采预售">
        <div className="table-wrap group-buy-table-wrap">
          <table>
            <thead>
              <tr>
                <th>活动</th>
                <th>商品规格</th>
                <th>数量进度</th>
                <th>档位/尾款</th>
                <th>状态</th>
                <th>活动时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {groupBuys.map(groupBuy => {
                const id = stringValue(groupBuy, 'id');
                const status = stringValue(groupBuy, 'status', 'draft');
                const currentQuantity = groupBuyCurrentQuantity(groupBuy);
                const minQuantity = numberValue(groupBuy, 'minGroupQuantity', 1);
                const unitName = stringValue(groupBuy, 'unitName', '件');
                const progress = Math.min(100, Math.round((currentQuantity / Math.max(minQuantity, 1)) * 100));
                return (
                  <tr key={id}>
                    <td>
                      <strong>{stringValue(groupBuy, 'name', '未命名集采')}</strong>
                      <small>{shortId(id)}</small>
                      <small>定金：{groupBuyDepositTypeLabel(stringValue(groupBuy, 'depositType', 'percent'))} · {groupBuyDepositSummary(groupBuy)}</small>
                    </td>
                    <td>
                      <strong>{groupBuyProductName(groupBuy, products)}</strong>
                      <small>{groupBuyVariantName(groupBuy, products)}</small>
                    </td>
                    <td>
                      <div className="group-buy-progress">
                        <span>{currentQuantity}/{minQuantity} {unitName}</span>
                        <i><b style={{ width: `${progress}%` }} /></i>
                      </div>
                    </td>
                    <td>
                      <strong>{groupBuyFinalTierSummary(groupBuy)}</strong>
                      <small>{groupBuyBalanceSummary(groupBuy)}</small>
                      <small>{groupBuyPaymentProgressSummary(groupBuy)}</small>
                    </td>
                    <td>
                      <span className={`${badgeClass(status)} group-buy-status`}>{groupBuyStatusLabel(status)}</span>
                    </td>
                    <td>
                      <small>{formatDate(stringValue(groupBuy, 'startsAt'))}</small>
                      <small>{formatDate(stringValue(groupBuy, 'endsAt'))}</small>
                    </td>
                    <td>
                      <div className="actions group-buy-actions">
                        <button className="ghost-button" type="button" onClick={() => openEdit(groupBuy)}>
                          <Icon name="save" />
                          编辑
                        </button>
                        <button className="ghost-button" type="button" onClick={() => void onOpenDetail(groupBuy)}>
                          <Icon name="orders" />
                          详情
                        </button>
                        {groupBuyActionOptions.map(option => {
                          const disabledReason = groupBuyActionUnavailableReason(groupBuy, option.action);
                          return (
                            <button
                              className={option.action === 'cancel' || option.action === 'offline' ? 'ghost-button danger' : 'ghost-button'}
                              disabled={Boolean(disabledReason)}
                              key={option.action}
                              title={disabledReason}
                              type="button"
                              onClick={() => void onAction(groupBuy, option.action)}
                            >
                              <Icon name={option.icon} />
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!groupBuys.length ? (
                <tr>
                  <td colSpan={7}>暂无集采预售活动</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Panel>

      {modalOpen ? (
        <div className="modal-backdrop">
          <form className="modal-panel group-buy-modal" onSubmit={submit}>
            <div className="modal-title-row">
              <div>
                <h2>{form.id ? '编辑集采预售' : '新建集采预售'}</h2>
              </div>
              <button className="ghost-button" type="button" onClick={() => onModalOpenChange(false)}>
                <Icon name="x" />
                关闭
              </button>
            </div>

            <div className="form-grid">
              <label>
                活动名称
                <input required value={form.name} onChange={event => onChange({ name: event.target.value })} />
              </label>
              <label>
                商品
                <select required value={form.productId} onChange={event => onChange({ productId: event.target.value, variantId: '' })}>
                  <option value="">请选择商品</option>
                  {products.map(product => {
                    const productId = stringValue(product, 'id');
                    return (
                      <option key={productId} value={productId}>
                        {stringValue(product, 'name', '未命名商品')}
                      </option>
                    );
                  })}
                </select>
              </label>
              <label>
                售卖规格
                <select
                  required={hasExplicitVariants}
                  value={form.variantId}
                  onChange={event => onChange({ variantId: event.target.value })}
                >
                  <option value="">{hasExplicitVariants ? '请选择规格' : '默认规格'}</option>
                  {productVariants.map(variant => (
                    <option key={variant.id} value={variant.id}>
                      {variant.specification || variant.name || variant.sku || variant.id}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                活动开始
                <input required type="datetime-local" value={form.startsAt} onChange={event => onChange({ startsAt: event.target.value })} />
              </label>
              <label>
                活动结束
                <input required type="datetime-local" value={form.endsAt} onChange={event => onChange({ endsAt: event.target.value })} />
              </label>
              <label>
                尾款截止
                <input required type="datetime-local" value={form.balanceDueAt} onChange={event => onChange({ balanceDueAt: event.target.value })} />
              </label>
              <label>
                成团门槛
                <input required min="1" type="number" value={form.minGroupQuantity} onChange={event => onChange({ minGroupQuantity: event.target.value })} />
              </label>
              <label>
                每人上限
                <input min="1" type="number" value={form.maxQuantityPerUser} onChange={event => onChange({ maxQuantityPerUser: event.target.value })} />
              </label>
              <label>
                最低信用分
                <input required min="0" type="number" value={form.minCreditScore} onChange={event => onChange({ minCreditScore: event.target.value })} />
              </label>
              <label>
                逾期扣分
                <input required min="0" type="number" value={form.overdueCreditPenalty} onChange={event => onChange({ overdueCreditPenalty: event.target.value })} />
              </label>
              <label>
                定金方式
                <select value={form.depositType} onChange={event => onChange({ depositType: event.target.value })}>
                  {groupBuyDepositTypeOptions.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label>
                {groupBuyDepositValueLabel(form.depositType)}
                <input
                  required
                  min="0"
                  step={form.depositType === 'percent' ? '1' : '0.01'}
                  type="number"
                  value={form.depositValue}
                  onChange={event => onChange({ depositValue: event.target.value })}
                />
              </label>
            </div>

            <section className="campaign-rule-card">
              <div className="campaign-rule-card-head">
                <strong>阶梯价</strong>
                <button className="ghost-button" type="button" onClick={() => onTiersChange(tiers => [...tiers, createGroupBuyTierForm()])}>
                  <Icon name="plus" />
                  新增档位
                </button>
              </div>
              <div className="group-buy-tier-list">
                {form.tiers.map(tier => (
                  <div className="group-buy-tier-row" key={tier.id}>
                    <label>
                      件数
                      <input required min="1" type="number" value={tier.quantity} onChange={event => updateTier(tier.id, { quantity: event.target.value })} />
                    </label>
                    <label>
                      单价
                      <input required min="0.01" step="0.01" type="number" value={tier.priceYuan} onChange={event => updateTier(tier.id, { priceYuan: event.target.value })} />
                    </label>
                    <button className="ghost-button danger" disabled={form.tiers.length <= 1} type="button" onClick={() => removeTier(tier.id)}>
                      删除
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <div className="modal-actions">
              <button className="ghost-button" type="button" onClick={() => onModalOpenChange(false)}>取消</button>
              <button className="primary-button" type="submit">
                <Icon name="save" />
                保存集采
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {detailOpen ? (
        <div className="modal-backdrop">
          <div className="modal-panel group-buy-detail-modal">
            <div className="modal-title-row">
              <div>
                <h2>{detailActivity ? stringValue(detailActivity, 'name', '集采详情') : '集采详情'}</h2>
              </div>
              <button className="ghost-button" type="button" onClick={onCloseDetail}>
                <Icon name="x" />
                关闭
              </button>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>用户</th>
                    <th>数量</th>
                    <th>定金</th>
                    <th>尾款</th>
                    <th>扣分</th>
                    <th>退款/取消</th>
                    <th>商城订单</th>
                  </tr>
                </thead>
                <tbody>
                  {subscriptions.map(subscription => {
                    const user = recordValue(subscription, 'user');
                    const userName = stringValue(subscription, 'userName', stringValue(user, 'name', stringValue(user, 'nickname', '-')));
                    const userPhone = stringValue(subscription, 'userPhone', stringValue(user, 'phone'));
                    const cancelText = stringValue(subscription, 'cancelReason') || groupBuyStatusLabel(stringValue(subscription, 'refundStatus', stringValue(subscription, 'status')));
                    return (
                      <tr key={stringValue(subscription, 'id')}>
                        <td>
                          <strong>{userName}</strong>
                          <small>{userPhone || '-'}</small>
                        </td>
                        <td>{numberValue(subscription, 'quantity')}</td>
                        <td>{groupBuyStatusLabel(stringValue(subscription, 'depositStatus', stringValue(subscription, 'status')))} · {yuan(numberValue(subscription, 'depositCents'))}</td>
                        <td>{groupBuyStatusLabel(stringValue(subscription, 'balanceStatus', stringValue(subscription, 'status')))} · {yuan(numberValue(subscription, 'balanceCents'))}</td>
                        <td>{numberValue(subscription, 'creditPenaltyPoints', numberValue(subscription, 'creditPenalty'))}</td>
                        <td>{cancelText}</td>
                        <td>{stringValue(subscription, 'mallOrderId') || '-'}</td>
                      </tr>
                    );
                  })}
                  {!subscriptions.length ? (
                    <tr>
                      <td colSpan={7}>暂无订阅记录</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MallPermissionsSection({
  permissions,
  filters,
  form,
  onChange,
  onDelete,
  onEdit,
  onFiltersChange,
  onReset,
  onSearch,
  onSubmit,
  onToggleAction,
  onToggleModule,
}: {
  permissions: JsonRecord[];
  filters: MallPermissionFilterState;
  form: MallPermissionForm;
  onChange: (patch: Partial<MallPermissionForm>) => void;
  onDelete: (id: string) => Promise<void>;
  onEdit: (permission: JsonRecord) => void;
  onFiltersChange: (patch: Partial<MallPermissionFilterState>) => void;
  onReset: () => void;
  onSearch: () => Promise<void>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onToggleAction: (action: string) => void;
  onToggleModule: (module: string) => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const openCreate = () => {
    onReset();
    setModalOpen(true);
  };
  const openEdit = (permission: JsonRecord) => {
    onEdit(permission);
    setModalOpen(true);
  };
  const closeModal = () => {
    onReset();
    setModalOpen(false);
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    await onSubmit(event);
    setModalOpen(false);
  };

  return (
    <div className="permission-admin">
      <Panel title="运营权限列表" description="支持权限搜索、模块筛选、编辑和删除">
        <div className="permission-filterbar">
          <label>
            权限搜索
            <input value={filters.keyword} placeholder="名称、标识或说明" onChange={event => onFiltersChange({ keyword: event.target.value })} />
          </label>
          <label>
            状态
            <select value={filters.status} onChange={event => onFiltersChange({ status: event.target.value })}>
              <option value="">全部状态</option>
              <option value="active">启用</option>
              <option value="draft">草稿</option>
              <option value="inactive">停用</option>
            </select>
          </label>
          <label>
            模块
            <select value={filters.module} onChange={event => onFiltersChange({ module: event.target.value })}>
              <option value="">全部模块</option>
              {permissionModuleOptions.map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </label>
          <button className="primary-button" type="button" onClick={() => void onSearch()}>
            <Icon name="refresh" />
            搜索
          </button>
          <button className="primary-button" type="button" onClick={openCreate}>
            <Icon name="plus" />
            新增权限
          </button>
        </div>

        <div className="permission-list">
          {permissions.map(permission => {
            const id = stringValue(permission, 'id');
            const status = stringValue(permission, 'status');
            return (
              <article className="permission-row" key={id}>
                <div>
                  <strong>{stringValue(permission, 'name')}</strong>
                  <small>{stringValue(permission, 'roleKey')}</small>
                </div>
                <span className={badgeClass(status)}>{statusLabel(status)}</span>
                <div className="permission-row-detail">
                  <span>模块：{permissionTextList(permission, 'modules', permissionModuleLabel)}</span>
                  <span>动作：{permissionTextList(permission, 'actions', permissionActionLabel)}</span>
                  <small>{stringValue(permission, 'description', '暂无说明')}</small>
                </div>
                <div className="permission-table-actions">
                  <button className="ghost-button" type="button" onClick={() => openEdit(permission)}>
                    <Icon name="save" />
                    编辑
                  </button>
                  <button className="ghost-button danger-button" type="button" onClick={() => void onDelete(id)}>
                    <Icon name="x" />
                    删除
                  </button>
                </div>
              </article>
            );
          })}
          {!permissions.length ? <EmptyState text="暂无运营权限" /> : null}
        </div>
      </Panel>

      {modalOpen ? (
        <div className="modal-backdrop">
          <form className="modal-panel permission-editor" onSubmit={submit}>
            <div className="modal-title-row wide">
              <div>
                <h2>{form.id ? '编辑权限' : '新增权限'}</h2>
              </div>
              <button className="ghost-button" type="button" onClick={closeModal}>
                <Icon name="x" />
                关闭
              </button>
            </div>
            <label>
              权限名称
              <input required value={form.name} placeholder="例：商品运营" onChange={event => onChange({ name: event.target.value })} />
            </label>
            <label>
              角色标识
              <input required value={form.roleKey} placeholder="例：product_operator" onChange={event => onChange({ roleKey: event.target.value })} />
            </label>
            <label>
              状态
              <select value={form.status} onChange={event => onChange({ status: event.target.value })}>
                <option value="active">启用</option>
                <option value="draft">草稿</option>
                <option value="inactive">停用</option>
              </select>
            </label>
            <label className="wide">
              说明
              <textarea value={form.description} placeholder="说明该权限适用的岗位、审批范围或限制" onChange={event => onChange({ description: event.target.value })} />
            </label>

            <fieldset className="permission-module-grid wide">
              <legend>可访问模块</legend>
              {permissionModuleOptions.map(([key, label]) => (
                <label className="permission-check" key={key}>
                  <input checked={form.modules.includes(key)} type="checkbox" onChange={() => onToggleModule(key)} />
                  <span>{label}</span>
                </label>
              ))}
            </fieldset>

            <fieldset className="permission-checkbox-grid wide">
              <legend>可执行动作</legend>
              {permissionActionOptions.map(([key, label]) => (
                <label className="permission-check" key={key}>
                  <input checked={form.actions.includes(key)} type="checkbox" onChange={() => onToggleAction(key)} />
                  <span>{label}</span>
                </label>
              ))}
            </fieldset>

            <div className="modal-actions wide">
              <button className="ghost-button" type="button" onClick={closeModal}>取消</button>
              <button className="primary-button" disabled={!form.name.trim() || !form.roleKey.trim() || !form.modules.length || !form.actions.length} type="submit">
                <Icon name="save" />
                {form.id ? '保存权限' : '创建权限'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function MallSettingsSection({
  campaigns,
  onCampaignStatus,
}: {
  campaigns: JsonRecord[];
  onCampaignStatus: (id: string, status: string) => Promise<void>;
}) {
  const visibleCampaigns = campaigns.filter(campaign => ['active', 'inactive', 'draft'].includes(stringValue(campaign, 'status')));
  return (
    <div className="page-grid">
      <Panel title="活动启停" description="管理活动启用和停用状态">
        <div className="settings-campaign-list">
          {visibleCampaigns.map(campaign => {
            const id = stringValue(campaign, 'id');
            const status = stringValue(campaign, 'status');
            return (
              <article className="settings-campaign-row" key={id}>
                <div>
                  <strong>{stringValue(campaign, 'name', '未命名活动')}</strong>
                  <small>{campaignTypeLabel(stringValue(campaign, 'campaignType'))} · 预算 {yuan(numberValue(campaign, 'budgetCents'))} · 已消耗 {yuan(numberValue(campaign, 'spentCents'))}</small>
                </div>
                <span className={badgeClass(status)}>{statusLabel(status)}</span>
                <button className="ghost-button" type="button" onClick={() => void onCampaignStatus(id, status === 'active' ? 'inactive' : 'active')}>
                  <Icon name={status === 'active' ? 'x' : 'check'} />
                  {status === 'active' ? '停用' : '启用'}
                </button>
              </article>
            );
          })}
          {!visibleCampaigns.length ? <EmptyState text="暂无可操作活动" /> : null}
        </div>
      </Panel>
    </div>
  );
}

function MallDeliveryRulesSection({
  settingsForm,
  onSettingsSave,
}: {
  settingsForm: SettingsForm;
  onSettingsSave: (form: SettingsForm) => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<SettingsForm>(settingsForm);

  useEffect(() => {
    if (!isEditing) {
      setDraft(settingsForm);
    }
  }, [isEditing, settingsForm]);

  const summaryItems = [
    { label: '配送时间', value: `${settingsForm.pickupWindowStart || '-'} - ${settingsForm.pickupWindowEnd || '-'}`, note: '用户下单后的配送服务时间' },
    { label: '配送批次', value: settingsForm.deliveryBatchTimes || '-', note: '后台生成配送任务时使用' },
    { label: '免配送费门槛', value: `${settingsForm.freeDeliveryThresholdYuan || '0.00'} 元`, note: '订单商品金额满足后免配送费' },
    { label: '默认配送费', value: `${settingsForm.defaultDeliveryFeeYuan || '0.00'} 元`, note: '未满足免配送费门槛时收取' },
    { label: '配送范围', value: settingsForm.deliveryRangeEnabled ? '启用' : '停用', note: settingsForm.deliveryRangeEnabled ? '超范围地址不可下单' : '不校验配送距离' },
    { label: '服务半径', value: settingsForm.deliveryRangeEnabled ? `${settingsForm.deliveryRangeRadiusKm || '0'} 公里` : '-', note: settingsForm.deliveryOriginAddress || `${settingsForm.deliveryOriginLatitude || '-'}, ${settingsForm.deliveryOriginLongitude || '-'}` },
    { label: '阶梯运费', value: `${deliveryFeeTierCount(settingsForm.deliveryFeeTiersText)} 档`, note: deliveryFeeTierSummary(settingsForm.deliveryFeeTiersText) },
    { label: '履约承诺', value: `${settingsForm.deliveryPromiseMinutes || '0'} 分钟`, note: '用于订单履约时效展示' },
    { label: '退款审核', value: `${settingsForm.refundReviewMinutes || '0'} 分钟`, note: '售后进入人工审核的时限' },
    { label: '冷链配送', value: settingsForm.coldChainEnabled ? '启用' : '停用', note: '影响冷链商品履约配置' },
  ];

  const updateDraft = (patch: Partial<SettingsForm>) => {
    setDraft(current => ({ ...current, ...patch }));
  };

  const submitDraft = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSettingsSave(draft);
    setIsEditing(false);
  };

  const cancelEditing = () => {
    setDraft(settingsForm);
    setIsEditing(false);
  };

  return (
    <div className="page-grid">
      <Panel title="配送规则" description="维护用户结算、自提窗口、配送批次、冷链和退款审核规则">
        {isEditing ? (
          <form className="form-grid settings-form" onSubmit={submitDraft}>
            <label>
              配送开始时间
              <input value={draft.pickupWindowStart} type="time" onChange={event => updateDraft({ pickupWindowStart: event.target.value })} />
            </label>
            <label>
              配送结束时间
              <input value={draft.pickupWindowEnd} type="time" onChange={event => updateDraft({ pickupWindowEnd: event.target.value })} />
            </label>
            <label>
              配送批次
              <input value={draft.deliveryBatchTimes} placeholder="10:00,14:00,18:00" onChange={event => updateDraft({ deliveryBatchTimes: event.target.value })} />
            </label>
            <label>
              免配送费门槛
              <input value={draft.freeDeliveryThresholdYuan} type="number" min="0" step="0.01" onChange={event => updateDraft({ freeDeliveryThresholdYuan: event.target.value })} />
            </label>
            <label>
              默认配送费
              <input value={draft.defaultDeliveryFeeYuan} type="number" min="0" step="0.01" onChange={event => updateDraft({ defaultDeliveryFeeYuan: event.target.value })} />
            </label>
            <label className="toggle-line">
              <input checked={draft.deliveryRangeEnabled} type="checkbox" onChange={event => updateDraft({ deliveryRangeEnabled: event.target.checked })} />
              启用配送范围拦截
            </label>
            <label>
              配送起点名称
              <input value={draft.deliveryOriginAddress} placeholder="仓库、门店或分拣中心" onChange={event => updateDraft({ deliveryOriginAddress: event.target.value })} />
            </label>
            <label>
              起点纬度
              <input value={draft.deliveryOriginLatitude} type="number" step="0.000001" placeholder="31.230400" onChange={event => updateDraft({ deliveryOriginLatitude: event.target.value })} />
            </label>
            <label>
              起点经度
              <input value={draft.deliveryOriginLongitude} type="number" step="0.000001" placeholder="121.473700" onChange={event => updateDraft({ deliveryOriginLongitude: event.target.value })} />
            </label>
            <label>
              服务半径（公里）
              <input value={draft.deliveryRangeRadiusKm} type="number" min="0" step="0.1" onChange={event => updateDraft({ deliveryRangeRadiusKm: event.target.value })} />
            </label>
            <label className="wide">
              阶梯运费
              <textarea value={draft.deliveryFeeTiersText} placeholder={'0-2=0\n2-3=3\n3-5=4'} onChange={event => updateDraft({ deliveryFeeTiersText: event.target.value })} />
            </label>
            <label className="wide">
              配送范围坐标（可选）
              <textarea value={draft.deliveryRangePolygon} placeholder={'31.2304,121.4737\n31.2404,121.4737\n31.2404,121.4837'} onChange={event => updateDraft({ deliveryRangePolygon: event.target.value })} />
            </label>
            <label>
              承诺分钟
              <input value={draft.deliveryPromiseMinutes} type="number" min="1" onChange={event => updateDraft({ deliveryPromiseMinutes: event.target.value })} />
            </label>
            <label>
              退款审核分钟
              <input value={draft.refundReviewMinutes} type="number" min="1" onChange={event => updateDraft({ refundReviewMinutes: event.target.value })} />
            </label>
            <label className="toggle-line">
              <input checked={draft.coldChainEnabled} type="checkbox" onChange={event => updateDraft({ coldChainEnabled: event.target.checked })} />
              启用冷链配送
            </label>
            <div className="settings-actions wide">
              <button className="ghost-button" type="button" onClick={cancelEditing}>
                <Icon name="x" />
                取消
              </button>
              <button className="primary-button" type="submit">
                <Icon name="save" />
                保存配送规则
              </button>
            </div>
          </form>
        ) : (
          <div className="settings-summary">
            <div className="settings-summary-grid">
              {summaryItems.map(item => (
                <div className="settings-summary-card" key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                  <small>{item.note}</small>
                </div>
              ))}
            </div>
            <div className="settings-actions">
              <button className="primary-button" type="button" onClick={() => setIsEditing(true)}>
                <Icon name="save" />
                编辑配送规则
              </button>
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}

function MallPaymentSplitRulesSection({
  settingsForm,
  onSettingsSave,
}: {
  settingsForm: SettingsForm;
  onSettingsSave: (form: SettingsForm) => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<SettingsForm>(settingsForm);

  useEffect(() => {
    if (!isEditing) {
      setDraft(settingsForm);
    }
  }, [isEditing, settingsForm]);

  const settlementCycleLabels: Record<string, string> = {
    'T+1': 'T+1',
    'T+3': 'T+3',
    'T+7': 'T+7',
    monthly: '月结',
  };
  const summaryItems = [
    { label: '团长佣金比例', value: `${settingsForm.leaderCommissionRate || '0'}%`, note: '按自提点订单实付金额计算' },
    { label: '平台服务费比例', value: `${settingsForm.platformServiceRate || '0'}%`, note: '从商家结算金额中扣减' },
    { label: '供应商结算周期', value: settlementCycleLabels[settingsForm.supplierSettlementCycle] || settingsForm.supplierSettlementCycle || '-', note: '用于账单和提现审核提示' },
    { label: '最低提现金额', value: `${settingsForm.withdrawMinYuan || '0.00'} 元`, note: '低于门槛不能提现' },
  ];

  const updateDraft = (patch: Partial<SettingsForm>) => {
    setDraft(current => ({ ...current, ...patch }));
  };

  const submitDraft = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSettingsSave(draft);
    setIsEditing(false);
  };

  const cancelEditing = () => {
    setDraft(settingsForm);
    setIsEditing(false);
  };

  return (
    <div className="page-grid">
      <Panel title="分账规则" description="维护商城订单的团长佣金、平台服务费、供应商结算周期和提现门槛">
        {isEditing ? (
          <form className="form-grid settings-form split-settings-form" onSubmit={submitDraft}>
            <label>
              团长佣金比例
              <input value={draft.leaderCommissionRate} type="number" min="0" max="100" step="0.1" onChange={event => updateDraft({ leaderCommissionRate: event.target.value })} />
            </label>
            <label>
              平台服务费比例
              <input value={draft.platformServiceRate} type="number" min="0" max="100" step="0.1" onChange={event => updateDraft({ platformServiceRate: event.target.value })} />
            </label>
            <label>
              供应商结算周期
              <select value={draft.supplierSettlementCycle} onChange={event => updateDraft({ supplierSettlementCycle: event.target.value })}>
                <option value="T+1">T+1</option>
                <option value="T+3">T+3</option>
                <option value="T+7">T+7</option>
                <option value="monthly">月结</option>
              </select>
            </label>
            <label>
              最低提现金额
              <input value={draft.withdrawMinYuan} type="number" min="0" step="0.01" onChange={event => updateDraft({ withdrawMinYuan: event.target.value })} />
            </label>
            <div className="settings-rule-note wide">
              <strong>当前口径</strong>
              <span>团长佣金按自提点订单实付金额计算；平台服务费从商家结算金额中扣减；供应商结算周期用于账单和提现审核提示。</span>
            </div>
            <div className="settings-actions wide">
              <button className="ghost-button" type="button" onClick={cancelEditing}>
                <Icon name="x" />
                取消
              </button>
              <button className="primary-button" type="submit">
                <Icon name="save" />
                保存分账规则
              </button>
            </div>
          </form>
        ) : (
          <div className="settings-summary">
            <div className="settings-summary-grid">
              {summaryItems.map(item => (
                <div className="settings-summary-card" key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                  <small>{item.note}</small>
                </div>
              ))}
            </div>
            <div className="settings-rule-note">
              <strong>当前口径</strong>
              <span>团长佣金按自提点订单实付金额计算；平台服务费从商家结算金额中扣减；供应商结算周期用于账单和提现审核提示。</span>
            </div>
            <div className="settings-actions">
              <button className="primary-button" type="button" onClick={() => setIsEditing(true)}>
                <Icon name="save" />
                编辑分账规则
              </button>
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}

function SupportDataSection({
  stats,
  sessions,
  tickets,
  afterSales,
  knowledge,
}: {
  stats: ReturnType<typeof supportDashboardStats>;
  sessions: JsonRecord[];
  tickets: JsonRecord[];
  afterSales: JsonRecord[];
  knowledge: JsonRecord[];
}) {
  const pendingTickets = tickets.filter(ticket => isOpenSupportStatus(orderStatus(ticket))).slice(0, 5);
  const pendingAfterSales = afterSales.filter(item => isOpenSupportStatus(orderStatus(item))).slice(0, 5);

  return (
    <div className="page-grid support-data-page">
      <div className="stat-grid compact">
        <StatCard label="待响应会话" value={String(stats.openSessions)} detail={`${stats.avgFirstResponseMinutes || 0} 分钟首响`} />
        <StatCard label="未结工单" value={String(stats.openTickets)} detail={`${stats.ticketResolutionRate}% 工单解决率`} />
        <StatCard label="待处理售后" value={String(stats.pendingAfterSales)} detail={`${stats.refundingAfterSales} 单退款中`} />
        <StatCard label="售后金额" value={yuan(stats.afterSalesAmountCents)} detail={`${stats.knowledgeArticles || knowledge.length} 篇知识库`} />
      </div>

      <div className="support-data-grid">
        <Panel title="服务质量" description="客服售后指标">
          <div className="support-data-board">
            <article>
              <span>满意度</span>
              <strong>{stats.satisfaction || 0}%</strong>
              <small>来自客服服务记录</small>
            </article>
            <article>
              <span>会话总量</span>
              <strong>{sessions.length}</strong>
              <small>小程序与 Web 咨询</small>
            </article>
            <article>
              <span>工单总量</span>
              <strong>{tickets.length}</strong>
              <small>内部跟进和跨岗位协同</small>
            </article>
            <article>
              <span>售后总量</span>
              <strong>{afterSales.length}</strong>
              <small>退款、坏果包赔、缺件</small>
            </article>
          </div>
        </Panel>

        <Panel title="今日优先处理" description="优先待办">
          <div className="support-priority-list">
            {pendingAfterSales.map(item => (
              <article key={`sale-${stringValue(item, 'id')}`}>
                <strong>{stringValue(item, 'orderNo', shortId(stringValue(item, 'orderId')))}</strong>
                <span>{stringValue(item, 'reason', '售后申请')} · {yuan(numberValue(item, 'amountCents'))}</span>
                <small>{stringValue(item, 'recipientName', stringValue(item, 'userPhone', '用户'))} · {formatDate(stringValue(item, 'createdAt'))}</small>
              </article>
            ))}
            {pendingTickets.map(ticket => (
              <article key={`ticket-${stringValue(ticket, 'id')}`}>
                <strong>{stringValue(ticket, 'title')}</strong>
                <span>{supportCategoryLabel(stringValue(ticket, 'category'))} · {priorityLabel(stringValue(ticket, 'priority'))}</span>
                <small>{statusLabel(stringValue(ticket, 'status'))} · {formatDate(stringValue(ticket, 'updatedAt'))}</small>
              </article>
            ))}
            {!pendingAfterSales.length && !pendingTickets.length ? <EmptyState text="暂无优先待办" /> : null}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function SupportSection({
  metrics,
  sessions,
  filters,
  form,
  selectedSessionId,
  messages,
  onFiltersChange,
  onClearFilters,
  onFormChange,
  onSelectSession,
  onCreateSession,
  onSendMessage,
}: {
  metrics: JsonRecord;
  sessions: JsonRecord[];
  filters: SupportFilterState;
  form: SupportForm;
  selectedSessionId: string;
  messages: JsonRecord[];
  onFiltersChange: (patch: Partial<SupportFilterState>) => void;
  onClearFilters: () => void;
  onFormChange: (patch: Partial<SupportForm>) => void;
  onSelectSession: (id: string) => Promise<void>;
  onCreateSession: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onSendMessage: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  const selectedSession = sessions.find(session => stringValue(session, 'id') === selectedSessionId);
  const quickReplies = [
    '您好，已收到反馈，我先核实订单和配送记录。',
    '这边已经为您标记优先处理，会在 10 分钟内给出处理方案。',
    '如果商品有破损、坏果或少件，请补充照片，我们会按售后规则处理。',
  ];

  return (
    <div className="page-grid support-workbench">
      <Panel title="客服会话筛选" description="用户咨询和消息回复">
        <div className="support-filterbar support-filterbar-sessions">
          <label>
            关键词
            <input value={filters.keyword} onChange={event => onFiltersChange({ keyword: event.target.value })} placeholder="用户编号 / 主题 / 最近消息" />
          </label>
          <label>
            状态
            <select value={filters.status} onChange={event => onFiltersChange({ status: event.target.value })}>
              <option value="open">待处理</option>
              <option value="">全部</option>
              <option value="resolved">已解决</option>
              <option value="closed">已关闭</option>
            </select>
          </label>
          <button className="ghost-button" type="button" onClick={onClearFilters}>
            <Icon name="refresh" />
            重置
          </button>
        </div>
      </Panel>

      <div className="support-session-shell">
        <Panel title="会话队列" description="按最近更新时间排序，客服先看用户、主题和最后一句话">
          <form className="inline-form support-create-session" onSubmit={onCreateSession}>
            <input value={form.userId} onChange={event => onFormChange({ userId: event.target.value })} placeholder="用户编号" />
            <input value={form.topic} onChange={event => onFormChange({ topic: event.target.value })} placeholder="会话主题" />
            <button className="primary-button small" type="submit">
              <Icon name="plus" />
              新建
            </button>
          </form>
          <div className="support-session-list">
            {sessions.map(session => {
              const id = stringValue(session, 'id');
              const status = stringValue(session, 'status');
              return (
                <button className={`session-row ${selectedSessionId === id ? 'selected' : ''}`} key={id} type="button" onClick={() => onSelectSession(id)}>
                  <div>
                    <strong>{stringValue(session, 'topic', '未命名咨询')}</strong>
                    <span className={badgeClass(status)}>{statusLabel(status)}</span>
                  </div>
                  <p>{stringValue(session, 'lastMessage', '暂无消息')}</p>
                  <small>{shortId(stringValue(session, 'userId'))} · {stringValue(session, 'channel', 'web')} · {formatDate(stringValue(session, 'updatedAt'))}</small>
                </button>
              );
            })}
            {!sessions.length ? <EmptyState text="暂无匹配会话" /> : null}
          </div>
        </Panel>

        <div className="support-conversation">
          <Panel
            title={selectedSession ? stringValue(selectedSession, 'topic') : '当前会话'}
            description={selectedSession ? `用户 ${shortId(stringValue(selectedSession, 'userId'))} · ${formatDate(stringValue(selectedSession, 'updatedAt'))}` : '从左侧选择会话后查看上下文并回复'}
            action={selectedSession ? <span className={badgeClass(stringValue(selectedSession, 'status'))}>{statusLabel(stringValue(selectedSession, 'status'))}</span> : null}
          >
            <div className="message-list">
              {messages.map(message => {
                const senderRole = stringValue(message, 'senderRole');
                const isAgent = ['agent', 'admin', 'support'].includes(senderRole);
                return (
                  <article className={`message ${isAgent ? 'agent' : 'customer'}`} key={stringValue(message, 'id')}>
                    <span>{roleLabel(senderRole)} · {formatDate(stringValue(message, 'createdAt'))}</span>
                    <p>{stringValue(message, 'content')}</p>
                  </article>
                );
              })}
              {!messages.length ? <EmptyState text="选择会话后显示消息" /> : null}
            </div>
            <div className="quick-replies">
              {quickReplies.map(reply => (
                <button className="ghost-button small" key={reply} type="button" onClick={() => onFormChange({ message: reply })}>
                  {reply}
                </button>
              ))}
            </div>
            <form className="send-form support-message-composer" onSubmit={onSendMessage}>
              <textarea value={form.message} placeholder="输入给用户的回复" onChange={event => onFormChange({ message: event.target.value })} />
              <button className="primary-button" type="submit" disabled={!selectedSessionId || !form.message.trim()}>
                <Icon name="send" />
                发送
              </button>
            </form>
          </Panel>
        </div>

        <Panel title="用户上下文" description="客服回复前需要先看用户、渠道和 SLA">
          <div className="support-context-panel">
            <article>
              <span>用户</span>
              <strong>{selectedSession ? shortId(stringValue(selectedSession, 'userId')) : '-'}</strong>
            </article>
            <article>
              <span>渠道</span>
              <strong>{selectedSession ? stringValue(selectedSession, 'channel', 'web') : '-'}</strong>
            </article>
            <article>
              <span>首响 SLA</span>
              <strong>{metricValue(metrics, ['avgFirstResponseMinutes'])} 分钟</strong>
            </article>
            <article>
              <span>最近更新</span>
              <strong>{selectedSession ? formatDate(stringValue(selectedSession, 'updatedAt')) : '-'}</strong>
            </article>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function AfterSalesSection({
  afterSales,
  filters,
  onFiltersChange,
  onClearFilters,
  onViewAfterSaleOrder,
  onUpdateAfterSale,
}: {
  afterSales: JsonRecord[];
  filters: SupportFilterState;
  onFiltersChange: (patch: Partial<SupportFilterState>) => void;
  onClearFilters: () => void;
  onViewAfterSaleOrder: (id: string) => Promise<void>;
  onUpdateAfterSale: (id: string, status: string, handlingMethod: string, resolution: string, extra?: JsonRecord) => Promise<void>;
}) {
  return (
    <div className="page-grid support-workbench">
      <Panel title="售后申请筛选">
        <div className="support-filterbar">
          <label>
            关键词
            <input value={filters.keyword} onChange={event => onFiltersChange({ keyword: event.target.value })} placeholder="订单号/手机号/商品/原因" />
          </label>
          <label>
            状态
            <select value={filters.status} onChange={event => onFiltersChange({ status: event.target.value })}>
              <option value="open">待处理</option>
              <option value="">全部</option>
              <option value="submitted">已提交</option>
              <option value="negotiating">协商中</option>
              <option value="approved">已通过</option>
              <option value="returning">退货中</option>
              <option value="exchange_processing">换货中</option>
              <option value="refunding">退款中</option>
              <option value="refunded">已退款</option>
              <option value="resolved">已完成</option>
              <option value="rejected">已驳回</option>
              <option value="closed">已关闭</option>
            </select>
          </label>
          <button className="ghost-button" type="button" onClick={onClearFilters}>
            <Icon name="refresh" />
            重置
          </button>
        </div>
      </Panel>

      <Panel title="售后申请列表">
        <div className="support-after-sales">
          {afterSales.map(item => {
            const id = stringValue(item, 'id');
            const orderId = stringValue(item, 'orderId');
            const status = stringValue(item, 'status');
            const type = stringValue(item, 'afterSaleType', stringValue(item, 'solutionType', 'refund_only'));
            const evidenceImages = arrayValue(item, 'evidenceImages');
            const requestedAmount = numberValue(item, 'requestedAmountCents', numberValue(item, 'amountCents'));
            const approvedAmount = numberValue(item, 'approvedAmountCents');
            return (
              <article className="support-after-sale-row" key={id}>
                <div>
                  <strong>{stringValue(item, 'orderNo', shortId(orderId))}</strong>
                  <span>售后类型：{afterSaleTypeLabel(type)} · {stringValue(item, 'reason', '售后申请')}</span>
                  <small>{stringValue(item, 'recipientName', stringValue(item, 'userPhone', '用户'))} · {stringValue(item, 'recipientPhone')} · {formatDate(stringValue(item, 'createdAt'))}</small>
                  <p>{stringValue(item, 'description', '暂无说明')}</p>
                  <small>{afterSaleSelectedItemsText(item)}</small>
                  <small>申请 {yuan(requestedAmount)}{approvedAmount ? ` · 审核 ${yuan(approvedAmount)}` : ''} · {statusLabel(stringValue(item, 'negotiationStatus', 'pending'))} · 证据 {evidenceImages.length} 张</small>
                </div>
                <span className={badgeClass(status)}>{statusLabel(status)}</span>
                <div className="support-row-actions">
                  <button className="ghost-button small" type="button" onClick={() => onViewAfterSaleOrder(orderId)}>
                    <Icon name="orders" />
                    查看订单
                  </button>
                  <button
                    className="ghost-button small"
                    type="button"
                    onClick={() => onUpdateAfterSale(id, 'negotiating', '客服协商', '客服已介入协商', {
                      negotiationStatus: 'negotiating',
                    })}
                  >
                    <Icon name="support" />
                    协商中
                  </button>
                  <button
                    className="ghost-button small"
                    type="button"
                    onClick={() => onUpdateAfterSale(id, 'approved', afterSaleTypeLabel(type), '审核通过，等待执行处理方案', {
                      solutionType: type,
                      negotiationStatus: 'agreed',
                      approvedAmountCents: requestedAmount,
                    })}
                  >
                    <Icon name="check" />
                    通过
                  </button>
                  {type === 'return_refund' ? (
                    <button
                      className="ghost-button small"
                      type="button"
                      onClick={() => onUpdateAfterSale(id, 'returning', '退货退款', '等待用户寄回或配送员取回商品', {
                        solutionType: 'return_refund',
                        negotiationStatus: 'agreed',
                      })}
                    >
                      <Icon name="truck" />
                      退货中
                    </button>
                  ) : null}
                  {type === 'exchange' ? (
                    <button
                      className="ghost-button small"
                      type="button"
                      onClick={() => onUpdateAfterSale(id, 'exchange_processing', '换货', '已安排换货配送', {
                        solutionType: 'exchange',
                        negotiationStatus: 'agreed',
                      })}
                    >
                      <Icon name="refresh" />
                      换货中
                    </button>
                  ) : null}
                  {type !== 'exchange' ? (
                    <button
                      className="ghost-button small"
                      type="button"
                      onClick={() => onUpdateAfterSale(id, 'refunding', '原路退款', '退款处理中', {
                        solutionType: type,
                        negotiationStatus: 'agreed',
                        approvedAmountCents: approvedAmount || requestedAmount,
                      })}
                    >
                      <Icon name="refund" />
                      退款中
                    </button>
                  ) : null}
                  <button
                    className="ghost-button small"
                    type="button"
                    onClick={() => onUpdateAfterSale(id, type === 'exchange' ? 'resolved' : 'refunded', type === 'exchange' ? '换货完成' : '原路退款', type === 'exchange' ? '换货已完成' : '退款已完成', {
                      solutionType: type,
                      negotiationStatus: 'agreed',
                      approvedAmountCents: type === 'exchange' ? approvedAmount : approvedAmount || requestedAmount,
                    })}
                  >
                    <Icon name="refund" />
                    完成
                  </button>
                  <button className="ghost-button small danger" type="button" onClick={() => onUpdateAfterSale(id, 'rejected', '人工驳回', '证据不足或不符合售后规则')}>
                    <Icon name="x" />
                    驳回
                  </button>
                </div>
              </article>
            );
          })}
          {!afterSales.length ? <EmptyState text="暂无售后申请" /> : null}
        </div>
      </Panel>
    </div>
  );
}

function SupportTicketsSection({
  tickets,
  filters,
  form,
  onFiltersChange,
  onClearFilters,
  onFormChange,
  onCreateTicket,
  onResolveTicket,
}: {
  tickets: JsonRecord[];
  filters: SupportFilterState;
  form: SupportForm;
  onFiltersChange: (patch: Partial<SupportFilterState>) => void;
  onClearFilters: () => void;
  onFormChange: (patch: Partial<SupportForm>) => void;
  onCreateTicket: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onResolveTicket: (id: string) => Promise<void>;
}) {
  return (
    <div className="page-grid support-workbench">
      <Panel title="客服工单筛选" description="内部跟进事项">
        <div className="support-filterbar">
          <label>
            关键词
            <input value={filters.keyword} onChange={event => onFiltersChange({ keyword: event.target.value })} placeholder="标题/订单/用户/说明" />
          </label>
          <label>
            状态
            <select value={filters.status} onChange={event => onFiltersChange({ status: event.target.value })}>
              <option value="open">待处理</option>
              <option value="">全部</option>
              <option value="resolved">已解决</option>
              <option value="closed">已关闭</option>
            </select>
          </label>
          <label>
            分类
            <select value={filters.category} onChange={event => onFiltersChange({ category: event.target.value })}>
              <option value="">全部分类</option>
              <option value="delivery">配送</option>
              <option value="after_sales">售后</option>
              <option value="payment">支付</option>
              <option value="product">商品</option>
              <option value="account">账号</option>
            </select>
          </label>
          <label>
            优先级
            <select value={filters.priority} onChange={event => onFiltersChange({ priority: event.target.value })}>
              <option value="">全部优先级</option>
              <option value="urgent">紧急</option>
              <option value="high">高</option>
              <option value="normal">普通</option>
              <option value="low">低</option>
            </select>
          </label>
          <button className="ghost-button" type="button" onClick={onClearFilters}>
            <Icon name="refresh" />
            重置
          </button>
        </div>
      </Panel>

      <div className="support-ticket-board">
        <Panel title="内部跟进工单" description="跨岗位事项处理">
          <form className="support-ticket-form" onSubmit={onCreateTicket}>
            <input required value={form.ticketTitle} onChange={event => onFormChange({ ticketTitle: event.target.value })} placeholder="工单标题" />
            <input value={form.userId} onChange={event => onFormChange({ userId: event.target.value })} placeholder="用户编号" />
            <input value={form.ticketOrderId} onChange={event => onFormChange({ ticketOrderId: event.target.value })} placeholder="订单编号" />
            <select value={form.ticketCategory} onChange={event => onFormChange({ ticketCategory: event.target.value })}>
              <option value="delivery">配送</option>
              <option value="after_sales">售后</option>
              <option value="payment">支付</option>
              <option value="product">商品</option>
              <option value="account">账号</option>
            </select>
            <select value={form.ticketPriority} onChange={event => onFormChange({ ticketPriority: event.target.value })}>
              <option value="urgent">紧急</option>
              <option value="high">高</option>
              <option value="normal">普通</option>
              <option value="low">低</option>
            </select>
            <button className="primary-button" type="submit">
              <Icon name="plus" />
              新建工单
            </button>
          </form>
          <div className="list-stack">
            {tickets.map(ticket => {
              const id = stringValue(ticket, 'id');
              const status = stringValue(ticket, 'status');
              return (
                <article className="list-row support-ticket-row" key={id}>
                  <div>
                    <strong>{stringValue(ticket, 'title')}</strong>
                    <small>{supportCategoryLabel(stringValue(ticket, 'category'))} · {priorityLabel(stringValue(ticket, 'priority'))} · {formatDate(stringValue(ticket, 'updatedAt'))}</small>
                    <small>{stringValue(ticket, 'description', '暂无说明')}</small>
                  </div>
                  <span className={badgeClass(status)}>{statusLabel(status)}</span>
                  <button className="ghost-button" type="button" onClick={() => onResolveTicket(id)} disabled={status === 'resolved'}>
                    <Icon name="check" />
                    解决
                  </button>
                </article>
              );
            })}
            {!tickets.length ? <EmptyState text="暂无匹配工单" /> : null}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function SupportKnowledgeSection({
  knowledge,
  form,
  onFormChange,
  onCreateKnowledge,
  onUpdateKnowledgeStatus,
}: {
  knowledge: JsonRecord[];
  form: SupportForm;
  onFormChange: (patch: Partial<SupportForm>) => void;
  onCreateKnowledge: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onUpdateKnowledgeStatus: (id: string, status: string) => Promise<void>;
}) {
  return (
    <div className="page-grid support-workbench">
      <div className="support-knowledge-panel">
        <Panel title="客服知识库" description="FAQ、坏果包赔、退款、配送和团长自提话术">
          <form className="form-grid" onSubmit={onCreateKnowledge}>
            <label>
              标题
              <input required value={form.knowledgeTitle} onChange={event => onFormChange({ knowledgeTitle: event.target.value })} />
            </label>
            <label>
              分类
              <input required value={form.knowledgeCategory} onChange={event => onFormChange({ knowledgeCategory: event.target.value })} />
            </label>
            <label className="wide">
              内容
              <textarea required value={form.knowledgeContent} onChange={event => onFormChange({ knowledgeContent: event.target.value })} />
            </label>
            <button className="primary-button wide" type="submit">
              <Icon name="save" />
              发布知识
            </button>
          </form>
          <div className="knowledge-list">
            {knowledge.map(article => {
              const id = stringValue(article, 'id');
              const status = stringValue(article, 'status');
              return (
                <article key={id}>
                  <strong>{stringValue(article, 'title')}</strong>
                  <small>{stringValue(article, 'category')} · {statusLabel(status)} · {formatDate(stringValue(article, 'updatedAt'))}</small>
                  <p>{stringValue(article, 'content')}</p>
                  <div className="support-row-actions">
                    <button className="ghost-button small" type="button" onClick={() => onUpdateKnowledgeStatus(id, status === 'published' ? 'draft' : 'published')}>
                      <Icon name={status === 'published' ? 'x' : 'check'} />
                      {status === 'published' ? '下线' : '发布'}
                    </button>
                  </div>
                </article>
              );
            })}
            {!knowledge.length ? <EmptyState text="暂无知识库内容" /> : null}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function LoginScreen({
  error,
  loading,
  onSubmit,
}: {
  error: string;
  loading: boolean;
  onSubmit: (form: LoginForm) => Promise<void>;
}) {
  const [form, setForm] = useState<LoginForm>({ phone: '', password: '', captchaId: '', captchaCode: '' });
  const [captchaImage, setCaptchaImage] = useState('');
  const [captchaLoading, setCaptchaLoading] = useState(false);
  const [captchaError, setCaptchaError] = useState('');

  const loadCaptcha = async () => {
    setCaptchaLoading(true);
    setCaptchaError('');
    try {
      const captcha = await apiGet<JsonRecord>('/api/auth/captcha');
      const captchaId = stringValue(captcha, 'captchaId');
      const image = stringValue(captcha, 'image');
      if (!captchaId || !image) {
        throw new Error('验证码返回内容不完整');
      }
      setCaptchaImage(image);
      setForm(current => ({ ...current, captchaId, captchaCode: '' }));
    } catch (loadError) {
      setCaptchaImage('');
      setForm(current => ({ ...current, captchaId: '', captchaCode: '' }));
      setCaptchaError(loadError instanceof Error ? loadError.message : '验证码加载失败');
    } finally {
      setCaptchaLoading(false);
    }
  };

  useEffect(() => {
    void loadCaptcha();
  }, []);

  useEffect(() => {
    if (error) {
      void loadCaptcha();
    }
  }, [error]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.captchaId) {
      setCaptchaError('请刷新图形验证码');
      return;
    }
    if (!form.captchaCode.trim()) {
      setCaptchaError('请输入图形验证码');
      return;
    }
    await onSubmit({
      phone: form.phone.trim(),
      password: form.password,
      captchaId: form.captchaId,
      captchaCode: form.captchaCode.trim(),
    });
  };

  return (
    <main className="login-shell">
      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-brand">
          <div className="brand-mark">R</div>
          <div>
            <strong>RecoRouter</strong>
            <span>Web 管理平台</span>
          </div>
        </div>
        <div className="login-copy">
          <h1 id="login-title">管理员登录</h1>
          <p>使用管理员账号进入运营看板、商城与客服工作台。</p>
        </div>
        <form className="login-form" onSubmit={submit}>
          <label>
            手机号
            <input
              autoComplete="username"
              inputMode="tel"
              placeholder="请输入管理员手机号"
              type="tel"
              value={form.phone}
              onChange={event => setForm(current => ({ ...current, phone: event.target.value }))}
            />
          </label>
          <label>
            密码
            <input
              autoComplete="current-password"
              placeholder="请输入密码"
              type="password"
              value={form.password}
              onChange={event => setForm(current => ({ ...current, password: event.target.value }))}
            />
          </label>
          <label>
            图形验证码
            <div className="login-captcha-row">
              <input
                autoComplete="off"
                inputMode="text"
                maxLength={6}
                placeholder="请输入验证码"
                value={form.captchaCode}
                onChange={event => setForm(current => ({ ...current, captchaCode: event.target.value.toUpperCase() }))}
              />
              <button
                aria-label="刷新验证码"
                className="login-captcha-button"
                disabled={captchaLoading}
                type="button"
                onClick={() => void loadCaptcha()}
              >
                {captchaImage ? <img alt="图形验证码" src={captchaImage} /> : <span>{captchaLoading ? '加载中' : '刷新验证码'}</span>}
              </button>
            </div>
          </label>
          {captchaError ? <div className="login-error">{captchaError}</div> : null}
          {error ? <div className="login-error">{error}</div> : null}
          <button className="primary-button login-submit" disabled={loading || captchaLoading || !form.phone.trim() || !form.password || !form.captchaId || !form.captchaCode.trim()} type="submit">
            {loading ? '登录中...' : '登录管理端'}
          </button>
        </form>
      </section>
    </main>
  );
}

function AdminMessageHost({
  messages,
  onDismiss,
}: {
  messages: AdminMessageItem[];
  onDismiss: (id: string) => void;
}) {
  if (!messages.length) return null;

  return (
    <div className="admin-message-stack" role="status" aria-live="polite">
      {messages.map(message => (
        <div className={`admin-message admin-message-${message.type}`} key={message.id}>
          <span>{message.content}</span>
          <button type="button" aria-label="关闭消息" onClick={() => onDismiss(message.id)}>×</button>
        </div>
      ))}
    </div>
  );
}

function AdminMessageBox({
  messages,
  open,
  onClear,
  onToggle,
}: {
  messages: AdminMessageItem[];
  open: boolean;
  onClear: () => void;
  onToggle: () => void;
}) {
  const recentMessages = messages.slice(0, 20);
  return (
    <div className="admin-message-box">
      <button className="message-box-button" type="button" onClick={onToggle}>
        消息
        {messages.length ? <span>{messages.length > 99 ? '99+' : messages.length}</span> : null}
      </button>
      {open ? (
        <div className="message-box-popover">
          <div className="message-box-head">
            <strong>消息盒子</strong>
            <button type="button" onClick={onClear}>清空</button>
          </div>
          <div className="message-box-list">
            {recentMessages.map(message => (
              <article className={`message-box-item message-box-item-${message.type}`} key={message.id}>
                <span>{message.content}</span>
                <small>{formatMessageTime(message.createdAt)}</small>
              </article>
            ))}
            {!recentMessages.length ? <div className="message-box-empty">暂无消息</div> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function App() {
  const initialAdminRoute = getInitialAdminRouteState();
  const [session, setSession] = useState<AdminSession | null>(() => getStoredAdminSession());
  const [activeModuleKey, setActiveModuleKey] = useState<AdminModuleKey>(initialAdminRoute.moduleKey);
  const [activePageKey, setActivePageKey] = useState(initialAdminRoute.pageKey);
  const [data, setData] = useState<DashboardData>(initialData);
  const [errors, setErrors] = useState<LoadErrors>({});
  const [loading, setLoading] = useState(() => Boolean(getStoredAdminSession()));
  const [busy, setBusy] = useState('');
  const [, setNotice] = useState('正在加载管理数据');
  const [messages, setMessages] = useState<AdminMessageItem[]>([]);
  const [messageHistory, setMessageHistory] = useState<AdminMessageItem[]>([]);
  const [messageBoxOpen, setMessageBoxOpen] = useState(false);
  const messageTimers = useRef<Record<string, number>>({});
  const groupBuyDetailRequest = useRef('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [moduleSwitcherCollapsed, setModuleSwitcherCollapsed] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [productForm, setProductForm] = useState<ProductForm>(initialProductForm);
  const [campaignForm, setCampaignForm] = useState<CampaignForm>(initialCampaignForm);
  const [fixedPriceCampaignForm, setFixedPriceCampaignForm] = useState<FixedPriceCampaignForm>(initialFixedPriceCampaignForm);
  const [promotionVenueForm, setPromotionVenueForm] = useState<PromotionVenueForm>(initialPromotionVenueForm);
  const [groupBuyForm, setGroupBuyForm] = useState<GroupBuyForm>(emptyGroupBuyForm);
  const [groupBuyModalOpen, setGroupBuyModalOpen] = useState(false);
  const [groupBuySubscriptions, setGroupBuySubscriptions] = useState<JsonRecord[]>([]);
  const [groupBuyDetailOpen, setGroupBuyDetailOpen] = useState(false);
  const [groupBuyDetailActivity, setGroupBuyDetailActivity] = useState<JsonRecord | null>(null);
  const [couponForm, setCouponForm] = useState<CouponForm>(initialCouponForm);
  const [homeBannerForm, setHomeBannerForm] = useState<HomeBannerForm>(initialHomeBannerForm);
  const [homeSectionForm, setHomeSectionForm] = useState<HomeSectionForm>(initialHomeSectionForm);
  const [settingsForm, setSettingsForm] = useState<SettingsForm>(initialSettingsForm);
  const [permissionForm, setPermissionForm] = useState<MallPermissionForm>(initialPermissionForm);
  const [supportForm, setSupportForm] = useState<SupportForm>(initialSupportForm);
  const [categoryForm, setCategoryForm] = useState<CategoryForm>(initialCategoryForm);
  const [procurementBuyerForm, setProcurementBuyerForm] = useState<ProcurementBuyerForm>(initialProcurementBuyerForm);
  const [productFilters, setProductFilters] = useState<MallFilterState>(initialProductFilters);
  const [categoryFilters, setCategoryFilters] = useState<MallFilterState>(initialCategoryFilters);
  const [inventoryFilters, setInventoryFilters] = useState<MallFilterState>(initialInventoryFilters);
  const [pickupPointFilters, setPickupPointFilters] = useState<PickupPointFilterState>(initialPickupPointFilters);
  const [groupLeaderFilters, setGroupLeaderFilters] = useState<GroupLeaderFilterState>(initialGroupLeaderFilters);
  const [campaignFilters, setCampaignFilters] = useState<MallFilterState>(initialProductFilters);
  const [couponFilters, setCouponFilters] = useState<MallFilterState>(initialProductFilters);
  const [homeBannerFilters, setHomeBannerFilters] = useState<MallFilterState>(initialProductFilters);
  const [permissionFilters, setPermissionFilters] = useState<MallPermissionFilterState>(initialPermissionFilters);
  const [mallOpsFilters, setMallOpsFilters] = useState<MallOpsFilterState>(initialMallOpsFilters);
  const [withdrawalForm, setWithdrawalForm] = useState<WithdrawalForm>(initialWithdrawalForm);
  const [supportFilters, setSupportFilters] = useState<SupportFilterState>(initialSupportFilters);
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [supportMessages, setSupportMessages] = useState<JsonRecord[]>([]);
  const [mallOrderDetailModalOpen, setMallOrderDetailModalOpen] = useState(false);
  const [mallOrderDetail, setMallOrderDetail] = useState<JsonRecord | null>(null);
  const [mallOrderDetailLoading, setMallOrderDetailLoading] = useState(false);
  const [mallOrderDetailError, setMallOrderDetailError] = useState('');
  const [mallOrderSearchFilters, setMallOrderSearchFilters] = useState<MallOrderDetailSearchFilters>(initialMallOrderDetailSearchFilters);
  const [mallOrderSearchResults, setMallOrderSearchResults] = useState<JsonRecord[]>([]);
  const [mallOrderSearchLoading, setMallOrderSearchLoading] = useState(false);
  const [mallOrderSearchError, setMallOrderSearchError] = useState('');
  const [weightAdjustmentItem, setWeightAdjustmentItem] = useState<JsonRecord | null>(null);
  const [weightAdjustmentSaving, setWeightAdjustmentSaving] = useState(false);

  const currentModule = useMemo(
    () => adminModules.find(module => module.key === activeModuleKey) || adminModules[0],
    [activeModuleKey],
  );
  const currentPage = useMemo(
    () => currentModule.pages.find(page => page.key === activePageKey) || currentModule.pages[0],
    [activePageKey, currentModule],
  );
  const rawAfterSalesQueue = useMemo(
    () => (data.mallAfterSales.length ? data.mallAfterSales : buildAfterSalesQueue(data.mallOrders)),
    [data.mallAfterSales, data.mallOrders],
  );
  const afterSalesQueue = useMemo(
    () => filterSupportRecords(rawAfterSalesQueue, supportFilters, ['orderNo', 'reason', 'description', 'recipientName', 'recipientPhone', 'productName', 'userId', 'userPhone']),
    [rawAfterSalesQueue, supportFilters],
  );
  const supportStats = useMemo(
    () => supportDashboardStats(data, rawAfterSalesQueue),
    [data, rawAfterSalesQueue],
  );
  const filteredSupportSessions = useMemo(
    () => filterSupportRecords(data.supportSessions, supportFilters, ['topic', 'lastMessage', 'userId', 'channel']),
    [data.supportSessions, supportFilters],
  );
  const filteredSupportTickets = useMemo(
    () => filterSupportRecords(data.supportTickets, supportFilters, ['title', 'description', 'category', 'priority', 'userId', 'orderId']),
    [data.supportTickets, supportFilters],
  );

  const dismissMessage = useCallback((id: string) => {
    const timer = messageTimers.current[id];
    if (timer) {
      window.clearTimeout(timer);
      delete messageTimers.current[id];
    }
    setMessages(current => current.filter(message => message.id !== id));
  }, []);

  const showMessage = useCallback<AdminMessageHandler>((type, content) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const message = { id, type, content, createdAt: Date.now() };
    setMessages(current => [...current.slice(-3), message]);
    setMessageHistory(current => [message, ...current].slice(0, 80));
    messageTimers.current[id] = window.setTimeout(() => dismissMessage(id), 3000);
  }, [dismissMessage]);

  useEffect(() => () => {
    Object.values(messageTimers.current).forEach(timer => window.clearTimeout(timer));
    messageTimers.current = {};
  }, []);

  useEffect(() => {
    const syncAdminRouteFromLocation = () => {
      const nextRoute = getInitialAdminRouteState();
      setActiveModuleKey(nextRoute.moduleKey);
      setActivePageKey(nextRoute.pageKey);
    };

    window.addEventListener('hashchange', syncAdminRouteFromLocation);
    window.addEventListener('popstate', syncAdminRouteFromLocation);
    writeAdminRouteToLocation(activePageKey, 'replace');
    return () => {
      window.removeEventListener('hashchange', syncAdminRouteFromLocation);
      window.removeEventListener('popstate', syncAdminRouteFromLocation);
    };
  }, []);

  const resetDashboardState = () => {
    setData(initialData);
    setErrors({});
    setSupportMessages([]);
    setSelectedSessionId('');
    setSupportFilters(initialSupportFilters);
    setMallOrderDetailModalOpen(false);
    setMallOrderDetail(null);
    setMallOrderDetailLoading(false);
    setMallOrderDetailError('');
    setMallOrderSearchFilters(initialMallOrderDetailSearchFilters);
    setMallOrderSearchResults([]);
    setMallOrderSearchLoading(false);
    setMallOrderSearchError('');
    setProductFilters(initialProductFilters);
    setCategoryFilters(initialCategoryFilters);
    setInventoryFilters(initialInventoryFilters);
    setCampaignForm(initialCampaignForm);
    setFixedPriceCampaignForm(initialFixedPriceCampaignForm);
    setPromotionVenueForm(initialPromotionVenueForm);
    setGroupBuyForm(emptyGroupBuyForm);
    setGroupBuyModalOpen(false);
    setGroupBuySubscriptions([]);
    setGroupBuyDetailOpen(false);
    setGroupBuyDetailActivity(null);
    setCouponForm(initialCouponForm);
    setHomeBannerForm(initialHomeBannerForm);
    setHomeSectionForm(initialHomeSectionForm);
    setPermissionForm(initialPermissionForm);
    setCampaignFilters(initialProductFilters);
    setCouponFilters(initialProductFilters);
    setHomeBannerFilters(initialProductFilters);
    setPermissionFilters(initialPermissionFilters);
    setPickupPointFilters(initialPickupPointFilters);
    setGroupLeaderFilters(initialGroupLeaderFilters);
    setMallOpsFilters(initialMallOpsFilters);
    setWithdrawalForm(initialWithdrawalForm);
    setLogoutConfirmOpen(false);
    setBusy('');
    setLoading(false);
  };

  const reload = async (overrides: { productFilters?: MallFilterState } = {}) => {
    if (!getStoredAdminSession()) {
      setLoading(false);
      return;
    }

    const nextProductFilters = overrides.productFilters || productFilters;
    setLoading(true);
    const result = await fetchDashboardData(
      nextProductFilters,
      categoryFilters,
      inventoryFilters,
      campaignFilters,
      couponFilters,
      homeBannerFilters,
      permissionFilters,
      pickupPointFilters,
      groupLeaderFilters,
    );

    if (!getStoredAdminSession()) {
      setLoading(false);
      return;
    }

    setData(result.data);
    setErrors(result.errors);
    setLoading(false);
    setNotice(Object.keys(result.errors).length ? '部分数据暂不可用，已显示可用内容' : '管理数据已更新');
  };

  const refreshDispatchData = async () => {
    try {
      const [tripsRes, undispatchedRes, allOrdersRes, vehiclesRes] = await Promise.all([
        apiGet<JsonRecord[]>('/api/trips', { limit: 100 }).catch(() => ({ error: '行程列表加载失败', data: [] })),
        apiGet<JsonRecord[]>('/api/trips/undispatched-orders').catch(() => ({ error: '未分配订单加载失败', data: [] })),
        apiGet<JsonRecord[]>('/api/trips/all-orders').catch(() => ({ error: '全部订单加载失败', data: [] })),
        apiGet<JsonRecord[]>('/api/trips/available-vehicles').catch(() => ({ error: '可用车辆加载失败', data: [] })),
      ]);

      setData(prev => ({
        ...prev,
        trips: Array.isArray(tripsRes) ? tripsRes : (tripsRes.data || []),
        undispatchedOrders: Array.isArray(undispatchedRes) ? undispatchedRes : (undispatchedRes.data || []),
        allOrders: Array.isArray(allOrdersRes) ? allOrdersRes : (allOrdersRes.data || []),
        availableVehicles: Array.isArray(vehiclesRes) ? vehiclesRes : (vehiclesRes.data || []),
      }));
    } catch (e) {
      console.error('刷新调度数据失败:', e);
    }
  };

  const applyProductFilters = async (patch: Partial<MallFilterState>) => {
    const nextFilters = { ...productFilters, ...patch };
    setProductFilters(nextFilters);
    await reload({ productFilters: nextFilters });
  };

  useEffect(() => {
    const handler = (message: string) => {
      resetDashboardState();
      setSession(null);
      setAuthError(message || '登录已过期，请重新登录');
      setNotice('登录已过期，请重新登录');
      showMessage('warning', message || '登录已过期，请重新登录');
    };

    adminAuthFailureHandler = handler;

    return () => {
      if (adminAuthFailureHandler === handler) {
        adminAuthFailureHandler = null;
      }
    };
  }, [showMessage]);

  useEffect(() => {
    if (!session) {
      setLoading(false);
      return;
    }

    void reload();
  }, [session?.token]);

  useEffect(() => {
    if (!Object.keys(data.mallSettings).length) return;
    const deliveryRules = recordValue(data.mallSettings, 'deliveryRules');
    const paymentSplitRules = recordValue(data.mallSettings, 'paymentSplitRules');
    setSettingsForm({
      freeDeliveryThresholdYuan: String((numberValue(deliveryRules, 'freeDeliveryThresholdCents', numberValue(data.mallSettings, 'freeDeliveryThresholdCents')) / 100).toFixed(2)),
      defaultDeliveryFeeYuan: String((numberValue(deliveryRules, 'deliveryFeeCents', numberValue(data.mallSettings, 'defaultDeliveryFeeCents')) / 100).toFixed(2)),
      deliveryPromiseMinutes: String(numberValue(data.mallSettings, 'deliveryPromiseMinutes', 18)),
      refundReviewMinutes: String(numberValue(deliveryRules, 'refundReviewMinutes', numberValue(data.mallSettings, 'refundReviewMinutes', 10))),
      coldChainEnabled: boolValue(deliveryRules, 'coldChainRequired', boolValue(data.mallSettings, 'coldChainEnabled', true)),
      deliveryRangeEnabled: boolValue(deliveryRules, 'rangeEnabled', false),
      deliveryOriginLatitude: numberTextValue(deliveryRules, 'originLatitude'),
      deliveryOriginLongitude: numberTextValue(deliveryRules, 'originLongitude'),
      deliveryOriginAddress: stringValue(deliveryRules, 'originAddress'),
      deliveryRangeRadiusKm: numberTextValue(deliveryRules, 'rangeRadiusKm', '5'),
      deliveryRangePolygon: formatDeliveryRangePolygon(deliveryRules.rangePolygon),
      deliveryFeeTiersText: formatDeliveryFeeTiers(deliveryRules.feeTiers),
      pickupWindowStart: stringValue(deliveryRules, 'pickupWindowStart', '16:00'),
      pickupWindowEnd: stringValue(deliveryRules, 'pickupWindowEnd', '20:00'),
      deliveryBatchTimes: stringValue(deliveryRules, 'deliveryBatchTimes', '10:00,14:00,18:00'),
      leaderCommissionRate: String(numberValue(paymentSplitRules, 'leaderCommissionRate', 8)),
      platformServiceRate: String(numberValue(paymentSplitRules, 'platformServiceRate', 3)),
      supplierSettlementCycle: stringValue(paymentSplitRules, 'supplierSettlementCycle', 'T+7'),
      withdrawMinYuan: String((numberValue(paymentSplitRules, 'withdrawMinCents', 10000) / 100).toFixed(2)),
    });
  }, [data.mallSettings]);

  const runAction = async (label: string, action: () => Promise<void>) => {
    setBusy(label);
    try {
      await action();
      setNotice(`${label}成功`);
      showMessage('success', `${label}成功`);
    } catch (error) {
      const message = `${label}失败：${error instanceof Error ? error.message : '未知错误'}`;
      setNotice(message);
      showMessage('error', message);
    } finally {
      setBusy('');
    }
  };

  const searchMallOpsData = async () => {
    await runAction('商城运营数据查询', async () => {
      const query = {
        keyword: mallOpsFilters.keyword,
        status: mallOpsFilters.status,
        date: mallOpsFilters.date,
        community: mallOpsFilters.community,
        limit: 100,
      };
      const [
        mallOpsOverview,
        mallOrders,
        mallDeliverySheets,
        mallPickupPoints,
        mallFinanceBills,
        mallSettlementRecords,
        mallWithdrawalRequests,
        mallSalesStats,
      ] = await Promise.all([
        apiGet<JsonRecord>('/api/admin/mall/ops/overview', query),
        apiGet<JsonRecord[]>('/api/admin/mall/orders', query),
        apiGet<JsonRecord[]>('/api/admin/mall/delivery-sheets', query),
        apiGet<JsonRecord[]>('/api/admin/mall/pickup-points', query),
        apiGet<JsonRecord[]>('/api/admin/mall/finance/bills', query),
        apiGet<JsonRecord[]>('/api/admin/mall/finance/settlements', query),
        apiGet<JsonRecord[]>('/api/admin/mall/finance/withdrawals', query),
        apiGet<JsonRecord>('/api/admin/mall/stats/sales', query),
      ]);

      setData(current => ({
        ...current,
        mallOpsOverview,
        mallOrders,
        mallDeliverySheets,
        mallPickupPoints,
        mallFinanceBills,
        mallSettlementRecords,
        mallWithdrawalRequests,
        mallSalesStats,
      }));
    });
  };

  const handleLogin = async ({ phone, password, captchaId, captchaCode }: LoginForm) => {
    setAuthError('');
    setAuthLoading(true);

    try {
      const loginResult = await apiPost<JsonRecord>('/api/auth/login', { phone, password, captchaId, captchaCode });
      const user = normalizeAdminUser(loginResult);

      if (!user) {
        throw new Error('登录结果缺少 token 或用户信息');
      }

      if (user.role === 'admin') {
        const nextSession = persistAdminSession(user);
        setSession(nextSession);
        setNotice('登录成功，正在加载管理端数据');
        showMessage('success', '登录成功，正在加载管理端数据');
        setLoading(true);
        return;
      }

      clearStoredAdminSession();
      resetDashboardState();
      setSession(null);
      setAuthError('当前账号不是管理员，无法登录管理端');
      setNotice('非管理员账号已退出');
      showMessage('warning', '当前账号不是管理员，无法登录管理端');
    } catch (error) {
      clearStoredAdminSession();
      resetDashboardState();
      setSession(null);
      const message = error instanceof Error ? error.message : '登录失败，请稍后重试';
      setAuthError(message);
      showMessage('error', message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    setBusy('退出登录');

    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch {
      // 后端登出失败时仍执行本地登出，保证管理端立即回到登录页。
    } finally {
      clearStoredAdminSession();
      resetDashboardState();
      setSession(null);
      setAuthError('');
      setNotice('已退出登录');
      showMessage('success', '已退出登录');
    }
  };

  const updateUserStatus = async (id: string, status: string) => {
    await runAction('账号状态更新', async () => {
      await apiPut(`/api/admin/users/${id}/status`, { status });
      setData(current => ({ ...current, users: updateRecordList(current.users, id, { status }) }));
    });
  };

  const reviewVehicle = async (id: string, action: string, reason?: string) => {
    await runAction('车辆审核', async () => {
      await apiPost(`/api/vehicles/${id}/review`, { action, reason });
      setData(current => ({ ...current, vehicles: updateRecordList(current.vehicles, id, { status: action === 'approve' ? 'active' : 'rejected' }) }));
    });
  };

  const confirmCommission = async (id: string) => {
    await runAction('佣金确认', async () => {
      await apiPut(`/api/orders/${id}/commission-confirm`);
      await reload();
    });
  };

  const updateEnterpriseStatus = async (id: string, status: string) => {
    await runAction('企业状态更新', async () => {
      await apiPut(`/api/enterprise/${id}`, { status });
      setData(current => ({ ...current, enterprises: updateRecordList(current.enterprises, id, { status }) }));
    });
  };

  const handleCancellation = async (id: string, action: string, reason?: string) => {
    await runAction('取消申请处理', async () => {
      await apiPut(`/api/cancellations/${id}/handle`, { action, reason });
      await reload();
    });
  };

  const manualCompleteWithdrawal = async (id: string) => {
    await runAction('提现确认完成', async () => {
      await apiPost(`/api/admin/owner-withdrawals/${id}/manual-complete`);
      await reload();
    });
  };

  const manualFailWithdrawal = async (id: string) => {
    await runAction('提现标记失败', async () => {
      await apiPost(`/api/admin/owner-withdrawals/${id}/manual-fail`);
      await reload();
    });
  };

  const createProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await runAction('商品创建', async () => {
      validateProductForm(productForm);
      const tags = productForm.tags
        .split(',')
        .map(tag => tag.trim())
        .filter(Boolean);
      const images = productFormImages(productForm);
      const variants = productVariantPayload(productForm);
      const compatibility = productCompatibilityFields(productForm);
      const qualificationReports = productQualificationReportsPayload(productForm);
      await apiPost('/api/admin/mall/products', {
        name: productForm.name || '新增鲜选商品',
        sku: productForm.sku || `WEB-${Date.now()}`,
        categoryCode: productForm.categoryCode,
        subtitle: productForm.subtitle,
        description: productForm.description,
        imageUrl: images[0] || '',
        images,
        variants,
        specification: compatibility.specification,
        saleMethod: compatibility.saleMethod,
        priceCents: moneyFromYuan(compatibility.priceYuan),
        supplyPriceCents: moneyFromYuan(compatibility.supplyPriceYuan),
        stock: Number(compatibility.stock) || 0,
        stockAlertThreshold: Number(productForm.stockAlertThreshold) || 15,
        minimumOrderQuantity: Number(compatibility.minimumOrderQuantity) || 1,
        lengthCm: optionalNumber(compatibility.lengthCm),
        widthCm: optionalNumber(compatibility.widthCm),
        heightCm: optionalNumber(compatibility.heightCm),
        volumeLiters: optionalNumber(compatibility.volumeLiters),
        weightKg: optionalNumber(compatibility.weightKg),
        status: productForm.status,
        tags,
        deliveryMinutes: Number(productForm.deliveryMinutes) || 18,
        coldChainRequired: productForm.coldChainRequired,
        procurementBuyerIds: productForm.procurementBuyerIds,
        qualificationReports,
        hideSupplier: productForm.hideSupplier,
      });
      setProductForm({ ...initialProductForm, sku: `WEB-${Date.now()}` });
      await reload();
    });
  };

  const updateProductStatus = async (id: string, status: string) => {
    await runAction('商品状态更新', async () => {
      await apiPut(`/api/admin/mall/products/${id}`, { status });
      setData(current => ({ ...current, mallProducts: updateRecordList(current.mallProducts, id, { status }) }));
    });
  };

  const updateProduct = async (id: string, form: ProductForm) => {
    await runAction('商品更新', async () => {
      validateProductForm(form);
      const tags = form.tags
        .split(',')
        .map(tag => tag.trim())
        .filter(Boolean);
      const images = productFormImages(form);
      const variants = productVariantPayload(form);
      const compatibility = productCompatibilityFields(form);
      const qualificationReports = productQualificationReportsPayload(form);
      const product = await apiPut<JsonRecord>(`/api/admin/mall/products/${id}`, {
        name: form.name,
        sku: form.sku,
        categoryCode: form.categoryCode,
        subtitle: form.subtitle,
        description: form.description,
        imageUrl: images[0] || '',
        images,
        variants,
        specification: compatibility.specification,
        saleMethod: compatibility.saleMethod,
        priceCents: moneyFromYuan(compatibility.priceYuan),
        supplyPriceCents: moneyFromYuan(compatibility.supplyPriceYuan),
        stock: Number(compatibility.stock) || 0,
        stockAlertThreshold: Number(form.stockAlertThreshold) || 15,
        minimumOrderQuantity: Number(compatibility.minimumOrderQuantity) || 1,
        lengthCm: optionalNumber(compatibility.lengthCm),
        widthCm: optionalNumber(compatibility.widthCm),
        heightCm: optionalNumber(compatibility.heightCm),
        volumeLiters: optionalNumber(compatibility.volumeLiters),
        weightKg: optionalNumber(compatibility.weightKg),
        status: form.status,
        tags,
        deliveryMinutes: Number(form.deliveryMinutes) || 18,
        coldChainRequired: form.coldChainRequired,
        procurementBuyerIds: form.procurementBuyerIds,
        qualificationReports,
        hideSupplier: form.hideSupplier,
      });
      setData(current => ({
        ...current,
        mallProducts: upsertRecordList(current.mallProducts, product),
      }));
      await reload();
    });
  };

  const uploadProductImage = async (file: File) => {
    setBusy('商品图片上传');
    try {
      const result = await apiUpload<JsonRecord>('/api/admin/mall/uploads/product-image', file);
      const imageUrl = stringValue(result, 'imageUrl', stringValue(result, 'fileKey'));
      if (!imageUrl) {
        throw new Error('上传结果缺少图片地址');
      }
      setNotice('商品图片上传成功');
      showMessage('success', '商品图片上传成功');
      return imageUrl;
    } catch (error) {
      const message = `商品图片上传失败：${error instanceof Error ? error.message : '未知错误'}`;
      setNotice(message);
      showMessage('error', message);
      throw error;
    } finally {
      setBusy('');
    }
  };

  const uploadQualificationFile = async (file: File) => {
    setBusy('资质文件上传');
    try {
      const result = await apiUpload<JsonRecord>('/api/admin/mall/uploads/qualification-file', file);
      const fileUrl = stringValue(result, 'fileUrl', stringValue(result, 'fileKey'));
      if (!fileUrl) {
        throw new Error('上传结果缺少文件地址');
      }
      setNotice('资质文件上传成功');
      showMessage('success', '资质文件上传成功');
      return fileUrl;
    } catch (error) {
      const message = `资质文件上传失败：${error instanceof Error ? error.message : '未知错误'}`;
      setNotice(message);
      showMessage('error', message);
      throw error;
    } finally {
      setBusy('');
    }
  };

  const saveProcurementBuyer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await runAction(procurementBuyerForm.id ? '采购商更新' : '采购商创建', async () => {
      if (!procurementBuyerForm.name.trim()) {
        throw new Error('采购商名称不能为空');
      }
      const payload = {
        name: procurementBuyerForm.name,
        contactName: procurementBuyerForm.contactName,
        contactPhone: procurementBuyerForm.contactPhone,
        licenseUrl: procurementBuyerForm.licenseUrl,
        status: procurementBuyerForm.status,
        remark: procurementBuyerForm.remark,
      };
      const buyer = procurementBuyerForm.id
        ? await apiPut<JsonRecord>(`/api/admin/mall/procurement-buyers/${procurementBuyerForm.id}`, payload)
        : await apiPost<JsonRecord>('/api/admin/mall/procurement-buyers', payload);
      setData(current => ({
        ...current,
        mallProcurementBuyers: upsertRecordList(current.mallProcurementBuyers, buyer),
      }));
      setProcurementBuyerForm(initialProcurementBuyerForm);
      await reload();
    });
  };

  const deleteProcurementBuyer = async (id: string) => {
    await runAction('采购商删除', async () => {
      await apiDelete(`/api/admin/mall/procurement-buyers/${id}`);
      setData(current => ({
        ...current,
        mallProcurementBuyers: current.mallProcurementBuyers.filter(buyer => stringValue(buyer, 'id') !== id),
      }));
      setProcurementBuyerForm(current => (current.id === id ? initialProcurementBuyerForm : current));
      await reload();
    });
  };

  const saveCategory = async (form: CategoryForm) => {
    await runAction(form.id ? '品类更新' : '品类创建', async () => {
      const payload = {
        code: form.code,
        name: form.name,
        sortOrder: Number(form.sortOrder) || 0,
        status: form.status,
      };
      if (form.id) {
        await apiPut(`/api/admin/mall/categories/${form.id}`, payload);
      } else {
        await apiPost('/api/admin/mall/categories', payload);
      }
      setCategoryForm(initialCategoryForm);
      await reload();
    });
  };

  const deleteCategory = async (id: string) => {
    await runAction('品类删除', async () => {
      await apiDelete(`/api/admin/mall/categories/${id}`);
      await reload();
    });
  };

  const saveCategoryOrder = async (orderedCategories: JsonRecord[]) => {
    await runAction('品类排序保存', async () => {
      const nextCategories = orderedCategories.map((category, index) => ({
        ...category,
        sortOrder: (index + 1) * 10,
      }));
      await Promise.all(nextCategories.map(category => apiPut(`/api/admin/mall/categories/${stringValue(category, 'id')}`, {
        sortOrder: numberValue(category, 'sortOrder'),
      })));
      setData(current => ({
        ...current,
        mallCategories: nextCategories,
      }));
      await reload();
    });
  };

  const createInventoryAlert = async (id: string, stock: number, stockAlertThreshold: number) => {
    await runAction('库存预警创建', async () => {
      await apiPost('/api/admin/mall/inventory-alerts', { productId: id, stock, stockAlertThreshold });
      await reload();
    });
  };

  const editInventoryAlert = async (id: string, stock: number, stockAlertThreshold: number) => {
    await runAction('库存预警更新', async () => {
      await apiPut(`/api/admin/mall/inventory-alerts/${id}`, { stock, stockAlertThreshold });
      await reload();
    });
  };

  const deleteInventoryAlert = async (id: string) => {
    await runAction('库存预警删除', async () => {
      await apiDelete(`/api/admin/mall/inventory-alerts/${id}`);
      await reload();
    });
  };

  const fetchMallOrderDetail = async (identifier: string) => {
    const value = identifier.trim();
    if (!value) {
      throw new Error('请输入订单号或订单ID');
    }
    return apiGet<JsonRecord>(`/api/admin/mall/orders/${encodeURIComponent(value)}`);
  };

  const openMallOrderDetail = async (identifier: string) => {
    setMallOrderDetailModalOpen(true);
    setMallOrderDetail(null);
    setMallOrderDetailError('');
    setMallOrderDetailLoading(true);

    try {
      setMallOrderDetail(await fetchMallOrderDetail(identifier));
    } catch (error) {
      setMallOrderDetailError(error instanceof Error ? error.message : '订单详情加载失败');
    } finally {
      setMallOrderDetailLoading(false);
    }
  };

  const submitWeightAdjustment = async (actualWeightJin: string, note: string) => {
    if (!mallOrderDetail || !weightAdjustmentItem) return;
    const orderId = stringValue(mallOrderDetail, 'id');
    const itemId = stringValue(weightAdjustmentItem, 'id');
    if (!orderId || !itemId) return;
    setWeightAdjustmentSaving(true);
    try {
      const nextOrder = await apiPut<JsonRecord>(`/api/admin/mall/orders/${encodeURIComponent(orderId)}/weight-adjustment`, {
        itemId,
        actualWeightJin: Number(actualWeightJin),
        adjustedBy: currentAdmin.name || currentAdmin.phone || 'admin',
        note,
      });
      setMallOrderDetail(nextOrder);
      setWeightAdjustmentItem(null);
      await reload();
      showMessage('success', '称重改价保存成功');
    } catch (error) {
      showMessage('error', error instanceof Error ? error.message : '称重改价保存失败');
    } finally {
      setWeightAdjustmentSaving(false);
    }
  };

  const searchMallOrderDetail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMallOrderSearchResults([]);
    setMallOrderSearchError('');
    setMallOrderSearchLoading(true);

    try {
      const hasCondition = Object.values(mallOrderSearchFilters).some(value => value.trim());
      if (!hasCondition) {
        throw new Error('请至少输入一个查询条件或日期范围');
      }
      const results = await apiGet<JsonRecord[]>('/api/admin/mall/orders', {
        orderNo: mallOrderSearchFilters.orderNo,
        userPhone: mallOrderSearchFilters.userPhone,
        merchantId: mallOrderSearchFilters.merchantId,
        startDate: mallOrderSearchFilters.startDate,
        endDate: mallOrderSearchFilters.endDate,
        limit: 100,
      });
      setMallOrderSearchResults(results);
    } catch (error) {
      setMallOrderSearchError(error instanceof Error ? error.message : '订单详情加载失败');
    } finally {
      setMallOrderSearchLoading(false);
    }
  };

  const clearMallOrderSearch = () => {
    setMallOrderSearchFilters(initialMallOrderDetailSearchFilters);
    setMallOrderSearchResults([]);
    setMallOrderSearchError('');
  };

  const dispatchMallOrder = async (id: string) => {
    await runAction('商城派车', async () => {
      await apiPost(`/api/admin/mall/orders/${id}/dispatch`, {
        vehicleCode: `RR-${Date.now().toString().slice(-4)}`,
        trackingDistanceKm: 2.8,
        expectedDeliveryWindow: '30分钟内送达',
      });
      await reload();
    });
  };

  const createTrip = async (vehicleId: string, orderIds: string[]) => {
    await runAction('创建行程', async () => {
      await apiPost('/api/trips', { vehicleId, orderIds });
      await refreshDispatchData();
    });
  };

  const assignOrdersToTrip = async (tripId: string, orderIds: string[]) => {
    await runAction('追加订单', async () => {
      await apiPost(`/api/admin/trips/${tripId}/assign-orders`, { orderIds });
      await refreshDispatchData();
    });
  };

  const removeOrderFromTrip = async (tripId: string, orderId: string) => {
    await runAction('移除订单', async () => {
      await apiDelete(`/api/admin/trips/${tripId}/remove-order/${orderId}`);
      await refreshDispatchData();
    });
  };

  const startTrip = async (tripId: string) => {
    await runAction('出发行程', async () => {
      await apiPost(`/api/trips/${tripId}/start`);
      await refreshDispatchData();
    });
  };

  const completeTrip = async (tripId: string) => {
    await runAction('完成行程', async () => {
      await apiPost(`/api/trips/${tripId}/complete`);
      await refreshDispatchData();
    });
  };

  const lockTrip = async (tripId: string) => {
    await runAction('锁定行程', async () => {
      await apiPost(`/api/trips/${tripId}/lock`);
      await refreshDispatchData();
    });
  };

  const unlockTrip = async (tripId: string) => {
    await runAction('解锁行程', async () => {
      await apiPost(`/api/trips/${tripId}/unlock`);
      await refreshDispatchData();
    });
  };

  const reorderStops = async (tripId: string, stopIds: string[]) => {
    await runAction('调整站点顺序', async () => {
      await apiPut(`/api/admin/trips/${tripId}/reorder-stops`, { stopIds });
      await refreshDispatchData();
    });
  };

  const autoAssignOrders = async (orderIds: string[], maxOrdersPerSlot: number, dryRun: boolean) => {
    await runAction('智能调度', async () => {
      const res = await apiPost('/api/admin/dispatch/auto-assign', { orderIds: orderIds.length > 0 ? orderIds : undefined, maxOrdersPerSlot, dryRun });
      if (res && typeof res === 'object' && 'assigned' in res) {
        const assignResult = res as { assigned: number; details?: Array<{ orderId: string; vehicleCode: string; timeSlot: string }> };
        showMessage('success', `已分配 ${assignResult.assigned} 个订单${dryRun ? '（预览模式）' : ''}`);
      }
      await refreshDispatchData();
    });
  };

  const updateMallOrderStatus = async (id: string, status: string) => {
    await runAction('商城订单状态更新', async () => {
      await apiPut(`/api/admin/mall/orders/${id}/status`, { status, description: statusLabel(status) });
      setData(current => ({ ...current, mallOrders: updateRecordList(current.mallOrders, id, { status }) }));
    });
  };

  const refundMallOrder = async (id: string, amountCents: number) => {
    await runAction('商城退款', async () => {
      await apiPost(`/api/admin/mall/orders/${id}/refund`, {
        amountCents,
        reason: '管理端发起退款',
        handlingMethod: '原路退回',
      });
      await reload();
    });
  };

  const generateDeliverySheet = async () => {
    await runAction('配送单生成', async () => {
      await apiPost('/api/admin/mall/delivery-sheets/generate', {
        sheetDate: mallOpsFilters.date || dayKey(new Date()),
        community: mallOpsFilters.community || undefined,
      });
      await reload();
    });
  };

  const updateDeliverySheetStatus = async (id: string, status: string) => {
    await runAction('配送状态更新', async () => {
      await apiPut(`/api/admin/mall/delivery-sheets/${id}/status`, {
        status,
        description: statusLabel(status),
      });
      setData(current => ({
        ...current,
        mallDeliverySheets: updateRecordList(current.mallDeliverySheets, id, { status }),
      }));
    });
  };

  const searchPickupPoints = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await runAction('自提点查询', async () => {
      const mallPickupPoints = await apiGet<JsonRecord[]>('/api/admin/mall/pickup-points', {
        limit: 100,
        keyword: pickupPointFilters.keyword,
        status: pickupPointFilters.status,
        community: pickupPointFilters.community,
      });
      setData(current => ({ ...current, mallPickupPoints }));
    });
  };

  const savePickupPoint = async (form: PickupPointForm) => {
    await runAction(form.id ? '自提点更新' : '自提点创建', async () => {
      validatePickupPointForm(form);
      const payload = {
        name: form.name,
        addressText: form.addressText,
        latitude: optionalNumber(form.latitude),
        longitude: optionalNumber(form.longitude),
        businessHours: form.businessHours || undefined,
        status: form.status,
        communityName: form.communityName || undefined,
        leaderName: form.leaderName || undefined,
        leaderPhone: form.leaderPhone || undefined,
        sortOrder: Number(form.sortOrder) || 0,
      };
      if (form.id) {
        await apiPut(`/api/admin/mall/pickup-points/${form.id}`, payload);
      } else {
        await apiPost('/api/admin/mall/pickup-points', payload);
      }
      await reload();
    });
  };

  const updatePickupPointStatus = async (id: string, status: string) => {
    await runAction('自提点状态更新', async () => {
      await apiPut(`/api/admin/mall/pickup-points/${id}`, { status });
      setData(current => ({
        ...current,
        mallPickupPoints: updateRecordList(current.mallPickupPoints, id, { status }),
      }));
    });
  };

  const deletePickupPoint = async (id: string) => {
    await runAction('自提点删除', async () => {
      await apiDelete(`/api/admin/mall/pickup-points/${id}`);
      await reload();
    });
  };

  const searchGroupLeaders = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await runAction('团长查询', async () => {
      const mallGroupLeaders = await apiGet<JsonRecord[]>('/api/admin/mall/group-leaders', {
        limit: 100,
        keyword: groupLeaderFilters.keyword,
        status: groupLeaderFilters.status,
        pickupPointId: groupLeaderFilters.pickupPointId,
      });
      setData(current => ({ ...current, mallGroupLeaders }));
    });
  };

  const saveGroupLeader = async (form: GroupLeaderForm) => {
    await runAction(form.id ? '团长更新' : '团长创建', async () => {
      validateGroupLeaderForm(form);
      const payload = {
        pickupPointId: form.pickupPointId,
        userId: form.userId || undefined,
        name: form.name,
        phone: form.phone || undefined,
        status: form.status,
        serviceNote: form.serviceNote || undefined,
      };
      if (form.id) {
        await apiPut(`/api/admin/mall/group-leaders/${form.id}`, payload);
      } else {
        await apiPost('/api/admin/mall/group-leaders', payload);
      }
      await reload();
    });
  };

  const updateGroupLeaderStatus = async (id: string, status: string) => {
    await runAction('团长状态更新', async () => {
      await apiPut(`/api/admin/mall/group-leaders/${id}`, { status });
      await reload();
    });
  };

  const deleteGroupLeader = async (id: string) => {
    await runAction('团长删除', async () => {
      await apiDelete(`/api/admin/mall/group-leaders/${id}`);
      await reload();
    });
  };

  const createWithdrawal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await runAction('提现申请提交', async () => {
      await apiPost('/api/admin/mall/finance/withdrawals', {
        amountCents: moneyFromYuan(withdrawalForm.amountYuan),
        note: withdrawalForm.note,
        requesterRole: 'admin',
      });
      setWithdrawalForm(initialWithdrawalForm);
      await reload();
    });
  };

  const resetCampaignForm = () => {
    setCampaignForm(initialCampaignForm);
  };

  const resetFixedPriceCampaignForm = () => {
    setFixedPriceCampaignForm(initialFixedPriceCampaignForm);
  };

  const resetPromotionVenueForm = () => {
    setPromotionVenueForm(initialPromotionVenueForm);
  };

  const resetGroupBuyForm = () => {
    setGroupBuyForm(emptyGroupBuyForm);
  };

  const saveCampaign = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const isEditing = Boolean(campaignForm.id);
    await runAction(isEditing ? '活动更新' : '活动创建', async () => {
      const payload = {
        name: campaignForm.name,
        campaignType: normalizeCampaignTypeForForm(campaignForm.campaignType),
        budgetCents: moneyFromYuan(campaignForm.budgetYuan),
        rules: campaignRulesFromForm(campaignForm, data.mallProducts),
        status: campaignForm.status,
        startsAt: campaignForm.startsAt || null,
        endsAt: campaignForm.endsAt || null,
      };
      const campaign = isEditing
        ? await apiPut<JsonRecord>(`/api/admin/mall/campaigns/${campaignForm.id}`, payload)
        : await apiPost<JsonRecord>('/api/admin/mall/campaigns', payload);

      setData(current => ({
        ...current,
        campaigns: upsertRecordList(current.campaigns, campaign),
      }));
      setCampaignForm(initialCampaignForm);
      await reload();
    });
  };

  const editCampaign = (campaign: JsonRecord) => {
    setCampaignForm(campaignToForm(campaign));
  };

  const saveFixedPriceCampaign = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const isEditing = Boolean(fixedPriceCampaignForm.id);
    await runAction(isEditing ? '一口价更新' : '一口价创建', async () => {
      if (!fixedPriceCampaignForm.name.trim()) {
        throw new Error('活动名称不能为空');
      }
      if (!fixedPriceCampaignForm.badgeText.trim()) {
        throw new Error('展示文字不能为空');
      }
      const activeGroups = fixedPriceCampaignForm.groups.filter(group => group.items.length);
      if (!activeGroups.length) {
        throw new Error('请至少选择一个商品');
      }
      activeGroups.forEach(group => {
        group.items.forEach(item => {
          if (moneyFromYuan(item.fixedPriceYuan) <= 0) {
            throw new Error(`${group.name || '商品组'}的一口价必须大于0`);
          }
        });
      });
      const payload = {
        name: fixedPriceCampaignForm.name,
        campaignType: 'fixed_price',
        budgetCents: 0,
        rules: fixedPriceCampaignRules(fixedPriceCampaignForm, data.mallProducts),
        status: fixedPriceCampaignForm.status,
        startsAt: fixedPriceCampaignForm.startsAt || null,
        endsAt: fixedPriceCampaignForm.endsAt || null,
      };
      const campaign = isEditing
        ? await apiPut<JsonRecord>(`/api/admin/mall/campaigns/${fixedPriceCampaignForm.id}`, payload)
        : await apiPost<JsonRecord>('/api/admin/mall/campaigns', payload);

      setData(current => ({
        ...current,
        campaigns: upsertRecordList(current.campaigns, campaign),
        fixedPriceCampaigns: upsertRecordList(current.fixedPriceCampaigns, campaign),
      }));
      setFixedPriceCampaignForm(initialFixedPriceCampaignForm);
      await reload();
    });
  };

  const editFixedPriceCampaign = (campaign: JsonRecord) => {
    setFixedPriceCampaignForm(fixedPriceCampaignToForm(campaign));
  };

  const openFixedPriceCampaignPage = (campaign?: JsonRecord) => {
    if (campaign) {
      editFixedPriceCampaign(campaign);
    } else {
      setFixedPriceCampaignForm(initialFixedPriceCampaignForm);
    }
    setActivePageKey('mall.fixedPriceCampaigns');
  };

  const savePromotionVenue = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const isEditing = Boolean(promotionVenueForm.id);
    await runAction(isEditing ? '大促会场更新' : '大促会场创建', async () => {
      if (!promotionVenueForm.name.trim()) {
        throw new Error('会场名称不能为空');
      }
      if (!promotionVenueForm.title.trim()) {
        throw new Error('会场标题不能为空');
      }
      if (!promotionVenueForm.items.length) {
        throw new Error('请至少选择一个商品');
      }
      const payload = {
        name: promotionVenueForm.name,
        campaignType: 'promotion_venue',
        budgetCents: 0,
        rules: promotionVenueRules(promotionVenueForm, data.mallProducts),
        status: promotionVenueForm.status,
      };
      const campaign = isEditing
        ? await apiPut<JsonRecord>(`/api/admin/mall/campaigns/${promotionVenueForm.id}`, payload)
        : await apiPost<JsonRecord>('/api/admin/mall/campaigns', payload);

      setData(current => ({
        ...current,
        campaigns: upsertRecordList(current.campaigns, campaign),
        promotionVenues: upsertRecordList(current.promotionVenues, campaign),
      }));
      setPromotionVenueForm(initialPromotionVenueForm);
      await reload();
    });
  };

  const editPromotionVenue = (campaign: JsonRecord) => {
    setPromotionVenueForm(promotionVenueToForm(campaign));
  };

  const openPromotionVenuePage = (campaign?: JsonRecord) => {
    if (campaign) {
      editPromotionVenue(campaign);
    } else {
      setPromotionVenueForm(initialPromotionVenueForm);
    }
    setActivePageKey('mall.promotionVenues');
  };

  const saveGroupBuy = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const selectedProduct = data.mallProducts.find(product => stringValue(product, 'id') === groupBuyForm.productId);
      if (selectedProduct && arrayValue(selectedProduct, 'variants').length > 0 && !groupBuyForm.variantId) {
        throw new Error('请选择售卖规格');
      }
      const payload = groupBuyPayload(groupBuyForm);
      const groupBuy = groupBuyForm.id
        ? await apiPut<JsonRecord>(`/api/admin/mall/group-buys/${groupBuyForm.id}`, payload)
        : await apiPost<JsonRecord>('/api/admin/mall/group-buys', payload);
      setData(current => ({
        ...current,
        mallGroupBuys: upsertRecordList(current.mallGroupBuys, groupBuy),
      }));
      setGroupBuyForm(emptyGroupBuyForm);
      showMessage('success', '集采活动已保存');
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      showMessage('error', message || '集采活动保存失败');
      throw error;
    }
  };

  const editGroupBuy = (groupBuy: JsonRecord) => {
    setGroupBuyForm(groupBuyToForm(groupBuy));
  };

  const groupBuyActionFallbackStatus = (action: string) => {
    const statuses: Record<string, string> = {
      publish: 'published',
      offline: 'offline',
      'force-form': 'formed',
      cancel: 'cancelled',
      'confirm-procurement': 'procuring',
    };
    return statuses[action];
  };

  const buildGroupBuyActionPayload = (groupBuy: JsonRecord, action: string): JsonRecord => {
    if (action !== 'extend') return {};
    const currentEndsAt = datetimeLocalValue(stringValue(groupBuy, 'endsAt'));
    const currentBalanceDueAt = datetimeLocalValue(stringValue(groupBuy, 'balanceDueAt'));
    const nextEndsAt = window.prompt('新的活动结束时间', currentEndsAt);
    if (nextEndsAt === null) {
      throw new Error('已取消延期');
    }
    const nextBalanceDueAt = window.prompt('新的尾款截止时间', currentBalanceDueAt || nextEndsAt);
    if (nextBalanceDueAt === null) {
      throw new Error('已取消延期');
    }
    return {
      endsAt: datetimeLocalToIso(nextEndsAt || currentEndsAt),
      balanceDueAt: datetimeLocalToIso(nextBalanceDueAt || currentBalanceDueAt || nextEndsAt || currentEndsAt),
    };
  };

  const handleGroupBuyAction = async (groupBuy: JsonRecord, action: string) => {
    const id = stringValue(groupBuy, 'id');
    try {
      const unavailableReason = groupBuyActionUnavailableReason(groupBuy, action);
      if (unavailableReason) {
        showMessage('warning', unavailableReason);
        return;
      }
      const confirmText = groupBuyActionConfirmText(groupBuy, action);
      if (confirmText && !window.confirm(confirmText)) {
        return;
      }
      const result = await apiPost<JsonRecord>(`/api/admin/mall/group-buys/${id}/${action}`, buildGroupBuyActionPayload(groupBuy, action));
      const updatedActivity = groupBuyActionResultActivity(result);
      setData(current => ({
        ...current,
        mallGroupBuys: updatedActivity
          ? upsertRecordList(current.mallGroupBuys, updatedActivity)
          : updateRecordList(current.mallGroupBuys, id, {
              status: groupBuyActionFallbackStatus(action) || stringValue(current.mallGroupBuys.find(item => stringValue(item, 'id') === id), 'status'),
              updatedAt: new Date().toISOString(),
            }),
      }));
      const label = groupBuyActionOptions.find(option => option.action === action)?.label || '操作';
      if (action === 'confirm-procurement') {
        const orderCreation = recordValue(result, 'orderCreation');
        const hasProcurementWarning = numberValue(orderCreation, 'missingAddressCount') > 0 || numberValue(orderCreation, 'stockFailedCount') > 0;
        showMessage(hasProcurementWarning ? 'warning' : 'success', groupBuyProcurementMessage(result));
      } else {
        showMessage('success', `集采活动${label}成功`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message === '已取消延期') return;
      showMessage('error', message || '集采活动操作失败');
    }
  };

  const openGroupBuyDetail = async (groupBuy: JsonRecord) => {
    setGroupBuyDetailActivity(groupBuy);
    setGroupBuyDetailOpen(true);
    setGroupBuySubscriptions([]);
    const requestId = `${stringValue(groupBuy, 'id')}-${Date.now()}`;
    groupBuyDetailRequest.current = requestId;
    try {
      const id = stringValue(groupBuy, 'id');
      const result = await apiGet<JsonRecord[] | JsonRecord>(`/api/admin/mall/group-buys/${id}/subscriptions`);
      if (groupBuyDetailRequest.current !== requestId) return;
      const subscriptions = Array.isArray(result)
        ? result
        : arrayValue(result, 'subscriptions').filter((item): item is JsonRecord => Boolean(item) && typeof item === 'object' && !Array.isArray(item));
      setGroupBuySubscriptions(subscriptions);
    } catch (error) {
      if (groupBuyDetailRequest.current !== requestId) return;
      const message = error instanceof Error ? error.message : '集采订阅加载失败';
      showMessage('error', message);
    }
  };

  const closeGroupBuyDetail = () => {
    setGroupBuyDetailOpen(false);
    setGroupBuyDetailActivity(null);
    setGroupBuySubscriptions([]);
    groupBuyDetailRequest.current = '';
  };

  const updateCampaignStatus = async (id: string, status: string) => {
    await runAction('活动状态更新', async () => {
      await apiPut(`/api/admin/mall/campaigns/${id}`, { status });
      setData(current => ({
        ...current,
        campaigns: updateRecordList(current.campaigns, id, { status }),
        fixedPriceCampaigns: updateRecordList(current.fixedPriceCampaigns, id, { status }),
        promotionVenues: updateRecordList(current.promotionVenues, id, { status }),
      }));
    });
  };

  const deleteCampaign = async (id: string) => {
    await runAction('活动删除', async () => {
      await apiDelete(`/api/admin/mall/campaigns/${id}`);
      setData(current => ({
        ...current,
        campaigns: current.campaigns.filter(campaign => stringValue(campaign, 'id') !== id),
        fixedPriceCampaigns: current.fixedPriceCampaigns.filter(campaign => stringValue(campaign, 'id') !== id),
        promotionVenues: current.promotionVenues.filter(campaign => stringValue(campaign, 'id') !== id),
      }));
      setCampaignForm(current => (current.id === id ? initialCampaignForm : current));
      setFixedPriceCampaignForm(current => (current.id === id ? initialFixedPriceCampaignForm : current));
      setPromotionVenueForm(current => (current.id === id ? initialPromotionVenueForm : current));
      await reload();
    });
  };

  const resetCouponForm = () => {
    setCouponForm({
      ...initialCouponForm,
      code: `COUPON-${Date.now().toString().slice(-6)}`,
    });
  };

  const saveCoupon = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const isEditing = Boolean(couponForm.id);
    await runAction(isEditing ? '优惠券更新' : '优惠券创建', async () => {
      const payload = {
        name: couponForm.name,
        code: couponForm.code,
        couponType: couponForm.couponType,
        thresholdCents: moneyFromYuan(couponForm.thresholdYuan),
        discountCents: moneyFromYuan(couponForm.discountYuan),
        totalQuantity: Number(couponForm.totalQuantity) || 0,
        perUserLimit: Number(couponForm.perUserLimit) || 1,
        status: couponForm.status,
        startsAt: couponForm.startsAt || undefined,
        endsAt: couponForm.endsAt || undefined,
        description: couponForm.description,
        rules: {
          autoApply: true,
          source: 'web-admin',
        },
      };
      const coupon = isEditing
        ? await apiPut<JsonRecord>(`/api/admin/mall/coupons/${couponForm.id}`, payload)
        : await apiPost<JsonRecord>('/api/admin/mall/coupons', payload);

      setData(current => ({
        ...current,
        mallCoupons: upsertRecordList(current.mallCoupons, coupon),
      }));
      resetCouponForm();
      await reload();
    });
  };

  const editCoupon = (coupon: JsonRecord) => {
    setCouponForm(couponToForm(coupon));
  };

  const updateCouponStatus = async (id: string, status: string) => {
    await runAction('优惠券状态更新', async () => {
      await apiPut(`/api/admin/mall/coupons/${id}`, { status });
      setData(current => ({ ...current, mallCoupons: updateRecordList(current.mallCoupons, id, { status }) }));
    });
  };

  const deleteCoupon = async (id: string) => {
    await runAction('优惠券删除', async () => {
      await apiDelete(`/api/admin/mall/coupons/${id}`);
      setData(current => ({
        ...current,
        mallCoupons: current.mallCoupons.filter(coupon => stringValue(coupon, 'id') !== id),
      }));
      setCouponForm(current => (current.id === id ? initialCouponForm : current));
      await reload();
    });
  };

  const saveHomeBanner = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await runAction(homeBannerForm.id ? '首页配置更新' : '首页配置创建', async () => {
      const payload = {
        title: homeBannerForm.title,
        subtitle: homeBannerForm.subtitle,
        imageUrl: homeBannerForm.imageUrl,
        linkType: homeBannerForm.linkType,
        linkTarget: homeBannerForm.linkTarget,
        sortOrder: Number(homeBannerForm.sortOrder) || 0,
        status: homeBannerForm.status,
        startsAt: homeBannerForm.startsAt || undefined,
        endsAt: homeBannerForm.endsAt || undefined,
        metadata: {
          tag: homeBannerForm.tag,
        },
      };

      const banner = homeBannerForm.id
        ? await apiPut<JsonRecord>(`/api/admin/mall/home-banners/${homeBannerForm.id}`, payload)
        : await apiPost<JsonRecord>('/api/admin/mall/home-banners', payload);

      setData(current => ({
        ...current,
        mallHomeBanners: upsertRecordList(current.mallHomeBanners, banner),
      }));
      setHomeBannerForm(initialHomeBannerForm);
      await reload();
    });
  };

  const updateHomeBannerStatus = async (id: string, status: string) => {
    await runAction('首页配置状态更新', async () => {
      await apiPut(`/api/admin/mall/home-banners/${id}`, { status });
      setData(current => ({ ...current, mallHomeBanners: updateRecordList(current.mallHomeBanners, id, { status }) }));
    });
  };

  const resetHomeSectionForm = (sectionType = homeSectionForm.sectionType) => {
    const defaults = Object.values(homeSectionPageConfigs).find(config => config.sectionType === sectionType)?.defaults || {};
    setHomeSectionForm({
      ...initialHomeSectionForm,
      ...defaults,
      id: '',
      sectionType,
    });
  };

  const saveHomeSection = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const isEditing = Boolean(homeSectionForm.id);
    await runAction(isEditing ? '首页专区配置更新' : '首页专区配置创建', async () => {
      const productIds = homeSectionForm.productIds
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);
      const payload = {
        sectionType: homeSectionForm.sectionType,
        title: homeSectionForm.title,
        subtitle: homeSectionForm.subtitle,
        content: homeSectionForm.content,
        imageUrl: homeSectionForm.imageUrl,
        linkType: homeSectionForm.linkType,
        linkTarget: homeSectionForm.linkTarget,
        productIds,
        rules: JSON.parse(homeSectionForm.rules || '{}') as JsonRecord,
        sortOrder: Number(homeSectionForm.sortOrder) || 0,
        status: homeSectionForm.status,
        startsAt: homeSectionForm.startsAt || undefined,
        endsAt: homeSectionForm.endsAt || undefined,
      };
      const section = isEditing
        ? await apiPut<JsonRecord>(`/api/admin/mall/home-sections/${homeSectionForm.id}`, payload)
        : await apiPost<JsonRecord>('/api/admin/mall/home-sections', payload);

      setData(current => ({
        ...current,
        mallHomeSections: upsertRecordList(current.mallHomeSections, section),
      }));
      resetHomeSectionForm(homeSectionForm.sectionType);
      await reload();
    });
  };

  const editHomeSection = (section: JsonRecord) => {
    setHomeSectionForm(homeSectionToForm(section));
  };

  const updateHomeSectionStatus = async (id: string, status: string) => {
    await runAction('首页专区状态更新', async () => {
      await apiPut(`/api/admin/mall/home-sections/${id}`, { status });
      setData(current => ({ ...current, mallHomeSections: updateRecordList(current.mallHomeSections, id, { status }) }));
    });
  };

  const deleteHomeSection = async (id: string) => {
    await runAction('首页专区配置删除', async () => {
      await apiDelete(`/api/admin/mall/home-sections/${id}`);
      setData(current => ({
        ...current,
        mallHomeSections: current.mallHomeSections.filter(section => stringValue(section, 'id') !== id),
      }));
      setHomeSectionForm(current => (current.id === id ? initialHomeSectionForm : current));
      await reload();
    });
  };

  const saveSettingsForm = async (form: SettingsForm) => {
    await runAction('运营配置保存', async () => {
      const freeDeliveryThresholdCents = moneyFromYuan(form.freeDeliveryThresholdYuan);
      const defaultDeliveryFeeCents = moneyFromYuan(form.defaultDeliveryFeeYuan);
      const refundReviewMinutes = Number(form.refundReviewMinutes) || 10;
      const deliveryOriginLatitude = optionalNumber(form.deliveryOriginLatitude);
      const deliveryOriginLongitude = optionalNumber(form.deliveryOriginLongitude);
      const deliveryRangeRadiusKm = optionalNumber(form.deliveryRangeRadiusKm);
      const deliveryFeeTiers = parseDeliveryFeeTiers(form.deliveryFeeTiersText);
      const deliveryRangePolygon = parseDeliveryRangePolygon(form.deliveryRangePolygon);
      if (form.deliveryRangeEnabled) {
        if (deliveryOriginLatitude === undefined || deliveryOriginLongitude === undefined) {
          throw new Error('启用配送范围时必须填写配送起点经纬度');
        }
        if (deliveryRangeRadiusKm === undefined || deliveryRangeRadiusKm <= 0) {
          throw new Error('启用配送范围时必须填写有效服务半径');
        }
      }
      await apiPut('/api/admin/mall/settings', {
        freeDeliveryThresholdCents,
        defaultDeliveryFeeCents,
        deliveryPromiseMinutes: Number(form.deliveryPromiseMinutes) || 18,
        refundReviewMinutes,
        coldChainEnabled: form.coldChainEnabled,
        deliveryRules: {
          pickupWindowStart: form.pickupWindowStart,
          pickupWindowEnd: form.pickupWindowEnd,
          deliveryBatchTimes: form.deliveryBatchTimes,
          deliveryFeeCents: defaultDeliveryFeeCents,
          freeDeliveryThresholdCents,
          coldChainRequired: form.coldChainEnabled,
          refundReviewMinutes,
          rangeEnabled: form.deliveryRangeEnabled,
          originLatitude: deliveryOriginLatitude,
          originLongitude: deliveryOriginLongitude,
          originAddress: form.deliveryOriginAddress.trim(),
          rangeRadiusKm: deliveryRangeRadiusKm,
          rangePolygon: deliveryRangePolygon,
          feeTiers: deliveryFeeTiers,
          outOfRangeBlocked: form.deliveryRangeEnabled,
        },
        paymentSplitRules: {
          leaderCommissionRate: Number(form.leaderCommissionRate) || 0,
          platformServiceRate: Number(form.platformServiceRate) || 0,
          supplierSettlementCycle: form.supplierSettlementCycle,
          withdrawMinCents: moneyFromYuan(form.withdrawMinYuan),
        },
        roles: recordValue(data.mallSettings, 'roles'),
        riskThresholds: recordValue(data.mallSettings, 'riskThresholds'),
      });
      setSettingsForm(form);
      await reload();
    });
  };

  const resetPermissionForm = () => {
    setPermissionForm(initialPermissionForm);
  };

  const togglePermissionModule = (module: string) => {
    setPermissionForm(current => {
      const modules = current.modules.includes(module)
        ? current.modules.filter(item => item !== module)
        : [...current.modules, module];
      return { ...current, modules };
    });
  };

  const togglePermissionAction = (action: string) => {
    setPermissionForm(current => {
      const actions = current.actions.includes(action)
        ? current.actions.filter(item => item !== action)
        : [...current.actions, action];
      return { ...current, actions };
    });
  };

  const savePermission = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const isEditing = Boolean(permissionForm.id);
    await runAction(isEditing ? '权限更新' : '权限创建', async () => {
      const payload = {
        name: permissionForm.name.trim(),
        roleKey: permissionForm.roleKey.trim(),
        description: permissionForm.description.trim(),
        modules: permissionForm.modules,
        actions: permissionForm.actions,
        status: permissionForm.status,
      };
      const permission = isEditing
        ? await apiPut<JsonRecord>(`/api/admin/mall/permissions/${permissionForm.id}`, payload)
        : await apiPost<JsonRecord>('/api/admin/mall/permissions', payload);

      setData(current => ({
        ...current,
        mallPermissions: upsertRecordList(current.mallPermissions, permission),
      }));
      setPermissionForm(initialPermissionForm);
      await reload();
    });
  };

  const editPermission = (permission: JsonRecord) => {
    setPermissionForm(mallPermissionToForm(permission));
  };

  const deletePermission = async (id: string) => {
    await runAction('权限删除', async () => {
      await apiDelete(`/api/admin/mall/permissions/${id}`);
      setData(current => ({
        ...current,
        mallPermissions: current.mallPermissions.filter(permission => stringValue(permission, 'id') !== id),
      }));
      setPermissionForm(current => (current.id === id ? initialPermissionForm : current));
      await reload();
    });
  };

  const selectSession = async (id: string) => {
    setSelectedSessionId(id);
    await runAction('会话消息加载', async () => {
      const sessionMessages = await apiGet<JsonRecord[]>(`/api/support/sessions/${id}/messages`);
      setSupportMessages(sessionMessages);
    });
  };

  const createSupportSession = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await runAction('客服会话创建', async () => {
      const supportSession = await apiPost<JsonRecord>('/api/support/sessions', {
        userId: supportForm.userId || stringValue(data.users[0], 'id'),
        channel: 'web',
        topic: supportForm.topic,
      });
      await reload();
      const id = stringValue(supportSession, 'id');
      if (id) {
        setSelectedSessionId(id);
      }
    });
  };

  const sendSupportMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedSessionId) return;
    await runAction('客服消息发送', async () => {
      const message = await apiPost<JsonRecord>(`/api/support/sessions/${selectedSessionId}/messages`, {
        senderRole: 'agent',
        content: supportForm.message,
        metadata: { source: 'web-admin' },
      });
      setSupportMessages(current => [...current, message]);
      setSupportForm(current => ({ ...current, message: initialSupportForm.message }));
    });
  };

  const createSupportTicket = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await runAction('客服工单创建', async () => {
      await apiPost('/api/support/tickets', {
        userId: supportForm.userId || stringValue(data.users[0], 'id'),
        sessionId: selectedSessionId || undefined,
        orderId: supportForm.ticketOrderId || undefined,
        category: supportForm.ticketCategory,
        priority: supportForm.ticketPriority,
        title: supportForm.ticketTitle,
        description: '运营手动创建',
      });
      setSupportForm(current => ({
        ...current,
        ticketTitle: initialSupportForm.ticketTitle,
        ticketCategory: initialSupportForm.ticketCategory,
        ticketPriority: initialSupportForm.ticketPriority,
        ticketOrderId: '',
      }));
      await reload();
    });
  };

  const resolveTicket = async (id: string) => {
    await runAction('客服工单处理', async () => {
      await apiPut(`/api/support/tickets/${id}`, {
        status: 'resolved',
        resolution: '管理端已处理',
      });
      setData(current => ({ ...current, supportTickets: updateRecordList(current.supportTickets, id, { status: 'resolved', resolution: '管理端已处理' }) }));
    });
  };

  const updateAfterSaleStatus = async (id: string, status: string, handlingMethod: string, resolution: string, extra: JsonRecord = {}) => {
    await runAction('售后申请处理', async () => {
      const afterSale = await apiPut<JsonRecord>(`/api/admin/mall/after-sales/${id}`, {
        status,
        handlingMethod,
        resolution,
        ...extra,
      });
      setData(current => ({
        ...current,
        mallAfterSales: updateRecordList(current.mallAfterSales, id, afterSale),
      }));
      await reload();
    });
  };

  const createKnowledge = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await runAction('知识库发布', async () => {
      await apiPost('/api/support/knowledge', {
        title: supportForm.knowledgeTitle,
        category: supportForm.knowledgeCategory,
        content: supportForm.knowledgeContent,
        status: 'published',
      });
      await reload();
    });
  };

  const updateKnowledgeStatus = async (id: string, status: string) => {
    await runAction('知识库状态更新', async () => {
      const article = await apiPut<JsonRecord>(`/api/support/knowledge/${id}`, { status });
      setData(current => ({
        ...current,
        supportKnowledge: updateRecordList(current.supportKnowledge, id, article),
      }));
    });
  };

  const selectModule = (moduleKey: AdminModuleKey) => {
    const nextModule = adminModules.find(module => module.key === moduleKey) || adminModules[0];
    setActiveModuleKey(nextModule.key);
    setActivePageKey(nextModule.pages[0].key);
    writeAdminRouteToLocation(nextModule.pages[0].key);
  };

  const selectPage = (pageKey: string) => {
    const route = findAdminRoute(pageKey);
    if (route) {
      setActiveModuleKey(route.moduleKey);
    }
    setActivePageKey(pageKey);
    writeAdminRouteToLocation(pageKey);
    const homeSectionConfig = homeSectionPageConfigs[pageKey];
    if (homeSectionConfig) {
      resetHomeSectionForm(homeSectionConfig.sectionType);
    }
  };

  const togglePageGroup = (groupKey: string) => {
    setCollapsedGroups(current => ({ ...current, [groupKey]: !current[groupKey] }));
  };

  const renderActivePage = () => {
    if (activePageKey === 'platform.overview') {
      return <OperationsDataScreen data={data} errors={errors} />;
    }
    if (activePageKey === 'mall.data') {
      return <OperationsDataScreen data={data} errors={errors} />;
    }
    if (activePageKey === 'platform.accounts') {
      return <UsersSection users={data.users} onUpdateStatus={updateUserStatus} />;
    }
    if (activePageKey === 'vehicle.review' || activePageKey === 'vehicle.vehicleList') {
      return <VehiclesSection vehicles={data.vehicles} onReview={reviewVehicle} />;
    }
    if (activePageKey === 'vehicle.enterpriseReview' || activePageKey === 'platform.enterpriseAudit') {
      return <EnterpriseSection enterprises={data.enterprises} onUpdateStatus={updateEnterpriseStatus} />;
    }
    if (activePageKey === 'vehicle.dispatch') {
      return (
        <DispatchSection
          trips={data.trips}
          undispatchedOrders={data.undispatchedOrders}
          allOrders={data.allOrders}
          availableVehicles={data.availableVehicles}
          onCreateTrip={createTrip}
          onAssignOrders={assignOrdersToTrip}
          onRemoveOrder={removeOrderFromTrip}
          onLockTrip={lockTrip}
          onUnlockTrip={unlockTrip}
          onStartTrip={startTrip}
          onCompleteTrip={completeTrip}
          onReorderStops={reorderStops}
          onAutoAssign={autoAssignOrders}
        />
      );
    }
    if (activePageKey === 'vehicle.ownerReview') {
      return <DemandsSection demands={data.demands} vehicles={data.vehicles} />;
    }
    if (activePageKey === 'vehicle.cancellations') {
      return <CancellationsSection cancellations={data.cancellations} onHandle={handleCancellation} />;
    }
    if (activePageKey === 'vehicle.wallet') {
      return <OwnerWalletSection withdrawals={data.ownerWithdrawals} onManualComplete={manualCompleteWithdrawal} onManualFail={manualFailWithdrawal} />;
    }
    if (activePageKey === 'vehicle.transportOrders' || activePageKey === 'vehicle.commission' || activePageKey === 'platform.commission') {
      return (
        <TransportOrdersSection
          commissionPending={data.commissionPending}
          commissionSummary={data.commissionSummary}
          orders={data.transportOrders}
          onConfirmCommission={confirmCommission}
        />
      );
    }
    if (activePageKey === 'mall.products' || activePageKey === 'mall.productList') {
      if (activePageKey === 'mall.products') {
        return (
          <MallProductDesignSection
            categories={data.mallCategories}
            procurementBuyers={data.mallProcurementBuyers}
            form={productForm}
            products={data.mallProducts}
            onChange={patch => setProductForm(current => ({ ...current, ...patch }))}
            onSubmit={createProduct}
            onUploadImage={uploadProductImage}
            onUploadQualificationFile={uploadQualificationFile}
          />
        );
      }
      return (
        <MallProductsSection
          categories={data.mallCategories}
          procurementBuyers={data.mallProcurementBuyers}
          filters={productFilters}
          products={data.mallProducts}
          onApplyFilters={applyProductFilters}
          onFiltersChange={patch => setProductFilters(current => ({ ...current, ...patch }))}
          onSearch={() => applyProductFilters({ page: '1' })}
          onStatus={updateProductStatus}
          onUpdate={updateProduct}
          onUploadImage={uploadProductImage}
          onUploadQualificationFile={uploadQualificationFile}
        />
      );
    }
    if (activePageKey === 'mall.procurementBuyers') {
      return (
        <ProcurementBuyersSection
          buyers={data.mallProcurementBuyers}
          form={procurementBuyerForm}
          onDelete={deleteProcurementBuyer}
          onFormChange={patch => setProcurementBuyerForm(current => ({ ...current, ...patch }))}
          onSave={saveProcurementBuyer}
          onUploadLicense={uploadQualificationFile}
        />
      );
    }
    if (activePageKey === 'mall.categories') {
      return (
        <MallCategoriesSection
          categories={data.mallCategories}
          filters={categoryFilters}
          form={categoryForm}
          onDelete={deleteCategory}
          onFiltersChange={patch => setCategoryFilters(current => ({ ...current, ...patch }))}
          onFormChange={patch => setCategoryForm(current => ({ ...current, ...patch }))}
          onSaveCategoryOrder={saveCategoryOrder}
          onSave={saveCategory}
          onSearch={reload}
        />
      );
    }
    if (activePageKey === 'mall.inventory') {
      return (
        <MallInventorySection
          allProducts={data.mallProducts}
          categories={data.mallCategories}
          filters={inventoryFilters}
          products={data.mallInventoryAlerts}
          onCreateInventoryAlert={createInventoryAlert}
          onDeleteInventoryAlert={deleteInventoryAlert}
          onEditInventoryAlert={editInventoryAlert}
          onFiltersChange={patch => setInventoryFilters(current => ({ ...current, ...patch }))}
          onSearch={reload}
        />
      );
    }
    if (activePageKey === 'mall.todayOrders' || activePageKey === 'mall.historyOrders' || activePageKey === 'mall.abnormalOrders') {
      const mode: MallOrderOpsMode = activePageKey === 'mall.todayOrders'
        ? 'today'
        : activePageKey === 'mall.abnormalOrders'
          ? 'abnormal'
          : 'history';
      return (
        <MallOrderOpsSection
          filters={mallOpsFilters}
          mode={mode}
          orders={data.mallOrders}
          onDispatch={dispatchMallOrder}
          onFiltersChange={patch => setMallOpsFilters(current => ({ ...current, ...patch }))}
          onRefund={refundMallOrder}
          onSearch={searchMallOpsData}
          onStatus={updateMallOrderStatus}
          onViewDetail={openMallOrderDetail}
        />
      );
    }
    if (activePageKey === 'mall.orderDetail') {
      return (
        <MallOrderDetailSearchSection
          error={mallOrderSearchError}
          filters={mallOrderSearchFilters}
          loading={mallOrderSearchLoading}
          orders={mallOrderSearchResults}
          onClear={clearMallOrderSearch}
          onFiltersChange={patch => setMallOrderSearchFilters(current => ({ ...current, ...patch }))}
          onSearch={searchMallOrderDetail}
          onViewDetail={openMallOrderDetail}
        />
      );
    }
    if (activePageKey === 'mall.pickup') {
      return (
        <MallPickupPointsSection
          filters={pickupPointFilters}
          pickupPoints={data.mallPickupPoints}
          onDelete={deletePickupPoint}
          onFiltersChange={patch => setPickupPointFilters(current => ({ ...current, ...patch }))}
          onSave={savePickupPoint}
          onSearch={searchPickupPoints}
          onStatus={updatePickupPointStatus}
        />
      );
    }
    if (activePageKey === 'mall.leaders') {
      return (
        <MallGroupLeadersSection
          filters={groupLeaderFilters}
          leaders={data.mallGroupLeaders}
          pickupPoints={data.mallPickupPoints}
          onDelete={deleteGroupLeader}
          onFiltersChange={patch => setGroupLeaderFilters(current => ({ ...current, ...patch }))}
          onSave={saveGroupLeader}
          onSearch={searchGroupLeaders}
          onStatus={updateGroupLeaderStatus}
        />
      );
    }
    if (activePageKey === 'mall.deliverySheets' || activePageKey === 'mall.deliveryTracking' || activePageKey === 'mall.pickupConnect') {
      const mode: MallDeliveryOpsMode = activePageKey === 'mall.deliverySheets'
        ? 'sheets'
        : activePageKey === 'mall.deliveryTracking'
          ? 'tracking'
          : 'pickup';
      return (
        <MallDeliveryOpsSection
          deliverySheets={data.mallDeliverySheets}
          filters={mallOpsFilters}
          mode={mode}
          orders={data.mallOrders}
          pickupPoints={data.mallPickupPoints}
          onFiltersChange={patch => setMallOpsFilters(current => ({ ...current, ...patch }))}
          onGenerate={generateDeliverySheet}
          onSearch={searchMallOpsData}
          onUpdateStatus={updateDeliverySheetStatus}
        />
      );
    }
    if (activePageKey === 'mall.orders' || activePageKey === 'mall.refunds') {
      return (
        <MallOrdersSection
          orders={data.mallOrders}
          onDispatch={dispatchMallOrder}
          onRefund={refundMallOrder}
          onStatus={updateMallOrderStatus}
          onViewDetail={openMallOrderDetail}
        />
      );
    }
    if (activePageKey === 'mall.financeBills' || activePageKey === 'mall.settlements' || activePageKey === 'mall.withdrawals') {
      const mode: MallFinanceOpsMode = activePageKey === 'mall.financeBills'
        ? 'bills'
        : activePageKey === 'mall.settlements'
          ? 'settlements'
          : 'withdrawals';
      return (
        <MallFinanceOpsSection
          bills={data.mallFinanceBills}
          filters={mallOpsFilters}
          mode={mode}
          settlements={data.mallSettlementRecords}
          withdrawalForm={withdrawalForm}
          withdrawals={data.mallWithdrawalRequests}
          onCreateWithdrawal={createWithdrawal}
          onFiltersChange={patch => setMallOpsFilters(current => ({ ...current, ...patch }))}
          onSearch={searchMallOpsData}
          onWithdrawalChange={patch => setWithdrawalForm(current => ({ ...current, ...patch }))}
        />
      );
    }
    if (activePageKey === 'mall.salesStats' || activePageKey === 'mall.revenueStats' || activePageKey === 'mall.hotProducts') {
      const mode: MallStatsOpsMode = activePageKey === 'mall.salesStats'
        ? 'sales'
        : activePageKey === 'mall.revenueStats'
          ? 'revenue'
          : 'hot';
      return (
        <MallStatsOpsSection
          filters={mallOpsFilters}
          mode={mode}
          orders={data.mallOrders}
          stats={data.mallSalesStats}
          onFiltersChange={patch => setMallOpsFilters(current => ({ ...current, ...patch }))}
          onSearch={searchMallOpsData}
        />
      );
    }
    if (activePageKey === 'mall.coupons') {
      return (
        <MallCouponCenterSection
          coupons={data.mallCoupons}
          filters={couponFilters}
          form={couponForm}
          onChange={patch => setCouponForm(current => ({ ...current, ...patch }))}
          onDelete={deleteCoupon}
          onEdit={editCoupon}
          onFiltersChange={patch => setCouponFilters(current => ({ ...current, ...patch }))}
          onReset={resetCouponForm}
          onSearch={reload}
          onStatus={updateCouponStatus}
          onSubmit={saveCoupon}
        />
      );
    }
    if (activePageKey === 'mall.banners') {
      return (
        <MallHomeBannersSection
          banners={data.mallHomeBanners}
          filters={homeBannerFilters}
          form={homeBannerForm}
          onChange={patch => setHomeBannerForm(current => ({ ...current, ...patch }))}
          onEdit={banner => setHomeBannerForm(homeBannerToForm(banner))}
          onFiltersChange={patch => setHomeBannerFilters(current => ({ ...current, ...patch }))}
          onReset={() => setHomeBannerForm(initialHomeBannerForm)}
          onSearch={reload}
          onStatus={updateHomeBannerStatus}
          onSubmit={saveHomeBanner}
          onUploadImage={uploadProductImage}
        />
      );
    }
    if (homeSectionPageConfigs[activePageKey]) {
      const config = homeSectionPageConfigs[activePageKey];
      return (
        <MallHomeSectionsSection
          description={config.description}
          form={homeSectionForm.sectionType === config.sectionType ? homeSectionForm : { ...initialHomeSectionForm, ...config.defaults, sectionType: config.sectionType }}
          products={data.mallProducts}
          sectionType={config.sectionType}
          sections={data.mallHomeSections}
          title={config.title}
          onChange={patch => setHomeSectionForm(current => ({ ...current, ...patch, sectionType: config.sectionType }))}
          onDelete={deleteHomeSection}
          onEdit={editHomeSection}
          onReset={() => resetHomeSectionForm(config.sectionType)}
          onStatus={updateHomeSectionStatus}
          onSubmit={saveHomeSection}
          onUploadImage={uploadProductImage}
        />
      );
    }
    if (activePageKey === 'mall.campaigns') {
      return (
        <MallCampaignsSection
          campaigns={data.campaigns}
          filters={campaignFilters}
          form={campaignForm}
          products={data.mallProducts}
          onChange={patch => setCampaignForm(current => ({ ...current, ...patch }))}
          onCampaignStatus={updateCampaignStatus}
          onDelete={deleteCampaign}
          onEdit={editCampaign}
          onFiltersChange={patch => setCampaignFilters(current => ({ ...current, ...patch }))}
          onOpenFixedPriceCampaign={openFixedPriceCampaignPage}
          onOpenPromotionVenue={openPromotionVenuePage}
          onReset={resetCampaignForm}
          onSearch={reload}
          onSubmit={saveCampaign}
        />
      );
    }
    if (activePageKey === 'mall.fixedPriceCampaigns') {
      return (
        <MallFixedPriceCampaignsSection
          campaigns={data.fixedPriceCampaigns}
          form={fixedPriceCampaignForm}
          products={data.mallProducts}
          onCampaignStatus={updateCampaignStatus}
          onChange={patch => setFixedPriceCampaignForm(current => ({ ...current, ...patch }))}
          onDelete={deleteCampaign}
          onEdit={editFixedPriceCampaign}
          onReset={resetFixedPriceCampaignForm}
          onSubmit={saveFixedPriceCampaign}
          onUploadIcon={uploadProductImage}
        />
      );
    }
    if (activePageKey === 'mall.promotionVenues') {
      return (
        <MallPromotionVenuesSection
          campaigns={data.promotionVenues}
          form={promotionVenueForm}
          products={data.mallProducts}
          onCampaignStatus={updateCampaignStatus}
          onChange={patch => setPromotionVenueForm(current => ({ ...current, ...patch }))}
          onDelete={deleteCampaign}
          onEdit={editPromotionVenue}
          onReset={resetPromotionVenueForm}
          onSubmit={savePromotionVenue}
          onUploadImage={uploadProductImage}
        />
      );
    }
    if (activePageKey === 'mall.groupBuyPresale') {
      return (
        <MallGroupBuyPresaleSection
          detailActivity={groupBuyDetailActivity}
          detailOpen={groupBuyDetailOpen}
          form={groupBuyForm}
          groupBuys={data.mallGroupBuys}
          modalOpen={groupBuyModalOpen}
          products={data.mallProducts}
          subscriptions={groupBuySubscriptions}
          onAction={handleGroupBuyAction}
          onChange={patch => setGroupBuyForm(current => ({ ...current, ...patch }))}
          onCloseDetail={closeGroupBuyDetail}
          onEdit={editGroupBuy}
          onModalOpenChange={setGroupBuyModalOpen}
          onOpenDetail={openGroupBuyDetail}
          onReset={resetGroupBuyForm}
          onSubmit={saveGroupBuy}
          onTiersChange={updater => setGroupBuyForm(current => ({ ...current, tiers: updater(current.tiers) }))}
        />
      );
    }
    if (activePageKey === 'mall.settings') {
      return (
        <MallSettingsSection
          campaigns={data.campaigns}
          onCampaignStatus={updateCampaignStatus}
        />
      );
    }
    if (activePageKey === 'mall.deliveryRules') {
      return (
        <MallDeliveryRulesSection
          settingsForm={settingsForm}
          onSettingsSave={saveSettingsForm}
        />
      );
    }
    if (activePageKey === 'mall.paymentSplit') {
      return (
        <MallPaymentSplitRulesSection
          settingsForm={settingsForm}
          onSettingsSave={saveSettingsForm}
        />
      );
    }
    if (activePageKey === 'mall.permissions') {
      return (
        <MallPermissionsSection
          filters={permissionFilters}
          form={permissionForm}
          permissions={data.mallPermissions}
          onChange={patch => setPermissionForm(current => ({ ...current, ...patch }))}
          onDelete={deletePermission}
          onEdit={editPermission}
          onFiltersChange={patch => setPermissionFilters(current => ({ ...current, ...patch }))}
          onReset={resetPermissionForm}
          onSearch={reload}
          onSubmit={savePermission}
          onToggleAction={togglePermissionAction}
          onToggleModule={togglePermissionModule}
        />
      );
    }
    if (activePageKey === 'mall.supportData') {
      return (
        <SupportDataSection
          afterSales={rawAfterSalesQueue}
          knowledge={data.supportKnowledge}
          sessions={data.supportSessions}
          stats={supportStats}
          tickets={data.supportTickets}
        />
      );
    }
    if (activePageKey === 'mall.support' || activePageKey === 'vehicle.support') {
      return (
        <SupportSection
          filters={supportFilters}
          form={supportForm}
          messages={supportMessages}
          metrics={data.supportMetrics}
          selectedSessionId={selectedSessionId}
          sessions={filteredSupportSessions}
          onClearFilters={() => setSupportFilters(initialSupportFilters)}
          onCreateSession={createSupportSession}
          onFiltersChange={patch => setSupportFilters(current => ({ ...current, ...patch }))}
          onFormChange={patch => setSupportForm(current => ({ ...current, ...patch }))}
          onSelectSession={selectSession}
          onSendMessage={sendSupportMessage}
        />
      );
    }
    if (activePageKey === 'mall.afterSales') {
      return (
        <AfterSalesSection
          afterSales={afterSalesQueue}
          filters={supportFilters}
          onClearFilters={() => setSupportFilters(initialSupportFilters)}
          onFiltersChange={patch => setSupportFilters(current => ({ ...current, ...patch }))}
          onUpdateAfterSale={updateAfterSaleStatus}
          onViewAfterSaleOrder={openMallOrderDetail}
        />
      );
    }
    if (activePageKey === 'mall.supportTickets') {
      return (
        <SupportTicketsSection
          filters={supportFilters}
          form={supportForm}
          tickets={filteredSupportTickets}
          onClearFilters={() => setSupportFilters(initialSupportFilters)}
          onCreateTicket={createSupportTicket}
          onFiltersChange={patch => setSupportFilters(current => ({ ...current, ...patch }))}
          onFormChange={patch => setSupportForm(current => ({ ...current, ...patch }))}
          onResolveTicket={resolveTicket}
        />
      );
    }
    if (activePageKey === 'mall.knowledge' || activePageKey === 'vehicle.knowledge') {
      return (
        <SupportKnowledgeSection
          form={supportForm}
          knowledge={data.supportKnowledge}
          onCreateKnowledge={createKnowledge}
          onFormChange={patch => setSupportForm(current => ({ ...current, ...patch }))}
          onUpdateKnowledgeStatus={updateKnowledgeStatus}
        />
      );
    }
    return <DesignPlaceholderPage data={data} module={currentModule} page={currentPage} />;
  };

  if (!session) {
    return (
      <AdminMessageContext.Provider value={showMessage}>
        <AdminMessageHost messages={messages} onDismiss={dismissMessage} />
        <LoginScreen error={authError} loading={authLoading} onSubmit={handleLogin} />
      </AdminMessageContext.Provider>
    );
  }

  const currentAdmin = session.user;
  const currentAdminRole = roleLabel(currentAdmin.role);
  const currentAdminName = currentAdmin.name || currentAdminRole;
  const currentAdminContact = currentAdmin.phone || shortId(currentAdmin.id);
  const moduleCollapsed = moduleSwitcherCollapsed;

  return (
    <AdminMessageContext.Provider value={showMessage}>
      <AdminMessageHost messages={messages} onDismiss={dismissMessage} />
      <div className={`admin-shell design-admin module-${currentModule.theme}${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
      <aside className="sidebar design-sidebar">
        <div className="sidebar-top">
          <div className="sidebar-head">
            <div className="brand" title={`${currentModule.brand} ${currentModule.subtitle}`}>
              <div className="brand-mark">
                {currentModule.key === 'mall' ? (
                  <img alt="" className="brand-mark-image" src={sanyouLogo} />
                ) : currentModule.brand.slice(0, 1)}
              </div>
              <div className="brand-copy">
                <strong>{currentModule.brand}</strong>
                <span>{currentModule.subtitle}</span>
              </div>
            </div>
            <button
              aria-label={sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}
              className="sidebar-toggle"
              title={sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}
              type="button"
              onClick={() => setSidebarCollapsed(current => !current)}
            >
              <Icon name="menu" />
            </button>
          </div>

          <div className="sidebar-admin-card">
            <div className="sidebar-admin-avatar">{currentAdminName.slice(0, 1)}</div>
            <div className="sidebar-admin-info">
              <span>当前管理员</span>
              <strong title={currentAdminName}>{currentAdminName}</strong>
              {currentAdmin.name ? <small>{currentAdminRole}</small> : null}
              <small>{currentAdminContact}</small>
            </div>
          </div>
        </div>

        <div className="module-switcher">
          <button
            aria-expanded={!moduleCollapsed}
            className="sidebar-section-toggle"
            title={moduleCollapsed ? '展开业务模块' : '收起业务模块'}
            type="button"
            onClick={() => setModuleSwitcherCollapsed(current => !current)}
          >
            <strong className="sidebar-section-mark">模</strong>
            <span>业务模块</span>
            <small>平台治理 / 无人车 / 商城</small>
            <b>{moduleCollapsed ? '展开' : '收起'}</b>
          </button>
          <div className={moduleCollapsed ? 'module-pages module-pages-collapsed' : 'module-pages'}>
            {adminModules.map(module => (
              <button
                aria-label={`${module.moduleLabel}，${module.pages.length} 页`}
                className={module.key === activeModuleKey ? 'module-button active' : 'module-button'}
                key={module.key}
                title={`${module.moduleLabel}，${module.pages.length} 页`}
                type="button"
                onClick={() => selectModule(module.key)}
              >
                <b className="module-button-mark">
                  {module.key === 'mall' ? (
                    <img alt="" className="module-button-mark-image" src={sanyouLogo} />
                  ) : module.moduleLabel.slice(0, 1)}
                </b>
                <span>{module.moduleLabel}</span>
                <small>{module.pages.length} 页</small>
              </button>
            ))}
          </div>
        </div>

        <nav className="design-nav">
          {moduleGroups(currentModule).map(group => {
            const groupKey = `${currentModule.key}:${group}`;
            const groupCollapsed = Boolean(collapsedGroups[groupKey]);
            const pages = currentModule.pages.filter(page => page.group === group);
            return (
              <div className="page-menu-section" key={group}>
                <button
                  aria-expanded={!groupCollapsed}
                  className="page-menu-title"
                  title={groupCollapsed ? `展开${group}` : `收起${group}`}
                  type="button"
                  onClick={() => togglePageGroup(groupKey)}
                >
                  <span>{group}</span>
                  <small>{pages.length} 项</small>
                  <b className="page-menu-state">{groupCollapsed ? '展开' : '收起'}</b>
                </button>
                <div className={groupCollapsed ? 'page-menu-items page-menu-items-collapsed' : 'page-menu-items'}>
                  {pages.map(page => (
                    <button
                      className={page.key === activePageKey ? 'nav-item active' : 'nav-item'}
                      key={page.key}
                      title={page.label}
                      type="button"
                      onClick={() => selectPage(page.key)}
                    >
                      <Icon name={page.icon} />
                      <span>{page.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <button
            aria-label="退出登录"
            className="sidebar-logout"
            title="退出登录"
            type="button"
            onClick={() => setLogoutConfirmOpen(true)}
            disabled={Boolean(busy)}
          >
            <Icon name="logout" />
            <span>退出登录</span>
          </button>
        </div>
      </aside>

      <main className="workspace design-workspace">
        <header className="topbar design-topbar">
          <div>
            <span className="design-breadcrumb">{currentModule.moduleLabel} / {currentPage.group}</span>
            <h1>{currentPage.label}</h1>
          </div>
          <div className="topbar-actions">
            <AdminMessageBox
              messages={messageHistory}
              open={messageBoxOpen}
              onClear={() => setMessageHistory([])}
              onToggle={() => setMessageBoxOpen(current => !current)}
            />
          </div>
        </header>

        <div className="design-main">
          <ErrorStrip errors={errors} />
          {busy ? <div className="busy-line">{busy}中...</div> : null}
          {loading ? <div className="loading-panel">正在加载管理端数据...</div> : null}
          {!loading ? renderActivePage() : null}
        </div>
      </main>
      <MallOrderDetailModal
        error={mallOrderDetailError}
        loading={mallOrderDetailLoading}
        open={mallOrderDetailModalOpen}
        order={mallOrderDetail}
        onClose={() => {
          setMallOrderDetailModalOpen(false);
          setMallOrderDetailError('');
          setWeightAdjustmentItem(null);
        }}
        onAdjustWeight={setWeightAdjustmentItem}
      />
      <WeightAdjustmentModal
        item={weightAdjustmentItem}
        saving={weightAdjustmentSaving}
        onClose={() => setWeightAdjustmentItem(null)}
        onSubmit={submitWeightAdjustment}
      />
      {logoutConfirmOpen ? (
        <div className="modal-backdrop">
          <section className="modal-panel confirm-modal" aria-labelledby="logout-confirm-title">
            <div className="modal-title-row">
              <div>
                <h2 id="logout-confirm-title">确认退出登录</h2>
                <p>退出后需要重新登录才能进入 Web 管理端。</p>
              </div>
              <button className="ghost-button" type="button" onClick={() => setLogoutConfirmOpen(false)}>
                <Icon name="x" />
              </button>
            </div>
            <div className="modal-actions">
              <button className="ghost-button" type="button" onClick={() => setLogoutConfirmOpen(false)}>取消</button>
              <button className="danger-button" disabled={Boolean(busy)} type="button" onClick={() => void handleLogout()}>
                <Icon name="logout" />
                确认退出
              </button>
            </div>
          </section>
        </div>
      ) : null}
      </div>
    </AdminMessageContext.Provider>
  );
}

const root = document.getElementById('web-admin-root');

if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
