import { useEffect, useState } from 'react'
import { Image, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import {
  ChevronLeft,
  Clock3,
  Headphones,
  MapPin,
  PackageCheck,
  ReceiptText,
  ShieldCheck,
  ShoppingBasket,
  Truck,
  WalletCards,
} from 'lucide-react-taro'
import { getMallOrder, listMallOrders, resolveMallImageUrl, type MallOrder } from '@/services/mall'
import { startOrderPayment } from '@/services/payment'
import { MallPage, MallPrimaryButton, mallWeightText, mallYuan } from '../mall-ui'

interface StoredUser {
  id?: string
}

export default function MallOrderDetailPage() {
  const [order, setOrder] = useState<MallOrder | null>(null)
  const [error, setError] = useState('')
  const [paying, setPaying] = useState(false)
  const userId = (Taro.getStorageSync('userInfo') as StoredUser | undefined)?.id || ''

  useEffect(() => {
    loadOrder()
  }, [])

  const loadOrder = async () => {
    const id = Taro.getCurrentInstance().router?.params?.id
    try {
      if (id) {
        setOrder(await getMallOrder(String(id)))
        setError('')
        return
      }
      const orders = userId ? await listMallOrders(userId) : []
      setOrder(orders[0] || null)
      setError(orders.length ? '' : '暂无订单')
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '订单加载失败')
    }
  }

  const payOrder = async () => {
    if (!order || paying) return
    setPaying(true)
    try {
      const payment = await startOrderPayment({ orderId: order.id, businessType: 'mall_order' })
      if (payment.paymentStatus !== 'paid' && payment.status !== 'paid') {
        throw new Error('支付结果未确认，请稍后在订单中查看')
      }
      Taro.redirectTo({ url: `/pages/mall/payment-success/index?orderId=${order.id}` })
    } catch (payError) {
      Taro.showToast({
        title: payError instanceof Error ? payError.message : '支付未完成',
        icon: 'none',
      })
      await loadOrder()
    } finally {
      setPaying(false)
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

  const status = orderStatus(order)
  const pendingPayment = isPendingPayment(order)

  return (
    <MallPage active="mine">
      <View className="mall-back-row">
        <ChevronLeft size={24} color="#1F2D1F" onClick={() => Taro.navigateBack()} />
        <View>
          <Text className="mall-breadcrumb">我的 / 订单详情</Text>
          <Text className="mall-page-title">订单详情</Text>
          <Text className="mall-page-subtitle">订单号 {order.orderNo}</Text>
        </View>
      </View>

      <View className="mall-order-status-hero">
        <View className="mall-order-status-icon">{status.icon}</View>
        <View className="mall-order-status-copy">
          <Text className="mall-order-status-label">{status.label}</Text>
          <Text className="mall-order-status-title">{status.title}</Text>
          <Text className="mall-order-status-subtitle">{status.subtitle}</Text>
          {pendingPayment ? <Text className="mall-order-status-countdown">{paymentExpireText(order)}</Text> : null}
        </View>
      </View>

      <View className="mall-card mall-order-delivery-card">
        <SectionTitle icon={<MapPin size={18} color="#63BF54" />} title="配送信息" />
        <InfoRow label="收货人" value={recipientText(order)} />
        <InfoRow label="收货地址" value={order.addressText || '地址待确认'} />
        <InfoRow label="送达时间" value={order.expectedDeliveryWindow || '配送时间待确认'} />
        <InfoRow label="配送方式" value={deliveryMethodText(order)} />
      </View>

      <View className="mall-card mall-order-products-card">
        <SectionTitle
          icon={<ShoppingBasket size={18} color="#63BF54" />}
          title="商品信息"
          action={`共 ${itemCount(order)} 件`}
        />
        {order.items.map((item) => (
          <View key={item.id} className="mall-order-product-row">
            {resolveMallImageUrl(item.imageUrl) ? (
              <Image className="mall-order-product-image" mode="aspectFill" src={resolveMallImageUrl(item.imageUrl)} />
            ) : (
              <View className="mall-order-product-image mall-order-product-image-empty" />
            )}
            <View className="mall-order-product-copy">
              <Text className="mall-order-product-name">{item.productName || '商品'}</Text>
              <Text className="mall-order-product-spec">{productSpecText(item)}</Text>
              <Text className="mall-order-product-weight">{weightStatusText(item)}</Text>
            </View>
            <View className="mall-order-product-price">
              <Text>{mallYuan(item.lineTotalCents)}</Text>
              <Text>x{item.quantity}</Text>
            </View>
          </View>
        ))}
      </View>

      <View className="mall-card mall-order-fee-card">
        <SectionTitle icon={<WalletCards size={18} color="#63BF54" />} title="费用明细" />
        <FeeRow label="商品总价" value={mallYuan(order.subtotalCents)} />
        <FeeRow label="配送费" value={mallYuan(order.deliveryFeeCents)} />
        {order.couponCents > 0 ? <FeeRow label="优惠抵扣" value={`-${mallYuan(order.couponCents)}`} warm /> : null}
        {hasWeightAdjustment(order) ? (
          <FeeRow label="称重差额" value={signedYuan(order.weightAdjustmentCents || 0)} warm={Boolean(order.weightAdjustmentCents)} />
        ) : null}
        {order.estimatedPayableCents && order.estimatedPayableCents !== order.payableCents ? (
          <FeeRow label="预估金额" value={mallYuan(order.estimatedPayableCents)} />
        ) : null}
        <View className="mall-order-fee-divider" />
        <FeeRow label={pendingPayment ? '待支付' : '实付'} value={mallYuan(order.payableCents)} strong />
      </View>

      <View className="mall-card mall-order-info-card">
        <SectionTitle icon={<ReceiptText size={18} color="#63BF54" />} title="订单信息" />
        <InfoRow label="订单编号" value={order.orderNo} />
        <InfoRow label="下单时间" value={formatDateTime(order.createdAt) || '时间待确认'} />
        <InfoRow label="支付状态" value={paymentStatusText(order.paymentStatus)} />
        {pendingPayment ? <InfoRow label="支付截止" value={formatDateTime(order.paymentExpiresAt) || '10分钟内未支付自动取消'} /> : null}
        {order.vehicleCode ? <InfoRow label="配送车辆" value={order.vehicleCode} /> : null}
        {order.cabinCode ? <InfoRow label="取货舱门" value={order.cabinCode} /> : null}
      </View>

      <View className="mall-card mall-order-service-card">
        <SectionTitle icon={<ShieldCheck size={18} color="#63BF54" />} title="售后 / 客服进度" />
        {order.afterSales?.length ? (
          <View className="mall-order-service-progress">
            <Text className="mall-order-service-title">
              {afterSaleTypeText(order.afterSales[0].afterSaleType)} · {afterSaleStatusText(order.afterSales[0].status)}
            </Text>
            <Text className="mall-order-service-copy">
              {order.afterSales[0].resolution || order.afterSales[0].description || order.afterSales[0].reason || '客服处理中'}
            </Text>
          </View>
        ) : (
          <View className="mall-order-service-progress">
            <Text className="mall-order-service-title">暂无售后申请</Text>
            <Text className="mall-order-service-copy">
              如遇缺货、坏果、少件或配送异常，可申请售后，或联系商城客服处理。
            </Text>
          </View>
        )}
        <InfoRow label="客服方式" value={supportPhoneText(order)} />
      </View>

      <View className="mall-order-action-spacer" />
      <View className="mall-order-action-bar">
        <MallPrimaryButton subtle onClick={() => contactSupport(order)}>
          <Headphones size={17} color="#1F2D1F" />
          <Text style={{ marginLeft: 6 }}>联系客服</Text>
        </MallPrimaryButton>
        <MallPrimaryButton subtle onClick={() => Taro.navigateTo({ url: afterSaleUrl(order) })}>
          <Text>{order.afterSales?.length ? '查看售后' : '申请售后'}</Text>
        </MallPrimaryButton>
        {pendingPayment ? (
          <MallPrimaryButton onClick={payOrder}>
            <Text>{paying ? '支付中...' : '立即支付'}</Text>
          </MallPrimaryButton>
        ) : null}
      </View>
    </MallPage>
  )
}

function SectionTitle({ icon, title, action }: { icon: JSX.Element; title: string; action?: string }) {
  return (
    <View className="mall-order-section-title">
      <View className="mall-order-section-heading">
        {icon}
        <Text>{title}</Text>
      </View>
      {action ? <Text className="mall-order-section-action">{action}</Text> : null}
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

function FeeRow({ label, value, warm, strong }: { label: string; value: string; warm?: boolean; strong?: boolean }) {
  const className = [
    'mall-order-fee-row',
    warm ? 'mall-order-fee-row-warm' : '',
    strong ? 'mall-order-fee-row-strong' : '',
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <View className={className}>
      <Text>{label}</Text>
      <Text>{value}</Text>
    </View>
  )
}

function orderStatus(order: MallOrder) {
  if (isCancelled(order)) {
    return {
      label: '已取消',
      title: '订单已取消',
      subtitle: '如仍有需要，可重新选购商品。',
      icon: <ReceiptText size={28} color="#1F2D1F" />,
    }
  }
  if (isPendingPayment(order)) {
    return {
      label: '待支付',
      title: '请尽快完成支付',
      subtitle: '支付完成后，商家将为你安排备货和配送。',
      icon: <Clock3 size={28} color="#1F2D1F" />,
    }
  }
  if (isAfterSale(order)) {
    return {
      label: '售后中',
      title: '售后处理中',
      subtitle: '客服会结合订单、照片和履约记录继续跟进。',
      icon: <ShieldCheck size={28} color="#1F2D1F" />,
    }
  }
  if (isCompleted(order)) {
    return {
      label: '已完成',
      title: '商品已送达',
      subtitle: '感谢购买，如有问题可继续发起售后。',
      icon: <PackageCheck size={28} color="#1F2D1F" />,
    }
  }
  if (isDelivering(order)) {
    return {
      label: '配送中',
      title: '商品正在配送',
      subtitle: order.expectedDeliveryWindow || '请留意配送通知和取货信息。',
      icon: <Truck size={28} color="#1F2D1F" />,
    }
  }
  return {
    label: '待配送',
    title: '商家正在备货',
    subtitle: order.expectedDeliveryWindow || '配送时间确认后会同步到订单。',
    icon: <ShoppingBasket size={28} color="#1F2D1F" />,
  }
}

function isPendingPayment(order: MallOrder) {
  return !isCancelled(order) && (order.paymentStatus !== 'paid' || order.status === 'pending_payment')
}

function isCancelled(order: MallOrder) {
  return order.status === 'cancelled' || order.paymentStatus === 'cancelled'
}

function isAfterSale(order: MallOrder) {
  return Boolean(order.afterSaleStatus || order.refundStatus || order.status.includes('after') || order.status.includes('refund'))
}

function isCompleted(order: MallOrder) {
  return order.status.includes('complete') || order.status.includes('finish')
}

function isDelivering(order: MallOrder) {
  const status = `${order.status} ${order.fulfillmentStatus || ''}`.toLowerCase()
  return status.includes('deliver') || status.includes('dispatch') || status.includes('transit')
}

function itemCount(order: MallOrder) {
  return order.items.reduce((sum, item) => sum + Math.max(Number(item.quantity || 0), 0), 0) || order.items.length || 1
}

function recipientText(order: MallOrder) {
  const name = order.recipientName || '收货人待确认'
  const recipientPhone = order.recipientPhone
  return recipientPhone ? `${name} ${recipientPhone}` : name
}

function deliveryMethodText(order: MallOrder) {
  if (order.deliveryMethod === 'pickup' || order.pickupMethod === 'pickup') return '送货到家'
  return '送货到家'
}

function productSpecText(item: MallOrder['items'][number]) {
  const parts = [
    item.variantName || item.sku || '默认规格',
    `${mallYuan(item.unitPriceCents)} / ${item.weightUnitLabel || '份'}`,
  ]
  return parts.filter(Boolean).join(' · ')
}

function weightStatusText(item: MallOrder['items'][number]) {
  if (item.pricingMode !== 'weighed') return '按份计价'
  const unitGrams = item.weightUnitGrams || 500
  const label = item.weightUnitLabel || '斤'
  const estimated = mallWeightText(item.estimatedWeightGrams, unitGrams, label)
  const actual = mallWeightText(item.actualWeightGrams, unitGrams, label)
  const status = item.weightAdjustmentStatus === 'confirmed' ? '已称重' : '待称重'
  return `${status}${estimated ? ` · 预估 ${estimated}` : ''}${actual ? ` · 实际 ${actual}` : ''}`
}

function hasWeightAdjustment(order: MallOrder) {
  return Boolean(order.weightAdjustmentStatus && order.weightAdjustmentStatus !== 'none')
}

function signedYuan(cents: number) {
  if (cents > 0) return `+${mallYuan(cents)}`
  if (cents < 0) return `-${mallYuan(Math.abs(cents))}`
  return mallYuan(0)
}

function paymentExpireText(order: MallOrder) {
  const expire = formatDateTime(order.paymentExpiresAt)
  return expire ? `请在 ${expire} 前完成支付，超时订单将自动取消。` : '请尽快完成支付，超时订单将自动取消。'
}

function paymentStatusText(value?: string | null) {
  if (value === 'paid') return '已支付'
  if (value === 'pending') return '待支付'
  if (value === 'cancelled') return '已取消'
  if (value === 'refunded') return '已退款'
  return value || '待确认'
}

function supportPhoneText(order: MallOrder) {
  const phone = supportPhone(order)
  return phone ? `电话客服 ${phone}` : '在线客服'
}

function supportPhone(order: MallOrder) {
  return (order.supportPhone || '').trim()
}

function contactSupport(order: MallOrder) {
  const phone = supportPhone(order)
  if (phone) {
    Taro.makePhoneCall({ phoneNumber: phone })
    return
  }
  Taro.navigateTo({ url: `/pages/mall/support/index?orderId=${order.id}` })
}

function afterSaleUrl(order: MallOrder) {
  const afterSale = order.afterSales?.[0]
  const sessionQuery = afterSale?.supportSessionId ? `&sessionId=${afterSale.supportSessionId}&afterSaleId=${afterSale.id}` : ''
  return `/pages/mall/after-sale/index?orderId=${order.id}${sessionQuery}`
}

function afterSaleTypeText(value?: string | null) {
  if (value === 'return_refund') return '退货退款'
  if (value === 'exchange') return '换货'
  if (value === 'refund_only') return '仅退款'
  return '售后'
}

function afterSaleStatusText(value?: string | null) {
  const labels: Record<string, string> = {
    submitted: '已提交',
    negotiating: '协商中',
    approved: '已通过',
    return_pending: '待退货',
    returning: '退货中',
    exchange_processing: '换货中',
    replacement_sent: '补发中',
    refunding: '退款中',
    refunded: '已退款',
    resolved: '已完成',
    rejected: '已驳回',
    closed: '已关闭',
  }
  return value ? labels[value] || value : '处理中'
}

function formatDateTime(value?: string | null) {
  if (!value) return ''
  const time = new Date(value)
  if (Number.isNaN(time.getTime())) return value
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
