import type { MallCategory } from '@/services/mall'

export interface MallCategoryOption {
  code: string
  label: string
}

const fallbackMallCategoryOptions: MallCategoryOption[] = [
  { code: 'fruit', label: '生鲜瓜果' },
  { code: 'milk', label: '鲜奶' },
  { code: 'vegetable', label: '蔬菜' },
  { code: 'bakery', label: '早餐烘焙' },
  { code: 'bundle', label: '家庭量贩' },
  { code: 'goods', label: '周边' },
  { code: 'drink', label: '饮品' },
  { code: 'beverages', label: '酒水' },
  { code: 'dairy', label: '乳制品' },
  { code: 'expired_milk', label: '临期牛奶' },
  { code: 'snack', label: '零食' },
  { code: 'daily_care', label: '日化洗护' },
  { code: 'condiment', label: '调味品' },
  { code: 'gift_box', label: '礼盒' },
  { code: 'meat', label: '生鲜肉类' },
]

export function mallCategoryOptionsFromCategories(
  categories: MallCategory[],
  options: { includeAll?: boolean } = {},
) {
  const activeCategories = categories
    .filter((category) => category.status !== 'inactive')
    .sort((left, right) => (left.sortOrder || 0) - (right.sortOrder || 0))
    .map((category) => ({
      code: category.code,
      label: category.name || category.code,
    }))
  const source = activeCategories.length > 0 ? activeCategories : fallbackMallCategoryOptions
  return options.includeAll ? [{ code: '', label: '全部' }, ...source] : source
}

export function mallCategoryCodeFromKeyword(keyword: string, categories: MallCategoryOption[]) {
  const trimmed = keyword.trim()
  if (!trimmed) return ''
  const matched = categories.find((category) => category.code && (
    category.label.includes(trimmed) || trimmed.includes(category.label)
  ))
  return matched?.code || ''
}
