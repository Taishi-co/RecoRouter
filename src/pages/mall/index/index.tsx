import { useMemo, useState } from 'react'
import { Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { Apple, Beef, Leaf, MapPin, ShieldCheck, UsersRound } from 'lucide-react-taro'
import {
  addMallCartItem,
  listMallProducts,
  type MallProduct,
} from '@/services/mall'
import {
  MallPage,
  MallProductThumb,
  MallSearchBox,
  MallSectionTitle,
  mallYuan,
} from '../mall-ui'
import { redirectToMallAuth } from '../auth-route'

interface StoredUser {
  id?: string
  role?: string
}

const shortcuts = [
  { label: '今日鲜果', icon: Apple },
  { label: '安心蔬菜', icon: Leaf },
  { label: '肉禽蛋奶', icon: Beef },
  { label: '邻里团购', icon: UsersRound },
]

export default function MallHome() {
  const [products, setProducts] = useState<MallProduct[]>([])
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')

  useDidShow(() => {
    loadProducts()
  })

  const featuredProducts = useMemo(() => products.slice(0, 4), [products])

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
      Taro.showToast({
        title: error instanceof Error ? error.message : '商品加载失败',
        icon: 'none',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleAddCart = async (product: MallProduct) => {
    const user = currentUser()
    if (!user?.id) {
      Taro.showToast({ title: '请先登录', icon: 'none' })
      redirectToMallAuth('/pages/mall/index/index')
      return
    }
    try {
      await addMallCartItem(user.id, product.id, 1)
      Taro.showToast({ title: '已加入购物车', icon: 'success' })
    } catch (error) {
      Taro.showToast({
        title: error instanceof Error ? error.message : '加入失败',
        icon: 'none',
      })
    }
  }

  return (
    <MallPage active="home">
      <Text className="mall-location-label">今日自提点</Text>
      <View className="mall-location-current">
        <Text className="mall-location-current-title">绿荫花园 3 号楼团长点</Text>
        <View className="mall-location-switch" onClick={() => Taro.navigateTo({ url: '/pages/mall/cart/index?panel=address' })}>
          <MapPin size={14} color="#63BF54" />
          <Text className="mall-location-switch-text">切换</Text>
        </View>
      </View>

      <View className="mall-hero">
        <Text className="mall-hero-title">叁友甄选</Text>
        <Text className="mall-hero-copy">邻里一起拼，新鲜果蔬当天到点</Text>
        <View className="mall-hero-badge">
          <ShieldCheck size={14} color="#FFFFFF" />
          <Text>安心溯源</Text>
        </View>
        <View className="mall-hero-fruit">
          <View className="mall-hero-orange" />
          <View className="mall-hero-avocado" />
          <View className="mall-hero-seed" />
          <View className="mall-hero-leaf" />
        </View>
      </View>

      <MallSearchBox
        value={keyword}
        placeholder="搜索鸡蛋、草莓、现摘青菜"
        onInput={setKeyword}
        onSearch={loadProducts}
      />

      <View className="mall-shortcuts">
        {shortcuts.map((item) => {
          const Icon = item.icon
          return (
            <View
              key={item.label}
              className="mall-shortcut"
              onClick={() => Taro.navigateTo({ url: `/pages/mall/category/index?keyword=${encodeURIComponent(item.label)}` })}
            >
              <Icon size={25} color="#63BF54" />
              <Text className="mall-shortcut-label">{item.label}</Text>
            </View>
          )
        })}
      </View>

      <MallSectionTitle
        title="今日邻里精选"
        action="查看全部"
        onAction={() => Taro.navigateTo({ url: '/pages/mall/category/index' })}
      />

      {loadError ? (
        <View className="mall-empty">
          <Text className="mall-empty-title">商品加载失败</Text>
          <Text className="mall-empty-copy">{loadError}</Text>
          <View className="mall-button" style={{ marginTop: 14 }} onClick={loadProducts}>
            重新加载
          </View>
        </View>
      ) : null}

      {!loading && !loadError && featuredProducts.length === 0 ? (
        <View className="mall-empty">
          <Text className="mall-empty-title">暂无可售商品</Text>
          <Text className="mall-empty-copy">团长补货中，请稍后再来。</Text>
        </View>
      ) : null}

      <View className="mall-product-grid">
        {featuredProducts.map((product) => (
          <View key={product.id} className="mall-product-card">
            <View onClick={() => Taro.navigateTo({ url: `/pages/mall/product/index?id=${product.id}` })}>
              <MallProductThumb product={product} />
              <Text className="mall-product-name">{product.name}</Text>
              <Text className="mall-product-subtitle">
                {product.subtitle || product.categoryName || `${product.deliveryMinutes} 分钟达`}
              </Text>
            </View>
            <View className="mall-product-footer">
              <Text className="mall-price">{mallYuan(product.priceCents)}</Text>
              <View className="mall-add" onClick={() => handleAddCart(product)}>+</View>
            </View>
          </View>
        ))}
      </View>
    </MallPage>
  )
}
