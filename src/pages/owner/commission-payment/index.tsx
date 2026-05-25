import { useEffect, useState } from 'react'
import { View, Text, Image } from '@tarojs/components'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Taro from '@tarojs/taro'
import { Network } from '@/network'

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

  const handleMarkCommissionPayment = async () => {
    if (!commissionInfo) return

    Taro.showModal({
      title: '确认已支付佣金',
      content: '确认已向平台支付撮合佣金？提交后等待平台审核。',
      success: async (res) => {
        if (res.confirm) {
          setMarking(true)

          try {
            const response = await Network.request({
              url: `/api/orders/${commissionInfo.orderId}/commission-payment-marked`,
              method: 'PUT'
            })

            console.log('标记付佣金响应:', response.data)

            if (response.data.code === 200) {
              Taro.showToast({
                title: '已提交佣金支付，等待平台审核',
                icon: 'success'
              })

              setTimeout(() => {
                Taro.navigateBack()
              }, 1500)
            } else {
              Taro.showToast({
                title: response.data.message || '操作失败',
                icon: 'none'
              })
            }
          } catch (error) {
            console.error('标记付佣金失败:', error)
            Taro.showToast({
              title: '网络错误，请重试',
              icon: 'none'
            })
          } finally {
            setMarking(false)
          }
        }
      }
    })
  }

  if (loading) {
    return (
      <View className="min-h-screen bg-gray-100 flex items-center justify-center">
        <Text className="text-gray-500">加载中...</Text>
      </View>
    )
  }

  return (
    <View className="min-h-screen bg-gray-100">
      {/* 头部 */}
      <View className="bg-blue-500 pt-12 pb-6 px-4">
        <Text className="block text-xl font-bold text-white">
          佣金支付
        </Text>
        <Text className="block text-sm text-blue-100 mt-1">
          向平台支付撮合佣金
        </Text>
      </View>

      {/* 内容区域 */}
      <View className="px-4 -mt-4">
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

        {/* 收款码卡片 */}
        {commissionInfo?.platformPaymentQr && (
          <Card className="bg-white rounded-lg shadow-sm mb-4">
            <CardHeader>
              <CardTitle className="text-base font-semibold">
                平台收款码
              </CardTitle>
            </CardHeader>
            <CardContent>
              <View className="flex flex-col items-center">
                <View className="w-48 h-48 bg-gray-100 rounded-lg overflow-hidden mb-3">
                  <Image
                    src={commissionInfo.platformPaymentQr}
                    className="w-full h-full"
                    mode="aspectFit"
                  />
                </View>
                <View className="bg-blue-50 rounded-lg p-3 w-full mb-3">
                  <Text className="block text-xs text-blue-800 mb-1">
                    转账备注：
                  </Text>
                  <Text className="block text-sm font-mono text-blue-900 break-all">
                    订单号：{commissionInfo.orderId}
                  </Text>
                </View>
                <Text className="block text-xs text-gray-500 text-center">
                  请使用备注信息转账，便于核对
                </Text>
              </View>
            </CardContent>
          </Card>
        )}

        {/* 操作按钮 */}
        {commissionInfo?.status === 'payment_confirmed' && (
          <Card className="bg-white rounded-lg shadow-sm mb-4">
            <CardContent className="p-4">
              <Button
                className="w-full bg-blue-500"
                onClick={handleMarkCommissionPayment}
                disabled={marking}
              >
                <Text className="text-sm">
                  {marking ? '提交中...' : '我已支付佣金'}
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
              • 佣金支付完成后，订单才算真正完成
            </Text>
            <Text className="block text-xs text-yellow-700">
              • 佣金支付完成后，车辆才能继续接单
            </Text>
            <Text className="block text-xs text-yellow-700">
              • 请务必使用订单号作为转账备注
            </Text>
            <Text className="block text-xs text-yellow-700">
              • 平台审核通过后会自动恢复车辆状态
            </Text>
          </View>
        </View>

        {/* 联系客服 */}
        <View className="text-center">
          <Text className="block text-xs text-gray-400">
            如有疑问，请联系客服
          </Text>
        </View>
      </View>
    </View>
  )
}
