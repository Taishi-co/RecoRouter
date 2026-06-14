import { useLayoutEffect, type CSSProperties, type PropsWithChildren, type ReactNode } from 'react'
import { Image, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import {
  Apple,
  Check,
  ChevronRight,
  Grid2x2,
  House,
  MapPin,
  Plus,
  Search,
  ShoppingCart,
  UserRound,
} from 'lucide-react-taro'
import sanyouLogo from '@/assets/brand/sanyou.png'
import { resolveMallImageUrl, type MallProduct, yuan } from '@/services/mall'
import { Input } from '@/components/ui/input'
import {
  getHomePageBodyPaddingTop,
  getHomeStickyHeaderTop,
  getPageBodyPaddingTop,
  getStickyHeaderTop,
} from '@/lib/safe-area'
import './mall-theme.css'

type MallTabKey = 'home' | 'category' | 'cart' | 'mine'

type MallIcon = typeof House

export const SANYOU_LOGO = sanyouLogo
export const MALL_SELECTED_ADDRESS_STORAGE_KEY = 'mallSelectedAddressId'

const MALL_H5_BODY_CLASS = 'reco-mall-h5'
let mallH5PageCount = 0

const tabItems: Array<{ key: MallTabKey; label: string; url: string; icon: MallIcon; brandIcon?: boolean }> = [
  { key: 'home', label: '首页', url: '/pages/mall/index/index', icon: House, brandIcon: true },
  { key: 'category', label: '分类', url: '/pages/mall/category/index', icon: Grid2x2 },
  { key: 'cart', label: '购物车', url: '/pages/mall/cart/index', icon: ShoppingCart },
  { key: 'mine', label: '我的', url: '/pages/mall/profile/index', icon: UserRound },
]

export function mallYuan(cents?: number | null) {
  const formatted = yuan(cents)
  if (formatted.endsWith('.00')) {
    return formatted.slice(0, -3)
  }
  return formatted.replace(/(\.\d)0$/, '$1')
}

export function mallWeightText(
  grams?: number | null,
  unitGrams = 500,
  unitLabel = '斤',
) {
  if (!grams || grams <= 0) return ''
  const value = grams / Math.max(unitGrams || 500, 1)
  return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(2)}${unitLabel || '斤'}`
}

export function MallStatusBar() {
  return null
}

export function MallBrandMark({ compact }: { compact?: boolean }) {
  return (
    <Image
      className={compact ? 'mall-brand-mark mall-brand-mark-compact' : 'mall-brand-mark'}
      mode="aspectFit"
      src={SANYOU_LOGO}
    />
  )
}

export function MallPage({
  active,
  children,
  noTab,
  homeTightTop,
}: PropsWithChildren<{ active?: MallTabKey; noTab?: boolean; homeTightTop?: boolean }>) {
  useMallH5BodyClass()
  const shellStyle = {
    paddingTop: `${homeTightTop ? getHomePageBodyPaddingTop() : getPageBodyPaddingTop()}px`,
    '--mall-sticky-top': `${homeTightTop ? getHomeStickyHeaderTop() : getStickyHeaderTop()}px`,
  } as CSSProperties

  return (
    <View className={homeTightTop ? 'mall-shell mall-shell-home' : 'mall-shell'} style={shellStyle}>
      {children}
      {!noTab && <MallBottomNav active={active || 'home'} />}
    </View>
  )
}

function useMallH5BodyClass() {
  useLayoutEffect(() => {
    if (TARO_ENV !== 'h5' || typeof document === 'undefined') return

    mallH5PageCount += 1
    document.body.classList.add(MALL_H5_BODY_CLASS)

    return () => {
      mallH5PageCount = Math.max(0, mallH5PageCount - 1)
      if (mallH5PageCount === 0) {
        document.body.classList.remove(MALL_H5_BODY_CLASS)
      }
    }
  }, [])
}

export function MallBottomNav({ active }: { active: MallTabKey }) {
  return (
    <View className="mall-tabbar">
      {tabItems.map((item) => {
        const Icon = item.icon
        const isActive = item.key === active
        return (
          <View
            key={item.key}
            className={isActive ? 'mall-tab mall-tab-active' : 'mall-tab'}
            onClick={() => {
              if (item.key === active) return
              Taro.redirectTo({ url: item.url })
            }}
          >
            {item.brandIcon ? (
              <Image
                className={isActive ? 'mall-tab-brand-icon mall-tab-brand-icon-active' : 'mall-tab-brand-icon'}
                mode="aspectFit"
                src={SANYOU_LOGO}
              />
            ) : (
              <Icon size={21} color={isActive ? '#63BF54' : '#6D766B'} />
            )}
            <Text className="mall-tab-label">{item.label}</Text>
          </View>
        )
      })}
    </View>
  )
}

export function MallSectionTitle({
  title,
  action,
  onAction,
}: {
  title: string
  action?: string
  onAction?: () => void
}) {
  return (
    <View className="mall-section-title">
      <Text className="mall-section-heading">{title}</Text>
      {action ? (
        <Text className="mall-section-action" onClick={onAction}>
          {action}
        </Text>
      ) : null}
    </View>
  )
}

export function MallSearchBox({
  value,
  placeholder,
  onInput,
  onSearch,
  actionText,
  trailing,
}: {
  value?: string
  placeholder: string
  onInput?: (value: string) => void
  onSearch?: () => void
  actionText?: string
  trailing?: ReactNode
}) {
  return (
    <View className="mall-search">
      <Search size={18} color="#64725F" />
      <Input
        className="mall-search-input"
        value={value}
        placeholder={placeholder}
        confirmType="search"
        onInput={(event) => onInput?.(String(event.detail.value || ''))}
        onConfirm={onSearch}
      />
      {actionText ? (
        <Text className="mall-search-action" onClick={onSearch}>
          {actionText}
        </Text>
      ) : null}
      {trailing}
    </View>
  )
}

export function MallProductThumb({ product, large }: { product?: MallProduct | null; large?: boolean }) {
  const imageUrl = primaryMallProductImageUrl(product)
  if (imageUrl) {
    return <Image className={large ? 'mall-product-image mall-product-image-large' : 'mall-product-image'} mode="aspectFill" src={imageUrl} />
  }
  return (
    <View className={large ? 'mall-product-illustration mall-product-illustration-large' : 'mall-product-illustration'}>
      <Apple size={large ? 78 : 54} color="#63BF54" />
    </View>
  )
}

export function primaryMallProductImageUrl(product?: MallProduct | null) {
  const firstImage = product?.images?.find((image) => Boolean(image?.trim()))
  return resolveMallImageUrl(firstImage || product?.imageUrl)
}

export function mallProductSaleVariants(product?: MallProduct | null) {
  return (product?.variants || [])
    .filter((variant) => variant && variant.id && variant.status !== 'draft')
    .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0))
}

export function mallProductDefaultSaleVariant(product?: MallProduct | null) {
  const variants = mallProductSaleVariants(product)
  if (!variants.length) return null
  return variants.find((variant) => variant.id === product?.defaultVariantId) || variants[0]
}

export function mallProductRequiresVariantSelection(product?: MallProduct | null) {
  return mallProductSaleVariants(product)
    .filter((variant) => variant.status === 'on_sale' && variant.stock > 0)
    .length > 1
}

export function mallProductMinimumOrderQuantity(product?: MallProduct | null, variant = mallProductDefaultSaleVariant(product)) {
  return Math.max(Number(variant?.minimumOrderQuantity || product?.minimumOrderQuantity || 1), 1)
}

export function MallDealProductCard({
  product,
  onAdd,
  onOpen,
  rankLabel,
  layout = 'grid',
}: {
  product: MallProduct
  onAdd?: (product: MallProduct) => void
  onOpen?: (product: MallProduct) => void
  rankLabel?: string
  layout?: 'grid' | 'list'
}) {
  const discountedPriceCents = product.discountedPriceCents ?? product.priceCents
  const originalPriceCents = product.originalPriceCents ?? product.priceCents
  const savedCents = Math.max(product.savedCents ?? originalPriceCents - discountedPriceCents, 0)
  const hasOriginal = originalPriceCents > discountedPriceCents
  const fixedPriceCampaign = product.fixedPriceCampaign
  const productTag = fixedPriceCampaign?.badgeText || rankLabel || product.discountLabel || product.tags?.[0] || (product.stock <= 10 ? '库存紧张' : '')
  const badgeIconUrl = resolveMallImageUrl(fixedPriceCampaign?.badgeIconUrl)

  return (
    <View className={layout === 'list' ? 'mall-v7-product-card mall-v7-product-card-list' : 'mall-v7-product-card'}>
      <View className="mall-v7-product-media" onClick={() => onOpen?.(product)}>
        <MallProductThumb product={product} />
        {fixedPriceCampaign ? (
          <View
            className="mall-v7-product-fixed-price-badge"
            style={{
              background: fixedPriceCampaign.badgeBackgroundColor || '#FF9238',
              color: fixedPriceCampaign.badgeTextColor || '#FFFFFF',
            }}
          >
            {badgeIconUrl ? <Image className="mall-v7-product-fixed-price-icon" mode="aspectFit" src={badgeIconUrl} /> : null}
            {!badgeIconUrl && fixedPriceCampaign.badgeIcon ? <Text>{fixedPriceCampaign.badgeIcon}</Text> : null}
            <Text>{fixedPriceCampaign.badgeText || '一口价'}</Text>
          </View>
        ) : productTag ? <Text className="mall-v7-product-tag">{productTag}</Text> : null}
      </View>
      <View className="mall-v7-product-body" onClick={() => onOpen?.(product)}>
        <Text className="mall-v7-product-name">{product.name}</Text>
        <Text className="mall-v7-product-subtitle">
          {product.subtitle || product.categoryName || `${product.deliveryMinutes || 30} 分钟送达`}
        </Text>
        <View className="mall-v7-product-badges">
          {product.qualityGuaranteed ? <Text>品质保证</Text> : null}
          {product.couponStackable ? <Text>券可叠加</Text> : null}
          {(product.pointsDeductibleCents || 0) > 0 ? <Text>积分抵扣</Text> : null}
        </View>
        <View className="mall-v7-product-price-row">
          <Text className="mall-v7-pay-price">{mallYuan(discountedPriceCents)}</Text>
          {hasOriginal ? <Text className="mall-v7-original-price">{mallYuan(originalPriceCents)}</Text> : null}
        </View>
        <View className="mall-v7-product-meta">
          <Text>{savedCents > 0 ? `已省 ${mallYuan(savedCents)}` : `已售 ${product.soldCount || 0}`}</Text>
          <Text>{product.stock > 0 ? `余 ${product.stock}` : '补货中'}</Text>
        </View>
      </View>
      <View className="mall-v7-add-button" onClick={() => onAdd?.(product)}>
        <Plus size={18} color="#FFFFFF" strokeWidth={3} />
      </View>
    </View>
  )
}

export function MallLocationStrip({
  title = '请选择送货地址',
  subtitle = '下单前请填写完整楼栋门牌和联系电话',
  active,
  onClick,
}: {
  title?: string
  subtitle?: string
  active?: boolean
  onClick?: () => void
}) {
  return (
    <View className={active ? 'mall-location mall-location-active' : 'mall-location'} onClick={onClick}>
      <View className="mall-location-icon">
        {active ? <Check size={18} color="#FFFFFF" /> : <MapPin size={18} color="#63BF54" />}
      </View>
      <View className="mall-location-copy">
        <Text className="mall-location-title">{title}</Text>
        <Text className="mall-location-subtitle">{subtitle}</Text>
      </View>
      <ChevronRight size={18} color="#778270" />
    </View>
  )
}

export function MallPrimaryButton({
  children,
  onClick,
  subtle,
}: PropsWithChildren<{ onClick?: () => void; subtle?: boolean }>) {
  return (
    <View className={subtle ? 'mall-button mall-button-subtle' : 'mall-button'} onClick={onClick}>
      {children}
    </View>
  )
}
