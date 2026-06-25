import { useMemo, useState } from 'react'
import { Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { ChevronLeft, Clock3, PackageCheck } from 'lucide-react-taro'
import {
  listMyMallGroupBuySubscriptions,
  type MallGroupBuySubscription,
} from '@/services/mall'
import { startOrderPayment } from '@/services/payment'
import { MallPage, MallPrimaryButton, mallYuan } from '../mall-ui'
import { redirectToMallAuth } from '../auth-route'

interface StoredUser {
  id?: string
}

export default function MyMallGroupBuyPage() {
  const [subscriptions, setSubscriptions] = useState<MallGroupBuySubscription[]>([])
  const [loading, setLoading] = useState(false)
  const [payingId, setPayingId] = useState('')
  const [userId, setUserId] = useState('')
  const pendingBalanceCount = useMemo(
    () => subscriptions.filter((item) => item.status === 'pending_balance').length,
    [subscriptions],
  )

  useDidShow(() => {
    loadSubscriptions()
  })

  const loadSubscriptions = async () => {
    const user = Taro.getStorageSync('userInfo') as StoredUser | undefined
    setUserId(user?.id || '')
    if (!user?.id) {
      setSubscriptions([])
      return
    }
    setLoading(true)
    try {
      setSubscriptions(await listMyMallGroupBuySubscriptions(user.id))
    } catch (error) {
      setSubscriptions([])
      Taro.showToast({
        title: error instanceof Error ? error.message : '集采加载失败',
        icon: 'none',
      })
    } finally {
      setLoading(false)
    }
  }

  const payBalance = async (subscription: MallGroupBuySubscription) => {
    if (!userId || payingId) return
    setPayingId(subscription.id)
    try {
      const paymentResult = await startOrderPayment({
        orderId: subscription.id,
        businessType: 'mall_group_buy_balance',
        payerId: userId,
      })
      if (!isPaymentPaid(paymentResult)) {
        Taro.showToast({ title: '支付结果待确认，请稍后刷新', icon: 'none' })
        return
      }
      Taro.showToast({ title: '尾款已支付', icon: 'success' })
      await loadSubscriptions()
    } catch (error) {
      Taro.showToast({
        title: error instanceof Error ? error.message : '支付未完成',
        icon: 'none',
      })
    } finally {
      setPayingId('')
    }
  }

  if (!userId) {
    return (
      <MallPage active="mine">
        <View className="mall-group-buy-topbar">
          <ChevronLeft size={24} color="#1F2D1F" onClick={() => Taro.navigateBack()} />
          <View>
            <Text className="mall-page-title">我的集采</Text>
            <Text className="mall-page-subtitle">登录后查看定金、尾款和到货进度</Text>
          </View>
        </View>
        <View className="mall-empty">
          <Text className="mall-empty-title">请先登录</Text>
          <Text className="mall-empty-copy">登录后查看我的集采记录。</Text>
          <View style={{ marginTop: 14 }}>
            <MallPrimaryButton onClick={() => redirectToMallAuth('/pages/mall/group-buy/my')}>
              <Text>去登录</Text>
            </MallPrimaryButton>
          </View>
        </View>
      </MallPage>
    )
  }

  return (
    <MallPage active="mine">
      <View className="mall-group-buy-topbar">
        <ChevronLeft size={24} color="#1F2D1F" onClick={() => Taro.navigateBack()} />
        <View>
          <Text className="mall-page-title">我的集采</Text>
          <Text className="mall-page-subtitle">{pendingBalanceCount ? `${pendingBalanceCount} 单待付尾款` : '定金、尾款和到货进度'}</Text>
        </View>
      </View>

      {subscriptions.length ? (
        <View className="mall-group-buy-list">
          {subscriptions.map((subscription) => (
            <SubscriptionCard
              key={subscription.id}
              subscription={subscription}
              paying={payingId === subscription.id}
              onPayBalance={() => payBalance(subscription)}
            />
          ))}
        </View>
      ) : (
        <View className="mall-empty">
          <Text className="mall-empty-title">{loading ? '加载中...' : '暂无集采记录'}</Text>
          <Text className="mall-empty-copy">参与集采后可在这里查看进度。</Text>
          <View style={{ marginTop: 14 }}>
            <MallPrimaryButton onClick={loadSubscriptions}>
              <Text>{loading ? '加载中' : '刷新'}</Text>
            </MallPrimaryButton>
          </View>
        </View>
      )}
    </MallPage>
  )
}

function SubscriptionCard({
  subscription,
  paying,
  onPayBalance,
}: {
  subscription: MallGroupBuySubscription
  paying: boolean
  onPayBalance: () => void
}) {
  const title = subscription.activity?.name || subscription.product?.name || '集采订单'
  const unitPrice = subscription.finalUnitPriceCents || subscription.estimatedUnitPriceCents || 0
  const total = subscription.finalUnitPriceCents
    ? subscription.finalUnitPriceCents * subscription.quantity
    : subscription.estimatedTotalCents || unitPrice * subscription.quantity

  return (
    <View className="mall-group-buy-card">
      <View className="mall-group-buy-card-head">
        <View>
          <Text className="mall-group-buy-title">{title}</Text>
          <Text className="mall-group-buy-subtitle">{subscription.quantity}{subscription.unitName} · {mallYuan(unitPrice)} / {subscription.unitName}</Text>
        </View>
        <Text className={`mall-group-buy-status mall-group-buy-status-${subscription.status}`}>{statusText(subscription.status)}</Text>
      </View>
      <View className="mall-group-buy-subscription-money">
        <View>
          <Text>定金</Text>
          <Text>{mallYuan(subscription.depositCents)}</Text>
        </View>
        <View>
          <Text>尾款</Text>
          <Text>{mallYuan(subscription.balanceCents)}</Text>
        </View>
        <View>
          <Text>{subscription.finalUnitPriceCents ? '最终价' : '预估合计'}</Text>
          <Text>{mallYuan(total)}</Text>
        </View>
      </View>
      <View className="mall-group-buy-card-foot">
        <View>
          <Clock3 size={15} color="#657160" />
          <Text>{formatTime(subscription.activity?.balanceDueAt || subscription.activity?.endsAt)}</Text>
        </View>
        {subscription.status === 'pending_balance' ? (
          <View className="mall-small-button" onClick={onPayBalance}>
            <Text>{paying ? '支付中' : '付尾款'}</Text>
          </View>
        ) : null}
        {subscription.status === 'order_created' && subscription.mallOrderId ? (
          <View
            className="mall-small-button mall-small-button-subtle"
            onClick={() => Taro.navigateTo({ url: `/pages/mall/order-detail/index?id=${subscription.mallOrderId}` })}
          >
            <PackageCheck size={14} color="#2F7E43" />
            <Text>看订单</Text>
          </View>
        ) : null}
      </View>
    </View>
  )
}

function statusText(status: string) {
  const statusMap: Record<string, string> = {
    draft: '待开始',
    scheduled: '待开始',
    published: '可报名',
    enrolling: '报名中',
    active: '进行中',
    forming: '进行中',
    pending_deposit: '待付定金',
    deposit_paid: '已付定金',
    formed: '已成团',
    ops_review: '运营审核',
    procuring: '采购中',
    procurement_confirmed: '备货中',
    completed: '已完成',
    failed_refunding: '未成团退款中',
    failed_refunded: '未成团已退款',
    cancelled_refunding: '取消退款中',
    activity_cancel_refunding: '取消退款中',
    pending_balance: '待付尾款',
    balance_paid: '尾款已付',
    order_created: '已转订单',
    deposit_refunded: '已退定金',
    balance_overdue_cancelled: '尾款超时取消',
    refunded: '已退款',
    cancelled: '已取消',
    offline: '已下线',
    expired: '已失效',
  }
  return statusMap[status] || '状态待确认'
}

function isPaymentPaid(result: { status?: string | null; paymentStatus?: string | null }) {
  return result.status === 'paid' || result.paymentStatus === 'paid'
}

function formatTime(value?: string | null) {
  if (!value) return '时间待定'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}
