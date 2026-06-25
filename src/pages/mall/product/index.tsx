import { useEffect, useMemo, useState } from 'react'
import { Image, Swiper, SwiperItem, Text, View } from '@tarojs/components'
import Taro, { useShareAppMessage } from '@tarojs/taro'
import { ChevronDown, ChevronLeft, Share2, ShieldCheck, ShoppingCart } from 'lucide-react-taro'
import { Button } from '@/components/ui/button'
import { Network } from '@/network'
import {
  addMallCartItem,
  createMallCheckout,
  getMallProduct,
  resolveMallImageUrl,
  type MallProduct,
  type MallQualificationReport,
  type MallProductVariant,
} from '@/services/mall'
import {
  MallLocationStrip,
  MallPage,
  MallPrimaryButton,
  mallProductDefaultAvailableVariant,
  mallProductHasQualificationReports,
  mallProductMinimumOrderQuantity,
  mallProductNormalizedQuantity,
  mallProductSaleVariants,
  mallYuan,
} from '../mall-ui'
import { redirectToMallAuth } from '../auth-route'

interface StoredUser {
  id?: string
}

export default function MallProductDetail() {
  const [product, setProduct] = useState<MallProduct | null>(null)
  const [selectedVariantId, setSelectedVariantId] = useState('')
  const [selectedQuantity, setSelectedQuantity] = useState(1)
  const [loading, setLoading] = useState(false)
  const [qualificationOpen, setQualificationOpen] = useState(false)
  const [promotionOpen, setPromotionOpen] = useState(false)
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
    const defaultVariantId = mallProductDefaultAvailableVariant(product)?.id || nextVariants[0]?.id || ''
    setSelectedVariantId((current) => (
      nextVariants.some((variant) => variant.id === current) ? current : defaultVariantId
    ))
  }, [product])

  useEffect(() => {
    if (!product) return
    setSelectedQuantity(mallProductMinimumOrderQuantity(product, selectedVariant))
  }, [product?.id, selectedVariant?.id])

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
      if (selectedVariant.status !== 'on_sale' || selectedVariant.stock <= 0) {
        Taro.showToast({ title: '该规格暂不可售', icon: 'none' })
        return
      }
      await addMallCartItem(
        user.id,
        product.id,
        mallProductNormalizedQuantity(product, selectedVariant, selectedQuantity),
        selectedVariant.id,
      )
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
      if (!selectedVariant || selectedVariant.status !== 'on_sale' || selectedVariant.stock <= 0) {
        Taro.showToast({ title: '该规格暂不可售', icon: 'none' })
        return
      }
      const checkout = await createMallCheckout({
        userId: user.id,
        source: 'buy_now',
        productId: product.id,
        variantId: selectedVariant.id,
        quantity: mallProductNormalizedQuantity(product, selectedVariant, selectedQuantity),
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
                  {product.description || product.subtitle || '配送前质检 · 产地直发 · 坏果包退'}
                </Text>
              </View>
              <Button className="mall-share-button" openType="share">
                <Share2 size={18} color="#63BF54" />
              </Button>
            </View>
            <View style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text className="mall-price-large">{mallYuan(productPriceCents(product, selectedVariant))}</Text>
              <View className="mall-hero-badge" style={{ marginTop: 0, background: '#FFF1E5', color: '#FF9238' }}>
                起订 {mallProductMinimumOrderQuantity(product, selectedVariant)}
              </View>
            </View>
            {mallProductHasQualificationReports(product) ? (
              <View className="mall-quality-entry">
                <View className="mall-quality-entry-main">
                  <ShieldCheck size={16} color="#2F7E43" strokeWidth={2.4} />
                  <Text>资质可查</Text>
                </View>
                <Text onClick={() => setQualificationOpen(true)}>
                  查看资质
                </Text>
              </View>
            ) : null}
          </View>

          <PromotionActivitiesSection
            open={promotionOpen}
            product={product}
            onToggle={() => setPromotionOpen((current) => !current)}
          />

          <VariantSelector
            product={product}
            variants={variants}
            selectedVariant={selectedVariant}
            onSelect={setSelectedVariantId}
          />

          <View style={{ marginTop: 14 }}>
            <MallLocationStrip />
          </View>

          <ProductDetailSections product={product} selectedVariant={selectedVariant} selectedQuantity={selectedQuantity} />
          <View className="mall-product-floating-spacer" />

          <View className="mall-product-floating-actions">
            <ProductQuantityControl
              product={product}
              selectedVariant={selectedVariant}
              quantity={selectedQuantity}
              onChange={setSelectedQuantity}
            />
            <View className="mall-action-row">
              <MallPrimaryButton subtle onClick={handleAddCart}>
                <ShoppingCart size={18} color="#FF9238" />
                <Text style={{ marginLeft: 6 }}>加入购物车</Text>
              </MallPrimaryButton>
              <MallPrimaryButton onClick={handleBuyNow}>
                <Text>＋ 立即选购</Text>
              </MallPrimaryButton>
            </View>
          </View>

          {qualificationOpen ? <ProductQualificationModal product={product} onClose={() => setQualificationOpen(false)} /> : null}
        </>
      )}
    </MallPage>
  )
}

