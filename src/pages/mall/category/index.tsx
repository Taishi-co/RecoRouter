import { useEffect, useMemo, useState } from 'react'
import { Picker, Text, View } from '@tarojs/components'
import Taro, { useReachBottom } from '@tarojs/taro'
import {
  addMallCartItem,
  listMallCategories,
  listMallProducts,
  type MallCategory,
  type MallProduct,
} from '@/services/mall'
import {
  MallBrandMark,
  MallDealProductCard,
  MallPage,
  MallSearchBox,
} from '../mall-ui'
import { redirectToMallAuth } from '../auth-route'
import { mallCategoryOptionsFromCategories } from '../category-options'

interface StoredUser {
  id?: string
}

const pageSize = 12
type MallActivityType = '' | 'flash_sale' | 'full_reduction' | 'new_arrival' | 'best_seller'
type MallSortKey = '' | 'price_asc' | 'price_desc' | 'newest' | 'oldest' | 'sales_desc'

const activityFilters: Array<{ label: string; value: MallActivityType }> = [
  { label: '全部', value: '' },
  { label: '秒杀', value: 'flash_sale' },
  { label: '满减', value: 'full_reduction' },
  { label: '今日上新', value: 'new_arrival' },
  { label: '爆款', value: 'best_seller' },
]

const sortOptions: Array<{ label: string; value: MallSortKey }> = [
  { label: '综合排序', value: '' },
  { label: '价格从低到高', value: 'price_asc' },
  { label: '价格从高到低', value: 'price_desc' },
  { label: '最新上架', value: 'newest' },
  { label: '最早上架', value: 'oldest' },
  { label: '销量优先', value: 'sales_desc' },
]

