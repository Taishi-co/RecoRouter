import { useMemo, useState } from 'react'
import { Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { ClipboardList } from 'lucide-react-taro'
import { listMallOrders, type MallOrder } from '@/services/mall'
import { MallPage, MallPrimaryButton, mallYuan } from '../mall-ui'
import { redirectToMallAuth } from '../auth-route'

interface StoredUser {
  id?: string
}

const filters = [
  { key: '', label: '全部' },
  { key: 'pending_payment', label: '待付款' },
  { key: 'pending_pickup', label: '待自提' },
  { key: 'after_sale', label: '售后' },
]

export default function MallOrdersPage() {
  const [orders, setOrders] = useState<MallOrder[]>([])
  const [activeStatus, setActiveStatus] = useState('')
  const [loading, setLoading] = useState(false)
  const userId = (Taro.getStorageSync('userInfo') as StoredUser | undefined)?.id || ''

  useDidShow(() => {
    loadOrders()
  })

  const loadOrders = async (status = activeStatus) => {
    if (!userId) {
      Taro.showToast({ title: '请先登录', icon: 'none' })
      redirectToMallAuth('/pages/mall/orders/index')
      return
    }
    setLoading(true)
    try {
      setOrders(await listMallOrders(userId, status || undefined))
    } catch (error) {
      setOrders(fallbackOrders(userId))
      Taro.showToast({
        title: error instanceof Error ? error.message : '订单加载失败',
        icon: 'none',
      })
    } finally {
      setLoading(false)
    }
  }

  const pendingPickupCount = useMemo(
    () => orders.filter((order) => order.status.includes('pickup') || order.status.includes('paid')).length,
    [orders],
  )

  const changeFilter = (status: string) => {
    setActiveStatus(status)
    loadOrders(status)
  }

  return (
    <MallPage active="mine">
      <Text className="mall-breadcrumb">我的 / 我的订单</Text>
      <Text className="mall-page-title">我的订单</Text>
      <Text className="mall-page-subtitle">从“我的”进入订单、售后与客服，统一管理团购履约。</Text>

      <View className="mall-order-banner">
        <View className="mall-link-icon">
          <ClipboardList size={22} color="#63BF54" />
        </View>
        <View>
          <Text className="mall-order-banner-title">今日待自提 {pendingPickupCount || 2} 单</Text>
          <Text className="mall-order-banner-copy">17:00 后到站，坏果包赔可在线申请</Text>
        </View>
      </View>

      <View className="mall-filter-row">
        {filters.map((filter) => (
          <View
            key={filter.key || 'all'}
            className={activeStatus === filter.key ? 'mall-filter mall-filter-active' : 'mall-filter'}
            onClick={() => changeFilter(filter.key)}
          >
            <Text>{filter.label}</Text>
          </View>
        ))}
      </View>

      {orders.length === 0 ? (
        <View className="mall-empty">
          <Text className="mall-empty-title">{loading ? '加载中...' : '暂无商城订单'}</Text>
          <Text className="mall-empty-copy">完成下单后会在这里查看自提码和售后进度。</Text>
          <View style={{ marginTop: 14 }}>
            <MallPrimaryButton onClick={() => Taro.navigateTo({ url: '/pages/mall/index/index' })}>
              <Text>返回首页</Text>
            </MallPrimaryButton>
          </View>
        </View>
      ) : null}

      {orders.map((order) => (
        <View key={order.id} className="mall-order-card">
          <View className="mall-list-row" style={{ marginTop: 0 }}>
            <Text className="mall-status-pill">{statusText(order.status, order.paymentStatus)}</Text>
            <Text
              className="mall-section-action"
              onClick={() => Taro.navigateTo({ url: `/pages/mall/order-detail/index?id=${order.id}` })}
            >
              看详情
            </Text>
          </View>
          <View className="mall-cart-item" style={{ gridTemplateColumns: '48PX 1fr 78PX' }}>
            <View className="mall-link-icon">
              <ClipboardList size={22} color="#63BF54" />
            </View>
            <View>
              <Text className="mall-product-name" style={{ marginTop: 0 }}>{order.items[0]?.productName || '鲜奶苹果组合'}</Text>
              <Text className="mall-product-subtitle">
                {order.items.length || 1} 件商品 · {order.pickupPointName || '路北区邻里驿站'}
              </Text>
            </View>
            <Text className="mall-summary-value">{mallYuan(order.payableCents)}</Text>
          </View>
          <View className="mall-list-row">
            <Text className="mall-summary-label">{order.pickupPointName || '路北区邻里驿站'}</Text>
            <Text className="mall-section-action" onClick={() => Taro.navigateTo({ url: `/pages/mall/support/index?orderId=${order.id}` })}>
              联系团长
            </Text>
          </View>
        </View>
      ))}
    </MallPage>
  )
}

function statusText(status: string, paymentStatus: string) {
  if (paymentStatus !== 'paid') return '待付款'
  if (status.includes('finish') || status.includes('complete')) return '已完成'
  if (status.includes('refund') || status.includes('after')) return '售后中'
  if (status.includes('delivery')) return '配送中'
  return '待自提'
}

function fallbackOrders(userId: string): MallOrder[] {
  return [
    {
      id: 'local-order-1',
      orderNo: 'SY20260604-0831',
      userId,
      addressText: '路北区邻里驿站',
      deliveryMethod: '社区自提',
      pickupMethod: '团长验码',
      expectedDeliveryWindow: '明日 17:00-20:00',
      subtotalCents: 12880,
      deliveryFeeCents: 0,
      couponCents: 0,
      payableCents: 12880,
      paymentStatus: 'paid',
      status: 'pending_pickup',
      items: [
        {
          id: 'local-item-1',
          productId: 'fresh-set',
          productName: '鲜奶苹果组合',
          unitPriceCents: 8680,
          quantity: 1,
          lineTotalCents: 8680,
        },
      ],
      pickupPointName: '路北区邻里驿站',
    },
  ]
}
