import { useEffect, useState } from 'react'
import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Check } from 'lucide-react-taro'
import { getMallOrder, type MallOrder } from '@/services/mall'
import { MallPage, MallPrimaryButton, mallYuan } from '../mall-ui'

export default function MallPaymentSuccessPage() {
  const [order, setOrder] = useState<MallOrder | null>(null)

  useEffect(() => {
    loadOrder()
  }, [])

  const loadOrder = async () => {
    const orderId = String(Taro.getCurrentInstance().router?.params?.orderId || '')
    try {
      setOrder(orderId && !orderId.startsWith('local') ? await getMallOrder(orderId) : fallbackOrder())
    } catch {
      setOrder(fallbackOrder())
    }
  }

  return (
    <MallPage active="mine">
      <View className="mall-card" style={{ textAlign: 'center', paddingTop: 24, paddingBottom: 24 }}>
        <View className="mall-success-icon">
          <Check size={50} color="#63BF54" />
        </View>
        <Text className="mall-page-title">支付成功，拼团已成团</Text>
        <Text className="mall-page-subtitle">
          {order?.expectedDeliveryWindow || '明日 17:00'} 后到{order?.pickupPointName || '路北区邻里驿站'}自提
        </Text>
      </View>

      <View className="mall-card" style={{ textAlign: 'center' }}>
        <Text className="mall-page-subtitle">自提码</Text>
        <Text className="mall-code">{order?.fulfillmentCode?.code || order?.cabinCode || 'A739'}</Text>
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
        <Text className="mall-product-name">4 人团已完成，已锁定拼团价 {mallYuan(order?.payableCents || 12880)}</Text>
      </View>

      <View className="mall-action-row">
        <MallPrimaryButton subtle onClick={() => Taro.redirectTo({ url: '/pages/mall/index/index' })}>
          <Text>返回首页</Text>
        </MallPrimaryButton>
        <MallPrimaryButton onClick={() => Taro.redirectTo({ url: `/pages/mall/order-detail/index?id=${order?.id || 'local-order-1'}` })}>
          <Text>查看订单</Text>
        </MallPrimaryButton>
      </View>
    </MallPage>
  )
}

function fallbackOrder(): MallOrder {
  return {
    id: 'local-order-1',
    orderNo: 'SY20260604-0831',
    userId: 'local-user',
    addressText: '路北区邻里驿站',
    deliveryMethod: '社区自提',
    pickupMethod: '团长验码',
    expectedDeliveryWindow: '明日 17:00',
    subtotalCents: 12880,
    deliveryFeeCents: 0,
    couponCents: 0,
    payableCents: 12880,
    paymentStatus: 'paid',
    status: 'pending_pickup',
    pickupPointName: '路北区邻里驿站',
    cabinCode: 'A739',
    items: [],
  }
}
