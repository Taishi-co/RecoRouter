import { useEffect, useState } from 'react'
import { View, Text, Image } from '@tarojs/components'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Taro from '@tarojs/taro'
import { Network } from '@/network'

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

  const handleMarkPayment = async () => {
    if (!paymentInfo) return

    Taro.showModal({
      title: '确认已付款',
      content: '确认已向运力方支付运费？提交后等待运力方确认。',
      success: async (res) => {
        if (res.confirm) {
          setMarking(true)

          try {
            const response = await Network.request({
              url: `/api/orders/${paymentInfo.orderId}/payment-marked`,
              method: 'PUT'
            })

            console.log('标记付款响应:', response.data)

            if (response.data.code === 200) {
              Taro.showToast({
                title: '已标记为已付款，等待运力方确认',
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
            console.error('标记付款失败:', error)
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
      <View className="min-h-screen bg-background flex items-center justify-center">
        <Text className="text-gray-500">加载中...</Text>
      </View>
    )
  }

  return (
    <View className="min-h-screen bg-background">
      {/* 头部 */}
      <View className="bg-emerald-500 pt-12 pb-6 px-4">
        <Text className="block text-xl font-bold text-white">
          运费支付
        </Text>
        <Text className="block text-sm text-green-100 mt-1">
          向运力方支付运费
        </Text>
      </View>

      {/* 内容区域 */}
      <View className="px-4 -mt-4">
        {/* 订单信息卡片 */}
        <Card className="bg-white rounded-lg shadow-sm mb-4">
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              订单信息
            </CardTitle>
          </CardHeader>
          <CardContent>
            <View className="space-y-3">
              {paymentInfo?.cargoName && (
                <View className="flex items-center py-2 border-b border-border">
                  <Text className="text-sm text-gray-600 w-16 flex-shrink-0">货物：</Text>
                  <Text className="text-sm text-gray-800 flex-1">
                    {paymentInfo.cargoName}
                  </Text>
                </View>
              )}
              {paymentInfo?.pickupAddress && paymentInfo?.deliveryAddress && (
                <View className="flex items-start py-2 border-b border-border">
                  <Text className="text-sm text-gray-600 w-16 flex-shrink-0 pt-1">
                    路线：
                  </Text>
                  <Text className="text-sm text-gray-800 flex-1">
                    {paymentInfo.pickupAddress}
                    {' → '}
                    {paymentInfo.deliveryAddress}
                  </Text>
                </View>
              )}
              <View className="flex justify-between items-center py-2 border-b border-border">
                <Text className="text-sm text-gray-600">订单号</Text>
                <Text className="text-sm text-gray-500">
                  {paymentInfo?.orderId}
                </Text>
              </View>
              <View className="flex justify-between items-center py-2">
                <Text className="text-sm text-gray-600">运费金额</Text>
                <Text className="text-lg font-bold text-emerald-500">
                  ¥{paymentInfo?.farePrice || 0}
                </Text>
              </View>
            </View>
          </CardContent>
        </Card>

        {/* 运力方信息卡片 */}
        {paymentInfo?.ownerName && (
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
                  <Text className="text-sm text-gray-800">{paymentInfo.ownerName}</Text>
                </View>
                <View className="flex items-center">
                  <Text className="text-sm text-gray-600 w-16">电话：</Text>
                  <Text className="text-sm text-gray-800">{paymentInfo.ownerPhone}</Text>
                </View>
              </View>
            </CardContent>
          </Card>
        )}

        {/* 收款码卡片 */}
        {paymentInfo?.paymentQr ? (
          <Card className="bg-white rounded-lg shadow-sm mb-4">
            <CardHeader>
              <CardTitle className="text-base font-semibold">
                收款码
              </CardTitle>
            </CardHeader>
            <CardContent>
              <View className="flex flex-col items-center">
                <View className="w-48 h-48 bg-background rounded-lg overflow-hidden mb-3">
                  <Image
                    src={paymentInfo.paymentQr}
                    className="w-full h-full"
                    mode="aspectFit"
                    lazyLoad
                    onLoad={() => {
                      console.log('收款码加载成功')
                    }}
                    onError={() => {
                      console.error('收款码加载失败')
                      Taro.showToast({
                        title: '收款码加载失败',
                        icon: 'none'
                      })
                    }}
                  />
                </View>
                <Text className="block text-sm text-gray-600 text-center mb-2">
                  请使用微信扫描上方二维码支付
                </Text>
                <Text className="block text-xs text-gray-500 text-center">
                  支付金额：¥{paymentInfo.farePrice}
                </Text>
              </View>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-white rounded-lg shadow-sm mb-4">
            <CardContent className="p-4">
              <View className="text-center py-4">
                <Text className="block text-sm text-amber-600 mb-2">
                  ⚠️ 运力方暂未上传收款码
                </Text>
                <Text className="block text-xs text-gray-500">
                  请联系运力方获取收款方式
                </Text>
              </View>
            </CardContent>
          </Card>
        )}

        {/* 操作按钮 */}
        {paymentInfo?.status === 'transport_completed' && paymentInfo.paymentStatus === 'unpaid' && (
          <Card className="bg-white rounded-lg shadow-sm mb-4">
            <CardContent className="p-4">
              <Button
                className="w-full bg-emerald-500"
                onClick={handleMarkPayment}
                disabled={marking}
              >
                <Text className="text-sm">
                  {marking ? '提交中...' : '我已付款'}
                </Text>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* 已付款提示 */}
        {paymentInfo?.paymentStatus === 'paid' && (
          <Card className="bg-white rounded-lg shadow-sm mb-4">
            <CardContent className="p-4">
              <View className="text-center py-2">
                <View className="flex items-center justify-center mb-2">
                  <Text className="block text-3xl mr-2">✓</Text>
                  <Text className="block text-base font-semibold text-primary">
                    已标记为已付款
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
        <View className="bg-accent rounded-lg p-4 mb-4">
          <Text className="block text-xs font-semibold text-primary mb-2">
            支付说明
          </Text>
          <View className="space-y-1">
            <Text className="block text-xs text-primary">
              • 请在完成运输后向运力方支付运费
            </Text>
            <Text className="block text-xs text-primary">
              • 扫码支付后请点击&quot;我已付款&quot;按钮
            </Text>
            <Text className="block text-xs text-primary">
              • 运力方确认收款后，订单将继续进行
            </Text>
            <Text className="block text-xs text-primary">
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
      </View>
    </View>
  )
}
