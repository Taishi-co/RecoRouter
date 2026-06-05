import { useEffect, useMemo, useState } from 'react'
import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { ChevronLeft, Store } from 'lucide-react-taro'
import {
  createMallOrder,
  createMallCheckout,
  getMallCheckout,
  listMallAddresses,
  type MallAddress,
  type MallCheckout,
} from '@/services/mall'
import { startOrderPayment } from '@/services/payment'
import { MallLocationStrip, MallPage, mallYuan } from '../mall-ui'
import { redirectToMallAuth } from '../auth-route'

interface StoredUser {
  id?: string
}

export default function MallConfirmPage() {
  const [checkout, setCheckout] = useState<MallCheckout | null>(null)
  const [address, setAddress] = useState<MallAddress | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const userId = (Taro.getStorageSync('userInfo') as StoredUser | undefined)?.id || ''
  const couponCents = checkout?.couponCents || 0
  const payableCents = useMemo(() => checkout?.payableCents || 0, [checkout?.payableCents])

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    if (!userId) {
      redirectToMallAuth('/pages/mall/confirm/index')
      return
    }
    try {
      const checkoutId = String(Taro.getCurrentInstance().router?.params?.checkoutId || '')
      const [nextCheckout, addresses] = await Promise.all([
        checkoutId ? getMallCheckout(checkoutId) : createMallCheckout({ userId, source: 'cart' }),
        listMallAddresses(userId),
      ])
      setCheckout(nextCheckout)
      const addressId = String(Taro.getCurrentInstance().router?.params?.addressId || nextCheckout.addressId || '')
      setAddress(addresses.find((item) => item.id === addressId) || addresses.find((item) => item.isDefault || item.is_default) || addresses[0] || null)
    } catch (error) {
      Taro.showToast({
        title: error instanceof Error ? error.message : '结算单加载失败',
        icon: 'none',
      })
    }
  }

  const submit = async () => {
    if (!checkout || checkout.items.length === 0) {
      Taro.showToast({ title: '请选择商品', icon: 'none' })
      return
    }
    setSubmitting(true)
    try {
      const order = await createMallOrder({
        userId,
        checkoutId: checkout.id,
        addressId: address?.id,
        expectedDeliveryWindow: '明日 17:00-20:00',
        deliveryMethod: '社区自提',
        pickupMethod: '团长验码',
      })
      const payment = await startOrderPayment({ orderId: order.id, businessType: 'mall_order' })
      if (payment.paymentStatus !== 'paid' && payment.status !== 'paid') {
        throw new Error('支付结果未确认，请稍后在订单中查看')
      }
      Taro.redirectTo({ url: `/pages/mall/payment-success/index?orderId=${order.id}` })
    } catch (error) {
      Taro.showToast({
        title: error instanceof Error ? error.message : '支付未完成',
        icon: 'none',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <MallPage active="cart">
      <View className="mall-back-row">
        <ChevronLeft size={24} color="#1F2D1F" onClick={() => Taro.navigateBack()} />
        <Text className="mall-page-title">确认订单</Text>
      </View>

      <MallLocationStrip
        active
        title={address?.addressLabel || '请选择自提点'}
        subtitle={address?.addressText || '下单前需要选择真实自提点'}
        onClick={() => Taro.navigateTo({ url: '/pages/mall/address/index' })}
      />

      <View className="mall-card">
        <View className="mall-list-row" style={{ marginTop: 0 }}>
          <View style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Store size={18} color="#63BF54" />
            <Text className="mall-list-title">叁友甄选 · 今日团购</Text>
          </View>
          <Text className="mall-status-pill">次日达</Text>
        </View>
        {(checkout?.items || []).map((item) => (
          <View key={item.id || item.productId} className="mall-cart-item" style={{ gridTemplateColumns: '54PX 1fr 58PX' }}>
            <View className="mall-cart-thumb" style={{ width: 54, height: 54 }} />
            <View>
              <Text className="mall-product-name" style={{ marginTop: 0 }}>{item.product?.name || item.productName}</Text>
              <Text className="mall-product-subtitle">{item.product?.subtitle || item.sku || '后端结算明细'}</Text>
            </View>
            <Text className="mall-stepper-value">x{item.quantity}</Text>
          </View>
        ))}
      </View>

      <View className="mall-card">
        <Summary label="商品小计" value={mallYuan(checkout?.subtotalCents || 0)} />
        <Summary label={checkout?.discountDescription || '团购优惠'} value={`-${mallYuan(couponCents)}`} warm />
        <Summary label="自提服务费" value={mallYuan(checkout?.deliveryFeeCents || 0)} />
      </View>

      <View className="mall-total-bar">
        <View>
          <Text className="mall-total-label">应付</Text>
          <Text className="mall-total-value">{mallYuan(payableCents)}</Text>
        </View>
        <View className="mall-total-button" style={{ background: '#63BF54' }} onClick={submit}>
          <Text>{submitting ? '支付中' : '微信支付'}</Text>
        </View>
      </View>
    </MallPage>
  )
}

function Summary({ label, value, warm }: { label: string; value: string; warm?: boolean }) {
  return (
    <View className="mall-summary-row" style={{ marginTop: 0 }}>
      <Text className="mall-summary-label">{label}</Text>
      <Text className={warm ? 'mall-summary-value mall-summary-value-warm' : 'mall-summary-value'}>{value}</Text>
    </View>
  )
}
