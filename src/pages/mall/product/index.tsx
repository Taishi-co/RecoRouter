import { useEffect, useState } from 'react'
import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { ChevronLeft, ShoppingCart, Truck } from 'lucide-react-taro'
import { AppPageShell } from '@/components/layout/app-page-shell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { addMallCartItem, getMallProduct, type MallProduct, yuan } from '@/services/mall'

interface StoredUser {
  id?: string
}

export default function MallProductDetail() {
  const [product, setProduct] = useState<MallProduct | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const id = Taro.getCurrentInstance().router?.params?.id
    if (!id) {
      Taro.showToast({ title: '商品参数缺失', icon: 'none' })
      Taro.navigateBack()
      return
    }
    loadProduct(id)
  }, [])

  const loadProduct = async (id: string) => {
    setLoading(true)
    try {
      setProduct(await getMallProduct(id))
    } catch (error) {
      Taro.showToast({
        title: error instanceof Error ? error.message : '加载失败',
        icon: 'none',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleAddCart = async (goCart: boolean) => {
    if (!product) return
    const user = Taro.getStorageSync('userInfo') as StoredUser | undefined
    if (!user?.id) {
      Taro.showToast({ title: '请先登录', icon: 'none' })
      Taro.redirectTo({ url: '/pages/index/index' })
      return
    }
    try {
      await addMallCartItem(user.id, product.id, 1)
      Taro.showToast({ title: '已加入购物车', icon: 'success' })
      if (goCart) {
        Taro.navigateTo({ url: '/pages/mall/cart/index' })
      }
    } catch (error) {
      Taro.showToast({
        title: error instanceof Error ? error.message : '加入失败',
        icon: 'none',
      })
    }
  }

  return (
    <AppPageShell
      title={product?.name || '商品详情'}
      subtitle={product?.subtitle || '产地直采 18 分钟达'}
      icon={ShoppingCart}
      right={
        <Button size="icon" variant="outline" className="rounded-full" onClick={() => Taro.navigateBack()}>
          <ChevronLeft size={18} color="#0062FF" />
        </Button>
      }
      contentClassName="space-y-4"
    >
      {loading || !product ? (
        <Card>
          <CardContent className="p-6">
            <Text className="block text-center text-sm text-gray-500">加载中...</Text>
          </CardContent>
        </Card>
      ) : (
        <>
          <View className="flex h-56 items-center justify-center rounded-3xl bg-red-100">
            <Text className="block text-3xl font-black text-red-600">
              {product.categoryCode === 'milk' ? 'MILK' : 'STRAWBERRY'}
            </Text>
          </View>

          <View>
            <Text className="block text-2xl font-black text-gray-900">{product.name}</Text>
            <Text className="mt-2 block text-sm font-bold text-gray-500">
              {product.description || product.subtitle}
            </Text>
          </View>

          <View className="flex items-end justify-between">
            <Text className="block text-3xl font-black text-red-500">
              {yuan(product.priceCents)}
            </Text>
            <Text className="block text-xs font-bold text-gray-500">
              月售 {product.soldCount} · 好评 {product.rating}%
            </Text>
          </View>

          <View className="flex flex-wrap gap-2">
            {product.tags.map((tag) => (
              <Badge key={tag} className="bg-emerald-100">
                <Text className="text-xs font-black text-emerald-700">{tag}</Text>
              </Badge>
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
                  3km 内最快 {product.deliveryMinutes} 分钟送达，冷链鲜奶全程温控
                </Text>
              </View>
            </CardContent>
          </Card>

          <View className="flex gap-3 pb-4">
            <Button variant="outline" className="flex-1 rounded-full" onClick={() => handleAddCart(false)}>
              <Text className="text-sm font-black text-emerald-600">加入购物车</Text>
            </Button>
            <Button className="flex-1 rounded-full bg-emerald-500" onClick={() => handleAddCart(true)}>
              <Text className="text-sm font-black text-white">立即购买</Text>
            </Button>
          </View>
        </>
      )}
    </AppPageShell>
  )
}
