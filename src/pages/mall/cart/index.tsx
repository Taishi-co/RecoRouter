import { useEffect, useMemo, useState } from 'react'
import { Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { Check, ChevronDown, ChevronUp, Circle, Store, Trash2 } from 'lucide-react-taro'
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
  MALL_SELECTED_ADDRESS_STORAGE_KEY,
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

interface CartTouchPoint {
  clientX: number
  clientY: number
}

interface CartSwipeStart {
  itemId: string
  x: number
  y: number
}

export default function MallCartPage() {
  const [cart, setCart] = useState<MallCart>({ items: [], subtotalCents: 0, selectedCount: 0 })
  const [addresses, setAddresses] = useState<MallAddress[]>([])
  const [selectedAddressId, setSelectedAddressId] = useState('')
  const [swipedCartItemId, setSwipedCartItemId] = useState('')
  const [cartSwipeStart, setCartSwipeStart] = useState<CartSwipeStart | null>(null)
  const [discountDetailOpen, setDiscountDetailOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const userId = (Taro.getStorageSync('userInfo') as StoredUser | undefined)?.id || ''

  const payableCents = useMemo(
    () => cart.payableCents ?? Math.max(cart.subtotalCents + (cart.deliveryFeeCents || 0) - (cart.couponCents || 0), 0),
    [cart.deliveryFeeCents, cart.payableCents, cart.subtotalCents, cart.couponCents],
  )
  const savedCents = Math.max(cart.totalDiscountCents ?? cart.couponCents ?? 0, 0)
  const discountDetail = useMemo(() => buildCartDiscountDetail(cart, payableCents, savedCents), [cart, payableCents, savedCents])
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

  const loadAddresses = async ({ fresh = false }: { fresh?: boolean } = {}) => {
    if (!userId) return []
    return listMallAddresses(userId, { preferCache: !fresh, fresh, revalidate: !fresh })
  }

  const loadData = async ({
    refreshAddresses = true,
    freshCart = false,
  }: {
    refreshAddresses?: boolean
    freshCart?: boolean
  } = {}) => {
    if (!userId) return
    setLoading(true)
    try {
      const [nextCart, nextAddresses] = await Promise.all([
        getMallCart(userId, { fresh: freshCart, preferCache: !freshCart }),
        refreshAddresses ? loadAddresses() : Promise.resolve(addresses),
      ])
      setCart(nextCart)
      setSwipedCartItemId((current) => nextCart.items.some((item) => item.id === current) ? current : '')
      if (refreshAddresses) {
        setAddresses(nextAddresses)
        setSelectedAddressId(resolveSelectedAddressId(nextAddresses, selectedAddressId))
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
      loadData({ refreshAddresses: false, freshCart: true })
    } catch (error) {
      showError(error, '修改失败')
    }
  }

  const toggleItem = async (item: MallCartItem) => {
    try {
      await updateMallCartItem(item.id, { selected: !item.selected })
      loadData({ refreshAddresses: false, freshCart: true })
    } catch (error) {
      showError(error, '修改失败')
    }
  }

  const openCartItemProduct = (item: MallCartItem) => {
    const productId = item.product?.id || item.productId
    if (!productId) return
    Taro.navigateTo({ url: `/pages/mall/product/index?id=${encodeURIComponent(productId)}` })
  }

  const selectAllCartItems = async () => {
    try {
      await Promise.all(cart.items.map((item) => updateMallCartItem(item.id, { selected: !allSelected })))
      loadData({ refreshAddresses: false, freshCart: true })
    } catch (error) {
      showError(error, '全选失败')
    }
  }

  const clearMallCart = async () => {
    try {
      await Promise.all(cart.items.map((item) => deleteMallCartItem(item.id)))
      setSwipedCartItemId('')
      loadData({ refreshAddresses: false, freshCart: true })
    } catch (error) {
      showError(error, '清空失败')
    }
  }

  const handleCartItemTouchStart = (itemId: string, event: unknown) => {
    const touch = getCartTouchPoint(event, 'touches')
    if (!touch) return
    if (swipedCartItemId && swipedCartItemId !== itemId) {
      setSwipedCartItemId('')
    }
    setCartSwipeStart({ itemId, x: touch.clientX, y: touch.clientY })
  }

  const handleCartItemTouchMove = (itemId: string, event: unknown) => {
    if (!cartSwipeStart || cartSwipeStart.itemId !== itemId) return
    const touch = getCartTouchPoint(event, 'touches')
    if (!touch) return
    const deltaX = touch.clientX - cartSwipeStart.x
    const deltaY = touch.clientY - cartSwipeStart.y
    if (Math.abs(deltaY) > Math.abs(deltaX)) return
    if (deltaX < -32) {
      setSwipedCartItemId(itemId)
    }
    if (deltaX > 24) {
      setSwipedCartItemId((current) => current === itemId ? '' : current)
    }
  }

  const handleCartItemTouchEnd = (itemId: string, event: unknown) => {
    if (!cartSwipeStart || cartSwipeStart.itemId !== itemId) return
    const touch = getCartTouchPoint(event, 'changedTouches')
    if (touch) {
      const deltaX = touch.clientX - cartSwipeStart.x
      const deltaY = touch.clientY - cartSwipeStart.y
      if (Math.abs(deltaX) > Math.abs(deltaY) && deltaX < -48) {
        setSwipedCartItemId(itemId)
      }
      if (deltaX > 24) {
        setSwipedCartItemId((current) => current === itemId ? '' : current)
      }
    }
    setCartSwipeStart(null)
  }

  const confirmDeleteCartItem = async (item: MallCartItem) => {
    const productName = item.product?.name || '该商品'
    const result = await Taro.showModal({
      title: '确认删除吗',
      content: `确定从购物车删除「${productName}」吗？`,
      confirmText: '删除',
      cancelText: '取消',
      confirmColor: '#D14343',
    })
    if (!result.confirm) return
    try {
      await deleteMallCartItem(item.id)
      setSwipedCartItemId('')
      await loadData({ refreshAddresses: false, freshCart: true })
      Taro.showToast({ title: '已删除', icon: 'success' })
    } catch (error) {
      showError(error, '删除失败')
    }
  }

  const submitOrder = async () => {
    if (cart.selectedCount === 0) {
      Taro.showToast({ title: '请选择商品', icon: 'none' })
      return
    }
    if (!selectedAddress) {
      Taro.showToast({ title: '请选择送货地址', icon: 'none' })
      Taro.navigateTo({ url: '/pages/mall/address/index?select=1' })
      return
    }
    if (!hasAddressLocation(selectedAddress)) {
      Taro.showToast({ title: '请用地图补充地址定位', icon: 'none' })
      Taro.navigateTo({ url: '/pages/mall/address/index?select=1' })
      return
    }
    try {
      Taro.setStorageSync(MALL_SELECTED_ADDRESS_STORAGE_KEY, selectedAddress.id)
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
          onClick={() => Taro.navigateTo({ url: '/pages/mall/address/index?select=1' })}
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
            <View
              key={item.id}
              className="mall-v7-cart-swipe"
              onTouchStart={(event) => handleCartItemTouchStart(item.id, event)}
              onTouchMove={(event) => handleCartItemTouchMove(item.id, event)}
              onTouchEnd={(event) => handleCartItemTouchEnd(item.id, event)}
            >
              <View className="mall-v7-cart-delete-action" onClick={() => confirmDeleteCartItem(item)}>
                <Trash2 size={18} color="#FFFFFF" />
                <Text>删除</Text>
              </View>
              <View
                className={[
                  'mall-v7-cart-item',
                  item.selected ? 'mall-v7-cart-item-selected' : '',
                  swipedCartItemId === item.id ? 'mall-v7-cart-item-swiped' : '',
                ].filter(Boolean).join(' ')}
              >
                <View className={item.selected ? 'mall-v7-cart-check mall-v7-cart-check-active' : 'mall-v7-cart-check'} onClick={() => toggleItem(item)}>
                  {item.selected ? <Check size={16} color="#FFFFFF" /> : null}
                </View>
                <View className="mall-v7-cart-thumb" onClick={() => openCartItemProduct(item)}>
                  <MallProductThumb product={item.product} />
                </View>
                <View className="mall-v7-cart-copy" onClick={() => openCartItemProduct(item)}>
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
            </View>
          ))}
        </View>
      )}

      {cart.items.length > 0 ? (
        <View className="mall-total-bar mall-v7-fixed-checkout mall-v7-cart-checkout-panel">
          {discountDetailOpen ? (
            <View className="mall-v7-cart-discount-drawer">
              <DiscountDetailRow label="商品总计" value={mallYuan(discountDetail.subtotalCents)} />
              <DiscountDetailRow label="优惠券" value={`-${mallYuan(discountDetail.couponDiscountCents)}`} warm={discountDetail.couponDiscountCents > 0} />
              <DiscountDetailRow label="活动" value={`-${mallYuan(discountDetail.activityDiscountCents)}`} warm={discountDetail.activityDiscountCents > 0} />
              {discountDetail.memberDiscountCents > 0 ? (
                <DiscountDetailRow label="会员折扣" value={`-${mallYuan(discountDetail.memberDiscountCents)}`} warm />
              ) : null}
              {discountDetail.pointsRedeemedCents > 0 ? (
                <DiscountDetailRow label="积分抵扣" value={`-${mallYuan(discountDetail.pointsRedeemedCents)}`} warm />
              ) : null}
              <View className="mall-v7-cart-discount-divider" />
              <DiscountDetailRow label="运费" value={mallYuan(discountDetail.originalDeliveryFeeCents)} />
              <DiscountDetailRow label="免运费" value={`-${mallYuan(discountDetail.freeDeliveryDiscountCents)}`} warm={discountDetail.freeDeliveryDiscountCents > 0} />
              <View className="mall-v7-cart-discount-divider" />
              <DiscountDetailRow label="已省" value={mallYuan(discountDetail.savedCents)} strong warm={discountDetail.savedCents > 0} />
              <DiscountDetailRow label="实付" value={mallYuan(discountDetail.payableCents)} strong />
            </View>
          ) : null}
          <View className="mall-v7-cart-pay-row">
            <View className="mall-v7-cart-pay-copy" onClick={() => setDiscountDetailOpen((value) => !value)}>
              <Text className="mall-total-label">实付</Text>
              <View className="mall-v7-cart-pay-value-row">
                <Text className="mall-total-value">{mallYuan(payableCents)}</Text>
                <View className="mall-v7-cart-discount-toggle">
                  {discountDetailOpen ? <ChevronDown size={16} color="#FFFFFF" /> : <ChevronUp size={16} color="#FFFFFF" />}
                </View>
              </View>
              {discountDetail.savedCents > 0 ? <Text className="mall-v7-cart-pay-saved">已省 {mallYuan(discountDetail.savedCents)}</Text> : null}
            </View>
            <View className="mall-total-button" onClick={submitOrder}>
              <Text>去结算</Text>
            </View>
          </View>
        </View>
      ) : null}
    </MallPage>
  )
}

