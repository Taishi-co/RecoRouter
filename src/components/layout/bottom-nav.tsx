import type { ComponentType } from 'react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Text, View } from '@tarojs/components'
import Taro, { useDidHide, useDidShow } from '@tarojs/taro'
import {
  Activity,
  Bell,
  ChartNoAxesCombined,
  ClipboardList,
  House,
  Map,
  ReceiptText,
  Route,
  Truck,
  User,
  Users,
  Wallet,
} from 'lucide-react-taro'
import { cn } from '@/lib/utils'
import { IS_H5_ENV } from '@/presets/env'

type NavIcon = ComponentType<any>

interface BottomNavItem {
  key: string
  label: string
  icon: NavIcon
  url: string
}

const merchantItems: BottomNavItem[] = [
  { key: 'publish', label: '发布', icon: ClipboardList, url: '/pages/merchant/demands/publish' },
  { key: 'orders', label: '订单', icon: ReceiptText, url: '/pages/merchant/orders/index' },
  { key: 'map', label: '地图', icon: Map, url: '/pages/merchant/route-map/index' },
  { key: 'stats', label: '统计', icon: Activity, url: '/pages/merchant/stats/index' },
  { key: 'profile', label: '我的', icon: User, url: '/pages/merchant/profile/index' },
]

const ownerItems: BottomNavItem[] = [
  { key: 'home', label: '首页', icon: House, url: '/pages/owner/demands/index' },
  { key: 'vehicles', label: '车辆', icon: Truck, url: '/pages/owner/vehicles/index' },
  { key: 'map', label: '地图', icon: Map, url: '/pages/owner/vehicle-map/index' },
  { key: 'revenue', label: '收益', icon: Wallet, url: '/pages/owner/profile/revenue-stats/index' },
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
  { key: 'orders', label: '订单', icon: ClipboardList, url: '/pages/admin/orders/index' },
  { key: 'stats', label: '统计', icon: ChartNoAxesCombined, url: '/pages/admin/stats/index' },
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

export const BottomNav = ({ type, active }: BottomNavProps) => {
  const items = itemGroups[type]
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
        paddingBottom: 'max(14px, env(safe-area-inset-bottom))',
      }}
    >
      <View
        className="pointer-events-auto relative flex h-16 items-center gap-1 overflow-hidden rounded-full border border-gray-200 bg-white p-1 shadow-xl"
        style={{ boxSizing: 'border-box', width: 'min(350px, calc(100vw - 40px))' }}
      >
        <View
          className="absolute left-1 top-1 h-14 rounded-full bg-primary shadow-sm transition-transform duration-500 ease-out"
          style={{
            width: activeIndicatorWidth,
            transform: activeIndicatorTransform,
            transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
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
              <Icon size={16} color={selected ? '#FFFFFF' : '#8B95A7'} strokeWidth={2.2} />
              <Text className={cn('text-xs font-bold leading-none transition-colors duration-300', selected ? 'text-white' : 'text-gray-500')}>
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