function PromotionActivitiesSection({
  product,
  open,
  onToggle,
}: {
  product: MallProduct
  open: boolean
  onToggle: () => void
}) {
  const promotions = (product.promotions || []).filter((promotion) => promotion && promotion.title)
  if (!promotions.length) return null

  const summaryTags = ((product.promotionTags && product.promotionTags.length ? product.promotionTags : promotions) || [])
    .filter((tag) => tag && tag.tagText)
    .slice(0, 3)

  return (
    <View className="mall-card mall-product-promotion-panel">
      <View className="mall-product-promotion-head" onClick={onToggle}>
        <View>
          <Text>优惠活动</Text>
          <View className="mall-product-promotion-summary">
            {summaryTags.map((tag) => (
              <Text
                key={`${tag.campaignId}-${tag.tagText}`}
                style={{
                  background: tag.backgroundColor || '#FFF1E5',
                  color: tag.textColor || '#E85D04',
                }}
              >
                {tag.tagText}
              </Text>
            ))}
          </View>
        </View>
        <ChevronDown
          size={18}
          color="#657160"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.16s ease' }}
        />
      </View>
      {open ? (
        <View className="mall-product-promotion-list">
          {promotions.map((promotion) => {
            const iconUrl = resolveMallImageUrl(promotion.iconUrl)
            return (
              <View className="mall-product-promotion-item" key={promotion.campaignId}>
                <View
                  className="mall-product-promotion-tag"
                  style={{
                    background: promotion.backgroundColor || '#FFF1E5',
                    color: promotion.textColor || '#E85D04',
                  }}
                >
                  {iconUrl ? <Image mode="aspectFit" src={iconUrl} /> : null}
                  {!iconUrl && promotion.iconText ? <Text>{promotion.iconText}</Text> : null}
                  <Text>{promotion.tagText}</Text>
                </View>
                <View className="mall-product-promotion-copy">
                  <Text className="mall-product-promotion-title">{promotion.title}</Text>
                  <Text>{promotion.ruleExplanation}</Text>
                  <Text>{formatPromotionPeriod(promotion.startsAt, promotion.endsAt)}</Text>
                  {promotion.limitText ? <Text>{promotion.limitText}</Text> : null}
                </View>
              </View>
            )
          })}
        </View>
      ) : null}
    </View>
  )
}

