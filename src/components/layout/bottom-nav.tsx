import type { ComponentType } from 'react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Image, Text, View } from '@tarojs/components'
import Taro, { useDidHide, useDidShow } from '@tarojs/taro'
import {
  Bell,
  ChartNoAxesCombined,
  ClipboardList,
  Headphones,
  House,
  ReceiptText,
  Route,
  ShoppingCart,
  Truck,
  User,
  Users,
  Wallet,
} from 'lucide-react-taro'
import sanyouLogo from '@/assets/brand/sanyou.png'
import { cn } from '@/lib/utils'
import { IS_H5_ENV } from '@/presets/env'
import { getFixedBottomPadding } from '@/lib/safe-area'

type NavIcon = ComponentType<any>

interface BottomNavItem {
  key: string
  label: string
  icon: NavIcon
  url: string
  brandIcon?: 'sanyou'
}

const merchantItems: BottomNavItem[] = [
  { key: 'publish', label: '发布需求', icon: ClipboardList, url: '/pages/merchant/demands/publish' },
  { key: 'demands', label: '需求', icon: Route, url: '/pages/merchant/demands/list' },
  { key: 'mall', label: '商城', icon: ShoppingCart, url: '/pages/mall/index/index', brandIcon: 'sanyou' },
  { key: 'orders', label: '订单', icon: ReceiptText, url: '/pages/merchant/orders/index' },
  { key: 'profile', label: '我的', icon: User, url: '/pages/merchant/profile/index' },
]

const ownerItems: BottomNavItem[] = [
  { key: 'demands', label: '接需求', icon: ClipboardList, url: '/pages/owner/demands/index' },
  { key: 'vehicles', label: '车辆', icon: Truck, url: '/pages/owner/vehicles/index' },
  { key: 'orders', label: '订单', icon: ReceiptText, url: '/pages/owner/orders/index' },
  { key: 'revenue', label: '钱包', icon: Wallet, url: '/pages/owner/wallet/index' },
  { key: 'profile', label: '我的', icon: User, url: '/pages/owner/profile/index' },
]

const enterpriseItems: BottomNavItem[] = [
  { key: 'home', label: '首页', icon: House, url: '/pages/enterprise/index/index' },
  { key: 'dispatch', label: '调度', icon: Route, url: '/pages/enterprise/dispatch/index' },
  { key: 'fleet', label: '车队', icon: Truck, url: '/pages/enterprise/fleet/index' },
  { key: 'orders', label: '订单', icon: ClipboardList, url: '/pages/enterprise/order-hall/index' },
  { key: 'stats', label: '数据', icon: ChartNoAxesCombined, url: '/pages/enterprise/stats/index' },
]

const adminItems: BottomNavItem[] = [
  { key: 'users', label: '用户', icon: Users, url: '/pages/admin/users/index' },
  { key: 'vehicles', label: '车辆', icon: Truck, url: '/pages/admin/vehicles/index' },
  { key: 'mall', label: '商城', icon: ShoppingCart, url: '/pages/admin/mall/index', brandIcon: 'sanyou' },
  { key: 'support', label: '客服', icon: Headphones, url: '/pages/admin/support/index' },
  { key: 'orders', label: '订单', icon: ClipboardList, url: '/pages/admin/orders/index' },
  { key: 'profile', label: '我的', icon: User, url: '/pages/admin/settings/index' },
]

const commonItems: BottomNavItem[] = [
  { key: 'home', label: '首页', icon: House, url: '/pages/index/index' },
  { key: 'messages', label: '消息', icon: Bell, url: '/pages/notifications/index' },
  { key: 'profile', label: '我的', icon: User, url: '/pages/role-switch/index' },
]

const itemGroups = {
  merchant: merchantItems,
  owner: ownerItems,
  enterprise: enterpriseItems,
  admin: adminItems,
  common: commonItems,
}

interface BottomNavProps {
  type: keyof typeof itemGroups
  active: string
  tone?: 'default' | 'mall'
}

const readStoredActiveKey = (storageKey: string, items: BottomNavItem[], fallback: string) => {
  if (!IS_H5_ENV || typeof window === 'undefined') return fallback

  const stored = window.sessionStorage.getItem(storageKey)
  return items.some((item) => item.key === stored) ? stored || fallback : fallback
}

const writeStoredActiveKey = (storageKey: string, activeKey: string) => {
  if (!IS_H5_ENV || typeof window === 'undefined') return
  window.sessionStorage.setItem(storageKey, activeKey)
}

