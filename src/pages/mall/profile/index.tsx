import { useState } from 'react'
import { Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { Headphones, LogOut, MapPin, PackageCheck, Settings, UsersRound } from 'lucide-react-taro'
import {
  getMallProfile,
  listMallOrders,
  type MallOrder,
  type MallProfile,
} from '@/services/mall'
import { MallPage, MallPrimaryButton, mallYuan } from '../mall-ui'
import { navigateToMallAuth } from '../auth-route'

interface StoredUser {
  id?: string
  name?: string
  nickname?: string
  phone?: string
}

export default function MallProfilePage() {
  const [profile, setProfile] = useState<MallProfile | null>(null)
  const [orders, setOrders] = useState<MallOrder[]>([])
  const [user, setUser] = useState<StoredUser>({})
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')

  useDidShow(() => {
    loadProfile()
  })

  const loadProfile = async () => {
    const storedUser = (Taro.getStorageSync('userInfo') as StoredUser | undefined) || {}
    setUser(storedUser)
    setLoadError('')

    if (!storedUser.id) {
      setProfile(null)
      setOrders([])
      return
    }

    setLoading(true)
    try {
      const [nextProfile, nextOrders] = await Promise.all([
        getMallProfile(storedUser.id),
        listMallOrders(storedUser.id),
      ])
      setProfile(nextProfile)
      setOrders(nextOrders)
    } catch (error) {
      setProfile(null)
      setOrders([])
      const message = error instanceof Error ? error.message : '会员信息加载失败'
      setLoadError(message)
      Taro.showToast({ title: message, icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    Taro.removeStorageSync('userInfo')
    Taro.removeStorageSync('token')
    setUser({})
    setProfile(null)
    setOrders([])
    Taro.showToast({ title: '已退出登录', icon: 'success' })
  }

  if (!user.id) {
    return <MallProfileLoginState />
  }

  const member = profile?.member
  const displayName = member?.name || member?.username || user.name || user.nickname || maskPhone(member?.phone || user.phone) || '商城用户'
  const memberLevel = member?.level?.name || profile?.memberLevel || '普通会员'
  const points = Number(member?.points || 0)
  const totalSpendCents = Number(member?.totalSpendCents || 0)
  const orderCounts = orderCountView(profile, orders)
  const couponWallet = profile?.couponWallet || {}
  const availableCouponCount = Number(couponWallet.availableCount || 0)
  const expiringCouponCount = Number(couponWallet.expiringCount || 0)
  const pickupPointName = profile?.defaultPickupPoint?.name
    || profile?.defaultAddress?.addressLabel
    || profile?.defaultAddress?.address_name
    || '未设置自提点'
  const pickupPointDetail = profile?.defaultPickupPoint?.addressText
    || profile?.defaultAddress?.addressText
    || profile?.defaultAddress?.address
    || '选择常用自提点后展示到站信息'
  const isGroupLeader = Boolean(profile?.groupLeader)

  return (
    <MallPage active="mine">
      <View className="mall-v7-profile-hero">
        <View className="mall-profile-avatar">
          <Text>{displayName.slice(0, 1)}</Text>
        </View>
        <View className="mall-v7-profile-main">
          <Text className="mall-profile-name">{displayName}</Text>
          <Text className="mall-v7-profile-meta">{memberLevel} · 当前积分 {points}</Text>
          <View className="mall-v7-profile-stats">
            <Text>累计消费 {mallYuan(totalSpendCents)}</Text>
            <Text>100 积分抵 1 元</Text>
          </View>
        </View>
      </View>

      {loadError ? (
        <View className="mall-empty">
          <Text className="mall-empty-title">会员信息加载失败</Text>
          <Text className="mall-empty-copy">{loadError}</Text>
          <View style={{ marginTop: 14 }}>
            <MallPrimaryButton onClick={loadProfile}>
              <Text>重新加载</Text>
            </MallPrimaryButton>
          </View>
        </View>
      ) : null}

      <View className="mall-card">
        <View className="mall-list-row" style={{ marginTop: 0 }}>
          <Text className="mall-list-title">我的订单</Text>
          <Text className="mall-section-action" onClick={() => Taro.navigateTo({ url: '/pages/mall/orders/index' })}>全部</Text>
        </View>
        <View className="mall-v7-order-entry-grid">
          <ProfileEntry label="全部" value={loading ? 0 : orderCounts.total} onClick={() => Taro.navigateTo({ url: '/pages/mall/orders/index' })} />
          <ProfileEntry label="待支付" value={loading ? 0 : orderCounts.pendingPayment} onClick={() => Taro.navigateTo({ url: '/pages/mall/orders/index' })} />
          <ProfileEntry label="待收货" value={loading ? 0 : orderCounts.pendingReceipt} onClick={() => Taro.navigateTo({ url: '/pages/mall/orders/index' })} />
          <ProfileEntry label="售后" value={loading ? 0 : orderCounts.afterSales} onClick={() => Taro.navigateTo({ url: '/pages/mall/orders/index' })} />
        </View>
      </View>

      <ProfileLink
        icon={<PackageCheck size={20} color="#2F7E43" />}
        title="卡包优惠券"
        subtitle={`可用 ${availableCouponCount} 张${expiringCouponCount > 0 ? ` · ${expiringCouponCount} 张即将过期` : ''}`}
        action="查看"
        onClick={() => Taro.navigateTo({ url: '/pages/mall/category/index?keyword=优惠券' })}
      />
      <ProfileLink
        icon={<MapPin size={20} color="#2F7E43" />}
        title="收货地址"
        subtitle={`${pickupPointName} · ${pickupPointDetail}`}
        action="管理"
        onClick={() => Taro.navigateTo({ url: '/pages/mall/address/index' })}
      />
      <ProfileLink
        icon={<Settings size={20} color="#2F7E43" />}
        title="发票申请"
        subtitle="按商城订单申请电子发票，状态同步到客服售后"
        action="申请"
        onClick={() => Taro.navigateTo({ url: '/pages/mall/support/index?topic=invoice' })}
      />
      <ProfileLink
        icon={<UsersRound size={20} color="#2F7E43" />}
        title="积分商城"
        subtitle={`当前 ${points} 积分，可兑换商品 / 优惠券`}
        action="兑换"
        onClick={() => Taro.navigateTo({ url: '/pages/mall/category/index?keyword=积分兑换' })}
      />
      <ProfileLink
        icon={<Headphones size={20} color="#2F7E43" />}
        title="客服售后"
        subtitle={`售后 ${Number(profile?.support?.afterSales || 0)} 单 · 会话 ${Number(profile?.support?.openSessions || 0)} 个`}
        action="联系"
        onClick={() => Taro.navigateTo({ url: '/pages/mall/support/index' })}
      />
      <ProfileLink
        icon={<LogOut size={20} color="#B45309" />}
        title="退出登录"
        subtitle={maskPhone(member?.phone || user.phone) || '退出当前商城账号'}
        action="退出"
        onClick={logout}
      />

      <View
        className="mall-v7-leader-cta"
        onClick={() => {
          if (isGroupLeader) {
            Taro.navigateTo({ url: '/pages/mall/group-leader/index' })
            return
          }
          navigateToMallAuth('/pages/mall/group-leader/index', 'register')
        }}
      >
        <View>
          <Text>{isGroupLeader ? '进入团长后台' : '申请成为团长'}</Text>
          <Text>自提点订单佣金 8%-12%，可查看订单、核销取货和提现</Text>
        </View>
        <Text>{isGroupLeader ? '进入' : '申请'}</Text>
      </View>
    </MallPage>
  )
}

function MallProfileLoginState() {
  return (
    <MallPage active="mine">
      <Text className="mall-breadcrumb">叁友甄选</Text>
      <Text className="mall-page-title">我的</Text>
      <Text className="mall-page-subtitle">登录后查看订单、自提码、售后、积分和团长权益。</Text>
      <View className="mall-auth-empty">
        <View className="mall-profile-avatar mall-profile-avatar-large">
          <Text>叁</Text>
        </View>
        <Text className="mall-empty-title">登录商城账号</Text>
        <Text className="mall-empty-copy">登录或注册后，“我的”会从后端同步会员、订单、自提点和客服状态。</Text>
        <View className="mall-auth-actions">
          <MallPrimaryButton onClick={() => navigateToMallAuth('/pages/mall/profile/index', 'login')}>
            <Text>登录</Text>
          </MallPrimaryButton>
          <MallPrimaryButton subtle onClick={() => navigateToMallAuth('/pages/mall/profile/index', 'register')}>
            <Text>注册</Text>
          </MallPrimaryButton>
        </View>
      </View>
      <View className="mall-v7-leader-cta" onClick={() => navigateToMallAuth('/pages/mall/group-leader/index', 'register')}>
        <View>
          <Text>团长申请入口</Text>
          <Text>注册时选择“我是团长”即可提交身份</Text>
        </View>
        <Text>注册</Text>
      </View>
    </MallPage>
  )
}

function ProfileEntry({ label, value, onClick }: { label: string; value: number; onClick: () => void }) {
  return (
    <View className="mall-v7-profile-entry" onClick={onClick}>
      <Text>{value}</Text>
      <Text>{label}</Text>
    </View>
  )
}

function ProfileLink({
  icon,
  title,
  subtitle,
  action,
  onClick,
}: {
  icon: JSX.Element
  title: string
  subtitle: string
  action: string
  onClick: () => void
}) {
  return (
    <View className="mall-link-card" onClick={onClick}>
      <View className="mall-link-icon">{icon}</View>
      <View className="mall-link-copy">
        <Text className="mall-link-title">{title}</Text>
        <Text className="mall-link-subtitle">{subtitle}</Text>
      </View>
      <Text className="mall-section-action">{action}</Text>
    </View>
  )
}

function orderCountView(profile: MallProfile | null, orders: MallOrder[]) {
  const backendCounts = profile?.orderCounts
  const pendingPayment = Number(backendCounts?.pendingPayment ?? orders.filter((order) => order.paymentStatus !== 'paid').length)
  const pendingReceipt = orders.filter((order) => order.paymentStatus === 'paid' && ['ready_for_pickup', 'pending_pickup', 'delivering'].some((status) => order.status.includes(status))).length
  const afterSales = Number(backendCounts?.afterSales ?? orders.filter((order) => order.afterSaleStatus || order.refundStatus).length)
  const total = Number(backendCounts?.total ?? orders.length)

  return {
    pendingPayment,
    pendingReceipt,
    afterSales,
    total,
  }
}

function maskPhone(phone?: string) {
  if (!phone) return ''
  return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
}
