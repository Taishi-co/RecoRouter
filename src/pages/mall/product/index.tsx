import { useEffect, useState } from 'react'
import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { ChevronLeft, Share2, ShoppingCart } from 'lucide-react-taro'
import { addMallCartItem, getMallProduct, type MallProduct } from '@/services/mall'
import {
  MallLocationStrip,
  MallPage,
  MallPrimaryButton,
  MallProductThumb,
  mallYuan,
} from '../mall-ui'

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
    <MallPage active="home">
      <View className="mall-back-row">
        <ChevronLeft size={24} color="#1F2D1F" onClick={() => Taro.navigateBack()} />
      </View>

      {loading || !product ? (
        <View className="mall-empty">
          <Text className="mall-empty-title">加载中...</Text>
        </View>
      ) : (
        <>
          <MallProductThumb product={product} large />

          <View className="mall-card">
            <View style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text className="mall-page-title">{product.name}</Text>
                <Text className="mall-page-subtitle">
                  {product.description || product.subtitle || '团长验货 · 产地直发 · 坏果包退'}
                </Text>
              </View>
              <View className="mall-location-switch">
                <Share2 size={18} color="#63BF54" />
              </View>
            </View>
            <View style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text className="mall-price-large">{mallYuan(product.priceCents)}</Text>
              <View className="mall-hero-badge" style={{ marginTop: 0, background: '#FFF1E5', color: '#FF9238' }}>
                余 {product.stock} 份
              </View>
            </View>
          </View>

          <View className="mall-chip-row">
            <View className="mall-chip">
              <Text className="mall-chip-title">新鲜</Text>
              <Text className="mall-chip-copy">今日采摘</Text>
            </View>
            <View className="mall-chip">
              <Text className="mall-chip-title">安心</Text>
              <Text className="mall-chip-copy">团长验收</Text>
            </View>
            <View className="mall-chip">
              <Text className="mall-chip-title">品质</Text>
              <Text className="mall-chip-copy">坏果包退</Text>
            </View>
          </View>

          <View style={{ marginTop: 14 }}>
            <MallLocationStrip />
          </View>

          <View className="mall-action-row">
            <MallPrimaryButton subtle onClick={() => handleAddCart(false)}>
              <ShoppingCart size={18} color="#FF9238" />
              <Text style={{ marginLeft: 6 }}>加入购物车</Text>
            </MallPrimaryButton>
            <MallPrimaryButton onClick={() => handleAddCart(true)}>
              <Text>＋ 立即选购</Text>
            </MallPrimaryButton>
          </View>
        </>
      )}
    </MallPage>
  )
}
