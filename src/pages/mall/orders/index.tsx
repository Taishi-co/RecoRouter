import { useMemo, useState } from 'react'
import { Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { ClipboardList, Headphones, Truck } from 'lucide-react-taro'
import { listMallOrders, type MallOrder } from '@/services/mall'
import { MallPage, MallPrimaryButton, mallYuan } from '../mall-ui'
import { redirectToMallAuth } from '../auth-route'

interface StoredUser {
  id?: string
}

type MallOrderTab = 'pending_payment' | 'pending_delivery' | 'pending_receipt' | 'after_sale'

const filters: Array<{ key: MallOrderTab; label: string }> = [
  { key: 'pending_payment', label: '待支付' },
  { key: 'pending_delivery', label: '待配送' },
  { key: 'pending_receipt', label: '待收货' },
  { key: 'after_sale', label: '售后' },
]

export default function MallOrdersPage() {
  const [orders, setOrders] = useState<MallOrder[]>([])
  const [activeStatus, setActiveStatus] = useState<MallOrderTab>('pending_payment')
  const [loading, setLoading] = useState(false)
  const userId = (Taro.getStorageSync('userInfo') as StoredUser | undefined)?.id || ''

  useDidShow(() => {
    loadOrders()
  })

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
      const activeHasOrders = nextOrders.some((order) => orderMatchesTab(order, activeStatus))
      if (!activeHasOrders) {
        const firstNonEmpty = filters.find((filter) => nextOrders.some((order) => orderMatchesTab(order, filter.key)))
        if (firstNonEmpty) {
          setActiveStatus(firstNonEmpty.key)
        }
      }
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
    () => orders.filter((order) => orderMatchesTab(order, activeStatus)),
    [activeStatus, orders],
  )
  const tabCounts = useMemo(
    () => filters.reduce<Record<MallOrderTab, number>>((acc, filter) => {
      acc[filter.key] = orders.filter((order) => orderMatchesTab(order, filter.key)).length
      return acc
    }, {
      pending_payment: 0,
      pending_delivery: 0,
      pending_receipt: 0,
      after_sale: 0,
    }),
    [orders],
  )

  return (
    <MallPage active="mine">
      <Text className="mall-breadcrumb">我的 / 我的订单</Text>
      <Text className="mall-page-title">订单中心</Text>

      <View className="mall-order-banner">
        <View className="mall-link-icon">
          <ClipboardList size={22} color="#2F7E43" />
        </View>
        <View>
          <Text className="mall-order-banner-title">待收货 {tabCounts.pending_receipt} 单</Text>
          <Text className="mall-order-banner-copy">配送员接单后会按收货地址送达</Text>
        </View>
      </View>

      <View className="mall-v7-order-tabs">
        {filters.map((filter) => (
          <View
            key={filter.key}
            className={activeStatus === filter.key ? 'mall-v7-order-tab mall-v7-order-tab-active' : 'mall-v7-order-tab'}
            onClick={() => setActiveStatus(filter.key)}
          >
            <Text>{filter.label}</Text>
            <Text>{tabCounts[filter.key]}</Text>
          </View>
        ))}
      </View>

      {visibleOrders.length === 0 ? (
        <View className="mall-empty">
          <Text className="mall-empty-title">{loading ? '加载中...' : '暂无订单'}</Text>
          <Text className="mall-empty-copy">完成下单后会在这里查看配送进度、售后和积分到账。</Text>
          <View style={{ marginTop: 14 }}>
            <MallPrimaryButton onClick={() => Taro.navigateTo({ url: '/pages/mall/index/index' })}>
              <Text>返回首页</Text>
            </MallPrimaryButton>
          </View>
        </View>
      ) : null}

      {visibleOrders.map((order) => (
        <View key={order.id} className="mall-order-card">
          <View className="mall-list-row" style={{ marginTop: 0 }}>
            <Text className="mall-status-pill">{statusText(order)}</Text>
            <Text
              className="mall-section-action"
              onClick={() => Taro.navigateTo({ url: `/pages/mall/order-detail/index?id=${order.id}` })}
            >
              订单详情
            </Text>
          </View>
          <View className="mall-v7-order-main">
            <View className="mall-link-icon">
              <ClipboardList size={22} color="#2F7E43" />
            </View>
            <View>
              <Text className="mall-v7-product-name">{order.items[0]?.productName || order.orderNo}</Text>
              <Text className="mall-v7-product-subtitle">
                {order.items.length || 1} 件商品{order.items[0]?.variantName ? ` · ${order.items[0]?.variantName}` : ''} · {order.addressText || '收货地址待确认'}
              </Text>
            </View>
            <Text className="mall-summary-value">{mallYuan(order.payableCents)}</Text>
          </View>

          {activeStatus === 'pending_receipt' ? (
            <View className="mall-v7-pickup-code">
              <View>
                <Truck size={18} color="#2F7E43" />
                <Text>配送状态 {deliveryStatusText(order)}</Text>
              </View>
              <View>
                <ClipboardList size={18} color="#2F7E43" />
                <Text>预计送达 {order.expectedDeliveryWindow || '时间待确认'}</Text>
              </View>
              <View>
                <Headphones size={18} color="#2F7E43" />
                <Text>{order.addressText || '收货地址待确认'}</Text>
              </View>
            </View>
          ) : null}

          {isCompleted(order) ? (
            <View className="mall-v7-order-actions">
              <Text onClick={() => Taro.navigateTo({ url: `/pages/mall/after-sale/index?orderId=${order.id}` })}>申请售后</Text>
              <Text onClick={() => Taro.navigateTo({ url: `/pages/mall/support/index?orderId=${order.id}` })}>评价</Text>
              <Text>积分到账 {Math.floor((order.payableCents || 0) / 100)} 分</Text>
            </View>
          ) : (
            <View className="mall-v7-order-actions">
              <Text onClick={() => Taro.navigateTo({ url: `/pages/mall/support/index?orderId=${order.id}` })}>
                <Headphones size={15} color="#2F7E43" />
                联系配送客服
              </Text>
            </View>
          )}
        </View>
      ))}
    </MallPage>
  )
}

function orderMatchesTab(order: MallOrder, tab: MallOrderTab) {
  if (tab === 'pending_payment') return order.paymentStatus !== 'paid' || order.status === 'pending_payment'
  if (tab === 'after_sale') return Boolean(order.afterSaleStatus || order.refundStatus || order.status.includes('after'))
  if (tab === 'pending_receipt') {
    return order.paymentStatus === 'paid'
      && ['ready_for_pickup', 'pending_pickup', 'delivering', 'dispatched'].some((status) => order.status.includes(status))
  }
  return order.paymentStatus === 'paid'
    && !isCompleted(order)
    && !orderMatchesTab(order, 'pending_receipt')
    && !orderMatchesTab(order, 'after_sale')
}

function isCompleted(order: MallOrder) {
  return order.status.includes('complete') || order.status.includes('finish')
}

function statusText(order: MallOrder) {
  if (order.paymentStatus !== 'paid') return '待支付'
  if (orderMatchesTab(order, 'after_sale')) return '售后'
  if (orderMatchesTab(order, 'pending_receipt')) return '待收货'
  if (isCompleted(order)) return '已完成'
  return '待配送'
}

function deliveryStatusText(order: MallOrder) {
  if (order.status.includes('delivering') || order.status.includes('dispatched')) return '配送中'
  if (order.status.includes('ready_for_pickup') || order.status.includes('pending_pickup')) return '待配送'
  return statusText(order)
}
