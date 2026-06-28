import { useEffect, useMemo, useState } from 'react'
import { Image, Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { ChevronLeft, Headphones, Search } from 'lucide-react-taro'
import { Input } from '@/components/ui/input'
import {
  cancelMallOrder,
  listMyMallGroupBuySubscriptions,
  listMallOrders,
  resolveMallImageUrl,
  type MallGroupBuySubscription,
  type MallOrder,
} from '@/services/mall'
import { startOrderPayment } from '@/services/payment'
import { MallPage, MallPrimaryButton, mallYuan } from '../mall-ui'
import { redirectToMallAuth } from '../auth-route'

interface StoredUser {
  id?: string
}

type MallOrderTab = 'all' | 'pending_payment' | 'processing' | 'after_sale'

type MallOrderListItem =
  | { kind: 'order'; key: string; order: MallOrder }
  | { kind: 'group_buy'; key: string; subscription: MallGroupBuySubscription }

const filters: Array<{ key: MallOrderTab; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'pending_payment', label: '待支付' },
  { key: 'processing', label: '进行中' },
  { key: 'after_sale', label: '售后' },
]

export default function MallOrdersPage() {
  const [orders, setOrders] = useState<MallOrder[]>([])
  const [groupBuySubscriptions, setGroupBuySubscriptions] = useState<MallGroupBuySubscription[]>([])
  const [activeStatus, setActiveStatus] = useState<MallOrderTab>(() => initialOrderTab())
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [now, setNow] = useState(Date.now())
  const [payingOrderId, setPayingOrderId] = useState('')
  const [cancellingOrderId, setCancellingOrderId] = useState('')
  const userId = (Taro.getStorageSync('userInfo') as StoredUser | undefined)?.id || ''

  useDidShow(() => {
    loadOrders({ preferCache: true, revalidate: true })
  })

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const loadOrders = async ({
    preferCache = false,
    fresh = false,
    revalidate = false,
    silent = false,
  }: {
    preferCache?: boolean
    fresh?: boolean
    revalidate?: boolean
    silent?: boolean
  } = {}) => {
    if (!userId) {
      Taro.showToast({ title: '请先登录', icon: 'none' })
      redirectToMallAuth('/pages/mall/orders/index')
      return
    }
    if (!silent && orders.length === 0 && groupBuySubscriptions.length === 0) setLoading(true)
    try {
      const [nextOrders, nextGroupBuySubscriptions] = await Promise.all([
        listMallOrders(userId, undefined, { preferCache, fresh }),
        listMyMallGroupBuySubscriptions(userId, { preferCache, fresh }).catch(() => []),
      ])
      setOrders(nextOrders)
      setGroupBuySubscriptions(nextGroupBuySubscriptions)
      if (revalidate && !fresh) {
        void loadOrders({ fresh: true, silent: true })
      }
    } catch (error) {
      if (!orders.length) setOrders([])
      if (!groupBuySubscriptions.length) setGroupBuySubscriptions([])
      Taro.showToast({
        title: error instanceof Error ? error.message : '订单加载失败',
        icon: 'none',
      })
    } finally {
      setLoading(false)
    }
  }

  const orderItems = useMemo(
    () => mergeOrderItems(orders, groupBuySubscriptions),
    [groupBuySubscriptions, orders],
  )

  const orderTabCounts = useMemo(
    () => ({
      pending_payment: orderItems.filter((item) => orderItemMatchesTab(item, 'pending_payment')).length,
      processing: orderItems.filter((item) => orderItemMatchesTab(item, 'processing')).length,
      after_sale: orderItems.filter((item) => orderItemMatchesTab(item, 'after_sale')).length,
    }),
    [orderItems],
  )

  const visibleOrders = useMemo(
    () => orderItems.filter((item) => orderItemMatchesTab(item, activeStatus)).filter((item) => orderItemMatchesKeyword(item, keyword)),
    [activeStatus, keyword, orderItems],
  )

  const payOrder = async (order: MallOrder) => {
    if (payingOrderId) return
    setPayingOrderId(order.id)
    try {
      const payment = await startOrderPayment({ orderId: order.id, businessType: 'mall_order' })
      if (payment.paymentStatus !== 'paid' && payment.status !== 'paid') {
        throw new Error('支付结果未确认，请稍后在订单中查看')
      }
      Taro.redirectTo({ url: `/pages/mall/payment-success/index?orderId=${order.id}` })
    } catch (error) {
      Taro.showToast({
        title: error instanceof Error ? error.message : '支付未完成',
        icon: 'none',
      })
      await loadOrders({ fresh: true })
    } finally {
      setPayingOrderId('')
    }
  }

  const payGroupBuyBalance = async (subscription: MallGroupBuySubscription) => {
    if (payingOrderId) return
    setPayingOrderId(subscription.id)
    try {
      const payment = await startOrderPayment({
        orderId: subscription.id,
        businessType: 'mall_group_buy_balance',
        payerId: userId,
      })
      if (payment.paymentStatus !== 'paid' && payment.status !== 'paid') {
        throw new Error('支付结果未确认，请稍后在订单中查看')
      }
      Taro.showToast({ title: '尾款已支付', icon: 'success' })
      await loadOrders({ fresh: true })
    } catch (error) {
      Taro.showToast({
        title: error instanceof Error ? error.message : '支付未完成',
        icon: 'none',
      })
      await loadOrders({ fresh: true })
    } finally {
      setPayingOrderId('')
    }
  }

  const cancelOrder = async (order: MallOrder) => {
    if (cancellingOrderId) return
    const result = await Taro.showModal({
      title: '取消订单',
      content: '确认取消这个待支付订单吗？',
      confirmText: '取消订单',
      cancelText: '再想想',
      confirmColor: '#2F7E43',
    })
    if (!result.confirm) return
    setCancellingOrderId(order.id)
    try {
      await cancelMallOrder(order.id, userId, '用户取消订单')
      Taro.showToast({ title: '订单已取消', icon: 'success' })
      await loadOrders({ fresh: true })
    } catch (error) {
      Taro.showToast({
        title: error instanceof Error ? error.message : '取消失败',
        icon: 'none',
      })
    } finally {
      setCancellingOrderId('')
    }
  }

  return (
    <MallPage active="mine">
      <View className="mall-orders-topbar">
        <ChevronLeft size={25} color="#1F2D1F" onClick={() => Taro.navigateBack()} />
        <View className="mall-orders-search">
          <Search size={17} color="#A2A9A0" />
          <Input
            className="mall-orders-search-input"
            value={keyword}
            placeholder="搜索我的订单"
            confirmType="search"
            onInput={(event) => setKeyword(String(event.detail.value || ''))}
          />
        </View>
        <Text className="mall-orders-invoice" onClick={() => Taro.showToast({ title: '发票功能即将开放', icon: 'none' })}>
          开发票
        </Text>
      </View>

      <View className="mall-orders-tabs">
        {filters.map((filter) => (
          <View
            key={filter.key}
            className={activeStatus === filter.key ? 'mall-orders-tab mall-orders-tab-active' : 'mall-orders-tab'}
            onClick={() => setActiveStatus(filter.key)}
          >
            <Text>{filter.label}</Text>
            {filter.key !== 'all' && orderTabCounts[filter.key] > 0 ? (
              <Text className="mall-orders-tab-count">{orderTabCounts[filter.key]}</Text>
            ) : null}
          </View>
        ))}
      </View>

      <View className="mall-orders-notice">
        <Text>抢先了解优惠信息、订单动态</Text>
        <Text>提醒我</Text>
      </View>

      {visibleOrders.length === 0 ? (
        <View className="mall-empty">
          <Text className="mall-empty-title">{loading ? '加载中...' : '暂无订单'}</Text>
          <Text className="mall-empty-copy">下单后可在这里查看支付、配送和售后进度。</Text>
          <View style={{ marginTop: 14 }}>
            <MallPrimaryButton onClick={() => Taro.navigateTo({ url: '/pages/mall/index/index' })}>
              <Text>返回首页</Text>
            </MallPrimaryButton>
          </View>
        </View>
      ) : null}

      <View className="mall-orders-list">
        {visibleOrders.map((item) => (
          <OrderCard
            key={item.key}
            item={item}
            now={now}
            paying={payingOrderId === orderItemId(item)}
            cancelling={item.kind === 'order' && cancellingOrderId === item.order.id}
            onPay={() => item.kind === 'order' ? payOrder(item.order) : payGroupBuyBalance(item.subscription)}
            onCancel={() => item.kind === 'order' ? cancelOrder(item.order) : undefined}
          />
        ))}
      </View>
    </MallPage>
  )
}

