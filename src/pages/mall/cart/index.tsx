import { useEffect, useMemo, useState } from 'react'
import { Image, Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { Store } from 'lucide-react-taro'
import {
  deleteMallCartItem,
  getMallCart,
  listMallAddresses,
  resolveMallImageUrl,
  updateMallCartItem,
  type MallAddress,
  type MallCart,
} from '@/services/mall'
import {
  MallLocationStrip,
  MallPage,
  MallPrimaryButton,
  mallYuan,
} from '../mall-ui'

interface StoredUser {
  id?: string
}

export default function MallCartPage() {
  const [cart, setCart] = useState<MallCart>({ items: [], subtotalCents: 0, selectedCount: 0 })
  const [addresses, setAddresses] = useState<MallAddress[]>([])
  const [selectedAddressId, setSelectedAddressId] = useState('')
  const [loading, setLoading] = useState(false)

  const userId = (Taro.getStorageSync('userInfo') as StoredUser | undefined)?.id || ''
  const couponCents = cart.subtotalCents > 0 ? Math.min(600, cart.subtotalCents) : 0
  const payableCents = useMemo(
    () => Math.max(cart.subtotalCents - couponCents, 0),
    [cart.subtotalCents, couponCents],
  )

  useEffect(() => {
    guardLogin()
  }, [])

  useDidShow(() => {
    loadData()
  })

  const selectedAddress = addresses.find((item) => item.id === selectedAddressId)

  const guardLogin = () => {
    if (!userId) {
      Taro.showToast({ title: '请先登录', icon: 'none' })
      Taro.redirectTo({ url: '/pages/index/index' })
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

  const submitOrder = async () => {
    if (cart.selectedCount === 0) {
      Taro.showToast({ title: '购物车为空', icon: 'none' })
      return
    }
    Taro.navigateTo({ url: `/pages/mall/confirm/index?addressId=${selectedAddressId}` })
  }

  return (
    <MallPage active="cart">
      <Text className="mall-page-title">购物车</Text>

      <View style={{ marginTop: 14 }}>
        <MallLocationStrip
          title={selectedAddress?.addressLabel || selectedAddress?.address_name || '明日 16:00 后 · 绿荫花园自提点'}
          subtitle={selectedAddress?.addressText || selectedAddress?.address || '团长王姐 · 距离 320m，可冷藏代收'}
          onClick={() => Taro.navigateTo({ url: '/pages/mall/category/index?keyword=到点' })}
        />
      </View>

      {cart.items.length === 0 ? (
        <View className="mall-empty">
          <Text className="mall-empty-title">{loading ? '加载中...' : '购物车暂无商品'}</Text>
          <Text className="mall-empty-copy">去首页看看今日团购鲜品。</Text>
          <View style={{ marginTop: 14 }}>
            <MallPrimaryButton onClick={() => Taro.navigateTo({ url: '/pages/mall/index/index' })}>
              <Text>去逛逛</Text>
            </MallPrimaryButton>
          </View>
        </View>
      ) : (
        <>
          <View className="mall-card">
            <View style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Store size={18} color="#63BF54" />
                <Text className="mall-list-title">叁友甄选 · 今日团购</Text>
              </View>
              <View className="mall-hero-badge" style={{ marginTop: 0, background: '#FFF1E5', color: '#FF9238' }}>
                次日达
              </View>
            </View>

            {cart.items.map((item) => (
              <View key={item.id} className="mall-cart-item">
                <View className="mall-cart-thumb">
                  {item.product?.imageUrl ? (
                    <Image className="mall-product-image" mode="aspectFill" src={resolveMallImageUrl(item.product.imageUrl)} />
                  ) : null}
                </View>
                <View>
                  <Text className="mall-product-name" style={{ marginTop: 0 }}>
                    {item.product?.name || '商品'}
                  </Text>
                  <Text className="mall-product-subtitle">
                    {item.product?.subtitle || '基地直采 · 今日锁鲜'}
                  </Text>
                  <Text className="mall-price">{mallYuan(item.product?.priceCents)}</Text>
                </View>
                <View className="mall-stepper">
                  <Text className="mall-stepper-action mall-stepper-action-muted" onClick={() => changeQuantity(item.id, item.quantity - 1)}>−</Text>
                  <Text className="mall-stepper-value">{item.quantity}</Text>
                  <Text className="mall-stepper-action" onClick={() => changeQuantity(item.id, item.quantity + 1)}>＋</Text>
                </View>
              </View>
            ))}
          </View>

          <View className="mall-card mall-card-soft">
            <View className="mall-summary-row" style={{ marginTop: 0 }}>
              <Text className="mall-summary-label">满 49 减 6 已自动使用</Text>
              <Text className="mall-summary-value mall-summary-value-warm">-{mallYuan(couponCents)}</Text>
            </View>
          </View>

          <View className="mall-total-bar">
            <View>
              <Text className="mall-total-label">合计</Text>
              <Text className="mall-total-value">{mallYuan(payableCents)}</Text>
            </View>
            <View className="mall-total-button" onClick={submitOrder}>
              <Text>去结算</Text>
            </View>
          </View>
        </>
      )}
    </MallPage>
  )
}

function showError(error: unknown, fallback: string) {
  Taro.showToast({
    title: error instanceof Error ? error.message : fallback,
    icon: 'none',
  })
}
