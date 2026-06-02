import { useEffect, useMemo, useState } from 'react'
import { Image, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Search, ShoppingCart, Truck } from 'lucide-react-taro'
import { AppPageShell } from '@/components/layout/app-page-shell'
import { BottomNav } from '@/components/layout/bottom-nav'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  addMallCartItem,
  listMallProducts,
  resolveMallImageUrl,
  type MallProduct,
  yuan,
} from '@/services/mall'

interface StoredUser {
  id?: string
  role?: string
}

export default function MallHome() {
  const [products, setProducts] = useState<MallProduct[]>([])
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    loadProducts()
  }, [])

  const filteredProducts = useMemo(() => products, [products])

  const currentUser = () => Taro.getStorageSync('userInfo') as StoredUser | undefined

  const loadProducts = async () => {
    setLoading(true)
    setLoadError('')
    try {
      const data = await listMallProducts({
        keyword: keyword.trim() || undefined,
      })
      setProducts(data)
    } catch (error) {
      setProducts([])
      setLoadError(error instanceof Error ? error.message : '商品加载失败')
      showError(error, '商品加载失败')
    } finally {
      setLoading(false)
    }
  }

  const handleAddCart = async (product: MallProduct) => {
    const user = currentUser()
    if (!user?.id) {
      Taro.showToast({ title: '请先登录', icon: 'none' })
      Taro.redirectTo({ url: '/pages/index/index' })
      return
    }
    try {
      await addMallCartItem(user.id, product.id, 1)
      Taro.showToast({ title: '已加入购物车', icon: 'success' })
    } catch (error) {
      showError(error, '加入失败')
    }
  }

  return (
    <AppPageShell
      title="本地鲜选"
      subtitle="水果鲜奶今日达"
      icon={ShoppingCart}
      right={
        <Button
          size="icon"
          variant="outline"
          className="rounded-full"
          onClick={() => Taro.navigateTo({ url: '/pages/mall/cart/index' })}
        >
          <ShoppingCart size={18} color="#0062FF" />
        </Button>
      }
      bottom={<BottomNav type="merchant" active="mall" />}
      contentClassName="space-y-4"
    >
      <Card className="border-0 bg-gradient-to-br from-sky-500 to-emerald-500 text-white">
        <CardContent className="p-4">
          <Text className="block text-xl font-black text-white">周边 3km 鲜品专送</Text>
          <Text className="mt-1 block text-xs font-bold text-emerald-50">
            水果、鲜奶、烘焙同城拼单
          </Text>
        </CardContent>
      </Card>

      <View className="flex items-center gap-2">
        <Input
          value={keyword}
          placeholder="搜索水果、鲜奶、今日特价"
          onInput={(event) => setKeyword(String(event.detail.value || ''))}
        />
        <Button size="icon" className="shrink-0 rounded-full" onClick={loadProducts}>
          <Search size={18} color="#FFFFFF" />
        </Button>
      </View>

      <View className="flex items-center justify-between">
        <Text className="block text-base font-black text-gray-900">水果 / 鲜奶热卖</Text>
        <Text className="block text-xs font-bold text-gray-500">
          {loading ? '加载中' : `${filteredProducts.length} 件`}
        </Text>
      </View>

      {loadError ? (
        <Card className="bg-white">
          <CardContent className="p-4">
            <Text className="block text-sm font-black text-gray-900">商品加载失败</Text>
            <Text className="mt-1 block text-xs font-bold text-gray-500">{loadError}</Text>
            <Button className="mt-3 rounded-full" onClick={loadProducts}>
              <Text className="text-sm font-black text-white">重新加载</Text>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {!loading && !loadError && filteredProducts.length === 0 ? (
        <Card className="bg-white">
          <CardContent className="p-4">
            <Text className="block text-sm font-black text-gray-900">暂无可售商品</Text>
            <Text className="mt-1 block text-xs font-bold text-gray-500">
              当前搜索没有匹配商品，可以清空关键词后重试。
            </Text>
          </CardContent>
        </Card>
      ) : null}

      <View className="flex flex-row flex-wrap justify-between gap-y-3">
        {filteredProducts.map((product) => (
          <Card key={product.id} className="bg-white" style={{ width: '48.5%' }}>
            <CardContent className="p-3">
              <View
                className="mb-3 flex h-24 items-center justify-center overflow-hidden rounded-2xl bg-emerald-50"
                onClick={() => Taro.navigateTo({ url: `/pages/mall/product/index?id=${product.id}` })}
              >
                {product.imageUrl ? (
                  <Image
                    className="h-full w-full"
                    mode="aspectFill"
                    src={resolveMallImageUrl(product.imageUrl)}
                  />
                ) : (
                  <Text className="block text-lg font-black text-emerald-600">
                    {product.categoryCode === 'milk' ? 'MILK' : 'FRUIT'}
                  </Text>
                )}
              </View>
              <View className="mb-2 flex flex-wrap gap-1">
                {product.tags.slice(0, 2).map((tag) => (
                  <Badge key={tag} className="bg-emerald-100">
                    <Text className="text-xs font-bold text-emerald-700">{tag}</Text>
                  </Badge>
                ))}
              </View>
              <Text className="block text-sm font-black text-gray-900">{product.name}</Text>
              <Text className="mt-1 block text-xs font-bold text-gray-500">
                {product.subtitle || `${product.deliveryMinutes} 分钟达`}
              </Text>
              <View className="mt-3 flex items-center justify-between">
                <Text className="block text-base font-black text-red-500">
                  {yuan(product.priceCents)}
                </Text>
                <Button
                  size="icon"
                  className="h-9 w-9 rounded-full bg-emerald-500"
                  onClick={() => handleAddCart(product)}
                >
                  <Text className="text-lg font-black text-white">+</Text>
                </Button>
              </View>
            </CardContent>
          </Card>
        ))}
      </View>

      <Card className="bg-emerald-50">
        <CardContent className="flex items-center gap-3 p-4">
          <Truck size={24} color="#10B981" />
          <View className="flex-1">
            <Text className="block text-sm font-black text-gray-900">
              RecoRouter 本地无人车配送
            </Text>
            <Text className="mt-1 block text-xs font-bold text-emerald-700">
              3km 内最快 18 分钟送达，冷链鲜奶全程温控
            </Text>
          </View>
        </CardContent>
      </Card>
    </AppPageShell>
  )
}

function showError(error: unknown, fallback: string) {
  Taro.showToast({
    title: error instanceof Error ? error.message : fallback,
    icon: 'none',
  })
}