export const BottomNav = ({ type, active, tone = 'default' }: BottomNavProps) => {
  const items = itemGroups[type]
  const isMallTone = tone === 'mall'
  const bottomPadding = IS_H5_ENV ? 'max(14px, env(safe-area-inset-bottom))' : `${getFixedBottomPadding(14)}px`
  const navStateKey = `recorouter-bottom-nav:${type}`
  const [activeKey, setActiveKey] = useState(() => readStoredActiveKey(navStateKey, items, active))
  const [pageVisible, setPageVisible] = useState(true)
  const [mounted, setMounted] = useState(!IS_H5_ENV)
  const navigateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingActiveRef = useRef<string | null>(null)
  const activeIndex = Math.max(items.findIndex((item) => item.key === activeKey), 0)
  const gapPx = 4
  const horizontalPaddingPx = 8
  const activeIndicatorWidth = `calc((100% - ${horizontalPaddingPx + Math.max(items.length - 1, 0) * gapPx}px) / ${items.length})`
  const activeIndicatorTransform = `translateX(calc(${activeIndex * 100}% + ${activeIndex * gapPx}px))`

  useDidShow(() => {
    setPageVisible(true)
  })

  useDidHide(() => {
    setPageVisible(false)
  })

  useEffect(() => {
    setMounted(true)

    return () => {
      if (navigateTimerRef.current) {
        clearTimeout(navigateTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (pendingActiveRef.current && pendingActiveRef.current !== active) {
      return
    }

    pendingActiveRef.current = null
    writeStoredActiveKey(navStateKey, active)

    if (activeKey === active) return

    if (IS_H5_ENV && typeof window !== 'undefined') {
      const frame = window.requestAnimationFrame(() => {
        setActiveKey(active)
      })

      return () => window.cancelAnimationFrame(frame)
    }

    setActiveKey(active)
  }, [active, activeKey, navStateKey])

  const navigateTo = (item: BottomNavItem) => {
    if (navigateTimerRef.current) {
      clearTimeout(navigateTimerRef.current)
      navigateTimerRef.current = null
    }

    pendingActiveRef.current = item.key
    writeStoredActiveKey(navStateKey, item.key)
    setActiveKey(item.key)

    const currentRoute = Taro.getCurrentPages().at(-1)?.route || ''
    const targetRoute = item.url.replace(/^\//, '')

    if (currentRoute === targetRoute) {
      pendingActiveRef.current = null
      return
    }

    const runNavigation = () => {
      const fallbackToHash = () => {
        if (!IS_H5_ENV || typeof window === 'undefined') return

        const targetHash = `#${item.url}`
        if (window.location.hash !== targetHash) {
          window.location.hash = targetHash
        }
      }

      Taro.redirectTo({
        url: item.url,
        fail: () => {
          Taro.navigateTo({
            url: item.url,
            fail: fallbackToHash,
          })
        },
      })

      if (IS_H5_ENV && typeof window !== 'undefined') {
        window.setTimeout(() => {
          if (!window.location.hash.includes(item.url)) {
            fallbackToHash()
          }
        }, 160)
      }
    }

    navigateTimerRef.current = setTimeout(runNavigation, 260)
  }

  const nav = (
    <View
      className="fixed inset-x-0 bottom-0 z-[2147483646] flex justify-center bg-transparent px-5 pt-3 pointer-events-none"
      style={{
        boxSizing: 'border-box',
        width: '100%',
        maxWidth: '100%',
        paddingBottom: bottomPadding,
      }}
    >
      <View
        className={cn(
          'pointer-events-auto relative flex h-16 items-center gap-1 overflow-hidden rounded-full border bg-white p-1 shadow-xl',
          isMallTone ? '' : 'border-gray-200',
        )}
        style={{
          boxSizing: 'border-box',
          width: 'min(350px, calc(100vw - 40px))',
          borderColor: isMallTone ? '#DDE7D6' : undefined,
          backgroundColor: isMallTone ? '#FFFFFF' : undefined,
        }}
      >
        <View
          className={cn(
            'absolute left-1 top-1 h-14 rounded-full shadow-sm transition-transform duration-500 ease-out',
            isMallTone ? '' : 'bg-primary',
          )}
          style={{
            width: activeIndicatorWidth,
            transform: activeIndicatorTransform,
            transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
            backgroundColor: isMallTone ? '#2F7D32' : undefined,
          }}
        />
        {items.map((item) => {
          const selected = item.key === activeKey
          const Icon = item.icon

          return (
            <View
              key={item.key}
              className={cn(
                'relative z-10 flex-1 h-14 rounded-full flex flex-col items-center justify-center gap-1 transition-all duration-300 ease-out active:scale-95',
                selected ? 'text-white scale-100' : 'text-gray-500 scale-95',
              )}
              style={{ flex: '1 1 0', minWidth: 0 }}
              onClick={() => navigateTo(item)}
            >
              {item.brandIcon === 'sanyou' ? (
                <Image
                  className="bottom-nav-brand-icon"
                  mode="aspectFit"
                  src={sanyouLogo}
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    backgroundColor: '#FFFFFF',
                  }}
                />
              ) : (
                <Icon size={16} color={selected ? '#FFFFFF' : isMallTone ? '#6C7568' : '#8B95A7'} strokeWidth={2.2} />
              )}
              <Text
                className={cn('text-xs font-bold leading-none transition-colors duration-300', selected ? 'text-white' : 'text-gray-500')}
                style={!selected && isMallTone ? { color: '#6C7568' } : undefined}
              >
                {item.label}
              </Text>
            </View>
          )
        })}
      </View>
    </View>
  )

  if (IS_H5_ENV && mounted && pageVisible && typeof document !== 'undefined') {
    return createPortal(nav, document.body)
  }

  if (!pageVisible) return null

  return nav
}
