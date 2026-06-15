import { useEffect, useMemo, useState } from 'react'
import { Image, Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { ChevronLeft, Headphones, Search } from 'lucide-react-taro'
import { Input } from '@/components/ui/input'
import {
  cancelMallOrder,
  listMallOrders,
  resolveMallImageUrl,
  type MallOrder,
} from '@/services/mall'
import { startOrderPayment } from '@/services/payment'
import { MallPage, MallPrimaryButton, mallYuan } from '../mall-ui'
import { redirectToMallAuth } from '../auth-route'

interface StoredUser {
  id?: string
}

type MallOrderTab = 'all' | 'pending_payment' | 'processing' | 'after_sale'

const filters: Array<{ key: MallOrderTab; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'pending_payment', label: '待支付' },
  { key: 'processing', label: '进行中' },
  { key: 'after_sale', label: '售后' },
]

export default function MallOrdersPage() {
  const [orders, setOrders] = useState<MallOrder[]>([])
  const [activeStatus, setActiveStatus] = useState<MallOrderTab>('all')
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [now, setNow] = useState(Date.now())
  const [payingOrderId, setPayingOrderId] = useState('')
  const [cancellingOrderId, setCancellingOrderId] = useState('')
  const userId = (Taro.getStorageSync('userInfo') as StoredUser | undefined)?.id || ''

  useDidShow(() => {
    loadOrders()
  })

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const loadOrders = async () => {
    if (!userId) {
      Taro.showToast({ title: '请先登录', icon: 'none' })
      redirectToMallAuth('/pages/mall/orders/index')
      return
    }
    setLoading(true)
    try {
      const nextOrders = await listMallOrders(userId)
      setOrders(nextOrders)
    } catch (error) {
      setOrders([])
      Taro.showToast({
        title: error instanceof Error ? error.message : '订单加载失败',
        icon: 'none',
      })
    } finally {
      setLoading(false)
    }
  }

  const visibleOrders = useMemo(
    () => orders.filter((order) => orderMatchesTab(order, activeStatus)).filter((order) => orderMatchesKeyword(order, keyword)),
    [activeStatus, keyword, orders],
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
      await loadOrders()
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
      await loadOrders()
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
        {visibleOrders.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            now={now}
            paying={payingOrderId === order.id}
            cancelling={cancellingOrderId === order.id}
            onPay={() => payOrder(order)}
            onCancel={() => cancelOrder(order)}
          />
        ))}
      </View>
    </MallPage>
  )
}

function OrderCard({
  order,
  now,
  paying,
  cancelling,
  onPay,
  onCancel,
}: {
  order: MallOrder
  now: number
  paying: boolean
  cancelling: boolean
  onPay: () => void
  onCancel: () => void
}) {
  const pending = isPendingPayment(order)
  const countdown = pending ? paymentCountdownText(order, now) : ''
  const itemCount = order.items.reduce((sum, item) => sum + Math.max(Number(item.quantity || 0), 0), 0)
  const imageItems = order.items.slice(0, 6)

  return (
    <View className="mall-orders-card">
      <View className="mall-orders-card-head">
        <Text>{formatOrderTime(order.createdAt)}</Text>
        <View>
          <Text className="mall-orders-status">{statusText(order)}</Text>
          {countdown ? <Text className="mall-orders-substatus">{countdown}</Text> : null}
        </View>
      </View>

      <View className="mall-orders-images">
        {imageItems.map((item) => {
          const imageUrl = resolveMallImageUrl(item.imageUrl)
          return imageUrl ? (
            <Image key={item.id} className="mall-orders-thumb" mode="aspectFill" src={imageUrl} />
          ) : (
            <View key={item.id} className="mall-orders-thumb mall-orders-thumb-empty" />
          )
        })}
      </View>

      <View className="mall-orders-summary">
        <Text>共{itemCount || order.items.length || 1}件</Text>
        <Text>实付：</Text>
        <Text>{mallYuan(order.payableCents)}</Text>
      </View>

      <View className="mall-orders-actions">
        <Text onClick={() => Taro.navigateTo({ url: `/pages/mall/order-detail/index?id=${order.id}` })}>查看订单</Text>
        {pending ? <Text onClick={onPay}>{paying ? '支付中' : '立刻支付'}</Text> : null}
        {pending ? <Text onClick={onCancel}>{cancelling ? '取消中' : '取消订单'}</Text> : null}
        <Text onClick={() => Taro.navigateTo({ url: `/pages/mall/support/index?orderId=${order.id}` })}>
          <Headphones size={14} color="#1F2D1F" />
          联系客服
        </Text>
      </View>
    </View>
  )
}

function orderMatchesKeyword(order: MallOrder, keyword: string) {
  const value = keyword.trim().toLowerCase()
  if (!value) return true
  const haystack = [
    order.orderNo,
    order.addressText,
    ...order.items.map((item) => `${item.productName || ''} ${item.variantName || ''}`),
  ]
    .join(' ')
    .toLowerCase()
  return haystack.includes(value)
}

function orderMatchesTab(order: MallOrder, tab: MallOrderTab) {
  if (tab === 'all') return true
  if (tab === 'pending_payment') return isPendingPayment(order)
  if (tab === 'after_sale') return Boolean(order.afterSaleStatus || order.refundStatus || order.status.includes('after'))
  return order.paymentStatus === 'paid' && !isCancelled(order) && !isCompleted(order) && !orderMatchesTab(order, 'after_sale')
}

function isPendingPayment(order: MallOrder) {
  return !isCancelled(order) && (order.paymentStatus !== 'paid' || order.status === 'pending_payment')
}

function isCancelled(order: MallOrder) {
  return order.status === 'cancelled' || order.paymentStatus === 'cancelled'
}

function isCompleted(order: MallOrder) {
  return order.status.includes('complete') || order.status.includes('finish')
}

function statusText(order: MallOrder) {
  if (isCancelled(order)) return '订单已取消'
  if (isPendingPayment(order)) return '等待支付'
  if (orderMatchesTab(order, 'after_sale')) return '售后处理中'
  if (isCompleted(order)) return '商品已送达'
  if (order.status.includes('deliver') || order.status.includes('dispatch')) return '配送中'
  return '备货中'
}

function paymentCountdownText(order: MallOrder, now: number) {
  const deadline = paymentDeadline(order)
  if (!deadline) return '10分钟未支付自动取消'
  const diff = deadline - now
  if (diff <= 0) return '即将自动取消'
  const minutes = Math.floor(diff / 60000)
  const seconds = Math.floor((diff % 60000) / 1000)
  return `${pad(minutes)}:${pad(seconds)} 后自动取消`
}

function paymentDeadline(order: MallOrder) {
  const expiresAt = order.paymentExpiresAt ? Date.parse(order.paymentExpiresAt) : NaN
  if (Number.isFinite(expiresAt)) return expiresAt
  const createdAt = order.createdAt ? Date.parse(order.createdAt) : NaN
  if (Number.isFinite(createdAt)) return createdAt + 10 * 60 * 1000
  return 0
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
