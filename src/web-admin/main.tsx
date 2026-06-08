import { StrictMode, useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
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
  campaigns: JsonRecord[];
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
  priceYuan: string;
  originalPriceYuan: string;
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

interface CampaignForm {
  name: string;
  campaignType: string;
  budgetYuan: string;
  status: string;
  rules: string;
}

interface SettingsForm {
  freeDeliveryThresholdYuan: string;
  defaultDeliveryFeeYuan: string;
  deliveryPromiseMinutes: string;
  refundReviewMinutes: string;
  coldChainEnabled: boolean;
}

interface SupportForm {
  userId: string;
  topic: string;
  message: string;
  ticketTitle: string;
  ticketCategory: string;
  knowledgeTitle: string;
  knowledgeCategory: string;
  knowledgeContent: string;
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
  | 'unlock';

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
      designPage('platform.cos', 'COS资源', '公共服务', '商品图、资质图和上传资源治理', 'shop'),
      designPage('platform.logs', '日志检索', '公共服务', '接口日志、错误日志和审计日志', 'support'),
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
      designPage('mall.products', '商品上架', '商品管理', '商品创建、上下架、库存和图片', 'shop', 'mallProducts'),
      designPage('mall.productList', '商品列表', '商品管理', '在售、售罄和下架商品管理', 'shop', 'mallProducts'),
      designPage('mall.images', '商品素材', '商品管理', 'COS 图片、主图和详情图审核', 'shop'),
      designPage('mall.categories', '品类管理', '品类管理', '社区团购类目、排序和状态', 'dashboard'),
      designPage('mall.inventory', '库存预警', '品类管理', '低库存、缺货替换和补货提醒', 'support'),
      designPage('mall.orders', '订单管理', '订单管理', '商城订单、履约和退款售后', 'orders', 'mallOrders'),
      designPage('mall.orderDetail', '订单详情', '订单管理', '订单明细、支付、自提和客服记录', 'orders'),
      designPage('mall.fulfillment', '自提核销', '订单管理', '提货码生成、团长核销和异常处理', 'check'),
      designPage('mall.refunds', '退款售后', '订单管理', '售后申请、坏果包赔和退款处理', 'refund', 'mallOrders'),
      designPage('mall.pickup', '自提点管理', '订单管理', '自提点、团长和营业时间管理', 'route'),
      designPage('mall.leaders', '团长管理', '订单管理', '团长中心、核销权限和服务质量', 'users'),
      designPage('mall.community', '邻里圈', '营销中心', '自提点动态、拼团和用户互动', 'megaphone'),
      designPage('mall.campaigns', '营销活动', '营销中心', '满减、券、拼团和预算管理', 'megaphone', 'operations'),
      designPage('mall.coupons', '优惠券', '营销中心', '优惠券发放、核销和成本控制', 'megaphone'),
      designPage('mall.banners', '首页配置', '营销中心', '首页卡片、Banner 和推荐商品', 'dashboard'),
      designPage('mall.support', '客服售后', '客服售后', '会话、工单、知识库和响应指标', 'support', 'support'),
      designPage('mall.afterSales', '售后申请', '客服售后', '售后单审核、证据图片和退款流转', 'refund', 'mallOrders'),
      designPage('mall.knowledge', '客服知识库', '客服售后', '商城 FAQ、坏果包赔和履约话术', 'support', 'support'),
      designPage('mall.settings', '运营设置', '运营设置', '配送费、售后时效和冷链规则', 'save', 'operations'),
      designPage('mall.deliveryRules', '配送规则', '运营设置', '自提窗口、冷链承诺和服务费', 'route'),
      designPage('mall.paymentSplit', '分账规则', '运营设置', '商城分账、团长佣金和商户结算', 'refund'),
      designPage('mall.risk', '风险审核', '运营设置', '售后异常、频控和恶意退款拦截', 'x'),
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
  campaigns: [],
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
  priceYuan: '19.90',
  originalPriceYuan: '',
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
  name: '鲜选满减活动',
  campaignType: 'discount',
  budgetYuan: '3000',
  status: 'active',
  rules: '{"thresholdCents":9900,"discountCents":1000}',
};

const initialSettingsForm: SettingsForm = {
  freeDeliveryThresholdYuan: '99',
  defaultDeliveryFeeYuan: '6',
  deliveryPromiseMinutes: '18',
  refundReviewMinutes: '10',
  coldChainEnabled: true,
};

const initialSupportForm: SupportForm = {
  userId: '',
  topic: '订单配送咨询',
  message: '您好，客服已收到您的问题，正在核实订单状态。',
  ticketTitle: '配送时效工单',
  ticketCategory: 'delivery',
  knowledgeTitle: '无人车配送取货说明',
  knowledgeCategory: '配送',
  knowledgeContent: '用户收到开舱码后，可在无人车到达后输入取货码完成取货。',
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

async function loadWithFallback<T>(
  key: string,
  fallback: T,
  errors: LoadErrors,
  loader: () => Promise<T>,
) {
  try {
    return await loader();
  } catch (error) {
    errors[key] = error instanceof Error ? error.message : '加载失败';
    return fallback;
  }
}

async function fetchDashboardData(
  productFilters: MallFilterState = initialProductFilters,
  categoryFilters: MallFilterState = initialCategoryFilters,
  inventoryFilters: MallFilterState = initialInventoryFilters,
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
    campaigns,
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
    loadWithFallback('营销活动', [], errors, () => apiGet<JsonRecord[]>('/api/admin/mall/campaigns')),
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
      campaigns,
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
    priceYuan: (numberValue(product, 'priceCents') / 100).toFixed(2),
    originalPriceYuan: numberValue(product, 'originalPriceCents')
      ? (numberValue(product, 'originalPriceCents') / 100).toFixed(2)
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

function stockLevelLabel(product: JsonRecord) {
  const stock = numberValue(product, 'stock');
  const threshold = numberValue(product, 'stockAlertThreshold', 15);
  if (stock <= 0) return '缺货';
  if (stock <= threshold) return '低库存';
  return '正常';
}

function statusLabel(value: string) {
  const labels: Record<string, string> = {
    active: '启用',
    inactive: '停用',
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
    completed: '已完成',
    cancelled: '已取消',
    open: '处理中',
    closed: '已关闭',
    resolved: '已解决',
    published: '已发布',
    submitted: '已提交',
    commission_pending: '佣金待审',
  };
  return labels[value] || value || '-';
}

function roleLabel(value: string) {
  const labels: Record<string, string> = {
    admin: '管理员',
    merchant: '商家',
    owner: '车主',
    enterprise: '企业',
    user: '用户',
  };
  return labels[value] || value || '-';
}

function badgeClass(status: string) {
  if (['active', 'on_sale', 'paid', 'completed', 'approved', 'published', 'resolved'].includes(status)) {
    return 'badge badge-green';
  }
  if (['pending', 'pending_payment', 'dispatching', 'delivering', 'open', 'submitted', 'commission_pending'].includes(status)) {
    return 'badge badge-blue';
  }
  if (['rejected', 'cancelled', 'off_sale', 'inactive', 'closed'].includes(status)) {
    return 'badge badge-gray';
  }
  return 'badge badge-amber';
}

function updateRecordList(list: JsonRecord[], id: string, patch: JsonRecord) {
  return list.map(item => (stringValue(item, 'id') === id ? { ...item, ...patch } : item));
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
        <path d="M8 11V7a4 4 0 0 1 7.4-1.5" />
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
      <strong>部分接口加载失败</strong>
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
  if (page.key.includes('campaign') || page.key.includes('coupon') || page.key.includes('banner') || page.key.includes('community')) {
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
  const alertCount = products.filter(product => numberValue(product, 'stock') <= numberValue(product, 'stockAlertThreshold', 15)).length;
  const completeCount = products.filter(product => stringValue(product, 'imageKey', stringValue(product, 'imageUrl')) && numberValue(product, 'weightKg') > 0).length;

  return (
    <form className="mall-admin-design-page" onSubmit={onSubmit}>
      <div className="mall-admin-toolbar">
        <label>
          状态
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
          商品搜索
          <input value={form.sku || form.name || '新商品'} readOnly />
        </label>
        <label>
          图片
          <input value={form.imageUrl ? '已上传' : '待上传'} readOnly />
        </label>
        <button className="mall-admin-submit" type="submit">提交上架</button>
      </div>

      <div className="mall-admin-kpis">
        <StatCard label="商品总数" value={String(products.length)} detail="当前筛选商品池" />
        <StatCard label="库存预警" value={String(alertCount)} detail="低于商品级阈值" />
        <StatCard label="规格完整" value={String(completeCount)} detail="含图片与重量字段" />
      </div>

      <section className="mall-admin-form-panel">
        <div className="design-panel-head">
          <div>
            <h2>商品上架信息表单</h2>
            <p>基础信息、价格库存、适用范围和审核状态集中维护</p>
          </div>
          <span>{products.length} 个商品</span>
        </div>
        <ProductFormFields
          categories={categories}
          form={form}
          layout="tiles"
          onChange={onChange}
          onUploadImage={onUploadImage}
        />
      </section>
    </form>
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
        商品名称
        <input value={form.name} onChange={event => onChange({ name: event.target.value })} placeholder="例如 澳洲蓝莓" />
      </label>
      <label className={fieldClass}>
        SKU
        <input value={form.sku} onChange={event => onChange({ sku: event.target.value })} placeholder="不填自动生成" />
      </label>
      <label className={fieldClass}>
        类目
        <select value={form.categoryCode} onChange={event => onChange({ categoryCode: event.target.value })}>
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
        <input value={form.imageUrl} onChange={event => onChange({ imageUrl: event.target.value })} placeholder="上传后自动填入 storage key" />
      </label>
      <label className={fieldClass}>
        售价
        <input value={form.priceYuan} type="number" min="0" step="0.01" onChange={event => onChange({ priceYuan: event.target.value })} />
      </label>
      <label className={fieldClass}>
        原价
        <input value={form.originalPriceYuan} type="number" min="0" step="0.01" onChange={event => onChange({ originalPriceYuan: event.target.value })} />
      </label>
      <label className={fieldClass}>
        库存
        <input value={form.stock} type="number" min="0" onChange={event => onChange({ stock: event.target.value })} />
      </label>
      <label className={fieldClass}>
        预警阈值
        <input value={form.stockAlertThreshold} type="number" min="0" onChange={event => onChange({ stockAlertThreshold: event.target.value })} />
      </label>
      <label className={fieldClass}>
        长 cm
        <input value={form.lengthCm} type="number" min="0" step="0.1" onChange={event => onChange({ lengthCm: event.target.value })} />
      </label>
      <label className={fieldClass}>
        宽 cm
        <input value={form.widthCm} type="number" min="0" step="0.1" onChange={event => onChange({ widthCm: event.target.value })} />
      </label>
      <label className={fieldClass}>
        高 cm
        <input value={form.heightCm} type="number" min="0" step="0.1" onChange={event => onChange({ heightCm: event.target.value })} />
      </label>
      <label className={fieldClass}>
        体积 L
        <input value={form.volumeLiters} type="number" min="0" step="0.01" onChange={event => onChange({ volumeLiters: event.target.value })} />
      </label>
      <label className={fieldClass}>
        重量 kg
        <input value={form.weightKg} type="number" min="0" step="0.001" onChange={event => onChange({ weightKg: event.target.value })} />
      </label>
      <label className={fieldClass}>
        配送分钟
        <input value={form.deliveryMinutes} type="number" min="1" onChange={event => onChange({ deliveryMinutes: event.target.value })} />
      </label>
      <label className={fieldClass}>
        状态
        <select value={form.status} onChange={event => onChange({ status: event.target.value })}>
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
        商品说明
        <textarea value={form.description} onChange={event => onChange({ description: event.target.value })} placeholder="包装、装载注意事项、保存方式等" />
      </label>
      <label className={layout === 'tiles' ? 'mall-admin-tile toggle-line' : 'toggle-line'}>
        <input checked={form.coldChainRequired} type="checkbox" onChange={event => onChange({ coldChainRequired: event.target.checked })} />
        需要冷链
      </label>
    </div>
  );
}

function ProductImage({ record }: { record: JsonRecord }) {
  const imageUrl = resolveImage(stringValue(record, 'imageUrl'));
  return (
    <div className="product-cell">
      {imageUrl ? <img alt="" src={imageUrl} /> : <span className="image-placeholder">无图</span>}
      <div>
        <strong>{stringValue(record, 'name', '未命名商品')}</strong>
        <small>{stringValue(record, 'subtitle', stringValue(record, 'sku'))}</small>
      </div>
    </div>
  );
}

function OverviewSection({ data }: { data: DashboardData }) {
  const userCount = metricValue(data.adminStats, ['userCount', 'users', 'totalUsers']);
  const vehicleCount = metricValue(data.adminStats, ['vehicleCount', 'vehicles', 'totalVehicles']);
  const orderCount = metricValue(data.adminStats, ['orderCount', 'orders', 'totalOrders']);
  const todayRevenue = yuan(numberValue(data.mallOverview, 'todayRevenueCents'));
  const onSaleProducts = metricValue(data.mallOverview, ['onSaleProducts']);
  const pendingOrders = metricValue(data.mallOverview, ['pendingOrders']);
  const afterSales = metricValue(data.mallOverview, ['afterSales']);
  const supportOpen = metricValue(data.supportMetrics, ['openSessions']);
  const satisfaction = metricValue(data.supportMetrics, ['satisfaction']);

  return (
    <div className="page-grid">
      <div className="stat-grid">
        <StatCard label="平台用户" value={userCount} detail="账号角色、商户、车主统一管理" />
        <StatCard label="车辆资产" value={vehicleCount} detail="车辆审核、状态和运营范围" />
        <StatCard label="运力订单" value={orderCount} detail="普通运力订单与佣金审核" />
        <StatCard label="今日商城收入" value={todayRevenue} detail="已支付商城订单金额" />
        <StatCard label="在售商品" value={onSaleProducts} detail={`${numberValue(data.mallOverview, 'stockAlerts')} 个库存预警`} />
        <StatCard label="待处理商城单" value={pendingOrders} detail={`${afterSales} 个售后/退款事项`} />
        <StatCard label="客服会话" value={supportOpen} detail={`满意度 ${satisfaction}%`} />
        <StatCard label="活动投放" value={metricValue(data.mallOverview, ['campaigns'])} detail="商城活动与配送规则" />
      </div>

      <Panel title="设计稿 19-23 功能覆盖" description="Web 管理端、Web 运营端、客服工作台均由同一个桌面平台承载">
        <div className="coverage-grid">
          <div>
            <strong>Web 管理端</strong>
            <span>账号角色、车辆审核、订单查看、佣金确认、基础配置</span>
          </div>
          <div>
            <strong>Web 运营端</strong>
            <span>商城商品、订单调度、退款售后、营销活动、配送设置</span>
          </div>
          <div>
            <strong>客服模块</strong>
            <span>客服会话、消息回复、工单处理、知识库发布</span>
          </div>
        </div>
      </Panel>
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
  form,
  filters,
  onChange,
  onFiltersChange,
  onSearch,
  onSubmit,
  onStatus,
  onUpdate,
  onUploadImage,
}: {
  categories: JsonRecord[];
  products: JsonRecord[];
  form: ProductForm;
  filters: MallFilterState;
  onChange: (patch: Partial<ProductForm>) => void;
  onFiltersChange: (patch: Partial<MallFilterState>) => void;
  onSearch: () => Promise<void>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
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

      <div className="split-grid">
      <Panel title="新增商品" description="商品创建会调用后台商城商品接口，用户端可直接看到在售商品">
        <form className="form-grid" onSubmit={onSubmit}>
          <ProductFormFields categories={categories} form={form} onChange={onChange} onUploadImage={onUploadImage} />
          <button className="primary-button wide" type="submit">
            <Icon name="plus" />
            创建商品
          </button>
        </form>
      </Panel>

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
                      <small>{numberValue(product, 'originalPriceCents') ? yuan(numberValue(product, 'originalPriceCents')) : '无原价'}</small>
                    </td>
                    <td>{numberValue(product, 'stock')}</td>
                    <td>
                      <span>{numberValue(product, 'lengthCm')}×{numberValue(product, 'widthCm')}×{numberValue(product, 'heightCm')} cm</span>
                      <small>{numberValue(product, 'volumeLiters')}L · {numberValue(product, 'weightKg')}kg · 阈值 {numberValue(product, 'stockAlertThreshold', 15)}</small>
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
      </div>

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
            <p>维护商品图片、价格库存和无人车装载规格</p>
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
  categories,
  filters,
  form,
  onFormChange,
  onFiltersChange,
  onSearch,
  onSave,
  onDelete,
}: {
  categories: JsonRecord[];
  filters: MallFilterState;
  form: CategoryForm;
  onFormChange: (patch: Partial<CategoryForm>) => void;
  onFiltersChange: (patch: Partial<MallFilterState>) => void;
  onSearch: () => Promise<void>;
  onSave: (form: CategoryForm) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const openCreate = () => {
    onFormChange(initialCategoryForm);
    setModalOpen(true);
  };
  const openEdit = (category: JsonRecord) => {
    onFormChange(categoryToForm(category));
    setModalOpen(true);
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
      <Panel title="品类管理" description="维护社区团购商品品类、排序和上下架状态">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
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
                  <tr key={id}>
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
  categories,
  products,
  filters,
  onFiltersChange,
  onSearch,
  onUpdateInventory,
}: {
  categories: JsonRecord[];
  products: JsonRecord[];
  filters: MallFilterState;
  onFiltersChange: (patch: Partial<MallFilterState>) => void;
  onSearch: () => Promise<void>;
  onUpdateInventory: (id: string, stock: number, stockAlertThreshold: number) => Promise<void>;
}) {
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
      </div>
      <Panel title="库存预警" description="按商品级阈值检查库存，运营可直接补库存或调整预警阈值">
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
                <th>处理</th>
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
                    <td>
                      <input defaultValue={stock} type="number" min="0" id={`stock-${id}`} />
                    </td>
                    <td>
                      <input defaultValue={threshold} type="number" min="0" id={`threshold-${id}`} />
                    </td>
                    <td>
                      <span>{numberValue(product, 'lengthCm')}×{numberValue(product, 'widthCm')}×{numberValue(product, 'heightCm')} cm</span>
                      <small>{numberValue(product, 'volumeLiters')}L · {numberValue(product, 'weightKg')}kg</small>
                    </td>
                    <td>
                      <button
                        className="primary-button small"
                        type="button"
                        onClick={() => {
                          const stockInput = document.getElementById(`stock-${id}`) as HTMLInputElement | null;
                          const thresholdInput = document.getElementById(`threshold-${id}`) as HTMLInputElement | null;
                          void onUpdateInventory(id, Number(stockInput?.value || 0), Number(thresholdInput?.value || 0));
                        }}
                      >
                        <Icon name="save" />
                        保存
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
    </div>
  );
}

function MallOrdersSection({
  orders,
  onDispatch,
  onStatus,
  onRefund,
}: {
  orders: JsonRecord[];
  onDispatch: (id: string) => Promise<void>;
  onStatus: (id: string, status: string) => Promise<void>;
  onRefund: (id: string, amountCents: number) => Promise<void>;
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

function OperationsSection({
  campaigns,
  campaignForm,
  settingsForm,
  onCampaignChange,
  onSettingsChange,
  onCampaignSubmit,
  onCampaignStatus,
  onSettingsSubmit,
}: {
  campaigns: JsonRecord[];
  campaignForm: CampaignForm;
  settingsForm: SettingsForm;
  onCampaignChange: (patch: Partial<CampaignForm>) => void;
  onSettingsChange: (patch: Partial<SettingsForm>) => void;
  onCampaignSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onCampaignStatus: (id: string, status: string) => Promise<void>;
  onSettingsSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  return (
    <div className="split-grid">
      <Panel title="营销活动" description="创建满减、补贴、券包等商城运营活动">
        <form className="form-grid" onSubmit={onCampaignSubmit}>
          <label>
            活动名称
            <input value={campaignForm.name} onChange={event => onCampaignChange({ name: event.target.value })} />
          </label>
          <label>
            类型
            <select value={campaignForm.campaignType} onChange={event => onCampaignChange({ campaignType: event.target.value })}>
              <option value="discount">满减</option>
              <option value="coupon">优惠券</option>
              <option value="bundle">组合购</option>
              <option value="subsidy">配送补贴</option>
            </select>
          </label>
          <label>
            预算
            <input value={campaignForm.budgetYuan} type="number" min="0" step="0.01" onChange={event => onCampaignChange({ budgetYuan: event.target.value })} />
          </label>
          <label>
            状态
            <select value={campaignForm.status} onChange={event => onCampaignChange({ status: event.target.value })}>
              <option value="active">启用</option>
              <option value="draft">草稿</option>
              <option value="inactive">停用</option>
            </select>
          </label>
          <label className="wide">
            规则 JSON
            <textarea value={campaignForm.rules} onChange={event => onCampaignChange({ rules: event.target.value })} />
          </label>
          <button className="primary-button wide" type="submit">
            <Icon name="plus" />
            创建活动
          </button>
        </form>
      </Panel>

      <Panel title="活动列表" description="运营端活动启停与消耗查看">
        <div className="list-stack">
          {campaigns.map(campaign => {
            const id = stringValue(campaign, 'id');
            const status = stringValue(campaign, 'status');
            return (
              <article className="list-row" key={id}>
                <div>
                  <strong>{stringValue(campaign, 'name')}</strong>
                  <small>{stringValue(campaign, 'campaignType')} · 已消耗 {yuan(numberValue(campaign, 'spentCents'))}</small>
                </div>
                <span className={badgeClass(status)}>{statusLabel(status)}</span>
                <button className="ghost-button" type="button" onClick={() => onCampaignStatus(id, status === 'active' ? 'inactive' : 'active')}>
                  <Icon name={status === 'active' ? 'x' : 'check'} />
                  {status === 'active' ? '停用' : '启用'}
                </button>
              </article>
            );
          })}
          {!campaigns.length ? <EmptyState text="暂无活动数据" /> : null}
        </div>
      </Panel>

      <Panel title="商城与配送配置" description="保存免配送费门槛、配送费、承诺时效、冷链与退款审核规则">
        <form className="form-grid settings-form" onSubmit={onSettingsSubmit}>
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
            保存配置
          </button>
        </form>
      </Panel>
    </div>
  );
}

function SupportSection({
  metrics,
  sessions,
  tickets,
  knowledge,
  form,
  selectedSessionId,
  messages,
  onFormChange,
  onSelectSession,
  onCreateSession,
  onSendMessage,
  onResolveTicket,
  onCreateTicket,
  onCreateKnowledge,
}: {
  metrics: JsonRecord;
  sessions: JsonRecord[];
  tickets: JsonRecord[];
  knowledge: JsonRecord[];
  form: SupportForm;
  selectedSessionId: string;
  messages: JsonRecord[];
  onFormChange: (patch: Partial<SupportForm>) => void;
  onSelectSession: (id: string) => Promise<void>;
  onCreateSession: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onSendMessage: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onResolveTicket: (id: string) => Promise<void>;
  onCreateTicket: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onCreateKnowledge: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  return (
    <div className="page-grid">
      <div className="stat-grid compact">
        <StatCard label="打开会话" value={metricValue(metrics, ['openSessions'])} detail="小程序与 Web 统一客服入口" />
        <StatCard label="打开工单" value={metricValue(metrics, ['openTickets'])} detail="售后、配送、支付问题" />
        <StatCard label="知识库" value={metricValue(metrics, ['knowledgeArticles'])} detail="已发布帮助文章" />
        <StatCard label="首响分钟" value={metricValue(metrics, ['avgFirstResponseMinutes'])} detail="客服响应 SLA" />
      </div>

      <div className="support-layout">
        <Panel title="会话队列" description="选择会话后可发送客服消息">
          <form className="inline-form" onSubmit={onCreateSession}>
            <input value={form.userId} onChange={event => onFormChange({ userId: event.target.value })} placeholder="用户 ID" />
            <input value={form.topic} onChange={event => onFormChange({ topic: event.target.value })} placeholder="会话主题" />
            <button className="primary-button small" type="submit">
              <Icon name="plus" />
              新建
            </button>
          </form>
          <div className="list-stack">
            {sessions.map(session => {
              const id = stringValue(session, 'id');
              return (
                <button className={`session-row ${selectedSessionId === id ? 'selected' : ''}`} key={id} type="button" onClick={() => onSelectSession(id)}>
                  <strong>{stringValue(session, 'topic')}</strong>
                  <span>{stringValue(session, 'lastMessage', '暂无消息')}</span>
                  <small>{formatDate(stringValue(session, 'updatedAt'))}</small>
                </button>
              );
            })}
            {!sessions.length ? <EmptyState text="暂无客服会话" /> : null}
          </div>
        </Panel>

        <Panel title="客服消息" description="向当前会话写入客服回复">
          <div className="message-list">
            {messages.map(message => (
              <article className={`message ${stringValue(message, 'senderRole') === 'agent' ? 'agent' : ''}`} key={stringValue(message, 'id')}>
                <span>{roleLabel(stringValue(message, 'senderRole'))}</span>
                <p>{stringValue(message, 'content')}</p>
              </article>
            ))}
            {!messages.length ? <EmptyState text="选择会话后显示消息" /> : null}
          </div>
          <form className="send-form" onSubmit={onSendMessage}>
            <textarea value={form.message} onChange={event => onFormChange({ message: event.target.value })} />
            <button className="primary-button" type="submit" disabled={!selectedSessionId}>
              <Icon name="send" />
              发送
            </button>
          </form>
        </Panel>
      </div>

      <div className="split-grid">
        <Panel title="客服工单" description="创建并处理配送、售后和支付类工单">
          <form className="inline-form" onSubmit={onCreateTicket}>
            <input value={form.ticketTitle} onChange={event => onFormChange({ ticketTitle: event.target.value })} placeholder="工单标题" />
            <input value={form.ticketCategory} onChange={event => onFormChange({ ticketCategory: event.target.value })} placeholder="分类" />
            <button className="primary-button small" type="submit">
              <Icon name="plus" />
              新建
            </button>
          </form>
          <div className="list-stack">
            {tickets.map(ticket => {
              const id = stringValue(ticket, 'id');
              const status = stringValue(ticket, 'status');
              return (
                <article className="list-row" key={id}>
                  <div>
                    <strong>{stringValue(ticket, 'title')}</strong>
                    <small>{stringValue(ticket, 'category')} · {stringValue(ticket, 'priority')}</small>
                  </div>
                  <span className={badgeClass(status)}>{statusLabel(status)}</span>
                  <button className="ghost-button" type="button" onClick={() => onResolveTicket(id)}>
                    <Icon name="check" />
                    解决
                  </button>
                </article>
              );
            })}
            {!tickets.length ? <EmptyState text="暂无工单" /> : null}
          </div>
        </Panel>

        <Panel title="知识库" description="发布客服常见问题和操作说明">
          <form className="form-grid" onSubmit={onCreateKnowledge}>
            <label>
              标题
              <input value={form.knowledgeTitle} onChange={event => onFormChange({ knowledgeTitle: event.target.value })} />
            </label>
            <label>
              分类
              <input value={form.knowledgeCategory} onChange={event => onFormChange({ knowledgeCategory: event.target.value })} />
            </label>
            <label className="wide">
              内容
              <textarea value={form.knowledgeContent} onChange={event => onFormChange({ knowledgeContent: event.target.value })} />
            </label>
            <button className="primary-button wide" type="submit">
              <Icon name="save" />
              发布知识
            </button>
          </form>
          <div className="knowledge-list">
            {knowledge.slice(0, 6).map(article => (
              <article key={stringValue(article, 'id')}>
                <strong>{stringValue(article, 'title')}</strong>
                <small>{stringValue(article, 'category')} · {statusLabel(stringValue(article, 'status'))}</small>
              </article>
            ))}
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
  const [notice, setNotice] = useState('正在连接后端管理接口');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [productForm, setProductForm] = useState<ProductForm>(initialProductForm);
  const [campaignForm, setCampaignForm] = useState<CampaignForm>(initialCampaignForm);
  const [settingsForm, setSettingsForm] = useState<SettingsForm>(initialSettingsForm);
  const [supportForm, setSupportForm] = useState<SupportForm>(initialSupportForm);
  const [categoryForm, setCategoryForm] = useState<CategoryForm>(initialCategoryForm);
  const [productFilters, setProductFilters] = useState<MallFilterState>(initialProductFilters);
  const [categoryFilters, setCategoryFilters] = useState<MallFilterState>(initialCategoryFilters);
  const [inventoryFilters, setInventoryFilters] = useState<MallFilterState>(initialInventoryFilters);
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [supportMessages, setSupportMessages] = useState<JsonRecord[]>([]);

  const currentModule = useMemo(
    () => adminModules.find(module => module.key === activeModuleKey) || adminModules[0],
    [activeModuleKey],
  );
  const currentPage = useMemo(
    () => currentModule.pages.find(page => page.key === activePageKey) || currentModule.pages[0],
    [activePageKey, currentModule],
  );

  const resetDashboardState = () => {
    setData(initialData);
    setErrors({});
    setSupportMessages([]);
    setSelectedSessionId('');
    setBusy('');
    setLoading(false);
  };

  const reload = async () => {
    if (!getStoredAdminSession()) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const result = await fetchDashboardData(productFilters, categoryFilters, inventoryFilters);

    if (!getStoredAdminSession()) {
      setLoading(false);
      return;
    }

    setData(result.data);
    setErrors(result.errors);
    setLoading(false);
    setNotice(Object.keys(result.errors).length ? '部分接口暂不可用，已显示可用数据' : '后端接口连接正常');
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
    setSettingsForm({
      freeDeliveryThresholdYuan: String((numberValue(data.mallSettings, 'freeDeliveryThresholdCents') / 100).toFixed(2)),
      defaultDeliveryFeeYuan: String((numberValue(data.mallSettings, 'defaultDeliveryFeeCents') / 100).toFixed(2)),
      deliveryPromiseMinutes: String(numberValue(data.mallSettings, 'deliveryPromiseMinutes', 18)),
      refundReviewMinutes: String(numberValue(data.mallSettings, 'refundReviewMinutes', 10)),
      coldChainEnabled: boolValue(data.mallSettings, 'coldChainEnabled', true),
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
      setAuthError('当前账号不是管理员，无法登录 Web 管理端');
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
        priceCents: moneyFromYuan(productForm.priceYuan),
        originalPriceCents: productForm.originalPriceYuan ? moneyFromYuan(productForm.originalPriceYuan) : undefined,
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
        priceCents: moneyFromYuan(form.priceYuan),
        originalPriceCents: form.originalPriceYuan ? moneyFromYuan(form.originalPriceYuan) : undefined,
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

  const updateInventory = async (id: string, stock: number, stockAlertThreshold: number) => {
    await runAction('库存预警处理', async () => {
      await apiPut(`/api/admin/mall/products/${id}`, { stock, stockAlertThreshold });
      await reload();
    });
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

  const createCampaign = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await runAction('活动创建', async () => {
      await apiPost('/api/admin/mall/campaigns', {
        name: campaignForm.name,
        campaignType: campaignForm.campaignType,
        budgetCents: moneyFromYuan(campaignForm.budgetYuan),
        rules: JSON.parse(campaignForm.rules || '{}') as JsonRecord,
        status: campaignForm.status,
      });
      await reload();
    });
  };

  const updateCampaignStatus = async (id: string, status: string) => {
    await runAction('活动状态更新', async () => {
      await apiPut(`/api/admin/mall/campaigns/${id}`, { status });
      setData(current => ({ ...current, campaigns: updateRecordList(current.campaigns, id, { status }) }));
    });
  };

  const saveSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await runAction('运营配置保存', async () => {
      await apiPut('/api/admin/mall/settings', {
        freeDeliveryThresholdCents: moneyFromYuan(settingsForm.freeDeliveryThresholdYuan),
        defaultDeliveryFeeCents: moneyFromYuan(settingsForm.defaultDeliveryFeeYuan),
        deliveryPromiseMinutes: Number(settingsForm.deliveryPromiseMinutes) || 18,
        refundReviewMinutes: Number(settingsForm.refundReviewMinutes) || 10,
        coldChainEnabled: settingsForm.coldChainEnabled,
        roles: {},
        riskThresholds: {},
      });
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
        category: supportForm.ticketCategory,
        priority: 'normal',
        title: supportForm.ticketTitle,
        description: '由 Web 管理端创建',
      });
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

  const selectModule = (moduleKey: AdminModuleKey) => {
    const nextModule = adminModules.find(module => module.key === moduleKey) || adminModules[0];
    setActiveModuleKey(nextModule.key);
    setActivePageKey(nextModule.pages[0].key);
  };

  const renderActivePage = () => {
    if (activePageKey === 'platform.overview') {
      return <OverviewSection data={data} />;
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
          form={productForm}
          products={data.mallProducts}
          onChange={patch => setProductForm(current => ({ ...current, ...patch }))}
          onFiltersChange={patch => setProductFilters(current => ({ ...current, ...patch }))}
          onSearch={reload}
          onStatus={updateProductStatus}
          onSubmit={createProduct}
          onUpdate={updateProduct}
          onUploadImage={uploadProductImage}
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
          onSave={saveCategory}
          onSearch={reload}
        />
      );
    }
    if (activePageKey === 'mall.inventory') {
      return (
        <MallInventorySection
          categories={data.mallCategories}
          filters={inventoryFilters}
          products={data.mallInventoryAlerts}
          onFiltersChange={patch => setInventoryFilters(current => ({ ...current, ...patch }))}
          onSearch={reload}
          onUpdateInventory={updateInventory}
        />
      );
    }
    if (activePageKey === 'mall.orders' || activePageKey === 'mall.refunds' || activePageKey === 'mall.afterSales') {
      return (
        <MallOrdersSection
          orders={data.mallOrders}
          onDispatch={dispatchMallOrder}
          onRefund={refundMallOrder}
          onStatus={updateMallOrderStatus}
        />
      );
    }
    if (activePageKey === 'mall.campaigns' || activePageKey === 'mall.settings') {
      return (
        <OperationsSection
          campaignForm={campaignForm}
          campaigns={data.campaigns}
          settingsForm={settingsForm}
          onCampaignChange={patch => setCampaignForm(current => ({ ...current, ...patch }))}
          onCampaignStatus={updateCampaignStatus}
          onCampaignSubmit={createCampaign}
          onSettingsChange={patch => setSettingsForm(current => ({ ...current, ...patch }))}
          onSettingsSubmit={saveSettings}
        />
      );
    }
    if (activePageKey === 'mall.support' || activePageKey === 'mall.knowledge' || activePageKey === 'vehicle.support') {
      return (
        <SupportSection
          form={supportForm}
          knowledge={data.supportKnowledge}
          messages={supportMessages}
          metrics={data.supportMetrics}
          selectedSessionId={selectedSessionId}
          sessions={data.supportSessions}
          tickets={data.supportTickets}
          onCreateKnowledge={createKnowledge}
          onCreateSession={createSupportSession}
          onCreateTicket={createSupportTicket}
          onFormChange={patch => setSupportForm(current => ({ ...current, ...patch }))}
          onResolveTicket={resolveTicket}
          onSelectSession={selectSession}
          onSendMessage={sendSupportMessage}
        />
      );
    }
    return <DesignPlaceholderPage data={data} module={currentModule} page={currentPage} />;
  };

  if (!session) {
    return <LoginScreen error={authError} loading={authLoading} onSubmit={handleLogin} />;
  }

  const currentAdmin = session.user;
  const currentAdminName = currentAdmin.name || currentAdmin.phone || shortId(currentAdmin.id);

  return (
    <div className={`admin-shell design-admin module-${currentModule.theme}`}>
      <aside className="sidebar design-sidebar">
        <div className="brand">
          <div className="brand-mark">{currentModule.brand.slice(0, 1)}</div>
          <div>
            <strong>{currentModule.brand}</strong>
            <span>{currentModule.subtitle}</span>
          </div>
        </div>

        <div className="module-switcher">
          {adminModules.map(module => (
            <button
              className={module.key === activeModuleKey ? 'module-button active' : 'module-button'}
              key={module.key}
              type="button"
              onClick={() => selectModule(module.key)}
            >
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
                  type="button"
                  onClick={() => setActivePageKey(page.key)}
                >
                  <Icon name={page.icon} />
                  <span>{page.label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      <main className="workspace design-workspace">
        <header className="topbar design-topbar">
          <div>
            <span className="design-breadcrumb">{currentModule.moduleLabel} / {currentPage.group}</span>
            <h1>{currentPage.label}</h1>
            <p>{currentPage.description}</p>
          </div>
          <div className="topbar-actions">
            <div className="admin-account">
              <span>当前管理员</span>
              <strong>{currentAdminName}</strong>
              <small>{currentAdmin.phone || roleLabel(currentAdmin.role)}</small>
            </div>
            <span className={Object.keys(errors).length ? 'status-dot warning' : 'status-dot'}>{notice}</span>
            <button className="ghost-button" type="button" onClick={reload} disabled={loading || Boolean(busy)}>
              <Icon name="refresh" />
              刷新
            </button>
            <button className="ghost-button danger" type="button" onClick={handleLogout} disabled={Boolean(busy)}>
              <Icon name="x" />
              退出
            </button>
          </div>
        </header>

        <div className="design-main">
          <ErrorStrip errors={errors} />
          {busy ? <div className="busy-line">{busy}中...</div> : null}
          {loading ? <div className="loading-panel">正在加载管理端数据...</div> : null}
          {!loading ? renderActivePage() : null}
        </div>
      </main>
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
