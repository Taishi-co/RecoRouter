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

interface LoadErrors {
  [key: string]: string;
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
  mallOrders: JsonRecord[];
  campaigns: JsonRecord[];
  mallSettings: JsonRecord;
  supportMetrics: JsonRecord;
  supportSessions: JsonRecord[];
  supportTickets: JsonRecord[];
  supportKnowledge: JsonRecord[];
}

interface ProductForm {
  name: string;
  sku: string;
  categoryCode: string;
  subtitle: string;
  imageUrl: string;
  priceYuan: string;
  originalPriceYuan: string;
  stock: string;
  tags: string;
  status: string;
  deliveryMinutes: string;
  coldChainRequired: boolean;
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
  | 'refund';

interface ApiEnvelope<T> {
  code?: number | string;
  message?: string;
  data?: T;
}

const API_BASE =
  typeof __PROJECT_DOMAIN__ === 'string' && __PROJECT_DOMAIN__.trim().length > 0
    ? __PROJECT_DOMAIN__.replace(/\/$/, '')
    : '';

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
  mallOrders: [],
  campaigns: [],
  mallSettings: {},
  supportMetrics: {},
  supportSessions: [],
  supportTickets: [],
  supportKnowledge: [],
};

const initialProductForm: ProductForm = {
  name: '',
  sku: '',
  categoryCode: 'fruit',
  subtitle: '',
  imageUrl: '/assets/mall-products/kiwi.jpeg',
  priceYuan: '19.90',
  originalPriceYuan: '',
  stock: '80',
  tags: '鲜选,冷链',
  status: 'on_sale',
  deliveryMinutes: '18',
  coldChainRequired: false,
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
  const response = await fetch(createApiUrl(pathname, params), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const payload = (await response.json().catch(() => ({}))) as ApiEnvelope<T>;
  const code = typeof payload.code === 'string' ? Number(payload.code) : payload.code;
  if (!response.ok || (typeof code === 'number' && code >= 400)) {
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

async function fetchDashboardData() {
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
    mallOrders,
    campaigns,
    mallSettings,
    supportMetrics,
    supportSessions,
    supportTickets,
    supportKnowledge,
  ] = await Promise.all([
    loadWithFallback('平台统计', {}, errors, () => apiGet<JsonRecord>('/api/admin/statistics')),
    loadWithFallback('账号列表', [], errors, () => apiGet<JsonRecord[]>('/api/admin/users', { limit: 80 })),
    loadWithFallback('车辆列表', [], errors, () => apiGet<JsonRecord[]>('/api/vehicles', { limit: 80 })),
    loadWithFallback('运力订单', [], errors, () => apiGet<JsonRecord[]>('/api/admin/orders', { limit: 80 })),
    loadWithFallback('佣金待审', [], errors, () => apiGet<JsonRecord[]>('/api/orders/commission-pending')),
    loadWithFallback('佣金统计', {}, errors, () => apiGet<JsonRecord>('/api/orders/commission-summary')),
    loadWithFallback('商城概览', {}, errors, () => apiGet<JsonRecord>('/api/admin/mall/overview')),
    loadWithFallback('商城类目', [], errors, () => apiGet<JsonRecord[]>('/api/mall/categories')),
    loadWithFallback('商城商品', [], errors, () => apiGet<JsonRecord[]>('/api/admin/mall/products', { limit: 100 })),
    loadWithFallback('商城订单', [], errors, () => apiGet<JsonRecord[]>('/api/admin/mall/orders')),
    loadWithFallback('营销活动', [], errors, () => apiGet<JsonRecord[]>('/api/admin/mall/campaigns')),
    loadWithFallback('商城设置', {}, errors, () => apiGet<JsonRecord>('/api/admin/mall/settings')),
    loadWithFallback('客服指标', {}, errors, () => apiGet<JsonRecord>('/api/support/metrics')),
    loadWithFallback('客服会话', [], errors, () => apiGet<JsonRecord[]>('/api/support/sessions')),
    loadWithFallback('客服工单', [], errors, () => apiGet<JsonRecord[]>('/api/support/tickets')),
    loadWithFallback('知识库', [], errors, () => apiGet<JsonRecord[]>('/api/support/knowledge')),
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
      mallOrders,
      campaigns,
      mallSettings,
      supportMetrics,
      supportSessions,
      supportTickets,
      supportKnowledge,
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
  return `${API_BASE}${url}`;
}

function tagsText(record: JsonRecord) {
  const tags = arrayValue(record, 'tags')
    .map(item => String(item))
    .filter(Boolean);
  return tags.length ? tags.join(' / ') : '-';
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
  onChange,
  onSubmit,
  onStatus,
}: {
  categories: JsonRecord[];
  products: JsonRecord[];
  form: ProductForm;
  onChange: (patch: Partial<ProductForm>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onStatus: (id: string, status: string) => Promise<void>;
}) {
  return (
    <div className="split-grid">
      <Panel title="新增商品" description="商品创建会调用后台商城商品接口，用户端可直接看到在售商品">
        <form className="form-grid" onSubmit={onSubmit}>
          <label>
            商品名称
            <input value={form.name} onChange={event => onChange({ name: event.target.value })} placeholder="例如 澳洲蓝莓" />
          </label>
          <label>
            SKU
            <input value={form.sku} onChange={event => onChange({ sku: event.target.value })} placeholder="不填自动生成" />
          </label>
          <label>
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
          <label>
            售价
            <input value={form.priceYuan} type="number" min="0" step="0.01" onChange={event => onChange({ priceYuan: event.target.value })} />
          </label>
          <label>
            原价
            <input value={form.originalPriceYuan} type="number" min="0" step="0.01" onChange={event => onChange({ originalPriceYuan: event.target.value })} />
          </label>
          <label>
            库存
            <input value={form.stock} type="number" min="0" onChange={event => onChange({ stock: event.target.value })} />
          </label>
          <label className="wide">
            副标题
            <input value={form.subtitle} onChange={event => onChange({ subtitle: event.target.value })} placeholder="规格、配送卖点" />
          </label>
          <label className="wide">
            图片路径
            <select value={form.imageUrl} onChange={event => onChange({ imageUrl: event.target.value })}>
              <option value="/assets/mall-products/fresh-milk.jpeg">鲜奶图片</option>
              <option value="/assets/mall-products/kiwi.jpeg">猕猴桃图片</option>
              <option value="/assets/mall-products/banana.jpeg">香蕉图片</option>
              <option value="/assets/mall-products/durian.jpeg">榴莲图片</option>
              <option value="/assets/mall-products/reco-dino.jpeg">周边玩偶图片</option>
            </select>
          </label>
          <label>
            标签
            <input value={form.tags} onChange={event => onChange({ tags: event.target.value })} />
          </label>
          <label>
            配送分钟
            <input value={form.deliveryMinutes} type="number" min="1" onChange={event => onChange({ deliveryMinutes: event.target.value })} />
          </label>
          <label className="toggle-line">
            <input checked={form.coldChainRequired} type="checkbox" onChange={event => onChange({ coldChainRequired: event.target.checked })} />
            需要冷链
          </label>
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
                      <span className={badgeClass(status)}>{statusLabel(status)}</span>
                    </td>
                    <td className="actions">
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

function App() {
  const [active, setActive] = useState<NavigationKey>('overview');
  const [data, setData] = useState<DashboardData>(initialData);
  const [errors, setErrors] = useState<LoadErrors>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('正在连接后端管理接口');
  const [productForm, setProductForm] = useState<ProductForm>(initialProductForm);
  const [campaignForm, setCampaignForm] = useState<CampaignForm>(initialCampaignForm);
  const [settingsForm, setSettingsForm] = useState<SettingsForm>(initialSettingsForm);
  const [supportForm, setSupportForm] = useState<SupportForm>(initialSupportForm);
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [supportMessages, setSupportMessages] = useState<JsonRecord[]>([]);

  const currentNav = useMemo(() => navigation.find(item => item.key === active) || navigation[0], [active]);

  const reload = async () => {
    setLoading(true);
    const result = await fetchDashboardData();
    setData(result.data);
    setErrors(result.errors);
    setLoading(false);
    setNotice(Object.keys(result.errors).length ? '部分接口暂不可用，已显示可用数据' : '后端接口连接正常');
  };

  useEffect(() => {
    void reload();
  }, []);

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
        imageUrl: productForm.imageUrl,
        priceCents: moneyFromYuan(productForm.priceYuan),
        originalPriceCents: productForm.originalPriceYuan ? moneyFromYuan(productForm.originalPriceYuan) : undefined,
        stock: Number(productForm.stock) || 0,
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
      const session = await apiPost<JsonRecord>('/api/support/sessions', {
        userId: supportForm.userId || stringValue(data.users[0], 'id'),
        channel: 'web',
        topic: supportForm.topic,
      });
      await reload();
      const id = stringValue(session, 'id');
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

  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">R</div>
          <div>
            <strong>RecoRouter</strong>
            <span>管理平台</span>
          </div>
        </div>
        <nav>
          {navigation.map(item => (
            <button className={active === item.key ? 'nav-item active' : 'nav-item'} key={item.key} type="button" onClick={() => setActive(item.key)}>
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <h1>{currentNav.label}</h1>
            <p>{currentNav.description}</p>
          </div>
          <div className="topbar-actions">
            <span className={Object.keys(errors).length ? 'status-dot warning' : 'status-dot'}>{notice}</span>
            <button className="ghost-button" type="button" onClick={reload} disabled={loading || Boolean(busy)}>
              <Icon name="refresh" />
              刷新
            </button>
          </div>
        </header>

        <ErrorStrip errors={errors} />
        {busy ? <div className="busy-line">{busy}中...</div> : null}
        {loading ? <div className="loading-panel">正在加载管理端数据...</div> : null}

        {!loading && active === 'overview' ? <OverviewSection data={data} /> : null}
        {!loading && active === 'users' ? <UsersSection users={data.users} onUpdateStatus={updateUserStatus} /> : null}
        {!loading && active === 'vehicles' ? <VehiclesSection vehicles={data.vehicles} onReview={reviewVehicle} /> : null}
        {!loading && active === 'transportOrders' ? (
          <TransportOrdersSection
            commissionPending={data.commissionPending}
            commissionSummary={data.commissionSummary}
            orders={data.transportOrders}
            onConfirmCommission={confirmCommission}
          />
        ) : null}
        {!loading && active === 'mallProducts' ? (
          <MallProductsSection
            categories={data.mallCategories}
            form={productForm}
            products={data.mallProducts}
            onChange={patch => setProductForm(current => ({ ...current, ...patch }))}
            onStatus={updateProductStatus}
            onSubmit={createProduct}
          />
        ) : null}
        {!loading && active === 'mallOrders' ? (
          <MallOrdersSection
            orders={data.mallOrders}
            onDispatch={dispatchMallOrder}
            onRefund={refundMallOrder}
            onStatus={updateMallOrderStatus}
          />
        ) : null}
        {!loading && active === 'operations' ? (
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
        ) : null}
        {!loading && active === 'support' ? (
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
        ) : null}
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
