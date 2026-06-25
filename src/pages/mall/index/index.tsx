import { useEffect, useMemo, useState } from 'react'
import { Image, Swiper, SwiperItem, Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { Bell, Clock3, Flame, MapPin, Sparkles, Users } from 'lucide-react-taro'
import {
  addMallCartItem,
  listMallCategories,
  listMallHomeBanners,
  listMallHomeSections,
  listMallPromotionVenues,
  listMallProducts,
  resolveMallImageUrl,
  type MallCategory,
  type MallHomeBanner,
  type MallHomeSection,
  type MallProduct,
  type MallPromotionVenue,
} from '@/services/mall'
import {
  MallDealProductCard,
  MallPage,
  MallProductSpecPicker,
  MallSectionTitle,
  mallProductDefaultAvailableVariant,
  mallProductDefaultSaleVariant,
  mallProductMinimumOrderQuantity,
  mallProductRequiresVariantSelection,
} from '../mall-ui'
import { redirectToMallAuth } from '../auth-route'
import { mallCategoryOptionsFromCategories } from '../category-options'

interface StoredUser {
  id?: string
}

const defaultBanners: MallHomeBanner[] = [
  {
    id: 'opening-promo',
    title: '开业大促',
    subtitle: '社区鲜品低至 8.8 折',
    linkType: 'activity',
    linkTarget: 'full_reduction',
    sortOrder: 1,
    status: 'active',
    metadata: { tag: '今日主推', activityType: 'full_reduction' },
  },
  {
    id: 'full-reduction',
    title: '满减活动',
    subtitle: '满 49 减 6，可叠加积分',
    linkType: 'activity',
    linkTarget: 'full_reduction',
    sortOrder: 2,
    status: 'active',
    metadata: { tag: '省钱优先', activityType: 'full_reduction' },
  },
  {
    id: 'new-launch',
    title: '新品首发',
    subtitle: '每日上新 10-15 款，节日福利同步上线',
    linkType: 'activity',
    linkTarget: 'new_arrival',
    sortOrder: 3,
    status: 'active',
    metadata: { tag: '今日刚到', activityType: 'new_arrival' },
  },
]

const defaultAnnouncements = [
  '今日到货提醒：草莓、鲜奶、鸡蛋 16:00 后开始配送',
  '配送时效调整：晚 6 点场预计 20:30 前送达',
  '售后通知：坏果、破损支持订单内一键申请',
  '配送提醒：请提前填写完整楼栋门牌和联系电话',
]

export default function MallHome() {
  const [products, setProducts] = useState<MallProduct[]>([])
  const [categories, setCategories] = useState<MallCategory[]>([])
  const [homeBanners, setHomeBanners] = useState<MallHomeBanner[]>([])
  const [homeSections, setHomeSections] = useState<MallHomeSection[]>([])
  const [promotionVenues, setPromotionVenues] = useState<MallPromotionVenue[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const [specPickerProduct, setSpecPickerProduct] = useState<MallProduct | null>(null)
  const [specPickerLoading, setSpecPickerLoading] = useState(false)

  useDidShow(() => {
    loadProducts()
  })

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const banners = useMemo(() => {
    const active = homeBanners.filter((banner) => banner.status !== 'draft').slice(0, 3)
    return active.length >= 3 ? active : defaultBanners
  }, [homeBanners])
  const primaryBanner = banners[0]
  const primaryBannerImageUrl = resolveMallImageUrl(primaryBanner?.imageUrl)
  const announcements = useMemo(() => buildAnnouncements(homeSections), [homeSections])
  const flashSaleSection = useMemo(() => firstHomeSection(homeSections, 'flash_sale'), [homeSections])
  const newArrivalSection = useMemo(() => firstHomeSection(homeSections, 'new_arrival'), [homeSections])
  const bestSellerSection = useMemo(() => firstHomeSection(homeSections, 'best_seller'), [homeSections])
  const homePromotionVenues = useMemo(
    () => promotionVenues.filter((venue) => isHomePromotionVenue(venue)).slice(0, 4),
    [promotionVenues],
  )
  const flashSaleProducts = useMemo(
    () => resolveSectionProducts(products, flashSaleSection, pickFlashSaleProducts),
    [products, flashSaleSection],
  )
  const newArrivalProducts = useMemo(
    () => resolveSectionProducts(products, newArrivalSection, pickNewArrivalProducts),
    [products, newArrivalSection],
  )
  const bestSellerProducts = useMemo(
    () => resolveSectionProducts(products, bestSellerSection, pickBestSellerProducts),
    [products, bestSellerSection],
  )
  const quickCategories = useMemo(
    () => mallCategoryOptionsFromCategories(categories).slice(0, 12),
    [categories],
  )
  const flashSaleState = useMemo(() => buildFlashSaleState(flashSaleSection?.rules, now), [flashSaleSection, now])

  const currentUser = () => Taro.getStorageSync('userInfo') as StoredUser | undefined

  const loadProducts = async () => {
    setLoading(true)
    setLoadError('')
    try {
      const [productData, bannerData, sectionData, venueData] = await Promise.all([
        listMallProducts({}),
        listMallHomeBanners().catch(() => []),
        listMallHomeSections().catch(() => []),
        listMallPromotionVenues().catch(() => []),
      ])
      setProducts(productData)
      setHomeBanners(bannerData)
      setHomeSections(sectionData)
      setPromotionVenues(venueData)
      listMallCategories()
        .then(setCategories)
        .catch(() => setCategories([]))
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

  const openBanner = (banner: MallHomeBanner) => {
    const target = banner.linkTarget?.trim()
    if (banner.linkType === 'none') return
    const activityType = resolveBannerActivityType(banner)
    if (activityType) {
      openActivity(activityType)
      return
    }
    if (!target) return
    if (banner.linkType === 'category') {
      Taro.navigateTo({ url: `/pages/mall/category/index?categoryCode=${encodeURIComponent(target)}` })
      return
    }
    if (banner.linkType === 'product') {
      Taro.navigateTo({ url: `/pages/mall/product/index?id=${encodeURIComponent(target)}` })
      return
    }
    Taro.navigateTo({ url: `/pages/mall/category/index?keyword=${encodeURIComponent(target)}` })
  }

  const openActivity = (activityType: string, sort = '') => {
    const query = [`activityType=${encodeURIComponent(activityType)}`]
    if (sort) query.push(`sort=${encodeURIComponent(sort)}`)
    Taro.navigateTo({ url: `/pages/mall/category/index?${query.join('&')}` })
  }

  const openPromotionVenue = (venue: MallPromotionVenue) => {
    Taro.navigateTo({
      url: `/pages/mall/category/index?activityType=promotion_venue&venueId=${encodeURIComponent(venue.id)}`,
    })
  }

  const handleAddCart = async (product: MallProduct) => {
    const user = currentUser()
    if (!user?.id) {
      Taro.showToast({ title: '请先登录', icon: 'none' })
      redirectToMallAuth('/pages/mall/index/index')
      return
    }
    if (mallProductRequiresVariantSelection(product)) {
      setSpecPickerProduct(product)
      return
    }
    const variant = mallProductDefaultAvailableVariant(product)
    const quantity = mallProductMinimumOrderQuantity(product, variant)
    try {
      await addMallCartItem(user.id, product.id, quantity, variant?.id)
      Taro.showToast({ title: '已加入购物车', icon: 'success' })
    } catch (error) {
      Taro.showToast({
        title: error instanceof Error ? error.message : '加入失败',
        icon: 'none',
      })
    }
  }

  const handleSpecPickerConfirm = async (
    variant: ReturnType<typeof mallProductDefaultSaleVariant>,
    quantity: number,
  ) => {
    if (!specPickerProduct || !variant) return
    const user = currentUser()
    if (!user?.id) {
      Taro.showToast({ title: '请先登录', icon: 'none' })
      setSpecPickerProduct(null)
      redirectToMallAuth('/pages/mall/index/index')
      return
    }
    setSpecPickerLoading(true)
    try {
      await addMallCartItem(user.id, specPickerProduct.id, quantity, variant.id)
      setSpecPickerProduct(null)
      Taro.showToast({ title: '已加入购物车', icon: 'success' })
    } catch (error) {
      Taro.showToast({
        title: error instanceof Error ? error.message : '加入失败',
        icon: 'none',
      })
    } finally {
      setSpecPickerLoading(false)
    }
  }

  const openProduct = (product: MallProduct) => {
    Taro.navigateTo({ url: `/pages/mall/product/index?id=${product.id}` })
  }

  return (
    <MallPage active="home" homeTightTop>
      <MallHomeFixedHeader
        banners={banners}
        announcements={announcements}
        primaryImageUrl={primaryBannerImageUrl}
        onBannerTap={openBanner}
        onLocationTap={() => Taro.navigateTo({ url: '/pages/mall/address/index?select=1' })}
      />

      {homePromotionVenues.length ? (
        <View className="mall-v7-section mall-v7-promotion-venues">
          <View className="mall-v7-promotion-venue-list">
            {homePromotionVenues.map((venue) => {
              const rules = venue.rules || {}
              const iconUrl = resolveMallImageUrl(rules.iconUrl)
              const backgroundImageUrl = resolveMallImageUrl(rules.backgroundImageUrl)
              return (
                <View
                  key={venue.id}
                  className="mall-v7-promotion-venue-card"
                  style={{
                    background: backgroundImageUrl
                      ? `${rules.backgroundColor || '#F4FBF5'} url(${backgroundImageUrl}) center/cover no-repeat`
                      : rules.backgroundColor || '#F4FBF5',
                    color: rules.textColor || '#153A24',
                  }}
                  onClick={() => openPromotionVenue(venue)}
                >
                  <View className="mall-v7-promotion-venue-main">
                    <View className="mall-v7-promotion-venue-icon">
                      {iconUrl ? <Image src={iconUrl} mode="aspectFill" /> : <Text>{rules.iconText || '促'}</Text>}
                    </View>
                    <View>
                      <Text className="mall-v7-promotion-venue-title">{rules.title || venue.name}</Text>
                      <Text className="mall-v7-promotion-venue-copy">{rules.copy || rules.subtitle || '精选好货限时上新'}</Text>
                    </View>
                  </View>
                  <Text className="mall-v7-promotion-venue-action">{rules.buttonText || '进入会场'}</Text>
                </View>
              )
            })}
          </View>
        </View>
      ) : null}

      <View className="mall-group-buy-home-entry" onClick={() => Taro.navigateTo({ url: '/pages/mall/group-buy/index' })}>
        <View className="mall-group-buy-home-entry-icon">
          <Users size={20} color="#FFFFFF" strokeWidth={2.6} />
        </View>
        <View className="mall-group-buy-home-entry-copy">
          <Text>集采预售</Text>
          <Text>社区拼量价，定金锁单</Text>
        </View>
        <Text className="mall-group-buy-home-entry-action">去看看</Text>
      </View>

      <View className="mall-v7-section mall-v7-flash-sale">
        <View className="mall-v7-section-head">
          <View>
            <View className="mall-v7-title-with-icon">
              <Flame size={19} color="#FF8A1F" />
            <Text className="mall-v7-section-title">{flashSaleSection?.title || '秒杀专区'}</Text>
            </View>
            <Text className="mall-v7-section-subtitle">{flashSaleSection?.subtitle || flashSaleState.sessionText}</Text>
          </View>
          <View className="mall-v7-countdown" onClick={() => openActivity('flash_sale')}>
            <Clock3 size={14} color="#FFFFFF" />
            <Text>{flashSaleState.countdownText}</Text>
          </View>
        </View>
        <View className="mall-v7-horizontal-products">
          {flashSaleProducts.map((product) => (
            <MallDealProductCard
              key={product.id}
              product={product}
              rankLabel={`剩余 ${product.stock}`}
              onAdd={handleAddCart}
              onOpen={openProduct}
            />
          ))}
        </View>
      </View>

      <MallSectionTitle
        title={newArrivalSection?.title || '新上专区'}
        action={newArrivalSection?.content || rulesStringValue(newArrivalSection?.rules, 'badge', '今日刚到')}
        onAction={() => openActivity('new_arrival', 'newest')}
      />
      <View className="mall-v7-product-list">
        {newArrivalProducts.map((product) => (
          <MallDealProductCard
            key={product.id}
            product={product}
            layout="list"
            rankLabel="今日刚到"
            onAdd={handleAddCart}
            onOpen={openProduct}
          />
        ))}
      </View>

      <View className="mall-v7-category-tabs">
        {quickCategories.map((category) => (
          <View
            key={category.code || category.label}
            className="mall-v7-category-tab"
            onClick={() => Taro.navigateTo({ url: `/pages/mall/category/index?categoryCode=${encodeURIComponent(category.code)}` })}
          >
            <Text>{category.label}</Text>
          </View>
        ))}
      </View>

      <MallSectionTitle
        title={bestSellerSection?.title || '爆款推荐'}
        action={bestSellerSection?.content || rulesStringValue(bestSellerSection?.rules, 'badgePrefix', 'TOP10')}
        onAction={() => openActivity('best_seller', 'sales_desc')}
      />
      <View className="mall-v7-product-grid">
        {bestSellerProducts.map((product, index) => (
          <MallDealProductCard
            key={product.id}
            product={product}
            rankLabel={`TOP${index + 1}`}
            onAdd={handleAddCart}
            onOpen={openProduct}
          />
        ))}
      </View>

      {loadError ? (
        <View className="mall-empty">
          <Text className="mall-empty-title">商品加载失败</Text>
          <Text className="mall-empty-copy">{loadError}</Text>
          <View className="mall-button" style={{ marginTop: 14 }} onClick={loadProducts}>
            重新加载
          </View>
        </View>
      ) : null}

      {!loading && !loadError && products.length === 0 ? (
        <View className="mall-empty">
          <Text className="mall-empty-title">暂无可售商品</Text>
          <Text className="mall-empty-copy">运营补货中，请稍后再来。</Text>
        </View>
      ) : null}

      {specPickerProduct ? (
        <MallProductSpecPicker
          product={specPickerProduct}
          loading={specPickerLoading}
          onClose={() => {
            if (!specPickerLoading) setSpecPickerProduct(null)
          }}
          onConfirm={handleSpecPickerConfirm}
        />
      ) : null}
    </MallPage>
  )
}

function MallHomeFixedHeader({
  banners,
  announcements,
  primaryImageUrl,
  onBannerTap,
  onLocationTap,
}: {
  banners: MallHomeBanner[]
  announcements: string[]
  primaryImageUrl: string
  onBannerTap: (banner: MallHomeBanner) => void
  onLocationTap: () => void
}) {
  return (
    <View className="mall-v7-home-fixed">
      <View className="mall-v7-home-topbar">
        <Text className="mall-v7-home-brand">叁友甄选</Text>
        <View className="mall-v7-home-location" onClick={onLocationTap}>
          <MapPin size={16} color="#1F2D1F" />
          <Text>选择送货位置</Text>
        </View>
      </View>
      <Swiper className="mall-v7-banner-swiper" circular autoplay interval={3600}>
        {banners.map((banner, index) => {
          const bannerImageUrl = index === 0 ? primaryImageUrl : resolveMallImageUrl(banner.imageUrl)
          return (
            <SwiperItem key={banner.id || index}>
              <View className="mall-v7-banner-card" onClick={() => onBannerTap(banner)}>
                {bannerImageUrl ? (
                  <Image className="mall-v7-banner-image" src={bannerImageUrl} mode="aspectFill" />
                ) : null}
                <View className="mall-v7-banner-content">
                  <Text className="mall-v7-banner-tag">
                    {typeof banner.metadata?.tag === 'string' ? banner.metadata.tag : '叁友甄选'}
                  </Text>
                  <Text className="mall-v7-banner-title">{banner.title}</Text>
                  <Text className="mall-v7-banner-copy">{banner.subtitle || '好货到点，邻里一起省'}</Text>
                </View>
                <View className="mall-v7-banner-saving">
                  <Sparkles size={18} color="#FFE4A5" />
                  <Text>{index === 1 ? '满49减6' : index === 2 ? '今日刚到' : '限时抢'}</Text>
                </View>
              </View>
            </SwiperItem>
          )
        })}
      </Swiper>
      <View className="mall-v7-announcement">
        <Bell size={16} color="#2F7E43" />
        <View className="mall-v7-announcement-track">
          <Text>{announcements.join('　|　')}</Text>
        </View>
      </View>
    </View>
  )
}

function pickFlashSaleProducts(products: MallProduct[]) {
  const tagged = products.filter((product) => product.tags?.some((tag) => /秒杀|特价|爆款/.test(tag)))
  const source = tagged.length > 0 ? tagged : [...products].sort((a, b) => (a.stock || 0) - (b.stock || 0))
  return source.slice(0, 2)
}

function pickNewArrivalProducts(products: MallProduct[]) {
  const tagged = products.filter((product) => product.tags?.some((tag) => /今日|新品|新上|现货/.test(tag)))
  const source = tagged.length > 0 ? tagged : products
  return source.slice(0, 6)
}

function pickBestSellerProducts(products: MallProduct[]) {
  return [...products]
    .sort((a, b) => (b.soldCount || 0) - (a.soldCount || 0))
    .slice(0, 10)
}

function firstHomeSection(sections: MallHomeSection[], sectionType: string) {
  return sections
    .filter((section) => section.sectionType === sectionType && section.status !== 'draft')
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))[0]
}

function isHomePromotionVenue(venue: MallPromotionVenue) {
  if (venue.status !== 'active') return false
  const entryPosition = venue.rules?.entryPosition || 'home_after_banner'
  return entryPosition === 'home_top' || entryPosition === 'home_after_banner' || entryPosition === 'home_after_flash'
}

function buildAnnouncements(homeSections: MallHomeSection[]) {
  const configured = homeSections
    .filter((section) => section.sectionType === 'announcement' && section.status !== 'draft')
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    .map((section) => [section.title, section.content || section.subtitle].filter(Boolean).join('：'))
    .filter(Boolean)
  return configured.length ? configured : defaultAnnouncements
}

function resolveSectionProducts(
  products: MallProduct[],
  section: MallHomeSection | undefined,
  fallbackPicker: (products: MallProduct[]) => MallProduct[],
) {
  const limit = numberRuleValue(section?.rules, 'displayLimit', fallbackPicker(products).length)
  const configuredIds = Array.isArray(section?.productIds)
    ? section.productIds.map((id) => String(id)).filter(Boolean)
    : []
  const configured = configuredIds
    .map((id) => products.find((product) => product.id === id || product.sku === id))
    .filter((product): product is MallProduct => Boolean(product))
  const fallback = fallbackPicker(products).filter((product) => !configured.some((item) => item.id === product.id))
  return [...configured, ...fallback].slice(0, limit)
}

function numberRuleValue(rules: Record<string, unknown> | undefined, key: string, fallback: number) {
  const value = rules?.[key]
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback
}

function rulesStringValue(rules: Record<string, unknown> | undefined, key: string, fallback: string) {
  const value = rules?.[key]
  return typeof value === 'string' && value.trim() ? value : fallback
}

function numberArrayValue(rules: Record<string, unknown> | undefined, key: string, fallback: number[]) {
  const value = rules?.[key]
  if (!Array.isArray(value)) return fallback
  const parsed = value.map((item) => Number(item)).filter((item) => Number.isFinite(item) && item >= 0 && item < 24)
  return parsed.length ? parsed : fallback
}

function buildFlashSaleState(rules: Record<string, unknown> | undefined, nowMs: number) {
  const sessions = numberArrayValue(rules, 'sessions', [8, 18])
  const durationMinutes = numberRuleValue(rules, 'durationMinutes', numberRuleValue(rules, 'sessionDurationMinutes', 120))
  const now = new Date(nowMs)
  const sortedSessions = [...sessions].sort((a, b) => a - b)
  const currentSession = sortedSessions
    .map((hour) => {
      const startsAt = new Date(now)
      startsAt.setHours(hour, 0, 0, 0)
      const endsAt = new Date(startsAt.getTime() + durationMinutes * 60 * 1000)
      return { hour, startsAt, endsAt }
    })
    .find((session) => now >= session.startsAt && now < session.endsAt)

  if (currentSession) {
    return {
      sessionText: `${formatSessionHour(currentSession.hour)} 秒杀进行中`,
      countdownText: `本场剩 ${formatDurationSeconds(Math.max(Math.floor((currentSession.endsAt.getTime() - nowMs) / 1000), 0))}`,
    }
  }

  const nextHour = sortedSessions.find((hour) => {
    const startsAt = new Date(now)
    startsAt.setHours(hour, 0, 0, 0)
    return startsAt.getTime() > nowMs
  }) ?? sortedSessions[0] + 24
  const nextStartsAt = new Date(now)
  if (nextHour >= 24) {
    nextStartsAt.setDate(nextStartsAt.getDate() + 1)
    nextStartsAt.setHours(nextHour - 24, 0, 0, 0)
  } else {
    nextStartsAt.setHours(nextHour, 0, 0, 0)
  }
  return {
    sessionText: `下一场 ${formatSessionHour(nextHour % 24)}`,
    countdownText: `距开抢 ${formatDurationSeconds(Math.max(Math.floor((nextStartsAt.getTime() - nowMs) / 1000), 0))}`,
  }
}

function formatDurationSeconds(diffSeconds: number) {
  const hours = String(Math.floor(diffSeconds / 3600)).padStart(2, '0')
  const minutes = String(Math.floor((diffSeconds % 3600) / 60)).padStart(2, '0')
  const seconds = String(diffSeconds % 60).padStart(2, '0')
  return `${hours}:${minutes}:${seconds}`
}

function formatSessionHour(hour: number) {
  return `${String(hour).padStart(2, '0')}:00`
}

function resolveBannerActivityType(banner: MallHomeBanner) {
  const metadataActivity = banner.metadata?.activityType
  if (typeof metadataActivity === 'string' && metadataActivity.trim()) return metadataActivity.trim()
  const target = banner.linkTarget?.trim()
  if (banner.linkType === 'activity' && target) return target
  const text = [banner.title, banner.subtitle, target].filter(Boolean).join(' ')
  if (/秒杀|限时|抢/.test(text)) return 'flash_sale'
  if (/满减|大促|折扣|福利|省/.test(text)) return 'full_reduction'
  if (/新品|新上|刚到|首发/.test(text)) return 'new_arrival'
  if (/爆款|TOP|热销/.test(text)) return 'best_seller'
  return ''
}
