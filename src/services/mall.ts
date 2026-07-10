import { Network } from '@/network'

export interface MallGetOptions {
  ttlMs?: number
  fresh?: boolean
  preferCache?: boolean
  revalidate?: boolean
}

const MALL_GET_CACHE_TTL_MS = 30_000
const MALL_FAST_GET_CACHE_TTL_MS = 8_000
const MALL_STATIC_GET_CACHE_TTL_MS = 60_000
const MALL_GET_CACHE_MAX_ENTRIES = 200
const mallGetCache = new Map<string, { expiresAt: number; value: unknown }>()
const mallGetInFlight = new Map<string, Promise<unknown>>()
let mallGetCacheEpoch = 0

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
  imageKey?: string | null
  imageUrl?: string | null
  imageKeys?: string[] | null
  images?: string[]
  specification?: string | null
  saleMethod?: string | null
  supplyPriceCents?: number | null
  priceCents: number
  originalPriceCents?: number | null
  stock: number
  stockAlertThreshold?: number | null
  minimumOrderQuantity?: number | null
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
  createdAt?: string | null
  updatedAt?: string | null
  variants?: MallProductVariant[]
  defaultVariantId?: string | null
  qualityGuaranteed?: boolean
  procurementBuyers?: MallProcurementBuyer[]
  qualificationReports?: MallQualificationReport[]
  fixedPriceCampaign?: MallFixedPriceCampaign | null
  promotionTags?: MallProductPromotionTag[]
  promotions?: MallProductPromotion[]
}

export interface MallProductPromotionTag {
  campaignId: string
  campaignType: string
  tagText: string
  iconText?: string | null
  iconUrl?: string | null
  backgroundColor?: string | null
  textColor?: string | null
}

export interface MallProductPromotion extends MallProductPromotionTag {
  title: string
  ruleExplanation: string
  limitText?: string | null
  startsAt?: string | null
  endsAt?: string | null
}

export interface MallGroupBuyTier {
  quantity: number
  priceCents: number
}

export interface MallGroupBuyActivity {
  id: string
  name: string
  productId: string
  variantId?: string | null
  unitName: string
  status: string
  startsAt?: string | null
  endsAt?: string | null
  balanceDueAt?: string | null
  minGroupQuantity: number
  maxQuantityPerUser?: number | null
  minCreditScore?: number | null
  overdueCreditPenalty?: number | null
  depositType: string
  depositValue: number
  tiers: MallGroupBuyTier[]
  formedQuantity?: number | null
  currentQuantity: number
  finalTierQuantity?: number | null
  finalUnitPriceCents?: number | null
  product?: MallProduct
}

export interface MallGroupBuySubscription {
  id: string
  activityId: string
  userId: string
  quantity: number
  unitName: string
  status: string
  estimatedUnitPriceCents?: number | null
  finalUnitPriceCents?: number | null
  estimatedTotalCents?: number | null
  depositCents?: number | null
  balanceCents?: number | null
  mallOrderId?: string | null
  creditPenaltyPoints?: number | null
  activity?: MallGroupBuyActivity
  product?: MallProduct
}

export interface MallFixedPriceCampaign {
  campaignId?: string | null
  campaignName?: string | null
  fixedPriceCents?: number | null
  badgeText?: string | null
  badgeIcon?: string | null
  badgeIconUrl?: string | null
  badgeBackgroundColor?: string | null
  badgeTextColor?: string | null
  badgePosition?: string | null
}

export interface MallProductVariant {
  id: string
  name: string
  sku?: string | null
  specification?: string | null
  saleMethod?: string | null
  priceCents: number
  originalPriceCents?: number | null
  supplyPriceCents?: number | null
  stock: number
  minimumOrderQuantity?: number | null
  status: string
  sortOrder?: number | null
  pricingMode?: 'fixed' | 'weighed' | string
  weightUnit?: string | null
  weightUnitLabel?: string | null
  weightUnitGrams?: number | null
  weightToleranceBps?: number | null
}

export interface MallProcurementBuyer {
  id: string
  name?: string | null
  contactName?: string | null
  contactPhone?: string | null
  licenseUrl?: string | null
  status?: string | null
  remark?: string | null
  hideSupplier?: boolean
}

