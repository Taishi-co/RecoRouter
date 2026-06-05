import { useEffect, useState } from 'react'
import { Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { Check, ChevronLeft } from 'lucide-react-taro'
import {
  getMallOrder,
  getMallTracking,
  listMallOrders,
  type MallOrder,
  type MallOrderEvent,
} from '@/services/mall'
import { startOrderPayment } from '@/services/payment'
import {
  MallPage,
  MallPrimaryButton,
  mallYuan,
} from '../mall-ui'

interface StoredUser {
  id?: string
}

export default function MallOrdersPage() {
  const [orders, setOrders] = useState<MallOrder[]>([])
  const [selectedOrder, setSelectedOrder] = useState<MallOrder | null>(null)
  const [events, setEvents] = useState<MallOrderEvent[]>([])
  const [paying, setPaying] = useState(false)
  const userId = (Taro.getStorageSync('userInfo') as StoredUser | undefined)?.id || ''

  useEffect(() => {
    loadInitial()
  }, [])

  useDidShow(() => {
    loadInitial()
  })

  const loadInitial = async () => {
    if (!userId) {
      Taro.showToast({ title: '请先登录', icon: 'none' })
      Taro.redirectTo({ url: '/pages/index/index' })
      return
    }
    const orderId = Taro.getCurrentInstance().router?.params?.orderId
    try {
      const data = await listMallOrders(userId)
      setOrders(data)
      const target = orderId
        ? await getMallOrder(orderId)
        : data[0]
      if (target) {
        setSelectedOrder(target)
        const tracking = await getMallTracking(target.id)
        setEvents(tracking.events)
      }
    } catch (error) {
      showError(error, '订单加载失败')
    }
  }

  const payOrder = async () => {
    if (!selectedOrder) return
    setPaying(true)
    try {
      await startOrderPayment({
        orderId: selectedOrder.id,
        businessType: 'mall_order',
      })
      Taro.showToast({ title: '支付成功', icon: 'success' })
      const detail = await getMallOrder(selectedOrder.id)
      setSelectedOrder(detail)
    } catch (error) {
      showError(error, '支付失败')
    } finally {
      setPaying(false)
    }
  }

  const paid = selectedOrder?.paymentStatus === 'paid'

  return (
    <MallPage active="mine">
      <View className="mall-back-row">
        <ChevronLeft size={24} color="#1F2D1F" onClick={() => Taro.navigateBack()} />
        <Text className="mall-page-title">{paid ? '支付成功' : '确认订单'}</Text>
      </View>

      {!selectedOrder ? (
        <View className="mall-empty">
          <Text className="mall-empty-title">暂无商城订单</Text>
          <Text className="mall-empty-copy">完成下单后会在这里查看自提码。</Text>
          <View style={{ marginTop: 14 }}>
            <MallPrimaryButton onClick={() => Taro.navigateTo({ url: '/pages/mall/index/index' })}>
              <Text>返回首页</Text>
            </MallPrimaryButton>
          </View>
        </View>
      ) : paid ? (
        <SuccessOrder order={selectedOrder} />
      ) : (
        <ConfirmOrder order={selectedOrder} paying={paying} onPay={payOrder} />
      )}

      {events.length > 0 ? (
        <View className="mall-card">
          <Text className="mall-list-title">履约进度</Text>
          {events.slice(0, 3).map((event) => (
            <View key={event.id} className="mall-summary-row">
              <Text className="mall-summary-label">{event.title}</Text>
              <Text className="mall-summary-value">{event.status}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {orders.length > 1 ? (
        <View className="mall-card">
          <Text className="mall-list-title">近期订单</Text>
          {orders.slice(0, 3).map((order) => (
            <View
              key={order.id}
              className="mall-summary-row"
              onClick={() => setSelectedOrder(order)}
            >
              <Text className="mall-summary-label">{order.orderNo}</Text>
              <Text className="mall-summary-value">{mallYuan(order.payableCents)}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </MallPage>
  )
}

function ConfirmOrder({
  order,
  paying,
  onPay,
}: {
  order: MallOrder
  paying: boolean
  onPay: () => void
}) {
  return (
    <>
      <View className="mall-location mall-location-active">
        <View className="mall-hero-badge" style={{ marginTop: 0, background: '#EAF8E7', color: '#63BF54' }}>
          自提
        </View>
        <View className="mall-location-copy">
          <Text className="mall-location-title">{order.pickupPointName || '绿洲花园东门自提点'}</Text>
          <Text className="mall-location-subtitle">
            {order.expectedDeliveryWindow || '6月5日 16:00-20:30'} · {order.recipientName || '团长王姐'}
          </Text>
        </View>
      </View>

      <View className="mall-card">
        <Text className="mall-list-title">商品明细</Text>
        {order.items.map((item) => (
          <View key={item.id} className="mall-cart-item" style={{ gridTemplateColumns: '74px 1fr 58px' }}>
            <View className="mall-cart-thumb" />
            <View>
              <Text className="mall-product-name" style={{ marginTop: 0 }}>{item.productName}</Text>
              <Text className="mall-product-subtitle">称重后多退少补</Text>
              <Text className="mall-price">{mallYuan(item.unitPriceCents)}</Text>
            </View>
            <Text className="mall-stepper-value">x{item.quantity}</Text>
          </View>
        ))}
      </View>

      <View className="mall-card">
        <View className="mall-summary-row" style={{ marginTop: 0 }}>
          <Text className="mall-summary-label">商品小计</Text>
          <Text className="mall-summary-value">{mallYuan(order.subtotalCents)}</Text>
        </View>
        <View className="mall-summary-row">
          <Text className="mall-summary-label">团购优惠</Text>
          <Text className="mall-summary-value mall-summary-value-warm">-{mallYuan(order.couponCents)}</Text>
        </View>
        <View className="mall-summary-row">
          <Text className="mall-summary-label">自提服务费</Text>
          <Text className="mall-summary-value">{mallYuan(order.deliveryFeeCents)}</Text>
        </View>
      </View>

      <View className="mall-total-bar">
        <View>
          <Text className="mall-total-label">应付</Text>
          <Text className="mall-total-value">{mallYuan(order.payableCents)}</Text>
        </View>
        <View className="mall-total-button" style={{ background: '#63BF54' }} onClick={onPay}>
          <Text>{paying ? '支付中' : '微信支付'}</Text>
        </View>
      </View>
    </>
  )
}

function SuccessOrder({ order }: { order: MallOrder }) {
  return (
    <>
      <View className="mall-card" style={{ textAlign: 'center', paddingTop: 22, paddingBottom: 22 }}>
        <View className="mall-success-icon">
          <Check size={50} color="#63BF54" />
        </View>
        <Text className="mall-page-title">支付成功，拼团已成团</Text>
        <Text className="mall-page-subtitle">
          {order.expectedDeliveryWindow || '6月5日 16:00'} 后到{order.pickupPointName || '绿洲花园东门'}自提
        </Text>
      </View>

      <View className="mall-card" style={{ textAlign: 'center' }}>
        <Text className="mall-page-subtitle">自提码</Text>
        <Text className="mall-code">{order.fulfillmentCode?.code || order.cabinCode || 'A739'}</Text>
        <Text className="mall-page-subtitle">到点后向团长出示，支持截图保存</Text>
      </View>

      <View className="mall-card mall-card-soft">
        <View className="mall-avatar-row">
          {['王', '李', '陈', '你'].map((name) => (
            <View key={name} className={name === '你' ? 'mall-avatar mall-avatar-active' : 'mall-avatar'}>
              <Text>{name}</Text>
            </View>
          ))}
        </View>
        <Text className="mall-product-name">4 人团已完成，已锁定拼团价 {mallYuan(order.payableCents)}</Text>
      </View>

      <View className="mall-action-row">
        <MallPrimaryButton subtle onClick={() => Taro.navigateTo({ url: '/pages/mall/index/index' })}>
          <Text>返回首页</Text>
        </MallPrimaryButton>
        <MallPrimaryButton onClick={() => Taro.navigateTo({ url: '/pages/mall/orders/index' })}>
          <Text>查看订单</Text>
        </MallPrimaryButton>
      </View>
    </>
  )
}

function showError(error: unknown, fallback: string) {
  Taro.showToast({
    title: error instanceof Error ? error.message : fallback,
    icon: 'none',
  })
}
