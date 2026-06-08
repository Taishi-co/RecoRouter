import { Network } from '@/network'

export interface MallCategory {
  id: string
  code: string
  name: string
  sortOrder: number
  status: string
}

export interface MallProduct {
  id: string
  categoryId?: string | null
  categoryCode: string
  categoryName?: string | null
  sku: string
  name: string
  subtitle?: string | null
  description?: string | null
  imageUrl?: string | null
  priceCents: number
  originalPriceCents?: number | null
  stock: number
  stockAlertThreshold?: number | null
  soldCount: number
  rating: number
  status: string
  tags: string[]
  deliveryMinutes: number
  coldChainRequired: boolean
  lengthCm?: number | null
  widthCm?: number | null
  heightCm?: number | null
  volumeLiters?: number | null
  weightKg?: number | null
  discountedPriceCents?: number | null
  savedCents?: number | null
  couponStackable?: boolean
  pointsDeductibleCents?: number | null
  discountLabel?: string | null
}

export interface MallDiscountBreakdown {
  type: 'full_reduction' | 'coupon' | 'member' | 'points' | string
  label: string
  amountCents: number
}

export interface MallHomeBanner {
  id: string
  title: string
  subtitle?: string | null
  imageUrl?: string | null
  linkType: string
  linkTarget?: string | null
  sortOrder: number
  status: string
  metadata?: Record<string, unknown>
  startsAt?: string | null
  endsAt?: string | null
}

export function resolveMallImageUrl(imageUrl?: string | null) {
  if (!imageUrl) return ''
  if (/^(https?:|data:|blob:)/.test(imageUrl)) return imageUrl
  if (imageUrl.startsWith('/') && typeof PROJECT_DOMAIN === 'string' && PROJECT_DOMAIN.length > 0) {
    return `${PROJECT_DOMAIN}${imageUrl}`
  }
  if (!imageUrl.startsWith('/') && typeof PROJECT_DOMAIN === 'string' && PROJECT_DOMAIN.length > 0) {
    return `${PROJECT_DOMAIN}/api/uploads/${imageUrl}`
  }
  return imageUrl.startsWith('/') ? imageUrl : `/api/uploads/${imageUrl}`
}

export interface MallCartItem {
  id: string
  userId: string
  productId: string
  quantity: number
  selected: boolean
  product?: MallProduct
  lineTotalCents?: number
  originalUnitPriceCents?: number
  discountedUnitPriceCents?: number
  lineDiscountCents?: number
  linePayableCents?: number
  savedCents?: number
  couponStackable?: boolean
  pointsDeductibleCents?: number
}

export interface MallCart {
  items: MallCartItem[]
  subtotalCents: number
  deliveryFeeCents?: number
  couponCents?: number
  payableCents?: number
  discountDescription?: string | null
  discountThresholdCents?: number | null
  discountRuleCents?: number | null
  fullReductionCents?: number
  couponDiscountCents?: number
  memberDiscountCents?: number
  pointsRedeemedCents?: number
  totalDiscountCents?: number
  discountBreakdown?: MallDiscountBreakdown[]
  nextDiscountGapCents?: number | null
  nextDiscountCents?: number | null
  availablePoints?: number
  memberLevel?: {
    code?: string
    name?: string
    discountBps?: number
  } | null
  selectedCount: number
}

export interface MallAddress {
  id: string
  userId?: string
  contactName: string
  contactPhone?: string | null
  addressLabel: string
  addressText: string
  latitude?: number | null
  longitude?: number | null
  addressType?: string | null
  isDefault: boolean
  pickupPointId?: string | null
  createdAt?: string
  updatedAt?: string
  user_id?: string
  address_name?: string
  address?: string
  address_type?: string
  is_default?: boolean
}

export interface CreateMallAddressInput {
  userId?: string
  contactName?: string
  contactPhone?: string
  addressLabel?: string
  addressText?: string
  latitude?: number
  longitude?: number
  addressType?: string
  isDefault?: boolean
  pickupPointId?: string
  user_id?: string
  address_name?: string
  address?: string
  address_type?: string
  is_default?: boolean
}

export interface MallPickupPoint {
  id: string
  name: string
  addressText: string
  contactName?: string | null
  contactPhone?: string | null
  latitude?: number | null
  longitude?: number | null
  businessHours?: string | null
  distanceMeters?: number | null
  groupLeaderId?: string | null
  groupLeaderName?: string | null
  status: string
  isDefault?: boolean
  createdAt?: string
  updatedAt?: string
}

