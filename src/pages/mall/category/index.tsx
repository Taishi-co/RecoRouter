import { useEffect, useMemo, useState } from 'react'
import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { SlidersHorizontal } from 'lucide-react-taro'
import {
  listMallCategories,
  listMallProducts,
  type MallCategory,
  type MallProduct,
} from '@/services/mall'
import {
  MallPage,
  MallProductThumb,
  MallSearchBox,
  mallYuan,
} from '../mall-ui'

const fallbackCategories = [
  { code: '', name: '热卖' },
  { code: 'fruit', name: '水果' },
  { code: 'vegetable', name: '蔬菜' },
  { code: 'meat', name: '肉禽蛋' },
  { code: 'grain', name: '粮油' },
  { code: 'pickup', name: '到点' },
]

export default function MallCategoryPage() {
  const [categories, setCategories] = useState<MallCategory[]>([])
  const [products, setProducts] = useState<MallProduct[]>([])
  const [activeCode, setActiveCode] = useState('')
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const params = Taro.getCurrentInstance().router?.params
    if (params?.keyword) {
      setKeyword(String(params.keyword))
    }
    loadCategories()
  }, [])

  useEffect(() => {
    loadProducts()
  }, [activeCode])

  const categoryTabs = useMemo(() => {
    const normalized = categories.map((item) => ({
      code: item.code,
      name: categoryLabel(item.name),
    }))
    return normalized.length > 0
      ? [{ code: '', name: '热卖' }, ...normalized, { code: 'pickup', name: '到点' }]
      : fallbackCategories
  }, [categories])

  const loadCategories = async () => {
    try {
      setCategories(await listMallCategories())
    } catch {
      setCategories([])
    }
  }

  const loadProducts = async () => {
    setLoading(true)
    try {
      setProducts(await listMallProducts({
        keyword: keyword.trim() || undefined,
        categoryCode: activeCode && activeCode !== 'pickup' ? activeCode : undefined,
      }))
    } catch (error) {
      setProducts([])
      Taro.showToast({
        title: error instanceof Error ? error.message : '商品加载失败',
        icon: 'none',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <MallPage active="category">
      <Text className="mall-page-title">分类与搜索</Text>
      <MallSearchBox
        value={keyword}
        placeholder="草莓"
        onInput={setKeyword}
        onSearch={loadProducts}
        trailing={<SlidersHorizontal size={18} color="#FF9238" />}
      />

      <View className="mall-category-layout">
        <View className="mall-category-rail">
          {categoryTabs.map((item) => (
            <View
              key={item.code || 'hot'}
              className={activeCode === item.code ? 'mall-category-item mall-category-item-active' : 'mall-category-item'}
              onClick={() => setActiveCode(item.code)}
            >
              <Text>{item.name}</Text>
            </View>
          ))}
        </View>
        <View className="mall-list">
          {products.slice(0, 8).map((product) => (
            <View
              key={product.id}
              className="mall-list-card"
              onClick={() => Taro.navigateTo({ url: `/pages/mall/product/index?id=${product.id}` })}
            >
              <View className="mall-list-thumb">
                <MallProductThumb product={product} />
              </View>
              <View>
                <Text className="mall-list-title">{product.name}</Text>
                <Text className="mall-list-meta">
                  {product.subtitle || `${product.deliveryMinutes} 分钟到点`}
                </Text>
                <View className="mall-list-row">
                  <Text className="mall-price">{mallYuan(product.priceCents)}</Text>
                  <Text className="mall-list-meta">
                    {product.stock > 0 ? `余 ${product.stock} 份` : '邻里复购'}
                  </Text>
                </View>
              </View>
            </View>
          ))}

          {!loading && products.length === 0 ? (
            <View className="mall-empty">
              <Text className="mall-empty-title">没有找到商品</Text>
              <Text className="mall-empty-copy">换个分类或关键词试试。</Text>
            </View>
          ) : null}
        </View>
      </View>
    </MallPage>
  )
}

function categoryLabel(name: string) {
  if (name.includes('鲜奶')) return '肉禽蛋'
  if (name.includes('水果')) return '水果'
  if (name.includes('蔬')) return '蔬菜'
  return name
}
