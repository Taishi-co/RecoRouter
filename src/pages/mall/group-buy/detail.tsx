import { useEffect, useMemo, useState } from 'react'
import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { ChevronLeft, Minus, Plus, ShieldCheck } from 'lucide-react-taro'
import {
  getMallGroupBuy,
  subscribeMallGroupBuy,
  type MallGroupBuyActivity,
} from '@/services/mall'
import { startOrderPayment } from '@/services/payment'
import {
  MallPage,
  MallPrimaryButton,
  MallProductThumb,
  mallYuan,
} from '../mall-ui'
import { redirectToMallAuth } from '../auth-route'

interface StoredUser {
  id?: string
}

export default function MallGroupBuyDetailPage() {
  const [activity, setActivity] = useState<MallGroupBuyActivity | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const id = Taro.getCurrentInstance().router?.params?.id || ''
  const progress = useMemo(() => activity ? groupBuyProgress(activity) : 0, [activity])
  const estimatedUnitPrice = activity ? estimateUnitPrice(activity, quantity) : 0
  const subscriptionGate = activity ? getSubscriptionGate(activity) : null

  useEffect(() => {
    if (!id) {
      Taro.showToast({ title: '集采参数缺失', icon: 'none' })
      Taro.navigateBack()
      return
    }
    loadActivity(id)
  }, [id])

  useEffect(() => {
    if (!activity) return
    setQuantity((current) => normalizeQuantity(activity, current))
  }, [activity?.id, activity?.maxQuantityPerUser])

  const loadActivity = async (activityId: string) => {
    setLoading(true)
    try {
      setActivity(await getMallGroupBuy(activityId))
    } catch (error) {
      Taro.showToast({
        title: error instanceof Error ? error.message : '加载失败',
        icon: 'none',
      })
    } finally {
      setLoading(false)
    }
  }

  const changeQuantity = (delta: number) => {
    if (!activity) return
    setQuantity((current) => normalizeQuantity(activity, current + delta))
  }

  const payDeposit = async () => {
    if (!activity || submitting) return
    const gate = getSubscriptionGate(activity)
    if (!gate.enabled) {
      Taro.showToast({ title: gate.toastText, icon: 'none' })
      return
    }
    const user = Taro.getStorageSync('userInfo') as StoredUser | undefined
    if (!user?.id) {
      Taro.showToast({ title: '请先登录', icon: 'none' })
      redirectToMallAuth(`/pages/mall/group-buy/detail?id=${encodeURIComponent(activity.id)}`)
      return
    }
    setSubmitting(true)
    try {
      const subscription = await subscribeMallGroupBuy(activity.id, { userId: user.id, quantity })
      const paymentResult = await startOrderPayment({
        orderId: subscription.id,
        businessType: 'mall_group_buy_deposit',
        payerId: user.id,
      })
      if (!isPaymentPaid(paymentResult)) {
        Taro.showToast({ title: '支付结果待确认，请稍后刷新', icon: 'none' })
        return
      }
      Taro.showToast({ title: '定金已支付', icon: 'success' })
      Taro.navigateTo({ url: '/pages/mall/group-buy/my' })
    } catch (error) {
      Taro.showToast({
        title: error instanceof Error ? error.message : '支付未完成',
        icon: 'none',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <MallPage active="home">
      <View className="mall-group-buy-topbar">
        <ChevronLeft size={24} color="#1F2D1F" onClick={() => Taro.navigateBack()} />
        <View>
          <Text className="mall-page-title">集采详情</Text>
          <Text className="mall-page-subtitle">定金锁单，到期按成团价结算</Text>
        </View>
      </View>

      {loading || !activity ? (
        <View className="mall-empty">
          <Text className="mall-empty-title">加载中...</Text>
        </View>
      ) : (
        <>
          <View className="mall-group-buy-detail-card">
            <View className="mall-group-buy-detail-product">
              <View className="mall-group-buy-detail-thumb">
                <MallProductThumb product={activity.product} />
              </View>
              <View className="mall-group-buy-detail-main">
                <View className="mall-group-buy-title-row">
                  <Text className="mall-group-buy-title">{activity.name}</Text>
                  <Text className={`mall-group-buy-status mall-group-buy-status-${activity.status}`}>{statusText(activity.status)}</Text>
                </View>
                <Text className="mall-group-buy-subtitle">{activity.product?.subtitle || activity.product?.name || activity.unitName}</Text>
                <Text className="mall-group-buy-price">{mallYuan(estimatedUnitPrice)} / {activity.unitName}</Text>
              </View>
            </View>

            <View className="mall-group-buy-progress-row mall-group-buy-progress-row-detail">
              <View className="mall-group-buy-progress">
                <View className="mall-group-buy-progress-fill" style={{ width: `${progress}%` }} />
              </View>
              <Text>{activity.currentQuantity || 0}/{activity.minGroupQuantity}{activity.unitName}</Text>
            </View>
          </View>

          <View className="mall-group-buy-panel">
            <Text className="mall-group-buy-panel-title">阶梯价</Text>
            <View className="mall-group-buy-tier-list">
              {(activity.tiers || []).map((tier) => (
                <View key={`${tier.quantity}-${tier.priceCents}`} className="mall-group-buy-tier">
                  <Text>满 {tier.quantity}{activity.unitName}</Text>
                  <Text>{mallYuan(tier.priceCents)}</Text>
                </View>
              ))}
            </View>
          </View>

          <View className="mall-group-buy-panel">
            <Text className="mall-group-buy-panel-title">预售信息</Text>
            <InfoRow label="定金" value={depositText(activity)} />
            <InfoRow label="信用门槛" value={activity.minCreditScore ? `${activity.minCreditScore} 分` : '无'} />
            <InfoRow label="逾期扣分" value={activity.overdueCreditPenalty ? `${activity.overdueCreditPenalty} 分` : '无'} />
            <InfoRow label="每人限购" value={activity.maxQuantityPerUser ? `${activity.maxQuantityPerUser}${activity.unitName}` : '不限'} />
            <InfoRow label="结束时间" value={formatTime(activity.endsAt)} />
            <InfoRow label="尾款时间" value={formatTime(activity.balanceDueAt)} />
          </View>

          <View className="mall-group-buy-panel">
            <View className="mall-group-buy-quantity-head">
              <View>
                <Text className="mall-group-buy-panel-title">购买数量</Text>
                <Text className="mall-page-subtitle">预计合计 {mallYuan(estimatedUnitPrice * quantity)}</Text>
              </View>
              <View className="mall-group-buy-stepper">
                <View className="mall-group-buy-stepper-button" onClick={() => changeQuantity(-1)}>
                  <Minus size={15} color="#2F7E43" />
                </View>
                <Text>{quantity}</Text>
                <View className="mall-group-buy-stepper-button" onClick={() => changeQuantity(1)}>
                  <Plus size={15} color="#2F7E43" />
                </View>
              </View>
            </View>
          </View>

          <View className="mall-group-buy-credit">
            <ShieldCheck size={16} color="#2F7E43" />
            <Text>信用分达标后可参与集采</Text>
          </View>

          <View className="mall-group-buy-action-spacer" />
          <View className="mall-group-buy-bottom-action">
            {subscriptionGate?.enabled ? (
              <MallPrimaryButton onClick={payDeposit}>
                <Text>{submitting ? '支付中' : '支付定金'}</Text>
              </MallPrimaryButton>
            ) : (
              <View className="mall-button mall-button-disabled" onClick={payDeposit}>
                <Text>{subscriptionGate?.actionText || '暂不可报名'}</Text>
              </View>
            )}
          </View>
        </>
      )}
    </MallPage>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="mall-group-buy-info-row">
      <Text>{label}</Text>
      <Text>{value}</Text>
    </View>
  )
}

function normalizeQuantity(activity: MallGroupBuyActivity, value: number) {
  const max = Number(activity.maxQuantityPerUser || 0)
  const parsed = Math.max(Math.floor(Number(value || 1)), 1)
  return max > 0 ? Math.min(parsed, max) : parsed
}

function estimateUnitPrice(activity: MallGroupBuyActivity, quantity: number) {
  if (activity.finalUnitPriceCents) return activity.finalUnitPriceCents
  const total = Number(activity.currentQuantity || 0) + quantity
  const tiers = [...(activity.tiers || [])]
  const matchedTier = tiers
    .filter((tier) => Number(tier.quantity || 0) <= total)
    .sort((a, b) => b.quantity - a.quantity)[0]
  return matchedTier?.priceCents || tiers.sort((a, b) => a.quantity - b.quantity)[0]?.priceCents || 0
}

function depositText(activity: MallGroupBuyActivity) {
  if (activity.depositType === 'percent') return `${activity.depositValue}%`
  if (activity.depositType === 'unit_fixed') return `${mallYuan(activity.depositValue)} / ${activity.unitName}`
  if (activity.depositType === 'order_fixed') return `${mallYuan(activity.depositValue)} / 单`
  if (activity.depositType === 'fixed') return mallYuan(activity.depositValue)
  return activity.depositValue ? String(activity.depositValue) : '待定'
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

function getSubscriptionGate(activity: MallGroupBuyActivity) {
  const status = activity.status
  const now = Date.now()
  const startsAt = parseTime(activity.startsAt)
  const endsAt = parseTime(activity.endsAt)

  if (startsAt && now < startsAt) {
    return { enabled: false, actionText: '待开始', toastText: '集采尚未开始' }
  }
  if (endsAt && now > endsAt) {
    return { enabled: false, actionText: '已结束', toastText: '集采已结束' }
  }
  if (status === 'formed') {
    return { enabled: false, actionText: '已成团', toastText: '集采已成团' }
  }
  if (status !== 'published' && status !== 'enrolling') {
    return { enabled: false, actionText: statusActionText(status), toastText: '当前状态暂不可报名' }
  }

  return { enabled: true, actionText: '支付定金', toastText: '' }
}

function statusActionText(status: string) {
  const actionMap: Record<string, string> = {
    draft: '待开始',
    scheduled: '待开始',
    completed: '已结束',
    closed: '已结束',
    cancelled: '已取消',
    offline: '已下线',
    procuring: '采购中',
    ops_review: '审核中',
    failed_refunding: '退款中',
    failed_refunded: '已退款',
    cancelled_refunding: '退款中',
    refunded: '已退款',
  }
  return actionMap[status] || '暂不可报名'
}

function isPaymentPaid(result: { status?: string | null; paymentStatus?: string | null }) {
  return result.status === 'paid' || result.paymentStatus === 'paid'
}

function parseTime(value?: string | null) {
  if (!value) return 0
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? 0 : time
}

function formatTime(value?: string | null) {
  if (!value) return '待定'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}