function OrderCard({
  item,
  now,
  paying,
  cancelling,
  onPay,
  onCancel,
}: {
  item: MallOrderListItem
  now: number
  paying: boolean
  cancelling: boolean
  onPay: () => void
  onCancel: () => void
}) {
  const pending = isPendingPaymentItem(item)
  const countdown = pending ? paymentCountdownText(item, now) : ''
  const imageItems = orderItemImages(item)
  const itemCount = orderItemQuantity(item)
  const summaryAmount = orderItemPayableCents(item)
  const detailUrl = orderItemDetailUrl(item)
  const supportUrl = orderItemSupportUrl(item)

  return (
    <View className="mall-orders-card">
      <View className="mall-orders-card-head">
        <Text>{formatOrderTime(orderItemCreatedAt(item))}</Text>
        <View>
          <Text className="mall-orders-status">{statusText(item)}</Text>
          {countdown ? <Text className="mall-orders-substatus">{countdown}</Text> : null}
        </View>
      </View>

      <View className="mall-orders-images">
        {imageItems.map((imageItem) => {
          const imageUrl = resolveMallImageUrl(imageItem.imageUrl)
          return imageUrl ? (
            <Image key={imageItem.id} className="mall-orders-thumb" mode="aspectFill" src={imageUrl} />
          ) : (
            <View key={imageItem.id} className="mall-orders-thumb mall-orders-thumb-empty" />
          )
        })}
      </View>

      <View className="mall-orders-summary">
        <Text>共{itemCount || 1}件</Text>
        <Text>{item.kind === 'group_buy' && item.subscription.status === 'pending_balance' ? '待付尾款：' : '实付：'}</Text>
        <Text>{mallYuan(summaryAmount)}</Text>
      </View>

      <View className="mall-orders-actions">
        <Text onClick={() => Taro.navigateTo({ url: detailUrl })}>查看订单</Text>
        {pending ? <Text onClick={onPay}>{paying ? '支付中' : '立刻支付'}</Text> : null}
        {item.kind === 'order' && pending ? <Text onClick={onCancel}>{cancelling ? '取消中' : '取消订单'}</Text> : null}
        <Text onClick={() => Taro.navigateTo({ url: supportUrl })}>
          <Headphones size={14} color="#1F2D1F" />
          联系客服
        </Text>
      </View>
    </View>
  )
}

