import { useEffect, useMemo, useState } from 'react'
import { Image, Swiper, SwiperItem, Text, View } from '@tarojs/components'
import Taro, { useShareAppMessage } from '@tarojs/taro'
import { ChevronLeft, Share2, ShoppingCart } from 'lucide-react-taro'
import { Button } from '@/components/ui/button'
import {
  addMallCartItem,
  createMallCheckout,
  getMallProduct,
  resolveMallImageUrl,
  type MallProduct,
  type MallProductVariant,
} from '@/services/mall'
import {
  MallLocationStrip,
  MallPage,
  MallPrimaryButton,
  mallYuan,
} from '../mall-ui'
import { redirectToMallAuth } from '../auth-route'

interface StoredUser {
  id?: string
}

export default function MallProductDetail() {
  const [product, setProduct] = useState<MallProduct | null>(null)
  const [selectedVariantId, setSelectedVariantId] = useState('')
  const [loading, setLoading] = useState(false)
  const variants = useMemo(() => productVariants(product), [product])
  const selectedVariant = useMemo(() => {
    if (!variants.length) return null
    return variants.find((variant) => variant.id === selectedVariantId) || variants[0]
  }, [selectedVariantId, variants])

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

  useEffect(() => {
    if (!product) return
    const nextVariants = productVariants(product)
    const defaultVariantId = product.defaultVariantId || nextVariants[0]?.id || ''
    setSelectedVariantId((current) => (
      nextVariants.some((variant) => variant.id === current) ? current : defaultVariantId
    ))
  }, [product])

  useShareAppMessage(() => ({
    title: product?.name ? `叁友甄选｜${product.name}` : '叁友甄选',
    path: `/pages/mall/product/index?id=${product?.id || ''}`,
    imageUrl: productImageUrls(product)[0] || resolveMallImageUrl(product?.imageUrl),
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
      if (!selectedVariant) {
        Taro.showToast({ title: '请选择规格', icon: 'none' })
        return
      }
      await addMallCartItem(user.id, product.id, minimumOrderQuantity(product, selectedVariant), selectedVariant.id)
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
        variantId: selectedVariant?.id || undefined,
        quantity: minimumOrderQuantity(product, selectedVariant),
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
          <MallProductImageCarousel product={product} />

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
              <Text className="mall-price-large">{mallYuan(productPriceCents(product, selectedVariant))}</Text>
              <View className="mall-hero-badge" style={{ marginTop: 0, background: '#FFF1E5', color: '#FF9238' }}>
                起订 {minimumOrderQuantity(product, selectedVariant)}
              </View>
            </View>
          </View>

          <VariantSelector
            product={product}
            variants={variants}
            selectedVariant={selectedVariant}
            onSelect={setSelectedVariantId}
          />

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

          <ProductDetailSections product={product} selectedVariant={selectedVariant} />

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

function MallProductImageCarousel({ product }: { product: MallProduct }) {
  const images = productImageUrls(product)
  if (!images.length) {
    return (
      <View className="mall-product-carousel-empty">
        <Text>暂无商品图片</Text>
      </View>
    )
  }

  return (
    <View className="mall-product-carousel-wrap">
      <Swiper className="mall-product-carousel" circular={images.length > 1} indicatorDots={images.length > 1}>
        {images.map((imageUrl, index) => (
          <SwiperItem key={`${imageUrl}-${index}`}>
            <Image className="mall-product-carousel-image" mode="aspectFill" src={imageUrl} />
          </SwiperItem>
        ))}
      </Swiper>
      <Text className="mall-product-carousel-count">{images.length} 张</Text>
    </View>
  )
}

function productImageUrls(product?: MallProduct | null) {
  const rawImages = [
    ...(product?.images || []),
    product?.imageUrl || '',
  ]
  const seen = new Set<string>()
  return rawImages
    .map((image) => resolveMallImageUrl(image))
    .filter(Boolean)
    .filter((image) => {
      if (seen.has(image)) return false
      seen.add(image)
      return true
    })
}

function VariantSelector({
  product,
  variants,
  selectedVariant,
  onSelect,
}: {
  product: MallProduct
  variants: MallProductVariant[]
  selectedVariant: MallProductVariant | null
  onSelect: (id: string) => void
}) {
  if (variants.length <= 1) {
    const variant = variants[0] || selectedVariant
    return (
      <View className="mall-card mall-variant-panel">
        <View className="mall-variant-head">
          <Text>规格</Text>
          <Text>{variant?.name || product.specification || '默认规格'}</Text>
        </View>
        <View className="mall-variant-single">
          <Text>{variant?.specification || product.specification || product.saleMethod || '按份'}</Text>
          <Text>库存 {variant?.stock ?? product.stock}</Text>
        </View>
        {variant?.pricingMode === 'weighed' ? (
          <Text className="mall-variant-weigh-note">{weighedVariantRangeText(variant, minimumOrderQuantity(product, variant))}</Text>
        ) : null}
      </View>
    )
  }

  return (
    <View className="mall-card mall-variant-panel">
      <View className="mall-variant-head">
        <Text>选择规格</Text>
        <Text>{selectedVariant?.name || '请选择'}</Text>
      </View>
      <View className="mall-variant-grid">
        {variants.map((variant) => {
          const active = selectedVariant?.id === variant.id
          const disabled = variant.stock <= 0 || variant.status !== 'on_sale'
          return (
            <View
              key={variant.id}
              className={[
                'mall-variant-option',
                active ? 'mall-variant-option-active' : '',
                disabled ? 'mall-variant-option-disabled' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => {
                if (!disabled) onSelect(variant.id)
              }}
            >
              <Text className="mall-variant-option-name">{variant.name}</Text>
              <Text className="mall-variant-option-meta">
                {variant.specification || variant.saleMethod || '按份'} · {mallYuan(variant.priceCents)}
              </Text>
              <Text className="mall-variant-option-stock">库存 {variant.stock}</Text>
              {variant.pricingMode === 'weighed' ? (
                <Text className="mall-variant-option-stock">{weighedVariantRangeText(variant, minimumOrderQuantity(product, variant))}</Text>
              ) : null}
            </View>
          )
        })}
      </View>
    </View>
  )
}

function ProductDetailSections({
  product,
  selectedVariant,
}: {
  product: MallProduct
  selectedVariant: MallProductVariant | null
}) {
  const detailParagraphs = splitProductDescription(product.description || product.subtitle)
  const specs = buildPublicSpecs(product, selectedVariant)
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
          <Text>最小起订量 {minimumOrderQuantity(product, selectedVariant)} 件</Text>
          <Text>库存 {selectedVariant?.stock ?? product.stock} 件，下单数量不足起订量时将按起订量加入购物车</Text>
          {selectedVariant?.pricingMode === 'weighed' ? (
            <Text>{weighedVariantRangeText(selectedVariant, minimumOrderQuantity(product, selectedVariant))}，实际金额由客服称重后确认。</Text>
          ) : null}
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

function buildPublicSpecs(product: MallProduct, selectedVariant?: MallProductVariant | null) {
  return [
    { label: '规格名称', value: selectedVariant?.name || product.specification || '-' },
    { label: '销售规格', value: selectedVariant?.specification || product.specification || product.subtitle || '-' },
    { label: '售卖方式', value: selectedVariant?.saleMethod || product.saleMethod || '按份' },
    { label: '计价方式', value: selectedVariant?.pricingMode === 'weighed' ? '称重计价' : '固定计价' },
    { label: '类目', value: product.categoryName || product.categoryCode || '-' },
    { label: '配送时效', value: `${product.deliveryMinutes || 18} 分钟内到点` },
    { label: '库存', value: `${selectedVariant?.stock ?? product.stock} 件` },
    { label: 'SKU', value: selectedVariant?.sku || product.sku || '-' },
  ]
}

function minimumOrderQuantity(product: MallProduct, selectedVariant?: MallProductVariant | null) {
  return Math.max(Number(selectedVariant?.minimumOrderQuantity || product.minimumOrderQuantity || 1), 1)
}

function productPriceCents(product: MallProduct, selectedVariant?: MallProductVariant | null) {
  return Number(selectedVariant?.priceCents ?? product.discountedPriceCents ?? product.priceCents ?? 0)
}

function weighedVariantRangeText(variant: MallProductVariant, quantity: number) {
  const unitLabel = variant.weightUnitLabel || '斤'
  const toleranceBps = Number(variant.weightToleranceBps || 0)
  const min = quantity * (10000 - toleranceBps) / 10000
  const max = quantity * (10000 + toleranceBps) / 10000
  const range = toleranceBps > 0
    ? `预计 ${formatWeightQuantity(min)}-${formatWeightQuantity(max)}${unitLabel}`
    : `预计 ${formatWeightQuantity(quantity)}${unitLabel}`
  return `${range}，按实际称重改价`
}

function formatWeightQuantity(value: number) {
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)
}

function productVariants(product?: MallProduct | null): MallProductVariant[] {
  if (!product) return []
  const variants = (product.variants || [])
    .filter((variant) => variant && variant.id)
    .filter((variant) => variant.status !== 'draft')
    .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0))
  if (variants.length) return variants
  return [{
    id: product.defaultVariantId || 'default',
    name: product.specification || product.saleMethod || '默认规格',
    sku: product.sku,
    specification: product.specification,
    saleMethod: product.saleMethod,
    priceCents: product.discountedPriceCents ?? product.priceCents,
    originalPriceCents: product.originalPriceCents,
    stock: product.stock,
    minimumOrderQuantity: product.minimumOrderQuantity || 1,
    status: product.status === 'on_sale' ? 'on_sale' : product.status,
    sortOrder: 0,
    pricingMode: 'fixed',
    weightUnit: 'jin',
    weightUnitLabel: '斤',
    weightUnitGrams: 500,
    weightToleranceBps: 500,
  }]
}
