import { useState } from 'react'
import { Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { Headphones, MapPin, PackageCheck, Settings, UsersRound } from 'lucide-react-taro'
import { getMallProfileSafe, type MallProfile } from '@/services/mall'
import { MallPage, mallYuan } from '../mall-ui'

interface StoredUser {
  id?: string
  name?: string
  nickname?: string
}

export default function MallProfilePage() {
  const [profile, setProfile] = useState<MallProfile | null>(null)
  const user = (Taro.getStorageSync('userInfo') as StoredUser | undefined) || {}
  const userId = user.id || ''

  useDidShow(() => {
    loadProfile()
  })

  const loadProfile = async () => {
    if (!userId) {
      Taro.showToast({ title: '请先登录', icon: 'none' })
      Taro.redirectTo({ url: '/pages/index/index' })
      return
    }
    setProfile(await getMallProfileSafe(userId))
  }

  const displayName = profile?.displayName || user.name || user.nickname || '张女士'

  return (
    <MallPage active="mine">
      <View className="mall-title-row">
        <View>
          <Text className="mall-breadcrumb">叁友甄选</Text>
          <Text className="mall-page-title">我的</Text>
        </View>
        <View className="mall-pill" onClick={() => Taro.navigateTo({ url: '/pages/mall/settings/index' })}>
          <Text>{profile?.memberLevel || '银卡会员'}</Text>
        </View>
      </View>

      <View className="mall-profile-hero">
        <View className="mall-profile-avatar">
          <Text>{displayName.slice(0, 1)}</Text>
        </View>
        <View className="mall-profile-copy">
          <Text className="mall-profile-name">{displayName}</Text>
          <Text className="mall-profile-meta">
            {profile?.pickupPointName || '路北区邻里驿站'} · 本月已省 {mallYuan(profile?.monthlySavingsCents || 4200)}
          </Text>
          <View className="mall-profile-tags">
            <Text>3张券</Text>
            <Text>常用自提点</Text>
          </View>
        </View>
      </View>

      <View className="mall-card">
        <View className="mall-list-row" style={{ marginTop: 0 }}>
          <Text className="mall-list-title">我的订单</Text>
          <Text className="mall-section-action" onClick={() => Taro.navigateTo({ url: '/pages/mall/orders/index' })}>全部订单</Text>
        </View>
        <View className="mall-stat-grid">
          <StatTile value={profile?.pendingPaymentCount || 1} label="待付款" />
          <StatTile value={profile?.pendingPickupCount || 2} label="待自提" />
          <StatTile value={profile?.afterSaleCount || 1} label="售后" />
        </View>
      </View>

      <ProfileLink
        icon={<UsersRound size={20} color="#63BF54" />}
        title="我的团购"
        subtitle={`查看参与中的邻里拼团与成团进度 · ${profile?.groupJoinedCount || 3} 单`}
        action="查看"
        onClick={() => Taro.navigateTo({ url: '/pages/mall/orders/index' })}
      />
      <ProfileLink
        icon={<MapPin size={20} color="#63BF54" />}
        title="常用自提点"
        subtitle={profile?.commonPickupPoint || '路北区邻里驿站，今天 17:00 后可取'}
        action="管理"
        onClick={() => Taro.navigateTo({ url: '/pages/mall/address/index' })}
      />
      <ProfileLink
        icon={<Headphones size={20} color="#63BF54" />}
        title="商城客服"
        subtitle={profile?.supportStatus || '订单售后、坏果包赔与冷链咨询'}
        action="联系"
        onClick={() => Taro.navigateTo({ url: '/pages/mall/support/index' })}
      />
      <ProfileLink
        icon={<PackageCheck size={20} color="#63BF54" />}
        title="团长中心"
        subtitle="分享团购、订单提醒、自提核销"
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
