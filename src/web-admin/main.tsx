import { StrictMode, useEffect, useMemo, useState } from 'react';
import type { DragEvent, FormEvent, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

declare const __PROJECT_DOMAIN__: string | undefined;

type JsonRecord = Record<string, unknown>;

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
  mallInventoryAlerts: JsonRecord[];
  mallOrders: JsonRecord[];
  mallAfterSales: JsonRecord[];
  mallOpsOverview: JsonRecord;
  mallListingRequests: JsonRecord[];
  mallDeliverySheets: JsonRecord[];
  mallPickupPoints: JsonRecord[];
  mallGroupLeaders: JsonRecord[];
  mallFinanceBills: JsonRecord[];
  mallSettlementRecords: JsonRecord[];
  mallWithdrawalRequests: JsonRecord[];
  mallSalesStats: JsonRecord;
  campaigns: JsonRecord[];
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
  availableVehicles: JsonRecord[];
}

interface ProductForm {
  name: string;
  sku: string;
  categoryCode: string;
  subtitle: string;
  description: string;
  imageUrl: string;
  specification: string;
  saleMethod: string;
  priceYuan: string;
  supplyPriceYuan: string;
  stock: string;
  stockAlertThreshold: string;
  lengthCm: string;
  widthCm: string;
  heightCm: string;
  volumeLiters: string;
  weightKg: string;
  tags: string;
  status: string;
  deliveryMinutes: string;
  coldChainRequired: boolean;
}

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
  rules: string;
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
      designPage('mall.products', '商品上架', '商品管理', '维护商品资料、价格、库存和图片', 'shop', 'mallProducts'),
      designPage('mall.productList', '商品列表', '商品管理', '在售、售罄和下架商品管理', 'shop', 'mallProducts'),
      designPage('mall.categories', '品类管理', '品类管理', '社区团购类目、排序和状态', 'dashboard'),
      designPage('mall.inventory', '库存预警', '商品管理', '库存管理、低库存、缺货替换和补货提醒', 'support'),
      designPage('mall.listingRequests', '商品上下架申请', '商品管理', '商品上架、下架申请与平台审核', 'check', 'mallProducts'),
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
      designPage('mall.settings', '运营设置', '运营设置', '活动启停快捷操作', 'save', 'operations'),
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
  mallInventoryAlerts: [],
  mallOrders: [],
  mallAfterSales: [],
  mallOpsOverview: {},
  mallListingRequests: [],
  mallDeliverySheets: [],
  mallPickupPoints: [],
  mallGroupLeaders: [],
  mallFinanceBills: [],
  mallSettlementRecords: [],
  mallWithdrawalRequests: [],
  mallSalesStats: {},
  campaigns: [],
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
  availableVehicles: [],
};

const initialProductForm: ProductForm = {
  name: '',
  sku: '',
  categoryCode: 'fruit',
  subtitle: '',
  description: '',
  imageUrl: '',
  specification: '单份',
  saleMethod: '按份',
  priceYuan: '19.90',
  supplyPriceYuan: '12.80',
  stock: '80',
  stockAlertThreshold: '15',
  lengthCm: '',
  widthCm: '',
  heightCm: '',
  volumeLiters: '',
  weightKg: '',
  tags: '鲜选,冷链',
  status: 'on_sale',
  deliveryMinutes: '18',
  coldChainRequired: false,
};

const initialCategoryForm: CategoryForm = {
  id: '',
  code: '',
  name: '',
  sortOrder: '0',
  status: 'active',
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
};

const initialCategoryFilters: MallFilterState = {
  keyword: '',
  categoryCode: '',
  status: '',
  stockStatus: '',
};

const initialInventoryFilters: MallFilterState = {
  keyword: '',
  categoryCode: '',
  status: '',
  stockStatus: 'alert',
};

const initialCampaignForm: CampaignForm = {
  id: '',
  name: '鲜选满减活动',
  campaignType: 'discount',
  budgetYuan: '3000',
  status: 'active',
  rules: '{"thresholdCents":9900,"discountCents":1000}',
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
    mallInventoryAlerts,
    mallOrders,
    mallAfterSales,
    mallOpsOverview,
    mallListingRequests,
    mallDeliverySheets,
    mallPickupPoints,
    mallGroupLeaders,
    mallFinanceBills,
    mallSettlementRecords,
    mallWithdrawalRequests,
    mallSalesStats,
    campaigns,
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
      limit: 100,
      keyword: productFilters.keyword,
      categoryCode: productFilters.categoryCode,
      status: productFilters.status,
      stockStatus: productFilters.stockStatus,
    })),
    loadWithFallback('库存预警', [], errors, () => apiGet<JsonRecord[]>('/api/admin/mall/inventory-alerts', {
      keyword: inventoryFilters.keyword,
      categoryCode: inventoryFilters.categoryCode,
      status: inventoryFilters.status,
      stockStatus: inventoryFilters.stockStatus,
    })),
    loadWithFallback('商城订单', [], errors, () => apiGet<JsonRecord[]>('/api/admin/mall/orders')),
    loadWithFallback('售后申请', [], errors, () => apiGet<JsonRecord[]>('/api/admin/mall/after-sales')),
    loadWithFallback('商城运营概览', {}, errors, () => apiGet<JsonRecord>('/api/admin/mall/ops/overview')),
    loadWithFallback('商品上下架申请', [], errors, () => apiGet<JsonRecord[]>('/api/admin/mall/listing-requests', { limit: 100 })),
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
      mallInventoryAlerts,
      mallOrders,
      mallAfterSales,
      mallOpsOverview,
      mallListingRequests,
      mallDeliverySheets,
      mallPickupPoints,
      mallGroupLeaders,
      mallFinanceBills,
      mallSettlementRecords,
      mallWithdrawalRequests,
      mallSalesStats,
      campaigns,
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

