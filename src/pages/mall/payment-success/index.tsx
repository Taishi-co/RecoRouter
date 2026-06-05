import { useEffect, useState } from 'react'
import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Check } from 'lucide-react-taro'
import { getMallOrder, type MallOrder } from '@/services/mall'
import { MallPage, MallPrimaryButton, mallYuan } from '../mall-ui'

export default function MallPaymentSuccessPage() {
  const [order, setOrder] = useState<MallOrder | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    loadOrder()
  }, [])

  const loadOrder = async () => {
    const orderId = String(Taro.getCurrentInstance().router?.params?.orderId || '')
    if (!orderId) {
      setError('订单参数缺失')
      return
    }
    try {
      setOrder(await getMallOrder(orderId))
      setError('')
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '订单状态加载失败')
    }
  }

  return (
    <MallPage active="mine">
      <View className="mall-card" style={{ textAlign: 'center', paddingTop: 24, paddingBottom: 24 }}>
        <View className="mall-success-icon">
          <Check size={50} color="#63BF54" />
        </View>
        <Text className="mall-page-title">{order ? paymentStatusText(order) : error || '正在确认支付结果'}</Text>
        <Text className="mall-page-subtitle">
          {order ? `${order.expectedDeliveryWindow || '待团长确认自提时间'} 到 ${order.pickupPointName || order.addressText} 自提` : '请稍后刷新订单状态'}
        </Text>
      </View>

      <View className="mall-card" style={{ textAlign: 'center' }}>
        <Text className="mall-page-subtitle">自提码</Text>
        <Text className="mall-code">{order?.fulfillmentCode?.code || order?.cabinCode || '待生成'}</Text>
        <Text className="mall-page-subtitle">{order?.fulfillmentCode ? '到点后向团长出示，支持截图保存' : '支付确认后由后端生成自提码'}</Text>
      </View>

      <View className="mall-card mall-card-soft">
        <View className="mall-avatar-row">
          {[order?.groupLeaderName || '团长', '我'].map((name) => (
            <View key={name} className={name === '我' ? 'mall-avatar mall-avatar-active' : 'mall-avatar'}>
              <Text>{name}</Text>
            </View>
          ))}
        </View>
        <Text className="mall-product-name">{groupStatusText(order)}</Text>
      </View>

      <View className="mall-action-row">
        <MallPrimaryButton subtle onClick={() => Taro.redirectTo({ url: '/pages/mall/index/index' })}>
          <Text>返回首页</Text>
        </MallPrimaryButton>
        <MallPrimaryButton onClick={() => order?.id && Taro.redirectTo({ url: `/pages/mall/order-detail/index?id=${order.id}` })}>
          <Text>查看订单</Text>
        </MallPrimaryButton>
      </View>
    </MallPage>
  )
}

function paymentStatusText(order: MallOrder) {
  if (order.paymentStatus === 'paid') return '支付成功，订单已提交'
  if (order.paymentStatus === 'pending') return '支付确认中'
  return '订单支付状态待确认'
}

function groupStatusText(order?: MallOrder | null) {
  if (!order) return '正在读取订单团购状态'
  const count = order.items.reduce((sum, item) => sum + item.quantity, 0)
  const leader = order.groupLeaderName ? `，团长 ${order.groupLeaderName} 将处理自提` : ''
  return `${count || 0} 件商品已锁定，应付 ${mallYuan(order.payableCents)}${leader}`
}
