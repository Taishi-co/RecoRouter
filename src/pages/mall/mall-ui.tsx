import { useLayoutEffect, type PropsWithChildren, type ReactNode } from 'react'
import { Image, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import {
  Apple,
  Check,
  ChevronRight,
  Grid2x2,
  House,
  MapPin,
  Search,
  ShoppingCart,
  UserRound,
} from 'lucide-react-taro'
import { resolveMallImageUrl, type MallProduct, yuan } from '@/services/mall'
import { Input } from '@/components/ui/input'
import './mall-theme.css'

type MallTabKey = 'home' | 'category' | 'cart' | 'mine'

type MallIcon = typeof House

const MALL_H5_BODY_CLASS = 'reco-mall-h5'
let mallH5PageCount = 0

const tabItems: Array<{ key: MallTabKey; label: string; url: string; icon: MallIcon }> = [
  { key: 'home', label: '首页', url: '/pages/mall/index/index', icon: House },
  { key: 'category', label: '分类', url: '/pages/mall/category/index', icon: Grid2x2 },
  { key: 'cart', label: '购物车', url: '/pages/mall/cart/index', icon: ShoppingCart },
  { key: 'mine', label: '我的', url: '/pages/mall/profile/index', icon: UserRound },
]

export function mallYuan(cents?: number | null) {
  return yuan(cents).replace(/\.00$/, '').replace(/0$/, '')
}

export function MallStatusBar() {
  return null
}

export function MallPage({
  active,
  children,
  noTab,
}: PropsWithChildren<{ active?: MallTabKey; noTab?: boolean }>) {
  useMallH5BodyClass()

  return (
    <View className="mall-shell">
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
            <Icon size={21} color={isActive ? '#63BF54' : '#6D766B'} />
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
  trailing,
}: {
  value?: string
  placeholder: string
  onInput?: (value: string) => void
  onSearch?: () => void
  trailing?: ReactNode
}) {
  return (
    <View className="mall-search" onClick={onSearch}>
      <Search size={18} color="#64725F" />
      <Input
        className="mall-search-input"
        value={value}
        placeholder={placeholder}
        onInput={(event) => onInput?.(String(event.detail.value || ''))}
      />
      {trailing}
    </View>
  )
}

export function MallProductThumb({ product, large }: { product?: MallProduct | null; large?: boolean }) {
  const imageUrl = resolveMallImageUrl(product?.imageUrl)
  if (imageUrl) {
    return <Image className={large ? 'mall-product-image mall-product-image-large' : 'mall-product-image'} mode="aspectFill" src={imageUrl} />
  }
  return (
    <View className={large ? 'mall-product-illustration mall-product-illustration-large' : 'mall-product-illustration'}>
      <Apple size={large ? 78 : 54} color="#63BF54" />
    </View>
  )
}

export function MallLocationStrip({
  title = '绿荫花园 3 号楼团长点',
  subtitle = '明日 16:00-19:00 自提',
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
