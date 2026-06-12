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
          {order ? `${order.expectedDeliveryWindow || '明日 17:00-20:00'} 送达 ${order.addressText || '收货地址'}` : '请稍后刷新订单状态'}
        </Text>
      </View>

      <View className="mall-card" style={{ textAlign: 'center' }}>
        <Text className="mall-page-subtitle">配送状态</Text>
        <Text className="mall-code">{order?.status ? deliveryStatusText(order.status) : '待确认'}</Text>
        <Text className="mall-page-subtitle">我们会按收货地址安排配送，状态可在订单详情查看。</Text>
      </View>

      <View className="mall-card mall-card-soft">
        <View className="mall-avatar-row">
          {['配送员', '我'].map((name) => (
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
  if (!order) return '正在读取订单状态'
  const count = order.items.reduce((sum, item) => sum + item.quantity, 0)
  return `${count || 0} 件商品已锁定，应付 ${mallYuan(order.payableCents)}，等待配送`
}

function deliveryStatusText(status: string) {
  if (status.includes('deliver')) return '配送中'
  if (status.includes('complete') || status.includes('finish')) return '已完成'
  return '待配送'
}
