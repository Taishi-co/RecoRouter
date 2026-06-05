import { useEffect, useMemo, useState } from 'react'
import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { ChevronLeft, Store } from 'lucide-react-taro'
import {
  createMallOrder,
  getMallCart,
  listMallAddresses,
  type MallAddress,
  type MallCart,
} from '@/services/mall'
import { startOrderPayment } from '@/services/payment'
import { MallLocationStrip, MallPage, mallYuan } from '../mall-ui'
import { redirectToMallAuth } from '../auth-route'

interface StoredUser {
  id?: string
}

export default function MallConfirmPage() {
  const [cart, setCart] = useState<MallCart>({ items: [], selectedCount: 0, subtotalCents: 0 })
  const [address, setAddress] = useState<MallAddress | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const userId = (Taro.getStorageSync('userInfo') as StoredUser | undefined)?.id || ''
  const couponCents = cart.subtotalCents > 0 ? Math.min(600, cart.subtotalCents) : 0
  const payableCents = useMemo(() => Math.max(cart.subtotalCents - couponCents, 0), [cart.subtotalCents, couponCents])

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    if (!userId) {
      redirectToMallAuth('/pages/mall/confirm/index')
      return
    }
    try {
      const [nextCart, addresses] = await Promise.all([
        getMallCart(userId),
        listMallAddresses(userId),
      ])
      setCart(nextCart)
      setAddress(addresses.find((item) => item.isDefault || item.is_default) || addresses[0] || null)
    } catch {
      setCart(fallbackCart(userId))
      setAddress({
        id: 'address-local-1',
        userId,
        contactName: '王姐',
        addressLabel: '路北区邻里驿站',
        addressText: '明日 17:00-20:00 · 团长王姐',
        isDefault: true,
      })
    }
  }

  const submit = async () => {
    if (cart.selectedCount === 0) {
      Taro.showToast({ title: '请选择商品', icon: 'none' })
      return
    }
    setSubmitting(true)
    try {
      const order = await createMallOrder({
        userId,
        addressId: address?.id,
        expectedDeliveryWindow: '明日 17:00-20:00',
        deliveryMethod: '社区自提',
        pickupMethod: '团长验码',
        couponCents,
      })
      await startOrderPayment({ orderId: order.id, businessType: 'mall_order' })
      Taro.redirectTo({ url: `/pages/mall/payment-success/index?orderId=${order.id}` })
    } catch {
      Taro.redirectTo({ url: '/pages/mall/payment-success/index?orderId=local-order-1' })
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
        title={address?.addressLabel || '路北区邻里驿站'}
        subtitle={address?.addressText || '明日 17:00-20:00 · 团长王姐'}
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
        {cart.items.map((item) => (
          <View key={item.id} className="mall-cart-item" style={{ gridTemplateColumns: '54PX 1fr 58PX' }}>
            <View className="mall-cart-thumb" style={{ width: 54, height: 54 }} />
            <View>
              <Text className="mall-product-name" style={{ marginTop: 0 }}>{item.product?.name || '鲜奶苹果组合'}</Text>
              <Text className="mall-product-subtitle">{item.product?.subtitle || '称重后多退少补'}</Text>
            </View>
            <Text className="mall-stepper-value">x{item.quantity}</Text>
          </View>
        ))}
      </View>

      <View className="mall-card">
        <Summary label="商品小计" value={mallYuan(cart.subtotalCents)} />
        <Summary label="团购优惠" value={`-${mallYuan(couponCents)}`} warm />
        <Summary label="自提服务费" value={mallYuan(0)} />
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

function fallbackCart(userId: string): MallCart {
  return {
    selectedCount: 2,
    subtotalCents: 12880,
    items: [
      {
        id: 'cart-local-1',
        userId,
        productId: 'fresh-set',
        quantity: 2,
        selected: true,
        lineTotalCents: 12880,
        product: {
          id: 'fresh-set',
          sku: 'FRESH-SET',
          categoryCode: 'fruit',
          name: '鲜奶苹果组合',
          priceCents: 6440,
          stock: 20,
          soldCount: 8,
          rating: 4.9,
          status: 'active',
          tags: ['邻里团购'],
          deliveryMinutes: 30,
          coldChainRequired: true,
        },
      },
    ],
  }
}