export interface MallQualificationReport {
  id: string
  productId?: string | null
  buyerId?: string | null
  buyerName?: string | null
  reportName: string
  reportType?: string | null
  reportUrl: string
  issuer?: string | null
  issuedAt?: string | null
  expiresAt?: string | null
  hideSupplier?: boolean
  status?: string | null
}

export interface MallDiscountBreakdown {
  type: 'full_reduction' | 'coupon' | 'delivery' | 'member' | 'points' | string
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

export interface MallHomeSection {
  id: string
  sectionType: 'announcement' | 'flash_sale' | 'new_arrival' | 'best_seller' | string
  title: string
  subtitle?: string | null
  content?: string | null
  imageUrl?: string | null
  linkType: string
  linkTarget?: string | null
  productIds?: string[]
  rules?: Record<string, unknown>
  sortOrder: number
  status: string
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
  variantId?: string | null
  variantName?: string | null
  quantity: number
  selected: boolean
  product?: MallProduct
  lineTotalCents?: number
  originalUnitPriceCents?: number
  discountedUnitPriceCents?: number
  lineDiscountCents?: number
  linePayableCents?: number
  savedCents?: number
  pricingMode?: string | null
  estimatedWeightGrams?: number | null
  actualWeightGrams?: number | null
  weightUnitLabel?: string | null
  weightUnitGrams?: number | null
  weightToleranceBps?: number | null
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
  deliveryDiscountCents?: number
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
  communityName?: string | null
  contactName?: string | null
  contactPhone?: string | null
  leaderName?: string | null
  leaderPhone?: string | null
  latitude?: number | null
  longitude?: number | null
  businessHours?: string | null
  distanceMeters?: number | null
  groupLeaderId?: string | null
  groupLeaderName?: string | null
  sortOrder?: number | null
  status: string
  isDefault?: boolean
  createdAt?: string
  updatedAt?: string
}

export interface MallGroupLeader {
  id: string
  pickupPointId: string
  pickupPointName?: string | null
  pickupPointAddress?: string | null
  communityName?: string | null
  userId?: string | null
  name: string
  phone?: string | null
  status: string
  serviceNote?: string | null
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
  checkoutId?: string | null
  addressId?: string | null
  pickupPointId?: string | null
  pickupPointName?: string | null
  groupLeaderName?: string | null
  groupLeaderPhone?: string | null
  addressText: string
  recipientName?: string | null
  recipientPhone?: string | null
  supportName?: string | null
  supportPhone?: string | null
  supportHours?: string | null
  deliveryMethod: string
  pickupMethod: string
  expectedDeliveryWindow?: string | null
  subtotalCents: number
  deliveryFeeCents: number
  couponCents: number
  payableCents: number
  estimatedPayableCents?: number | null
  weightAdjustmentStatus?: string | null
  weightAdjustmentCents?: number | null
  paymentStatus: string
  paymentExpiresAt?: string | null
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
    variantId?: string | null
    variantName?: string | null
    productName: string
    sku?: string | null
    imageUrl?: string | null
    unitPriceCents: number
    quantity: number
    lineTotalCents: number
    estimatedLineTotalCents?: number | null
    pricingMode?: string | null
    estimatedWeightGrams?: number | null
    actualWeightGrams?: number | null
    weightUnit?: string | null
    weightUnitLabel?: string | null
    weightUnitGrams?: number | null
    weightToleranceBps?: number | null
    weightAdjustmentStatus?: string | null
    weightAdjustmentNote?: string | null
    weightAdjustedAt?: string | null
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
  variantId?: string | null
  quantity?: number
  addressId?: string | null
  pickupPointId?: string | null
  items: Array<{
    id?: string
    productId: string
    variantId?: string | null
    variantName?: string | null
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
    estimatedLineTotalCents?: number | null
    pricingMode?: string | null
    estimatedWeightGrams?: number | null
    actualWeightGrams?: number | null
    weightUnit?: string | null
    weightUnitLabel?: string | null
    weightUnitGrams?: number | null
    weightToleranceBps?: number | null
    weightAdjustmentStatus?: string | null
    savedCents?: number
    couponStackable?: boolean
    pointsDeductibleCents?: number
    product?: MallProduct
  }>
  subtotalCents: number
  deliveryFeeCents: number
  couponCents: number
  payableCents: number
  estimatedPayableCents?: number | null
  weightAdjustmentStatus?: string | null
  weightAdjustmentCents?: number | null
  fullReductionCents?: number
  couponDiscountCents?: number
  deliveryDiscountCents?: number
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
  afterSaleType?: 'return_refund' | 'exchange' | 'refund_only' | string
  reason: string
  description?: string | null
  selectedItems?: Array<{
    orderItemId?: string
    id?: string
    productId?: string
    variantId?: string | null
    variantName?: string | null
    productName?: string
    sku?: string | null
    unitPriceCents?: number
    quantity?: number
    lineTotalCents?: number
    pricingMode?: string | null
  }>
  evidenceImages?: string[]
  amountCents: number
  requestedAmountCents?: number
  approvedAmountCents?: number | null
  status: string
  handlingMethod: string
  solutionType?: string | null
  negotiationStatus?: string | null
  returnLogistics?: Record<string, unknown>
  supportSessionId?: string | null
  resolution?: string | null
  timeline?: Array<{
    status?: string
    title?: string
    description?: string
    createdAt?: string
  }>
  createdAt?: string
  updatedAt?: string
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
    nickname?: string
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

export interface UpdateMallProfileInput {
  userId: string
  nickname?: string
  name?: string
  phone?: string
}

export type MallCouponWalletStatus = 'claimable' | 'claimed' | 'used' | 'expired' | 'unavailable'

export interface MallCoupon {
  id: string
  name: string
  code: string
  couponType: string
  thresholdCents: number
  discountCents: number
  totalQuantity?: number
  claimedCount?: number
  usedCount?: number
  perUserLimit?: number
  description?: string | null
  rules?: Record<string, unknown>
  status: string
  startsAt?: string | null
  endsAt?: string | null
  walletId?: string | null
  walletStatus?: MallCouponWalletStatus
  canClaim?: boolean
  isExpiringSoon?: boolean
  expiresAt?: string | null
  claimedAt?: string | null
  usedAt?: string | null
  orderId?: string | null
  pointsCost?: number
}

export interface MallCouponWallet {
  summary: {
    availableCount?: number
    claimableCount?: number
    claimedCount?: number
    expiringCount?: number
    usedCount?: number
    expiredCount?: number
    nearestExpiry?: string | null
  }
  claimable: MallCoupon[]
  claimed: MallCoupon[]
  expiring: MallCoupon[]
  used: MallCoupon[]
  expired: MallCoupon[]
  all: MallCoupon[]
}

export interface MallPointsMall {
  member?: MallProfile['member']
  rules?: {
    pointsPerYuan?: number
    redeemRatePoints?: number
    redeemRateCents?: number
    memberLevels?: Array<{
      name: string
      discountBps: number
    }>
  }
  couponRewards: MallCoupon[]
  productRewards: MallProduct[]
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

export interface MallPromotionVenueItem {
  productId: string
  sku?: string | null
  productName?: string | null
  sortOrder?: number | null
}

export interface MallPromotionVenueRules {
  [key: string]: unknown
  title?: string
  subtitle?: string
  copy?: string
  buttonText?: string
  iconText?: string
  iconUrl?: string
  backgroundImageUrl?: string
  backgroundColor?: string
  textColor?: string
  entryPosition?: string
  sortOrder?: number
  items?: MallPromotionVenueItem[]
}

export interface MallPromotionVenue extends MallCampaign {
  campaignType: 'promotion_venue' | string
  rules: MallPromotionVenueRules
}

export interface MallDeliveryRules {
  pickupWindowStart?: string
  pickupWindowEnd?: string
  deliveryBatchTimes?: string
  deliveryFeeCents?: number
  freeDeliveryThresholdCents?: number
  coldChainRequired?: boolean
  refundReviewMinutes?: number
  supportName?: string
  supportPhone?: string
  supportHours?: string
}

export interface MallPaymentSplitRules {
  leaderCommissionRate?: number
  platformServiceRate?: number
  supplierSettlementCycle?: string
  withdrawMinCents?: number
}

export interface MallSettings {
  id: string
  freeDeliveryThresholdCents: number
  defaultDeliveryFeeCents: number
  deliveryPromiseMinutes: number
  coldChainEnabled: boolean
  refundReviewMinutes: number
  deliveryRules: MallDeliveryRules
  paymentSplitRules: MallPaymentSplitRules
  supportName?: string | null
  supportPhone?: string | null
  supportHours?: string | null
  roles: Record<string, unknown>
  riskThresholds: Record<string, unknown>
}

export interface MallOpsOverview {
  onSaleProducts?: number
  stockAlerts?: number
  todayOrders?: number
  historyOrders?: number
  exceptionOrders?: number
  deliverySheets?: number
  pendingWithdrawals?: number
  todayRevenueCents?: number
  todaySupplyCents?: number
}

export interface MallDeliverySheet {
  id: string
  sheetDate: string
  pickupPointId: string
  pickupPointName: string
  communityName?: string | null
  status: string
  orderCount: number
  itemCount: number
  totalPayableCents: number
  generatedBy?: string | null
  generatedAt?: string
  shippedAt?: string | null
  deliveredAt?: string | null
  metadata?: Record<string, unknown>
}

export interface MallFinanceBill {
  period?: string
  periodStart: string
  periodEnd?: string
  orderCount?: number
  payableCents?: number
  supplyAmountCents?: number
  refundAmountCents?: number
  settlementAmountCents?: number
}

export interface MallSettlementRecord {
  id: string
  periodType: string
  periodStart: string
  periodEnd: string
  supplierId?: string | null
  supplyAmountCents: number
  refundAmountCents: number
  settlementAmountCents: number
  status: string
  voucherUrl?: string | null
  paidAt?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface MallWithdrawalRequest {
  id: string
  requesterId?: string | null
  requesterRole: string
  supplierId?: string | null
  amountCents: number
  status: string
  bankAccountSnapshot?: Record<string, unknown>
  reviewedBy?: string | null
  reviewedAt?: string | null
  paidAt?: string | null
  voucherUrl?: string | null
  note?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface MallSalesStats {
  period: string
  summary?: {
    orderCount?: number
    salesCents?: number
    itemQuantity?: number
  }
  productStats?: Array<{
    productId: string
    productName: string
    quantity: number
    salesCents: number
  }>
  categoryStats?: Array<{
    categoryCode: string
    categoryName: string
    quantity: number
    salesCents: number
  }>
  topProducts?: Array<{
    productId: string
    productName: string
    quantity: number
    salesCents: number
  }>
  trend?: Array<{
    bucket: string
    orderCount: number
    salesCents: number
  }>
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

export interface MallNotification {
  id: string
  user_id?: string
  userId?: string
  type: string
  title: string
  content: string
  related_order_id?: string | null
  relatedOrderId?: string | null
  related_type?: string | null
  relatedType?: string | null
  related_id?: string | null
  relatedId?: string | null
  is_read?: boolean
  isRead?: boolean
  created_at?: string
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

export async function listMallCategories(options: MallGetOptions = {}): Promise<MallCategory[]> {
  return cachedApiGet('/api/mall/categories', undefined, { ttlMs: MALL_STATIC_GET_CACHE_TTL_MS, ...options })
}

export async function listMallProducts(params: {
  keyword?: string
  categoryCode?: string
  status?: string
  activityType?: string
  venueId?: string
  sort?: string
  page?: number
  pageSize?: number
  limit?: number
} = {}, options: MallGetOptions = {}): Promise<MallProduct[]> {
  return cachedApiGet('/api/mall/products', params, { ttlMs: MALL_GET_CACHE_TTL_MS, ...options })
}

export async function listMallHomeBanners(options: MallGetOptions = {}): Promise<MallHomeBanner[]> {
  return cachedApiGet('/api/mall/home-banners', undefined, { ttlMs: MALL_STATIC_GET_CACHE_TTL_MS, ...options })
}

export async function listMallHomeSections(options: MallGetOptions = {}): Promise<MallHomeSection[]> {
  return cachedApiGet('/api/mall/home-sections', undefined, { ttlMs: MALL_STATIC_GET_CACHE_TTL_MS, ...options })
}

export async function listMallPromotionVenues(options: MallGetOptions = {}): Promise<MallPromotionVenue[]> {
  return cachedApiGet('/api/mall/promotion-venues', undefined, { ttlMs: MALL_STATIC_GET_CACHE_TTL_MS, ...options })
}

export async function getMallProduct(id: string, options: MallGetOptions = {}): Promise<MallProduct> {
  return cachedApiGet(`/api/mall/products/${id}`, undefined, { ttlMs: MALL_GET_CACHE_TTL_MS, ...options })
}

export async function listMallGroupBuys(): Promise<MallGroupBuyActivity[]> {
  return apiGet('/api/mall/group-buys')
}

export async function getMallGroupBuy(id: string): Promise<MallGroupBuyActivity> {
  return apiGet(`/api/mall/group-buys/${id}`)
}

export async function subscribeMallGroupBuy(
  id: string,
  data: { userId: string; quantity: number },
): Promise<MallGroupBuySubscription> {
  return apiPost(`/api/mall/group-buys/${id}/subscribe`, data)
}

export async function payMallGroupBuyDeposit(id: string, userId: string): Promise<MallGroupBuySubscription> {
  return apiPost(`/api/mall/group-buy-subscriptions/${id}/pay-deposit`, { userId })
}

export async function payMallGroupBuyBalance(id: string, userId: string): Promise<MallGroupBuySubscription> {
  return apiPost(`/api/mall/group-buy-subscriptions/${id}/pay-balance`, { userId })
}

export async function listMyMallGroupBuySubscriptions(
  userId: string,
  options: MallGetOptions = {},
): Promise<MallGroupBuySubscription[]> {
  return cachedApiGet('/api/mall/me/group-buy-subscriptions', { userId }, { ttlMs: MALL_FAST_GET_CACHE_TTL_MS, ...options })
}

export async function getMallCart(userId: string, options: MallGetOptions = {}): Promise<MallCart> {
  return cachedApiGet('/api/mall/cart', { userId }, { ttlMs: MALL_FAST_GET_CACHE_TTL_MS, ...options })
}

export async function addMallCartItem(userId: string, productId: string, quantity: number, variantId?: string) {
  return apiPost<MallCartItem>('/api/mall/cart/items', { userId, productId, quantity, variantId })
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
  variantId?: string
  quantity?: number
  addressId?: string
  pickupPointId?: string
}): Promise<MallCheckout> {
  return apiPost('/api/mall/checkouts', data)
}

export async function getMallCheckout(id: string, options: MallGetOptions = {}): Promise<MallCheckout> {
  return cachedApiGet(`/api/mall/checkouts/${id}`, undefined, { ttlMs: MALL_FAST_GET_CACHE_TTL_MS, ...options })
}

export async function listMallAddresses(userId: string, options: MallGetOptions = {}): Promise<MallAddress[]> {
  const addresses = await cachedApiGet<MallAddress[]>('/api/mall/addresses', { userId }, { ttlMs: MALL_STATIC_GET_CACHE_TTL_MS, ...options })
  return addresses.map(normalizeMallAddress)
}

export async function createMallAddress(data: CreateMallAddressInput): Promise<MallAddress> {
  const address = await apiPost<MallAddress>('/api/mall/addresses', normalizeMallAddressInput(data))
  return normalizeMallAddress(address)
}

export async function listMallOrders(userId: string, status?: string, options: MallGetOptions = {}): Promise<MallOrder[]> {
  return cachedApiGet('/api/mall/orders', { userId, status }, { ttlMs: MALL_FAST_GET_CACHE_TTL_MS, ...options })
}

export async function getMallOrder(id: string, options: MallGetOptions = {}): Promise<MallOrder> {
  return cachedApiGet(`/api/mall/orders/${id}`, undefined, { ttlMs: MALL_FAST_GET_CACHE_TTL_MS, ...options })
}

export async function cancelMallOrder(id: string, userId: string, reason?: string): Promise<MallOrder> {
  return apiPost(`/api/mall/orders/${id}/cancel`, { userId, reason })
}

export async function getMallTracking(id: string): Promise<{ order: MallOrder; events: MallOrderEvent[] }> {
  return apiGet(`/api/mall/orders/${id}/tracking`)
}

export async function createMallAfterSale(orderId: string, data: {
  userId: string
  afterSaleType?: 'return_refund' | 'exchange' | 'refund_only' | string
  reason: string
  description?: string
  selectedItems?: MallAfterSale['selectedItems']
  requestedAmountCents?: number
  amountCents?: number
  evidenceImages?: string[]
}): Promise<MallAfterSale> {
  return apiPost(`/api/mall/orders/${orderId}/after-sales`, data)
}

export async function adminListMallProducts(): Promise<MallProduct[]> {
  return apiGet('/api/admin/mall/products')
}

export async function adminGetMallOpsOverview(): Promise<MallOpsOverview> {
  return apiGet('/api/admin/mall/ops/overview')
}

export async function adminListMallPickupPoints(params: {
  keyword?: string
  status?: string
  communityName?: string
  community?: string
} = {}): Promise<MallPickupPoint[]> {
  return apiGet('/api/admin/mall/pickup-points', params)
}

export async function adminCreateMallPickupPoint(data: Partial<MallPickupPoint> & Record<string, unknown>) {
  return apiPost<MallPickupPoint>('/api/admin/mall/pickup-points', data)
}

export async function adminUpdateMallPickupPoint(id: string, data: Partial<MallPickupPoint> & Record<string, unknown>) {
  return apiPut<MallPickupPoint>(`/api/admin/mall/pickup-points/${id}`, data)
}

export async function adminDeleteMallPickupPoint(id: string) {
  return apiDelete(`/api/admin/mall/pickup-points/${id}`)
}

export async function adminListMallGroupLeaders(params: {
  keyword?: string
  status?: string
  pickupPointId?: string
} = {}): Promise<MallGroupLeader[]> {
  return apiGet('/api/admin/mall/group-leaders', params)
}

export async function adminCreateMallGroupLeader(data: Partial<MallGroupLeader> & { pickupPointId: string; name: string }) {
  return apiPost<MallGroupLeader>('/api/admin/mall/group-leaders', data)
}

export async function adminUpdateMallGroupLeader(id: string, data: Partial<MallGroupLeader>) {
  return apiPut<MallGroupLeader>(`/api/admin/mall/group-leaders/${id}`, data)
}

export async function adminDeleteMallGroupLeader(id: string) {
  return apiDelete(`/api/admin/mall/group-leaders/${id}`)
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

export async function adminListMallDeliverySheets(params: {
  sheetDate?: string
  status?: string
  pickupPointId?: string
} = {}): Promise<MallDeliverySheet[]> {
  return apiGet('/api/admin/mall/delivery-sheets', params)
}

export async function adminGenerateMallDeliverySheet(data: {
  sheetDate?: string
  pickupPointId?: string
  generatedBy?: string
} = {}): Promise<MallDeliverySheet[]> {
  return apiPost('/api/admin/mall/delivery-sheets/generate', data)
}

export async function adminUpdateMallDeliverySheetStatus(id: string, status: string | { status: string }): Promise<MallDeliverySheet> {
  return apiPut(`/api/admin/mall/delivery-sheets/${id}/status`, typeof status === 'string' ? { status } : status)
}

export async function adminListMallFinanceBills(params: {
  period?: 'day' | 'week' | 'month' | string
  startDate?: string
  endDate?: string
  supplierId?: string
} = {}): Promise<MallFinanceBill[]> {
  return apiGet('/api/admin/mall/finance/bills', params)
}

export async function adminListMallSettlementRecords(params: {
  period?: 'day' | 'week' | 'month' | string
  status?: string
  supplierId?: string
} = {}): Promise<MallSettlementRecord[]> {
  return apiGet('/api/admin/mall/finance/settlements', params)
}

export async function adminListMallWithdrawalRequests(params: {
  status?: string
  supplierId?: string
} = {}): Promise<MallWithdrawalRequest[]> {
  return apiGet('/api/admin/mall/finance/withdrawals', params)
}

export async function adminCreateMallWithdrawal(data: {
  requesterId?: string
  requesterRole?: string
  supplierId?: string
  amountCents: number
  bankAccountSnapshot?: Record<string, unknown>
  note?: string
}): Promise<MallWithdrawalRequest> {
  return apiPost('/api/admin/mall/finance/withdrawals', data)
}

export async function adminGetMallSalesStats(params: {
  period?: 'day' | 'week' | 'month' | string
  startDate?: string
  endDate?: string
} = {}): Promise<MallSalesStats> {
  return apiGet('/api/admin/mall/stats/sales', params)
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

export async function updateMallProfile(data: UpdateMallProfileInput): Promise<MallProfile['member']> {
  return apiPut('/api/mall/me/profile', data)
}

export async function listMallCoupons(userId: string, params: {
  status?: MallCouponWalletStatus | string
  couponType?: string
} = {}): Promise<MallCouponWallet> {
  return apiGet('/api/mall/coupons', { userId, ...params })
}

export async function claimMallCoupon(userId: string, couponId: string): Promise<MallCoupon> {
  return apiPost(`/api/mall/coupons/${couponId}/claim`, { userId })
}

export async function getMallPointsMall(userId: string): Promise<MallPointsMall> {
  return apiGet('/api/mall/points-mall', { userId })
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

export async function listNotifications(userId: string, options?: {
  page?: number
  limit?: number
  unreadOnly?: boolean
}): Promise<MallNotification[]> {
  return apiGet('/api/notifications', {
    user_id: userId,
    page: options?.page,
    limit: options?.limit,
    unread_only: options?.unreadOnly ? 'true' : undefined,
  })
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const result = await apiGet<{ unreadCount?: number }>('/api/notifications/unread-count', { user_id: userId })
  return Number(result.unreadCount || 0)
}

export async function markNotificationRead(userId: string, notificationId: string): Promise<MallNotification> {
  return apiPut(`/api/notifications/${notificationId}/mark-read`, { user_id: userId })
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await apiPut('/api/notifications/mark-all-read', { user_id: userId })
}

export async function listSupportSessions(userId: string): Promise<SupportSession[]> {
  return apiGet('/api/support/sessions', { userId })
}

export async function createSupportSession(data: {
  userId: string
  channel: string
  topic: string
}): Promise<SupportSession> {
  return apiPost('/api/support/sessions', data)
}

export async function listSupportMessages(sessionId: string, userId: string): Promise<SupportMessage[]> {
  return apiGet(`/api/support/sessions/${sessionId}/messages`, { userId })
}

export async function uploadSupportEvidence(
  sessionId: string,
  userId: string,
  filePath: string,
): Promise<{ fileKey: string; url: string }> {
  const upload = await Network.uploadFile({
    url: `/api/support/sessions/${encodeURIComponent(sessionId)}/evidence?userId=${encodeURIComponent(userId)}`,
    filePath,
    name: 'file',
  })
  if (upload.statusCode < 200 || upload.statusCode >= 300) {
    throw new Error(`凭证上传失败（${upload.statusCode}）`)
  }
  let payload: { code?: number; message?: string; data?: { fileKey?: string; url?: string } }
  try {
    payload = JSON.parse(String(upload.data || '{}'))
  } catch {
    throw new Error('凭证上传响应格式错误')
  }
  if (payload.code !== 200 || !payload.data?.url) {
    throw new Error(payload.message || '凭证上传失败')
  }
  return {
    fileKey: payload.data.fileKey || payload.data.url,
    url: payload.data.url,
  }
}

export async function createSupportMessage(sessionId: string, data: {
  senderId?: string
  senderRole: string
  content: string
  metadata?: Record<string, unknown>
}): Promise<SupportMessage> {
  return apiPost(`/api/support/sessions/${sessionId}/messages`, data)
}

export async function listSupportTickets(userId: string): Promise<SupportTicket[]> {
  return apiGet('/api/support/tickets', { userId })
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

export async function listSupportKnowledge(): Promise<SupportKnowledge[]> {
  return apiGet('/api/support/knowledge')
}

export async function listAdminSupportSessions(): Promise<SupportSession[]> {
  return apiGet('/api/admin/mall/support/sessions')
}

export async function listAdminSupportMessages(sessionId: string): Promise<SupportMessage[]> {
  return apiGet(`/api/admin/mall/support/sessions/${sessionId}/messages`)
}

export async function createAdminSupportMessage(sessionId: string, data: {
  senderId?: string
  senderRole: 'agent' | 'admin' | 'support' | 'operator'
  content: string
  metadata?: Record<string, unknown>
}): Promise<SupportMessage> {
  return apiPost(`/api/admin/mall/support/sessions/${sessionId}/messages`, data)
}

export async function listAdminSupportTickets(): Promise<SupportTicket[]> {
  return apiGet('/api/admin/mall/support/tickets')
}

export async function createAdminSupportTicket(data: {
  userId: string
  sessionId?: string
  orderId?: string
  category: string
  priority?: string
  title: string
  description?: string
}): Promise<SupportTicket> {
  return apiPost('/api/admin/mall/support/tickets', data)
}

export async function updateAdminSupportTicket(id: string, data: Partial<SupportTicket>) {
  return apiPut<SupportTicket>(`/api/admin/mall/support/tickets/${id}`, data)
}

export async function listAdminSupportKnowledge(): Promise<SupportKnowledge[]> {
  return apiGet('/api/admin/mall/support/knowledge')
}

export async function createAdminSupportKnowledge(data: {
  title: string
  category: string
  content: string
  status?: string
}): Promise<SupportKnowledge> {
  return apiPost('/api/admin/mall/support/knowledge', data)
}

export async function adminSupportMetrics(): Promise<Record<string, number>> {
  return apiGet('/api/admin/mall/support/metrics')
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

async function cachedApiGet<T>(
  url: string,
  data?: Record<string, unknown>,
  options: MallGetOptions = {},
): Promise<T> {
  const cacheKey = mallGetCacheKey(url, data)
  const now = Date.now()
  const ttlMs = options.ttlMs ?? MALL_GET_CACHE_TTL_MS
  const cached = mallGetCache.get(cacheKey)

  if (!options.fresh && cached && cached.expiresAt > now) {
    return cached.value as T
  }

  if (!options.fresh && options.preferCache && cached) {
    if (options.revalidate) {
      void cachedApiGet<T>(url, data, { ...options, fresh: true, preferCache: false }).catch(() => undefined)
    }
    return cached.value as T
  }

  const inFlight = mallGetInFlight.get(cacheKey)
  if (inFlight) return inFlight as Promise<T>

  const requestEpoch = mallGetCacheEpoch
  let request: Promise<T>
  request = apiGet<T>(url, data)
    .then((value) => {
      if (requestEpoch === mallGetCacheEpoch) {
        cacheMallGet(cacheKey, value, ttlMs)
      }
      return value
    })
    .finally(() => {
      if (mallGetInFlight.get(cacheKey) === request) {
        mallGetInFlight.delete(cacheKey)
      }
    })

  mallGetInFlight.set(cacheKey, request)
  return request
}

async function apiPost<T>(url: string, data: unknown): Promise<T> {
  const response = await Network.request({
    url,
    method: 'POST',
    header: { 'content-type': 'application/json' },
    data,
  })
  const value = unwrapApiData<T>(response.statusCode, response.data)
  clearMallGetCache()
  return value
}

async function apiPut<T>(url: string, data: unknown): Promise<T> {
  const response = await Network.request({
    url,
    method: 'PUT',
    header: { 'content-type': 'application/json' },
    data,
  })
  const value = unwrapApiData<T>(response.statusCode, response.data)
  clearMallGetCache()
  return value
}

async function apiDelete<T>(url: string): Promise<T> {
  const response = await Network.request({ url, method: 'DELETE' })
  const value = unwrapApiData<T>(response.statusCode, response.data)
  clearMallGetCache()
  return value
}

export function clearMallGetCache() {
  mallGetCacheEpoch += 1
  mallGetCache.clear()
  mallGetInFlight.clear()
}

function cacheMallGet(cacheKey: string, value: unknown, ttlMs: number) {
  if (mallGetCache.size >= MALL_GET_CACHE_MAX_ENTRIES) {
    const oldestKey = mallGetCache.keys().next().value
    if (oldestKey) mallGetCache.delete(oldestKey)
  }
  mallGetCache.set(cacheKey, {
    expiresAt: Date.now() + ttlMs,
    value,
  })
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

function mallGetCacheKey(url: string, data?: Record<string, unknown>) {
  const cleaned = cleanQueryData(data)
  if (!cleaned) return url
  return `${url}?${stableQueryString(cleaned)}`
}

function stableQueryString(data: Record<string, unknown>) {
  return Object.keys(data)
    .sort()
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(String(data[key]))}`)
    .join('&')
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
