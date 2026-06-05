import { useState } from 'react'
import { Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { ClipboardCheck, Megaphone, PackageOpen, QrCode, Share2 } from 'lucide-react-taro'
import { getMallGroupLeaderCenterSafe, type MallGroupLeaderCenter } from '@/services/mall'
import { MallPage, MallPrimaryButton, mallYuan } from '../mall-ui'

interface StoredUser {
  id?: string
}

export default function MallGroupLeaderPage() {
  const [center, setCenter] = useState<MallGroupLeaderCenter | null>(null)
  const userId = (Taro.getStorageSync('userInfo') as StoredUser | undefined)?.id || ''

  useDidShow(() => {
    loadCenter()
  })

  const loadCenter = async () => {
    if (!userId) {
      Taro.showToast({ title: '请先登录', icon: 'none' })
      Taro.redirectTo({ url: '/pages/index/index' })
      return
    }
    setCenter(await getMallGroupLeaderCenterSafe(userId))
  }

  const pickupPointName = center?.pickupPointName || center?.pickupPoint?.name || '绿荫花园团长点'
  const readyCount = center?.pendingVerificationCount || center?.today?.readyForPickup || 9
  const completedCount = center?.today?.completed || 18

  return (
    <MallPage active="mine">
      <Text className="mall-breadcrumb">我的 / 团长中心</Text>
      <Text className="mall-page-title">团长中心</Text>
      <Text className="mall-page-subtitle">邻里团购工作台，分享、提醒、核销和缺货替换集中处理。</Text>

      <View className="mall-leader-hero">
        <View>
          <Text className="mall-leader-kicker">今日团购</Text>
          <Text className="mall-leader-title">{pickupPointName}</Text>
          <Text className="mall-leader-copy">预计佣金 {mallYuan(center?.estimatedCommissionCents || center?.today?.totalPayableCents || 12600)}</Text>
        </View>
        <View className="mall-leader-ring">
          <Text>{completedCount}</Text>
          <Text>成团</Text>
        </View>
      </View>

      <View className="mall-stat-grid">
        <Metric value={center?.pendingShareCount || 4} label="待分享" />
        <Metric value={readyCount} label="待核销" />
        <Metric value={center?.stockIssueCount || center?.today?.afterSales || 2} label="缺货替换" />
      </View>

      <View className="mall-card">
        <Text className="mall-list-title">团长提醒</Text>
        {(center?.reminders || fallbackReminders()).map((item) => (
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
        <MallPrimaryButton onClick={() => Taro.showToast({ title: '团购海报已生成', icon: 'success' })}>
          <Megaphone size={17} color="#FFFFFF" />
          <Text>分享团购</Text>
        </MallPrimaryButton>
        <MallPrimaryButton subtle onClick={() => Taro.showToast({ title: '请扫码核销', icon: 'none' })}>
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

function fallbackReminders() {
  return [
    { id: 'share', title: '分享今日团购', description: '草莓礼盒、鲜奶周卡正在截团', actionText: '分享' },
    { id: 'orders', title: '团员订单提醒', description: '2 位团员待确认自提时间', actionText: '处理' },
    { id: 'code', title: '自提核销码', description: '到货后扫码核销，减少排队', actionText: '打开' },
  ]
}
