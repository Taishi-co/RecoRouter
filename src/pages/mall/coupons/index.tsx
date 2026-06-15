import { useMemo, useState } from 'react'
import { Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { BadgeCheck, Clock3, Ticket, WalletCards } from 'lucide-react-taro'
import {
  claimMallCoupon,
  listMallCoupons,
  type MallCoupon,
  type MallCouponWallet,
  type MallCouponWalletStatus,
} from '@/services/mall'
import { MallPage, MallPrimaryButton, mallYuan } from '../mall-ui'
import { redirectToMallAuth } from '../auth-route'

interface StoredUser {
  id?: string
}

type CouponTab = 'claimable' | 'claimed' | 'expiring' | 'used' | 'expired'

const tabs: Array<{ key: CouponTab; label: string }> = [
  { key: 'claimable', label: '待领取' },
  { key: 'claimed', label: '已领取' },
  { key: 'expiring', label: '即将过期' },
  { key: 'used', label: '已使用' },
  { key: 'expired', label: '已过期' },
]

const emptyWallet: MallCouponWallet = {
  summary: {},
  claimable: [],
  claimed: [],
  expiring: [],
  used: [],
  expired: [],
  all: [],
}

export default function MallCouponsPage() {
  const [wallet, setWallet] = useState<MallCouponWallet>(emptyWallet)
  const [activeTab, setActiveTab] = useState<CouponTab>('claimable')
  const [typeFilter, setTypeFilter] = useState('')
  const [loading, setLoading] = useState(false)
  const [claimingId, setClaimingId] = useState('')
  const userId = (Taro.getStorageSync('userInfo') as StoredUser | undefined)?.id || ''

  useDidShow(() => {
    loadCoupons()
  })

  const loadCoupons = async () => {
    if (!userId) {
      Taro.showToast({ title: '请先登录', icon: 'none' })
      redirectToMallAuth('/pages/mall/coupons/index')
      return
    }
    setLoading(true)
    try {
      setWallet(await listMallCoupons(userId))
    } catch (error) {
      setWallet(emptyWallet)
      Taro.showToast({
        title: error instanceof Error ? error.message : '优惠券加载失败',
        icon: 'none',
      })
    } finally {
      setLoading(false)
    }
  }

  const couponTypes = useMemo(() => {
    const typeMap = new Map<string, string>()
    wallet.all.forEach((coupon) => {
      if (coupon.couponType) typeMap.set(coupon.couponType, couponTypeLabel(coupon.couponType))
    })
    return Array.from(typeMap.entries()).map(([key, label]) => ({ key, label }))
  }, [wallet.all])

  const visibleCoupons = useMemo(() => {
    const source = wallet[activeTab] || []
    return source.filter((coupon) => !typeFilter || coupon.couponType === typeFilter)
  }, [activeTab, typeFilter, wallet])

  const claimCoupon = async (coupon: MallCoupon) => {
    if (!coupon.id || claimingId) return
    setClaimingId(coupon.id)
    try {
      await claimMallCoupon(userId, coupon.id)
      Taro.showToast({ title: '领取成功', icon: 'success' })
      await loadCoupons()
      setActiveTab('claimed')
    } catch (error) {
      Taro.showToast({
        title: error instanceof Error ? error.message : '领取失败',
        icon: 'none',
      })
    } finally {
      setClaimingId('')
    }
  }

  return (
    <MallPage active="mine">
      <Text className="mall-breadcrumb">我的 / 卡包优惠券</Text>
      <Text className="mall-page-title">卡包优惠券</Text>

      <View className="mall-wallet-summary">
        <View>
          <Text className="mall-wallet-summary-label">可用优惠券</Text>
          <Text className="mall-wallet-summary-value">{Number(wallet.summary.availableCount || 0)}</Text>
        </View>
        <View>
          <Text className="mall-wallet-summary-label">即将过期</Text>
          <Text className="mall-wallet-summary-value mall-wallet-summary-warn">{Number(wallet.summary.expiringCount || 0)}</Text>
        </View>
        <View>
          <Text className="mall-wallet-summary-label">已使用</Text>
          <Text className="mall-wallet-summary-value">{Number(wallet.summary.usedCount || 0)}</Text>
        </View>
      </View>

      <View className="mall-wallet-tabs">
        {tabs.map((tab) => (
          <View
            key={tab.key}
            className={activeTab === tab.key ? 'mall-wallet-tab mall-wallet-tab-active' : 'mall-wallet-tab'}
            onClick={() => setActiveTab(tab.key)}
          >
            <Text>{tab.label}</Text>
            <Text>{tabCount(wallet, tab.key)}</Text>
          </View>
        ))}
      </View>

      <View className="mall-wallet-filter-row">
        <Text
          className={!typeFilter ? 'mall-wallet-filter mall-wallet-filter-active' : 'mall-wallet-filter'}
          onClick={() => setTypeFilter('')}
        >
          全部类别
        </Text>
        {couponTypes.map((type) => (
          <Text
            key={type.key}
            className={typeFilter === type.key ? 'mall-wallet-filter mall-wallet-filter-active' : 'mall-wallet-filter'}
            onClick={() => setTypeFilter(type.key)}
          >
            {type.label}
          </Text>
        ))}
      </View>

      {visibleCoupons.length === 0 ? (
        <View className="mall-empty">
          <Text className="mall-empty-title">{loading ? '加载中...' : '暂无优惠券'}</Text>
          <Text className="mall-empty-copy">有新的满减、折扣或运费券时会展示在这里。</Text>
          <View style={{ marginTop: 14 }}>
            <MallPrimaryButton onClick={() => Taro.navigateTo({ url: '/pages/mall/index/index' })}>
              <Text>去首页看看</Text>
            </MallPrimaryButton>
          </View>
        </View>
      ) : null}

      {visibleCoupons.map((coupon) => (
        <CouponCard
          key={`${coupon.id}-${coupon.walletStatus || 'coupon'}`}
          coupon={coupon}
          status={activeTab}
          claiming={claimingId === coupon.id}
          onClaim={() => claimCoupon(coupon)}
        />
      ))}
    </MallPage>
  )
}

function CouponCard({
  coupon,
  status,
  claiming,
  onClaim,
}: {
  coupon: MallCoupon
  status: CouponTab
  claiming: boolean
  onClaim: () => void
}) {
  const walletStatus = coupon.walletStatus || status
  const isClaimable = walletStatus === 'claimable'
  const isUsable = walletStatus === 'claimed'
  return (
    <View className={walletStatus === 'used' || walletStatus === 'expired' ? 'mall-coupon-card mall-coupon-card-muted' : 'mall-coupon-card'}>
      <View className="mall-coupon-left">
        <Ticket size={22} color="#2F7E43" />
        <Text className="mall-coupon-price">{coupon.discountCents ? mallYuan(coupon.discountCents) : couponTypeLabel(coupon.couponType)}</Text>
        <Text className="mall-coupon-threshold">
          {coupon.thresholdCents > 0 ? `满 ${mallYuan(coupon.thresholdCents)} 可用` : '无门槛可用'}
        </Text>
      </View>
      <View className="mall-coupon-main">
        <View className="mall-coupon-title-row">
          <Text className="mall-coupon-title">{coupon.name}</Text>
          <Text className="mall-coupon-type">{couponTypeLabel(coupon.couponType)}</Text>
        </View>
        <Text className="mall-coupon-desc">{coupon.description || '满足条件后结算自动抵扣'}</Text>
        <View className="mall-coupon-meta">
          {coupon.isExpiringSoon ? <Clock3 size={14} color="#FF8A1F" /> : <BadgeCheck size={14} color="#2F7E43" />}
          <Text>{couponDateText(coupon)}</Text>
        </View>
      </View>
      <View
        className={isClaimable || isUsable ? 'mall-coupon-action' : 'mall-coupon-action mall-coupon-action-disabled'}
        onClick={() => {
          if (isClaimable) onClaim()
          if (isUsable) Taro.navigateTo({ url: '/pages/mall/category/index' })
        }}
      >
        <WalletCards size={14} color={isClaimable || isUsable ? '#FFFFFF' : '#8B9487'} />
        <Text>{isClaimable ? (claiming ? '领取中' : '领取') : isUsable ? '去使用' : statusLabel(walletStatus)}</Text>
      </View>
    </View>
  )
}

function tabCount(wallet: MallCouponWallet, tab: CouponTab) {
  return Number((wallet[tab] || []).length)
}

function statusLabel(status?: MallCouponWalletStatus | string) {
  const map: Record<string, string> = {
    claimable: '待领取',
    claimed: '已领取',
    used: '已使用',
    expired: '已过期',
    unavailable: '不可用',
  }
  return map[status || ''] || '不可用'
}

function couponTypeLabel(type?: string) {
  const map: Record<string, string> = {
    full_reduction: '满减券',
    full_discount: '满折券',
    discount: '折扣券',
    free_shipping: '免运费',
    delivery_discount: '运费券',
    coupon: '通用券',
  }
  return map[type || ''] || '优惠券'
}

function couponDateText(coupon: MallCoupon) {
  const expiresAt = coupon.expiresAt || coupon.endsAt
  if (!expiresAt) return '长期有效'
  const dateText = expiresAt.slice(0, 10)
  if (coupon.walletStatus === 'used') return coupon.usedAt ? `使用于 ${coupon.usedAt.slice(0, 10)}` : '已使用'
  if (coupon.walletStatus === 'expired') return `已于 ${dateText} 过期`
  return `${dateText} 前可用`
}
