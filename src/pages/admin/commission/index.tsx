import { useEffect, useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Taro from '@tarojs/taro'
import { Network } from '@/network'
import { DollarSign, CircleCheckBig, Clock, CircleAlert } from 'lucide-react-taro'

interface CommissionSummary {
  totalCommission: number
  confirmedCommission: number
  pendingCommission: number
  totalOrders: number
}

interface CommissionOrder {
  id: string
  cargoName: string
  farePrice: number | null
  commissionAmount: number | null
  commissionStatus: string
  fareStatus: string
  completedTime: string | null
  paymentTime: string | null
  ownerName: string
  status: string
}

interface CommissionData {
  summary: CommissionSummary
  commissionOrders: CommissionOrder[]
}

export default function AdminCommission() {
  const [pendingOrders, setPendingOrders] = useState<CommissionOrder[]>([])
  const [summaryData, setSummaryData] = useState<CommissionData | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const userInfo = Taro.getStorageSync('userInfo')
    if (!userInfo || userInfo.role !== 'admin') {
      Taro.showToast({
        title: '无权限访问',
        icon: 'none'
      })
      setTimeout(() => {
        Taro.redirectTo({ url: '/pages/index/index' })
      }, 1500)
      return
    }
    loadPendingCommissionOrders()
    loadCommissionSummary()
  }, [])

  const loadPendingCommissionOrders = async () => {
    setLoading(true)

    try {
      const res = await Network.request({
        url: '/api/orders/commission-pending',
        method: 'GET'
      })

      console.log('待审核佣金订单响应:', res.data)

      if (res.data.code === 200) {
        setPendingOrders(res.data.data || [])
      }
    } catch (error) {
      console.error('加载待审核佣金订单失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadCommissionSummary = async () => {
    try {
      const res = await Network.request({
        url: '/api/orders/commission-summary',
        method: 'GET'
      })

      console.log('佣金汇总统计响应:', res.data)

      if (res.data.code === 200) {
        setSummaryData(res.data.data)
      }
    } catch (error) {
      console.error('加载佣金汇总统计失败:', error)
    }
  }

  const handleConfirmCommission = async (orderId: string) => {
    Taro.showModal({
      title: '确认收到佣金',
      content: '确认已收到该订单的佣金支付？确认后将自动恢复车辆状态，车辆可以继续接单。',
      success: async (res) => {
        if (res.confirm) {
          try {
            const response = await Network.request({
              url: `/api/orders/${orderId}/commission-confirm`,
              method: 'PUT'
            })

            console.log('确认佣金响应:', response.data)

            if (response.data.code === 200) {
              Taro.showToast({
                title: '佣金已确认，订单完成',
                icon: 'success'
              })

              loadPendingCommissionOrders()
              loadCommissionSummary()
            } else {
              Taro.showToast({
                title: response.data.message || '操作失败',
                icon: 'none'
              })
            }
          } catch (error) {
            console.error('确认佣金失败:', error)
            Taro.showToast({
              title: '网络错误，请重试',
              icon: 'none'
            })
          }
        }
      }
    })
  }

  const getCommissionStatusText = (status: string) => {
    switch (status) {
      case 'paid':
        return '已确认'
      case 'unpaid':
        return '待审核'
      default:
        return '未知'
    }
  }

  return (
    <View className="min-h-screen bg-background">
      {/* 导航菜单 */}
      <View className="bg-white shadow-sm">
        <View className="px-4 py-3">
          <View className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => Taro.navigateTo({ url: '/pages/admin/users/index' })}
            >
              <Text className="text-xs">用户管理</Text>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => Taro.navigateTo({ url: '/pages/admin/vehicles/index' })}
            >
              <Text className="text-xs">车辆审核</Text>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => Taro.navigateTo({ url: '/pages/admin/orders/index' })}
            >
              <Text className="text-xs">订单管理</Text>
            </Button>
            <Button size="sm" className="bg-primary">
              <Text className="text-xs">佣金审核</Text>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => Taro.navigateTo({ url: '/pages/admin/stats/index' })}
            >
              <Text className="text-xs">数据统计</Text>
            </Button>
          </View>
        </View>
      </View>

      <ScrollView scrollY className="pb-4">
        <View className="px-4 py-4">
          {/* 收益汇总 */}
          {summaryData && (
            <Card className="bg-white rounded-lg shadow-sm mb-4">
              <CardHeader>
                <CardTitle className="text-lg font-semibold">平台收益汇总</CardTitle>
              </CardHeader>
              <CardContent>
                <View className="space-y-3">
                  <Card className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg border-purple-200">
                    <CardContent className="p-4">
                      <Text className="block text-sm font-semibold text-gray-700 mb-3">佣金统计</Text>
                      <View className="grid grid-cols-3 gap-4">
                        <View className="text-center">
                          <View className="flex items-center justify-center mb-1">
                            <DollarSign size={16} color="#8b5cf6" />
                          </View>
                          <Text className="block text-lg font-bold text-indigo-600">
                            ¥{summaryData.summary.totalCommission.toFixed(2)}
                          </Text>
                          <Text className="block text-xs text-gray-600">总佣金</Text>
                        </View>
                        <View className="text-center">
                          <View className="flex items-center justify-center mb-1">
                            <CircleCheckBig size={16} color="#10b981" />
                          </View>
                          <Text className="block text-lg font-bold text-emerald-600">
                            ¥{summaryData.summary.confirmedCommission.toFixed(2)}
                          </Text>
                          <Text className="block text-xs text-gray-600">已确认</Text>
                        </View>
                        <View className="text-center">
                          <View className="flex items-center justify-center mb-1">
                            <Clock size={16} color="#f59e0b" />
                          </View>
                          <Text className="block text-lg font-bold text-amber-600">
                            ¥{summaryData.summary.pendingCommission.toFixed(2)}
                          </Text>
                          <Text className="block text-xs text-gray-600">待审核</Text>
                        </View>
                      </View>
                    </CardContent>
                  </Card>

                  <View className="flex items-center justify-between py-2 px-3 bg-muted rounded-lg">
                    <Text className="text-sm text-gray-600">已完成订单数</Text>
                    <Text className="text-base font-bold text-gray-800">
                      {summaryData.summary.totalOrders} 单
                    </Text>
                  </View>

                  {summaryData.summary.pendingCommission > 0 && (
                    <Card className="bg-amber-50 rounded-lg border-yellow-200">
                      <CardContent className="p-3">
                        <View className="flex items-center">
                          <CircleAlert size={14} color="#ca8a04" />
                          <Text className="text-xs text-yellow-700 ml-2">
                            有 ¥{summaryData.summary.pendingCommission.toFixed(2)} 佣金待审核，请及时处理
                          </Text>
                        </View>
                      </CardContent>
                    </Card>
                  )}
                </View>
              </CardContent>
            </Card>
          )}

          {/* 待审核佣金 */}
          <Card className="bg-white rounded-lg shadow-sm mb-4">
            <CardHeader>
              <View className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold">待审核佣金</CardTitle>
                <Badge className="bg-amber-500">
                  <Text className="text-white text-xs">{pendingOrders.length} 条待审核</Text>
                </Badge>
              </View>
            </CardHeader>
            <CardContent>
              {loading ? (
                <View className="text-center py-8">
                  <Text className="text-gray-500">加载中...</Text>
                </View>
              ) : pendingOrders.length === 0 ? (
                <View className="text-center py-8">
                  <Text className="text-gray-500">暂无待审核佣金</Text>
                </View>
              ) : (
                <View className="space-y-3">
                  {pendingOrders.map((order) => (
                    <Card key={order.id} className="bg-muted rounded-lg border border-border">
                      <CardContent className="p-3">
                        <View className="flex justify-between items-start mb-2">
                          <View className="flex-1">
                            <Text className="block text-sm font-medium text-gray-800 mb-1">
                              {order.cargoName || '未知货物'}
                            </Text>
                            <Text className="block text-xs text-gray-500">
                              运费: ¥{(order.farePrice || 0).toFixed(2)} | 佣金: ¥{(order.commissionAmount || 0).toFixed(2)}
                            </Text>
                          </View>
                          <View className="text-right">
                            <Text className="block text-lg font-bold text-indigo-600">
                              ¥{(order.commissionAmount || 0).toFixed(2)}
                            </Text>
                            <Text className="text-xs text-gray-500">
                              {order.ownerName}
                            </Text>
                          </View>
                        </View>
                        {order.paymentTime && (
                          <Text className="block text-xs text-gray-400 mt-2 mb-3">
                            支付时间: {new Date(order.paymentTime).toLocaleString('zh-CN')}
                          </Text>
                        )}
                        <Button
                          size="sm"
                          className="w-full bg-emerald-500"
                          onClick={() => handleConfirmCommission(order.id)}
                        >
                          <Text className="text-xs">确认收到佣金</Text>
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </View>
              )}
            </CardContent>
          </Card>

          {/* 佣金订单列表 */}
          {summaryData && summaryData.commissionOrders.length > 0 && (
            <Card className="bg-white rounded-lg shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold">佣金订单明细</CardTitle>
              </CardHeader>
              <CardContent>
                <View className="space-y-3">
                  {summaryData.commissionOrders.map((order) => (
                    <Card
                      key={order.id}
                      className="bg-muted rounded-lg border border-border"
                    >
                      <CardContent className="p-3">
                        <View className="flex justify-between items-start mb-2">
                          <View className="flex-1">
                            <Text className="block text-sm font-medium text-gray-800 mb-1">
                              {order.cargoName || '未知货物'}
                            </Text>
                            <Text className="block text-xs text-gray-500">
                              运费: ¥{(order.farePrice || 0).toFixed(2)}
                              {order.commissionAmount && ` | 佣金: ¥${order.commissionAmount.toFixed(2)}`}
                            </Text>
                          </View>
                          <View className="text-right">
                            <Text
                              className={`block text-sm font-bold ${
                                order.commissionStatus === 'paid' ? 'text-emerald-600' : 'text-amber-600'
                              }`}
                            >
                              {order.commissionAmount ? `¥${order.commissionAmount.toFixed(2)}` : '未设置'}
                            </Text>
                            <Text
                              className={`text-xs ${
                                order.commissionStatus === 'paid' ? 'text-emerald-500' : 'text-amber-500'
                              }`}
                            >
                              {getCommissionStatusText(order.commissionStatus)}
                            </Text>
                          </View>
                        </View>
                        <View className="flex items-center justify-between mt-2 pt-2 border-t border-border">
                          <Text className="text-xs text-gray-500">{order.ownerName}</Text>
                          {order.paymentTime && (
                            <Text className="text-xs text-gray-400">
                              {new Date(order.paymentTime).toLocaleDateString('zh-CN')}
                            </Text>
                          )}
                        </View>
                      </CardContent>
                    </Card>
                  ))}
                </View>
              </CardContent>
            </Card>
          )}
        </View>
      </ScrollView>
    </View>
  )
}