export default function MallCategoryPage() {
  const routeParams = Taro.getCurrentInstance().router?.params
  const initialKeyword = decodeRouteParam(routeParams?.keyword)
  const initialCode = decodeRouteParam(routeParams?.categoryCode)
  const initialActivityType = normalizeInitialActivityType(routeParams?.activityType || routeParams?.activity)
  const initialSort = normalizeInitialSort(routeParams?.sort)
  const [categories, setCategories] = useState<MallCategory[]>([])
  const [products, setProducts] = useState<MallProduct[]>([])
  const [activeCode, setActiveCode] = useState(initialCode)
  const [keyword, setKeyword] = useState(initialKeyword)
  const [activityType, setActivityType] = useState<MallActivityType>(initialActivityType)
  const [sort, setSort] = useState<MallSortKey>(initialSort)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let mounted = true
    listMallCategories()
      .then((data) => {
        if (mounted) setCategories(data)
      })
      .catch(() => {
        if (mounted) setCategories([])
      })
    return () => {
      mounted = false
    }
  }, [])

  const categoryOptions = useMemo(
    () => mallCategoryOptionsFromCategories(categories, { includeAll: true }),
    [categories],
  )

  useEffect(() => {
    loadProducts({ nextPage: 1, append: false })
  }, [activeCode, activityType, sort])

  const activeCategory = useMemo(
    () => categoryOptions.find((category) => category.code === activeCode) || categoryOptions[0],
    [activeCode, categoryOptions],
  )
  const activeActivity = useMemo(
    () => activityFilters.find((activity) => activity.value === activityType) || activityFilters[0],
    [activityType],
  )
  const activeFilterLabel = useMemo(() => {
    const labels = [activeCategory.label]
    if (activeActivity.value) labels.push(activeActivity.label)
    return labels.join(' · ')
  }, [activeActivity, activeCategory])
  const sortIndex = useMemo(() => {
    const index = sortOptions.findIndex((option) => option.value === sort)
    return index >= 0 ? index : 0
  }, [sort])

  useReachBottom(() => {
    if (loading || loadingMore || !hasMore) return
    loadProducts({ nextPage: page + 1, append: true })
  })

  const currentUser = () => Taro.getStorageSync('userInfo') as StoredUser | undefined

  const loadProducts = async ({
    nextPage = 1,
    append = false,
    nextKeyword = keyword,
    nextActiveCode = activeCode,
    nextActivityType = activityType,
    nextSort = sort,
  }: {
    nextPage?: number
    append?: boolean
    nextKeyword?: string
    nextActiveCode?: string
    nextActivityType?: MallActivityType
    nextSort?: MallSortKey
  } = {}) => {
    if (append) {
      setLoadingMore(true)
    } else {
      setLoading(true)
      setHasMore(true)
    }
    setLoadError('')
    try {
      const nextProducts = await listMallProducts({
        keyword: nextKeyword.trim() || undefined,
        categoryCode: nextActiveCode || undefined,
        activityType: nextActivityType || undefined,
        sort: nextSort || undefined,
        page: nextPage,
        pageSize,
      })
      const displayProducts = applyProductListPresentation(nextProducts, nextActivityType, nextSort)
      setProducts((current) => append ? mergeProducts(current, displayProducts) : displayProducts)
      setPage(nextPage)
      setHasMore(nextProducts.length >= pageSize)
    } catch (error) {
      if (!append) {
        setProducts([])
      }
      setLoadError(error instanceof Error ? error.message : '商品加载失败')
      Taro.showToast({
        title: error instanceof Error ? error.message : '商品加载失败',
        icon: 'none',
      })
    } finally {
      if (append) {
        setLoadingMore(false)
      } else {
        setLoading(false)
      }
    }
  }

  const handleSearch = () => {
    loadProducts({ nextPage: 1, append: false, nextKeyword: keyword.trim() })
  }

  const handleActivityChange = (nextActivityType: MallActivityType) => {
    const nextSort = nextActivityType === 'best_seller' ? 'sales_desc' : sort
    setLoading(true)
    setLoadError('')
    if (nextActivityType === activityType && nextSort === sort) {
      loadProducts({ nextPage: 1, append: false, nextActivityType, nextSort })
      return
    }
    setActivityType(nextActivityType)
    if (nextSort !== sort) {
      setSort(nextSort)
    }
  }

  const handleSortChange = (index: number) => {
    const nextSort = sortOptions[index]?.value || ''
    setLoading(true)
    setLoadError('')
    if (nextSort === sort) {
      loadProducts({ nextPage: 1, append: false, nextSort })
      return
    }
    setSort(nextSort)
  }

  const handleAddCart = async (product: MallProduct) => {
    const user = currentUser()
    if (!user?.id) {
      Taro.showToast({ title: '请先登录', icon: 'none' })
      redirectToMallAuth('/pages/mall/category/index')
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
    <MallPage active="category">
      <View className="mall-v7-page-head">
        <View className="mall-v7-head-brand">
          <MallBrandMark compact />
          <View>
            <Text className="mall-v7-kicker">叁友甄选</Text>
            <Text className="mall-page-title">商品列表</Text>
          </View>
        </View>
        <View className="mall-v7-head-pill">
          <Text>{activeFilterLabel}</Text>
        </View>
      </View>

      <MallSearchBox
        value={keyword}
        placeholder="搜索肉禽、鲜奶、草莓"
        onInput={setKeyword}
        onSearch={handleSearch}
        actionText="搜索"
      />

      <View className="mall-v7-filter-panel">
        <View className="mall-v7-activity-tabs">
          {activityFilters.map((activity) => (
            <View
              key={activity.value || 'all-activity'}
              className={activityType === activity.value ? 'mall-v7-activity-tab mall-v7-activity-tab-active' : 'mall-v7-activity-tab'}
              onClick={() => handleActivityChange(activity.value)}
            >
              <Text>{activity.label}</Text>
            </View>
          ))}
        </View>
        <Picker
          mode="selector"
          range={sortOptions.map((option) => option.label)}
          value={sortIndex}
          onChange={(event) => handleSortChange(Number(event.detail.value))}
        >
          <View className="mall-v7-sort-select">
            <Text className="mall-v7-sort-label">排序</Text>
            <Text>{sortOptions[sortIndex]?.label || '综合排序'}</Text>
          </View>
        </Picker>
      </View>

      <View className="mall-v7-category-layout">
        <View className="mall-v7-category-sidebar">
          {categoryOptions.map((category) => (
            <View
              key={category.code || 'all'}
              className={activeCode === category.code ? 'mall-v7-category-tab mall-v7-category-tab-active' : 'mall-v7-category-tab'}
              onClick={() => {
                setLoading(true)
                setLoadError('')
                setKeyword('')
                if (category.code === activeCode) {
                  loadProducts({ nextPage: 1, append: false, nextKeyword: '', nextActiveCode: category.code })
                } else {
                  setActiveCode(category.code)
                }
              }}
            >
              <Text>{category.label}</Text>
            </View>
          ))}
        </View>

        <View className="mall-v7-category-products">
          <View className="mall-v7-product-list">
            {products.map((product) => (
              <MallDealProductCard
                key={product.id}
                product={product}
                layout="list"
                onAdd={handleAddCart}
                onOpen={() => Taro.navigateTo({ url: `/pages/mall/product/index?id=${product.id}` })}
              />
            ))}
          </View>

          {!loading && products.length === 0 ? (
            <View className="mall-empty">
              <Text className="mall-empty-title">{loadError ? '加载失败' : '没有找到商品'}</Text>
              <Text className="mall-empty-copy">{loadError || '换个分类或关键词试试。'}</Text>
            </View>
          ) : null}

          {products.length > 0 ? (
            <View className="mall-load-more">
              <Text>{loadingMore ? '加载更多商品...' : hasMore ? '上滑加载更多' : '已经到底了'}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {loading ? (
        <View className="mall-loading-overlay">
          <View className="mall-loading-card">
            <View className="mall-loading-spinner" />
            <Text>加载中...</Text>
          </View>
        </View>
      ) : null}
    </MallPage>
  )
}

function mergeProducts(current: MallProduct[], nextProducts: MallProduct[]) {
  const seen = new Set(current.map((product) => product.id))
  return [
    ...current,
    ...nextProducts.filter((product) => {
      if (seen.has(product.id)) return false
      seen.add(product.id)
      return true
    }),
  ]
}

function applyProductListPresentation(
  products: MallProduct[],
  activityType: MallActivityType,
  sort: MallSortKey,
) {
  let nextProducts = [...products]
  const activityMatchedProducts = filterProductsByActivity(nextProducts, activityType)
  if (activityMatchedProducts.length > 0) {
    nextProducts = activityMatchedProducts
  }
  return sortProducts(nextProducts, sort)
}

function filterProductsByActivity(products: MallProduct[], activityType: MallActivityType) {
  if (!activityType || activityType === 'best_seller') return []
  return products.filter((product) => {
    const tags = product.tags?.join('') || ''
    const label = product.discountLabel || ''
    if (activityType === 'flash_sale') {
      return /秒杀|特价|爆款|限时/.test(tags)
    }
    if (activityType === 'full_reduction') {
      return (product.savedCents || 0) > 0 || /满减|立减|优惠/.test(`${tags}${label}`)
    }
    if (activityType === 'new_arrival') {
      return /今日|新品|新上|现货|刚到/.test(tags)
    }
    return false
  })
}

function sortProducts(products: MallProduct[], sort: MallSortKey) {
  const sortedProducts = [...products]
  if (sort === 'price_asc') {
    return sortedProducts.sort((a, b) => productPayableCents(a) - productPayableCents(b))
  }
  if (sort === 'price_desc') {
    return sortedProducts.sort((a, b) => productPayableCents(b) - productPayableCents(a))
  }
  if (sort === 'newest') {
    return sortedProducts.sort((a, b) => productTimestamp(b) - productTimestamp(a))
  }
  if (sort === 'oldest') {
    return sortedProducts.sort((a, b) => productTimestamp(a) - productTimestamp(b))
  }
  if (sort === 'sales_desc' || sort === '') {
    return sort === 'sales_desc'
      ? sortedProducts.sort((a, b) => (b.soldCount || 0) - (a.soldCount || 0))
      : sortedProducts
  }
  return sortedProducts
}

function productPayableCents(product: MallProduct) {
  return product.discountedPriceCents ?? product.priceCents ?? 0
}

function productTimestamp(product: MallProduct) {
  const timestamp = Date.parse(product.createdAt || product.updatedAt || '')
  return Number.isFinite(timestamp) ? timestamp : 0
}

function normalizeInitialActivityType(value?: string | string[]): MallActivityType {
  const rawValue = decodeRouteParam(value)
  switch (rawValue) {
    case 'flashSale':
    case 'flash_sale':
    case 'seckill':
      return 'flash_sale'
    case 'fullReduction':
    case 'full_reduction':
      return 'full_reduction'
    case 'newArrival':
    case 'new_arrival':
      return 'new_arrival'
    case 'bestSeller':
    case 'best_seller':
      return 'best_seller'
    default:
      return ''
  }
}

function normalizeInitialSort(value?: string | string[]): MallSortKey {
  const rawValue = decodeRouteParam(value)
  switch (rawValue) {
    case 'priceAsc':
    case 'price_asc':
      return 'price_asc'
    case 'priceDesc':
    case 'price_desc':
      return 'price_desc'
    case 'newest':
    case 'dateDesc':
    case 'date_desc':
      return 'newest'
    case 'oldest':
    case 'dateAsc':
    case 'date_asc':
      return 'oldest'
    case 'salesDesc':
    case 'sales_desc':
    case 'bestSeller':
    case 'best_seller':
      return 'sales_desc'
    default:
      return ''
  }
}

function decodeRouteParam(value?: string | string[]) {
  const rawValue = Array.isArray(value) ? value[0] : value
  if (!rawValue) return ''
  try {
    return decodeURIComponent(String(rawValue))
  } catch {
    return String(rawValue)
  }
}
