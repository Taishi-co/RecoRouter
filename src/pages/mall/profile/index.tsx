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
  const memberLevel = member?.level?.name || '普通会员'
  const points = Number(member?.points || 0)
  const totalSpendCents = Number(member?.totalSpendCents || 0)
  const pickupPointName = profile?.defaultPickupPoint?.name
    || profile?.defaultAddress?.addressLabel
    || profile?.defaultAddress?.address_name
    || '未设置自提点'
  const pickupPointDetail = profile?.defaultPickupPoint?.addressText
    || profile?.defaultAddress?.addressText
    || profile?.defaultAddress?.address
    || '选择常用自提点后展示到站信息'
  const orderCounts = orderCountView(profile, orders)
  const support = profile?.support
  const supportSubtitle = `客服会话 ${Number(support?.openSessions || 0)} 个 · 售后 ${Number(support?.afterSales || 0)} 单`

  return (
    <MallPage active="mine">
      <View className="mall-title-row">
        <View>
          <Text className="mall-breadcrumb">叁友甄选</Text>
          <Text className="mall-page-title">我的</Text>
        </View>
        <View className="mall-pill" onClick={() => Taro.navigateTo({ url: '/pages/mall/settings/index' })}>
          <Text>{memberLevel}</Text>
        </View>
      </View>

      <View className="mall-profile-hero">
        <View className="mall-profile-avatar">
          <Text>{displayName.slice(0, 1)}</Text>
        </View>
        <View className="mall-profile-copy">
          <Text className="mall-profile-name">{displayName}</Text>
          <Text className="mall-profile-meta">
            {pickupPointName} · 积分 {points}
          </Text>
          <View className="mall-profile-tags">
            <Text>累计消费 {mallYuan(totalSpendCents)}</Text>
            <Text>{member?.status === 'disabled' ? '账号已停用' : '账号正常'}</Text>
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
          <Text className="mall-section-action" onClick={() => Taro.navigateTo({ url: '/pages/mall/orders/index' })}>全部订单</Text>
        </View>
        <View className="mall-stat-grid">
          <StatTile value={loading ? 0 : orderCounts.pendingPayment} label="待付款" />
          <StatTile value={loading ? 0 : orderCounts.pendingPickup} label="待自提" />
          <StatTile value={loading ? 0 : orderCounts.afterSales} label="售后" />
        </View>
      </View>

      <ProfileLink
        icon={<UsersRound size={20} color="#63BF54" />}
        title="我的团购"
        subtitle={`已参与 ${orderCounts.activeGroups} 单 · 共 ${orderCounts.total} 个商城订单`}
        action="查看"
        onClick={() => Taro.navigateTo({ url: '/pages/mall/orders/index' })}
      />
      <ProfileLink
        icon={<MapPin size={20} color="#63BF54" />}
        title="常用自提点"
        subtitle={`${pickupPointName} · ${pickupPointDetail}`}
        action="管理"
        onClick={() => Taro.navigateTo({ url: '/pages/mall/address/index' })}
      />
      <ProfileLink
        icon={<Headphones size={20} color="#63BF54" />}
        title="商城客服"
        subtitle={supportSubtitle}
        action="联系"
        onClick={() => Taro.navigateTo({ url: '/pages/mall/support/index' })}
      />
      <ProfileLink
        icon={<PackageCheck size={20} color="#63BF54" />}
        title="团长中心"
        subtitle={profile?.groupLeader ? '已绑定团长身份，可处理自提核销' : '未绑定团长身份，进入后可查看权限状态'}
        action="进入"
        onClick={() => Taro.navigateTo({ url: '/pages/mall/group-leader/index' })}
      />
      <ProfileLink
        icon={<Settings size={20} color="#63BF54" />}
        title="消息与设置"
        subtitle="团购提醒、自提通知、售后客服消息"
        action="设置"
        onClick={() => Taro.navigateTo({ url: '/pages/mall/settings/index' })}
      />
      <ProfileLink
        icon={<LogOut size={20} color="#FF9238" />}
        title="退出登录"
        subtitle={maskPhone(member?.phone || user.phone) || '退出当前商城账号'}
        action="退出"
        onClick={logout}
      />
    </MallPage>
  )
}

function MallProfileLoginState() {
  return (
    <MallPage active="mine">
      <Text className="mall-breadcrumb">叁友甄选</Text>
      <Text className="mall-page-title">我的</Text>
      <Text className="mall-page-subtitle">登录后查看订单、自提码、售后和邻里团购消息。</Text>
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
    </MallPage>
  )
}

function StatTile({ value, label }: { value: number; label: string }) {
  return (
    <View className="mall-stat-tile">
      <Text className="mall-stat-value">{value}</Text>
      <Text className="mall-stat-label">{label}</Text>
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
  const pendingPickup = Number(backendCounts?.pendingPickup ?? orders.filter((order) => order.status.includes('pickup') || order.status.includes('paid')).length)
  const afterSales = Number(backendCounts?.afterSales ?? orders.filter((order) => order.afterSaleStatus || order.refundStatus).length)
  const total = Number(backendCounts?.total ?? orders.length)
  const activeGroups = orders.filter((order) => !['cancelled', 'completed'].includes(order.status)).length

  return {
    pendingPayment,
    pendingPickup,
    afterSales,
    total,
    activeGroups,
  }
}

function maskPhone(phone?: string) {
  if (!phone) return ''
  return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
}
