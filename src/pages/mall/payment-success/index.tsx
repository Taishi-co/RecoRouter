import { useEffect, useState } from 'react'
import { Image, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Check, PackageCheck, ReceiptText, ShoppingBasket, Truck } from 'lucide-react-taro'
import { getMallOrder, resolveMallImageUrl, type MallOrder } from '@/services/mall'
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
      <View className="mall-card mall-payment-success-hero">
        <View className="mall-success-icon">
          <Check size={50} color="#63BF54" />
        </View>
        <Text className="mall-page-title">{order ? paymentStatusText(order) : error || '正在确认支付结果'}</Text>
        <Text className="mall-page-subtitle">
          {order ? groupStatusText(order) : '请稍后刷新订单状态'}
        </Text>
      </View>

      <View className="mall-card mall-payment-success-card">
        <SectionTitle icon={<Truck size={18} color="#63BF54" />} title="配送安排" />
        <InfoRow label="配送状态" value={order?.status ? deliveryStatusText(order) : '待确认'} />
        <InfoRow label="当前状态" value={order?.status ? deliveryStatusText(order) : '待确认'} />
        <InfoRow label="送达时间" value={order?.expectedDeliveryWindow || '配送时间待确认'} />
        <InfoRow label="收货地址" value={order?.addressText || '收货地址待确认'} />
      </View>

      <View className="mall-card mall-payment-success-card">
        <SectionTitle icon={<ShoppingBasket size={18} color="#63BF54" />} title="商品摘要" />
        {order ? (
          <View className="mall-payment-success-products">
            {order.items.slice(0, 3).map((item) => {
              const imageUrl = resolveMallImageUrl(item.imageUrl)
              return imageUrl ? (
                <Image key={item.id} className="mall-payment-success-thumb" mode="aspectFill" src={imageUrl} />
              ) : (
                <View key={item.id} className="mall-payment-success-thumb mall-payment-success-thumb-empty" />
              )
            })}
            <View className="mall-payment-success-summary">
              <Text className="mall-product-name">{productSummaryText(order)}</Text>
              <Text className="mall-page-subtitle">订单号 {order.orderNo}</Text>
            </View>
          </View>
        ) : (
          <Text className="mall-page-subtitle">订单读取后展示商品和金额。</Text>
        )}
      </View>

      <View className="mall-card mall-payment-success-card">
        <SectionTitle icon={<ReceiptText size={18} color="#63BF54" />} title="后续服务" />
        <View className="mall-payment-success-flow">
          <FlowStep icon={<Check size={16} color="#63BF54" />} title="支付完成" subtitle="支付结果已提交到订单" active />
          <FlowStep icon={<PackageCheck size={16} color="#63BF54" />} title="商家备货" subtitle="商品会按订单明细备货称重" active={Boolean(order)} />
          <FlowStep icon={<Truck size={16} color="#63BF54" />} title="配送到家" subtitle="配送进度可在订单详情查看" active={Boolean(order && deliveryStatusText(order) === '配送中')} />
        </View>
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

function SectionTitle({ icon, title }: { icon: JSX.Element; title: string }) {
  return (
    <View className="mall-order-section-title">
      <View className="mall-order-section-heading">
        {icon}
        <Text>{title}</Text>
      </View>
    </View>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="mall-order-info-row">
      <Text className="mall-summary-label">{label}</Text>
      <Text className="mall-summary-value">{value}</Text>
    </View>
  )
}

function FlowStep({ icon, title, subtitle, active }: { icon: JSX.Element; title: string; subtitle: string; active?: boolean }) {
  return (
    <View className={active ? 'mall-payment-success-step mall-payment-success-step-active' : 'mall-payment-success-step'}>
      <View className="mall-payment-success-step-icon">{icon}</View>
      <View>
        <Text className="mall-order-service-title">{title}</Text>
        <Text className="mall-order-service-copy">{subtitle}</Text>
      </View>
    </View>
  )
}

function paymentStatusText(order: MallOrder) {
  if (order.paymentStatus === 'paid') return '支付成功'
  if (order.paymentStatus === 'pending') return '支付确认中'
  return '订单支付状态待确认'
}

function productSummaryText(order: MallOrder) {
  const firstItem = order.items[0]
  const count = order.items.reduce((sum, item) => sum + Math.max(Number(item.quantity || 0), 0), 0)
  if (!firstItem) return `商品已锁定，应付 ${mallYuan(order.payableCents)}`
  const more = order.items.length > 1 ? ` 等 ${count || order.items.length} 件` : ` x${firstItem.quantity || 1}`
  return `${firstItem.productName}${more}，实付 ${mallYuan(order.payableCents)}`
}

function groupStatusText(order: MallOrder) {
  const count = order.items.reduce((sum, item) => sum + Math.max(Number(item.quantity || 0), 0), 0)
  return `实付 ${mallYuan(order.payableCents)} · ${count || order.items.length || 1} 件商品`
}

function deliveryStatusText(order: MallOrder) {
  if (order.status.includes('deliver') || order.status.includes('dispatch')) return '配送中'
  if (order.status.includes('complete') || order.status.includes('finish')) return '已完成'
  if (order.afterSaleStatus || order.refundStatus || order.status.includes('after')) return '售后中'
  if (order.paymentStatus === 'paid') return '待配送'
  return '待确认'
}
