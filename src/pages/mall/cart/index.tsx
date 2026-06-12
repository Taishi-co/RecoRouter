import { useEffect, useMemo, useState } from 'react'
import { Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { Check, Circle, Store, Trash2 } from 'lucide-react-taro'
import {
  createMallCheckout,
  deleteMallCartItem,
  getMallCart,
  listMallAddresses,
  updateMallCartItem,
  type MallAddress,
  type MallCart,
  type MallCartItem,
} from '@/services/mall'
import {
  MallBrandMark,
  MallLocationStrip,
  MallPage,
  MallPrimaryButton,
  MallProductThumb,
  mallWeightText,
  mallYuan,
} from '../mall-ui'
import { redirectToMallAuth } from '../auth-route'

interface StoredUser {
  id?: string
}

export default function MallCartPage() {
  const [cart, setCart] = useState<MallCart>({ items: [], subtotalCents: 0, selectedCount: 0 })
  const [addresses, setAddresses] = useState<MallAddress[]>([])
  const [selectedAddressId, setSelectedAddressId] = useState('')
  const [loading, setLoading] = useState(false)
  const userId = (Taro.getStorageSync('userInfo') as StoredUser | undefined)?.id || ''

  const payableCents = useMemo(
    () => cart.payableCents ?? Math.max(cart.subtotalCents + (cart.deliveryFeeCents || 0) - (cart.couponCents || 0), 0),
    [cart.deliveryFeeCents, cart.payableCents, cart.subtotalCents, cart.couponCents],
  )
  const savedCents = Math.max(cart.totalDiscountCents ?? cart.couponCents ?? 0, 0)
  const selectedAddress = addresses.find((item) => item.id === selectedAddressId)
  const allSelected = cart.items.length > 0 && cart.items.every((item) => item.selected)
  const addOnPrompt = buildAddOnPrompt(cart)

  useEffect(() => {
    guardLogin()
  }, [])

  useDidShow(() => {
    loadData()
  })

  const guardLogin = () => {
    if (!userId) {
      Taro.showToast({ title: '请先登录', icon: 'none' })
      redirectToMallAuth('/pages/mall/cart/index')
    }
  }

  const loadData = async () => {
    if (!userId) return
    setLoading(true)
    try {
      const [nextCart, nextAddresses] = await Promise.all([
        getMallCart(userId),
        listMallAddresses(userId),
      ])
      setCart(nextCart)
      setAddresses(nextAddresses)
      const defaultAddress = nextAddresses.find((item) => item.isDefault || item.is_default) || nextAddresses[0]
      if (defaultAddress) {
        setSelectedAddressId(defaultAddress.id)
      }
    } catch (error) {
      showError(error, '加载失败')
    } finally {
      setLoading(false)
    }
  }

  const changeQuantity = async (id: string, quantity: number) => {
    try {
      if (quantity <= 0) {
        await deleteMallCartItem(id)
      } else {
        await updateMallCartItem(id, { quantity })
      }
      loadData()
    } catch (error) {
      showError(error, '修改失败')
    }
  }

  const toggleItem = async (item: MallCartItem) => {
    try {
      await updateMallCartItem(item.id, { selected: !item.selected })
      loadData()
    } catch (error) {
      showError(error, '修改失败')
    }
  }

  const selectAllCartItems = async () => {
    try {
      await Promise.all(cart.items.map((item) => updateMallCartItem(item.id, { selected: !allSelected })))
      loadData()
    } catch (error) {
      showError(error, '全选失败')
    }
  }

  const clearMallCart = async () => {
    try {
      await Promise.all(cart.items.map((item) => deleteMallCartItem(item.id)))
      loadData()
    } catch (error) {
      showError(error, '清空失败')
    }
  }

  const submitOrder = async () => {
    if (cart.selectedCount === 0) {
      Taro.showToast({ title: '请选择商品', icon: 'none' })
      return
    }
    try {
      const checkout = await createMallCheckout({
        userId,
        source: 'cart',
        addressId: selectedAddressId || undefined,
      })
      Taro.navigateTo({ url: `/pages/mall/confirm/index?checkoutId=${checkout.id}` })
    } catch (error) {
      showError(error, '结算失败')
    }
  }

  return (
    <MallPage active="cart">
      <View className="mall-v7-page-head">
        <View className="mall-v7-head-brand">
          <MallBrandMark compact />
          <View>
            <Text className="mall-v7-kicker">叁友甄选</Text>
            <Text className="mall-page-title">购物车</Text>
          </View>
        </View>
        <View className="mall-v7-head-pill">
          <Text>{cart.selectedCount || 0} 件已选</Text>
        </View>
      </View>

      <View className="mall-v7-cart-summary">
        <View>
          <Text className="mall-v7-summary-label">当前合计</Text>
          <Text className="mall-v7-summary-value cart-subtotal-before">{mallYuan(cart.subtotalCents)}</Text>
        </View>
        <View>
          <Text className="mall-v7-summary-label">满减后实付</Text>
          <Text className="mall-v7-summary-value cart-payable-after">{mallYuan(payableCents)}</Text>
        </View>
        <View>
          <Text className="mall-v7-summary-label">已省</Text>
          <Text className="mall-v7-summary-value cart-saved-cents">{mallYuan(savedCents)}</Text>
        </View>
      </View>

      {addOnPrompt ? (
        <View className="mall-v7-addon" onClick={() => Taro.navigateTo({ url: '/pages/mall/category/index?keyword=凑单' })}>
          <Text>{addOnPrompt}</Text>
          <Text>去凑单</Text>
        </View>
      ) : null}

      <View style={{ marginTop: 12 }}>
        <MallLocationStrip
          title={selectedAddress?.addressLabel || selectedAddress?.address_name || '请选择送货地址'}
          subtitle={selectedAddress?.addressText || selectedAddress?.address || '下单前需要填写收货地址'}
          onClick={() => Taro.navigateTo({ url: '/pages/mall/address/index' })}
        />
      </View>

      <View className="mall-v7-cart-actions">
        <View onClick={selectAllCartItems}>
          {allSelected ? <Check size={16} color="#2F7E43" /> : <Circle size={16} color="#7A8476" />}
          <Text>{allSelected ? '取消全选' : '一键勾选全部'}</Text>
        </View>
        <View onClick={clearMallCart}>
          <Trash2 size={16} color="#B45309" />
          <Text>一键清空</Text>
        </View>
      </View>

      {cart.items.length === 0 ? (
        <View className="mall-empty">
          <Text className="mall-empty-title">{loading ? '加载中...' : '购物车暂无商品'}</Text>
          <Text className="mall-empty-copy">去首页看看今日秒杀和新上鲜品。</Text>
          <View style={{ marginTop: 14 }}>
            <MallPrimaryButton onClick={() => Taro.navigateTo({ url: '/pages/mall/index/index' })}>
              <Text>去逛逛</Text>
            </MallPrimaryButton>
          </View>
        </View>
      ) : (
        <View className="mall-card mall-v7-cart-shop">
          <View className="mall-v7-shop-head">
            <Store size={18} color="#2F7E43" />
            <Text>叁友甄选 · 今日团购</Text>
            <Text>次日达</Text>
          </View>
          {cart.items.map((item) => (
            <View key={item.id} className="mall-v7-cart-item">
              <View className="mall-v7-cart-check" onClick={() => toggleItem(item)}>
                {item.selected ? <Check size={16} color="#FFFFFF" /> : null}
              </View>
              <View className="mall-v7-cart-thumb">
                <MallProductThumb product={item.product} />
              </View>
              <View className="mall-v7-cart-copy">
                <Text className="mall-v7-product-name">{item.product?.name || '商品'}</Text>
                <Text className="mall-v7-product-subtitle">
                  {item.variantName || item.product?.specification || item.product?.subtitle || '基地直采 · 今日锁鲜'}
                </Text>
                {item.pricingMode === 'weighed' ? (
                  <Text className="mall-v7-product-subtitle">
                    预估 {mallWeightText(item.estimatedWeightGrams, item.weightUnitGrams || 500, item.weightUnitLabel || '斤')}，称重后确认金额
                  </Text>
                ) : null}
                <View className="mall-v7-unit-row">
                  <Text>满减前 {mallYuan(item.originalUnitPriceCents ?? item.product?.priceCents ?? 0)}</Text>
                  <Text>满减后 {mallYuan(item.discountedUnitPriceCents ?? item.product?.priceCents ?? 0)}</Text>
                </View>
                <View className="mall-v7-unit-row mall-v7-unit-row-warm">
                  <Text>优惠 {mallYuan(item.lineDiscountCents || 0)}</Text>
                  <Text>积分最高抵 {mallYuan(item.pointsDeductibleCents || 0)}</Text>
                </View>
              </View>
              <View className="mall-stepper">
                <Text className="mall-stepper-action mall-stepper-action-muted" onClick={() => changeQuantity(item.id, item.quantity - 1)}>−</Text>
                <Text className="mall-stepper-value">{item.quantity}</Text>
                <Text className="mall-stepper-action" onClick={() => changeQuantity(item.id, item.quantity + 1)}>＋</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {cart.items.length > 0 ? (
        <View className="mall-total-bar mall-v7-fixed-checkout">
          <View>
            <Text className="mall-total-label">满减后实付</Text>
            <Text className="mall-total-value">{mallYuan(payableCents)}</Text>
          </View>
          <View className="mall-total-button" onClick={submitOrder}>
            <Text>去结算</Text>
          </View>
        </View>
      ) : null}
    </MallPage>
  )
}

function buildAddOnPrompt(cart: MallCart) {
  const gap = cart.nextDiscountGapCents || 0
  const discount = cart.nextDiscountCents || cart.discountRuleCents || 0
  if (gap <= 0 || discount <= 0) return ''
  return `差 ${mallYuan(gap)} 即可再减 ${mallYuan(discount)}`
}

function showError(error: unknown, fallback: string) {
  Taro.showToast({
    title: error instanceof Error ? error.message : fallback,
    icon: 'none',
  })
}
