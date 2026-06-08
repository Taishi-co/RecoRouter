import { useEffect, useMemo, useState } from 'react'
import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { ChevronLeft, CreditCard, ShieldCheck, Store } from 'lucide-react-taro'
import {
  createMallCheckout,
  createMallOrder,
  getMallCheckout,
  listMallAddresses,
  type MallAddress,
  type MallCheckout,
  type MallDiscountBreakdown,
} from '@/services/mall'
import { startOrderPayment } from '@/services/payment'
import { MallLocationStrip, MallPage, MallProductThumb, mallYuan } from '../mall-ui'
import { redirectToMallAuth } from '../auth-route'

interface StoredUser {
  id?: string
}

export default function MallConfirmPage() {
  const [checkout, setCheckout] = useState<MallCheckout | null>(null)
  const [address, setAddress] = useState<MallAddress | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const userId = (Taro.getStorageSync('userInfo') as StoredUser | undefined)?.id || ''
  const payableCents = useMemo(() => checkout?.payableCents || 0, [checkout?.payableCents])
  const couponCents = checkout?.couponCents || 0
  const discountBreakdown = checkout?.discountBreakdown || []
  const pointsRedeemedCents = checkout?.pointsRedeemedCents || 0
  const memberDiscountCents = checkout?.memberDiscountCents || 0

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
        pickupPointId: checkout.pickupPointId || address?.pickupPointId || undefined,
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

      <View className="mall-v7-checkout-note">
        <ShieldCheck size={17} color="#2F7E43" />
        <Text>已自动叠加满减、优惠券、会员折扣和积分抵扣</Text>
      </View>

      <MallLocationStrip
        active
        title={address?.addressLabel || address?.address_name || '默认使用上次自提点'}
        subtitle={address?.addressText || address?.address || '下单前需要选择真实收货地址 / 自提点'}
        onClick={() => Taro.navigateTo({ url: '/pages/mall/address/index' })}
      />

      <View className="mall-card">
        <View className="mall-v7-shop-head">
          <Store size={18} color="#2F7E43" />
          <Text>叁友甄选 · 今日团购</Text>
          <Text>次日达</Text>
        </View>
        {(checkout?.items || []).map((item) => (
          <View key={item.id || item.productId} className="mall-v7-confirm-item">
            <View className="mall-v7-confirm-thumb">
              <MallProductThumb product={item.product} />
            </View>
            <View>
              <Text className="mall-v7-product-name">{item.product?.name || item.productName}</Text>
              <Text className="mall-v7-product-subtitle">{item.product?.subtitle || item.sku || '后端结算明细'}</Text>
              <Text className="mall-v7-confirm-price">
                {mallYuan(item.discountedUnitPriceCents ?? item.unitPriceCents)} x {item.quantity}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <View className="mall-card">
        <Summary label="商品小计" value={mallYuan(checkout?.subtotalCents || 0)} />
        {discountBreakdown.length > 0 ? (
          discountBreakdown.map((item) => <DiscountSummary key={`${item.type}-${item.label}`} item={item} />)
        ) : couponCents > 0 ? (
          <Summary label={checkout?.discountDescription || '已用优惠'} value={`-${mallYuan(couponCents)}`} warm />
        ) : (
          <Summary label="可用优惠" value="暂无" />
        )}
        {memberDiscountCents > 0 && !discountBreakdown.some((item) => item.type === 'member') ? (
          <Summary label="会员折扣" value={`-${mallYuan(memberDiscountCents)}`} warm />
        ) : null}
        {pointsRedeemedCents > 0 && !discountBreakdown.some((item) => item.type === 'points') ? (
          <Summary label="积分抵扣" value={`-${mallYuan(pointsRedeemedCents)}`} warm />
        ) : null}
        <Summary label="自提服务费" value={mallYuan(checkout?.deliveryFeeCents || 0)} />
      </View>

      <View className="mall-total-bar mall-v7-fixed-checkout">
        <View>
          <Text className="mall-total-label">最终实付</Text>
          <Text className="mall-total-value">{mallYuan(payableCents)}</Text>
        </View>
        <View className="mall-total-button mall-v7-wechat-pay" onClick={submit}>
          <CreditCard size={18} color="#FFFFFF" />
          <Text>{submitting ? '支付中' : '微信支付'}</Text>
        </View>
      </View>
    </MallPage>
  )
}

function DiscountSummary({ item }: { item: MallDiscountBreakdown }) {
  return <Summary label={item.label} value={`-${mallYuan(item.amountCents)}`} warm />
}

function Summary({ label, value, warm }: { label: string; value: string; warm?: boolean }) {
  return (
    <View className="mall-summary-row">
      <Text className="mall-summary-label">{label}</Text>
      <Text className={warm ? 'mall-summary-value mall-summary-value-warm' : 'mall-summary-value'}>{value}</Text>
    </View>
  )
}
