import { useEffect, useState } from 'react'
import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { ChevronLeft, Headphones, MapPin, ReceiptText, ShoppingBasket, UserRound } from 'lucide-react-taro'
import { getMallOrder, listMallOrders, type MallOrder } from '@/services/mall'
import { MallPage, MallPrimaryButton, mallYuan } from '../mall-ui'

interface StoredUser {
  id?: string
}

export default function MallOrderDetailPage() {
  const [order, setOrder] = useState<MallOrder | null>(null)
  const userId = (Taro.getStorageSync('userInfo') as StoredUser | undefined)?.id || ''

  useEffect(() => {
    loadOrder()
  }, [])

  const loadOrder = async () => {
    const id = Taro.getCurrentInstance().router?.params?.id
    try {
      if (id) {
        setOrder(await getMallOrder(String(id)))
        return
      }
      const orders = userId ? await listMallOrders(userId) : []
      setOrder(orders[0] || fallbackOrder(userId))
    } catch {
      setOrder(fallbackOrder(userId))
    }
  }

  if (!order) {
    return (
      <MallPage active="mine">
        <View className="mall-empty">
          <Text className="mall-empty-title">订单加载中...</Text>
        </View>
      </MallPage>
    )
  }

  return (
    <MallPage active="mine">
      <View className="mall-back-row">
        <ChevronLeft size={24} color="#1F2D1F" onClick={() => Taro.navigateBack()} />
        <View>
          <Text className="mall-breadcrumb">我的 / 订单详情</Text>
          <Text className="mall-page-title">订单详情</Text>
          <Text className="mall-page-subtitle">来自我的订单 · 社区团购自提</Text>
        </View>
      </View>

      <View className="mall-detail-hero">
        <View className="mall-detail-basket">
          <ShoppingBasket size={34} color="#1F2D1F" />
          <Text>SY</Text>
        </View>
        <View className="mall-detail-copy">
          <Text className="mall-status-text">{order.paymentStatus === 'paid' ? '待自提' : '待付款'}</Text>
          <Text className="mall-detail-title">{order.expectedDeliveryWindow || '明日 17:00-20:00 可取'}</Text>
          <Text className="mall-detail-meta">订单号 {order.orderNo}</Text>
        </View>
      </View>

      <View className="mall-stat-grid">
        <StatBox value={mallYuan(order.payableCents)} label="实付" />
        <StatBox value={`${order.items.reduce((sum, item) => sum + item.quantity, 0) || 1} 件`} label="商品" />
        <StatBox value={order.pickupPointName || '路北'} label="自提点" />
      </View>

      <DetailRow
        icon={<ReceiptText size={21} color="#63BF54" />}
        title="商品清单"
        subtitle={order.items.map((item) => `${item.quantity}份${item.productName}`).join('、') || '2 份有机草莓、1份鲜切南瓜'}
      />
      <DetailRow
        icon={<MapPin size={21} color="#63BF54" />}
        title="自提点信息"
        subtitle={`${order.pickupPointName || '路北区邻里驿站'} · ${order.addressText || '1.2km'}`}
      />
      <DetailRow
        icon={<UserRound size={21} color="#63BF54" />}
        title="团长联系方式"
        subtitle={order.recipientPhone ? `${order.recipientName || '团长'} ${order.recipientPhone}` : '王团长 138****6732'}
      />
      <DetailRow
        icon={<ReceiptText size={21} color="#63BF54" />}
        title="支付明细"
        subtitle={`微信支付 · ${order.paymentStatus === 'paid' ? '已支付' : '待支付'} ${mallYuan(order.payableCents)}`}
      />

      <MallPrimaryButton onClick={() => Taro.navigateTo({ url: `/pages/mall/support/index?orderId=${order.id}` })}>
        <Headphones size={18} color="#FFFFFF" />
        <Text style={{ marginLeft: 6 }}>联系团长处理订单问题</Text>
      </MallPrimaryButton>
      <View style={{ marginTop: 10 }}>
        <MallPrimaryButton subtle onClick={() => Taro.navigateTo({ url: `/pages/mall/after-sale/index?orderId=${order.id}` })}>
          <Text>申请售后</Text>
        </MallPrimaryButton>
      </View>
    </MallPage>
  )
}

function DetailRow({ icon, title, subtitle }: { icon: JSX.Element; title: string; subtitle: string }) {
  return (
    <View className="mall-link-card">
      <View className="mall-link-icon">{icon}</View>
      <View className="mall-link-copy">
        <Text className="mall-link-title">{title}</Text>
        <Text className="mall-link-subtitle">{subtitle}</Text>
      </View>
      <Text className="mall-summary-value">›</Text>
    </View>
  )
}

function StatBox({ value, label }: { value: string; label: string }) {
  return (
    <View className="mall-stat-box">
      <Text className="mall-stat-box-value">{value}</Text>
      <Text className="mall-stat-label">{label}</Text>
    </View>
  )
}

function fallbackOrder(userId: string): MallOrder {
  return {
    id: 'local-order-1',
    orderNo: 'SY20260604-0831',
    userId,
    addressText: '路北区邻里驿站 · 1.2km',
    deliveryMethod: '社区自提',
    pickupMethod: '团长验码',
    expectedDeliveryWindow: '明日 17:00-20:00 可取',
    subtotalCents: 12880,
    deliveryFeeCents: 0,
    couponCents: 0,
    payableCents: 12880,
    paymentStatus: 'paid',
    status: 'pending_pickup',
    pickupPointName: '路北区邻里驿站',
    items: [
      {
        id: 'item-local',
        productId: 'sku-local',
        productName: '有机草莓',
        unitPriceCents: 6440,
        quantity: 2,
        lineTotalCents: 12880,
      },
    ],
  }
}