function validateProductForm(form: ProductForm) {
  for (const [label, value] of [
    ['名称', form.name],
    ['类目', form.categoryCode],
    ['售价', form.priceYuan],
    ['进货价', form.supplyPriceYuan],
    ['库存', form.stock],
    ['规格', form.specification],
    ['售卖方式', form.saleMethod],
    ['状态', form.status],
    ['商品说明', form.description],
  ]) {
    if (!String(value).trim()) {
      throw new Error(`${label}不能为空`);
    }
  }
  if (moneyFromYuan(form.priceYuan) <= 0) {
    throw new Error('售价必须大于0');
  }
  if (moneyFromYuan(form.supplyPriceYuan) <= 0) {
    throw new Error('进货价必须大于0');
  }
  const stock = Number(form.stock);
  if (!Number.isFinite(stock) || stock < 0) {
    throw new Error('库存不能小于0');
  }
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

function resolveImage(url: string) {
  if (!url) return '';
  if (/^(https?:|data:|blob:)/.test(url)) return url;
  if (url.startsWith('/')) return `${API_BASE}${url}`;
  return `${API_BASE}/api/uploads/${url}`;
}

function tagsText(record: JsonRecord) {
  const tags = arrayValue(record, 'tags')
    .map(item => String(item))
    .filter(Boolean);
  return tags.length ? tags.join(' / ') : '-';
}

function productToForm(product: JsonRecord, fallbackCategoryCode = 'fruit'): ProductForm {
  return {
    name: stringValue(product, 'name'),
    sku: stringValue(product, 'sku'),
    categoryCode: stringValue(product, 'categoryCode', fallbackCategoryCode),
    subtitle: stringValue(product, 'subtitle'),
    description: stringValue(product, 'description'),
    imageUrl: stringValue(product, 'imageKey', stringValue(product, 'imageUrl')),
    specification: stringValue(product, 'specification', stringValue(product, 'subtitle')),
    saleMethod: stringValue(product, 'saleMethod', stringValue(product, 'specification', stringValue(product, 'subtitle'))),
    priceYuan: (numberValue(product, 'priceCents') / 100).toFixed(2),
    supplyPriceYuan: numberValue(product, 'supplyPriceCents')
      ? (numberValue(product, 'supplyPriceCents') / 100).toFixed(2)
      : '',
    stock: String(numberValue(product, 'stock')),
    stockAlertThreshold: String(numberValue(product, 'stockAlertThreshold', 15)),
    lengthCm: stringValue(product, 'lengthCm'),
    widthCm: stringValue(product, 'widthCm'),
    heightCm: stringValue(product, 'heightCm'),
    volumeLiters: stringValue(product, 'volumeLiters'),
    weightKg: stringValue(product, 'weightKg'),
    tags: arrayValue(product, 'tags').map(item => String(item)).join(','),
    status: stringValue(product, 'status', 'on_sale'),
    deliveryMinutes: String(numberValue(product, 'deliveryMinutes', 18)),
    coldChainRequired: boolValue(product, 'coldChainRequired'),
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
    discount: '满减活动',
    coupon: '券包活动',
    bundle: '组合购',
    subsidy: '配送补贴',
    delivery_subsidy: '配送补贴',
    free_delivery: '免配送费',
  };
  return labels[value] || value || '-';
}

function linkTypeLabel(value: string) {
  const labels: Record<string, string> = {
    none: '不跳转',
    category: '品类',
    product: '商品',
    search: '搜索',
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

function campaignToForm(campaign: JsonRecord): CampaignForm {
  const rules = recordValue(campaign, 'rules');
  return {
    id: stringValue(campaign, 'id'),
    name: stringValue(campaign, 'name'),
    campaignType: stringValue(campaign, 'campaignType', 'discount'),
    budgetYuan: String((numberValue(campaign, 'budgetCents') / 100).toFixed(2)),
    status: stringValue(campaign, 'status', 'draft'),
    rules: JSON.stringify(rules, null, 2),
  };
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
    processing: '处理中',
    refunding: '退款中',
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
  if (['active', 'on_sale', 'paid', 'completed', 'approved', 'published', 'resolved', 'delivered', 'shipped'].includes(status)) {
    return 'badge badge-green';
  }
  if (['pending', 'pending_payment', 'dispatching', 'delivering', 'generated', 'shipping', 'open', 'submitted', 'processing', 'refunding', 'refund_pending', 'commission_pending'].includes(status)) {
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
  return ['open', 'submitted', 'approved', 'processing', 'refunding', 'pending'].includes(status);
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
  description,
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
          {description ? <p>{description}</p> : null}
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
  availableVehicles,
  onCreateTrip,
  onAssignOrders,
  onRemoveOrder,
  onLockTrip,
  onUnlockTrip,
  onStartTrip,
  onCompleteTrip,
  onReorderStops: _onReorderStops,
}: {
  trips: JsonRecord[];
  undispatchedOrders: JsonRecord[];
  availableVehicles: JsonRecord[];
  onCreateTrip: (vehicleId: string, orderIds: string[]) => Promise<void>;
  onAssignOrders: (tripId: string, orderIds: string[]) => Promise<void>;
  onRemoveOrder: (tripId: string, orderId: string) => Promise<void>;
  onLockTrip: (tripId: string) => Promise<void>;
  onUnlockTrip: (tripId: string) => Promise<void>;
  onStartTrip: (tripId: string) => Promise<void>;
  onCompleteTrip: (tripId: string) => Promise<void>;
  onReorderStops: (_tripId: string, _stopIds: string[]) => Promise<void>;
}) {
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [tripFilter, setTripFilter] = useState('');
  const [expandedTrip, setExpandedTrip] = useState<string | null>(null);
  const [assigningTripId, setAssigningTripId] = useState('');
  const [assignOrderIds, setAssignOrderIds] = useState<Set<string>>(new Set());
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  const toggleOrder = (id: string) => {
    setSelectedOrders(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAssignOrder = (id: string) => {
    setAssignOrderIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleCreateTrip = async () => {
    if (!selectedVehicle || selectedOrders.size === 0) return;
    await onCreateTrip(selectedVehicle, Array.from(selectedOrders));
    setSelectedOrders(new Set());
    setSelectedVehicle('');
  };

  const handleAssign = async () => {
    if (!assigningTripId || assignOrderIds.size === 0) return;
    await onAssignOrders(assigningTripId, Array.from(assignOrderIds));
    setAssignOrderIds(new Set());
    setAssigningTripId('');
  };

  const filteredTrips = tripFilter ? trips.filter(t => stringValue(t, 'status') === tripFilter) : trips;
  const plannedTrips = trips.filter(t => stringValue(t, 'status') === 'planned');
  const lockedTrips = trips.filter(t => stringValue(t, 'status') === 'locked');
  const inProgressTrips = trips.filter(t => stringValue(t, 'status') === 'in_progress');
  const editableTrips = trips.filter(t => stringValue(t, 'status') === 'planned' || stringValue(t, 'status') === 'locked');

  const tripStatusLabel: Record<string, string> = { planned: '未锁定', locked: '已锁定', in_progress: '运输中', completed: '已完成', cancelled: '已取消' };
  const tripStatusColor: Record<string, string> = { planned: 'badge-yellow', locked: 'badge-blue', in_progress: 'badge-green', completed: 'badge-gray', cancelled: 'badge-red' };
  const tripStatusBg: Record<string, string> = { planned: '#fef9c3', locked: '#dbeafe', in_progress: '#dcfce7', completed: '#f3f4f6', cancelled: '#fee2e2' };
  const tripStatusBorder: Record<string, string> = { planned: '#facc15', locked: '#3b82f6', in_progress: '#22c55e', completed: '#9ca3af', cancelled: '#ef4444' };

  return (
    <div className="page-grid">
      {/* 统计卡片 */}
      <div className="stat-grid compact">
        <StatCard label="待分配订单" value={String(undispatchedOrders.length)} detail="等待安排车辆" />
        <StatCard label="可用车辆" value={String(availableVehicles.length)} detail="空闲可调度" />
        <StatCard label="未锁定" value={String(plannedTrips.length)} detail="可增减订单" />
        <StatCard label="已锁定" value={String(lockedTrips.length)} detail="待出发" />
        <StatCard label="运输中" value={String(inProgressTrips.length)} detail="正在配送" />
      </div>

      {/* 创建行程 */}
      <Panel title="创建行程" description="选择可用车辆和待分配订单，创建配送行程">
        <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 220px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>选择车辆</label>
            <select value={selectedVehicle} onChange={e => setSelectedVehicle(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db' }}>
              <option value="">-- 选择车辆 --</option>
              {availableVehicles.map(v => (
                <option key={stringValue(v, 'id')} value={stringValue(v, 'id')}>
                  {stringValue(v, 'vehicle_code', stringValue(v, 'vehicleCode', ''))} - {stringValue(v, 'license_plate', stringValue(v, 'licensePlate', ''))} ({stringValue(v, 'vehicle_type', stringValue(v, 'vehicleType', ''))})
                </option>
              ))}
            </select>
          </div>
          <div>
            <span style={{ fontSize: '12px', color: '#6b7280' }}>已选 {selectedOrders.size} 个订单</span>
          </div>
          <button
            className="primary-button"
            type="button"
            disabled={!selectedVehicle || selectedOrders.size === 0}
            onClick={handleCreateTrip}
          >
            <Icon name="route" /> 创建行程
          </button>
        </div>

        {/* 待分配订单列表 - 带详情展开 */}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: '40px' }}></th>
                <th>订单号</th>
                <th>收货人</th>
                <th>收货地址</th>
                <th>商品</th>
                <th>金额</th>
                <th>状态</th>
                <th style={{ width: '40px' }}></th>
              </tr>
            </thead>
            <tbody>
              {undispatchedOrders.map(order => {
                const id = stringValue(order, 'id');
                const items = (order as Record<string, unknown>).items as JsonRecord[] | undefined;
                const isExpanded = expandedOrder === id;
                return (
                  <>
                    <tr key={id} style={{ background: selectedOrders.has(id) ? '#eff6ff' : undefined }}>
                      <td>
                        <input type="checkbox" checked={selectedOrders.has(id)} onChange={() => toggleOrder(id)} />
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
                        <button className="ghost-button" style={{ fontSize: '12px', padding: '2px 6px' }} type="button" onClick={() => setExpandedOrder(isExpanded ? null : id)}>
                          {isExpanded ? '收起' : '详情'}
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${id}-detail`}>
                        <td colSpan={8} style={{ padding: '0', background: '#f9fafb' }}>
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
                            {/* 途经点/目的地信息 */}
                            <div style={{ flex: '1 1 250px' }}>
                              <div style={{ fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>配送目的地</div>
                              <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <div><span style={{ color: '#6b7280' }}>地址：</span>{stringValue(order, 'address_text', stringValue(order, 'addressText', '-'))}</div>
                                <div><span style={{ color: '#6b7280' }}>收货人：</span>{stringValue(order, 'recipient_name', stringValue(order, 'recipientName', '-'))}</div>
                                <div><span style={{ color: '#6b7280' }}>电话：</span>{stringValue(order, 'recipient_phone', stringValue(order, 'recipientPhone', '-'))}</div>
                                <div><span style={{ color: '#6b7280' }}>期望送达：</span>{formatDate(stringValue(order, 'expected_delivery_time', stringValue(order, 'expectedDeliveryTime', ''))) || '无'}</div>
                              </div>
                            </div>
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
        {!undispatchedOrders.length ? <EmptyState text="暂无待分配订单" /> : null}
      </Panel>

      {/* 追加订单到已有行程（未锁定或已锁定状态都可追加） */}
      {editableTrips.length > 0 && undispatchedOrders.length > 0 && (
        <Panel title="追加订单到行程" description="将订单追加到未锁定或已锁定的行程中（发车前可自由调整）">
          <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 250px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>选择行程</label>
              <select value={assigningTripId} onChange={e => setAssigningTripId(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db' }}>
                <option value="">-- 选择行程 --</option>
                {editableTrips.map(t => {
                  const ts = stringValue(t, 'status');
                  return (
                    <option key={stringValue(t, 'id')} value={stringValue(t, 'id')}>
                      {stringValue(t, 'vehicle_code', stringValue(t, 'vehicleCode', ''))} - {stringValue(t, 'license_plate', stringValue(t, 'licensePlate', ''))} [{tripStatusLabel[ts] || ts}] ({stringValue(t, 'total_orders', stringValue(t, 'totalOrders', '0'))}单)
                    </option>
                  );
                })}
              </select>
            </div>
            <div>
              <span style={{ fontSize: '12px', color: '#6b7280' }}>已选 {assignOrderIds.size} 个订单</span>
            </div>
            <button
              className="primary-button"
              type="button"
              disabled={!assigningTripId || assignOrderIds.size === 0}
              onClick={handleAssign}
            >
              <Icon name="plus" /> 追加订单
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: '40px' }}></th>
                  <th>订单号</th>
                  <th>收货人</th>
                  <th>收货地址</th>
                  <th>商品</th>
                  <th>金额</th>
                </tr>
              </thead>
              <tbody>
                {undispatchedOrders.map(order => {
                  const id = stringValue(order, 'id');
                  const items = (order as Record<string, unknown>).items as JsonRecord[] | undefined;
                  return (
                    <tr key={id} style={{ background: assignOrderIds.has(id) ? '#eff6ff' : undefined }}>
                      <td><input type="checkbox" checked={assignOrderIds.has(id)} onChange={() => toggleAssignOrder(id)} /></td>
                      <td><strong>{stringValue(order, 'order_no', stringValue(order, 'orderNo', shortId(id)))}</strong></td>
                      <td>{stringValue(order, 'recipient_name', stringValue(order, 'recipientName', '-'))}</td>
                      <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stringValue(order, 'address_text', stringValue(order, 'addressText', '-'))}</td>
                      <td>
                        {items && items.length > 0
                          ? items.map(i => stringValue(i, 'productName', '')).filter(Boolean).join(', ') || '-'
                          : '-'}
                      </td>
                      <td>{yuan(Math.round(numberValue(order, 'payable_cents', numberValue(order, 'payableCents', 0)) / 100))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {/* 行程列表 */}
      <Panel title="行程列表" description="管理所有配送行程，锁定后可出发，发车前可增减订单">
        <div className="admin-filterbar">
          <select value={tripFilter} onChange={e => setTripFilter(e.target.value)}>
            <option value="">全部状态</option>
            <option value="planned">未锁定</option>
            <option value="locked">已锁定</option>
            <option value="in_progress">运输中</option>
            <option value="completed">已完成</option>
            <option value="cancelled">已取消</option>
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredTrips.map(trip => {
            const tripId = stringValue(trip, 'id');
            const status = stringValue(trip, 'status');
            const stops = ((trip as Record<string, unknown>).stops as JsonRecord[] | undefined) || [];
            const isExpanded = expandedTrip === tripId;
            const sortedStops = [...stops].sort((a, b) => numberValue(a, 'stopSequence', 0) - numberValue(b, 'stopSequence', 0));
            return (
              <div key={tripId} style={{ border: `2px solid ${tripStatusBorder[status] || '#d1d5db'}`, borderRadius: '8px', overflow: 'hidden', background: '#fff' }}>
                {/* 行程头部 */}
                <div
                  style={{ padding: '12px 16px', background: tripStatusBg[status] || '#f9fafb', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
                  onClick={() => setExpandedTrip(isExpanded ? null : tripId)}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <strong style={{ fontSize: '15px' }}>{stringValue(trip, 'vehicle_code', stringValue(trip, 'vehicleCode', '-'))}</strong>
                      <span style={{ fontSize: '13px', color: '#6b7280' }}>{stringValue(trip, 'license_plate', stringValue(trip, 'licensePlate', ''))}</span>
                      <span style={{ fontSize: '12px', color: '#6b7280' }}>({stringValue(trip, 'vehicle_type', stringValue(trip, 'vehicleType', ''))})</span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>
                      {stringValue(trip, 'total_orders', stringValue(trip, 'totalOrders', '0'))} 个订单 · {stops.length} 个站点 · 计划出发: {formatDate(stringValue(trip, 'planned_departure_time', stringValue(trip, 'plannedDepartureTime'))) || '未设定'}
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
                    <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '10px', color: '#374151' }}>配送站点（按顺序）</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {sortedStops.map((stop, idx) => {
                        const stopId = stringValue(stop, 'id');
                        const stopStatus = stringValue(stop, 'status');
                        const stopType = stringValue(stop, 'stopType');
                        const orderId = stringValue(stop, 'mallOrderId');
                        const orderItems = (stop as Record<string, unknown>).orderItems as JsonRecord[] | undefined;
                        return (
                          <div key={stopId} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '10px 14px', background: '#f9fafb', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
                            {/* 序号圆点 */}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', flexShrink: 0, paddingTop: '2px' }}>
                              <span style={{ width: '28px', height: '28px', borderRadius: '50%', background: stopStatus === 'completed' ? '#10b981' : stopType === 'pickup' ? '#3b82f6' : '#f59e0b', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 600 }}>
                                {idx + 1}
                              </span>
                              {idx < sortedStops.length - 1 && <span style={{ width: '2px', height: '12px', background: '#d1d5db' }}></span>}
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
                            {/* 状态和操作 */}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
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
              <p>{page.description}</p>
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
  products,
  form,
  onChange,
  onSubmit,
  onUploadImage,
}: {
  categories: JsonRecord[];
  products: JsonRecord[];
  form: ProductForm;
  onChange: (patch: Partial<ProductForm>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onUploadImage: (file: File) => Promise<string>;
}) {
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const alertCount = products.filter(product => numberValue(product, 'stock') <= numberValue(product, 'stockAlertThreshold', 15)).length;
  const completeCount = products.filter(product => stringValue(product, 'imageKey', stringValue(product, 'imageUrl')) && stringValue(product, 'specification') && stringValue(product, 'saleMethod')).length;

  return (
    <div className="mall-admin-design-page">
      <div className="mall-admin-toolbar">
        <label>
          默认状态
          <select value={form.status} onChange={event => onChange({ status: event.target.value })}>
            <option value="on_sale">上架</option>
            <option value="off_sale">下架</option>
            <option value="draft">草稿</option>
          </select>
        </label>
        <label>
          品类
          <select value={form.categoryCode} onChange={event => onChange({ categoryCode: event.target.value })}>
            {categories.map(category => (
              <option key={stringValue(category, 'code')} value={stringValue(category, 'code')}>
                {stringValue(category, 'name', stringValue(category, 'code'))}
              </option>
            ))}
            {!categories.length ? <option value="fruit">鲜果</option> : null}
          </select>
        </label>
        <label>
          图片
          <input value={form.imageUrl ? '已上传' : '待上传'} readOnly />
        </label>
        <button className="mall-admin-submit" type="button" onClick={() => setCreateModalOpen(true)}>新增上架商品</button>
      </div>

      <div className="mall-admin-kpis">
        <StatCard label="商品总数" value={String(products.length)} detail="当前筛选商品池" />
        <StatCard label="库存预警" value={String(alertCount)} detail="低于商品级阈值" />
        <StatCard label="报价资料完整" value={String(completeCount)} detail="含图片、规格和售卖方式" />
      </div>

      <section className="mall-admin-form-panel">
        <div className="design-panel-head">
          <div>
            <h2>商品上架</h2>
            <p>点击新增上架商品后，在弹窗中按运营报价表维护名称、类目、规格、售卖方式、进货价、售价和库存</p>
          </div>
          <span>{products.length} 个商品</span>
        </div>
        <div className="coverage-grid">
          <div>
            <strong>图片上传</strong>
            <span>运营上传商品主图后，系统会保存到商品资料</span>
          </div>
          <div>
            <strong>规格校验</strong>
            <span>销售规格和售卖方式对外展示，长宽高、体积、重量和冷链信息仅用于内部装载判断</span>
          </div>
          <div>
            <strong>库存预警</strong>
            <span>上架时可同步设置商品库存和预警阈值</span>
          </div>
        </div>
      </section>

      {createModalOpen ? (
        <ProductCreateModal
          categories={categories}
          form={form}
          onChange={onChange}
          onClose={() => setCreateModalOpen(false)}
          onSubmit={onSubmit}
          onUploadImage={onUploadImage}
        />
      ) : null}
    </div>
  );
}

function ProductFormFields({
  categories,
  form,
  layout = 'grid',
  onChange,
  onUploadImage,
}: {
  categories: JsonRecord[];
  form: ProductForm;
  layout?: 'grid' | 'tiles';
  onChange: (patch: Partial<ProductForm>) => void;
  onUploadImage: (file: File) => Promise<string>;
}) {
  const fieldClass = layout === 'tiles' ? 'mall-admin-tile' : undefined;
  const wrapperClass = layout === 'tiles' ? 'mall-admin-tile-grid' : 'form-grid';
  const upload = async (file: File | undefined) => {
    if (!file) return;
    const imageUrl = await onUploadImage(file);
    onChange({ imageUrl });
  };

  return (
    <div className={wrapperClass}>
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
      <label className={fieldClass}>
        商品主图
        <input accept="image/*" type="file" onChange={event => void upload(event.currentTarget.files?.[0])} />
        <input value={form.imageUrl} onChange={event => onChange({ imageUrl: event.target.value })} placeholder="上传后自动填入图片地址" />
      </label>
      <label className={fieldClass}>
        <span className="field-label">售价<span className="required-mark">*</span></span>
        <input required value={form.priceYuan} type="number" min="0.01" step="0.01" onChange={event => onChange({ priceYuan: event.target.value })} />
      </label>
      <label className={fieldClass}>
        <span className="field-label">进货价<span className="required-mark">*</span></span>
        <input required value={form.supplyPriceYuan} type="number" min="0.01" step="0.01" onChange={event => onChange({ supplyPriceYuan: event.target.value })} />
      </label>
      <label className={fieldClass}>
        <span className="field-label">库存<span className="required-mark">*</span></span>
        <input required value={form.stock} type="number" min="0" onChange={event => onChange({ stock: event.target.value })} />
      </label>
      <label className={fieldClass}>
        <span className="field-label">规格<span className="required-mark">*</span></span>
        <input required value={form.specification} onChange={event => onChange({ specification: event.target.value })} placeholder="单瓶 / 1件=24瓶 / 250ml*10盒" />
      </label>
      <label className={fieldClass}>
        <span className="field-label">售卖方式<span className="required-mark">*</span></span>
        <input required value={form.saleMethod} onChange={event => onChange({ saleMethod: event.target.value })} placeholder="单瓶 / 整件 / 按斤" />
      </label>
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
      <label className={layout === 'tiles' ? 'mall-admin-tile' : 'wide'}>
        副标题
        <input value={form.subtitle} onChange={event => onChange({ subtitle: event.target.value })} placeholder="规格、配送卖点" />
      </label>
      <label className={layout === 'tiles' ? 'mall-admin-tile' : 'wide'}>
        <span className="field-label">商品说明<span className="required-mark">*</span></span>
        <textarea required value={form.description} onChange={event => onChange({ description: event.target.value })} placeholder="商品卖点、包装、保存方式、售后说明等" />
      </label>
      <ProductSpecSubtable form={form} layout={layout} onChange={onChange} />
    </div>
  );
}

function ProductSpecSubtable({
  form,
  layout,
  onChange,
}: {
  form: ProductForm;
  layout: 'grid' | 'tiles';
  onChange: (patch: Partial<ProductForm>) => void;
}) {
  return (
    <section className={layout === 'tiles' ? 'mall-admin-spec-subtable mall-admin-tile wide' : 'product-spec-subtable wide'}>
      <div className="spec-subtable-head">
        <strong>装载规格（可选，不对外展示）</strong>
        <span>仅用于无人车装载、库存预警和履约判断</span>
      </div>
      <div className="spec-subtable-scroll">
        <table className="spec-subtable">
          <thead>
            <tr>
              <th>长 cm</th>
              <th>宽 cm</th>
              <th>高 cm</th>
              <th>体积 L</th>
              <th>重量 kg</th>
              <th>预警阈值</th>
              <th>配送分钟</th>
              <th>冷链</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><input value={form.lengthCm} type="number" min="0" step="0.1" onChange={event => onChange({ lengthCm: event.target.value })} /></td>
              <td><input value={form.widthCm} type="number" min="0" step="0.1" onChange={event => onChange({ widthCm: event.target.value })} /></td>
              <td><input value={form.heightCm} type="number" min="0" step="0.1" onChange={event => onChange({ heightCm: event.target.value })} /></td>
              <td><input value={form.volumeLiters} type="number" min="0" step="0.01" onChange={event => onChange({ volumeLiters: event.target.value })} /></td>
              <td><input value={form.weightKg} type="number" min="0" step="0.001" onChange={event => onChange({ weightKg: event.target.value })} /></td>
              <td><input value={form.stockAlertThreshold} type="number" min="0" onChange={event => onChange({ stockAlertThreshold: event.target.value })} /></td>
              <td><input value={form.deliveryMinutes} type="number" min="1" onChange={event => onChange({ deliveryMinutes: event.target.value })} /></td>
              <td>
                <label className="toggle-line compact-toggle">
                  <input checked={form.coldChainRequired} type="checkbox" onChange={event => onChange({ coldChainRequired: event.target.checked })} />
                  需要
                </label>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ProductImage({ record }: { record: JsonRecord }) {
  const imageUrl = resolveImage(stringValue(record, 'imageUrl'));
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
  products,
  filters,
  onFiltersChange,
  onSearch,
  onStatus,
  onUpdate,
  onUploadImage,
}: {
  categories: JsonRecord[];
  products: JsonRecord[];
  filters: MallFilterState;
  onFiltersChange: (patch: Partial<MallFilterState>) => void;
  onSearch: () => Promise<void>;
  onStatus: (id: string, status: string) => Promise<void>;
  onUpdate: (id: string, form: ProductForm) => Promise<void>;
  onUploadImage: (file: File) => Promise<string>;
}) {
  const [editingProduct, setEditingProduct] = useState<JsonRecord | null>(null);

  return (
    <div className="page-grid">
      <div className="admin-filterbar">
        <input value={filters.keyword} onChange={event => onFiltersChange({ keyword: event.target.value })} placeholder="搜索商品名称/SKU" />
        <select value={filters.categoryCode} onChange={event => onFiltersChange({ categoryCode: event.target.value })}>
          <option value="">全部品类</option>
          {categories.map(category => (
            <option key={stringValue(category, 'code')} value={stringValue(category, 'code')}>
              {stringValue(category, 'name', stringValue(category, 'code'))}
            </option>
          ))}
        </select>
        <select value={filters.status} onChange={event => onFiltersChange({ status: event.target.value })}>
          <option value="">全部状态</option>
          <option value="on_sale">在售</option>
          <option value="off_sale">下架</option>
          <option value="draft">草稿</option>
        </select>
        <select value={filters.stockStatus} onChange={event => onFiltersChange({ stockStatus: event.target.value })}>
          <option value="">全部库存</option>
          <option value="alert">库存预警</option>
          <option value="low">低库存</option>
          <option value="out">缺货</option>
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
                      <small>{tagsText(product)}</small>
                    </td>
                    <td>
                      <strong>{yuan(numberValue(product, 'priceCents'))}</strong>
                      <small>进货价 {numberValue(product, 'supplyPriceCents') ? yuan(numberValue(product, 'supplyPriceCents')) : '-'}</small>
                    </td>
                    <td>{numberValue(product, 'stock')}</td>
                    <td>
                      <span>{stringValue(product, 'specification', stringValue(product, 'subtitle', '-'))}</span>
                      <small>{stringValue(product, 'saleMethod', '-')} · 阈值 {numberValue(product, 'stockAlertThreshold', 15)}</small>
                    </td>
                    <td>
                      <span className={badgeClass(status)}>{statusLabel(status)}</span>
                    </td>
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
      </Panel>

      {editingProduct ? (
        <ProductEditModal
          categories={categories}
          product={editingProduct}
          onClose={() => setEditingProduct(null)}
          onSave={async (id, nextForm) => {
            await onUpdate(id, nextForm);
            setEditingProduct(null);
          }}
          onUploadImage={onUploadImage}
        />
      ) : null}
    </div>
  );
}

function ProductCreateModal({
  categories,
  form,
  onChange,
  onClose,
  onSubmit,
  onUploadImage,
}: {
  categories: JsonRecord[];
  form: ProductForm;
  onChange: (patch: Partial<ProductForm>) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onUploadImage: (file: File) => Promise<string>;
}) {
  return (
    <div className="modal-backdrop">
      <section className="modal-panel product-modal">
        <div className="panel-head">
          <div>
            <h2>新增上架商品</h2>
            <p>按报价表维护商品名称、类目、售价、进货价、库存、规格、售卖方式和上架状态</p>
          </div>
          <button className="ghost-button" type="button" onClick={onClose}>
            <Icon name="x" />
            关闭
          </button>
        </div>
        <form onSubmit={onSubmit}>
          <ProductFormFields
            categories={categories}
            form={form}
            onChange={onChange}
            onUploadImage={onUploadImage}
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
  product,
  onClose,
  onSave,
  onUploadImage,
}: {
  categories: JsonRecord[];
  product: JsonRecord;
  onClose: () => void;
  onSave: (id: string, form: ProductForm) => Promise<void>;
  onUploadImage: (file: File) => Promise<string>;
}) {
  const [draft, setDraft] = useState<ProductForm>(() => productToForm(product, stringValue(categories[0], 'code', 'fruit')));
  const id = stringValue(product, 'id');

  return (
    <div className="modal-backdrop">
      <section className="modal-panel product-modal">
        <div className="panel-head">
          <div>
            <h2>编辑商品</h2>
            <p>维护报价表信息、商品说明和内部装载规格</p>
          </div>
          <button className="ghost-button" type="button" onClick={onClose}>
            <Icon name="x" />
            关闭
          </button>
        </div>
        <ProductFormFields
          categories={categories}
          form={draft}
          onChange={patch => setDraft(current => ({ ...current, ...patch }))}
          onUploadImage={onUploadImage}
        />
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
  allProducts,
  categories,
  filters,
  form,
  inventoryFilters,
  inventoryProducts,
  onFormChange,
  onFiltersChange,
  onCreateInventoryAlert,
  onSearch,
  onSave,
  onDelete,
  onDeleteInventoryAlert,
  onEditInventoryAlert,
  onInventoryFiltersChange,
  onInventorySearch,
  onReorderCategory,
  showInventoryAlerts = false,
}: {
  allProducts: JsonRecord[];
  categories: JsonRecord[];
  filters: MallFilterState;
  form: CategoryForm;
  inventoryFilters: MallFilterState;
  inventoryProducts: JsonRecord[];
  onFormChange: (patch: Partial<CategoryForm>) => void;
  onFiltersChange: (patch: Partial<MallFilterState>) => void;
  onCreateInventoryAlert: (id: string, stock: number, stockAlertThreshold: number) => Promise<void>;
  onSearch: () => Promise<void>;
  onSave: (form: CategoryForm) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onDeleteInventoryAlert: (id: string) => Promise<void>;
  onEditInventoryAlert: (id: string, stock: number, stockAlertThreshold: number) => Promise<void>;
  onInventoryFiltersChange: (patch: Partial<MallFilterState>) => void;
  onInventorySearch: () => Promise<void>;
  onReorderCategory: (draggedId: string, targetId: string) => Promise<void>;
  showInventoryAlerts?: boolean;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [draggingCategoryId, setDraggingCategoryId] = useState('');
  const openCreate = () => {
    onFormChange(initialCategoryForm);
    setModalOpen(true);
  };
  const openEdit = (category: JsonRecord) => {
    onFormChange(categoryToForm(category));
    setModalOpen(true);
  };
  const handleDragStart = (event: DragEvent<HTMLTableRowElement>, id: string) => {
    setDraggingCategoryId(id);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', id);
  };
  const handleDrop = (event: DragEvent<HTMLTableRowElement>, targetId: string) => {
    event.preventDefault();
    const draggedId = event.dataTransfer.getData('text/plain') || draggingCategoryId;
    setDraggingCategoryId('');
    if (!draggedId || draggedId === targetId) return;
    void onReorderCategory(draggedId, targetId);
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
              {categories.map(category => {
                const id = stringValue(category, 'id');
                return (
                  <tr
                    className={draggingCategoryId === id ? 'sortable-row dragging' : 'sortable-row'}
                    draggable
                    key={id}
                    onDragEnd={() => setDraggingCategoryId('')}
                    onDragOver={event => event.preventDefault()}
                    onDragStart={event => handleDragStart(event, id)}
                    onDrop={event => handleDrop(event, id)}
                  >
                    <td><span className="drag-handle" aria-label="拖拽排序">↕</span></td>
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

      {showInventoryAlerts ? (
        <MallInventorySection
          allProducts={allProducts}
          categories={categories}
          filters={inventoryFilters}
          products={inventoryProducts}
          onCreateInventoryAlert={onCreateInventoryAlert}
          onDeleteInventoryAlert={onDeleteInventoryAlert}
          onEditInventoryAlert={onEditInventoryAlert}
          onFiltersChange={onInventoryFiltersChange}
          onSearch={onInventorySearch}
        />
      ) : null}

      {modalOpen ? (
        <div className="modal-backdrop">
          <section className="modal-panel">
            <div className="panel-head">
              <div>
                <h2>{form.id ? '编辑品类' : '新增品类'}</h2>
                <p>品类编码会用于商品归类和商城端筛选</p>
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
                <p>选择商品并维护当前库存和预警阈值，阈值为 0 表示关闭预警</p>
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

function MallOrderDetailView({ order }: { order: JsonRecord }) {
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
          <small>{stringValue(order, 'remark', '-')}</small>
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
                <th>小计</th>
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
                    <td>{yuan(itemLineTotal(row))}</td>
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
}: {
  open: boolean;
  order: JsonRecord | null;
  loading: boolean;
  error: string;
  onClose: () => void;
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
        {!loading && !error && order ? <MallOrderDetailView order={order} /> : null}
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

function MallListingRequestsSection({
  requests,
  filters,
  onFiltersChange,
  onReview,
  onSearch,
}: {
  requests: JsonRecord[];
  filters: MallOpsFilterState;
  onFiltersChange: (patch: Partial<MallOpsFilterState>) => void;
  onReview: (id: string, action: 'approve' | 'reject') => Promise<void>;
  onSearch: () => Promise<void>;
}) {
  const filteredRequests = filterMallOpsRecords(
    requests,
    filters,
    ['id', 'productId', 'productName', 'sku', 'requestType', 'requesterName', 'requesterRole', 'reason', 'status'],
    ['createdAt', 'updatedAt', 'reviewedAt'],
  );
  const pendingCount = requests.filter(request => ['pending', 'submitted'].includes(stringValue(request, 'status'))).length;
  const approvedCount = requests.filter(request => stringValue(request, 'status') === 'approved').length;

  return (
    <div className="page-grid ops-page">
      <MallOpsFilterbar
        filters={filters}
        placeholder="搜索商品、SKU、申请人"
        statusOptions={[
          ['pending', '待审核'],
          ['submitted', '已提交'],
          ['approved', '已通过'],
          ['rejected', '已拒绝'],
        ]}
        onFiltersChange={onFiltersChange}
        onSearch={onSearch}
      />
      <div className="ops-summary-grid">
        <StatCard label="待审核" value={String(pendingCount)} detail="上下架申请队列" />
        <StatCard label="已通过" value={String(approvedCount)} detail="平台审核后同步用户端" />
        <StatCard label="申请总数" value={String(requests.length)} detail="包含上架、下架和草稿转正" />
      </div>
      <Panel title="商品上下架申请" description="平台运营审核商品上架、下架申请，第一期仅管理员账号处理">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>商品</th>
                <th>申请类型</th>
                <th>申请人</th>
                <th>目标状态</th>
                <th>状态</th>
                <th>时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map(request => {
                const id = stringValue(request, 'id');
                const status = stringValue(request, 'status');
                const canReview = ['pending', 'submitted'].includes(status);
                return (
                  <tr key={id}>
                    <td>
                      <strong>{stringValue(request, 'productName', stringValue(request, 'name', shortId(stringValue(request, 'productId'))))}</strong>
                      <small>{stringValue(request, 'sku', stringValue(request, 'reason', '-'))}</small>
                    </td>
                    <td>{statusLabel(stringValue(request, 'requestType', stringValue(request, 'type')))}</td>
                    <td>
                      <span>{stringValue(request, 'requesterName', stringValue(request, 'requesterRole', '平台运营'))}</span>
                      <small>{stringValue(request, 'supplierName', 'A/平台运营')}</small>
                    </td>
                    <td>{statusLabel(stringValue(request, 'requestedStatus', stringValue(request, 'targetStatus')))}</td>
                    <td><span className={badgeClass(status)}>{statusLabel(status)}</span></td>
                    <td>
                      <span>{formatDate(stringValue(request, 'createdAt'))}</span>
                      <small>{formatDate(stringValue(request, 'reviewedAt'))}</small>
                    </td>
                    <td className="actions">
                      <button className="ghost-button" type="button" disabled={!canReview} onClick={() => void onReview(id, 'approve')}>
                        <Icon name="check" />
                        通过
                      </button>
                      <button className="ghost-button danger" type="button" disabled={!canReview} onClick={() => void onReview(id, 'reject')}>
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
        {!filteredRequests.length ? <EmptyState text="暂无上下架申请" /> : null}
      </Panel>
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
        <Panel title="提交提现申请" description="第一期由平台运营账号发起，不开放供应商注册">
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
                <p>填写券名称、类型、门槛、金额、发放数量和有效期。</p>
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
  return (
    <div className="split-grid">
      <Panel title={form.id ? '编辑首页配置' : '新增首页配置'} description="维护商城首页 Banner、活动位、跳转目标和排序">
        <form className="form-grid" onSubmit={onSubmit}>
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
          <button className="primary-button" type="submit">
            <Icon name="save" />
            {form.id ? '保存配置' : '创建配置'}
          </button>
          <button className="ghost-button" type="button" onClick={onReset}>
            <Icon name="x" />
            重置
          </button>
        </form>
      </Panel>

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
                  <button className="ghost-button" type="button" onClick={() => onEdit(banner)}>
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
  const visibleSections = sections
    .filter(section => stringValue(section, 'sectionType') === sectionType)
    .sort((a, b) => numberValue(a, 'sortOrder') - numberValue(b, 'sortOrder'));
  const isAnnouncement = sectionType === 'announcement';

  return (
    <div className="split-grid">
      <Panel title={form.id ? `编辑${title}` : `新增${title}`} description={description}>
        <form className="form-grid" onSubmit={onSubmit}>
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
          <button className="primary-button" type="submit">
            <Icon name="save" />
            {form.id ? '保存配置' : '创建配置'}
          </button>
          <button className="ghost-button" type="button" onClick={onReset}>
            <Icon name="x" />
            重置
          </button>
        </form>
      </Panel>

      <Panel title={`${title}列表`} description="启用后展示在商城首页，列表按排序值升序排列">
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
                  <button className="ghost-button" type="button" onClick={() => onEdit(section)}>
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
    </div>
  );
}

function MallCampaignsSection({
  campaigns,
  filters,
  form,
  onChange,
  onCampaignStatus,
  onDelete,
  onEdit,
  onFiltersChange,
  onReset,
  onSearch,
  onSubmit,
}: {
  campaigns: JsonRecord[];
  filters: MallFilterState;
  form: CampaignForm;
  onChange: (patch: Partial<CampaignForm>) => void;
  onCampaignStatus: (id: string, status: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onEdit: (campaign: JsonRecord) => void;
  onFiltersChange: (patch: Partial<MallFilterState>) => void;
  onReset: () => void;
  onSearch: () => Promise<void>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const openCreate = () => {
    onReset();
    setModalOpen(true);
  };
  const openEdit = (campaign: JsonRecord) => {
    onEdit(campaign);
    setModalOpen(true);
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    await onSubmit(event);
    setModalOpen(false);
  };

  return (
    <div className="page-grid">
      <div className="admin-filterbar marketing-filterbar">
        <input value={filters.keyword} onChange={event => onFiltersChange({ keyword: event.target.value })} placeholder="搜索活动名称或类型" />
        <select value={filters.categoryCode} onChange={event => onFiltersChange({ categoryCode: event.target.value })}>
          <option value="">全部类型</option>
          <option value="discount">满减活动</option>
          <option value="coupon">券包活动</option>
          <option value="bundle">组合购</option>
          <option value="subsidy">配送补贴</option>
          <option value="free_delivery">免配送费</option>
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

      <Panel title="营销活动" description="展示活动列表，支持搜索、创建、编辑、启停和删除；配送补贴可作为活动类型维护">
        <div className="list-stack">
          {campaigns.map(campaign => {
            const id = stringValue(campaign, 'id');
            const status = stringValue(campaign, 'status');
            return (
              <article className="list-row" key={id}>
                <div>
                  <strong>{stringValue(campaign, 'name')}</strong>
                  <small>{campaignTypeLabel(stringValue(campaign, 'campaignType'))} · 预算 {yuan(numberValue(campaign, 'budgetCents'))} · 已消耗 {yuan(numberValue(campaign, 'spentCents'))}</small>
                </div>
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
          {!campaigns.length ? <EmptyState text="暂无活动数据" /> : null}
        </div>
      </Panel>

      {modalOpen ? (
        <div className="modal-backdrop">
          <form className="modal-panel" onSubmit={submit}>
            <div className="modal-title-row">
              <div>
                <h2>{form.id ? '编辑营销活动' : '新建营销活动'}</h2>
                <p>创建满减、券包、组合购、配送补贴或免配送费活动。</p>
              </div>
              <button className="ghost-button" type="button" onClick={() => setModalOpen(false)}>
                <Icon name="x" />
                关闭
              </button>
            </div>
            <div className="form-grid">
              <label>
                活动名称
                <input value={form.name} onChange={event => onChange({ name: event.target.value })} />
              </label>
              <label>
                类型
                <select value={form.campaignType} onChange={event => onChange({ campaignType: event.target.value })}>
                  <option value="discount">满减活动</option>
                  <option value="coupon">券包活动</option>
                  <option value="bundle">组合购</option>
                  <option value="subsidy">配送补贴</option>
                  <option value="free_delivery">免配送费</option>
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
              <label className="wide">
                活动规则
                <textarea value={form.rules} onChange={event => onChange({ rules: event.target.value })} />
              </label>
            </div>
            <div className="modal-actions">
              <button className="ghost-button" type="button" onClick={() => setModalOpen(false)}>取消</button>
              <button className="primary-button" type="submit">
                <Icon name="save" />
                {form.id ? '保存活动' : '创建活动'}
              </button>
            </div>
          </form>
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
  return (
    <div className="permission-admin">
      <div className="permission-admin-grid">
        <Panel title={form.id ? '编辑权限' : '新增权限'} description="维护商城运营角色可访问的模块和动作">
          <form className="permission-editor" onSubmit={onSubmit}>
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

            <div className="permission-form-actions wide">
              <button className="primary-button" disabled={!form.name.trim() || !form.roleKey.trim() || !form.modules.length || !form.actions.length} type="submit">
                <Icon name="save" />
                {form.id ? '保存权限' : '创建权限'}
              </button>
              <button className="ghost-button" type="button" onClick={onReset}>
                <Icon name="x" />
                重置
              </button>
            </div>
          </form>
        </Panel>

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
                    <button className="ghost-button" type="button" onClick={() => onEdit(permission)}>
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
      </div>
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
      <Panel title="活动启停快捷操作" description="运营设置只保留高频启停入口，活动创建、规则编辑和预算维护仍在营销活动页完成">
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
  onSettingsChange,
  onSettingsSubmit,
}: {
  settingsForm: SettingsForm;
  onSettingsChange: (patch: Partial<SettingsForm>) => void;
  onSettingsSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  return (
    <div className="page-grid">
      <Panel title="配送规则" description="维护用户结算、自提窗口、配送批次、冷链和退款审核规则">
        <form className="form-grid settings-form" onSubmit={onSettingsSubmit}>
          <label>
            自提开始时间
            <input value={settingsForm.pickupWindowStart} type="time" onChange={event => onSettingsChange({ pickupWindowStart: event.target.value })} />
          </label>
          <label>
            自提结束时间
            <input value={settingsForm.pickupWindowEnd} type="time" onChange={event => onSettingsChange({ pickupWindowEnd: event.target.value })} />
          </label>
          <label>
            配送批次
            <input value={settingsForm.deliveryBatchTimes} placeholder="10:00,14:00,18:00" onChange={event => onSettingsChange({ deliveryBatchTimes: event.target.value })} />
          </label>
          <label>
            免配送费门槛
            <input value={settingsForm.freeDeliveryThresholdYuan} type="number" min="0" step="0.01" onChange={event => onSettingsChange({ freeDeliveryThresholdYuan: event.target.value })} />
          </label>
          <label>
            默认配送费
            <input value={settingsForm.defaultDeliveryFeeYuan} type="number" min="0" step="0.01" onChange={event => onSettingsChange({ defaultDeliveryFeeYuan: event.target.value })} />
          </label>
          <label>
            承诺分钟
            <input value={settingsForm.deliveryPromiseMinutes} type="number" min="1" onChange={event => onSettingsChange({ deliveryPromiseMinutes: event.target.value })} />
          </label>
          <label>
            退款审核分钟
            <input value={settingsForm.refundReviewMinutes} type="number" min="1" onChange={event => onSettingsChange({ refundReviewMinutes: event.target.value })} />
          </label>
          <label className="toggle-line">
            <input checked={settingsForm.coldChainEnabled} type="checkbox" onChange={event => onSettingsChange({ coldChainEnabled: event.target.checked })} />
            启用冷链配送
          </label>
          <button className="primary-button" type="submit">
            <Icon name="save" />
            保存配送规则
          </button>
        </form>
      </Panel>
    </div>
  );
}

function MallPaymentSplitRulesSection({
  settingsForm,
  onSettingsChange,
  onSettingsSubmit,
}: {
  settingsForm: SettingsForm;
  onSettingsChange: (patch: Partial<SettingsForm>) => void;
  onSettingsSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  return (
    <div className="page-grid">
      <Panel title="分账规则" description="维护商城订单的团长佣金、平台服务费、供应商结算周期和提现门槛">
        <form className="form-grid settings-form split-settings-form" onSubmit={onSettingsSubmit}>
          <label>
            团长佣金比例
            <input value={settingsForm.leaderCommissionRate} type="number" min="0" max="100" step="0.1" onChange={event => onSettingsChange({ leaderCommissionRate: event.target.value })} />
          </label>
          <label>
            平台服务费比例
            <input value={settingsForm.platformServiceRate} type="number" min="0" max="100" step="0.1" onChange={event => onSettingsChange({ platformServiceRate: event.target.value })} />
          </label>
          <label>
            供应商结算周期
            <select value={settingsForm.supplierSettlementCycle} onChange={event => onSettingsChange({ supplierSettlementCycle: event.target.value })}>
              <option value="T+1">T+1</option>
              <option value="T+3">T+3</option>
              <option value="T+7">T+7</option>
              <option value="monthly">月结</option>
            </select>
          </label>
          <label>
            最低提现金额
            <input value={settingsForm.withdrawMinYuan} type="number" min="0" step="0.01" onChange={event => onSettingsChange({ withdrawMinYuan: event.target.value })} />
          </label>
          <div className="settings-rule-note wide">
            <strong>当前口径</strong>
            <span>团长佣金按自提点订单实付金额计算；平台服务费从商家结算金额中扣减；供应商结算周期用于账单和提现审核提示。</span>
          </div>
          <button className="primary-button" type="submit">
            <Icon name="save" />
            保存分账规则
          </button>
        </form>
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
        <Panel title="服务质量" description="单独展示客服售后指标，避免干扰会话处理">
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

        <Panel title="今日优先处理" description="给客服主管看当前最该处理的事项">
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
      <Panel title="客服会话筛选" description="会话页只处理用户咨询和消息回复；售后、工单、知识库在独立页面处理">
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
            <div className="support-context-note">
              会话页只处理即时沟通。需要退款、补发或跨岗位确认时，进入“售后申请”或“客服工单”页面处理。
            </div>
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
  onUpdateAfterSale: (id: string, status: string, handlingMethod: string, resolution: string) => Promise<void>;
}) {
  return (
    <div className="page-grid support-workbench">
      <Panel title="售后申请筛选" description="处理坏果包赔、少件、退款和补偿申请">
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
              <option value="approved">已通过</option>
              <option value="refunding">退款中</option>
              <option value="refunded">已退款</option>
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

      <Panel title="售后申请列表" description="按订单售后记录处理退款、补偿和驳回">
        <div className="support-after-sales">
          {afterSales.map(item => {
            const id = stringValue(item, 'id');
            const orderId = stringValue(item, 'orderId');
            const status = stringValue(item, 'status');
            const evidenceImages = arrayValue(item, 'evidenceImages');
            return (
              <article className="support-after-sale-row" key={id}>
                <div>
                  <strong>{stringValue(item, 'orderNo', shortId(orderId))}</strong>
                  <span>{stringValue(item, 'reason', '售后申请')} · {stringValue(item, 'productName', '订单商品')}</span>
                  <small>{stringValue(item, 'recipientName', stringValue(item, 'userPhone', '用户'))} · {stringValue(item, 'recipientPhone')} · {formatDate(stringValue(item, 'createdAt'))}</small>
                  <p>{stringValue(item, 'description', '暂无说明')}</p>
                  <small>{yuan(numberValue(item, 'amountCents'))} · {stringValue(item, 'handlingMethod', '极速退款')} · 证据 {evidenceImages.length} 张</small>
                </div>
                <span className={badgeClass(status)}>{statusLabel(status)}</span>
                <div className="support-row-actions">
                  <button className="ghost-button small" type="button" onClick={() => onViewAfterSaleOrder(orderId)}>
                    <Icon name="orders" />
                    查看订单
                  </button>
                  <button className="ghost-button small" type="button" onClick={() => onUpdateAfterSale(id, 'approved', '极速退款', '审核通过，进入退款处理')}>
                    <Icon name="check" />
                    通过
                  </button>
                  <button className="ghost-button small" type="button" onClick={() => onUpdateAfterSale(id, 'refunded', '原路退款', '退款已完成')}>
                    <Icon name="refund" />
                    已退款
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
      <Panel title="客服工单筛选" description="工单用于内部跟进，不是用户直接提交；例如财务退款、配送异常、商品补发">
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
        <Panel title="内部跟进工单" description="客服把需要其他岗位介入的事项放到这里，处理完关闭">
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
        <Panel title="客服知识库" description="只保留知识库维护：FAQ、坏果包赔、退款、配送和团长自提话术">
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
  const [form, setForm] = useState<LoginForm>({ phone: '', password: '' });

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSubmit({
      phone: form.phone.trim(),
      password: form.password,
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
          {error ? <div className="login-error">{error}</div> : null}
          <button className="primary-button login-submit" disabled={loading || !form.phone.trim() || !form.password} type="submit">
            {loading ? '登录中...' : '登录管理端'}
          </button>
        </form>
      </section>
    </main>
  );
}

function App() {
  const [session, setSession] = useState<AdminSession | null>(() => getStoredAdminSession());
  const [activeModuleKey, setActiveModuleKey] = useState<AdminModuleKey>('platform');
  const [activePageKey, setActivePageKey] = useState('platform.overview');
  const [data, setData] = useState<DashboardData>(initialData);
  const [errors, setErrors] = useState<LoadErrors>({});
  const [loading, setLoading] = useState(() => Boolean(getStoredAdminSession()));
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('正在加载管理数据');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [productForm, setProductForm] = useState<ProductForm>(initialProductForm);
  const [campaignForm, setCampaignForm] = useState<CampaignForm>(initialCampaignForm);
  const [couponForm, setCouponForm] = useState<CouponForm>(initialCouponForm);
  const [homeBannerForm, setHomeBannerForm] = useState<HomeBannerForm>(initialHomeBannerForm);
  const [homeSectionForm, setHomeSectionForm] = useState<HomeSectionForm>(initialHomeSectionForm);
  const [settingsForm, setSettingsForm] = useState<SettingsForm>(initialSettingsForm);
  const [permissionForm, setPermissionForm] = useState<MallPermissionForm>(initialPermissionForm);
  const [supportForm, setSupportForm] = useState<SupportForm>(initialSupportForm);
  const [categoryForm, setCategoryForm] = useState<CategoryForm>(initialCategoryForm);
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
    setCampaignForm(initialCampaignForm);
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
    setBusy('');
    setLoading(false);
  };

  const reload = async () => {
    if (!getStoredAdminSession()) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const result = await fetchDashboardData(
      productFilters,
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

  useEffect(() => {
    const handler = (message: string) => {
      resetDashboardState();
      setSession(null);
      setAuthError(message || '登录已过期，请重新登录');
      setNotice('登录已过期，请重新登录');
    };

    adminAuthFailureHandler = handler;

    return () => {
      if (adminAuthFailureHandler === handler) {
        adminAuthFailureHandler = null;
      }
    };
  }, []);

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
    } catch (error) {
      setNotice(`${label}失败：${error instanceof Error ? error.message : '未知错误'}`);
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
        mallListingRequests,
        mallDeliverySheets,
        mallPickupPoints,
        mallFinanceBills,
        mallSettlementRecords,
        mallWithdrawalRequests,
        mallSalesStats,
      ] = await Promise.all([
        apiGet<JsonRecord>('/api/admin/mall/ops/overview', query),
        apiGet<JsonRecord[]>('/api/admin/mall/orders', query),
        apiGet<JsonRecord[]>('/api/admin/mall/listing-requests', query),
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
        mallListingRequests,
        mallDeliverySheets,
        mallPickupPoints,
        mallFinanceBills,
        mallSettlementRecords,
        mallWithdrawalRequests,
        mallSalesStats,
      }));
    });
  };

  const handleLogin = async ({ phone, password }: LoginForm) => {
    setAuthError('');
    setAuthLoading(true);

    try {
      const loginResult = await apiPost<JsonRecord>('/api/auth/login', { phone, password });
      const user = normalizeAdminUser(loginResult);

      if (!user) {
        throw new Error('登录结果缺少 token 或用户信息');
      }

      if (user.role === 'admin') {
        const nextSession = persistAdminSession(user);
        setSession(nextSession);
        setNotice('登录成功，正在加载管理端数据');
        setLoading(true);
        return;
      }

      clearStoredAdminSession();
      resetDashboardState();
      setSession(null);
      setAuthError('当前账号不是管理员，无法登录管理端');
      setNotice('非管理员账号已退出');
    } catch (error) {
      clearStoredAdminSession();
      resetDashboardState();
      setSession(null);
      setAuthError(error instanceof Error ? error.message : '登录失败，请稍后重试');
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
      await apiPost('/api/admin/mall/products', {
        name: productForm.name || '新增鲜选商品',
        sku: productForm.sku || `WEB-${Date.now()}`,
        categoryCode: productForm.categoryCode,
        subtitle: productForm.subtitle,
        description: productForm.description,
        imageUrl: productForm.imageUrl,
        specification: productForm.specification,
        saleMethod: productForm.saleMethod,
        priceCents: moneyFromYuan(productForm.priceYuan),
        supplyPriceCents: moneyFromYuan(productForm.supplyPriceYuan),
        stock: Number(productForm.stock) || 0,
        stockAlertThreshold: Number(productForm.stockAlertThreshold) || 15,
        lengthCm: optionalNumber(productForm.lengthCm),
        widthCm: optionalNumber(productForm.widthCm),
        heightCm: optionalNumber(productForm.heightCm),
        volumeLiters: optionalNumber(productForm.volumeLiters),
        weightKg: optionalNumber(productForm.weightKg),
        status: productForm.status,
        tags,
        deliveryMinutes: Number(productForm.deliveryMinutes) || 18,
        coldChainRequired: productForm.coldChainRequired,
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
      const product = await apiPut<JsonRecord>(`/api/admin/mall/products/${id}`, {
        name: form.name,
        sku: form.sku,
        categoryCode: form.categoryCode,
        subtitle: form.subtitle,
        description: form.description,
        imageUrl: form.imageUrl,
        specification: form.specification,
        saleMethod: form.saleMethod,
        priceCents: moneyFromYuan(form.priceYuan),
        supplyPriceCents: moneyFromYuan(form.supplyPriceYuan),
        stock: Number(form.stock) || 0,
        stockAlertThreshold: Number(form.stockAlertThreshold) || 15,
        lengthCm: optionalNumber(form.lengthCm),
        widthCm: optionalNumber(form.widthCm),
        heightCm: optionalNumber(form.heightCm),
        volumeLiters: optionalNumber(form.volumeLiters),
        weightKg: optionalNumber(form.weightKg),
        status: form.status,
        tags,
        deliveryMinutes: Number(form.deliveryMinutes) || 18,
        coldChainRequired: form.coldChainRequired,
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
      return imageUrl;
    } catch (error) {
      setNotice(`商品图片上传失败：${error instanceof Error ? error.message : '未知错误'}`);
      throw error;
    } finally {
      setBusy('');
    }
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

  const reorderCategory = async (draggedId: string, targetId: string) => {
    await runAction('品类排序更新', async () => {
      const ordered = [...data.mallCategories].sort((left, right) => numberValue(left, 'sortOrder') - numberValue(right, 'sortOrder'));
      const fromIndex = ordered.findIndex(category => stringValue(category, 'id') === draggedId);
      const toIndex = ordered.findIndex(category => stringValue(category, 'id') === targetId);
      if (fromIndex < 0 || toIndex < 0) return;
      const [dragged] = ordered.splice(fromIndex, 1);
      ordered.splice(toIndex, 0, dragged);
      const nextCategories = ordered.map((category, index) => ({
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
      await reload();
    });
  };

  const assignOrdersToTrip = async (tripId: string, orderIds: string[]) => {
    await runAction('追加订单', async () => {
      await apiPost(`/api/admin/trips/${tripId}/assign-orders`, { orderIds });
      await reload();
    });
  };

  const removeOrderFromTrip = async (tripId: string, orderId: string) => {
    await runAction('移除订单', async () => {
      await apiDelete(`/api/admin/trips/${tripId}/remove-order/${orderId}`);
      await reload();
    });
  };

  const startTrip = async (tripId: string) => {
    await runAction('出发行程', async () => {
      await apiPost(`/api/trips/${tripId}/start`);
      await reload();
    });
  };

  const completeTrip = async (tripId: string) => {
    await runAction('完成行程', async () => {
      await apiPost(`/api/trips/${tripId}/complete`);
      await reload();
    });
  };

  const lockTrip = async (tripId: string) => {
    await runAction('锁定行程', async () => {
      await apiPost(`/api/trips/${tripId}/lock`);
      await reload();
    });
  };

  const unlockTrip = async (tripId: string) => {
    await runAction('解锁行程', async () => {
      await apiPost(`/api/trips/${tripId}/unlock`);
      await reload();
    });
  };

  const reorderStops = async (tripId: string, stopIds: string[]) => {
    await runAction('调整站点顺序', async () => {
      await apiPut(`/api/admin/trips/${tripId}/reorder-stops`, { stopIds });
      await reload();
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

  const reviewListingRequest = async (id: string, action: 'approve' | 'reject') => {
    await runAction('上下架申请审核', async () => {
      await apiPost(`/api/admin/mall/listing-requests/${id}/review`, {
        action,
        reviewNote: action === 'approve' ? '平台运营审核通过' : '平台运营审核拒绝',
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

  const saveCampaign = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const isEditing = Boolean(campaignForm.id);
    await runAction(isEditing ? '活动更新' : '活动创建', async () => {
      const payload = {
        name: campaignForm.name,
        campaignType: campaignForm.campaignType,
        budgetCents: moneyFromYuan(campaignForm.budgetYuan),
        rules: JSON.parse(campaignForm.rules || '{}') as JsonRecord,
        status: campaignForm.status,
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

  const updateCampaignStatus = async (id: string, status: string) => {
    await runAction('活动状态更新', async () => {
      await apiPut(`/api/admin/mall/campaigns/${id}`, { status });
      setData(current => ({ ...current, campaigns: updateRecordList(current.campaigns, id, { status }) }));
    });
  };

  const deleteCampaign = async (id: string) => {
    await runAction('活动删除', async () => {
      await apiDelete(`/api/admin/mall/campaigns/${id}`);
      setData(current => ({
        ...current,
        campaigns: current.campaigns.filter(campaign => stringValue(campaign, 'id') !== id),
      }));
      setCampaignForm(current => (current.id === id ? initialCampaignForm : current));
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

  const saveSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await runAction('运营配置保存', async () => {
      const freeDeliveryThresholdCents = moneyFromYuan(settingsForm.freeDeliveryThresholdYuan);
      const defaultDeliveryFeeCents = moneyFromYuan(settingsForm.defaultDeliveryFeeYuan);
      const refundReviewMinutes = Number(settingsForm.refundReviewMinutes) || 10;
      await apiPut('/api/admin/mall/settings', {
        freeDeliveryThresholdCents,
        defaultDeliveryFeeCents,
        deliveryPromiseMinutes: Number(settingsForm.deliveryPromiseMinutes) || 18,
        refundReviewMinutes,
        coldChainEnabled: settingsForm.coldChainEnabled,
        deliveryRules: {
          pickupWindowStart: settingsForm.pickupWindowStart,
          pickupWindowEnd: settingsForm.pickupWindowEnd,
          deliveryBatchTimes: settingsForm.deliveryBatchTimes,
          deliveryFeeCents: defaultDeliveryFeeCents,
          freeDeliveryThresholdCents,
          coldChainRequired: settingsForm.coldChainEnabled,
          refundReviewMinutes,
        },
        paymentSplitRules: {
          leaderCommissionRate: Number(settingsForm.leaderCommissionRate) || 0,
          platformServiceRate: Number(settingsForm.platformServiceRate) || 0,
          supplierSettlementCycle: settingsForm.supplierSettlementCycle,
          withdrawMinCents: moneyFromYuan(settingsForm.withdrawMinYuan),
        },
        roles: recordValue(data.mallSettings, 'roles'),
        riskThresholds: recordValue(data.mallSettings, 'riskThresholds'),
      });
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
      const messages = await apiGet<JsonRecord[]>(`/api/support/sessions/${id}/messages`);
      setSupportMessages(messages);
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

  const updateAfterSaleStatus = async (id: string, status: string, handlingMethod: string, resolution: string) => {
    await runAction('售后申请处理', async () => {
      const afterSale = await apiPut<JsonRecord>(`/api/admin/mall/after-sales/${id}`, {
        status,
        handlingMethod,
        resolution,
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
  };

  const selectPage = (pageKey: string) => {
    setActivePageKey(pageKey);
    const homeSectionConfig = homeSectionPageConfigs[pageKey];
    if (homeSectionConfig) {
      resetHomeSectionForm(homeSectionConfig.sectionType);
    }
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
          availableVehicles={data.availableVehicles}
          onCreateTrip={createTrip}
          onAssignOrders={assignOrdersToTrip}
          onRemoveOrder={removeOrderFromTrip}
          onLockTrip={lockTrip}
          onUnlockTrip={unlockTrip}
          onStartTrip={startTrip}
          onCompleteTrip={completeTrip}
          onReorderStops={reorderStops}
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
            form={productForm}
            products={data.mallProducts}
            onChange={patch => setProductForm(current => ({ ...current, ...patch }))}
            onSubmit={createProduct}
            onUploadImage={uploadProductImage}
          />
        );
      }
      return (
        <MallProductsSection
          categories={data.mallCategories}
          filters={productFilters}
          products={data.mallProducts}
          onFiltersChange={patch => setProductFilters(current => ({ ...current, ...patch }))}
          onSearch={reload}
          onStatus={updateProductStatus}
          onUpdate={updateProduct}
          onUploadImage={uploadProductImage}
        />
      );
    }
    if (activePageKey === 'mall.categories') {
      return (
        <MallCategoriesSection
          allProducts={data.mallProducts}
          categories={data.mallCategories}
          filters={categoryFilters}
          form={categoryForm}
          inventoryFilters={inventoryFilters}
          inventoryProducts={data.mallInventoryAlerts}
          showInventoryAlerts
          onCreateInventoryAlert={createInventoryAlert}
          onDelete={deleteCategory}
          onEditInventoryAlert={editInventoryAlert}
          onDeleteInventoryAlert={deleteInventoryAlert}
          onFiltersChange={patch => setCategoryFilters(current => ({ ...current, ...patch }))}
          onFormChange={patch => setCategoryForm(current => ({ ...current, ...patch }))}
          onInventoryFiltersChange={patch => setInventoryFilters(current => ({ ...current, ...patch }))}
          onInventorySearch={reload}
          onReorderCategory={reorderCategory}
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
    if (activePageKey === 'mall.listingRequests') {
      return (
        <MallListingRequestsSection
          filters={mallOpsFilters}
          requests={data.mallListingRequests}
          onFiltersChange={patch => setMallOpsFilters(current => ({ ...current, ...patch }))}
          onReview={reviewListingRequest}
          onSearch={searchMallOpsData}
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
          onChange={patch => setCampaignForm(current => ({ ...current, ...patch }))}
          onCampaignStatus={updateCampaignStatus}
          onDelete={deleteCampaign}
          onEdit={editCampaign}
          onFiltersChange={patch => setCampaignFilters(current => ({ ...current, ...patch }))}
          onReset={resetCampaignForm}
          onSearch={reload}
          onSubmit={saveCampaign}
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
          onSettingsChange={patch => setSettingsForm(current => ({ ...current, ...patch }))}
          onSettingsSubmit={saveSettings}
        />
      );
    }
    if (activePageKey === 'mall.paymentSplit') {
      return (
        <MallPaymentSplitRulesSection
          settingsForm={settingsForm}
          onSettingsChange={patch => setSettingsForm(current => ({ ...current, ...patch }))}
          onSettingsSubmit={saveSettings}
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
    return <LoginScreen error={authError} loading={authLoading} onSubmit={handleLogin} />;
  }

  const currentAdmin = session.user;
  const currentAdminRole = roleLabel(currentAdmin.role);
  const currentAdminName = currentAdmin.name || currentAdminRole;
  const currentAdminContact = currentAdmin.phone || shortId(currentAdmin.id);

  return (
    <div className={`admin-shell design-admin module-${currentModule.theme}${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
      <aside className="sidebar design-sidebar">
        <div className="sidebar-top">
          <div className="sidebar-head">
            <div className="brand" title={`${currentModule.brand} ${currentModule.subtitle}`}>
              <div className="brand-mark">{currentModule.brand.slice(0, 1)}</div>
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
          {adminModules.map(module => (
            <button
              aria-label={`${module.moduleLabel}，${module.pages.length} 页`}
              className={module.key === activeModuleKey ? 'module-button active' : 'module-button'}
              key={module.key}
              title={`${module.moduleLabel}，${module.pages.length} 页`}
              type="button"
              onClick={() => selectModule(module.key)}
            >
              <b className="module-button-mark">{module.moduleLabel.slice(0, 1)}</b>
              <span>{module.moduleLabel}</span>
              <small>{module.pages.length} 页</small>
            </button>
          ))}
        </div>

        <nav className="design-nav">
          {moduleGroups(currentModule).map(group => (
            <div className="page-menu-section" key={group}>
              <span className="page-menu-title">{group}</span>
              {currentModule.pages.filter(page => page.group === group).map(page => (
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
          ))}
        </nav>

        <div className="sidebar-bottom">
          <button
            aria-label="退出登录"
            className="sidebar-logout"
            title="退出登录"
            type="button"
            onClick={handleLogout}
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
            <p>{currentPage.description}</p>
          </div>
          <div className="topbar-actions">
            <span className={Object.keys(errors).length ? 'status-dot warning' : 'status-dot'}>{notice}</span>
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
        }}
      />
    </div>
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
