import { useState } from 'react'
import { Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { ClipboardCheck, Megaphone, PackageOpen, QrCode, Share2 } from 'lucide-react-taro'
import { getMallGroupLeaderCenter, type MallGroupLeaderCenter } from '@/services/mall'
import { MallPage, MallPrimaryButton, mallYuan } from '../mall-ui'
import { redirectToMallAuth } from '../auth-route'

interface StoredUser {
  id?: string
}

export default function MallGroupLeaderPage() {
  const [center, setCenter] = useState<MallGroupLeaderCenter | null>(null)
  const [error, setError] = useState('')
  const userId = (Taro.getStorageSync('userInfo') as StoredUser | undefined)?.id || ''

  useDidShow(() => {
    loadCenter()
  })

  const loadCenter = async () => {
    if (!userId) {
      Taro.showToast({ title: '请先登录', icon: 'none' })
      redirectToMallAuth('/pages/mall/group-leader/index')
      return
    }
    try {
      setCenter(await getMallGroupLeaderCenter(userId))
      setError('')
    } catch (loadError) {
      setCenter(null)
      setError(loadError instanceof Error ? loadError.message : '团长中心加载失败')
    }
  }

  const pickupPointName = center?.pickupPointName || center?.pickupPoint?.name || '未绑定自提点'
  const readyCount = center?.pendingVerificationCount || center?.today?.readyForPickup || 0
  const completedCount = center?.today?.completed || 0

  return (
    <MallPage active="mine">
      <Text className="mall-breadcrumb">我的 / 团长中心</Text>
      <Text className="mall-page-title">团长中心</Text>
      <Text className="mall-page-subtitle">邻里团购工作台，分享、提醒、核销和缺货替换集中处理。</Text>

      {error ? (
        <View className="mall-empty">
          <Text className="mall-empty-title">{error}</Text>
          <Text className="mall-empty-copy">请确认注册身份为团长，并已绑定自提点。</Text>
        </View>
      ) : null}

      <View className="mall-leader-hero">
        <View>
          <Text className="mall-leader-kicker">今日团购</Text>
          <Text className="mall-leader-title">{pickupPointName}</Text>
          <Text className="mall-leader-copy">预计佣金 {mallYuan(center?.estimatedCommissionCents || center?.today?.totalPayableCents || 0)}</Text>
        </View>
        <View className="mall-leader-ring">
          <Text>{completedCount}</Text>
          <Text>成团</Text>
        </View>
      </View>

      <View className="mall-stat-grid">
        <Metric value={center?.pendingShareCount || 0} label="待分享" />
        <Metric value={readyCount} label="待核销" />
        <Metric value={center?.stockIssueCount || center?.today?.afterSales || 0} label="缺货替换" />
      </View>

      <View className="mall-card">
        <Text className="mall-list-title">团长提醒</Text>
        {(center?.reminders || []).map((item) => (
          <View key={item.id} className="mall-leader-task">
            <View className="mall-link-icon">
              {item.id === 'share' ? <Share2 size={20} color="#63BF54" /> : item.id === 'code' ? <QrCode size={20} color="#63BF54" /> : <ClipboardCheck size={20} color="#63BF54" />}
            </View>
            <View className="mall-link-copy">
              <Text className="mall-link-title">{item.title}</Text>
              <Text className="mall-link-subtitle">{item.description}</Text>
            </View>
            <Text className="mall-section-action">{item.actionText}</Text>
          </View>
        ))}
      </View>

      <View className="mall-action-row">
        <MallPrimaryButton onClick={() => Taro.navigateTo({ url: '/pages/mall/community/index' })}>
          <Megaphone size={17} color="#FFFFFF" />
          <Text>分享团购</Text>
        </MallPrimaryButton>
        <MallPrimaryButton subtle onClick={() => Taro.navigateTo({ url: '/pages/mall/pickup/index' })}>
          <PackageOpen size={17} color="#FF9238" />
          <Text>自提核销</Text>
        </MallPrimaryButton>
      </View>
    </MallPage>
  )
}

function Metric({ value, label }: { value: number; label: string }) {
  return (
    <View className="mall-stat-box">
      <Text className="mall-stat-box-value">{value}</Text>
      <Text className="mall-stat-label">{label}</Text>
    </View>
  )
}
