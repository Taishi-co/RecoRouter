import { useState } from 'react'
import { Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { ClipboardCheck, PackageOpen, QrCode, WalletCards } from 'lucide-react-taro'
import {
  getMallGroupLeaderCenter,
  verifyMallGroupLeaderFulfillment,
  type MallGroupLeaderCenter,
  type MallOrder,
} from '@/services/mall'
import { MallPage, MallPrimaryButton, mallYuan } from '../mall-ui'
import { redirectToMallAuth } from '../auth-route'

interface StoredUser {
  id?: string
}

export default function MallGroupLeaderPage() {
  const [center, setCenter] = useState<MallGroupLeaderCenter | null>(null)
  const [error, setError] = useState('')
  const [verifying, setVerifying] = useState('')
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

  const verify = async (order: MallOrder) => {
    const code = order.fulfillmentCode?.code || ''
    if (!code) {
      Taro.showToast({ title: '取货码尚未生成', icon: 'none' })
      return
    }
    setVerifying(order.id)
    try {
      await verifyMallGroupLeaderFulfillment({ userId, orderId: order.id, code })
      Taro.showToast({ title: '核销成功', icon: 'success' })
      loadCenter()
    } catch (verifyError) {
      Taro.showToast({
        title: verifyError instanceof Error ? verifyError.message : '核销失败',
        icon: 'none',
      })
    } finally {
      setVerifying('')
    }
  }

  const pickupPointName = center?.pickupPointName || center?.pickupPoint?.name || '未绑定自提点'
  const pendingOrders = center?.pendingOrders || []
  const commissionRateBps = center?.commissionRateBps || 1000
  const commissionRateText = center?.commissionRateRange || '8%-12%'
  const todayPayableCents = center?.today?.totalPayableCents || 0
  const estimatedCommissionCents = center?.estimatedCommissionCents || 0
  const withdrawableCents = center?.withdrawableCents || 0

  return (
    <MallPage active="mine">
      <Text className="mall-breadcrumb">我的 / 团长后台</Text>
      <Text className="mall-page-title">团长后台</Text>

      {error ? (
        <View className="mall-empty">
          <Text className="mall-empty-title">{error}</Text>
          <Text className="mall-empty-copy">请确认注册身份为团长，并已绑定自提点。</Text>
        </View>
      ) : null}

      <View className="mall-leader-hero mall-v7-leader-dashboard">
        <View>
          <Text className="mall-leader-kicker">自提点</Text>
          <Text className="mall-leader-title">{pickupPointName}</Text>
          <Text className="mall-leader-copy">佣金比例 {commissionRateText} · 当前 {commissionRateBps / 100}%</Text>
        </View>
        <View className="mall-leader-ring">
          <Text>{center?.today?.completed || 0}</Text>
          <Text>已核销</Text>
        </View>
      </View>

      <View className="mall-stat-grid">
        <Metric value={center?.today?.orderCount || 0} label="今日订单" />
        <Metric value={pendingOrders.length} label="待核销" />
        <Metric value={center?.today?.afterSales || 0} label="售后" />
      </View>

      <View className="mall-card">
        <View className="mall-list-row" style={{ marginTop: 0 }}>
          <Text className="mall-list-title">佣金明细</Text>
          <Text className="mall-section-action">8%-12%</Text>
        </View>
        <Summary label="今日自提点销售额" value={mallYuan(todayPayableCents)} />
        <Summary label="预计佣金" value={mallYuan(estimatedCommissionCents)} warm />
        <Summary label="可提现金额" value={mallYuan(withdrawableCents)} />
        <View className="mall-v7-withdraw" onClick={() => Taro.showToast({ title: '提现申请已提交', icon: 'success' })}>
          <WalletCards size={18} color="#FFFFFF" />
          <Text>提现</Text>
        </View>
      </View>

      <View className="mall-card">
        <View className="mall-list-row" style={{ marginTop: 0 }}>
          <Text className="mall-list-title">自提点订单</Text>
          <Text className="mall-section-action">核销取货</Text>
        </View>
        {pendingOrders.length === 0 ? (
          <View className="mall-empty mall-empty-compact">
            <Text className="mall-empty-title">暂无待核销订单</Text>
            <Text className="mall-empty-copy">用户支付后会在这里生成取货码。</Text>
          </View>
        ) : null}
        {pendingOrders.map((order) => (
          <View key={order.id} className="mall-v7-leader-order">
            <View>
              <Text className="mall-v7-product-name">{order.items[0]?.productName || order.orderNo}</Text>
              <Text className="mall-v7-product-subtitle">
                {order.orderNo} · {order.fulfillmentCode?.code || '待生成取货码'}
              </Text>
            </View>
            <View className="mall-v7-verify-button" onClick={() => verify(order)}>
              <QrCode size={16} color="#FFFFFF" />
              <Text>{verifying === order.id ? '核销中' : '核销'}</Text>
            </View>
          </View>
        ))}
      </View>

      <View className="mall-action-row">
        <MallPrimaryButton onClick={() => Taro.navigateTo({ url: '/pages/mall/orders/index' })}>
          <ClipboardCheck size={17} color="#FFFFFF" />
          <Text>查看订单</Text>
        </MallPrimaryButton>
        <MallPrimaryButton subtle onClick={() => Taro.navigateTo({ url: '/pages/mall/pickup/index' })}>
          <PackageOpen size={17} color="#FF9238" />
          <Text>扫码核销</Text>
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

function Summary({ label, value, warm }: { label: string; value: string; warm?: boolean }) {
  return (
    <View className="mall-summary-row">
      <Text className="mall-summary-label">{label}</Text>
      <Text className={warm ? 'mall-summary-value mall-summary-value-warm' : 'mall-summary-value'}>{value}</Text>
    </View>
  )
}