function DiscountDetailRow({
  label,
  value,
  warm = false,
  strong = false,
}: {
  label: string
  value: string
  warm?: boolean
  strong?: boolean
}) {
  const className = [
    'mall-v7-cart-discount-row',
    warm ? 'mall-v7-cart-discount-row-warm' : '',
    strong ? 'mall-v7-cart-discount-row-strong' : '',
  ].filter(Boolean).join(' ')

  return (
    <View className={className}>
      <Text>{label}</Text>
      <Text>{value}</Text>
    </View>
  )
}

function buildCartDiscountDetail(cart: MallCart, payableCents: number, savedCents: number) {
  const fullReductionCents = Math.max(
    cart.fullReductionCents ?? sumCartDiscountBreakdown(cart, 'full_reduction'),
    0,
  )
  const couponDiscountCents = Math.max(
    cart.couponDiscountCents ?? sumCartDiscountBreakdown(cart, 'coupon'),
    0,
  )
  const memberDiscountCents = Math.max(cart.memberDiscountCents ?? sumCartDiscountBreakdown(cart, 'member'), 0)
  const pointsRedeemedCents = Math.max(cart.pointsRedeemedCents ?? sumCartDiscountBreakdown(cart, 'points'), 0)
  const deliveryFeeCents = Math.max(cart.deliveryFeeCents || 0, 0)
  const cartWithDeliveryDiscount = cart as MallCart & {
    originalDeliveryFeeCents?: number
    freeDeliveryDiscountCents?: number
  }
  const freeDeliveryDiscountCents = Math.max(
    cart.deliveryDiscountCents
      ?? cartWithDeliveryDiscount.freeDeliveryDiscountCents
      ?? sumCartDiscountBreakdown(cart, 'delivery')
      ?? (deliveryFeeCents === 0 && cart.subtotalCents > 0 ? 600 : 0),
    0,
  )
  const originalDeliveryFeeCents = Math.max(
    cartWithDeliveryDiscount.originalDeliveryFeeCents ?? deliveryFeeCents,
    0,
  )

  return {
    subtotalCents: Math.max(cart.subtotalCents || 0, 0),
    couponDiscountCents,
    activityDiscountCents: fullReductionCents,
    memberDiscountCents,
    pointsRedeemedCents,
    originalDeliveryFeeCents,
    freeDeliveryDiscountCents,
    savedCents: Math.max(savedCents, 0),
    payableCents,
  }
}

