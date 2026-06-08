import { useMemo, useState } from 'react'
import { Image, Swiper, SwiperItem, Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { Bell, Clock3, Flame, MapPin, Sparkles } from 'lucide-react-taro'
import {
  addMallCartItem,
  listMallHomeBanners,
  listMallProducts,
  resolveMallImageUrl,
  type MallHomeBanner,
  type MallProduct,
} from '@/services/mall'
import {
  MallDealProductCard,
  MallPage,
  MallSectionTitle,
} from '../mall-ui'
import { redirectToMallAuth } from '../auth-route'

interface StoredUser {
  id?: string
}

const quickCategories = [
  { label: '肉禽', keyword: '肉禽' },
  { label: '蛋奶', keyword: '鲜奶' },
  { label: '蔬菜', keyword: '蔬菜' },
  { label: '水果', keyword: '水果' },
  { label: '零食', keyword: '零食' },
  { label: '酒水', keyword: '酒水' },
  { label: '日用', keyword: '日用' },
]

const defaultBanners: MallHomeBanner[] = [
  {
    id: 'opening-promo',
    title: '开业大促',
    subtitle: '社区鲜品低至 8.8 折',
    linkType: 'search',
    linkTarget: '开业大促',
    sortOrder: 1,
    status: 'active',
    metadata: { tag: '今日主推' },
  },
  {
    id: 'full-reduction',
    title: '满减活动',
    subtitle: '满 49 减 6，可叠加积分',
    linkType: 'search',
    linkTarget: '满减',
    sortOrder: 2,
    status: 'active',
    metadata: { tag: '省钱优先' },
  },
  {
    id: 'new-launch',
    title: '新品首发',
    subtitle: '每日上新 10-15 款，节日福利同步上线',
    linkType: 'search',
    linkTarget: '新品',
    sortOrder: 3,
    status: 'active',
    metadata: { tag: '今日刚到' },
  },
]

const announcements = [
  '今日到货提醒：草莓、鲜奶、鸡蛋 16:00 后可提',
  '配送时效调整：晚 6 点场预计 20:30 前到点',
  '售后通知：坏果、破损支持订单内一键申请',
  '团长招募：自提点订单可享 8%-12% 佣金',
]

export default function MallHome() {
  const [products, setProducts] = useState<MallProduct[]>([])
  const [homeBanners, setHomeBanners] = useState<MallHomeBanner[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')

  useDidShow(() => {
    loadProducts()
  })

  const banners = useMemo(() => {
    const active = homeBanners.filter((banner) => banner.status !== 'draft').slice(0, 3)
    return active.length >= 3 ? active : defaultBanners
  }, [homeBanners])
  const primaryBanner = banners[0]
  const primaryBannerImageUrl = resolveMallImageUrl(primaryBanner?.imageUrl)
  const flashSaleProducts = useMemo(() => pickFlashSaleProducts(products), [products])
  const newArrivalProducts = useMemo(() => pickNewArrivalProducts(products), [products])
  const bestSellerProducts = useMemo(() => pickBestSellerProducts(products), [products])
  const countdown = useMemo(() => buildFlashCountdown(), [])

  const currentUser = () => Taro.getStorageSync('userInfo') as StoredUser | undefined

  const loadProducts = async () => {
    setLoading(true)
    setLoadError('')
    try {
      const [productData, bannerData] = await Promise.all([
        listMallProducts({}),
        listMallHomeBanners().catch(() => []),
      ])
      setProducts(productData)
      setHomeBanners(bannerData)
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
    if (!target || banner.linkType === 'none') return
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

  const openProduct = (product: MallProduct) => {
    Taro.navigateTo({ url: `/pages/mall/product/index?id=${product.id}` })
  }

  return (
    <MallPage active="home">
      <MallHomeFixedHeader banners={banners} primaryImageUrl={primaryBannerImageUrl} onBannerTap={openBanner} />

      <View className="mall-v7-pickup-strip">
        <View>
          <Text className="mall-v7-kicker">默认自提点</Text>
          <Text className="mall-v7-pickup-title">叁友甄选 · 中庭自提点</Text>
        </View>
        <View className="mall-v7-pickup-action" onClick={() => Taro.navigateTo({ url: '/pages/mall/address/index' })}>
          <MapPin size={15} color="#2F7E43" />
          <Text>切换</Text>
        </View>
      </View>

      <View className="mall-v7-section mall-v7-flash-sale">
        <View className="mall-v7-section-head">
          <View>
            <View className="mall-v7-title-with-icon">
              <Flame size={19} color="#FF8A1F" />
              <Text className="mall-v7-section-title">秒杀专区</Text>
            </View>
            <Text className="mall-v7-section-subtitle">早 8 点 / 晚 6 点，每日两场</Text>
          </View>
          <View className="mall-v7-countdown">
            <Clock3 size={14} color="#FFFFFF" />
            <Text>{countdown}</Text>
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

      <MallSectionTitle title="新上专区" action="今日刚到" />
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
            key={category.label}
            className="mall-v7-category-tab"
            onClick={() => Taro.navigateTo({ url: `/pages/mall/category/index?keyword=${encodeURIComponent(category.keyword)}` })}
          >
            <Text>{category.label}</Text>
          </View>
        ))}
      </View>

      <MallSectionTitle
        title="爆款推荐"
        action="TOP10"
        onAction={() => Taro.navigateTo({ url: '/pages/mall/category/index?sort=bestSeller' })}
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
          <Text className="mall-empty-copy">团长补货中，请稍后再来。</Text>
        </View>
      ) : null}
    </MallPage>
  )
}

function MallHomeFixedHeader({
  banners,
  primaryImageUrl,
  onBannerTap,
}: {
  banners: MallHomeBanner[]
  primaryImageUrl: string
  onBannerTap: (banner: MallHomeBanner) => void
}) {
  return (
    <View className="mall-v7-home-fixed">
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

function buildFlashCountdown() {
  const now = new Date()
  const sessions = [8, 18]
  const nextHour = sessions.find((hour) => now.getHours() < hour) || 32
  const target = new Date(now)
  if (nextHour >= 24) {
    target.setDate(target.getDate() + 1)
    target.setHours(nextHour - 24, 0, 0, 0)
  } else {
    target.setHours(nextHour, 0, 0, 0)
  }
  const diffSeconds = Math.max(Math.floor((target.getTime() - now.getTime()) / 1000), 0)
  const hours = String(Math.floor(diffSeconds / 3600)).padStart(2, '0')
  const minutes = String(Math.floor((diffSeconds % 3600) / 60)).padStart(2, '0')
  return `${hours}:${minutes}`
}
