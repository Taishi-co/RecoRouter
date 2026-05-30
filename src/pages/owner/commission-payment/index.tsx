import { useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AppPageShell } from '@/components/layout/app-page-shell'
import { BottomNav } from '@/components/layout/bottom-nav'
import Taro from '@tarojs/taro'
import { Network } from '@/network'
import { startOrderPayment } from '@/services/payment'

interface CommissionInfo {
  orderId: string
  farePrice: number
  commissionAmount: number
  platformPaymentQr: string
  commissionPaymentStatus: string
  status: string
}

export default function CommissionPayment() {
  const [commissionInfo, setCommissionInfo] = useState<CommissionInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [marking, setMarking] = useState(false)

  useEffect(() => {
    const instance = Taro.getCurrentInstance()
    const orderId = instance.router?.params?.orderId

    if (!orderId) {
      Taro.showToast({
        title: '参数错误',
        icon: 'none'
      })
      setTimeout(() => {
        Taro.navigateBack()
      }, 1500)
      return
    }

    loadCommissionInfo(orderId)
  }, [])

  const loadCommissionInfo = async (orderId: string) => {
    setLoading(true)

    try {
      const res = await Network.request({
        url: `/api/orders/${orderId}/commission-info`,
        method: 'GET'
      })

      console.log('佣金信息响应:', res.data)

      if (res.data.code === 200) {
        setCommissionInfo(res.data.data)
      } else {
        Taro.showToast({
          title: res.data.message || '加载失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('加载佣金信息失败:', error)
      Taro.showToast({
        title: '网络错误，请重试',
        icon: 'none'
      })
    } finally {
      setLoading(false)
    }
  }

  const handlePayCommission = async () => {
    if (!commissionInfo) return

    setMarking(true)

    try {
      const result = await startOrderPayment({
        orderId: commissionInfo.orderId,
        businessType: 'order_commission',
      })
      const isPaid = result.status === 'paid' || result.commissionPaymentStatus === 'paid'

      Taro.showToast({
        title: isPaid ? '佣金支付已提交' : '支付已发起，稍后同步',
        icon: isPaid ? 'success' : 'none'
      })

      setTimeout(() => {
        Taro.navigateBack()
      }, 1500)
    } catch (error) {
      console.error('佣金支付失败:', error)
      Taro.showToast({
        title: error instanceof Error ? error.message : '支付失败，请重试',
        icon: 'none'
      })
    } finally {
      setMarking(false)
    }
  }

  if (loading) {
    return (
      <AppPageShell
        title="佣金账单"
        subtitle="RecoRouter 运力端"
        bottom={<BottomNav type="owner" active="revenue" />}
      >
        <Text className="text-gray-500">加载中...</Text>
      </AppPageShell>
    )
  }

  return (
    <AppPageShell
      title="佣金账单"
      subtitle="RecoRouter 运力端"
      contentClassName="space-y-4"
      bottom={<BottomNav type="owner" active="revenue" />}
    >
        {/* 金额信息卡片 */}
        <Card className="bg-white rounded-lg shadow-sm mb-4">
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              订单信息
            </CardTitle>
          </CardHeader>
          <CardContent>
            <View className="space-y-3">
              <View className="flex justify-between items-center py-2 border-b border-gray-100">
                <Text className="text-sm text-gray-600">运费金额</Text>
                <Text className="text-sm font-semibold">¥{commissionInfo?.farePrice || 0}</Text>
              </View>
              <View className="flex justify-between items-center py-2">
                <Text className="text-sm text-gray-600">佣金金额</Text>
                <Text className="text-lg font-bold text-red-500">
                  ¥{commissionInfo?.commissionAmount || 0}
                </Text>
              </View>
            </View>
          </CardContent>
        </Card>

        <Card className="bg-white rounded-lg shadow-sm mb-4">
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              平台微信支付
            </CardTitle>
          </CardHeader>
          <CardContent>
            <View className="space-y-2">
              <Text className="block text-sm text-gray-700">
                佣金支付将通过平台统一支付单完成，支付结果由服务端向支付渠道同步。
              </Text>
              <Text className="block text-xs text-gray-500">
                支付金额：¥{commissionInfo?.commissionAmount || 0}
              </Text>
            </View>
          </CardContent>
        </Card>

        {/* 操作按钮 */}
        {commissionInfo?.status === 'payment_confirmed' && (
          <Card className="bg-white rounded-lg shadow-sm mb-4">
            <CardContent className="p-4">
              <Button
                className="w-full bg-blue-500"
                onClick={handlePayCommission}
                disabled={marking}
              >
                <Text className="text-sm">
                  {marking ? '支付中...' : '立即微信支付'}
                </Text>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* 已标记提示 */}
        {commissionInfo?.status === 'commission_pending' && (
          <Card className="bg-white rounded-lg shadow-sm mb-4">
            <CardContent className="p-4">
              <View className="text-center py-2">
                <Text className="block text-sm text-gray-600">
                  已提交佣金支付，等待平台审核
                </Text>
              </View>
            </CardContent>
          </Card>
        )}

        {/* 提示信息 */}
        <View className="bg-yellow-50 rounded-lg p-4 mb-4">
          <Text className="block text-xs font-semibold text-yellow-800 mb-2">
            重要提示
          </Text>
          <View className="space-y-1">
            <Text className="block text-xs text-yellow-700">
              • 佣金为 0 时无需支付，系统会自动跳过
            </Text>
            <Text className="block text-xs text-yellow-700">
              • 佣金支付完成后，订单才会进入平台审核
            </Text>
            <Text className="block text-xs text-yellow-700">
              • 平台审核通过后会自动恢复车辆状态
            </Text>
            <Text className="block text-xs text-yellow-700">
              • 如有疑问，请联系客服
            </Text>
          </View>
        </View>

        {/* 联系客服 */}
        <View className="text-center">
          <Text className="block text-xs text-gray-400">
            如有疑问，请联系客服
          </Text>
        </View>
    </AppPageShell>
  )
}
