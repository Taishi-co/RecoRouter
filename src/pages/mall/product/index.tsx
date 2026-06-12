import { useEffect, useState } from 'react'
import { Text, View } from '@tarojs/components'
import Taro, { useShareAppMessage } from '@tarojs/taro'
import { ChevronLeft, Share2, ShoppingCart } from 'lucide-react-taro'
import { Button } from '@/components/ui/button'
import {
  addMallCartItem,
  createMallCheckout,
  getMallProduct,
  resolveMallImageUrl,
  type MallProduct,
} from '@/services/mall'
import {
  MallLocationStrip,
  MallPage,
  MallPrimaryButton,
  MallProductThumb,
  mallYuan,
} from '../mall-ui'
import { redirectToMallAuth } from '../auth-route'

interface StoredUser {
  id?: string
}

export default function MallProductDetail() {
  const [product, setProduct] = useState<MallProduct | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    Taro.showShareMenu?.({ withShareTicket: true })
    const id = Taro.getCurrentInstance().router?.params?.id
    if (!id) {
      Taro.showToast({ title: '商品参数缺失', icon: 'none' })
      Taro.navigateBack()
      return
    }
    loadProduct(id)
  }, [])

  useShareAppMessage(() => ({
    title: product?.name ? `叁友甄选｜${product.name}` : '叁友甄选',
    path: `/pages/mall/product/index?id=${product?.id || ''}`,
    imageUrl: resolveMallImageUrl(product?.imageUrl),
  }))

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

  const requireUser = () => {
    if (!product) return
    const user = Taro.getStorageSync('userInfo') as StoredUser | undefined
    if (!user?.id) {
      Taro.showToast({ title: '请先登录', icon: 'none' })
      redirectToMallAuth(`/pages/mall/product/index?id=${product.id}`)
      return null
    }
    return user
  }

  const handleAddCart = async () => {
    if (!product) return
    const user = requireUser()
    if (!user?.id) return
    try {
      await addMallCartItem(user.id, product.id, minimumOrderQuantity(product))
      Taro.showToast({ title: '已加入购物车', icon: 'success' })
    } catch (error) {
      Taro.showToast({
        title: error instanceof Error ? error.message : '加入失败',
        icon: 'none',
      })
    }
  }

  const handleBuyNow = async () => {
    if (!product) return
    const user = requireUser()
    if (!user?.id) return
    try {
      const checkout = await createMallCheckout({
        userId: user.id,
        source: 'buy_now',
        productId: product.id,
        quantity: minimumOrderQuantity(product),
      })
      Taro.navigateTo({ url: `/pages/mall/confirm/index?checkoutId=${checkout.id}` })
    } catch (error) {
      Taro.showToast({
        title: error instanceof Error ? error.message : '立即选购失败',
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
              <Button className="mall-share-button" openType="share">
                <Share2 size={18} color="#63BF54" />
              </Button>
            </View>
            <View style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text className="mall-price-large">{mallYuan(product.priceCents)}</Text>
              <View className="mall-hero-badge" style={{ marginTop: 0, background: '#FFF1E5', color: '#FF9238' }}>
                起订 {minimumOrderQuantity(product)}
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

          <ProductDetailSections product={product} />

          <View className="mall-action-row">
            <MallPrimaryButton subtle onClick={handleAddCart}>
              <ShoppingCart size={18} color="#FF9238" />
              <Text style={{ marginLeft: 6 }}>加入购物车</Text>
            </MallPrimaryButton>
            <MallPrimaryButton onClick={handleBuyNow}>
              <Text>＋ 立即选购</Text>
            </MallPrimaryButton>
          </View>
        </>
      )}
    </MallPage>
  )
}

function ProductDetailSections({ product }: { product: MallProduct }) {
  const detailParagraphs = splitProductDescription(product.description || product.subtitle)
  const specs = buildPublicSpecs(product)
  return (
    <View className="mall-product-detail-panel">
      <View className="mall-product-detail-section">
        <Text className="mall-product-detail-title">商品详情</Text>
        <View className="mall-product-detail-copy">
          {detailParagraphs.map((paragraph, index) => (
            <Text key={`${paragraph}-${index}`}>{paragraph}</Text>
          ))}
        </View>
      </View>

      <View className="mall-product-detail-section">
        <Text className="mall-product-detail-title">规格参数</Text>
        <View className="mall-product-spec-grid">
          {specs.map((spec) => (
            <View key={spec.label} className="mall-product-spec-row">
              <Text className="mall-product-spec-label">{spec.label}</Text>
              <Text className="mall-product-spec-value">{spec.value}</Text>
            </View>
          ))}
        </View>
      </View>

      <View className="mall-product-detail-section">
        <Text className="mall-product-detail-title">起订信息</Text>
        <View className="mall-product-order-box">
          <Text>最小起订量 {minimumOrderQuantity(product)} 件</Text>
          <Text>库存 {product.stock} 件，下单数量不足起订量时将按起订量加入购物车</Text>
        </View>
      </View>

      <View className="mall-product-detail-section">
        <Text className="mall-product-detail-title">售后说明</Text>
        <View className="mall-product-detail-copy">
          <Text>商品到自提点后请及时核验，坏果、破损、错发可在订单内提交售后。</Text>
          <Text>生鲜商品以实际到货批次为准，临期、冷链等特殊商品以下单页说明为准。</Text>
        </View>
      </View>
    </View>
  )
}

function splitProductDescription(value?: string | null) {
  const paragraphs = (value || '')
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean)
  return paragraphs.length ? paragraphs : ['团长验货，按自提点集中履约。商品批次、规格和包装以实际到货为准。']
}

function buildPublicSpecs(product: MallProduct) {
  return [
    { label: '销售规格', value: product.specification || product.subtitle || '-' },
    { label: '售卖方式', value: product.saleMethod || '按份' },
    { label: '类目', value: product.categoryName || product.categoryCode || '-' },
    { label: '配送时效', value: `${product.deliveryMinutes || 18} 分钟内到点` },
    { label: '库存', value: `${product.stock} 件` },
    { label: 'SKU', value: product.sku || '-' },
  ]
}

function minimumOrderQuantity(product: MallProduct) {
  return Math.max(Number(product.minimumOrderQuantity || 1), 1)
}