function mergeOrderItems(orders: MallOrder[], subscriptions: MallGroupBuySubscription[]): MallOrderListItem[] {
  const orderIds = new Set(orders.map((order) => order.id))
  const groupBuyItems = subscriptions
    .filter((subscription) => !subscription.mallOrderId || !orderIds.has(subscription.mallOrderId))
    .map(groupBuySubscriptionToOrderItem)
  return [
    ...orders.map((order): MallOrderListItem => ({ kind: 'order', key: `order:${order.id}`, order })),
    ...groupBuyItems,
  ].sort((left, right) => orderItemTime(right) - orderItemTime(left))
}

function groupBuySubscriptionToOrderItem(subscription: MallGroupBuySubscription): MallOrderListItem {
  return { kind: 'group_buy', key: `group_buy:${subscription.id}`, subscription }
}

function orderItemMatchesKeyword(item: MallOrderListItem, keyword: string) {
  const value = keyword.trim().toLowerCase()
  if (!value) return true
  const haystack = item.kind === 'order'
    ? [
      item.order.orderNo,
      item.order.addressText,
      ...item.order.items.map((orderItem) => `${orderItem.productName || ''} ${orderItem.variantName || ''}`),
    ]
    : [
      item.subscription.activity?.name,
      item.subscription.product?.name,
      item.subscription.product?.categoryName,
      item.subscription.status,
    ]
    .join(' ')
    .toLowerCase()
  return haystack.includes(value)
}

function orderItemMatchesTab(item: MallOrderListItem, tab: MallOrderTab) {
  if (tab === 'all') return true
  if (tab === 'pending_payment') return isPendingPaymentItem(item)
  if (tab === 'after_sale') return item.kind === 'order' && Boolean(item.order.afterSaleStatus || item.order.refundStatus || item.order.status.includes('after'))
  if (item.kind === 'group_buy') {
    return ['deposit_paid', 'balance_paid', 'order_created'].includes(item.subscription.status)
  }
  return item.order.paymentStatus === 'paid' && !isCancelled(item.order) && !isCompleted(item.order) && !orderItemMatchesTab(item, 'after_sale')
}

function isPendingPaymentItem(item: MallOrderListItem) {
  if (item.kind === 'group_buy') return item.subscription.status === 'pending_balance'
  return !isCancelled(item.order) && (item.order.paymentStatus !== 'paid' || item.order.status === 'pending_payment')
}

function isCancelled(order: MallOrder) {
  return order.status === 'cancelled' || order.paymentStatus === 'cancelled'
}

function isCompleted(order: MallOrder) {
  return order.status.includes('complete') || order.status.includes('finish')
}

function statusText(item: MallOrderListItem) {
  if (item.kind === 'group_buy') return groupBuyStatusText(item.subscription.status)
  const order = item.order
  if (isCancelled(order)) return '订单已取消'
  if (isPendingPaymentItem(item)) return '等待支付'
  if (orderItemMatchesTab(item, 'after_sale')) return '售后处理中'
  if (isCompleted(order)) return '商品已送达'
  if (order.status.includes('deliver') || order.status.includes('dispatch')) return '配送中'
  return '备货中'
}

