import { useEffect, useState } from 'react'
import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { ChevronLeft, Headphones, MapPin, ReceiptText, ShoppingBasket, UserRound } from 'lucide-react-taro'
import { getMallOrder, listMallOrders, type MallOrder } from '@/services/mall'
import { MallPage, MallPrimaryButton, mallWeightText, mallYuan } from '../mall-ui'

interface StoredUser {
  id?: string
}

export default function MallOrderDetailPage() {
  const [order, setOrder] = useState<MallOrder | null>(null)
  const [error, setError] = useState('')
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
      setOrder(orders[0] || null)
      setError(orders.length ? '' : '暂无订单')
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '订单加载失败')
    }
  }

  if (!order) {
    return (
      <MallPage active="mine">
        <View className="mall-empty">
          <Text className="mall-empty-title">订单加载中...</Text>
          {error ? <Text className="mall-empty-copy">{error}</Text> : null}
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
          <Text className="mall-page-subtitle">来自我的订单 · 送货到家</Text>
        </View>
      </View>

      <View className="mall-detail-hero">
        <View className="mall-detail-basket">
          <ShoppingBasket size={34} color="#1F2D1F" />
          <Text>SY</Text>
        </View>
        <View className="mall-detail-copy">
          <Text className="mall-status-text">{order.paymentStatus === 'paid' ? '待配送' : '待付款'}</Text>
          <Text className="mall-detail-title">{order.expectedDeliveryWindow || '等待安排配送'}</Text>
          <Text className="mall-detail-meta">订单号 {order.orderNo}</Text>
        </View>
      </View>

      <View className="mall-stat-grid">
        <StatBox value={mallYuan(order.payableCents)} label="实付" />
        <StatBox value={`${order.items.reduce((sum, item) => sum + item.quantity, 0) || 1} 件`} label="商品" />
        <StatBox value={order.addressText || '待确认'} label="送货地址" />
      </View>

      <DetailRow
        icon={<ReceiptText size={21} color="#63BF54" />}
        title="商品清单"
        subtitle={order.items.map(orderItemText).join('、') || '暂无商品明细'}
      />
      {order.weightAdjustmentStatus && order.weightAdjustmentStatus !== 'none' ? (
        <DetailRow
          icon={<ReceiptText size={21} color="#63BF54" />}
          title="称重改价"
          subtitle={`${order.weightAdjustmentStatus === 'confirmed' ? '已确认' : '待称重'} · 差额 ${mallYuan(order.weightAdjustmentCents || 0)} · 预估 ${mallYuan(order.estimatedPayableCents || order.payableCents)} / 当前 ${mallYuan(order.payableCents)}`}
        />
      ) : null}
      <DetailRow
        icon={<MapPin size={21} color="#63BF54" />}
        title="配送信息"
        subtitle={`${order.expectedDeliveryWindow || '配送时间待确认'} · ${order.addressText || '地址待确认'}`}
      />
      <DetailRow
        icon={<UserRound size={21} color="#63BF54" />}
        title="收货人联系方式"
        subtitle={recipientText(order)}
      />
      <DetailRow
        icon={<ReceiptText size={21} color="#63BF54" />}
        title="支付明细"
        subtitle={`微信支付 · ${order.paymentStatus === 'paid' ? '已支付' : '待支付'} ${mallYuan(order.payableCents)}`}
      />

      <MallPrimaryButton onClick={() => contactDelivery(order)}>
        <Headphones size={18} color="#FFFFFF" />
        <Text style={{ marginLeft: 6 }}>联系配送客服</Text>
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

function orderItemText(item: MallOrder['items'][number]) {
  const variant = item.variantName ? `（${item.variantName}）` : ''
  if (item.pricingMode !== 'weighed') {
    return `${item.quantity}份${item.productName}${variant}`
  }
  const unitGrams = item.weightUnitGrams || 500
  const label = item.weightUnitLabel || '斤'
  const estimated = mallWeightText(item.estimatedWeightGrams, unitGrams, label)
  const actual = mallWeightText(item.actualWeightGrams, unitGrams, label)
  return `${item.productName}${variant} 预估${estimated || '-'}${actual ? ` / 实际${actual}` : ' / 待称重'}`
}

function recipientText(order: MallOrder) {
  const name = order.recipientName || '收货人待确认'
  const phone = order.recipientPhone
  return phone ? `${name} ${phone}` : name
}

function contactDelivery(order: MallOrder) {
  const phone = order.recipientPhone
  if (phone) {
    Taro.makePhoneCall({ phoneNumber: phone })
    return
  }
  Taro.navigateTo({ url: `/pages/mall/support/index?orderId=${order.id}` })
}
