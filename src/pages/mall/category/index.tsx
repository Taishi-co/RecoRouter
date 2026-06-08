import { useEffect, useMemo, useState } from 'react'
import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { SlidersHorizontal } from 'lucide-react-taro'
import {
  addMallCartItem,
  listMallProducts,
  type MallProduct,
} from '@/services/mall'
import {
  MallDealProductCard,
  MallPage,
  MallSearchBox,
} from '../mall-ui'
import { redirectToMallAuth } from '../auth-route'

interface StoredUser {
  id?: string
}

const mallV7Categories = [
  { code: '', label: '全部', keyword: '' },
  { code: 'meat', label: '肉禽', keyword: '肉禽' },
  { code: 'milk', label: '蛋奶', keyword: '鲜奶' },
  { code: 'vegetable', label: '蔬菜', keyword: '蔬菜' },
  { code: 'fruit', label: '水果', keyword: '水果' },
  { code: 'snack', label: '零食', keyword: '零食' },
  { code: 'wine', label: '酒水', keyword: '酒水' },
  { code: 'daily', label: '日用', keyword: '日用' },
]

export default function MallCategoryPage() {
  const routeParams = Taro.getCurrentInstance().router?.params
  const initialKeyword = routeParams?.keyword ? String(routeParams.keyword) : ''
  const initialCode = routeParams?.categoryCode ? String(routeParams.categoryCode) : categoryCodeFromKeyword(initialKeyword)
  const [products, setProducts] = useState<MallProduct[]>([])
  const [activeCode, setActiveCode] = useState(initialCode)
  const [keyword, setKeyword] = useState(initialKeyword)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    loadProducts()
  }, [activeCode])

  const activeCategory = useMemo(
    () => mallV7Categories.find((category) => category.code === activeCode) || mallV7Categories[0],
    [activeCode],
  )

  const currentUser = () => Taro.getStorageSync('userInfo') as StoredUser | undefined

  const loadProducts = async () => {
    setLoading(true)
    setLoadError('')
    try {
      const category = mallV7Categories.find((item) => item.code === activeCode)
      const nextProducts = await listMallProducts({
        keyword: keyword.trim() || category?.keyword || undefined,
        categoryCode: isSeedCategory(activeCode) ? activeCode : undefined,
      })
      setProducts(nextProducts)
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

  const handleSearch = () => {
    setActiveCode('')
    loadProducts()
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
        <View>
          <Text className="mall-v7-kicker">叁友甄选</Text>
          <Text className="mall-page-title">商品列表</Text>
        </View>
        <View className="mall-v7-head-pill">
          <Text>{activeCategory.label}</Text>
        </View>
      </View>

      <MallSearchBox
        value={keyword}
        placeholder="搜索肉禽、鲜奶、草莓"
        onInput={setKeyword}
        onSearch={handleSearch}
        trailing={<SlidersHorizontal size={18} color="#FF9238" />}
      />

      <View className="mall-v7-category-tabs">
        {mallV7Categories.map((category) => (
          <View
            key={category.code || 'all'}
            className={activeCode === category.code ? 'mall-v7-category-tab mall-v7-category-tab-active' : 'mall-v7-category-tab'}
            onClick={() => {
              setKeyword(category.keyword)
              setActiveCode(category.code)
            }}
          >
            <Text>{category.label}</Text>
          </View>
        ))}
      </View>

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
    </MallPage>
  )
}

function categoryCodeFromKeyword(keyword: string) {
  const matched = mallV7Categories.find((category) => category.keyword && keyword.includes(category.keyword))
  return matched?.code || ''
}

function isSeedCategory(code: string) {
  return ['fruit', 'vegetable', 'milk'].includes(code)
}
