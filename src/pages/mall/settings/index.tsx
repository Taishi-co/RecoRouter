import { useState } from 'react'
import { Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { Bell, LockKeyhole, ShieldCheck } from 'lucide-react-taro'
import {
  getMallNotificationPreferences,
  updateMallNotificationPreferences,
  type MallNotificationPreferences,
} from '@/services/mall'
import { MallPage } from '../mall-ui'
import { redirectToMallAuth } from '../auth-route'

interface StoredUser {
  id?: string
}

const defaults: MallNotificationPreferences = {
  userId: '',
  orderUpdates: true,
  promotions: true,
  communityPosts: true,
  serviceMessages: true,
}

export default function MallSettingsPage() {
  const [preferences, setPreferences] = useState<MallNotificationPreferences>(defaults)
  const userId = (Taro.getStorageSync('userInfo') as StoredUser | undefined)?.id || ''

  useDidShow(() => {
    loadPreferences()
  })

  const loadPreferences = async () => {
    if (!userId) {
      Taro.showToast({ title: '请先登录', icon: 'none' })
      redirectToMallAuth('/pages/mall/settings/index')
      return
    }
    try {
      setPreferences(await getMallNotificationPreferences(userId))
    } catch {
      setPreferences({ ...defaults, userId })
    }
  }

  const toggle = async (key: keyof Pick<MallNotificationPreferences, 'orderUpdates' | 'promotions' | 'communityPosts' | 'serviceMessages'>) => {
    const next = { ...preferences, [key]: !preferences[key] }
    setPreferences(next)
    try {
      await updateMallNotificationPreferences(userId, { [key]: next[key] })
    } catch {
      Taro.showToast({ title: '已暂存设置', icon: 'none' })
    }
  }

  return (
    <MallPage active="mine">
      <Text className="mall-breadcrumb">我的 / 消息与设置</Text>
      <Text className="mall-page-title">消息与设置</Text>
      <Text className="mall-page-subtitle">团购提醒、自提通知、售后消息和隐私安全。</Text>

      <View className="mall-card">
        <Text className="mall-list-title">消息通知</Text>
        <SettingRow title="团购提醒" subtitle="截团、成团和补货提醒" enabled={preferences.promotions} onClick={() => toggle('promotions')} />
        <SettingRow title="自提通知" subtitle="到站、自提码和超时提醒" enabled={preferences.orderUpdates} onClick={() => toggle('orderUpdates')} />
        <SettingRow title="售后消息" subtitle="客服回复、退款进度和处理结论" enabled={preferences.serviceMessages} onClick={() => toggle('serviceMessages')} />
        <SettingRow title="邻里圈动态" subtitle="自提点公告、晒单和拼团邀请" enabled={preferences.communityPosts} onClick={() => toggle('communityPosts')} />
      </View>

      <View className="mall-link-card">
        <View className="mall-link-icon">
          <ShieldCheck size={20} color="#63BF54" />
        </View>
        <View className="mall-link-copy">
          <Text className="mall-link-title">隐私与账号安全</Text>
          <Text className="mall-link-subtitle">手机号、地址、自提点信息仅用于商城履约。</Text>
        </View>
        <Text className="mall-summary-value">›</Text>
      </View>

      <View className="mall-security-card">
        <Bell size={20} color="#63BF54" />
        <Text className="mall-link-title">叁友甄选承诺</Text>
        <Text className="mall-link-subtitle">坏果包赔、缺货先联系、冷链到站后再通知自提。</Text>
      </View>
    </MallPage>
  )
}

function SettingRow({
  title,
  subtitle,
  enabled,
  onClick,
}: {
  title: string
  subtitle: string
  enabled: boolean
  onClick: () => void
}) {
  return (
    <View className="mall-setting-row" onClick={onClick}>
      <View className="mall-link-icon">
        <LockKeyhole size={18} color="#63BF54" />
      </View>
      <View className="mall-link-copy">
        <Text className="mall-link-title">{title}</Text>
        <Text className="mall-link-subtitle">{subtitle}</Text>
      </View>
      <View className={enabled ? 'mall-toggle mall-toggle-on' : 'mall-toggle'}>
        <View className="mall-toggle-dot" />
      </View>
    </View>
  )
}
