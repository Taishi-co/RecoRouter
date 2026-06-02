import { useEffect, useMemo, useState } from 'react'
import { Image, Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { MapPin, ShoppingCart } from 'lucide-react-taro'
import { AppPageShell } from '@/components/layout/app-page-shell'
import { BottomNav } from '@/components/layout/bottom-nav'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  createMallAddress,
  createMallOrder,
  deleteMallCartItem,
  getMallCart,
  listMallAddresses,
  resolveMallImageUrl,
  updateMallCartItem,
  type MallAddress,
  type MallCart,
  yuan,
} from '@/services/mall'

interface StoredUser {
  id?: string
}

export default function MallCartPage() {
  const [cart, setCart] = useState<MallCart>({ items: [], subtotalCents: 0, selectedCount: 0 })
  const [addresses, setAddresses] = useState<MallAddress[]>([])
  const [selectedAddressId, setSelectedAddressId] = useState('')
  const [loading, setLoading] = useState(false)
  const [addressName, setAddressName] = useState('Haymarket 88号 12F')
  const [addressText, setAddressText] = useState('Haymarket 88号 12F, Sydney NSW')
  const [phoneSuffix, setPhoneSuffix] = useState('陈女士')

  const userId = (Taro.getStorageSync('userInfo') as StoredUser | undefined)?.id || ''
  const deliveryFeeCents = cart.subtotalCents >= 9900 ? 0 : 600
  const couponCents = cart.subtotalCents > 0 ? Math.min(1000, cart.subtotalCents) : 0
  const payableCents = useMemo(
    () => Math.max(cart.subtotalCents + deliveryFeeCents - couponCents, 0),
    [cart.subtotalCents, deliveryFeeCents, couponCents],
  )

  useEffect(() => {
    guardLogin()
  }, [])

  useDidShow(() => {
    loadData()
  })

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
      const defaultAddress = nextAddresses.find((item) => item.is_default) || nextAddresses[0]
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
    if (quantity <= 0) {
      await deleteMallCartItem(id)
    } else {
      await updateMallCartItem(id, { quantity })
    }
    loadData()
  }

  const addAddress = async () => {
    if (!addressName.trim() || !addressText.trim()) {
      Taro.showToast({ title: '请填写地址', icon: 'none' })
      return
    }
    try {
      const address = await createMallAddress({
        user_id: userId,
        address_name: addressName,
        address: `${addressText} · ${phoneSuffix}`,
        latitude: -33.8796,
        longitude: 151.2056,
        address_type: 'home',
        is_default: addresses.length === 0,
      })
      setSelectedAddressId(address.id)
      loadData()
      Taro.showToast({ title: '地址已保存', icon: 'success' })
    } catch (error) {
      showError(error, '保存失败')
    }
  }

  const submitOrder = async () => {
    if (!selectedAddressId) {
      Taro.showToast({ title: '请选择配送地址', icon: 'none' })
      return
    }
    if (cart.selectedCount === 0) {
      Taro.showToast({ title: '购物车为空', icon: 'none' })
      return
    }
    try {
      const order = await createMallOrder({
        userId,
        addressId: selectedAddressId,
        expectedDeliveryWindow: '今天 18:30-19:00',
        deliveryMethod: '无人车冷链直送',
        pickupMethod: '短信码开舱',
        couponCents,
      })
      Taro.showToast({ title: '订单已提交', icon: 'success' })
      Taro.navigateTo({ url: `/pages/mall/orders/index?orderId=${order.id}` })
    } catch (error) {
      showError(error, '提交失败')
    }
  }

  return (
    <AppPageShell
      title="购物车"
      subtitle={loading ? '加载中...' : `${cart.selectedCount} 件鲜食待结算`}
      icon={ShoppingCart}
      bottom={<BottomNav type="merchant" active="mall" />}
      contentClassName="space-y-4"
    >
      <Card className="bg-blue-50">
        <CardContent className="p-4">
          <Text className="block text-sm font-black text-blue-700">
            满 ¥99 免配送费，还差 {yuan(Math.max(9900 - cart.subtotalCents, 0))}
          </Text>
        </CardContent>
      </Card>

      {cart.items.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Text className="block text-sm font-bold text-gray-500">购物车暂无商品</Text>
            <Button className="mt-4 rounded-full" onClick={() => Taro.navigateTo({ url: '/pages/mall/index/index' })}>
              <Text className="text-sm font-black text-white">去逛逛</Text>
            </Button>
          </CardContent>
        </Card>
      ) : (
        cart.items.map((item) => (
          <Card key={item.id}>
            <CardContent className="p-4">
              <View className="flex gap-3">
                <View className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-emerald-50">
                  {item.product?.imageUrl ? (
                    <Image
                      className="h-full w-full"
                      mode="aspectFill"
                      src={resolveMallImageUrl(item.product.imageUrl)}
                    />
                  ) : (
                    <Text className="text-xs font-black text-emerald-600">
                      {item.product?.categoryCode === 'milk' ? 'MILK' : 'FOOD'}
                    </Text>
                  )}
                </View>
                <View className="min-w-0 flex-1">
                  <Text className="block text-sm font-black text-gray-900">
                    {item.product?.name || '商品'}
                  </Text>
                  <Text className="mt-1 block text-xs font-bold text-gray-500">
                    {item.product?.subtitle || '无人车配送'}
                  </Text>
                  <View className="mt-3 flex items-center justify-between">
                    <Text className="block text-sm font-black text-emerald-600">
                      {yuan(item.product?.priceCents)}
                    </Text>
                    <View className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => changeQuantity(item.id, item.quantity - 1)}>
                        <Text className="text-sm font-black">-</Text>
                      </Button>
                      <Text className="block text-sm font-black text-gray-900">{item.quantity}</Text>
                      <Button size="sm" onClick={() => changeQuantity(item.id, item.quantity + 1)}>
                        <Text className="text-sm font-black text-white">+</Text>
                      </Button>
                    </View>
                  </View>
                </View>
              </View>
            </CardContent>
          </Card>
        ))
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            <Text className="text-base font-black text-gray-900">配送地址</Text>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {addresses.map((address) => (
            <View
              key={address.id}
              className="rounded-xl border border-gray-200 p-3"
              onClick={() => setSelectedAddressId(address.id)}
            >
              <View className="flex items-center justify-between">
                <Text className="block text-sm font-black text-gray-900">{address.address_name}</Text>
                {selectedAddressId === address.id && (
                  <Badge className="bg-emerald-500">
                    <Text className="text-xs text-white">使用中</Text>
                  </Badge>
                )}
              </View>
              <Text className="mt-1 block text-xs font-bold text-gray-500">{address.address}</Text>
            </View>
          ))}

          <View className="space-y-2 rounded-xl bg-gray-50 p-3">
            <View className="flex items-center gap-2">
              <MapPin size={18} color="#10B981" />
              <Text className="block text-sm font-black text-gray-900">新增 / 编辑地址</Text>
            </View>
            <Input value={addressName} placeholder="地址名" onInput={(event) => setAddressName(String(event.detail.value || ''))} />
            <Input value={addressText} placeholder="详细地址" onInput={(event) => setAddressText(String(event.detail.value || ''))} />
            <Input value={phoneSuffix} placeholder="联系人" onInput={(event) => setPhoneSuffix(String(event.detail.value || ''))} />
            <Button variant="outline" className="w-full rounded-full" onClick={addAddress}>
              <Text className="text-sm font-black text-primary">保存并使用</Text>
            </Button>
          </View>
        </CardContent>
      </Card>

      <Card className="mb-4 bg-gray-950">
        <CardContent className="p-4">
          <View className="space-y-2">
            <Row label="商品合计" value={yuan(cart.subtotalCents)} dark />
            <Row label="配送费" value={yuan(deliveryFeeCents)} dark />
            <Row label="优惠券" value={`- ${yuan(couponCents)}`} dark />
          </View>
          <View className="mt-4 flex items-center justify-between">
            <View>
              <Text className="block text-lg font-black text-white">实付 {yuan(payableCents)}</Text>
              <Text className="mt-1 block text-xs font-bold text-emerald-100">预计 18:45 送达</Text>
            </View>
            <Button className="rounded-full bg-emerald-500" onClick={submitOrder}>
              <Text className="text-sm font-black text-white">提交订单</Text>
            </Button>
          </View>
        </CardContent>
      </Card>
    </AppPageShell>
  )
}

const Row = ({ label, value, dark }: { label: string; value: string; dark?: boolean }) => (
  <View className="flex items-center justify-between">
    <Text className={dark ? 'block text-sm font-bold text-gray-300' : 'block text-sm font-bold text-gray-500'}>
      {label}
    </Text>
    <Text className={dark ? 'block text-sm font-black text-white' : 'block text-sm font-black text-gray-900'}>
      {value}
    </Text>
  </View>
)

function showError(error: unknown, fallback: string) {
  Taro.showToast({
    title: error instanceof Error ? error.message : fallback,
    icon: 'none',
  })
}