function ProductQualificationModal({
  product,
  onClose,
}: {
  product: MallProduct
  onClose: () => void
}) {
  const reports = productQualificationReports(product)
  const suppliers = productSuppliers(product)

  return (
    <View className="mall-modal-mask" onClick={onClose}>
      <View className="mall-product-quality-panel mall-product-quality-modal" onClick={(event) => event.stopPropagation()}>
        <View className="mall-product-quality-head">
          <View>
            <Text>商品资质</Text>
            <Text>{reports.length} 份报告可追溯</Text>
          </View>
          <Text className="mall-product-quality-close" onClick={onClose}>关闭</Text>
        </View>
        {suppliers.length ? (
          <View className="mall-product-quality-suppliers">
            {suppliers.map((supplier) => (
              <Text key={supplier.id || supplier.name}>{supplier.name}</Text>
            ))}
          </View>
        ) : null}
        {reports.map((report) => (
          <View className="mall-product-quality-item" key={report.id}>
            <View>
              <Text className="mall-product-quality-title">{report.reportName || '资质报告'}</Text>
              <Text className="mall-product-quality-copy">
                {[
                  report.reportType || '',
                  report.hideSupplier ? '' : report.buyerName ? `供货商：${report.buyerName}` : '',
                  report.issuer ? `机构：${report.issuer}` : '',
                  report.expiresAt ? `有效期至：${report.expiresAt}` : '',
                ].filter(Boolean).join(' · ') || '资质信息已归档'}
              </Text>
            </View>
            <Text className="mall-product-quality-link" onClick={() => openQualificationReport(report)}>
              查看
            </Text>
          </View>
        ))}
      </View>
    </View>
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
          <Text className="mall-variant-weigh-note">{weighedVariantRangeText(variant, mallProductMinimumOrderQuantity(product, variant))}</Text>
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
                <Text className="mall-variant-option-stock">{weighedVariantRangeText(variant, mallProductMinimumOrderQuantity(product, variant))}</Text>
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
  selectedQuantity,
}: {
  product: MallProduct
  selectedVariant: MallProductVariant | null
  selectedQuantity: number
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
          <Text>最小起订量 {mallProductMinimumOrderQuantity(product, selectedVariant)} 件</Text>
          <Text>当前选择 {mallProductNormalizedQuantity(product, selectedVariant, selectedQuantity)} 件，库存 {selectedVariant?.stock ?? product.stock} 件</Text>
          {selectedVariant?.pricingMode === 'weighed' ? (
            <Text>{weighedVariantRangeText(selectedVariant, mallProductNormalizedQuantity(product, selectedVariant, selectedQuantity))}，实际金额由客服称重后确认。</Text>
          ) : null}
        </View>
      </View>

      <View className="mall-product-detail-section">
        <Text className="mall-product-detail-title">售后说明</Text>
        <View className="mall-product-detail-copy">
          <Text>商品送达后请及时核验，坏果、破损、错发可在订单内提交售后。</Text>
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
  return paragraphs.length ? paragraphs : ['配送前完成基础质检，按收货地址送货到家。商品批次、规格和包装以实际到货为准。']
}

function buildPublicSpecs(product: MallProduct, selectedVariant?: MallProductVariant | null) {
  return [
    { label: '规格名称', value: selectedVariant?.name || product.specification || '-' },
    { label: '销售规格', value: selectedVariant?.specification || product.specification || product.subtitle || '-' },
    { label: '售卖方式', value: selectedVariant?.saleMethod || product.saleMethod || '按份' },
    { label: '计价方式', value: selectedVariant?.pricingMode === 'weighed' ? '称重计价' : '固定计价' },
    { label: '类目', value: product.categoryName || product.categoryCode || '-' },
    { label: '配送时效', value: `${product.deliveryMinutes || 18} 分钟内送达` },
    { label: '库存', value: `${selectedVariant?.stock ?? product.stock} 件` },
  ]
}

function productQualificationReports(product: MallProduct): MallQualificationReport[] {
  return (product.qualificationReports || [])
    .filter((report) => report && report.status !== 'inactive' && report.status !== 'deleted')
    .filter((report) => Boolean(report.reportUrl?.trim()))
}

function formatPromotionPeriod(startsAt?: string | null, endsAt?: string | null) {
  const start = formatPromotionDate(startsAt)
  const end = formatPromotionDate(endsAt)
  if (start && end) return `活动时间：${start} 至 ${end}`
  if (start) return `活动时间：${start} 起`
  if (end) return `活动时间：至 ${end}`
  return '活动时间：长期有效'
}

function formatPromotionDate(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}.${month}.${day}`
}

function productSuppliers(product: MallProduct) {
  return (product.procurementBuyers || [])
    .filter((buyer) => buyer && buyer.status !== 'inactive' && buyer.status !== 'deleted' && !buyer.hideSupplier)
    .map((buyer) => ({
      id: buyer.id,
      name: buyer.name || buyer.contactName || '供货商',
    }))
}

function ProductQuantityControl({
  product,
  selectedVariant,
  quantity,
  onChange,
}: {
  product: MallProduct
  selectedVariant: MallProductVariant | null
  quantity: number
  onChange: (quantity: number) => void
}) {
  const minimumQuantity = mallProductMinimumOrderQuantity(product, selectedVariant)
  const normalizedQuantity = mallProductNormalizedQuantity(product, selectedVariant, quantity)
  const stock = selectedVariant?.stock ?? product.stock
  const atStockLimit = stock > 0 && stock >= minimumQuantity && normalizedQuantity >= stock
  const updateQuantity = (nextQuantity: number) => {
    onChange(mallProductNormalizedQuantity(product, selectedVariant, nextQuantity))
  }

  return (
    <View className="mall-product-floating-quantity">
      <View>
        <Text className="mall-product-floating-quantity-title">数量</Text>
        <Text className="mall-product-floating-quantity-copy">起订 {minimumQuantity}</Text>
      </View>
      <View className="mall-stepper">
        <Text
          className={normalizedQuantity <= minimumQuantity ? 'mall-stepper-action mall-stepper-action-muted' : 'mall-stepper-action'}
          onClick={() => updateQuantity(normalizedQuantity - 1)}
        >
          −
        </Text>
        <Text className="mall-stepper-value">{normalizedQuantity}</Text>
        <Text
          className={atStockLimit ? 'mall-stepper-action mall-stepper-action-muted' : 'mall-stepper-action'}
          onClick={() => updateQuantity(normalizedQuantity + 1)}
        >
          ＋
        </Text>
      </View>
    </View>
  )
}

async function openQualificationReport(report: MallQualificationReport) {
  const reportUrl = resolveMallImageUrl(report.reportUrl)
  if (!reportUrl) {
    Taro.showToast({ title: '资质文件地址为空', icon: 'none' })
    return
  }
  if (/\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(reportUrl)) {
    Taro.previewImage({ urls: [reportUrl], current: reportUrl })
    return
  }
  if (TARO_ENV === 'h5' && typeof window !== 'undefined') {
    window.open(reportUrl, '_blank', 'noopener,noreferrer')
    return
  }
  Taro.showLoading({ title: '打开资质...' })
  try {
    const result = await Network.downloadFile({ url: reportUrl })
    const filePath = result.tempFilePath || result.filePath
    if (!filePath) throw new Error('empty file path')
    await Taro.openDocument({ filePath, showMenu: true })
  } catch (error) {
    Taro.showToast({
      title: error instanceof Error ? '资质文件打开失败' : '资质文件打开失败',
      icon: 'none',
    })
  } finally {
    Taro.hideLoading()
  }
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
  const variants = mallProductSaleVariants(product)
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
