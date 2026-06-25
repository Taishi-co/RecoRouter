import { useState } from 'react'
import { Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { ChevronLeft, Clock3, Users } from 'lucide-react-taro'
import {
  listMallGroupBuys,
  type MallGroupBuyActivity,
} from '@/services/mall'
import {
  MallPage,
  MallPrimaryButton,
  MallSectionTitle,
  mallYuan,
} from '../mall-ui'

export default function MallGroupBuyIndexPage() {
  const [activities, setActivities] = useState<MallGroupBuyActivity[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')

  useDidShow(() => {
    loadActivities()
  })

  const loadActivities = async () => {
    setLoading(true)
    setLoadError('')
    try {
      setActivities(await listMallGroupBuys())
    } catch (error) {
      setActivities([])
      const message = error instanceof Error ? error.message : '集采加载失败'
      setLoadError(message)
      Taro.showToast({ title: message, icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <MallPage active="home">
      <View className="mall-group-buy-topbar">
        <ChevronLeft size={24} color="#1F2D1F" onClick={() => Taro.navigateBack()} />
        <View>
          <Text className="mall-page-title">集采预售</Text>
          <Text className="mall-page-subtitle">社区拼量价，到点结算</Text>
        </View>
      </View>

      <MallSectionTitle title="本期集采" action="我的集采" onAction={() => Taro.navigateTo({ url: '/pages/mall/group-buy/my' })} />

      {activities.length ? (
        <View className="mall-group-buy-list">
          {activities.map((activity) => (
            <GroupBuyCard key={activity.id} activity={activity} />
          ))}
        </View>
      ) : null}

      {!activities.length ? (
        <View className="mall-empty">
          <Text className="mall-empty-title">{loading ? '加载中...' : loadError ? '集采加载失败' : '暂无集采'}</Text>
          <Text className="mall-empty-copy">{loadError || '新一期集采上架后会展示在这里。'}</Text>
          <View style={{ marginTop: 14 }}>
            <MallPrimaryButton onClick={loadActivities}>
              <Text>{loading ? '加载中' : '重新加载'}</Text>
            </MallPrimaryButton>
          </View>
        </View>
      ) : null}
    </MallPage>
  )
}

function GroupBuyCard({ activity }: { activity: MallGroupBuyActivity }) {
  const lowestTier = lowestPriceTier(activity)
  const progress = groupBuyProgress(activity)

  return (
    <View
      className="mall-group-buy-card"
      onClick={() => Taro.navigateTo({ url: `/pages/mall/group-buy/detail?id=${encodeURIComponent(activity.id)}` })}
    >
      <View className="mall-group-buy-card-head">
        <View>
          <Text className="mall-group-buy-title">{activity.name}</Text>
          <Text className="mall-group-buy-subtitle">{activity.product?.subtitle || activity.product?.name || activity.unitName}</Text>
        </View>
        <Text className={`mall-group-buy-status mall-group-buy-status-${activity.status}`}>{statusText(activity.status)}</Text>
      </View>
      <View className="mall-group-buy-progress-row">
        <View className="mall-group-buy-progress">
          <View className="mall-group-buy-progress-fill" style={{ width: `${progress}%` }} />
        </View>
        <Text>{activity.currentQuantity || 0}/{activity.minGroupQuantity}</Text>
      </View>
      <View className="mall-group-buy-meta-grid">
        <View>
          <Users size={15} color="#2F7E43" />
          <Text>成团 {activity.minGroupQuantity}{activity.unitName}</Text>
        </View>
        <View>
          <Text className="mall-group-buy-price">{lowestTier ? `${mallYuan(lowestTier.priceCents)} 起` : '待定价'}</Text>
        </View>
        <View>
          <Clock3 size={15} color="#FF8A1F" />
          <Text>{formatTime(activity.endsAt)}</Text>
        </View>
      </View>
    </View>
  )
}

function lowestPriceTier(activity: MallGroupBuyActivity) {
  return [...(activity.tiers || [])].sort((a, b) => a.priceCents - b.priceCents)[0]
}

function groupBuyProgress(activity: MallGroupBuyActivity) {
  const minQuantity = Math.max(Number(activity.minGroupQuantity || 0), 1)
  return Math.min(Math.round((Number(activity.currentQuantity || 0) / minQuantity) * 100), 100)
}

function statusText(status: string) {
  const statusMap: Record<string, string> = {
    draft: '待开始',
    scheduled: '待开始',
    published: '可报名',
    enrolling: '报名中',
    active: '进行中',
    forming: '进行中',
    formed: '已成团',
    ops_review: '运营审核',
    procuring: '采购中',
    procurement_confirmed: '备货中',
    completed: '已完成',
    failed_refunding: '未成团退款中',
    failed_refunded: '未成团已退款',
    cancelled_refunding: '取消退款中',
    closed: '已结束',
    cancelled: '已取消',
    offline: '已下线',
    pending_deposit: '待付定金',
    deposit_paid: '已付定金',
    pending_balance: '待付尾款',
    balance_paid: '尾款已付',
    order_created: '已转订单',
    balance_overdue_cancelled: '尾款超时取消',
    refunded: '已退款',
    expired: '已失效',
  }
  return statusMap[status] || '状态待确认'
}

function formatTime(value?: string | null) {
  if (!value) return '待定'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}