function sumCartDiscountBreakdown(cart: MallCart, type: string) {
  return (cart.discountBreakdown || [])
    .filter((item) => item.type === type)
    .reduce((total, item) => total + Math.max(item.amountCents || 0, 0), 0)
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

function resolveSelectedAddressId(addresses: MallAddress[], currentAddressId: string) {
  const storedAddressId = String(Taro.getStorageSync(MALL_SELECTED_ADDRESS_STORAGE_KEY) || '')
  const matchedAddress = addresses.find((item) => item.id === currentAddressId)
    || addresses.find((item) => item.id === storedAddressId)
    || addresses.find((item) => item.isDefault || item.is_default)
    || addresses[0]
  return matchedAddress?.id || ''
}

function hasAddressLocation(address: MallAddress) {
  return Number.isFinite(Number(address.latitude)) && Number.isFinite(Number(address.longitude))
}

function getCartTouchPoint(event: unknown, key: 'touches' | 'changedTouches') {
  const touchEvent = event as {
    touches?: CartTouchPoint[]
    changedTouches?: CartTouchPoint[]
    detail?: {
      touches?: CartTouchPoint[]
      changedTouches?: CartTouchPoint[]
    }
  }
  return touchEvent[key]?.[0] || touchEvent.detail?.[key]?.[0]
}