export interface MallFulfillmentCode {
  id: string
  orderId: string
  code: string
  pickupPointId?: string | null
  status: string
  verifiedBy?: string | null
  verifiedAt?: string | null
  verificationChannel?: string | null
  expiresAt?: string | null
  createdAt?: string
}

export interface MallCommunityPost {
  id: string
  title: string
  content: string
  summary?: string | null
  imageUrl?: string | null
  coverImageUrl?: string | null
  pickupPointId?: string | null
  authorUserId?: string | null
  authorName?: string | null
  likeCount?: number
  followCount?: number
  joinCount?: number
  commentCount?: number
  joined?: boolean
  tags: string[]
  status: string
  sortOrder?: number
  publishedAt?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface CreateMallCommunityPostInput {
  userId: string
  pickupPointId?: string
  title: string
  content: string
  summary?: string
  imageUrl?: string
  coverImageUrl?: string
  tags?: string[]
}

export interface MallNotificationPreferences {
  id?: string
  userId: string
  orderUpdates: boolean
  promotions: boolean
  communityPosts: boolean
  serviceMessages: boolean
  updatedAt?: string
}

export interface MallOrderEvent {
  id: string
  stage: string
  title: string
  description?: string | null
  status: string
  eventTime?: string
}

export interface MallOrder {
  id: string
  orderNo: string
  userId: string
  addressId?: string | null
  pickupPointId?: string | null
  pickupPointName?: string | null
  groupLeaderName?: string | null
  groupLeaderPhone?: string | null
  addressText: string
  recipientName?: string | null
  recipientPhone?: string | null
  deliveryMethod: string
  pickupMethod: string
  expectedDeliveryWindow?: string | null
  subtotalCents: number
  deliveryFeeCents: number
  couponCents: number
  payableCents: number
  paymentStatus: string
  status: string
  refundStatus?: string | null
  afterSaleStatus?: string | null
  fulfillmentCode?: MallFulfillmentCode | null
  fulfillmentStatus?: string | null
  vehicleCode?: string | null
  trackingDistanceKm?: number | null
  cabinCode?: string | null
  items: Array<{
    id: string
    productId: string
    productName: string
    unitPriceCents: number
    quantity: number
    lineTotalCents: number
  }>
  events?: MallOrderEvent[]
  afterSales?: MallAfterSale[]
  createdAt?: string
}

export interface MallCheckout {
  id: string
  userId: string
  source: 'cart' | 'buy_now' | string
  productId?: string | null
  quantity?: number
  addressId?: string | null
  pickupPointId?: string | null
  items: Array<{
    id?: string
    productId: string
    sku?: string
    productName: string
    categoryCode?: string | null
    imageUrl?: string | null
    unitPriceCents: number
    originalUnitPriceCents?: number
    discountedUnitPriceCents?: number
    quantity: number
    lineTotalCents: number
    lineDiscountCents?: number
    linePayableCents?: number
    savedCents?: number
    couponStackable?: boolean
    pointsDeductibleCents?: number
    product?: MallProduct
  }>
  subtotalCents: number
  deliveryFeeCents: number
  couponCents: number
  payableCents: number
  fullReductionCents?: number
  couponDiscountCents?: number
  memberDiscountCents?: number
  pointsRedeemedCents?: number
  totalDiscountCents?: number
  discountBreakdown?: MallDiscountBreakdown[]
  nextDiscountGapCents?: number | null
  nextDiscountCents?: number | null
  availablePoints?: number
  memberLevel?: {
    code?: string
    name?: string
    discountBps?: number
  } | null
  discountDescription?: string | null
  discountThresholdCents?: number | null
  discountRuleCents?: number | null
}

export interface MallAfterSale {
  id: string
  orderId: string
  userId?: string
  reason: string
  description?: string | null
  evidenceImages?: string[]
  amountCents: number
  status: string
  handlingMethod: string
  createdAt?: string
}

export interface MallProfile {
  userId?: string
  displayName?: string
  memberLevel?: string
  pickupPointName?: string
  monthlySavingsCents?: number
  pendingPaymentCount?: number
  pendingPickupCount?: number
  afterSaleCount?: number
  groupJoinedCount?: number
  commonPickupPoint?: string
  supportStatus?: string
  member?: {
    id?: string
    name?: string
    username?: string
    phone?: string
    role?: string
    status?: string
    points?: number
    totalSpendCents?: number
    level?: {
      code?: string
      name?: string
      discountBps?: number
      benefits?: string[]
    }
  }
  orderCounts?: {
    pendingPayment?: number
    pendingPickup?: number
    afterSales?: number
    completed?: number
    total?: number
  }
  defaultPickupPoint?: MallPickupPoint | null
  defaultAddress?: MallAddress | null
  support?: {
    openSessions?: number
    openTickets?: number
    afterSales?: number
  }
  couponWallet?: {
    availableCount?: number
    expiringCount?: number
    nearestExpiry?: string | null
  }
  groupLeader?: Record<string, unknown> | null
}

export interface MallGroupLeaderCenter {
  pickupPointId?: string
  pickupPointName?: string
  todayGroupCount?: number
  estimatedCommissionCents?: number
  pendingShareCount?: number
  pendingVerificationCount?: number
  stockIssueCount?: number
  commissionRateBps?: number
  commissionRateRange?: string
  withdrawableCents?: number
  monthlyRewardCents?: number
  leader?: Record<string, unknown>
  pickupPoint?: MallPickupPoint | null
  today?: {
    readyForPickup?: number
    pendingPickup?: number
    orderCount?: number
    completed?: number
    afterSales?: number
    totalPayableCents?: number
  }
  pendingOrders?: MallOrder[]
  reminders: Array<{
    id: string
    title: string
    description: string
    actionText: string
  }>
}

export interface MallCampaign {
  id: string
  name: string
  campaignType: string
  budgetCents: number
  spentCents: number
  rules: Record<string, unknown>
  status: string
}

export interface MallSettings {
  id: string
  freeDeliveryThresholdCents: number
  defaultDeliveryFeeCents: number
  deliveryPromiseMinutes: number
  coldChainEnabled: boolean
  refundReviewMinutes: number
  roles: Record<string, unknown>
  riskThresholds: Record<string, unknown>
}

export interface SupportSession {
  id: string
  userId: string
  assignedAgentId?: string | null
  channel: string
  topic: string
  status: string
  lastMessage?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface SupportTicket {
  id: string
  userId: string
  sessionId?: string | null
  orderId?: string | null
  category: string
  priority: string
  title: string
  description?: string | null
  status: string
  assignedAgentId?: string | null
  resolution?: string | null
}

export interface SupportMessage {
  id: string
  sessionId: string
  senderId?: string | null
  senderRole: string
  content: string
  metadata?: Record<string, unknown>
  createdAt?: string
}

export interface SupportKnowledge {
  id: string
  title: string
  category: string
  content: string
  status: string
  useCount: number
  createdAt?: string
  updatedAt?: string
}

export const yuan = (cents?: number | null) => `¥${((cents || 0) / 100).toFixed(2)}`

export async function listMallCategories(): Promise<MallCategory[]> {
  return apiGet('/api/mall/categories')
}

export async function listMallProducts(params: {
  keyword?: string
  categoryCode?: string
  status?: string
} = {}): Promise<MallProduct[]> {
  return apiGet('/api/mall/products', params)
}

export async function listMallHomeBanners(): Promise<MallHomeBanner[]> {
  return apiGet('/api/mall/home-banners')
}

export async function getMallProduct(id: string): Promise<MallProduct> {
  return apiGet(`/api/mall/products/${id}`)
}

export async function getMallCart(userId: string): Promise<MallCart> {
  return apiGet('/api/mall/cart', { userId })
}

export async function addMallCartItem(userId: string, productId: string, quantity: number) {
  return apiPost<MallCartItem>('/api/mall/cart/items', { userId, productId, quantity })
}

export async function updateMallCartItem(id: string, data: { quantity?: number; selected?: boolean }) {
  return apiPut<MallCartItem>(`/api/mall/cart/items/${id}`, data)
}

export async function deleteMallCartItem(id: string) {
  return apiDelete(`/api/mall/cart/items/${id}`)
}

export async function listMallPickupPoints(params: {
  keyword?: string
  status?: string
  latitude?: number
  longitude?: number
} = {}): Promise<MallPickupPoint[]> {
  return apiGet('/api/mall/pickup-points', params)
}

export async function createMallOrder(data: {
  userId: string
  checkoutId?: string
  addressId?: string
  pickupPointId?: string
  expectedDeliveryWindow?: string
  deliveryMethod?: string
  pickupMethod?: string
  remark?: string
}): Promise<MallOrder> {
  return apiPost('/api/mall/orders', data)
}

export async function createMallCheckout(data: {
  userId: string
  source: 'cart' | 'buy_now'
  productId?: string
  quantity?: number
  addressId?: string
  pickupPointId?: string
}): Promise<MallCheckout> {
  return apiPost('/api/mall/checkouts', data)
}

export async function getMallCheckout(id: string): Promise<MallCheckout> {
  return apiGet(`/api/mall/checkouts/${id}`)
}

export async function listMallAddresses(userId: string): Promise<MallAddress[]> {
  const addresses = await apiGet<MallAddress[]>('/api/mall/addresses', { userId })
  return addresses.map(normalizeMallAddress)
}

export async function createMallAddress(data: CreateMallAddressInput): Promise<MallAddress> {
  const address = await apiPost<MallAddress>('/api/mall/addresses', normalizeMallAddressInput(data))
  return normalizeMallAddress(address)
}

export async function listMallOrders(userId: string, status?: string): Promise<MallOrder[]> {
  return apiGet('/api/mall/orders', { userId, status })
}

export async function getMallOrder(id: string): Promise<MallOrder> {
  return apiGet(`/api/mall/orders/${id}`)
}

export async function getMallTracking(id: string): Promise<{ order: MallOrder; events: MallOrderEvent[] }> {
  return apiGet(`/api/mall/orders/${id}/tracking`)
}

export async function createMallAfterSale(orderId: string, data: {
  userId: string
  reason: string
  description?: string
  amountCents?: number
  evidenceImages?: string[]
}): Promise<MallAfterSale> {
  return apiPost(`/api/mall/orders/${orderId}/after-sales`, data)
}

export async function adminListMallProducts(): Promise<MallProduct[]> {
  return apiGet('/api/admin/mall/products')
}

export async function adminCreateMallProduct(data: Partial<MallProduct> & { categoryCode: string; priceCents: number }) {
  return apiPost<MallProduct>('/api/admin/mall/products', data)
}

export async function adminUpdateMallProduct(id: string, data: Partial<MallProduct>) {
  return apiPut<MallProduct>(`/api/admin/mall/products/${id}`, data)
}

export async function adminListMallOrders(status?: string): Promise<MallOrder[]> {
  return apiGet('/api/admin/mall/orders', { status })
}

export async function adminDispatchMallOrder(id: string, vehicleCode: string) {
  return apiPost(`/api/admin/mall/orders/${id}/dispatch`, {
    vehicleCode,
    trackingDistanceKm: 3.2,
  })
}

export async function adminUpdateMallOrderStatus(id: string, status: string, description?: string) {
  return apiPut(`/api/admin/mall/orders/${id}/status`, { status, description })
}

export async function adminRefundMallOrder(id: string, data: {
  amountCents?: number
  reason?: string
  handlingMethod?: string
}) {
  return apiPost(`/api/admin/mall/orders/${id}/refund`, data)
}

export async function adminCreateFulfillmentCode(orderId: string, data: {
  pickupPointId?: string
  expiresAt?: string
}): Promise<MallFulfillmentCode> {
  return apiPost(`/api/admin/mall/orders/${orderId}/fulfillment-code`, data)
}

export async function adminVerifyFulfillment(data: {
  orderId: string
  code: string
  verifiedBy?: string
}): Promise<MallFulfillmentCode> {
  return apiPost(`/api/admin/mall/orders/${data.orderId}/verify-fulfillment`, {
    code: data.code,
    verifiedBy: data.verifiedBy,
  })
}

export async function adminListCampaigns(): Promise<MallCampaign[]> {
  return apiGet('/api/admin/mall/campaigns')
}

export async function adminCreateCampaign(data: Partial<MallCampaign> & { name: string; campaignType: string }) {
  return apiPost<MallCampaign>('/api/admin/mall/campaigns', data)
}

export async function adminGetSettings(): Promise<MallSettings> {
  return apiGet('/api/admin/mall/settings')
}

export async function adminUpdateSettings(data: Partial<MallSettings>): Promise<MallSettings> {
  return apiPut('/api/admin/mall/settings', data)
}

export async function listMallCommunityPosts(params: {
  pickupPointId?: string
  status?: string
  limit?: number
} = {}): Promise<MallCommunityPost[]> {
  return apiGet('/api/mall/community-posts', params)
}

export async function getMallProfile(userId: string): Promise<MallProfile> {
  return apiGet('/api/mall/me/profile', { userId })
}

export async function getMallProfileSafe(userId: string): Promise<MallProfile> {
  return withMallFallback(
    () => getMallProfile(userId),
    {
      userId,
      displayName: '',
      memberLevel: '',
      pickupPointName: '',
      monthlySavingsCents: 0,
      pendingPaymentCount: 0,
      pendingPickupCount: 0,
      afterSaleCount: 0,
      groupJoinedCount: 0,
      commonPickupPoint: '',
      supportStatus: '',
    },
  )
}

export async function getMallGroupLeaderCenter(userId: string): Promise<MallGroupLeaderCenter> {
  return apiGet('/api/mall/group-leader/workbench', { userId })
}

export async function verifyMallGroupLeaderFulfillment(data: {
  userId: string
  orderId: string
  code: string
}): Promise<MallFulfillmentCode> {
  return apiPost('/api/mall/group-leader/verify-fulfillment', data)
}

export async function getMallGroupLeaderCenterSafe(userId: string): Promise<MallGroupLeaderCenter> {
  return withMallFallback(
    () => getMallGroupLeaderCenter(userId),
    {
      pickupPointId: 'pickup-demo',
      pickupPointName: '邻里团长工作台',
      todayGroupCount: 18,
      estimatedCommissionCents: 12600,
      pendingShareCount: 4,
      pendingVerificationCount: 9,
      stockIssueCount: 2,
      reminders: [
        {
          id: 'share',
          title: '分享今日团购',
          description: '草莓礼盒、鲜奶周卡正在截团',
          actionText: '分享',
        },
        {
          id: 'orders',
          title: '团员订单提醒',
          description: '2 位团员待确认自提时间',
          actionText: '处理',
        },
        {
          id: 'code',
          title: '自提核销码',
          description: '到货后扫码核销，减少排队',
          actionText: '打开',
        },
      ],
    },
  )
}

export async function createMallCommunityPost(data: CreateMallCommunityPostInput): Promise<MallCommunityPost> {
  return apiPost('/api/mall/community-posts', {
    userId: data.userId,
    pickupPointId: data.pickupPointId,
    title: data.title,
    summary: data.summary || data.content,
    content: data.content,
    imageUrl: data.imageUrl || data.coverImageUrl,
    images: data.coverImageUrl ? [data.coverImageUrl] : undefined,
  })
}

export async function createMallCommunityPostSafe(data: CreateMallCommunityPostInput): Promise<MallCommunityPost> {
  return withMallFallback(
    () => createMallCommunityPost(data),
    {
      id: `local-${Date.now()}`,
      title: data.title,
      content: data.content,
      summary: data.content,
      pickupPointId: data.pickupPointId,
      authorName: '我',
      likeCount: 0,
      commentCount: 0,
      joined: false,
      tags: data.tags || ['邻里动态'],
      status: 'published',
      createdAt: new Date().toISOString(),
    },
  )
}

export async function interactMallCommunityPost(
  postId: string,
  data: { userId: string; action: 'like' | 'join' | 'follow'; content?: string },
): Promise<MallCommunityPost> {
  return apiPost(`/api/mall/community-posts/${postId}/interactions`, {
    userId: data.userId,
    interactionType: data.action,
    content: data.content,
  })
}

export async function interactMallCommunityPostSafe(
  post: MallCommunityPost,
  data: { userId: string; action: 'like' | 'join' | 'follow'; content?: string },
): Promise<MallCommunityPost> {
  return withMallFallback(
    () => interactMallCommunityPost(post.id, data),
    {
      ...post,
      likeCount: data.action === 'like' ? (post.likeCount || 0) + 1 : post.likeCount,
      followCount: data.action === 'follow' ? (post.followCount || 0) + 1 : post.followCount,
      joinCount: data.action === 'join' ? (post.joinCount || 0) + 1 : post.joinCount,
      joined: data.action === 'join' ? true : post.joined,
    },
  )
}

export async function getMallNotificationPreferences(userId: string): Promise<MallNotificationPreferences> {
  return apiGet('/api/mall/notification-preferences', { userId })
}

export async function updateMallNotificationPreferences(
  userId: string,
  data: Partial<Omit<MallNotificationPreferences, 'id' | 'userId' | 'updatedAt'>>,
): Promise<MallNotificationPreferences> {
  return apiPut('/api/mall/notification-preferences', { userId, ...data })
}

export async function listSupportSessions(userId?: string): Promise<SupportSession[]> {
  return apiGet('/api/support/sessions', userId ? { userId } : undefined)
}

export async function createSupportSession(data: {
  userId: string
  channel: string
  topic: string
  assignedAgentId?: string
}): Promise<SupportSession> {
  return apiPost('/api/support/sessions', data)
}

export async function listSupportMessages(sessionId: string): Promise<SupportMessage[]> {
  return apiGet(`/api/support/sessions/${sessionId}/messages`)
}

export async function createSupportMessage(sessionId: string, data: {
  senderId?: string
  senderRole: string
  content: string
}): Promise<SupportMessage> {
  return apiPost(`/api/support/sessions/${sessionId}/messages`, data)
}

export async function listSupportTickets(userId?: string): Promise<SupportTicket[]> {
  return apiGet('/api/support/tickets', userId ? { userId } : undefined)
}

export async function createSupportTicket(data: {
  userId: string
  sessionId?: string
  orderId?: string
  category: string
  priority?: string
  title: string
  description?: string
}): Promise<SupportTicket> {
  return apiPost('/api/support/tickets', data)
}

export async function updateSupportTicket(id: string, data: Partial<SupportTicket>) {
  return apiPut<SupportTicket>(`/api/support/tickets/${id}`, data)
}

export async function listSupportKnowledge(): Promise<SupportKnowledge[]> {
  return apiGet('/api/support/knowledge')
}

export async function createSupportKnowledge(data: {
  title: string
  category: string
  content: string
  status?: string
}): Promise<SupportKnowledge> {
  return apiPost('/api/support/knowledge', data)
}

export async function updateSupportKnowledge(id: string, data: Partial<SupportKnowledge>) {
  return apiPut<SupportKnowledge>(`/api/support/knowledge/${id}`, data)
}

export async function supportMetrics(): Promise<Record<string, number>> {
  return apiGet('/api/support/metrics')
}

function normalizeMallAddressInput(data: CreateMallAddressInput): Record<string, unknown> {
  return cleanObjectData({
    userId: data.userId ?? data.user_id,
    contactName: data.contactName ?? data.address_name,
    contactPhone: data.contactPhone,
    addressLabel: data.addressLabel ?? data.address_name,
    addressText: data.addressText ?? data.address,
    latitude: data.latitude,
    longitude: data.longitude,
    addressType: data.addressType ?? data.address_type,
    isDefault: data.isDefault ?? data.is_default,
    pickupPointId: data.pickupPointId,
  })
}

function normalizeMallAddress(address: MallAddress): MallAddress {
  const addressLabel = address.addressLabel || address.address_name || ''
  const addressText = address.addressText || address.address || ''
  const isDefault = address.isDefault ?? address.is_default ?? false

  return {
    ...address,
    contactName: address.contactName || address.address_name || '',
    contactPhone: address.contactPhone ?? null,
    addressLabel,
    addressText,
    address_name: address.address_name || addressLabel,
    address: address.address || addressText,
    address_type: address.address_type || address.addressType || undefined,
    isDefault,
    is_default: address.is_default ?? isDefault,
  }
}

async function apiGet<T>(url: string, data?: Record<string, unknown>): Promise<T> {
  const response = await Network.request({ url, method: 'GET', data: cleanQueryData(data) })
  return unwrapApiData<T>(response.statusCode, response.data)
}

async function apiPost<T>(url: string, data: unknown): Promise<T> {
  const response = await Network.request({
    url,
    method: 'POST',
    header: { 'content-type': 'application/json' },
    data,
  })
  return unwrapApiData<T>(response.statusCode, response.data)
}

async function apiPut<T>(url: string, data: unknown): Promise<T> {
  const response = await Network.request({
    url,
    method: 'PUT',
    header: { 'content-type': 'application/json' },
    data,
  })
  return unwrapApiData<T>(response.statusCode, response.data)
}

async function apiDelete<T>(url: string): Promise<T> {
  const response = await Network.request({ url, method: 'DELETE' })
  return unwrapApiData<T>(response.statusCode, response.data)
}

function unwrapApiData<T>(statusCode: number, rawData: unknown): T {
  const body = typeof rawData === 'string' ? JSON.parse(rawData) : rawData
  const record = body as { code?: number; message?: string; data?: T }

  if (statusCode < 200 || statusCode >= 300) {
    throw new Error(record?.message || '请求失败')
  }
  if (record?.code !== 200) {
    throw new Error(record?.message || '请求失败')
  }

  return record.data as T
}

function cleanQueryData(data?: Record<string, unknown>) {
  if (!data) return undefined
  const entries = Object.entries(data).filter(([, value]) => value !== undefined && value !== null && value !== '')
  return entries.length > 0 ? Object.fromEntries(entries) : undefined
}

function cleanObjectData(data: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  )
}

async function withMallFallback<T>(request: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await request()
  } catch {
    return fallback
  }
}