function paymentCountdownText(item: MallOrderListItem, now: number) {
  const deadline = paymentDeadline(item)
  if (!deadline) return item.kind === 'group_buy' ? '请及时完成付款' : '10分钟未支付自动取消'
  const diff = deadline - now
  if (diff <= 0) return item.kind === 'group_buy' ? '尾款即将截止' : '即将自动取消'
  const minutes = Math.floor(diff / 60000)
  const seconds = Math.floor((diff % 60000) / 1000)
  return item.kind === 'group_buy' ? `${pad(minutes)}:${pad(seconds)} 后尾款截止` : `${pad(minutes)}:${pad(seconds)} 后自动取消`
}

function paymentDeadline(item: MallOrderListItem) {
  if (item.kind === 'group_buy') return parseDateValue(item.subscription.activity?.balanceDueAt)
  const expiresAt = item.order.paymentExpiresAt ? Date.parse(item.order.paymentExpiresAt) : NaN
  if (Number.isFinite(expiresAt)) return expiresAt
  const createdAt = item.order.createdAt ? Date.parse(item.order.createdAt) : NaN
  if (Number.isFinite(createdAt)) return createdAt + 10 * 60 * 1000
  return 0
}

function orderItemImages(item: MallOrderListItem) {
  if (item.kind === 'order') return item.order.items.slice(0, 6)
  const product = item.subscription.product
  return [{
    id: item.subscription.id,
    imageUrl: product?.imageUrl,
  }]
}

function orderItemQuantity(item: MallOrderListItem) {
  if (item.kind === 'group_buy') return Math.max(Number(item.subscription.quantity || 0), 1)
  return item.order.items.reduce((sum, orderItem) => sum + Math.max(Number(orderItem.quantity || 0), 0), 0)
}

function orderItemPayableCents(item: MallOrderListItem) {
  if (item.kind === 'order') return item.order.payableCents
  if (item.subscription.status === 'pending_balance') return Number(item.subscription.balanceCents || 0)
  if (item.subscription.status === 'pending_deposit') return Number(item.subscription.depositCents || 0)
  return Number(item.subscription.estimatedTotalCents || item.subscription.balanceCents || 0)
}

function orderItemDetailUrl(item: MallOrderListItem) {
  if (item.kind === 'order') return `/pages/mall/order-detail/index?id=${item.order.id}`
  if (item.subscription.mallOrderId) return `/pages/mall/order-detail/index?id=${item.subscription.mallOrderId}`
  return `/pages/mall/group-buy/detail?id=${encodeURIComponent(item.subscription.activityId)}`
}

function orderItemSupportUrl(item: MallOrderListItem) {
  if (item.kind === 'order') return `/pages/mall/support/index?orderId=${item.order.id}`
  if (item.subscription.mallOrderId) return `/pages/mall/support/index?orderId=${item.subscription.mallOrderId}`
  return `/pages/mall/support/index?topic=group_buy&subscriptionId=${encodeURIComponent(item.subscription.id)}`
}

function orderItemCreatedAt(item: MallOrderListItem) {
  return item.kind === 'order' ? item.order.createdAt : item.subscription.activity?.startsAt || item.subscription.activity?.endsAt || ''
}

function orderItemTime(item: MallOrderListItem) {
  return parseDateValue(orderItemCreatedAt(item))
}

function orderItemId(item: MallOrderListItem) {
  return item.kind === 'order' ? item.order.id : item.subscription.id
}

function groupBuyStatusText(status: string) {
  const statusMap: Record<string, string> = {
    pending_deposit: '待付定金',
    deposit_paid: '待成团',
    pending_balance: '待付尾款',
    balance_paid: '尾款已付',
    order_created: '已转订单',
    balance_overdue_cancelled: '尾款超时取消',
    deposit_refunded: '定金已退',
    refunded: '已退款',
  }
  return statusMap[status] || '集采进行中'
}

function initialOrderTab(): MallOrderTab {
  const tab = Taro.getCurrentInstance().router?.params?.tab
  return filters.some((filter) => filter.key === tab) ? tab as MallOrderTab : 'all'
}

function parseDateValue(value?: string | null) {
  if (!value) return 0
  const time = Date.parse(value)
  return Number.isFinite(time) ? time : 0
}

function formatOrderTime(value?: string) {
  const time = value ? new Date(value) : new Date()
  if (Number.isNaN(time.getTime())) return value || ''
  const year = time.getFullYear()
  const month = pad(time.getMonth() + 1)
  const day = pad(time.getDate())
  const hour = pad(time.getHours())
  const minute = pad(time.getMinutes())
  return `${year}-${month}-${day} ${hour}:${minute}`
}

function pad(value: number) {
  return String(value).padStart(2, '0')
}
