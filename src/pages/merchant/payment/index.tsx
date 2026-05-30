import { useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Taro from '@tarojs/taro'
import { Wallet } from 'lucide-react-taro'
import { AppPageShell } from '@/components/layout/app-page-shell'
import { BottomNav } from '@/components/layout/bottom-nav'
import { Network } from '@/network'
import { startOrderPayment } from '@/services/payment'

interface PaymentInfo {
  orderId: string
  farePrice: number
  commissionAmount: number
  ownerName: string
  ownerPhone: string
  paymentQr: string
  paymentStatus: string
  status: string
  pickupAddress?: string
  deliveryAddress?: string
  cargoName?: string
}

export default function MerchantPayment() {
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null)
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

    loadPaymentInfo(orderId)
  }, [])

  const loadPaymentInfo = async (orderId: string) => {
    setLoading(true)

    try {
      const res = await Network.request({
        url: `/api/orders/${orderId}/payment-info`,
        method: 'GET'
      })

      console.log('付款接口响应:', res)
      console.log('响应statusCode:', res.statusCode)
      console.log('响应data:', res.data)

      if (res.statusCode === 200 && res.data) {
        // 如果res.data是字符串，需要解析
        let data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data

        console.log('解析后的数据:', data)

        if (data.code === 200) {
          setPaymentInfo(data.data)
          console.log('设置的paymentInfo:', data.data)
        } else {
          Taro.showToast({
            title: data.message || '加载失败',
            icon: 'none'
          })
        }
      } else {
        Taro.showToast({
          title: '请求失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('加载付款信息失败:', error)
      Taro.showToast({
        title: '网络错误，请重试',
        icon: 'none'
      })
    } finally {
      setLoading(false)
    }
  }

  const handlePayOrder = async () => {
    if (!paymentInfo) return

    setMarking(true)

    try {
      const result = await startOrderPayment({
        orderId: paymentInfo.orderId,
        businessType: 'order_fare',
      })
      const isPaid = result.status === 'paid' || result.paymentStatus === 'paid'

      Taro.showToast({
        title: isPaid ? '支付成功' : '支付已发起，稍后同步',
        icon: isPaid ? 'success' : 'none',
      })

      setTimeout(() => {
        Taro.navigateBack()
      }, 1500)
    } catch (error) {
      console.error('微信支付失败:', error)
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
        title="支付结算"
        subtitle="RecoRouter 商户小程序"
        icon={Wallet}
        bottom={<BottomNav type="merchant" active="orders" />}
      >
        <View className="flex items-center justify-center py-12">
          <Text className="text-gray-500">加载中...</Text>
        </View>
      </AppPageShell>
    )
  }

  if (!paymentInfo) {
    return (
      <AppPageShell
        title="支付结算"
        subtitle="RecoRouter 商户小程序"
        icon={Wallet}
        contentClassName="space-y-3"
        bottom={<BottomNav type="merchant" active="orders" />}
      >
        <View className="flex items-center justify-center py-12">
          <Text className="text-gray-500">暂无付款信息</Text>
        </View>
      </AppPageShell>
    )
  }

  const displayPaymentInfo = paymentInfo

  return (
    <AppPageShell
      title="支付结算"
      subtitle="RecoRouter 商户小程序"
      icon={Wallet}
      contentClassName="space-y-3"
      bottom={<BottomNav type="merchant" active="orders" />}
    >
        {/* 订单信息卡片 */}
        <Card className="bg-white rounded-lg shadow-sm mb-4">
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              订单信息
            </CardTitle>
          </CardHeader>
          <CardContent>
            <View className="space-y-3">
              {displayPaymentInfo.cargoName && (
                <View className="flex items-center py-2 border-b border-gray-100">
                  <Text className="text-sm text-gray-600 w-16 flex-shrink-0">货物：</Text>
                  <Text className="text-sm text-gray-800 flex-1">
                    {displayPaymentInfo.cargoName}
                  </Text>
                </View>
              )}
              {displayPaymentInfo.pickupAddress && displayPaymentInfo.deliveryAddress && (
                <View className="flex items-start py-2 border-b border-gray-100">
                  <Text className="text-sm text-gray-600 w-16 flex-shrink-0 pt-1">
                    路线：
                  </Text>
                  <Text className="text-sm text-gray-800 flex-1">
                    {displayPaymentInfo.pickupAddress}
                    {' → '}
                    {displayPaymentInfo.deliveryAddress}
                  </Text>
                </View>
              )}
              <View className="flex justify-between items-center py-2 border-b border-gray-100">
                <Text className="text-sm text-gray-600">订单号</Text>
                <Text className="text-sm text-gray-500">
                  {displayPaymentInfo.orderId}
                </Text>
              </View>
              <View className="flex justify-between items-center py-2">
                <Text className="text-sm text-gray-600">运费金额</Text>
                <Text className="text-lg font-bold text-green-500">
                  ¥{displayPaymentInfo.farePrice || 0}
                </Text>
              </View>
            </View>
          </CardContent>
        </Card>

        {/* 运力方信息卡片 */}
        {displayPaymentInfo.ownerName && (
          <Card className="bg-white rounded-lg shadow-sm mb-4">
            <CardHeader>
              <CardTitle className="text-base font-semibold">
                运力方信息
              </CardTitle>
            </CardHeader>
            <CardContent>
              <View className="space-y-2">
                <View className="flex items-center">
                  <Text className="text-sm text-gray-600 w-16">姓名：</Text>
                  <Text className="text-sm text-gray-800">{displayPaymentInfo.ownerName}</Text>
                </View>
                <View className="flex items-center">
                  <Text className="text-sm text-gray-600 w-16">电话：</Text>
                  <Text className="text-sm text-gray-800">{displayPaymentInfo.ownerPhone}</Text>
                </View>
              </View>
            </CardContent>
          </Card>
        )}

        <Card className="bg-white rounded-lg shadow-sm mb-4">
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              微信支付
            </CardTitle>
          </CardHeader>
          <CardContent>
            <View className="space-y-2">
              <Text className="block text-sm text-gray-700">
                运费将通过微信支付进入平台支付单，支付结果由服务端向微信查单同步。
              </Text>
              <Text className="block text-xs text-gray-500">
                支付金额：¥{displayPaymentInfo.farePrice}
              </Text>
            </View>
          </CardContent>
        </Card>

        {/* 操作按钮 */}
        {displayPaymentInfo.status === 'transport_completed' && displayPaymentInfo.paymentStatus === 'unpaid' && (
          <Card className="bg-white rounded-lg shadow-sm mb-4">
            <CardContent className="p-4">
              <Button
                className="w-full bg-green-500"
                onClick={handlePayOrder}
                disabled={marking}
              >
                <Text className="text-sm">
                  {marking ? '支付中...' : '立即微信支付'}
                </Text>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* 已付款提示 */}
        {displayPaymentInfo.paymentStatus === 'paid' && (
          <Card className="bg-white rounded-lg shadow-sm mb-4">
            <CardContent className="p-4">
              <View className="text-center py-2">
                <View className="flex items-center justify-center mb-2">
                  <Text className="block text-3xl mr-2">✓</Text>
                  <Text className="block text-base font-semibold text-blue-600">
                    运费已支付
                  </Text>
                </View>
                <Text className="block text-sm text-gray-600">
                  等待运力方确认收款
                </Text>
              </View>
            </CardContent>
          </Card>
        )}

        {/* 提示信息 */}
        <View className="bg-blue-50 rounded-lg p-4 mb-4">
          <Text className="block text-xs font-semibold text-blue-800 mb-2">
            支付说明
          </Text>
          <View className="space-y-1">
            <Text className="block text-xs text-blue-700">
              • 请在完成运输后通过微信支付运费
            </Text>
            <Text className="block text-xs text-blue-700">
              • 支付成功后平台会自动同步支付状态
            </Text>
            <Text className="block text-xs text-blue-700">
              • 运力方确认收款后，订单将继续进行
            </Text>
            <Text className="block text-xs text-blue-700">
              • 如有疑问，请及时联系运力方
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
